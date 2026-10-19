import { RefreshCw } from 'lucide-react';

interface RefreshButtonProps {
  busy: boolean;
  onRefresh: () => void;
}

// Bouton bannière : relit l'API maintenance sans attendre le cache serveur (état géré
// par le parent via useRefresh).
export function RefreshButton({ busy, onRefresh }: RefreshButtonProps) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={busy}
      title="Relire les données ACOF"
      aria-label={busy ? 'Actualisation en cours' : 'Actualiser'}
      className="flex h-10 min-w-10 sm:h-auto items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 sm:px-3 sm:py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
    >
      <RefreshCw size={15} className={`text-orange-500 ${busy ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">{busy ? 'Actualisation…' : 'Actualiser'}</span>
    </button>
  );
}
