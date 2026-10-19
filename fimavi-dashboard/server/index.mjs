import express from 'express';
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

// --- API ---
// Plateforme vierge : les routes métier (API BDIP maintenance) seront ajoutées ici, avec la
// clé API lue UNIQUEMENT depuis une variable d'environnement (jamais dans le frontend).

// Vérifie la chaîne complète frontend → jeton Entra → backend (affiché sur la page d'accueil).
app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, at: new Date().toISOString() });
});

// --- Frontend statique (build Vite) ---
const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir));
// Fallback SPA (toutes les routes non-API renvoient index.html)
app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
