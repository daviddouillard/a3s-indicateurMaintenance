import { useMsal } from '@azure/msal-react';
import { LogOut } from 'lucide-react';
import { markLoggedOut } from './autoLogin';

// Affiche le compte connecté et un bouton de déconnexion (coin supérieur droit).
export function UserMenu() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  if (!account) return null;

  const label = account.name || account.username;

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className="hidden sm:inline text-sm font-medium text-gray-600 truncate max-w-[160px]" title={account.username}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => {
          markLoggedOut(); // déconnexion volontaire : pas de reconnexion automatique au retour
          instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
        }}
        title={`Déconnexion (${account.username})`}
        aria-label="Déconnexion"
        className="flex h-10 min-w-10 sm:h-auto items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 sm:px-3 sm:py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <LogOut size={15} className="text-orange-500" />
        <span className="hidden sm:inline">Déconnexion</span>
      </button>
    </div>
  );
}
