import type { BonTravail, DemandeIntervention, Machine } from '../hooks/useMaintenance';
import { addDays, daysBetween, isoWeek, isoYearStart, mondayOf, monthKey } from './dates';

// --- Codes ACOF ---

export const DI_TERMINE = 100;
export const BT_TERMINE = 100;
export const BT_ANNULE = 200;

export const CRITICITES = [
  { code: 1, label: 'Critique', color: '#B91C1C' },
  { code: 2, label: 'Majeur', color: '#F97316' },
  { code: 3, label: 'Mineur', color: '#2563EB' },
] as const;

export const TYPES_INTERVENTION: Record<number, string> = {
  1: 'Préventif',
  2: 'Sécurité / environnement',
  3: 'Inspection / contrôle réglementaire',
  4: 'Travaux neufs / mise en service',
  5: 'Correctif',
  6: 'Amélioration / ergonomie',
  7: 'Réglage / calibration',
  8: 'Formation opérateur',
  9: 'Audit technique',
  10: 'Autre',
};
export const TYPE_PREVENTIF = 1;
export const TYPE_CORRECTIF = 5;

// --- Période d'analyse ---

export interface Periode {
  key: string;
  label: string;
  start: Date; // lundi 00:00
  end: Date; // lundi suivant la dernière semaine (exclu)
}

// Choix proposés : N dernières semaines (jusqu'à la semaine en cours incluse) et années civiles ISO
export function periodes(years: number[], today = new Date()): Periode[] {
  const nextMonday = addDays(mondayOf(today), 7);
  const glissantes = [4, 12, 26, 52].map((n) => ({
    key: `${n}s`,
    label: `${n} dernières semaines`,
    start: addDays(nextMonday, -7 * n),
    end: nextMonday,
  }));
  const annees = years.map((y) => {
    const fin = isoYearStart(y + 1);
    return {
      key: `a${y}`,
      label: `Année ${y}`,
      start: isoYearStart(y),
      end: fin < nextMonday ? fin : nextMonday, // année en cours : jusqu'à la semaine en cours
    };
  });
  return [...annees, ...glissantes];
}

const toDate = (s: string | null) => (s ? new Date(s) : null);

// DI non datée, exclue de toutes les séries datées (graphique, délais, machines) :
//  - sans date de création (reprise initiale ACOF) : sa clôture, posée en masse par la
//    reprise SQL, fausserait aussi les « réalisés » ;
//  - terminée sans date de clôture.
// Elle reste comptée dans les DI en cours (vignettes), qui ne dépendent que du statut.
export const nonDatee = (di: DemandeIntervention) => !di.dateEnregistrement || (di.statut === DI_TERMINE && !di.dateCloture);
const datees = (dis: DemandeIntervention[]) => dis.filter((di) => !nonDatee(di));

const enCours = (di: DemandeIntervention) => di.statut !== DI_TERMINE;

function ouverteA(di: DemandeIntervention, t: Date): boolean {
  const created = toDate(di.dateEnregistrement);
  if (!created || created >= t) return false;
  const closed = toDate(di.dateCloture);
  return !closed || closed >= t;
}

// --- Graphique hebdomadaire : nouveaux / réalisés / backlog ---

export interface SemaineRow {
  key: string;
  label: string; // "S12"
  tooltip: string; // "Semaine 12 · 2026"
  nouveaux: number;
  realises: number;
  backlog: number; // DI ouvertes (statuts 1, 10, 50) à la fin de la semaine
}

export function seriesHebdo(toutes: DemandeIntervention[], periode: Periode): SemaineRow[] {
  const dis = datees(toutes);
  const rows: SemaineRow[] = [];
  for (let monday = periode.start; monday < periode.end; monday = addDays(monday, 7)) {
    const fin = addDays(monday, 7);
    const { year, week } = isoWeek(monday);
    const dans = (s: string | null) => {
      const d = toDate(s);
      return !!d && d >= monday && d < fin;
    };
    rows.push({
      key: `${year}-${week}`,
      label: `S${week}`,
      tooltip: `Semaine ${week} · ${year}`,
      nouveaux: dis.filter((di) => dans(di.dateEnregistrement)).length,
      realises: dis.filter((di) => dans(di.dateCloture)).length,
      backlog: dis.filter((di) => ouverteA(di, fin)).length,
    });
  }
  return rows;
}

// --- Vignettes (état actuel + période) ---

export interface Kpis {
  backlog: number;
  backlogCritiques: number;
  btEnRetard: number;
  delaiMoyenJours: number | null;
  tauxPreventif: number | null; // part des heures réalisées en préventif sur la période
  nonDatees: number;
}

export function kpis(dis: DemandeIntervention[], bts: BonTravail[], periode: Periode, now = new Date()): Kpis {
  const ouvertes = dis.filter(enCours);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const btEnRetard = bts.filter((bt) => {
    const fin = toDate(bt.datePrevueFin);
    return !!fin && fin < today && bt.statut !== BT_TERMINE && bt.statut !== BT_ANNULE;
  }).length;
  const delais = delaisResolution(dis, periode);
  const heures = heuresParType(bts, periode);
  const total = heures.reduce((s, h) => s + h.heures, 0);
  const preventif = heures.find((h) => h.type === TYPE_PREVENTIF)?.heures ?? 0;
  return {
    backlog: ouvertes.length,
    backlogCritiques: ouvertes.filter((di) => di.criticite === 1).length,
    btEnRetard,
    delaiMoyenJours: delais.global.nb ? delais.global.moyenneJours : null,
    tauxPreventif: total ? preventif / total : null,
    nonDatees: dis.filter(nonDatee).length,
  };
}

// --- Délai de résolution (création → clôture), DI clôturées sur la période ---

