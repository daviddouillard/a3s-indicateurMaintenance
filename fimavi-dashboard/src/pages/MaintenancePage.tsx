import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { NOT_IN_GROUP, useMaintenance, useRefresh } from '../hooks/useMaintenance';
import { AccessDenied } from '../auth/AccessDenied';
import { UserMenu } from '../auth/UserMenu';
import { Panel } from '../components/Panel';
import { RefreshButton } from '../components/RefreshButton';
import { Filtres } from '../components/Filtres';
import { KpiTiles } from '../components/KpiTiles';
import { HebdoChart } from '../components/charts/HebdoChart';
import { CoutsPanel, DelaiPanel, MachinesPanel, TypesPanel } from '../components/IndicateursPanels';
import { coutsParMois, delaisResolution, filtrerCriticite, heuresParType, kpis, periodes, seriesHebdo, topMachines } from '../utils/indicateurs';

const PERIODE_DEFAUT = `a${new Date().getFullYear()}`;

export default function MaintenancePage() {
  const { data, isPending, isError, error } = useMaintenance();
  const { busy, refresh } = useRefresh();
  const [periodeKey, setPeriodeKey] = useState(PERIODE_DEFAUT);
  const [criticite, setCriticite] = useState<number | null>(null);

  // Années proposées : de la première DI à l'année en cours
  const choix = useMemo(() => {
    const now = new Date().getFullYear();
    const first = data?.dis.reduce((min, di) => (di.dateEnregistrement ? Math.min(min, new Date(di.dateEnregistrement).getFullYear()) : min), now) ?? now;
    const years = Array.from({ length: now - first + 1 }, (_, i) => now - i);
    return periodes(years);
  }, [data]);
  const periode = choix.find((p) => p.key === periodeKey) ?? choix[0];

  const vue = useMemo(() => {
    if (!data) return null;
    const { dis, bts } = filtrerCriticite(data.dis, data.bts, criticite);
    return {
      hebdo: seriesHebdo(dis, periode),
      kpis: kpis(dis, bts, periode),
      delais: delaisResolution(dis, periode),
      heures: heuresParType(bts, periode),
      machines: topMachines(dis, bts, data.machines, periode),
      couts: coutsParMois(bts, periode),
    };
  }, [data, criticite, periode]);

  // Le serveur a refusé le compte (hors groupe) : même écran que la porte de connexion
  if (error?.message === NOT_IN_GROUP) return <AccessDenied />;

  const updatedAt = data
    ? new Date(data.updatedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-20 bg-white px-3 sm:px-6 py-2 shadow-sm border-b border-gray-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Vers le portail via son point de connexion Microsoft : session reprise sans ressaisie */}
          <a href="https://indicateurs.ateliers3s.com/auth/microsoft" className="shrink-0" title="Portail des indicateurs">
            <img src="/A3S.jpg" alt="A3S" className="h-8 object-contain" />
          </a>
          <h1 className="text-base sm:text-lg font-bold text-gray-800 truncate">Indicateurs Maintenance</h1>
          {updatedAt && (
            <span
              className={`hidden sm:flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1 ${data?.stale ? 'text-red-700 bg-red-50' : 'text-gray-500 bg-gray-100'}`}
              title={data?.stale ? "L'API ACOF ne répond pas : dernières données connues" : undefined}
            >
              <span className={`w-2 h-2 rounded-full ${data?.stale ? 'bg-red-500' : 'bg-green-500'}`} />
              {data?.stale ? 'données du' : 'maj'} {updatedAt}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <RefreshButton busy={busy} onRefresh={refresh} />
          <UserMenu />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center gap-3 sm:gap-4 p-3 sm:p-4">
        {isPending ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
            <RefreshCw size={28} className="animate-spin text-orange-500" />
            <p className="text-sm font-medium">Chargement des indicateurs…</p>
          </div>
        ) : isError || !vue ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-lg font-semibold text-red-600">Erreur de chargement</p>
            <p className="text-sm text-gray-500 mt-1">Impossible de contacter l'API maintenance (A3SreportingBDIP)</p>
          </div>
        ) : (
          <>
            <Filtres periodes={choix} periode={periode} onPeriode={setPeriodeKey} criticite={criticite} onCriticite={setCriticite} />
            <KpiTiles k={vue.kpis} />
            {vue.kpis.nonDatees > 0 && (
              <p className="w-full max-w-[1800px] rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {vue.kpis.nonDatees} DI sans date de création (reprise initiale ACOF) : exclues des graphiques, délais et machines,
                mais comptées dans les DI en cours.
              </p>
            )}
            <Panel
              title="Demandes d'intervention par semaine"
              note="Entrées = DI créées dans la semaine ; clôturées = DI passées au statut Terminé dans la semaine ; backlog = DI en cours (nouvelle, acceptée, en attente) en fin de semaine."
              className="w-full max-w-[1800px]"
            >
              <HebdoChart rows={vue.hebdo} />
            </Panel>
            <div className="w-full max-w-[1800px] grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-3 sm:gap-4">
              <DelaiPanel delais={vue.delais} />
              <TypesPanel heures={vue.heures} />
              <MachinesPanel machines={vue.machines} />
              <CoutsPanel couts={vue.couts} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
