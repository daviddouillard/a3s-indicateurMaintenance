# Indicateurs Maintenance — A3S

Dashboard des indicateurs maintenance, protégé par Microsoft Entra ID.

- **Frontend** : React 19 + Vite + Tailwind 4, connexion MSAL (`src/auth/`), page
  `src/pages/MaintenancePage.tsx`.
- **Backend** : Express (`server/index.mjs`) — valide l'ID token et le groupe sur `/api/*`,
  sert le build Vite. Les clés d'API upstream sont injectées par le serveur depuis les
  variables d'environnement, jamais exposées au navigateur.
- **Hébergement** : Cloud Run `a3s-indicateurs-maintenance`, projet `a3s-indicateurmaintenance`.

Données : `GET /api/maintenance` relaie l'API A3SreportingBDIP (DI + BT maintenance ACOF,
machines) ; les indicateurs sont calculés dans `src/utils/indicateurs.ts`. Variables du
backend : `ENTRA_*`, `BDIP_API_KEY` (secret).

## Démarrage local

```bash
npm install
npm run server   # backend :8080 (lit server/.env)
npm run dev      # frontend :5173
```

Voir [AUTH-ENTRA.md](AUTH-ENTRA.md) pour la configuration Entra.
