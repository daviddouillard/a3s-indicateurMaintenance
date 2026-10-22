// Compte authentifié mais hors du groupe autorisé (403 de l'API, cf. requireAuth côté
// serveur) : la page affiche alors <AccessDenied />.
export const NOT_IN_GROUP = 'NOT_IN_GROUP';

// Session Microsoft à renouveler (jeton expiré et renouvellement silencieux impossible,
// redirection bloquée…) : le bandeau <SessionWatchdog /> propose « Se reconnecter ».
export const RECONNEXION = 'RECONNEXION_REQUISE';

// Retry react-query : inutile de réessayer un refus de droits ou une session expirée.
export const retryUnlessForbidden = (count: number, err: Error) =>
  err.message !== NOT_IN_GROUP && err.message !== RECONNEXION && count < 2;
