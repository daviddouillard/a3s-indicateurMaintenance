import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { apiFetch } from '../auth/apiClient';
import { AccessDenied } from '../auth/AccessDenied';
import { UserMenu } from '../auth/UserMenu';
import { Panel } from '../components/Panel';

const NOT_IN_GROUP = 'NOT_IN_GROUP';

// Plateforme vierge : vérifie la chaîne frontend → jeton Entra → backend en attendant les
// indicateurs maintenance (API BDIP à brancher).
function usePing() {
  return useQuery({
    queryKey: ['ping'],
    queryFn: async () => {
      const res = await apiFetch('/api/ping');
      if (res.status === 403) throw new Error(NOT_IN_GROUP);
      if (!res.ok) throw new Error(`API ${res.status}`);
      return (await res.json()) as { ok: boolean; at: string };
    },
    retry: false,
  });
}

export default function MaintenancePage() {
  const { isPending, isError, error } = usePing();

  // Le serveur a refusé le compte (hors groupe) : même écran que la porte de connexion
  if (error?.message === NOT_IN_GROUP) return <AccessDenied />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-20 bg-white px-3 sm:px-6 py-2 shadow-sm border-b border-gray-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Vers le portail via son point de connexion Microsoft : session reprise sans ressaisie */}
          <a href="https://indicateurs.ateliers3s.com/auth/microsoft" className="shrink-0" title="Portail des indicateurs">
            <img src="/A3S.jpg" alt="A3S" className="h-8 object-contain" />
          </a>
          <h1 className="text-base sm:text-lg font-bold text-gray-800 truncate">Indicateurs Maintenance</h1>
        </div>
        <UserMenu />
      </header>

      <main className="flex-1 flex flex-col items-center p-3 sm:p-4">
        <Panel title="Indicateurs Maintenance" className="w-full max-w-xl">
          <p className="text-sm text-gray-600">
            La plateforme est en place. Les indicateurs maintenance apparaîtront ici une fois l'API branchée.
          </p>
          <div className="flex items-center gap-2 text-sm">
            {isPending ? (
              <><RefreshCw size={16} className="animate-spin text-orange-500" /> Vérification de l'API…</>
            ) : isError ? (
              <><XCircle size={16} className="text-red-500" /> API injoignable</>
            ) : (
              <><CheckCircle2 size={16} className="text-green-500" /> Connexion API opérationnelle</>
            )}
          </div>
        </Panel>
      </main>
    </div>
  );
}
