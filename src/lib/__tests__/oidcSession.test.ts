import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { User, WebStorageStateStore } from "oidc-client-ts";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createOidcSession, SessionExpiredError } from "@/lib/oidcSession";

const AUTHORITY = "https://auth.example.test";
const TOKEN_URL = `${AUTHORITY}/token`;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
beforeEach(() => localStorage.clear());
afterEach(() => server.resetHandlers());

const createSession = () =>
  createOidcSession({
    authority: AUTHORITY,
    client_id: "job-hunter-ui",
    redirect_uri: "http://localhost",
    metadata: { issuer: AUTHORITY, token_endpoint: TOKEN_URL },
    userStore: new WebStorageStateStore({ store: localStorage }),
  });

const storedUser = (expired = true) =>
  new User({
    access_token: "previous-access",
    refresh_token: "saved-refresh",
    expires_at: Math.floor(Date.now() / 1000) + (expired ? -60 : 3600),
    token_type: "Bearer",
    scope: "openid offline_access",
    profile: { sub: "test-user", iss: AUTHORITY, aud: "job-hunter-ui", exp: 0, iat: 0 },
  });

const renewed = () =>
  HttpResponse.json({
    access_token: "renewed-access",
    refresh_token: "rotated-refresh",
    expires_in: 3600,
    token_type: "Bearer",
    scope: "openid offline_access",
  });

describe("OIDC session", () => {
  it("restores an expired access token using the saved refresh credential", async () => {
    const session = createSession();
    await session.userManager.storeUser(storedUser());
    let grant: string | null = null;
    let credential: string | null = null;
    server.use(
      http.post(TOKEN_URL, async ({ request }) => {
        const body = new URLSearchParams(await request.text());
        grant = body.get("grant_type");
        credential = body.get("refresh_token");
        return renewed();
      })
    );

    expect(await session.getAccessToken()).toBe("renewed-access");
    expect(grant).toBe("refresh_token");
    expect(credential).toBe("saved-refresh");
    expect((await session.userManager.getUser())?.refresh_token).toBe("rotated-refresh");
  });

  it("shares one refresh across simultaneous startup and API requests", async () => {
    const session = createSession();
    await session.userManager.storeUser(storedUser());
    let exchanges = 0;
    server.use(
      http.post(TOKEN_URL, () => {
        exchanges++;
        return renewed();
      })
    );

    expect(
      await Promise.all([
        session.getAccessToken(),
        session.getAccessToken(),
        session.getAccessToken(true),
      ])
    ).toEqual(["renewed-access", "renewed-access", "renewed-access"]);
    expect(exchanges).toBe(1);
  });

  it("reads a newer stored credential instead of a stale React snapshot", async () => {
    const session = createSession();
    await session.userManager.storeUser(storedUser(false));
    let exchanges = 0;
    server.use(
      http.post(TOKEN_URL, () => {
        exchanges++;
        return renewed();
      })
    );

    expect(await session.getAccessToken(true)).toBe("renewed-access");
    expect(await session.getAccessToken()).toBe("renewed-access");
    expect(exchanges).toBe(1);
  });

  it("retains the saved session on a temporary provider failure and can retry", async () => {
    const session = createSession();
    await session.userManager.storeUser(storedUser());
    server.use(
      http.post(TOKEN_URL, () =>
        HttpResponse.json({ error: "temporarily_unavailable" }, { status: 503 })
      )
    );

    await expect(session.getAccessToken()).rejects.not.toBeInstanceOf(SessionExpiredError);
    expect((await session.userManager.getUser())?.refresh_token).toBe("saved-refresh");
    server.use(http.post(TOKEN_URL, renewed));
    expect(await session.getAccessToken()).toBe("renewed-access");
  });

  it("clears only the application session when the refresh grant is rejected", async () => {
    const session = createSession();
    await session.userManager.storeUser(storedUser());
    server.use(
      http.post(TOKEN_URL, () => HttpResponse.json({ error: "invalid_grant" }, { status: 400 }))
    );

    await expect(session.getAccessToken()).rejects.toBeInstanceOf(SessionExpiredError);
    expect(await session.userManager.getUser()).toBeNull();
  });

  it("does not start an iframe login without a refresh credential", async () => {
    const session = createSession();
    const user = storedUser();
    user.refresh_token = undefined;
    await session.userManager.storeUser(user);

    await expect(session.getAccessToken()).rejects.toBeInstanceOf(SessionExpiredError);
    expect(document.querySelector("iframe")).toBeNull();
  });

  it.each(["logout", "switch"])(
    "discards a late refresh after an identity %s",
    async (transition) => {
      const session = createSession();
      await session.userManager.storeUser(storedUser());
      let release: () => void = () => undefined;
      let started = false;
      server.use(
        http.post(TOKEN_URL, async () => {
          started = true;
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          return renewed();
        })
      );
      const result = session.getAccessToken().catch((error: unknown) => error);
      await vi.waitFor(() => expect(started).toBe(true));
      const other = storedUser(false);
      other.profile.sub = "another-user";
      other.access_token = "another-access";
      await session.userManager.storeUser(transition === "logout" ? null : other);
      release();

      expect(await result).toBeInstanceOf(Error);
      expect((await session.userManager.getUser())?.profile.sub ?? null).toBe(
        transition === "logout" ? null : "another-user"
      );
    }
  );
});
