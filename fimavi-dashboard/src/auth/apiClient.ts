import { msalInstance, tokenRequest } from './authConfig';
import { RECONNEXION } from '../hooks/apiErrors';

// Récupère l'ID token Entra pour l'API, en silencieux si possible.
// Marge avant expiration : un ID token qui expire dans moins de 5 min est renouvelé.
const EXPIRY_MARGIN_S = 5 * 60;
// Le renouvellement silencieux peut rester bloqué (iframe Microsoft retenue par le navigateur,
// session de plusieurs jours…) : au-delà de ce délai on bascule sur une connexion par redirection.
const SILENT_TIMEOUT_MS = 10_000;
// Lecture des données (/api/maintenance) : instantané Firestore, quelques secondes au plus ;
// au tout premier démarrage (aucun instantané) le serveur relit fimapi2 (30 s max par route).
const API_TIMEOUT_MS = 60_000;
// Bouton « Actualiser » (/api/refresh) : relecture de fimapi2 puis écriture Firestore.
export const REFRESH_TIMEOUT_MS = 90_000;
// La redirection vers Microsoft quitte la page : si elle n'a pas eu lieu après ce délai
// (navigation bloquée, connexion déjà « en cours » dans MSAL), on abandonne.
const REDIRECT_TIMEOUT_MS = 10_000;
// Garde-fou anti-boucle : une seule redirection de secours par onglet toutes les 2 minutes.
const REDIRECT_KEY = 'maintenanceTokenRedirectAt';
const REDIRECT_COOLDOWN_MS = 2 * 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} : délai dépassé (${ms / 1000} s)`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

function recentRedirect(): boolean {
  try {
    return Date.now() - Number(sessionStorage.getItem(REDIRECT_KEY) ?? 0) < REDIRECT_COOLDOWN_MS;
  } catch {
    return true; // stockage indisponible : pas de redirection automatique (évite toute boucle)
  }
}

// Connexion Microsoft par redirection (avec une session Microsoft ouverte : simple aller-retour,
// sans saisie). Si une redirection vient déjà d'échouer, si MSAL est bloqué sur une connexion
// « en cours » ou si la redirection ne part pas, on lève RECONNEXION : la page propose alors
// « Se reconnecter » au lieu de charger indéfiniment.
async function redirectLogin(reason: unknown): Promise<never> {
  console.warn('Jeton Microsoft : renouvellement silencieux impossible', reason);
  if (recentRedirect()) throw new Error(RECONNEXION);
  try { sessionStorage.setItem(REDIRECT_KEY, String(Date.now())); } catch { /* sans stockage, recentRedirect() vaut true */ }
  try {
    await withTimeout(msalInstance.acquireTokenRedirect(tokenRequest), REDIRECT_TIMEOUT_MS, 'Redirection Microsoft');
  } catch (e) {
    console.warn('Redirection Microsoft impossible', e);
  }
  // La redirection quitte la page ; on n'arrive ici que si elle n'a pas eu lieu.
  throw new Error(RECONNEXION);
}

async function acquireToken(forceRefresh = false): Promise<string> {
  const account = msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0];
  if (!account) return redirectLogin('aucun compte');
  try {
    let result = await withTimeout(
      msalInstance.acquireTokenSilent({ ...tokenRequest, account, forceRefresh }),
      SILENT_TIMEOUT_MS,
      'Renouvellement du jeton'
    );
    // MSAL peut rendre depuis son cache un ID token déjà expiré (il ne suit que
    // l'expiration du jeton d'accès) : dans ce cas on force le renouvellement.
    const exp = Number((result.idTokenClaims as { exp?: number } | undefined)?.exp ?? 0);
    if (!forceRefresh && exp * 1000 < Date.now() + EXPIRY_MARGIN_S * 1000) {
      result = await withTimeout(
        msalInstance.acquireTokenSilent({ ...tokenRequest, account, forceRefresh: true }),
        SILENT_TIMEOUT_MS,
        'Renouvellement du jeton'
      );
    }
    try { sessionStorage.removeItem(REDIRECT_KEY); } catch { /* sans importance */ }
    // On authentifie /api avec l'ID token (aud = clientId), pas un jeton d'API custom.
    return result.idToken;
  } catch (err) {
    // Interaction requise, délai dépassé, iframe bloquée, connexion « en cours » bloquée… :
    // connexion par redirection
    return redirectLogin(err);
  }
}

// Reconnexion explicite (bouton « Se reconnecter ») : efface la session MSAL locale de ce site,
// y compris un éventuel verrou « connexion en cours » resté après une redirection interrompue,
// puis repasse par Microsoft (sans saisie si la session Microsoft est ouverte).
export async function reconnecter(): Promise<void> {
  try {
    for (const store of [sessionStorage, localStorage]) {
      Object.keys(store).filter((k) => k.startsWith('msal.') && k.includes('interaction')).forEach((k) => store.removeItem(k));
    }
    sessionStorage.removeItem(REDIRECT_KEY);
  } catch { /* stockage indisponible */ }
  try { await msalInstance.clearCache(); } catch { /* cache déjà vide */ }
  await msalInstance.loginRedirect(tokenRequest);
}

async function fetchWithToken(input: string, init: RequestInit, token: string, timeoutMs: number): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  // Une requête API ne doit jamais faire tourner la page indéfiniment
  return fetch(input, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(timeoutMs) });
}

// fetch authentifié : ajoute l'en-tête Authorization: Bearer <jeton>. Sur un 401 (jeton
// refusé, par ex. expiré), on renouvelle le jeton et on réessaie une fois ; un second 401
// signifie que la session est à refaire.
export async function apiFetch(input: string, init: RequestInit = {}, timeoutMs = API_TIMEOUT_MS): Promise<Response> {
  // Dev local sans connexion (cf. AuthGate) : éliminé du build de prod
  if (import.meta.env.DEV && import.meta.env.VITE_AUTH_DISABLED === '1') return fetch(input, init);
  const res = await fetchWithToken(input, init, await acquireToken(), timeoutMs);
  if (res.status !== 401) return res;
  const retry = await fetchWithToken(input, init, await acquireToken(true), timeoutMs);
  if (retry.status === 401) throw new Error(RECONNEXION);
  return retry;
}
