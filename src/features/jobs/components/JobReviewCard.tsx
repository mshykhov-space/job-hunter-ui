import { useCallback, useEffect } from "react";

import {
  CloseOutlined,
  LeftOutlined,
  QuestionCircleOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { Button, Flex, Popover, Spin, Tooltip, Typography } from "antd";

import { useJobDetail } from "../hooks/useJobDetail";
import { useKeybindings } from "../hooks/useKeybindings";
import { matchShortcut } from "../keybindings";
import { hasModifier, isTypingTarget } from "../keyboard";
import type { JobGroup, UserJobStatus } from "../types";
import { USER_JOB_STATUS } from "../types";
import { JobDetailContent } from "./JobDetailContent";
import { ShortcutsHelp } from "./ShortcutsHelp";

interface JobReviewCardProps {
  job: JobGroup;
  currentIndex: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onOpenPrimary: (job: JobGroup) => void;
  onStatusChange: (groupId: string, status: UserJobStatus) => void;
  statusLoading: boolean;
  loading?: boolean;
}

export const JobReviewCard = ({
  job,
  currentIndex,
  total,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
  onOpenPrimary,
  onStatusChange,
  statusLoading,
  loading,
}: JobReviewCardProps) => {
  const { data: detail, isLoading: detailLoading } = useJobDetail(job.groupId);
  const { keyLabel } = useKeybindings();

  const handleApply = useCallback(() => {
    if (!statusLoading && job.status !== USER_JOB_STATUS.APPLIED) {
      onStatusChange(job.groupId, USER_JOB_STATUS.APPLIED);
    }
  }, [job, onStatusChange, statusLoading]);

  const handleDecline = useCallback(() => {
    if (!statusLoading && job.status !== USER_JOB_STATUS.IRRELEVANT) {
      onStatusChange(job.groupId, USER_JOB_STATUS.IRRELEVANT);
    }
  }, [job, onStatusChange, statusLoading]);

  const handleReset = useCallback(() => {
    if (!statusLoading && job.status !== USER_JOB_STATUS.NEW) {
      onStatusChange(job.groupId, USER_JOB_STATUS.NEW);
    }
  }, [job, onStatusChange, statusLoading]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (hasModifier(e) || isTypingTarget(e.target)) return;

      const action = matchShortcut(e.code);
      if (action === "markApplied") {
        e.preventDefault();
        handleApply();
      } else if (action === "markIrrelevant") {
        e.preventDefault();
        handleDecline();
      } else if (action === "resetStatus") {
        e.preventDefault();
        handleReset();
      } else if (action === "openOriginal") {
        e.preventDefault();
        onOpenPrimary(job);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleApply, handleDecline, handleReset, onOpenPrimary, job]);

  return (
    <Flex vertical className="review-card">
      <Flex justify="space-between" align="center" className="review-card-header">
        <Flex align="center" gap={8}>
          <Tooltip title={`Previous (${keyLabel("prevJob")} / ←)`}>
            <Button
              type="text"
              size="small"
              icon={<LeftOutlined />}
              disabled={!hasPrev}
              onClick={onPrev}
            />
          </Tooltip>
          <Typography.Text
            type="secondary"
            style={{ fontSize: 13, minWidth: 50, textAlign: "center" }}
          >
            {currentIndex + 1} / {total}
          </Typography.Text>
          <Tooltip title={`Next (${keyLabel("nextJob")} / →)`}>
            <Button
              type="text"
              size="small"
              icon={<RightOutlined />}
              disabled={!hasNext}
              onClick={onNext}
            />
          </Tooltip>
        </Flex>

        <Flex align="center" gap={4}>
          <Popover content={<ShortcutsHelp />} trigger="click" placement="bottomRight">
            <Button type="text" size="small" icon={<QuestionCircleOutlined />} />
          </Popover>
          <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
        </Flex>
      </Flex>

      <Spin spinning={!!loading}>
        <div className="review-card-body">
          <JobDetailContent
            job={job}
            detail={detail}
            detailLoading={detailLoading}
            onStatusChange={onStatusChange}
            statusLoading={statusLoading}
          />
        </div>
      </Spin>
    </Flex>
  );
};
