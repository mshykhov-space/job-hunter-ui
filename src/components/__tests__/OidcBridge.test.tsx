import { useAuth as useOidcAuth } from "react-oidc-context";

import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OidcBridge } from "@/components/OidcBridge";

vi.mock("react-oidc-context", () => ({
  useAuth: vi.fn(),
}));

const mockUseOidcAuth = vi.mocked(useOidcAuth);

describe("OidcBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores an expired session with the stored refresh token", async () => {
    const signinSilent = vi.fn().mockResolvedValue({ access_token: "fresh-token" });

    mockUseOidcAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: {
        expired: true,
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
});
