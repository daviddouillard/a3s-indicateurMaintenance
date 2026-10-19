# Indicateurs Maintenance — A3S

Dashboard des indicateurs maintenance, protégé par Microsoft Entra ID.

- **Frontend** : React 19 + Vite + Tailwind 4, connexion MSAL (`src/auth/`), page
  `src/pages/MaintenancePage.tsx`.
- **Backend** : Express (`server/index.mjs`) — valide l'ID token et le groupe sur `/api/*`,
  sert le build Vite. Les clés d'API upstream sont injectées par le serveur depuis les
  variables d'environnement, jamais exposées au navigateur.
- **Hébergement** : Cloud Run `a3s-indicateurs-maintenance`, projet `a3s-indicateurmaintenance`.

État : plateforme vierge — `/api/ping` vérifie la chaîne d'authentification ; les
indicateurs (API BDIP maintenance) sont à brancher.

## Démarrage local

```bash
npm install
npm run server   # backend :8080 (lit server/.env)
npm run dev      # frontend :5173
```

Voir [AUTH-ENTRA.md](AUTH-ENTRA.md) pour la configuration Entra.
