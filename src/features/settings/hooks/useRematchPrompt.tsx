import { useCallback } from "react";

import { App, Flex } from "antd";

import { useRematch } from "@/features/jobs/hooks/useRematch";
import { PERMISSIONS, useAuth } from "@/hooks/useAuth";

const REMATCH_OPTIONS = [
  { value: "6", label: "Last 6 hours" },
  { value: "12", label: "Last 12 hours" },
  { value: "24", label: "Last 24 hours" },
  { value: "48", label: "Last 2 days" },
  { value: "72", label: "Last 3 days" },
];

/** Offers a re-match after preferences change, letting the user pick a window. */
export const useRematchPrompt = () => {
  const { modal } = App.useApp();
  const rematchMutation = useRematch();
  const { isConfigured, permissions } = useAuth();

  return useCallback(() => {
    if (isConfigured && !permissions.includes(PERMISSIONS.MANAGE_JOBS)) return;
    let hours = 12;
    modal.confirm({
      title: "Re-match jobs?",
      content: (
        <Flex vertical gap={8}>
          <span>Your preferences have changed. Re-match jobs with the updated settings?</span>
          <Flex align="center" gap={8}>
            <span>Period:</span>
            <select
              defaultValue="12"
              onChange={(e) => {
                hours = Number(e.target.value);
              }}
              style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d9d9d9" }}
            >
              {REMATCH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Flex>
        </Flex>
      ),
      okText: "Rematch",
      cancelText: "Skip",
      onOk: () => {
        const since = new Date(Date.now() - hours * 3_600_000).toISOString();
        rematchMutation.mutate(since);
      },
    });
  }, [modal, rematchMutation, isConfigured, permissions]);
};
