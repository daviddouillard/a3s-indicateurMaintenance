using Microsoft.AspNetCore.Mvc;

namespace A3SreportingBDIP
{
    // Indicateurs Maintenance (dashboard GCP a3s-indicateurmaintenance). Les machines
    // (libellés des IdMachine) sont servies par Production/Referentiels.
    [Route("Maintenance")]
    [ApiController]
    public class MaintenanceController : ControllerBase
    {
        private readonly ILogger<MaintenanceController> _logger;

        public MaintenanceController(ILogger<MaintenanceController> logger)
        {
            _logger = logger;
        }

        [HttpGet("DemandesIntervention")]
        public IActionResult GetDemandesIntervention()
        {
            try
            {
                return Ok(Class_Maintenance.GetDemandesIntervention());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération des demandes d'intervention maintenance");
                return StatusCode(500, "Erreur interne du serveur");
            }
        }

        [HttpGet("BonsTravail")]
        public IActionResult GetBonsTravail()
        {
            try
            {
                return Ok(Class_Maintenance.GetBonsTravail());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors de la récupération des bons de travail maintenance");
                return StatusCode(500, "Erreur interne du serveur");
            }
        }
    }
}
