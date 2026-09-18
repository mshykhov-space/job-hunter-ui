import { useMemo } from "react";

import { Flex, Typography } from "antd";

import { JobReviewCard } from "@/features/jobs/components/JobReviewCard";
import { useJobFilters } from "@/features/jobs/hooks/useJobFilters";
import { useJobListKeyboard } from "@/features/jobs/hooks/useJobListKeyboard";
import { useJobs } from "@/features/jobs/hooks/useJobs";
import { useJobStatus } from "@/features/jobs/hooks/useJobStatus";
import { useRematch } from "@/features/jobs/hooks/useRematch";
import { useReviewMode } from "@/features/jobs/hooks/useReviewMode";
import { DEFAULT_MATCHED_RANGE } from "@/features/jobs/timeRange";
import type { JobGroup, UserJobStatus } from "@/features/jobs/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { useOpenPrimaryJob } from "../hooks/useOpenPrimaryJob";
import { JobFilters } from "./JobFilters";
import { JobList } from "./JobList";
import { JobsToolbar } from "./JobsToolbar";

const REFRESH_INTERVAL = 60_000;

export const JobsPage = () => {
  const { filters, setFilters } = useJobFilters();
  const debouncedFilters = useDebouncedValue(filters, 300);

  const jobsFilters = useMemo(
    () => ({
      ...debouncedFilters,
      matchedAfter: undefined,
      matchedWithin: debouncedFilters.matchedWithin ?? DEFAULT_MATCHED_RANGE,
    }),
    [debouncedFilters]
  );

  const {
    jobs,
    statusCounts,
    totalElements,
    isLoading,
    isFetching,
    isPlaceholderData,
    refetch,
    dataUpdatedAt,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useJobs(jobsFilters, REFRESH_INTERVAL);

  const statusMutation = useJobStatus();
  const rematchMutation = useRematch();
  const reviewMode = useReviewMode();
  const openPrimary = useOpenPrimaryJob();

  const handleEnterReview = (job: JobGroup) => {
    if (jobs.length > 0) {
      const pagesLoaded = Math.ceil(jobs.length / (jobsFilters.size ?? 50));
      reviewMode.enter(jobs, job, totalElements, jobsFilters, !!hasNextPage, pagesLoaded);
    }
  };

  const handleStatusChange = (groupId: string, status: UserJobStatus) => {
    if (statusMutation.isPending) return;
    statusMutation.mutate(
      { groupId, status },
      {
        onSuccess: (updated) => {
          if (reviewMode.isActive) reviewMode.advanceWithUpdate(updated);
        },
      }
    );
  };

  const { selected } = useJobListKeyboard({
    count: jobs.length,
    enabled: !reviewMode.isActive,
    hasNextPage: !!hasNextPage,
    statusPending: statusMutation.isPending,
    onOpen: (i) => handleEnterReview(jobs[i]),
    onOpenPrimary: (i) => openPrimary(jobs[i]),
    onStatus: (i, status) => handleStatusChange(jobs[i].groupId, status),
    onLoadMore: () => fetchNextPage(),
  });

  if (reviewMode.isActive && reviewMode.currentJob) {
    return (
      <Flex vertical gap={16}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Jobs
        </Typography.Title>
        <JobReviewCard
          job={reviewMode.currentJob}
          currentIndex={reviewMode.currentIndex}
          total={reviewMode.total}
          hasPrev={reviewMode.hasPrev}
          hasNext={reviewMode.hasNext}
          onPrev={reviewMode.goPrev}
          onNext={reviewMode.goNext}
          onClose={reviewMode.exit}
          onOpenPrimary={openPrimary}
          onStatusChange={handleStatusChange}
          statusLoading={statusMutation.isPending}
          loading={reviewMode.isPageLoading}
        />
      </Flex>
    );
  }

  return (
    <Flex vertical gap={16}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Jobs
      </Typography.Title>
      <div className="jobs-sticky">
        <JobFilters filters={filters} onChange={setFilters} statusCounts={statusCounts} />
        <JobsToolbar
          total={totalElements}
          isFetching={isFetching}
          dataUpdatedAt={dataUpdatedAt}
          onRefresh={() => refetch()}
          onRematch={(since) => rematchMutation.mutate(since)}
          rematchLoading={rematchMutation.isPending}
          onReview={() => handleEnterReview(jobs[0])}
          reviewDisabled={jobs.length === 0}
        />
      </div>
      <div className="placeholder-fade" data-placeholder={isPlaceholderData}>
        <JobList
          jobs={jobs}
          loading={isLoading}
          statusPending={statusMutation.isPending}
          selectedIndex={selected}
          onSelect={handleEnterReview}
          onOpenPrimary={openPrimary}
          onStatusChange={handleStatusChange}
          hasNextPage={!!hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={() => fetchNextPage()}
        />
      </div>
    </Flex>
  );
};
