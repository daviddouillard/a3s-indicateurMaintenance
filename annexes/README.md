# Annexes — modifications hors de ce dépôt

Les deux projets ci-dessous **ne sont pas sous git** : ces copies sont la sauvegarde
versionnée des modifications faites pour les Indicateurs Maintenance (2026-10-19).
Aucun identifiant n'y figure.

## A3SreportingBDIP (`C:\Users\david.douillard\source\repos\A3SreportingBDIP`)

API .NET 8 + Dapper publiée sur IIS (`https://fimapi2.fimavi.com/A3SreportingBDIP/`).

| Fichier | Rôle |
|---|---|
| `A3SreportingBDIP/MaintenanceController.cs` | `[Route("Maintenance")]` : `GET DemandesIntervention`, `GET BonsTravail` |
| `A3SreportingBDIP/Class_Maintenance.cs` | DTO + requêtes SQL (base BDIP, DI `Service = 2` et leurs BT) |

Pour restaurer : copier les deux fichiers à la racine du projet `A3SreportingBDIP`,
compiler (`dotnet build`), publier sur IIS. Aucune autre modification de l'API.

## ACOF (`C:\Users\david.douillard\source\repos\ACOF5\LogistiqueA3S`)

Application VB.NET WinForms. `ACOF/Form_Principal_DateCloture.patch` : les deux requêtes
`update DemandeIntervention` (onglet DI production et onglet Maintenance) renseignent
`DateCloture` au passage au statut 100 « Terminé » et la vident si la DI est rouverte :

```sql
DateCloture = CASE WHEN @Statut=100 THEN ISNULL(DateCloture, GETDATE()) ELSE NULL END
```

Prérequis : la colonne doit exister (`../sql/001_DemandeIntervention_DateCloture.sql`),
sinon ACOF plante à l'enregistrement d'une DI.
