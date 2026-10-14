import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth as useOidcAuth } from "react-oidc-context";

import { AuthContext } from "@/hooks/useAuth";
import { useOidcRecovery } from "@/hooks/useOidcRecovery";
import type { OidcSession } from "@/lib/oidcSession";

interface OidcBridgeProps {
  children: ReactNode;
  session: OidcSession;
}

const EMPTY_PERMISSIONS: string[] = [];
const OIDC_INITIALIZATION_TIMEOUT_MS = 10_000;

const decodePermissions = (token: string): string[] => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return Array.isArray(payload.permissions) ? payload.permissions : [];
  } catch {
    return [];
  }
};

export const OidcBridge = ({ children, session }: OidcBridgeProps) => {
  const auth = useOidcAuth();
  const accessToken = auth.user?.access_token;
  const subject = auth.user?.profile.sub;
  const [oidcInitializationTimedOut, setOidcInitializationTimedOut] = useState(false);
  const recovering = useOidcRecovery(session, auth.user, auth.isLoading);

  useEffect(() => {
    if (!auth.isLoading) return;
    const timeout = window.setTimeout(
      () => setOidcInitializationTimedOut(true),
      OIDC_INITIALIZATION_TIMEOUT_MS
    );
    return () => window.clearTimeout(timeout);
  }, [auth.isLoading]);

  const isLoading = (auth.isLoading && !oidcInitializationTimedOut) || recovering;

  const permissions = useMemo(
    () => (accessToken ? decodePermissions(accessToken) : EMPTY_PERMISSIONS),
    [accessToken]
  );

  const getAccessTokenSilently = useCallback(
    (options?: { cacheMode?: "on" | "off" | "cache-only" }) =>
      session.getAccessToken(options?.cacheMode === "off", subject),
    [session, subject]
  );
  const invalidateSession = useCallback(() => session.userManager.removeUser(), [session]);
  const { signinRedirect, signoutRedirect } = auth;
  const loginWithRedirect = useCallback(() => signinRedirect(), [signinRedirect]);
  const logout = useCallback(
    (options?: { logoutParams?: { returnTo?: string } }) =>
      signoutRedirect({ post_logout_redirect_uri: options?.logoutParams?.returnTo }),
    [signoutRedirect]
  );

  const resolvedPermissions = auth.isAuthenticated ? permissions : EMPTY_PERMISSIONS;
  const profile = auth.user?.profile;

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: auth.isAuthenticated,
        isLoading,
        isConfigured: true,
        permissions: resolvedPermissions,
        user: profile
          ? {
              subject: profile.sub,
              email: profile.email,
              name: profile.name,
              picture: profile.picture,
            }
          : undefined,
        loginWithRedirect,
        logout,
        invalidateSession,
        getAccessTokenSilently,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
