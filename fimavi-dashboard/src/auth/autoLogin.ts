// Connexion automatique (comme le portail indicateurs.ateliers3s.com) : un visiteur non
// connecté est envoyé directement sur Microsoft ; si une session Microsoft est déjà ouverte
// (portail, autre appli Indicateurs du même tenant), il revient connecté sans rien ressaisir.
// Le bouton « Se connecter » ne reste affiché qu'après une erreur de connexion (évite une
// boucle) ou une déconnexion volontaire (sinon on le reconnecterait aussitôt).
// Drapeaux en sessionStorage : propres à l'onglet, ils survivent à la redirection Microsoft.

const LOGGED_OUT = 'maintenanceLoggedOut';
const LOGIN_ERROR = 'maintenanceLoginError';

function read(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function write(key: string, on: boolean) {
  try {
    if (on) sessionStorage.setItem(key, '1');
    else sessionStorage.removeItem(key);
  } catch {
    // stockage indisponible : le bouton reste le seul moyen de se connecter
  }
}

export const autoLoginAllowed = () => !read(LOGGED_OUT) && !read(LOGIN_ERROR);
export const markLoggedOut = () => write(LOGGED_OUT, true);
export const markLoginError = () => write(LOGIN_ERROR, true);
// Connexion demandée explicitement (bouton) : on réarme la connexion automatique.
export const clearAutoLoginFlags = () => {
  write(LOGGED_OUT, false);
  write(LOGIN_ERROR, false);
};
