import type { ReactNode } from 'react';
import { AlertTriangle, ClipboardList, Clock, ShieldCheck, CalendarX } from 'lucide-react';
import { fmtJours, type Kpis } from '../utils/indicateurs';

function Tile({ icon, label, value, hint, alert = false, className = '' }: { icon: ReactNode; label: string; value: string; hint?: string; alert?: boolean; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-md px-3 sm:px-4 py-3 flex items-center gap-3 min-w-0 ${className}`}>
      <div className={`hidden sm:block shrink-0 rounded-xl p-2 ${alert ? 'bg-red-50 text-red-700' : 'bg-fimavi-light text-fimavi-primary'}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-gray-500 leading-tight sm:truncate">{label}</div>
        <div className={`text-2xl font-bold tabular-nums leading-tight ${alert ? 'text-red-700' : 'text-gray-900'}`}>{value}</div>
        {hint && <div className="text-[11px] text-gray-400 leading-tight sm:truncate">{hint}</div>}
      </div>
    </div>
  );
}

// Vignettes : état actuel (backlog, retards) + synthèse de la période sélectionnée
export function KpiTiles({ k }: { k: Kpis }) {
  return (
    <div className="w-full max-w-[1800px] grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
      <Tile icon={<ClipboardList size={20} />} label="DI en cours" value={String(k.backlog)} hint="nouvelles, acceptées, en attente" />
      <Tile icon={<AlertTriangle size={20} />} label="dont critiques" value={String(k.backlogCritiques)} alert={k.backlogCritiques > 0} hint="à traiter en priorité" />
      <Tile icon={<CalendarX size={20} />} label="BT en retard" value={String(k.btEnRetard)} alert={k.btEnRetard > 0} hint="fin prévue dépassée" />
      <Tile icon={<Clock size={20} />} label="Délai moyen de résolution" value={k.delaiMoyenJours == null ? '—' : fmtJours(k.delaiMoyenJours)} hint="DI clôturées sur la période" />
      <Tile
        icon={<ShieldCheck size={20} />}
        className="col-span-2 lg:col-span-1"
        label="Part du préventif"
        value={k.tauxPreventif == null ? '—' : `${Math.round(k.tauxPreventif * 100)} %`}
        hint="des heures réalisées sur la période"
      />
    </div>
  );
}
