import { useAuth as useOidcAuth } from "react-oidc-context";

import { act, render, screen } from "@testing-library/react";
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

  it("releases the app when OIDC initialization never settles", async () => {
    vi.useFakeTimers();

    mockUseOidcAuth.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      signinSilent: vi.fn(),
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
  });

  it("releases an expired session without starting silent renewal", () => {
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
        <AuthStatus />
      </OidcBridge>
    );

    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(signinSilent).not.toHaveBeenCalled();
  });
});
