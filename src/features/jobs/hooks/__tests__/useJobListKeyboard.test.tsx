import { fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useJobListKeyboard } from "../useJobListKeyboard";

describe("useJobListKeyboard", () => {
  it("ignores status shortcuts while a status update is pending", () => {
    const onStatus = vi.fn();
    const { rerender } = renderHook(
      ({ statusPending }) =>
        useJobListKeyboard({
          count: 1,
          enabled: true,
          hasNextPage: false,
          statusPending,
          onOpen: vi.fn(),
          onOpenPrimary: vi.fn(),
          onStatus,
          onLoadMore: vi.fn(),
        }),
      { initialProps: { statusPending: true } }
    );

    fireEvent.keyDown(document, { code: "KeyA" });
    expect(onStatus).not.toHaveBeenCalled();

    rerender({ statusPending: false });
    fireEvent.keyDown(document, { code: "KeyA" });
    expect(onStatus).toHaveBeenCalledOnce();
  });
});
