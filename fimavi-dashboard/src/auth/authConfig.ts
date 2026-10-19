import { PublicClientApplication, LogLevel } from '@azure/msal-browser';
import type { Configuration } from '@azure/msal-browser';

// --- Paramètres Entra ID (fournis à la construction via variables Vite) ---
const CLIENT_ID = import.meta.env.VITE_ENTRA_CLIENT_ID as string;
const TENANT_ID = import.meta.env.VITE_ENTRA_TENANT_ID as string;
// Groupe autorisé (GCP-A3S-Indicateurs-MaintenanceAcces) : sert uniquement à afficher l'écran
// « droits manquants » ; le contrôle qui fait foi est côté backend (requireAuth).
export const GROUP_ID = import.meta.env.VITE_ENTRA_GROUP_ID as string;
export const GROUP_NAME = 'GCP-A3S-Indicateurs-MaintenanceAcces';

if (!CLIENT_ID || !TENANT_ID || !GROUP_ID) {
  // Erreur explicite au chargement plutôt qu'un échec silencieux de connexion
  console.error(
    'Config Entra manquante : VITE_ENTRA_CLIENT_ID, VITE_ENTRA_TENANT_ID et VITE_ENTRA_GROUP_ID sont requis.'
  );
}

// Single-tenant : l'authority pointe sur le tenant Fimavi, pas sur /common
const AUTHORITY = `https://login.microsoftonline.com/${TENANT_ID}`;

// On authentifie les appels /api avec l'ID token (aud = clientId), émis par le
// login OIDC standard : pas besoin d'exposer une API custom dans l'App Registration.
// Le backend valide signature + émetteur + audience (= clientId).

const msalConfig: Configuration = {
  auth: {
    clientId: CLIENT_ID,
    authority: AUTHORITY,
    // La redirection revient sur l'origine courante (localhost en dev, l'URL Cloud Run en prod).
    // Ces URI doivent être déclarées dans l'App Registration.
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        if (level === LogLevel.Error) console.error(message);
      },
    },
  },
};

// Instance unique partagée : utilisée par MsalProvider (main.tsx) ET par apiClient
// (pour récupérer un jeton depuis les hooks, hors composant React).
export const msalInstance = new PublicClientApplication(msalConfig);

// Connexion : scopes OIDC standards (l'ID token obtenu sert à authentifier /api)
export const loginRequest = {
  scopes: ['openid', 'profile'],
};

// Rafraîchissement silencieux : mêmes scopes OIDC ; on utilisera l'ID token du résultat
export const tokenRequest = {
  scopes: ['openid', 'profile'],
};
