import { CalendarRange } from 'lucide-react';
import { CRITICITES, type Periode } from '../utils/indicateurs';
import { fmtDate, addDays } from '../utils/dates';

interface FiltresProps {
  periodes: Periode[];
  periode: Periode;
  onPeriode: (key: string) => void;
  criticite: number | null;
  onCriticite: (c: number | null) => void;
}

const OPTIONS_CRITICITE = [{ code: null, label: 'Toutes' }, ...CRITICITES.map((c) => ({ code: c.code as number | null, label: c.label }))];

// Barre de filtres commune à tous les pavés : période d'analyse + criticité des DI
export function Filtres({ periodes, periode, onPeriode, criticite, onCriticite }: FiltresProps) {
  return (
    <div className="w-full max-w-[1800px] flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <label className="flex items-center gap-2 rounded-full bg-white border border-gray-200 pl-3 pr-1 py-1 shadow-sm">
        <CalendarRange size={16} className="text-orange-500 shrink-0" />
        <span className="sr-only">Période</span>
        <select
          value={periode.key}
          onChange={(e) => onPeriode(e.target.value)}
          className="flex-1 bg-transparent py-1.5 pr-2 text-sm font-semibold text-gray-800 focus:outline-none"
        >
          {periodes.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
      </label>
      <span className="text-xs text-gray-500">
        du {fmtDate(periode.start)} au {fmtDate(addDays(periode.end, -1))}
      </span>

      <div className="sm:ml-auto flex items-center rounded-full bg-gray-100 p-1" role="group" aria-label="Criticité">
        {OPTIONS_CRITICITE.map((o) => {
          const actif = criticite === o.code;
          return (
            <button
              key={o.label}
              type="button"
              aria-pressed={actif}
              onClick={() => onCriticite(o.code)}
              className={`flex-1 sm:flex-none rounded-full px-3 py-2 lg:py-1 text-sm font-medium transition-colors ${
                actif ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
