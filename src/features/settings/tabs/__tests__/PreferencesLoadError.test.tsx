import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { JobPreferencesTab } from "../JobPreferencesTab";
import { TelegramTab } from "../TelegramTab";

const { refetch } = vi.hoisted(() => ({ refetch: vi.fn() }));

vi.mock("../../hooks/usePreferences", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/usePreferences")>()),
  usePreferences: () => ({
    data: undefined,
    isLoading: false,
    isError: true,
    isFetching: false,
    refetch,
  }),
}));

vi.mock("@/features/jobs/hooks/useJobSources", () => ({
  useJobSources: () => ({ data: [] }),
}));

describe("settings preference loading errors", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  beforeEach(() => refetch.mockReset());

  it.each([
    ["job preferences", <JobPreferencesTab />, "Search Criteria"],
    ["Telegram", <TelegramTab />, "Bot Connection"],
  ])("blocks %s editing and offers retry", (_name, tab, editableHeading) => {
    renderWithQuery(tab);

    expect(screen.getByText("Preferences unavailable")).toBeInTheDocument();
    expect(screen.queryByText(editableHeading)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});

function renderWithQuery(children: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}
