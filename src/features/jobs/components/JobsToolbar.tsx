import { useState } from "react";

import {
  QuestionCircleOutlined,
  ReadOutlined,
  ReloadOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { Button, Flex, Popover, Radio, Tooltip, Typography } from "antd";

import { PERMISSIONS, useAuth } from "@/hooks/useAuth";

import { ShortcutsHelp } from "./ShortcutsHelp";

interface JobsToolbarProps {
  total: number;
  isFetching: boolean;
  dataUpdatedAt: number;
  onRefresh: () => void;
  onRematch: (since?: string) => void;
  rematchLoading: boolean;
  onReview: () => void;
  reviewDisabled: boolean;
}

type RematchPeriod = "12h" | "24h" | "3d";

const PERIOD_LABELS: Record<RematchPeriod, string> = {
  "12h": "Last 12 hours",
  "24h": "Last 24 hours",
  "3d": "Last 3 days",
};

const PERIOD_MS: Record<RematchPeriod, number> = {
  "12h": 12 * 3_600_000,
  "24h": 24 * 3_600_000,
  "3d": 3 * 24 * 3_600_000,
};

const periodToSince = (period: RematchPeriod): string =>
  new Date(Date.now() - PERIOD_MS[period]).toISOString();

export const JobsToolbar = ({
  total,
  isFetching,
  dataUpdatedAt,
  onRefresh,
  onRematch,
  rematchLoading,
  onReview,
  reviewDisabled,
}: JobsToolbarProps) => {
  const [rematchOpen, setRematchOpen] = useState(false);
  const [period, setPeriod] = useState<RematchPeriod>("24h");
  const { isConfigured, permissions } = useAuth();
  const canRematch = !isConfigured || permissions.includes(PERMISSIONS.MANAGE_JOBS);
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : null;

  const handleRematch = () => {
    setRematchOpen(false);
    onRematch(periodToSince(period));
  };

  const rematchContent = (
    <Flex vertical gap={12} style={{ width: 200 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Re-run AI matching for jobs matched within:
      </Typography.Text>
      <Radio.Group
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
        style={{ display: "flex", flexDirection: "column", gap: 4 }}
      >
        {(Object.keys(PERIOD_LABELS) as RematchPeriod[]).map((key) => (
          <Radio key={key} value={key}>
            {PERIOD_LABELS[key]}
          </Radio>
        ))}
      </Radio.Group>
      <Button type="primary" size="small" block onClick={handleRematch} loading={rematchLoading}>
        Rematch
      </Button>
    </Flex>
  );

  return (
    <Flex justify="space-between" align="center" className="jobs-toolbar">
      <Typography.Text type="secondary" className="jobs-toolbar-count">
        {total} jobs{lastUpdated && ` · updated ${lastUpdated}`}
      </Typography.Text>
      <Flex align="center" gap={4}>
        <Popover content={<ShortcutsHelp />} trigger="click" placement="bottomRight">
          <Tooltip title="Keyboard shortcuts">
            <Button type="text" icon={<QuestionCircleOutlined />} />
          </Tooltip>
        </Popover>
        <Button type="text" icon={<ReadOutlined />} onClick={onReview} disabled={reviewDisabled}>
          Review
        </Button>
        {canRematch && (
          <Popover
            content={rematchContent}
            trigger="click"
            open={rematchOpen}
            onOpenChange={setRematchOpen}
            placement="bottomRight"
          >
            <Tooltip title="Re-match jobs for all users">
              <Button
                type="text"
                aria-label="Re-match jobs for all users"
                icon={<SyncOutlined spin={rematchLoading} />}
              />
            </Tooltip>
          </Popover>
        )}
        <Tooltip title="Refresh">
          <Button type="text" icon={<ReloadOutlined spin={isFetching} />} onClick={onRefresh} />
        </Tooltip>
      </Flex>
    </Flex>
  );
};
