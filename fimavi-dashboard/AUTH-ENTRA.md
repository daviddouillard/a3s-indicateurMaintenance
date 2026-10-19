# Authentification Microsoft Entra ID — Indicateurs Maintenance A3S

Même mécanisme qu'Indicateurs Transport (voir `../Indicateurs_Transport/fimavi-dashboard/AUTH-ENTRA.md`
pour l'historique et les pièges).

## Identifiants (publics, non secrets)

| Élément | Valeur |
|---|---|
| App Registration | `GCP-A3S-Indicateurs-MaintenanceAcces` (single-tenant, plateforme SPA) |
| Client ID | `212e3861-61fd-45f7-bfe1-da542a1659ac` |
| Tenant ID | `9f74a43a-08f4-4dc6-b245-547e1e000ca8` |
| Groupe d'accès | `GCP-A3S-Indicateurs-MaintenanceAcces`, Object ID `02493fd9-209e-443e-8ecb-3ca49111056f` |

Variables : `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_GROUP_ID` (`server/.env`,
`cloudrun-env.yaml`) et `VITE_ENTRA_*` (`.env.local`, `.env.production`).

## Contrôle d'accès

Le contrôle du groupe est fait **par l'application** (« Attribution requise ? » = Non sur
l'application d'entreprise) : un compte hors groupe se connecte puis voit l'écran
« Accès refusé — il vous manque des droits ».

| Couche | Contrôle |
|---|---|
| Backend (`requireAuth`, `server/index.mjs`) | ID token valide **et** claim `groups` contenant `ENTRA_GROUP_ID`, sinon **403** `{ code: 'NOT_IN_GROUP' }` — c'est ce contrôle qui fait foi |
| Frontend (`AuthGate.tsx` → `AccessDenied.tsx`) | claim `groups` ≠ `VITE_ENTRA_GROUP_ID` → écran « droits manquants ». Idem si l'API répond 403 |

## Configuration Entra (portail, compte admin)

1. App Registration single-tenant, **Authentication** → plateforme **SPA**, redirect URIs :
   - `http://localhost:5173`
   - `https://a3s-indicateurs-maintenance-991405381669.europe-west9.run.app`
   - `https://a3s-indicateurs-maintenance-diqd5zt53a-od.a.run.app`
2. **Token configuration** → claim `groups` : « Groups assigned to the application », jeton
   **ID**, format **Group ID**. Sans ce claim, tout le monde voit « Accès refusé ».
3. **Applications d'entreprise** : groupe assigné, « Attribution requise ? » = **Non**.

> L'accès conditionnel FIMAVI exige un navigateur conforme (Edge, ou Chrome + extension
> Microsoft SSO).
