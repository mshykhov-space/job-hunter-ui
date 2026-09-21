import type { ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { AuthProvider } from "@/components/AuthProvider";

const { oidcProvider } = vi.hoisted(() => ({ oidcProvider: vi.fn() }));

vi.mock("react-oidc-context", () => ({
  AuthProvider: ({ children, ...props }: { children: ReactNode }) => {
    oidcProvider(props);
    return children;
  },
}));

vi.mock("oidc-client-ts", () => ({
  WebStorageStateStore: vi.fn(),
}));

vi.mock("@/config/constants", () => ({
  OIDC_ENABLED: true,
  OIDC_CONFIG: { authority: "https://auth.example.test", clientId: "job-hunter-ui" },
}));

vi.mock("@/components/OidcBridge", () => ({
  OidcBridge: ({ children }: { children: ReactNode }) => children,
}));

beforeEach(() => {
  oidcProvider.mockClear();
});

it("leaves expired-session renewal to the bounded application recovery", () => {
  render(
    <AuthProvider>
      <div>Job Hunter</div>
    </AuthProvider>
  );

  expect(screen.getByText("Job Hunter")).toBeInTheDocument();
  expect(oidcProvider).toHaveBeenCalledWith(
    expect.objectContaining({ automaticSilentRenew: false })
  );
});
