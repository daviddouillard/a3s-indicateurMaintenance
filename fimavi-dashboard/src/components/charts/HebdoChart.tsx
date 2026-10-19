import { Bar, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SemaineRow } from '../../utils/indicateurs';
import { useIsMobile } from '../../hooks/useIsMobile';

// Barres = flux de la semaine, ligne = stock (backlog) en fin de semaine
const SERIES = [
  { key: 'nouveaux', label: 'Nouveaux', color: '#2563EB', kind: 'bar' },
  { key: 'realises', label: 'Réalisés', color: '#16A34A', kind: 'bar' },
  { key: 'backlog', label: 'Backlog (en cours)', color: '#1B1464', kind: 'line' },
] as const;

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { dataKey?: string | number; value?: number; payload?: SemaineRow }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
      <div className="mb-1 font-semibold text-gray-800">{row?.tooltip}</div>
      {SERIES.map((s) => (
        <div key={s.key} className="flex items-center gap-2 text-gray-600">
          <span className={`h-2.5 w-2.5 ${s.kind === 'line' ? 'rounded-full' : 'rounded-sm'}`} style={{ backgroundColor: s.color }} />
          <span className="flex-1">{s.label}</span>
          <span className="font-semibold text-gray-900 tabular-nums">{row?.[s.key] ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

export function HebdoChart({ rows }: { rows: SemaineRow[] }) {
  const mobile = useIsMobile();
  const total = (k: 'nouveaux' | 'realises') => rows.reduce((s, r) => s + r[k], 0);
  const dernier = rows.at(-1)?.backlog ?? 0;
  // Étiquettes de valeurs seulement quand elles restent lisibles
  const labels = rows.length <= (mobile ? 6 : 16);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-sm text-gray-600">
            <span className={s.kind === 'line' ? 'h-1 w-4 rounded-full' : 'h-3 w-3 rounded-sm'} style={{ backgroundColor: s.color }} />
            <span>{s.label}</span>
            <span className="font-bold text-gray-900 tabular-nums">{s.key === 'backlog' ? dernier : total(s.key)}</span>
          </div>
        ))}
        <span className="text-xs text-gray-400">totaux de la période · backlog actuel</span>
      </div>

      {/* Hauteur explicite : une simple min-height laisse ResponsiveContainer à 0 px */}
      <div className="h-80 lg:h-[22rem]" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart accessibilityLayer={false} data={rows} margin={{ top: 20, right: mobile ? 0 : 8, bottom: 0, left: mobile ? -28 : -12 }} barGap={2} barCategoryGap={rows.length > 30 ? '10%' : '22%'}>
            <CartesianGrid vertical={false} stroke="#EEF0F3" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#E5E7EB' }} tick={{ fontSize: 12, fill: '#6B7280' }} minTickGap={8} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(17,24,39,0.04)' }} />
            {SERIES.filter((s) => s.kind === 'bar').map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                {labels && <LabelList dataKey={s.key} position="top" fontSize={11} fontWeight={600} fill="#374151" />}
              </Bar>
            ))}
            <Line dataKey="backlog" name="Backlog" stroke="#1B1464" strokeWidth={2.5} dot={rows.length <= 26 ? { r: 3, fill: '#1B1464' } : false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="sr-only">
        <table>
          <caption>Demandes d'intervention par semaine</caption>
          <thead>
            <tr>
              <th scope="col">Semaine</th>
              {SERIES.map((s) => <th key={s.key} scope="col">{s.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.tooltip}</th>
                {SERIES.map((s) => <td key={s.key}>{r[s.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
