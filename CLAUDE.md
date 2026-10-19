# CLAUDE.md — Indicateurs Maintenance (A3S)

Dashboard des indicateurs maintenance (tickets = demandes d'intervention ACOF). **Copie
d'Indicateurs_Transport** (même stack, même design, même authentification Entra).

Le backend relaie les données brutes (`GET /api/maintenance`, cache mémoire 5 min, dernière
copie servie si l'API tombe ; `POST /api/refresh`) ; le frontend calcule tous les
indicateurs (`src/utils/indicateurs.ts`) selon la période et la criticité choisies :
graphique hebdo nouveaux / réalisés / backlog, délai de résolution, préventif / correctif,
machines les plus sollicitées, coûts mensuels, vignettes (DI en cours, critiques, BT en retard).

À lire en début de session :
- [fimavi-dashboard/AUTH-ENTRA.md](fimavi-dashboard/AUTH-ENTRA.md) — authentification Entra
- [fimavi-dashboard/README.md](fimavi-dashboard/README.md) — vue d'ensemble
- `../Indicateurs_Transport` — projet modèle (agrégats Firestore, refresh, panneaux, graphiques)

## Repères

| Élément | Valeur |
|---------|--------|
| Code | `fimavi-dashboard/` (React 19 + Vite + Tailwind 4 / backend Express `server/index.mjs`) |
| API upstream | `https://fimapi2.fimavi.com/A3SreportingBDIP/` : `Maintenance/DemandesIntervention`, `Maintenance/BonsTravail`, `Production/Referentiels` (machines) — `X-API-KEY` = `BDIP_API_KEY`. Code de l'API : `C:\Users\david.douillard\source\repos\A3SreportingBDIP` (.NET 8 + Dapper, IIS) |
| Données | ACOF (`repos\ACOF5\LogistiqueA3S`, base BDIP) : DI `Service=2` (statuts 1/10/50 = en cours, 100 = Terminé, `DateCloture`), BT (type, temps, coûts). Script `sql/001_DemandeIntervention_DateCloture.sql` |
| GCP | projet **`a3s-indicateurmaintenance`** (nom affiché « a3s-indicateurMaintenance », n° 991405381669), dossier A3S, région `europe-west9` |
| Cloud Run | service **`a3s-indicateurs-maintenance`** |
| Dépôt | https://github.com/daviddouillard/a3s-indicateurMaintenance (privé) |

## Commandes

```bash
cd fimavi-dashboard
npm run server   # backend :8080 (lit server/.env)
npm run dev      # frontend :5173 (proxy /api → :8080)
npm run build    # tsc -b + vite build
npm run lint
```

Démo locale sans connexion ni API (données fictives `server/mock.mjs`) : configurations
« Demo Backend (mock, sans auth) » + « Demo Dashboard (sans auth) » de `.claude/launch.json`
(`AUTH_DISABLED=1`, `MAINTENANCE_MOCK=1`, `VITE_AUTH_DISABLED=1` — le contournement frontend
n'existe qu'en `vite dev`, il est éliminé du build). Ne jamais poser ces variables sur Cloud Run.

Déploiement (depuis la racine) :

```bash
gcloud run deploy a3s-indicateurs-maintenance --source fimavi-dashboard \
  --region=europe-west9 --project=a3s-indicateurmaintenance --env-vars-file=cloudrun-env.yaml \
  --allow-unauthenticated
```

## Règles

- **Toujours `--project=a3s-indicateurmaintenance`** : la config gcloud par défaut pointe
  sur un autre projet.
- Sous PowerShell, `gcloud.ps1` est bloqué par la politique d'exécution : appeler
  **`gcloud.cmd`**.
- **Secrets jamais versionnés** : `server/.env`, `.env.local`, `.env.production`,
  `cloudrun-env.yaml`, `.claude/settings.local.json`, `*.xlsx` sont gitignorés. Aucune
  clé API dans le frontend : le backend l'injecte depuis une variable d'environnement.
- `server/.env` fixe `GOOGLE_CLOUD_PROJECT=a3s-indicateurmaintenance` : sans ça les ADC
  locales écriraient dans Firestore d'un autre projet.
- L'accès conditionnel FIMAVI bloque le navigateur intégré de l'app Claude : tester la
  connexion dans Edge.
- Stack : NuxtJS était la recommandation initiale, mais on garde la stack des autres
  dashboards A3S (React/Vite/Express) pour partager le code et l'authentification.
- Audit de sécurité et tests de non-régression après chaque grosse livraison.
