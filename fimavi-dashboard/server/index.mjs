import express from 'express';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Firestore } from '@google-cloud/firestore';

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
// Secret protégeant /internal/refresh (appelé par Cloud Scheduler)
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || '';
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
// Source servie : instantané Firestore (snapshots/maintenance), rafraîchi par le job nocturne
// (Cloud Scheduler 03:00 → /internal/refresh) et par le bouton « Actualiser ». Les lectures
// ne sollicitent donc pas fimapi2 ; si fimapi2 tombe, on garde le dernier instantané.
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

// JSON compressé (gzip) dans un champ Bytes : un document Firestore est limité à 1 Mio
const firestore = MAINTENANCE_MOCK
  ? null
  : (() => {
      try { return new Firestore(); }
      catch (e) { console.error('Firestore indisponible :', e?.message ?? e); return null; }
    })();
const SNAPSHOT = firestore?.collection('snapshots').doc('maintenance') ?? null;
// Relit Firestore au plus toutes les 10 min (instantané écrit par une autre instance / le job)
const MEM_TTL_MS = 10 * 60 * 1000;
let snap = null; // { data, updatedAt (ms) }
let memAt = 0;
let inflight = null;

async function readSnapshot() {
  if (!SNAPSHOT) return null;
  try {
    const doc = await SNAPSHOT.get();
    if (!doc.exists) return null;
    const { payload, updatedAt } = doc.data();
    return { data: JSON.parse(gunzipSync(payload).toString('utf8')), updatedAt: Date.parse(updatedAt) };
  } catch (e) {
    console.error('Firestore lecture', e?.message ?? e);
    return null;
  }
}

async function writeSnapshot(s) {
  if (!SNAPSHOT) return;
  try {
    await SNAPSHOT.set({ payload: gzipSync(JSON.stringify(s.data)), updatedAt: new Date(s.updatedAt).toISOString() });
  } catch (e) {
    console.error('Firestore écriture', e?.message ?? e);
  }
}

// Relit fimapi2 et persiste l'instantané (un seul appel à la fois)
function refreshFromUpstream() {
  if (!inflight) {
    inflight = loadMaintenance()
      .then(async (data) => {
        snap = { data, updatedAt: Date.now() };
        memAt = Date.now();
        await writeSnapshot(snap);
        return snap;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

async function getMaintenance() {
  if (snap && Date.now() - memAt < MEM_TTL_MS) return snap;
  const stored = await readSnapshot();
  if (stored && (!snap || stored.updatedAt >= snap.updatedAt)) snap = stored;
  if (snap) {
    memAt = Date.now();
    return snap;
  }
  return refreshFromUpstream(); // premier démarrage : aucun instantané
}

const toJson = (s, stale = false) => ({ ...s.data, updatedAt: new Date(s.updatedAt).toISOString(), stale });

app.get('/api/maintenance', async (_req, res) => {
  try {
    res.json(toJson(await getMaintenance()));
  } catch (e) {
    console.error('Lecture maintenance', e?.message ?? e);
    res.status(502).json({ error: 'API maintenance injoignable', detail: String(e?.message ?? e) });
  }
});

// Bouton « Actualiser » : relit fimapi2 ; en cas d'échec, renvoie le dernier instantané
// marqué stale (le bandeau passe au rouge).
app.post('/api/refresh', async (_req, res) => {
  try {
    res.json(toJson(await refreshFromUpstream()));
  } catch (e) {
    console.error('Actualisation maintenance', e?.message ?? e);
    const last = snap ?? (await readSnapshot());
    if (last) return res.json(toJson(last, true));
    res.status(502).json({ error: 'API maintenance injoignable', detail: String(e?.message ?? e) });
  }
});

// Mise à jour planifiée (Cloud Scheduler, 03:00). Hors /api (pas de jeton Entra), protégée
// par le secret REFRESH_TOKEN.
app.post('/internal/refresh', async (req, res) => {
  if (!REFRESH_TOKEN || req.headers['x-refresh-token'] !== REFRESH_TOKEN) {
    return res.status(403).json({ error: 'Interdit' });
  }
  try {
    const s = await refreshFromUpstream();
    res.json({ ok: true, dis: s.data.dis.length, bts: s.data.bts.length, updatedAt: new Date(s.updatedAt).toISOString() });
  } catch (e) {
    console.error('Mise à jour planifiée', e?.message ?? e);
    res.status(502).json({ error: 'Refresh échoué', detail: String(e?.message ?? e) });
  }
});

// --- Frontend statique (build Vite) ---
const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir));
// Fallback SPA (toutes les routes non-API renvoient index.html)
app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
