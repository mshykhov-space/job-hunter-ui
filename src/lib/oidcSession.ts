import {
  ErrorResponse,
  OidcClient,
  User,
  UserManager,
  type UserManagerSettings,
} from "oidc-client-ts";

export const OIDC_REQUEST_TIMEOUT_SECONDS = 10;
const TOKEN_RENEWAL_LEAD_SECONDS = 60;

export class SessionExpiredError extends Error {
  constructor() {
    super("Your session has expired. Please sign in again.");
    this.name = "SessionExpiredError";
  }
}

export class SessionChangedError extends Error {
  constructor() {
    super("The signed-in account changed. Please retry your request.");
    this.name = "SessionChangedError";
  }
}

export const createOidcSession = (settings: UserManagerSettings) => {
  const userManager = new UserManager({
    requestTimeoutInSeconds: OIDC_REQUEST_TIMEOUT_SECONDS,
    silentRequestTimeoutInSeconds: OIDC_REQUEST_TIMEOUT_SECONDS,
    ...settings,
    automaticSilentRenew: false,
  });
  const client = new OidcClient(userManager.settings);
  let renewal: Promise<string> | null = null;
  let renewalSubject: string | undefined;

  const refresh = async (previous: User) => {
    const current = await userManager.getUser();
    if (current?.profile.sub !== previous.profile.sub) throw new SessionChangedError();
    if (current.access_token !== previous.access_token && !current.expired) {
      await userManager.getUser(true);
      return current.access_token;
    }
    if (!current?.refresh_token) throw new SessionExpiredError();
    try {
      const response = await client.useRefreshToken({
        state: {
          refresh_token: current.refresh_token,
          id_token: current.id_token,
          session_state: current.session_state,
          scope: current.scope,
          profile: current.profile,
          data: current.state,
        },
        timeoutInSeconds: userManager.settings.silentRequestTimeoutInSeconds,
      });
      const latest = await userManager.getUser();
      if (
        latest?.profile.sub !== current.profile.sub ||
        latest.refresh_token !== current.refresh_token
      ) {
        throw new SessionChangedError();
      }
      const renewed = new User({ ...current, ...response });
      if (!renewed?.access_token) throw new Error("Session renewal returned no access token");
      await userManager.storeUser(renewed);
      await userManager.getUser(true);
      return renewed.access_token;
    } catch (error) {
      if (error instanceof ErrorResponse && error.error === "invalid_grant") {
        const latest = await userManager.getUser();
        if (
          latest?.profile.sub !== current.profile.sub ||
          latest.refresh_token !== current.refresh_token
        ) {
          throw new SessionChangedError();
        }
        await userManager.removeUser();
        throw new SessionExpiredError();
      }
      throw error;
    }
  };

  return {
    userManager,
    getAccessToken: async (forceRefresh = false, expectedSubject?: string): Promise<string> => {
      const user = await userManager.getUser();
      if (!user) throw new SessionExpiredError();
      if (expectedSubject && expectedSubject !== user.profile.sub) throw new SessionChangedError();
      if (renewal && renewalSubject === user.profile.sub) return renewal;
      if (!forceRefresh && (user.expires_in ?? 0) > TOKEN_RENEWAL_LEAD_SECONDS) {
        return user.access_token;
      }
      const performRefresh = () => refresh(user);
      const performLockedRefresh = async () =>
        await navigator.locks.request(
          `job-hunter-oidc:${settings.authority}:${settings.client_id}`,
          { signal: AbortSignal.timeout(OIDC_REQUEST_TIMEOUT_SECONDS * 1000) },
          performRefresh
        );
      const pending = (navigator.locks ? performLockedRefresh() : performRefresh()).finally(() => {
        if (renewal === pending) renewal = null;
      });
      renewal = pending;
      renewalSubject = user.profile.sub;
      return pending;
    },
  };
};

export type OidcSession = ReturnType<typeof createOidcSession>;
