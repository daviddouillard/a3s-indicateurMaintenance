// Données fictives pour le développement local (MAINTENANCE_MOCK=1) : même forme JSON que
// l'API A3SreportingBDIP (camelCase), générées de façon déterministe sur ~18 mois.

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const MACHINES = [
  'Extrudeuse 1', 'Extrudeuse 2', 'Contrecolleuse', 'Refendeuse 1', 'Refendeuse 2',
  'Enrouleuse', 'Massicot', 'Thermoformeuse', 'Compresseur', 'Pont roulant',
].map((nom, i) => ({ idMachine: i + 1, nom }));

const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

export function mockMaintenance() {
  const r = rng(42);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const now = new Date();
  const start = addDays(now, -540);
  const dis = [];
  const bts = [];
  let idBT = 1;

  for (let day = 0, id = 1; day <= 540; day++) {
    const date = addDays(start, day);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    const nb = r() < 0.35 ? 0 : r() < 0.75 ? 1 : 2;
    for (let k = 0; k < nb; k++, id++) {
      const criticite = r() < 0.15 ? 1 : r() < 0.5 ? 2 : 3;
      const created = new Date(date.getTime() + (7 + r() * 9) * 3600000);
      const ageJours = (now - created) / 86400000;
      const delai = (criticite === 1 ? 1 : criticite === 2 ? 5 : 12) * (0.3 + r() * 2);
      const termine = delai < ageJours && r() < 0.95;
      const statut = termine ? 100 : pick([1, 10, 10, 50]);
      const cloture = termine ? addDays(created, delai) : null;
      const machine = MACHINES[Math.floor(r() ** 1.6 * MACHINES.length)];
      const di = {
        idDemandeIntervention: id,
        numDI: `DI${String(id).padStart(5, '0')}`,
        statut,
        criticite,
        idMachine: r() < 0.1 ? `${machine.idMachine};${pick(MACHINES).idMachine}` : String(machine.idMachine),
        titre: `Intervention ${machine.nom}`,
        demandeur: pick(['A. Martin', 'B. Durand', 'C. Petit', 'D. Moreau']),
        dateEnregistrement: created.toISOString(),
        dateCloture: cloture?.toISOString() ?? null,
        nbBT: 0,
      };
      const nbBT = termine ? 1 + (r() < 0.25 ? 1 : 0) : statut === 1 ? 0 : r() < 0.6 ? 1 : 0;
      for (let b = 0; b < nbBT; b++) {
        const type = r() < 0.3 ? 1 : r() < 0.7 ? 5 : pick([2, 3, 4, 6, 7, 8, 9, 10]);
        const prevu = Math.round((30 + r() * 300) / 15) * 15;
        const fini = termine;
        const debut = addDays(created, 0.5 + r() * Math.max(delai - 0.5, 0.5));
        bts.push({
          idBonTravail: idBT,
          numBT: `BT${String(idBT).padStart(5, '0')}`,
          idDemandeIntervention: id,
          typeIntervention: type,
          statut: fini ? 100 : r() < 0.5 ? 1 : 10,
          tempsPrevu: prevu,
          tempsRealise: fini ? Math.round(prevu * (0.6 + r() * 0.9)) : null,
          datePrevueDebut: debut.toISOString().slice(0, 10) + 'T00:00:00',
          datePrevueFin: addDays(debut, 1).toISOString().slice(0, 10) + 'T00:00:00',
          dateRealisation: fini ? cloture.toISOString().slice(0, 10) + 'T00:00:00' : null,
          coutPrestationExterne: r() < 0.2 ? Math.round(r() * 2500) : null,
          coutMainOeuvreInterne: fini ? Math.round((prevu / 60) * 45) : null,
          coutPieces: r() < 0.4 ? Math.round(r() * 1200) : null,
          nbIntervenantsInternes: 1 + (r() < 0.3 ? 1 : 0),
          nbIntervenantsExternes: r() < 0.15 ? 1 : 0,
          dateEnregistrement: addDays(created, 0.2).toISOString(),
        });
        idBT++;
        di.nbBT++;
      }
      dis.push(di);
    }
  }
  return { dis, bts, machines: MACHINES };
}
