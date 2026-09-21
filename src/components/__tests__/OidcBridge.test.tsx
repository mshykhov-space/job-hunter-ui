import { useAuth as useOidcAuth } from "react-oidc-context";

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OidcBridge } from "@/components/OidcBridge";
import { useAuth } from "@/hooks/useAuth";

vi.mock("react-oidc-context", () => ({
  useAuth: vi.fn(),
}));

const mockUseOidcAuth = vi.mocked(useOidcAuth);

const AuthStatus = () => {
  const { isLoading } = useAuth();
  return <div>{isLoading ? "Restoring session" : "Ready"}</div>;
};

describe("OidcBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("restores an expired session with the stored refresh token", async () => {
    const signinSilent = vi.fn().mockResolvedValue({ access_token: "fresh-token" });

    mockUseOidcAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: {
        expired: true,
        expires_at: 1,
        refresh_token: "stored-refresh-token",
        access_token: "expired-access-token",
        profile: { sub: "owner" },
      },
      signinSilent,
    } as unknown as ReturnType<typeof useOidcAuth>);

    render(
      <OidcBridge>
        <div>Job Hunter</div>
      </OidcBridge>
    );

    await waitFor(() => expect(signinSilent).toHaveBeenCalledOnce());
  });

  it("keeps routes blocked while an expired session is being restored", () => {
    const signinSilent = vi.fn(() => new Promise(() => undefined));

    mockUseOidcAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: {
        expired: true,
        expires_at: 1,
        refresh_token: "stored-refresh-token",
        access_token: "expired-access-token",
        profile: { sub: "owner" },
      },
      signinSilent,
    } as unknown as ReturnType<typeof useOidcAuth>);

    render(
      <OidcBridge>
        <AuthStatus />
      </OidcBridge>
    );

    expect(screen.getByText("Restoring session")).toBeInTheDocument();
  });

  it("releases the app when silent session recovery never settles", async () => {
    vi.useFakeTimers();
    const signinSilent = vi.fn(() => new Promise(() => undefined));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    mockUseOidcAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: {
        expired: true,
        expires_at: 1,
        refresh_token: "stored-refresh-token",
        access_token: "expired-access-token",
        profile: { sub: "owner" },
      },
      signinSilent,
    } as unknown as ReturnType<typeof useOidcAuth>);

    render(
      <OidcBridge>
        <AuthStatus />
      </OidcBridge>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(warn).toHaveBeenCalledOnce();
  });

  it("uses the Authentik session when the stored refresh token is rejected", async () => {
    const signinSilent = vi
      .fn()
      .mockRejectedValueOnce(new Error("refresh token rejected"))
      .mockResolvedValueOnce({ access_token: "fresh-token" });

    mockUseOidcAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: {
        expired: true,
        expires_at: 1,
        refresh_token: "stored-refresh-token",
        access_token: "expired-access-token",
        profile: { sub: "owner" },
      },
      signinSilent,
    } as unknown as ReturnType<typeof useOidcAuth>);

    render(
      <OidcBridge>
        <AuthStatus />
      </OidcBridge>
    );

    await waitFor(() => expect(signinSilent).toHaveBeenNthCalledWith(2, { forceIframeAuth: true }));
  });

  it("releases the app when neither silent recovery path can restore the session", async () => {
    const signinSilent = vi.fn().mockRejectedValue(new Error("session unavailable"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    mockUseOidcAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: {
        expired: true,
        expires_at: 1,
        refresh_token: "stored-refresh-token",
        access_token: "expired-access-token",
        profile: { sub: "owner" },
      },
      signinSilent,
    } as unknown as ReturnType<typeof useOidcAuth>);

    render(
      <OidcBridge>
        <AuthStatus />
      </OidcBridge>
    );

    await waitFor(() => expect(screen.getByText("Ready")).toBeInTheDocument());
    expect(warn).toHaveBeenCalledOnce();
  });
});
