-- =============================================================================
-- BDIP — Date de clôture des demandes d'intervention (DI)
-- À exécuter une fois sur FIM-SQL2\SAGE100C, base BDIP, AVANT de déployer :
--   - ACOF (Form_Principal.vb renseigne DateCloture au passage au statut 100 « Terminé »)
--   - A3SreportingBDIP (route Maintenance/DemandesIntervention lit DateCloture)
-- Script rejouable (vérifie l'existence de la colonne, ne touche que les DateCloture vides).
-- =============================================================================
USE BDIP;
GO

-- 1. Colonne
IF COL_LENGTH('dbo.DemandeIntervention', 'DateCloture') IS NULL
    ALTER TABLE dbo.DemandeIntervention ADD DateCloture DATETIME NULL;
GO

-- 2. Reprise de l'existant pour les DI déjà terminées (Statut = 100), par ordre de fiabilité :
--    a) date de la dernière entrée d'historique « Statut : ... -> Terminé »
--    b) date de réalisation la plus récente de ses BT
--    c) date de la dernière entrée d'historique de la DI
--    d) date de création de la DI
UPDATE di
SET DateCloture = COALESCE(h_termine.DateEnregistrement,
                           bt.DateRealisation,
                           h_dernier.DateEnregistrement,
                           di.DateEnregistrement)
FROM dbo.DemandeIntervention di
OUTER APPLY (
    SELECT MAX(h.DateEnregistrement) AS DateEnregistrement
    FROM dbo.DemandeIntervention_Historique h
    WHERE h.IdDemandeIntervention = di.IdDemandeIntervention
      AND h.Commentaire LIKE N'%Statut : % -> Terminé%'
) h_termine
OUTER APPLY (
    SELECT MAX(b.DateRealisation) AS DateRealisation
    FROM dbo.BonTravail b
    WHERE b.IdDemandeIntervention = di.IdDemandeIntervention
      AND b.Statut = 100
) bt
OUTER APPLY (
    SELECT MAX(h.DateEnregistrement) AS DateEnregistrement
    FROM dbo.DemandeIntervention_Historique h
    WHERE h.IdDemandeIntervention = di.IdDemandeIntervention
) h_dernier
WHERE di.Statut = 100
  AND di.DateCloture IS NULL;
GO

-- 3. Contrôle : aucune DI terminée sans date, aucune DI ouverte avec date
SELECT
    SUM(CASE WHEN Statut = 100 AND DateCloture IS NULL THEN 1 ELSE 0 END)  AS TermineesSansDate,
    SUM(CASE WHEN Statut <> 100 AND DateCloture IS NOT NULL THEN 1 ELSE 0 END) AS OuvertesAvecDate,
    SUM(CASE WHEN Statut = 100 THEN 1 ELSE 0 END)                          AS Terminees
FROM dbo.DemandeIntervention;
GO
