import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth as useOidcAuth } from "react-oidc-context";

import { AuthContext } from "@/hooks/useAuth";

interface OidcBridgeProps {
  children: ReactNode;
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

export const OidcBridge = ({ children }: OidcBridgeProps) => {
  const auth = useOidcAuth();
  const accessToken = auth.user?.access_token;
  const [oidcInitializationTimedOut, setOidcInitializationTimedOut] = useState(false);

  useEffect(() => {
    if (!auth.isLoading) return;
    const timeout = window.setTimeout(
      () => setOidcInitializationTimedOut(true),
      OIDC_INITIALIZATION_TIMEOUT_MS
    );
    return () => window.clearTimeout(timeout);
  }, [auth.isLoading]);

  const isLoading = auth.isLoading && !oidcInitializationTimedOut;

  const permissions = useMemo(
    () => (accessToken ? decodePermissions(accessToken) : EMPTY_PERMISSIONS),
    [accessToken]
  );

  const getAccessTokenSilently = useCallback(
    async (options?: { cacheMode?: "on" | "off" | "cache-only" }) => {
      const cached = auth.user?.access_token;
      if (options?.cacheMode !== "off" && cached && !auth.user?.expired) {
        return cached;
      }
      const user = await auth.signinSilent();
      if (!user?.access_token) throw new Error("Silent token renewal failed");
      return user.access_token;
    },
    [auth]
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
          ? { email: profile.email, name: profile.name, picture: profile.picture }
          : undefined,
        loginWithRedirect: () => auth.signinRedirect(),
        logout: (options) =>
          auth.signoutRedirect({ post_logout_redirect_uri: options?.logoutParams?.returnTo }),
        getAccessTokenSilently,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
