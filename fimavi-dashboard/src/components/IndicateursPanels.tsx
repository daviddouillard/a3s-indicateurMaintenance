import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Panel } from './Panel';
import { useIsMobile } from '../hooks/useIsMobile';
import {
  TYPE_CORRECTIF,
  TYPE_PREVENTIF,
  fmtEuros,
  fmtHeures,
  fmtJours,
  type CoutMois,
  type delaisResolution,
  type heuresParType,
  type topMachines,
} from '../utils/indicateurs';

// Barre horizontale simple (lisible sur mobile, valeur toujours écrite à côté)
function BarRow({ label, value, max, color, valeur, detail }: { label: string; value: number; max: number; color: string; valeur: string; detail?: string }) {
  const pct = max > 0 && value > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-gray-700 truncate">{label}</span>
        <span className="shrink-0 font-semibold text-gray-900 tabular-nums">
          {valeur}
          {detail && <span className="ml-1.5 text-xs font-normal text-gray-400">{detail}</span>}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

const Vide = ({ texte }: { texte: string }) => <p className="flex-1 flex items-center justify-center text-sm text-gray-400 py-6">{texte}</p>;

// 1. Délai moyen de résolution par criticité
export function DelaiPanel({ delais }: { delais: ReturnType<typeof delaisResolution> }) {
  const max = Math.max(...delais.parCriticite.map((c) => c.moyenneJours));
  return (
    <Panel title="Délai de résolution" note="Délai moyen entre la création de la DI et sa clôture (statut Terminé), pour les DI clôturées sur la période. Les DI reprises déjà terminées (clôture = création, délai inconnu) sont exclues.">
      {delais.global.nb === 0 ? (
        <Vide texte="Aucune DI clôturée dans ACOF sur la période" />
      ) : (
        <>
          <div className="text-sm text-gray-500">
            Moyenne <span className="text-2xl font-bold text-gray-900 tabular-nums">{fmtJours(delais.global.moyenneJours)}</span>
            <span className="ml-2">sur {delais.global.nb} DI</span>
          </div>
          <div className="flex flex-col gap-3">
            {delais.parCriticite.map((c) => (
              <BarRow key={c.code} label={c.label} value={c.moyenneJours} max={max} color={c.color} valeur={c.nb ? fmtJours(c.moyenneJours) : '—'} detail={`${c.nb} DI`} />
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

// 2. Préventif / correctif : heures réalisées par type d'intervention
export function TypesPanel({ heures }: { heures: ReturnType<typeof heuresParType> }) {
  const total = heures.reduce((s, h) => s + h.heures, 0);
  const max = Math.max(0, ...heures.map((h) => h.heures));
  const part = (type: number) => (total ? Math.round(((heures.find((h) => h.type === type)?.heures ?? 0) / total) * 100) : 0);
  const color = (type: number) => (type === TYPE_PREVENTIF ? '#16A34A' : type === TYPE_CORRECTIF ? '#B91C1C' : '#6C5CE7');
  return (
    <Panel title="Préventif / correctif" note="Heures réalisées (temps réalisé des BT terminés sur la période), par type d'intervention.">
      {total === 0 ? (
        <Vide texte="Aucun BT terminé sur la période" />
      ) : (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
            <span>Préventif <span className="text-2xl font-bold text-green-700 tabular-nums">{part(TYPE_PREVENTIF)} %</span></span>
            <span>Correctif <span className="text-2xl font-bold text-red-700 tabular-nums">{part(TYPE_CORRECTIF)} %</span></span>
            <span className="self-end">{fmtHeures(total)} au total</span>
          </div>
          <div className="flex flex-col gap-3">
            {heures.slice(0, 6).map((h) => (
              <BarRow key={h.type} label={h.label} value={h.heures} max={max} color={color(h.type)} valeur={fmtHeures(h.heures)} detail={`${h.nb} BT`} />
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

// 3. Machines les plus sollicitées
export function MachinesPanel({ machines }: { machines: ReturnType<typeof topMachines> }) {
  const max = Math.max(0, ...machines.map((m) => m.nbDI));
  return (
    <Panel title="Machines les plus sollicitées" note="Nombre de DI créées sur la période par machine (une DI peut viser plusieurs machines) et heures réalisées sur leurs BT.">
      {machines.length === 0 ? (
        <Vide texte="Aucune DI sur la période" />
      ) : (
        <div className="flex flex-col gap-3">
          {machines.map((m) => (
            <BarRow key={m.id} label={m.nom} value={m.nbDI} max={max} color="#1B1464" valeur={`${m.nbDI} DI`} detail={fmtHeures(m.heures)} />
          ))}
        </div>
      )}
    </Panel>
  );
}

// 4. Coûts par mois (empilés)
const COUTS = [
  { key: 'interne', label: "Main d'œuvre interne", color: '#1B1464' },
  { key: 'externe', label: 'Prestations externes', color: '#F97316' },
  { key: 'pieces', label: 'Pièces', color: '#6C5CE7' },
] as const;

function CoutTooltip({ active, payload }: { active?: boolean; payload?: { payload?: CoutMois }[] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
      <div className="mb-1 font-semibold text-gray-800">{row.label}</div>
      {COUTS.map((c) => (
        <div key={c.key} className="flex items-center gap-2 text-gray-600">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
          <span className="flex-1">{c.label}</span>
          <span className="font-semibold text-gray-900 tabular-nums">{fmtEuros(row[c.key])}</span>
        </div>
      ))}
      <div className="mt-1 border-t border-gray-100 pt-1 text-right font-bold text-gray-900 tabular-nums">{fmtEuros(row.interne + row.externe + row.pieces)}</div>
    </div>
  );
}

export function CoutsPanel({ couts }: { couts: CoutMois[] }) {
  const mobile = useIsMobile();
  const total = (k: 'interne' | 'externe' | 'pieces') => couts.reduce((s, c) => s + c[k], 0);
  const totalGeneral = total('interne') + total('externe') + total('pieces');
  return (
    <Panel title="Coûts de maintenance" note="Coûts des BT terminés, par mois de réalisation : main d'œuvre interne, prestations externes et pièces.">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="text-2xl font-bold text-gray-900 tabular-nums">{fmtEuros(totalGeneral)}</span>
        {COUTS.map((c) => (
          <span key={c.key} className="flex items-center gap-1.5 text-sm text-gray-600">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: c.color }} />
            {c.label} <span className="font-semibold text-gray-900 tabular-nums">{fmtEuros(total(c.key))}</span>
          </span>
        ))}
      </div>
      <div className="h-56 lg:h-auto lg:flex-1 lg:min-h-[12rem]" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart accessibilityLayer={false} data={couts} margin={{ top: 8, right: 0, bottom: 0, left: mobile ? -16 : 0 }}>
            <CartesianGrid vertical={false} stroke="#EEF0F3" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#E5E7EB' }} tick={{ fontSize: 12, fill: '#6B7280' }} minTickGap={4} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)} k` : String(v))} />
            <Tooltip content={<CoutTooltip />} cursor={{ fill: 'rgba(17,24,39,0.04)' }} />
            {COUTS.map((c, i) => (
              <Bar key={c.key} dataKey={c.key} stackId="c" fill={c.color} maxBarSize={40} isAnimationActive={false} radius={i === COUTS.length - 1 ? [3, 3, 0, 0] : 0} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="sr-only">
        <table>
          <caption>Coûts de maintenance par mois</caption>
          <thead>
            <tr>
              <th scope="col">Mois</th>
              {COUTS.map((c) => <th key={c.key} scope="col">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {couts.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.label}</th>
                {COUTS.map((c) => <td key={c.key}>{fmtEuros(r[c.key])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
