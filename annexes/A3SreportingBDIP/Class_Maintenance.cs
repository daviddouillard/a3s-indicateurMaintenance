using Dapper;
using Microsoft.Data.SqlClient;
using System.Data;

namespace A3SreportingBDIP
{
    // Maintenance (ACOF) : demandes d'intervention (DI) du service maintenance et leurs bons de
    // travail (BT). Données brutes, une ligne par DI / BT ; les indicateurs (semaines, backlog,
    // délais, coûts) sont calculés par l'application cliente.
    // Codes : DI Statut 1 Nouvelle demande, 10 Accepté, 50 En attente, 100 Terminé ;
    // Criticite 1 Critique, 2 Majeur, 3 Mineur ; BT Statut 1 Planifié, 10 En cours, 100 Terminé,
    // 200 Annulé ; TypeIntervention 1 Préventif ... 5 Correctif ... 10 Autre (cf. ACOF Form_BT).
    public class Class_Maintenance
    {
        private const int CommandTimeoutSec = 120;

        // DemandeIntervention.Service : 1 = production, 2 = maintenance
        private const int ServiceMaintenance = 2;

        public class DemandeIntervention
        {
            public int? IdDemandeIntervention { get; set; }
            public string? NumDI { get; set; }
            public int? Statut { get; set; }
            public int? Criticite { get; set; }
            // Identifiants ParamMachine séparés par « ; » (ex. "4;5;6"), libellés via Production/Referentiels
            public string? IdMachine { get; set; }
            public string? Titre { get; set; }
            public string? Demandeur { get; set; }
            public DateTime? DateEnregistrement { get; set; }
            // Renseignée par ACOF au passage au statut 100 (script sql/001_DemandeIntervention_DateCloture.sql)
            public DateTime? DateCloture { get; set; }
            public int? NbBT { get; set; }
        }

        public class BonTravail
        {
            public int? IdBonTravail { get; set; }
            public string? NumBT { get; set; }
            public int? IdDemandeIntervention { get; set; }
            public int? TypeIntervention { get; set; }
            public int? Statut { get; set; }
            // Minutes
            public int? TempsPrevu { get; set; }
            public int? TempsRealise { get; set; }
            public DateTime? DatePrevueDebut { get; set; }
            public DateTime? DatePrevueFin { get; set; }
            public DateTime? DateRealisation { get; set; }
            public decimal? CoutPrestationExterne { get; set; }
            public decimal? CoutMainOeuvreInterne { get; set; }
            // Somme Quantite x PrixUnitaire des pièces du BT
            public decimal? CoutPieces { get; set; }
            public int? NbIntervenantsInternes { get; set; }
            public int? NbIntervenantsExternes { get; set; }
            public DateTime? DateEnregistrement { get; set; }
        }

        public static IEnumerable<DemandeIntervention> GetDemandesIntervention()
        {
            using IDbConnection db = new SqlConnection(Class_BDD_Groupe.ConnectionSQL_BDIP);
            var sql = @"
SELECT
    di.IdDemandeIntervention,
    di.NumDI,
    di.Statut,
    di.Criticite,
    di.IdMachine,
    di.Titre,
    di.Demandeur,
    di.DateEnregistrement,
    di.DateCloture,
    (SELECT COUNT(1) FROM BonTravail b WHERE b.IdDemandeIntervention = di.IdDemandeIntervention) AS NbBT
FROM DemandeIntervention di
WHERE di.Service = @service
ORDER BY di.DateEnregistrement;";

            return db.Query<DemandeIntervention>(sql, new { service = ServiceMaintenance }, commandTimeout: CommandTimeoutSec);
        }

        public static IEnumerable<BonTravail> GetBonsTravail()
        {
            using IDbConnection db = new SqlConnection(Class_BDD_Groupe.ConnectionSQL_BDIP);
            var sql = @"
SELECT
    b.IdBonTravail,
    b.NumBT,
    b.IdDemandeIntervention,
    b.TypeIntervention,
    b.Statut,
    b.TempsPrevu,
    b.TempsRealise,
    b.DatePrevueDebut,
    b.DatePrevueFin,
    b.DateRealisation,
    b.CoutPrestationExterne,
    b.CoutMainOeuvreInterne,
    p.CoutPieces,
    ISNULL(i.NbInternes, 0) AS NbIntervenantsInternes,
    ISNULL(i.NbExternes, 0) AS NbIntervenantsExternes,
    b.DateEnregistrement
FROM BonTravail b
INNER JOIN DemandeIntervention di ON di.IdDemandeIntervention = b.IdDemandeIntervention
OUTER APPLY (
    SELECT SUM(CAST(bp.Quantite * bp.PrixUnitaire AS DECIMAL(18, 2))) AS CoutPieces
    FROM BonTravail_Piece bp
    WHERE bp.IdBonTravail = b.IdBonTravail
) p
OUTER APPLY (
    SELECT
        SUM(CASE WHEN bi.TypeIntervenant = 1 THEN 1 ELSE 0 END) AS NbInternes,
        SUM(CASE WHEN bi.TypeIntervenant = 2 THEN 1 ELSE 0 END) AS NbExternes
    FROM BonTravail_Intervenant bi
    WHERE bi.IdBonTravail = b.IdBonTravail
) i
WHERE di.Service = @service
ORDER BY b.DateEnregistrement;";

            return db.Query<BonTravail>(sql, new { service = ServiceMaintenance }, commandTimeout: CommandTimeoutSec);
        }
    }
}
