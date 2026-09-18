import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { JobGroup, UserJobStatus } from "../../types";
import { JobReviewCard } from "../JobReviewCard";

vi.mock("../../hooks/useJobDetail", () => ({
  useJobDetail: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("../../hooks/useKeybindings", () => ({
  useKeybindings: () => ({ keyLabel: () => "" }),
}));

vi.mock("../JobDetailContent", () => ({ JobDetailContent: () => null }));
vi.mock("../ShortcutsHelp", () => ({ ShortcutsHelp: () => null }));

describe("JobReviewCard", () => {
  it("ignores status shortcuts while a status update is pending", () => {
    const onStatusChange = vi.fn();
    const { rerender } = render(card(true, onStatusChange));

    fireEvent.keyDown(document, { code: "KeyA" });
    expect(onStatusChange).not.toHaveBeenCalled();

    rerender(card(false, onStatusChange));
    fireEvent.keyDown(document, { code: "KeyA" });
    expect(onStatusChange).toHaveBeenCalledOnce();
  });
});

function card(
  statusLoading: boolean,
  onStatusChange: (groupId: string, status: UserJobStatus) => void
) {
  return (
    <JobReviewCard
      job={JOB}
      currentIndex={0}
      total={1}
      hasPrev={false}
      hasNext={false}
      onPrev={vi.fn()}
      onNext={vi.fn()}
      onClose={vi.fn()}
      onOpenPrimary={vi.fn()}
      onStatusChange={onStatusChange}
      statusLoading={statusLoading}
    />
  );
}

const JOB: JobGroup = {
  id: "user-job-group",
  groupId: "job-group",
  title: "Kotlin developer",
  company: "Example",
  sources: ["EXAMPLE"],
  locations: ["Remote"],
  salary: null,
  remote: true,
  status: "new",
  aiRelevanceScore: 90,
  jobCount: 1,
  publishedAt: null,
  matchedAt: null,
  createdAt: null,
  updatedAt: null,
};
