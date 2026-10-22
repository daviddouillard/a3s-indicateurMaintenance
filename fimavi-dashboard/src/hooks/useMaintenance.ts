import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, REFRESH_TIMEOUT_MS } from '../auth/apiClient';
import { NOT_IN_GROUP, retryUnlessForbidden } from './apiErrors';

export { NOT_IN_GROUP };

// Forme JSON de l'API A3SreportingBDIP (Maintenance/DemandesIntervention, Maintenance/BonsTravail),
// relayée telle quelle par le backend (/api/maintenance).
export interface DemandeIntervention {
  idDemandeIntervention: number;
  numDI: string | null;
  statut: number | null; // 1 Nouvelle, 10 Accepté, 50 En attente, 100 Terminé
  criticite: number | null; // 1 Critique, 2 Majeur, 3 Mineur
  idMachine: string | null; // "4;5;6"
  titre: string | null;
  demandeur: string | null;
  dateEnregistrement: string | null;
  dateCloture: string | null;
  nbBT: number | null;
}

export interface BonTravail {
  idBonTravail: number;
  numBT: string | null;
  idDemandeIntervention: number | null;
  typeIntervention: number | null;
  statut: number | null; // 1 Planifié, 10 En cours, 100 Terminé, 200 Annulé
  tempsPrevu: number | null; // minutes
  tempsRealise: number | null; // minutes
  datePrevueDebut: string | null;
  datePrevueFin: string | null;
  dateRealisation: string | null;
  coutPrestationExterne: number | null;
  coutMainOeuvreInterne: number | null;
  coutPieces: number | null;
  nbIntervenantsInternes: number | null;
  nbIntervenantsExternes: number | null;
  dateEnregistrement: string | null;
}

export interface Machine {
  idMachine: number;
  nom: string | null;
}

export interface MaintenanceData {
  dis: DemandeIntervention[];
  bts: BonTravail[];
  machines: Machine[];
  updatedAt: string;
  stale: boolean;
}

async function readJson(res: Response): Promise<MaintenanceData> {
  if (res.status === 403) throw new Error(NOT_IN_GROUP);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

const QUERY_KEY = ['maintenance'];

export function useMaintenance() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => readJson(await apiFetch('/api/maintenance')),
    refetchInterval: 5 * 60 * 1000,
    retry: retryUnlessForbidden,
  });
}

// Bouton « Actualiser » : le serveur relit l'API BDIP (sans attendre son cache de 5 min)
export function useRefresh() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (busy) return;
    setBusy(true);
    try {
      queryClient.setQueryData(QUERY_KEY, await readJson(await apiFetch('/api/refresh', { method: 'POST' }, REFRESH_TIMEOUT_MS)));
    } catch (e) {
      console.error('Actualisation échouée', e);
    } finally {
      setBusy(false);
    }
  }

  return { busy, refresh };
}
