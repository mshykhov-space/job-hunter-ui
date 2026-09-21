import type { ReactNode } from "react";
import { AuthProvider as OidcAuthProvider } from "react-oidc-context";

import { WebStorageStateStore } from "oidc-client-ts";

import { OIDC_CONFIG, OIDC_ENABLED } from "@/config/constants";
import { AuthContext, type AuthContextValue, noopAuth, PERMISSIONS } from "@/hooks/useAuth";

import { OidcBridge } from "./OidcBridge";

interface AuthProviderProps {
  children: ReactNode;
}

const isOidcConfigured = OIDC_ENABLED && !!OIDC_CONFIG.authority && !!OIDC_CONFIG.clientId;
const isMockMode = import.meta.env.VITE_ENABLE_MOCKS === "true";

const mockAuth: AuthContextValue = {
  ...noopAuth,
  isAuthenticated: true,
  isConfigured: true,
  permissions: Object.values(PERMISSIONS),
  user: { email: "owner@example.test", name: "Local owner" },
  getAccessTokenSilently: () => Promise.resolve("mock-owner-token"),
};

// Strip ?code=&state= left by the authorization code callback
const onSigninCallback = () => {
  window.history.replaceState({}, document.title, window.location.pathname);
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  if (isMockMode) {
    return <AuthContext.Provider value={mockAuth}>{children}</AuthContext.Provider>;
  }

  if (!isOidcConfigured) {
    return <AuthContext.Provider value={noopAuth}>{children}</AuthContext.Provider>;
  }

  return (
    <OidcAuthProvider
      authority={OIDC_CONFIG.authority}
      client_id={OIDC_CONFIG.clientId}
      redirect_uri={window.location.origin}
      scope="openid profile email offline_access job-hunter-api"
      automaticSilentRenew={false}
      userStore={new WebStorageStateStore({ store: window.localStorage })}
      onSigninCallback={onSigninCallback}
    >
      <OidcBridge>{children}</OidcBridge>
    </OidcAuthProvider>
  );
};
