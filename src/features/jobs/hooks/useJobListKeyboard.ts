import { useEffect, useRef, useState } from "react";

import { matchShortcut } from "../keybindings";
import { hasModifier, isTypingTarget, STATUS_ACTIONS } from "../keyboard";
import type { UserJobStatus } from "../types";

interface UseJobListKeyboardArgs {
  count: number;
  enabled: boolean;
  hasNextPage: boolean;
  statusPending: boolean;
  onOpen: (index: number) => void;
  onOpenPrimary: (index: number) => void;
  onStatus: (index: number, status: UserJobStatus) => void;
  onLoadMore: () => void;
}

const PREFETCH_THRESHOLD = 5;

export const useJobListKeyboard = (args: UseJobListKeyboardArgs) => {
  const [selected, setSelected] = useState(-1);
  // Keep an active row cursor whenever the list has data, so the shortcuts work
  // immediately (and are discoverable) without arrowing down first.
  const clamped = args.count === 0 ? -1 : Math.min(Math.max(selected, 0), args.count - 1);
  const stateRef = useRef(args);
  const selectedRef = useRef(clamped);

  useEffect(() => {
    stateRef.current = args;
    selectedRef.current = clamped;
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const {
        count,
        enabled,
        hasNextPage,
        statusPending,
        onOpen,
        onOpenPrimary,
        onStatus,
        onLoadMore,
      } = stateRef.current;
      if (!enabled || count === 0 || hasModifier(e) || isTypingTarget(e.target)) return;
      const current = selectedRef.current;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(count - 1, current + 1);
        setSelected(next);
        if (next >= count - PREFETCH_THRESHOLD && hasNextPage) onLoadMore();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected(current <= 0 ? 0 : current - 1);
      } else if (e.key === "Enter" && current >= 0) {
        e.preventDefault();
        onOpen(current);
      } else if (e.key === "Escape") {
        setSelected(-1);
      } else if (current >= 0) {
        const action = matchShortcut(e.code);
        if (!action) return;
        const status = STATUS_ACTIONS[action];
        if (status && !statusPending) {
          e.preventDefault();
          onStatus(current, status);
        } else if (action === "openOriginal") {
          e.preventDefault();
          onOpenPrimary(current);
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return { selected: clamped, setSelected };
};
