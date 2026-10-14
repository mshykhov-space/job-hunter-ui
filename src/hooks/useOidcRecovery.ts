import { useEffect, useState } from "react";

import type { User } from "oidc-client-ts";

import { OIDC_REQUEST_TIMEOUT_SECONDS, type OidcSession } from "@/lib/oidcSession";

export const useOidcRecovery = (
  session: OidcSession,
  user: User | null | undefined,
  initializing: boolean
) => {
  const [settledCredential, setSettledCredential] = useState<string>();
  const expiredCredential = user?.expired && user.refresh_token ? user.access_token : undefined;
  const recovering =
    !initializing && !!expiredCredential && settledCredential !== expiredCredential;

  useEffect(() => {
    if (!recovering || !expiredCredential) return;
    let active = true;
    const settle = () => {
      if (active) setSettledCredential(expiredCredential);
    };
    const timeout = window.setTimeout(settle, OIDC_REQUEST_TIMEOUT_SECONDS * 1000);
    void session
      .getAccessToken()
      .catch(() => undefined)
      .finally(settle);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [session, recovering, expiredCredential]);

  useEffect(() => {
    const renew = () => {
      void session.getAccessToken().catch(() => undefined);
    };
    const refreshExpiring = () => {
      void session.getAccessToken(true).catch(() => undefined);
    };
    const syncStorage = (event: StorageEvent) => {
      if (
        event.key ===
        `oidc.user:${session.userManager.settings.authority}:${session.userManager.settings.client_id}`
      ) {
        if (event.newValue === null) {
          void session.userManager.removeUser();
        } else {
          void session.userManager.getUser(true);
        }
      }
    };
    session.userManager.events.addAccessTokenExpiring(refreshExpiring);
    window.addEventListener("focus", renew);
    window.addEventListener("online", renew);
    window.addEventListener("storage", syncStorage);
    return () => {
      session.userManager.events.removeAccessTokenExpiring(refreshExpiring);
      window.removeEventListener("focus", renew);
      window.removeEventListener("online", renew);
      window.removeEventListener("storage", syncStorage);
    };
  }, [session]);

  return recovering;
};
