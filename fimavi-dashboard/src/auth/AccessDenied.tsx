import { useMsal } from '@azure/msal-react';
import { ShieldAlert } from 'lucide-react';
import { GROUP_NAME } from './authConfig';
import { markLoggedOut } from './autoLogin';

// Compte connecté mais hors du groupe autorisé : on l'indique clairement et on propose
// de changer de compte (déconnexion Microsoft complète).
export function AccessDenied() {
  const { instance } = useMsal();
  const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0];

  // Diagnostic pour l'administrateur : ce que Microsoft a réellement transmis dans le jeton.
  const claims = (account?.idTokenClaims ?? {}) as Record<string, unknown>;
  const groups = Array.isArray(claims.groups) ? claims.groups : null;
  const diagnostic = claims._claim_names
    ? 'trop de groupes pour le jeton (dépassement) : limiter le claim aux groupes attribués à l\'application'
    : groups === null
      ? 'aucun groupe transmis par Microsoft (revendication « groups » absente du jeton)'
      : groups.length === 0
        ? 'liste de groupes vide (le groupe n\'est pas attribué à l\'application d\'entreprise)'
        : `${groups.length} groupe(s) reçu(s), aucun ne correspond au groupe attendu`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        <img src="/A3S.jpg" alt="A3S" className="mb-4 h-12 object-contain mx-auto" />
        <ShieldAlert size={36} className="mx-auto mb-3 text-red-500" />
        <h1 className="mb-2 text-xl font-semibold text-fimavi-primary">Accès refusé</h1>
        <p className="mb-2 text-sm text-slate-600">
          Il vous manque des droits pour accéder aux indicateurs Maintenance.
        </p>
        <p className="mb-6 text-sm text-slate-500">
          {account?.username && (
            <>Le compte <span className="font-medium text-slate-700">{account.username}</span> n'est pas membre du groupe </>
          )}
          {!account?.username && <>Votre compte n'est pas membre du groupe </>}
          <span className="font-medium text-slate-700">{GROUP_NAME}</span>. Contactez votre administrateur
          pour y être ajouté.
        </p>
        <p className="mb-6 -mt-3 text-xs text-slate-400">Diagnostic : {diagnostic}</p>
        <button
          type="button"
          onClick={() => {
            markLoggedOut(); // au retour : bouton (choix du compte), pas de reconnexion automatique
            instance.logoutRedirect({ account });
          }}
          className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Se connecter avec un autre compte
        </button>
      </div>
    </div>
  );
}
