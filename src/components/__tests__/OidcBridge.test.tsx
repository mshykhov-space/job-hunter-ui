import { AuthProvider as OidcAuthProvider } from "react-oidc-context";

import { act, render, screen, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { User, WebStorageStateStore } from "oidc-client-ts";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { OidcBridge } from "@/components/OidcBridge";
import { useAuth } from "@/hooks/useAuth";
import { createOidcSession } from "@/lib/oidcSession";

const AUTHORITY = "https://auth.example.test";
const TOKEN_URL = `${AUTHORITY}/token`;
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
beforeEach(() => localStorage.clear());
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});

const AuthStatus = () => {
  const { isLoading, isAuthenticated } = useAuth();
  return (
    <div>{isLoading ? "Restoring session" : isAuthenticated ? "Signed in" : "Signed out"}</div>
  );
};

const createSession = () =>
  createOidcSession({
    authority: AUTHORITY,
    client_id: "job-hunter-ui",
    redirect_uri: "http://localhost",
    metadata: { issuer: AUTHORITY, token_endpoint: TOKEN_URL },
    userStore: new WebStorageStateStore({ store: localStorage }),
  });

const renderSession = async () => {
  const session = createSession();
  await session.userManager.storeUser(
    new User({
      access_token: "expired-access",
      refresh_token: "saved-refresh",
      expires_at: Math.floor(Date.now() / 1000) - 60,
      token_type: "Bearer",
      profile: { sub: "test-user", iss: AUTHORITY, aud: "job-hunter-ui", exp: 0, iat: 0 },
    })
  );
  render(
    <OidcAuthProvider userManager={session.userManager}>
      <OidcBridge session={session}>
        <AuthStatus />
      </OidcBridge>
    </OidcAuthProvider>
  );
  return session;
};

describe("OidcBridge", () => {
  it("restores the authenticated route when reopening an expired session", async () => {
    server.use(
      http.post(TOKEN_URL, () =>
        HttpResponse.json({
          access_token: "fresh-access",
          refresh_token: "rotated-refresh",
          token_type: "Bearer",
          expires_in: 3600,
        })
      )
    );
    await renderSession();
    expect(await screen.findByText("Signed in")).toBeInTheDocument();
  });

  it("releases the app and retains credentials during a temporary failure", async () => {
    server.use(
      http.post(TOKEN_URL, () =>
        HttpResponse.json({ error: "temporarily_unavailable" }, { status: 503 })
      )
    );
    const session = await renderSession();
    expect(await screen.findByText("Signed out")).toBeInTheDocument();
    expect((await session.userManager.getUser())?.refresh_token).toBe("saved-refresh");
    server.use(
      http.post(TOKEN_URL, () =>
        HttpResponse.json({
          access_token: "fresh-access",
          token_type: "Bearer",
          expires_in: 3600,
        })
      )
    );
    act(() => window.dispatchEvent(new Event("online")));
    expect(await screen.findByText("Signed in")).toBeInTheDocument();
  });

  it("never leaves a hanging refresh on the initial loading screen", async () => {
    vi.useFakeTimers();
    server.use(
      http.post(TOKEN_URL, async () => {
        await delay("infinite");
        return new HttpResponse();
      })
    );
    await renderSession();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByText("Restoring session")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByText("Signed out")).toBeInTheDocument();
  });

  it("clears a rejected refresh credential without logging out the identity provider", async () => {
    server.use(
      http.post(TOKEN_URL, () => HttpResponse.json({ error: "invalid_grant" }, { status: 400 }))
    );
    const session = await renderSession();
    await waitFor(() => expect(screen.getByText("Signed out")).toBeInTheDocument());
    expect(await session.userManager.getUser()).toBeNull();
    expect(document.querySelector("iframe")).toBeNull();
  });
});
