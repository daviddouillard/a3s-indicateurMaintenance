import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LogIn } from 'lucide-react';
import { RECONNEXION } from '../hooks/apiErrors';
import { reconnecter } from '../auth/apiClient';

// Dev local sans connexion (cf. AuthGate) : pas de session à surveiller
const AUTH_DISABLED = import.meta.env.DEV && import.meta.env.VITE_AUTH_DISABLED === '1';

// Bandeau de secours : session Microsoft expirée (RECONNEXION : renouvellement impossible, même après
// redirection). Un chargement lent (démarrage à froid, recalcul) n'est PAS une session expirée : il ne
// déclenche pas le bandeau (les appels /api sont bornés par apiClient, la page ne tourne pas sans fin).
// Évite d'avoir à se déconnecter / reconnecter à la main quand la page « tourne » sans fin.
// Le bouton « Actualiser » n'est pas une requête react-query : il n'est pas surveillé ici.
export function SessionWatchdog() {
  const client = useQueryClient();
  const [expiree, setExpiree] = useState(false);
  const [busy, setBusy] = useState(false);

  // Une requête en erreur « session à refaire »
  useEffect(() => {
    const cache = client.getQueryCache();
    const verifier = () => setExpiree(cache.getAll().some((q) => q.state.error?.message === RECONNEXION));
    verifier();
    return cache.subscribe(verifier);
  }, [client]);

  if (AUTH_DISABLED || !expiree) return null;

  return (
    <div role="alert" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-xl border border-orange-200 bg-white p-4 shadow-xl sm:bottom-6">
      <p className="text-sm font-semibold text-gray-800">
        'Votre session Microsoft a expiré.'
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Reconnectez-vous pour afficher les indicateurs (sans saisie si votre session Microsoft est ouverte).
      </p>
      {/* Seule action proposée : recharger la page ne débloque pas une session bloquée */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            reconnecter().catch((e) => {
              console.error('Reconnexion impossible', e);
              setBusy(false);
            });
          }}
          className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
        >
          <LogIn size={15} />
          {busy ? 'Reconnexion…' : 'Se reconnecter'}
        </button>
      </div>
    </div>
  );
}
