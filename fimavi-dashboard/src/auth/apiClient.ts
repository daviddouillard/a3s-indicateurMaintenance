import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { msalInstance, tokenRequest } from './authConfig';

// Récupère un jeton d'accès Entra pour l'API, en silencieux si possible.
// Si le refresh silencieux échoue (session expirée, consentement requis), on
// bascule sur une redirection de connexion.
// Marge avant expiration : un ID token qui expire dans moins de 5 min est renouvelé.
const EXPIRY_MARGIN_S = 5 * 60;

async function acquireToken(forceRefresh = false): Promise<string> {
  const account = msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0];
  if (!account) {
    await msalInstance.acquireTokenRedirect(tokenRequest);
    // La redirection interrompt l'exécution ; ce throw n'est jamais atteint utilement.
    throw new Error('Redirection de connexion en cours');
  }
  try {
    let result = await msalInstance.acquireTokenSilent({ ...tokenRequest, account, forceRefresh });
    // MSAL peut rendre depuis son cache un ID token déjà expiré (il ne suit que
    // l'expiration du jeton d'accès) : dans ce cas on force le renouvellement.
    const exp = Number((result.idTokenClaims as { exp?: number } | undefined)?.exp ?? 0);
    if (!forceRefresh && exp * 1000 < Date.now() + EXPIRY_MARGIN_S * 1000) {
      result = await msalInstance.acquireTokenSilent({ ...tokenRequest, account, forceRefresh: true });
    }
    // On authentifie /api avec l'ID token (aud = clientId), pas un jeton d'API custom.
    return result.idToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      await msalInstance.acquireTokenRedirect(tokenRequest);
      throw new Error('Redirection de connexion en cours');
    }
    throw err;
  }
}

async function fetchWithToken(input: string, init: RequestInit, token: string): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

// fetch authentifié : ajoute l'en-tête Authorization: Bearer <jeton>. Sur un 401 (jeton
// refusé, par ex. expiré), on renouvelle le jeton et on réessaie une fois.
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  // Dev local sans connexion (cf. AuthGate) : éliminé du build de prod
  if (import.meta.env.DEV && import.meta.env.VITE_AUTH_DISABLED === '1') return fetch(input, init);
  const res = await fetchWithToken(input, init, await acquireToken());
  if (res.status !== 401) return res;
  return fetchWithToken(input, init, await acquireToken(true));
}
