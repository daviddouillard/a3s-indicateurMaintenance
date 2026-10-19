import express from 'express';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

// --- Authentification Entra ID : validation du jeton d'accès sur les routes /api ---
const ENTRA_TENANT_ID = process.env.ENTRA_TENANT_ID || '';
const ENTRA_CLIENT_ID = process.env.ENTRA_CLIENT_ID || '';
// Object ID du groupe Entra autorisé (GCP-A3S-Indicateurs-MaintenanceAcces). Le jeton doit
// porter ce groupe dans son claim `groups` (cf. AUTH-ENTRA.md, « Token configuration »).
const ENTRA_GROUP_ID = process.env.ENTRA_GROUP_ID || '';
const AUTH_DISABLED = process.env.AUTH_DISABLED === '1'; // secours dev uniquement

if (!AUTH_DISABLED && (!ENTRA_TENANT_ID || !ENTRA_CLIENT_ID || !ENTRA_GROUP_ID)) {
  console.error('ENTRA_TENANT_ID / ENTRA_CLIENT_ID / ENTRA_GROUP_ID manquants : les routes /api rejetteront tout.');
}

// Clés publiques du tenant, mises en cache par jose
const JWKS = ENTRA_TENANT_ID
  ? createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${ENTRA_TENANT_ID}/discovery/v2.0/keys`)
    )
  : null;

// Émetteurs acceptés : v2.0 (login.microsoftonline.com/.../v2.0) et v1.0 (sts.windows.net),
// selon requestedAccessTokenVersion du manifeste — on accepte les deux par robustesse.
const ISSUERS = [
  `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/v2.0`,
  `https://sts.windows.net/${ENTRA_TENANT_ID}/`,
];
// Audiences acceptées pour l'API exposée par cette app (forme GUID ou api://GUID)
const AUDIENCES = [ENTRA_CLIENT_ID, `api://${ENTRA_CLIENT_ID}`];

async function requireAuth(req, res, next) {
  if (AUTH_DISABLED) return next();
  if (!JWKS || !ENTRA_GROUP_ID) return res.status(503).json({ error: 'Auth non configurée côté serveur' });

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Jeton manquant' });

  let payload;
  try {
    ({ payload } = await jwtVerify(token, JWKS, { issuer: ISSUERS, audience: AUDIENCES }));
  } catch (e) {
    console.warn('Jeton refusé', req.path, e?.code ?? '', e?.message ?? e);
    return res.status(401).json({ error: 'Jeton invalide', detail: String(e?.message ?? e) });
  }
  // Jeton valide mais compte hors du groupe autorisé → 403 (le frontend affiche « droits manquants »)
  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  if (!groups.includes(ENTRA_GROUP_ID)) {
    return res.status(403).json({ error: 'Droits insuffisants', code: 'NOT_IN_GROUP' });
  }
  return next();
}

// Toutes les routes /api sont protégées
app.use('/api', requireAuth);

// --- Clé API A3SreportingBDIP : fournie UNIQUEMENT via variable d'environnement ---
const BDIP_API_KEY = process.env.BDIP_API_KEY || '';
// Démo locale (données fictives, sans appel upstream) : jamais en production
const MAINTENANCE_MOCK = process.env.MAINTENANCE_MOCK === '1';

const FIMAPI_BASE = 'https://fimapi2.fimavi.com/A3SreportingBDIP';

// GET JSON depuis l'upstream. rejectUnauthorized:false : certificats internes FIMAVI non
// vérifiables par défaut (même choix que les autres dashboards A3S).
function fetchUpstreamJson(route, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      `${FIMAPI_BASE}/${route}`,
      { method: 'GET', headers: { 'X-API-KEY': BDIP_API_KEY }, rejectUnauthorized: false },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`${route} : upstream ${res.statusCode}`));
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`${route} : JSON invalide (${e.message})`));
          }
        });
      }
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`${route} : timeout upstream (${timeoutMs} ms)`)));
    req.on('error', reject);
    req.end();
  });
}

// Données maintenance brutes (DI + BT du service maintenance, machines) : les indicateurs
// sont calculés par le frontend, qui filtre par période sans rappeler le serveur.
// Cache mémoire de 5 min ; si l'upstream tombe, on sert la dernière copie (stale: true).
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = null; // { data, fetchedAt }
let inflight = null;

async function loadMaintenance() {
  if (MAINTENANCE_MOCK) {
    const { mockMaintenance } = await import('./mock.mjs');
    return mockMaintenance();
  }
  const [dis, bts, referentiels] = await Promise.all([
    fetchUpstreamJson('Maintenance/DemandesIntervention'),
    fetchUpstreamJson('Maintenance/BonsTravail'),
    fetchUpstreamJson('Production/Referentiels'),
  ]);
  return {
    dis,
    bts,
    machines: (referentiels?.machines ?? []).map((m) => ({ idMachine: m.idMachine, nom: m.nom })),
  };
}

async function getMaintenance(force = false) {
  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return { ...cache.data, updatedAt: new Date(cache.fetchedAt).toISOString(), stale: false };
  if (!inflight) {
    inflight = loadMaintenance()
      .then((data) => {
        cache = { data, fetchedAt: Date.now() };
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  try {
    const fresh = await inflight;
    return { ...fresh.data, updatedAt: new Date(fresh.fetchedAt).toISOString(), stale: false };
  } catch (e) {
    console.error('Lecture maintenance', e?.message ?? e);
    if (cache) return { ...cache.data, updatedAt: new Date(cache.fetchedAt).toISOString(), stale: true };
    throw e;
  }
}

app.get('/api/maintenance', async (_req, res) => {
  try {
    res.json(await getMaintenance());
  } catch (e) {
    res.status(502).json({ error: 'API maintenance injoignable', detail: String(e?.message ?? e) });
  }
});

// Bouton « Actualiser » : relit l'upstream sans attendre l'expiration du cache
app.post('/api/refresh', async (_req, res) => {
  try {
    res.json(await getMaintenance(true));
  } catch (e) {
    res.status(502).json({ error: 'API maintenance injoignable', detail: String(e?.message ?? e) });
  }
});

// --- Frontend statique (build Vite) ---
const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir));
// Fallback SPA (toutes les routes non-API renvoient index.html)
app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
