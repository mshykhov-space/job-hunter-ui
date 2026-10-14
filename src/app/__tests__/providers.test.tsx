import { useQuery } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers";
import { AuthContext, type AuthContextValue } from "@/hooks/useAuth";

vi.mock("@/components/ApiErrorHandler", () => ({ ApiErrorHandler: () => null }));

describe("AppProviders", () => {
  it("does not expose a previous subject's cached query during a subject switch", async () => {
    let resolveSecondQuery: ((value: string) => void) | undefined;
    const secondQuery = new Promise<string>((resolve) => {
      resolveSecondQuery = resolve;
    });

    const view = (subject: string) => (
      <AuthContext.Provider value={auth(subject)}>
        <AppProviders isDark={false}>
          <PrivateQuery subject={subject} secondQuery={secondQuery} />
        </AppProviders>
      </AuthContext.Provider>
    );

    const { rerender } = render(view("A"));
    expect(await screen.findByText("A private data")).toBeInTheDocument();

    rerender(view("B"));
    expect(screen.queryByText("A private data")).not.toBeInTheDocument();

    resolveSecondQuery?.("B private data");
    await waitFor(() => expect(screen.getByText("B private data")).toBeInTheDocument());
  });
});

interface PrivateQueryProps {
  subject: string;
  secondQuery: Promise<string>;
}

function PrivateQuery({ subject, secondQuery }: PrivateQueryProps) {
  const { data } = useQuery({
    queryKey: ["private-query"],
    queryFn: () => (subject === "A" ? Promise.resolve("A private data") : secondQuery),
    staleTime: Infinity,
  });

  return <div>{data}</div>;
}

function auth(subject: string): AuthContextValue {
  return {
    isAuthenticated: true,
    isLoading: false,
    isConfigured: true,
    permissions: [],
    user: { subject },
    loginWithRedirect: vi.fn(() => Promise.resolve()),
    logout: vi.fn(() => Promise.resolve()),
    getAccessTokenSilently: vi.fn(() => Promise.resolve("token")),
  };
}
