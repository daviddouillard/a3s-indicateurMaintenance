import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import { EventType } from '@azure/msal-browser'
import type { AuthenticationResult } from '@azure/msal-browser'
import './index.css'
import App from './App'
import { msalInstance } from './auth/authConfig'
import { markLoginError } from './auth/autoLogin'

// MSAL v3+ : initialiser l'instance avant tout usage, puis traiter la
// réponse d'une éventuelle redirection de connexion.
await msalInstance.initialize()

// Définit le compte actif après une connexion réussie (utile pour acquireTokenSilent).
const [firstAccount] = msalInstance.getAllAccounts()
if (firstAccount) {
  msalInstance.setActiveAccount(firstAccount)
}
msalInstance.addEventCallback((event) => {
  if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
    const { account } = event.payload as AuthenticationResult
    if (account) msalInstance.setActiveAccount(account)
  }
})

// Retour de Microsoft en erreur : on coupe la connexion automatique (évite une boucle),
// l'écran de connexion affiche alors le bouton.
try {
  await msalInstance.handleRedirectPromise()
} catch (err) {
  console.error('Connexion Microsoft échouée', err)
  markLoginError()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  </StrictMode>,
)
