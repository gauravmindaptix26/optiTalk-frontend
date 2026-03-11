import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from "react-router-dom";
import Auth0ProviderWithNavigate from "./auth/Auth0ProviderWithNavigate.jsx";

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
const configuredRedirectUri = import.meta.env.VITE_AUTH0_REDIRECT_URI;
const currentOrigin = window.location.origin;
const isLocalOrigin =
  currentOrigin.includes("localhost") || currentOrigin.includes("127.0.0.1");
const redirectUri =
  configuredRedirectUri &&
  (isLocalOrigin || configuredRedirectUri.startsWith(currentOrigin))
    ? configuredRedirectUri
    : `${currentOrigin}/chat`;

if (!domain) {
  throw new Error("Missing VITE_AUTH0_DOMAIN in frontend/.env");
}

if (!clientId) {
  throw new Error("Missing VITE_AUTH0_CLIENT_ID in frontend/.env");
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Auth0ProviderWithNavigate
        domain={domain}
        clientId={clientId}
        authorizationParams={{
          redirect_uri: redirectUri,
          // `offline_access` enables Refresh Token Rotation for SPAs (keeps users logged in across refreshes)
          // when enabled in the Auth0 dashboard for this application.
          scope: "openid profile email offline_access",
          ...(audience ? { audience } : {}),
        }}
        cacheLocation="localstorage"
        useRefreshTokens={true}
        useRefreshTokensFallback={true}
      >
        <App />
      </Auth0ProviderWithNavigate>
    </BrowserRouter>
  </StrictMode>,
)
