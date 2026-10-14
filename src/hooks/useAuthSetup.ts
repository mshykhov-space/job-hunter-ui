import { useLayoutEffect } from "react";

import { useAuth } from "@/hooks/useAuth";
import { registerAuthErrorHandler, registerTokenGetter, registerTokenRefresher } from "@/lib/api";

export const useAuthSetup = () => {
  const {
    isConfigured,
    isLoading,
    isAuthenticated,
    getAccessTokenSilently,
    invalidateSession,
    user,
  } = useAuth();
  useLayoutEffect(() => {
    if (!isConfigured || !isAuthenticated) return;

    const cleanupToken = registerTokenGetter(() => getAccessTokenSilently());
    const cleanupRefresher = registerTokenRefresher(() =>
      getAccessTokenSilently({ cacheMode: "off" })
    );
    const cleanupAuth = registerAuthErrorHandler(() => {
      void invalidateSession?.();
    });

    return () => {
      cleanupToken();
      cleanupRefresher();
      cleanupAuth();
    };
  }, [isConfigured, isAuthenticated, getAccessTokenSilently, invalidateSession, user?.subject]);

  return { isLoading, isConfigured };
};
