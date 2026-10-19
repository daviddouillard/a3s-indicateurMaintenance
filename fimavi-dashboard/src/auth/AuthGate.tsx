import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { useEffect, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { loginRequest, GROUP_ID } from './authConfig';
import { autoLoginAllowed, clearAutoLoginFlags, markLoginError } from './autoLogin';
import { AccessDenied } from './AccessDenied';

// Écran de connexion affiché tant que l'utilisateur n'est pas authentifié. Par défaut, la
// connexion Microsoft part toute seule (cf. autoLogin.ts) : l'écran n'est qu'une transition.
function LoginScreen() {
  const { instance, inProgress } = useMsal();
  const busy = inProgress !== InteractionStatus.None;
  const [auto, setAuto] = useState(autoLoginAllowed);

  useEffect(() => {
    if (auto && inProgress === InteractionStatus.None) {
      instance.loginRedirect(loginRequest).catch(() => {
        markLoginError();
        setAuto(false); // échec : on affiche le bouton
      });
    }
  }, [auto, inProgress, instance]);

  const login = () => {
    clearAutoLoginFlags();
    instance.loginRedirect(loginRequest);
  };

  if (auto) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-slate-500">
        <RefreshCw size={24} className="animate-spin text-orange-500" />
        <p className="text-sm font-medium">Connexion…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <img src="/A3S.jpg" alt="A3S" className="mb-4 h-12 object-contain mx-auto" />
        <h1 className="mb-2 text-xl font-semibold text-fimavi-primary text-center">Indicateurs Maintenance</h1>
        <p className="mb-6 text-sm text-slate-500">
          Connectez-vous avec votre compte Microsoft de l'organisation pour accéder au tableau de bord.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={login}
          className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-60"
        >
          {busy ? 'Connexion…' : 'Se connecter avec Microsoft'}
        </button>
      </div>
    </div>
  );
}

// Connecté : dashboard si le compte est membre du groupe autorisé, sinon « droits manquants ».
function MemberGate({ children }: { children: ReactNode }) {
  const { instance } = useMsal();
  const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0];
  const groups = (account?.idTokenClaims?.groups as string[] | undefined) ?? [];
  if (!groups.includes(GROUP_ID)) return <AccessDenied />;
  return <>{children}</>;
}

// N'affiche les enfants (le dashboard) qu'une fois l'utilisateur authentifié et autorisé.
export function AuthGate({ children }: { children: ReactNode }) {
  // Dev local uniquement (vite dev, VITE_AUTH_DISABLED=1 + backend AUTH_DISABLED=1) : le
  // navigateur intégré ne passe pas l'accès conditionnel FIMAVI. Éliminé du build de prod.
  if (import.meta.env.DEV && import.meta.env.VITE_AUTH_DISABLED === '1') return <>{children}</>;
  return (
    <>
      <AuthenticatedTemplate>
        <MemberGate>{children}</MemberGate>
      </AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <LoginScreen />
      </UnauthenticatedTemplate>
    </>
  );
}
