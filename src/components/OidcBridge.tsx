import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth as useOidcAuth } from "react-oidc-context";

import { AuthContext } from "@/hooks/useAuth";

interface OidcBridgeProps {
  children: ReactNode;
}

const EMPTY_PERMISSIONS: string[] = [];

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

  const hasRecoverableExpiredSession =
    !auth.isLoading &&
    !auth.isAuthenticated &&
    auth.user?.expired === true &&
    !!auth.user.refresh_token;
  const expiredSessionRecoveryKey = hasRecoverableExpiredSession
    ? auth.user?.expires_at
    : undefined;
  const attemptedExpiredSessionRecovery = useRef<number | undefined>(undefined);
  const [failedExpiredSessionRecovery, setFailedExpiredSessionRecovery] = useState<
    number | undefined
  >(undefined);
  const { signinSilent } = auth;

  useEffect(() => {
    if (
      !expiredSessionRecoveryKey ||
      attemptedExpiredSessionRecovery.current === expiredSessionRecoveryKey
    )
      return;

    attemptedExpiredSessionRecovery.current = expiredSessionRecoveryKey;
    void (async () => {
      try {
        await signinSilent();
      } catch {
        try {
          await signinSilent({ forceIframeAuth: true });
        } catch {
          console.warn("OIDC session recovery failed");
          setFailedExpiredSessionRecovery(expiredSessionRecoveryKey);
        }
      }
    })();
  }, [expiredSessionRecoveryKey, signinSilent]);

  const isLoading =
    auth.isLoading ||
    (hasRecoverableExpiredSession && failedExpiredSessionRecovery !== expiredSessionRecoveryKey);

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
