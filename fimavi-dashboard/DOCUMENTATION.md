# Documentation technique — Indicateurs Maintenance A3S

État au 2026-10-19 : en production (Cloud Run révision 00004).

## 1. Chaîne de données

```
ACOF (VB.NET)  ──écrit──▶  SQL Server FIM-SQL2\SAGE100C, base BDIP
                              │  DemandeIntervention, BonTravail, BonTravail_Piece,
                              │  BonTravail_Intervenant, ParamMachine
                              ▼
A3SreportingBDIP (IIS, fimapi2.fimavi.com)   X-API-KEY
   GET Maintenance/DemandesIntervention   (DI Service = 2)
   GET Maintenance/BonsTravail            (BT de ces DI, coût pièces, nb intervenants)
   GET Production/Referentiels            (machines : idMachine, nom)
                              │  pare-feu fimapi2 : IP 34.155.197.162 autorisée
                              ▼
Cloud Run a3s-indicateurs-maintenance (Express)  ── VPC fimavi-vpc → Cloud NAT
   instantané Firestore snapshots/maintenance (JSON gzip)
   ├─ 03:00 Europe/Paris : Cloud Scheduler maintenance-refresh-nuit → POST /internal/refresh
   ├─ bouton « Actualiser » → POST /api/refresh
   └─ GET /api/maintenance → instantané (cache mémoire 10 min)
                              ▼
Navigateur (React) : calcule tous les indicateurs selon période + criticité
```

## 2. Codes ACOF

| Champ | Valeurs |
|---|---|
| DI `Statut` | 1 Nouvelle demande, 10 Accepté, 50 En attente (= **en cours**), 100 Terminé |
| DI `Criticite` | 1 Critique, 2 Majeur, 3 Mineur |
| DI `Service` | 1 production, 2 maintenance (seul périmètre du dashboard) |
| DI `IdMachine` | ids `ParamMachine` séparés par « ; » (une DI peut viser plusieurs machines) |
| DI `DateCloture` | ajoutée le 2026-10-19 (`sql/001_…`), posée par ACOF au passage à 100 |
| BT `Statut` | 1 Planifié, 10 En cours, 100 Terminé, 200 Annulé |
| BT `TypeIntervention` | 1 Préventif, 2 Sécurité/env., 3 Inspection/contrôle régl., 4 Travaux neufs, 5 Correctif, 6 Amélioration, 7 Réglage, 8 Formation, 9 Audit, 10 Autre |
| BT temps | `TempsPrevu`, `TempsRealise` en minutes |
| BT coûts | `CoutMainOeuvreInterne`, `CoutPrestationExterne`, pièces = Σ Quantite × PrixUnitaire |

## 3. Indicateurs (`src/utils/indicateurs.ts`)

Filtres communs : **période** (année ISO N, ou 4 / 12 / 26 / 52 dernières semaines,
semaine en cours incluse) et **criticité** (appliquée aux DI, et aux BT via leur DI).

| Indicateur | Définition |
|---|---|
| Graphique hebdo (3 courbes) | **Entrées** = DI créées dans la semaine ; **Clôturées** = `DateCloture` dans la semaine ; **Backlog** = DI créées avant la fin de semaine et non clôturées à cette date |
| DI en cours / dont critiques | statut ≠ 100, état actuel (indépendant de la période) |
| BT en retard | `DatePrevueFin` < aujourd'hui et statut ni 100 ni 200 |
| Délai moyen de résolution | création → clôture, DI clôturées sur la période, par criticité |
| Part du préventif / Préventif-correctif | heures réalisées des BT terminés (`DateRealisation` dans la période) par type |
| Machines les plus sollicitées | top 8 par nombre de DI créées sur la période, + heures réalisées de leurs BT |
| Coûts de maintenance | BT terminés par mois de réalisation : interne, externe, pièces |

### Données de reprise (exclusions)

- **DI sans `DateEnregistrement`** (46 au 2026-10-19, DI_26_0001…0051 environ, reprise
  initiale) : exclues du graphique, des délais et des machines (`nonDatee`), comptées
  dans « DI en cours ». Un bandeau l'indique. Leur clôture (posée en masse le 16/10
  10:55 par la reprise SQL) fausserait les clôturées.
- **DI reprises déjà terminées** (122) : la reprise SQL a posé `DateCloture` =
  `DateEnregistrement` (aucun historique « -> Terminé » ni BT) → exclues du délai de
  résolution uniquement.
- Au 2026-10-19 **aucun BT n'est saisi** : préventif/correctif, coûts et BT en retard
  restent vides jusqu'aux premières saisies.

Corriger ces dates en base (si la source d'origine les a) rend ces exclusions inutiles.

## 4. Backend (`server/index.mjs`)

| Route | Protection | Rôle |
|---|---|---|
| `GET /api/maintenance` | ID token Entra + groupe | instantané (mémoire 10 min → Firestore → fimapi2 au 1er démarrage) |
| `POST /api/refresh` | ID token Entra + groupe | relit fimapi2, écrit Firestore ; si échec → dernier instantané `stale: true` |
| `POST /internal/refresh` | en-tête `x-refresh-token` = `REFRESH_TOKEN` | idem, pour Cloud Scheduler |

Variables (Cloud Run via `cloudrun-env.yaml`, local via `server/.env`, jamais versionnés) :
`ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_GROUP_ID`, `BDIP_API_KEY` (secret),
`REFRESH_TOKEN` (secret). Dev uniquement : `AUTH_DISABLED`, `MAINTENANCE_MOCK`,
`VITE_AUTH_DISABLED` (ne jamais les poser sur Cloud Run).

## 5. Infrastructure GCP (projet `a3s-indicateurmaintenance`, europe-west9)

| Ressource | Nom / valeur |
|---|---|
| Cloud Run | `a3s-indicateurs-maintenance`, public (`allUsers` invoker), sortie VPC all-traffic |
| Réseau | VPC `fimavi-vpc`, sous-réseau `fimavi-subnet` 10.124.0.0/26, routeur `fimavi-router`, NAT `fimavi-nat` |
| IP de sortie | `fimavi-nat-ip` = **34.155.197.162** (autorisée sur le pare-feu fimapi2) |
| Firestore | base `(default)` native ; document `snapshots/maintenance` |
| Cloud Scheduler | `maintenance-refresh-nuit`, `0 3 * * *` Europe/Paris, 3 essais / 5 min |
| Compte de service | `991405381669-compute@developer` : artifactregistry.writer, cloudbuild.builds.builder, logging.logWriter, storage.objectViewer, datastore.user |
| Org policy | dérogation projet `iam.allowedPolicyMemberDomains` = allowAll (comme Transport) |
| Facturation | compte « Ateliers 3S » (`fimavi-logistique-f680d` délié pour libérer le quota) |

## 6. Exploitation

- **Données pas à jour** : bouton « Actualiser », ou
  `gcloud.cmd scheduler jobs run maintenance-refresh-nuit --project=a3s-indicateurmaintenance --location=europe-west9`.
- **Pastille rouge « données du … »** : fimapi2 n'a pas répondu, la page sert le dernier
  instantané. Vérifier l'API / le pare-feu (timeout = IP non autorisée).
- **Logs** : `gcloud.cmd logging read 'resource.labels.service_name="a3s-indicateurs-maintenance" AND severity>=WARNING' --project=a3s-indicateurmaintenance --freshness=1d`
- **Déployer** : voir `CLAUDE.md` (les options `--network/--subnet/--vpc-egress` sont
  obligatoires, sinon fimapi2 ne répond plus).
- **Nouvelle route API** : à faire valider par l'utilisateur avant création.