export interface Delai {
  nb: number;
  moyenneJours: number;
}

export function delaisResolution(dis: DemandeIntervention[], periode: Periode) {
  const acc = new Map<number, { nb: number; total: number }>();
  const global = { nb: 0, total: 0 };
  for (const di of dis) {
    const created = toDate(di.dateEnregistrement);
    const closed = toDate(di.dateCloture);
    if (!created || !closed || closed < periode.start || closed >= periode.end) continue;
    // DI reprise déjà terminée : la reprise SQL a posé clôture = création (délai réel inconnu)
    if (closed.getTime() === created.getTime()) continue;
    const jours = Math.max(0, daysBetween(created, closed));
    const c = acc.get(di.criticite ?? 0) ?? { nb: 0, total: 0 };
    c.nb += 1;
    c.total += jours;
    acc.set(di.criticite ?? 0, c);
    global.nb += 1;
    global.total += jours;
  }
  const moyenne = (x: { nb: number; total: number }): Delai => ({ nb: x.nb, moyenneJours: x.nb ? x.total / x.nb : 0 });
  return {
    global: moyenne(global),
    parCriticite: CRITICITES.map((c) => ({ ...c, ...moyenne(acc.get(c.code) ?? { nb: 0, total: 0 }) })),
  };
}

// --- Heures réalisées par type d'intervention (BT terminés, réalisés sur la période) ---

const btRealiseDans = (bt: BonTravail, periode: Periode) => {
  const d = toDate(bt.dateRealisation);
  return bt.statut === BT_TERMINE && !!d && d >= periode.start && d < periode.end;
};

export function heuresParType(bts: BonTravail[], periode: Periode) {
  const acc = new Map<number, { heures: number; nb: number }>();
  for (const bt of bts) {
    if (!btRealiseDans(bt, periode)) continue;
    const type = bt.typeIntervention ?? 10;
    const a = acc.get(type) ?? { heures: 0, nb: 0 };
    a.heures += (bt.tempsRealise ?? 0) / 60;
    a.nb += 1;
    acc.set(type, a);
  }
  return [...acc.entries()]
    .map(([type, a]) => ({ type, label: TYPES_INTERVENTION[type] ?? `Type ${type}`, ...a }))
    .sort((a, b) => b.heures - a.heures);
}

// --- Machines les plus sollicitées (DI créées sur la période) ---

export function topMachines(dis: DemandeIntervention[], bts: BonTravail[], machines: Machine[], periode: Periode, limite = 8) {
  const noms = new Map(machines.map((m) => [m.idMachine, m.nom ?? `Machine ${m.idMachine}`]));
  const heuresDI = new Map<number, number>();
  for (const bt of bts) {
    if (bt.idDemandeIntervention == null || bt.statut === BT_ANNULE) continue;
    heuresDI.set(bt.idDemandeIntervention, (heuresDI.get(bt.idDemandeIntervention) ?? 0) + (bt.tempsRealise ?? 0) / 60);
  }
  const acc = new Map<number, { nbDI: number; heures: number }>();
  for (const di of dis) {
    const created = toDate(di.dateEnregistrement);
    if (!created || created < periode.start || created >= periode.end) continue;
    const ids = (di.idMachine ?? '').split(';').map((s) => Number(s.trim())).filter((n) => n > 0);
    for (const id of new Set(ids)) {
      const a = acc.get(id) ?? { nbDI: 0, heures: 0 };
      a.nbDI += 1;
      a.heures += heuresDI.get(di.idDemandeIntervention) ?? 0;
      acc.set(id, a);
    }
  }
  return [...acc.entries()]
    .map(([id, a]) => ({ id, nom: noms.get(id) ?? `Machine ${id}`, ...a }))
    .sort((a, b) => b.nbDI - a.nbDI || b.heures - a.heures)
    .slice(0, limite);
}

// --- Coûts de maintenance par mois (BT terminés, mois de réalisation) ---

export interface CoutMois {
  key: string;
  label: string;
  interne: number;
  externe: number;
  pieces: number;
}

export function coutsParMois(bts: BonTravail[], periode: Periode): CoutMois[] {
  const rows = new Map<string, CoutMois>();
  // Tous les mois de la période, même sans coût (axe continu)
  for (let d = new Date(periode.start.getFullYear(), periode.start.getMonth(), 1); d < periode.end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    rows.set(monthKey(d), { key: monthKey(d), label, interne: 0, externe: 0, pieces: 0 });
  }
  for (const bt of bts) {
    if (!btRealiseDans(bt, periode)) continue;
    const row = rows.get(monthKey(new Date(bt.dateRealisation!)));
    if (!row) continue;
    row.interne += bt.coutMainOeuvreInterne ?? 0;
    row.externe += bt.coutPrestationExterne ?? 0;
    row.pieces += bt.coutPieces ?? 0;
  }
  return [...rows.values()];
}

// Filtre criticité : appliqué aux DI, et aux BT via leur DI
export function filtrerCriticite(dis: DemandeIntervention[], bts: BonTravail[], criticite: number | null) {
  if (criticite == null) return { dis, bts };
  const fdis = dis.filter((di) => di.criticite === criticite);
  const ids = new Set(fdis.map((di) => di.idDemandeIntervention));
  return { dis: fdis, bts: bts.filter((bt) => bt.idDemandeIntervention != null && ids.has(bt.idDemandeIntervention)) };
}

export const fmtEuros = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const fmtHeures = (h: number) => `${h.toLocaleString('fr-FR', { maximumFractionDigits: h < 10 ? 1 : 0 })} h`;
export const fmtJours = (j: number) => `${j.toLocaleString('fr-FR', { maximumFractionDigits: j < 10 ? 1 : 0 })} j`;
