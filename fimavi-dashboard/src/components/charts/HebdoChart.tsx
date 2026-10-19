import { CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SemaineRow } from '../../utils/indicateurs';
import { useIsMobile } from '../../hooks/useIsMobile';

// Trois courbes : flux de la semaine (entrées, clôtures) et stock en fin de semaine (backlog)
const SERIES = [
  { key: 'nouveaux', label: 'Entrées', color: '#2563EB', width: 2 },
  { key: 'realises', label: 'Clôturées', color: '#16A34A', width: 2 },
  { key: 'backlog', label: 'Backlog (en cours)', color: '#1B1464', width: 3 },
] as const;

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { dataKey?: string | number; value?: number; payload?: SemaineRow }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
      <div className="mb-1 font-semibold text-gray-800">{row?.tooltip}</div>
      {SERIES.map((s) => (
        <div key={s.key} className="flex items-center gap-2 text-gray-600">
          <span className="h-1 w-3 rounded-full" style={{ backgroundColor: s.color }} />
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
  // Points et étiquettes de valeurs seulement quand ils restent lisibles
  const points = rows.length <= 26;
  const labels = rows.length <= (mobile ? 6 : 12);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-sm text-gray-600">
            <span className="h-1 w-4 rounded-full" style={{ backgroundColor: s.color }} />
            <span>{s.label}</span>
            <span className="font-bold text-gray-900 tabular-nums">{s.key === 'backlog' ? dernier : total(s.key)}</span>
          </div>
        ))}
        <span className="text-xs text-gray-400">totaux de la période · backlog actuel</span>
      </div>

      {/* Hauteur explicite : une simple min-height laisse ResponsiveContainer à 0 px */}
      <div className="h-80 lg:h-[22rem]" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart accessibilityLayer={false} data={rows} margin={{ top: 20, right: mobile ? 8 : 16, bottom: 0, left: mobile ? -28 : -12 }}>
            <CartesianGrid vertical={false} stroke="#EEF0F3" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#E5E7EB' }} tick={{ fontSize: 12, fill: '#6B7280' }} minTickGap={8} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#9CA3AF' }} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#D1D5DB' }} />
            {SERIES.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={s.width}
                dot={points ? { r: 3, fill: s.color, strokeWidth: 0 } : false}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              >
                {labels && <LabelList dataKey={s.key} position="top" fontSize={11} fontWeight={600} fill={s.color} />}
              </Line>
            ))}
          </LineChart>
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
