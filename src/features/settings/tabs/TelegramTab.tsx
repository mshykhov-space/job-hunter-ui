import { useCallback, useEffect, useState } from "react";

import { Card, Checkbox, Flex, Input, Skeleton, Switch, Typography } from "antd";

import { useJobSources } from "@/features/jobs/hooks/useJobSources";

import { PreferencesLoadError } from "../components/PreferencesLoadError";
import { SaveBar } from "../components/SaveBar";
import { useDirtyForm } from "../hooks/useDirtyForm";
import { usePreferences, useSaveTelegramPreferences } from "../hooks/usePreferences";
import type { TelegramPreferences } from "../types";
import { EMPTY_PREFERENCES } from "../types";

export const TelegramTab = () => {
  const { data: preferences, isLoading, isError, isFetching, refetch } = usePreferences();
  const { data: sources = [] } = useJobSources();
  const saveMutation = useSaveTelegramPreferences();
  const [saved, setSaved] = useState(false);

  const initial = preferences?.telegram ?? EMPTY_PREFERENCES.telegram;
  const { form, setForm, isDirty, reset } = useDirtyForm<TelegramPreferences>(initial);

  const update = useCallback(
    <K extends keyof TelegramPreferences>(key: K, value: TelegramPreferences[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [setForm]
  );

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;
  if (isError || !preferences) {
    return <PreferencesLoadError retrying={isFetching} onRetry={() => void refetch()} />;
  }

  return (
    <Flex vertical gap={16}>
      <Card size="small" title="Bot Connection">
        <Flex vertical gap={12}>
          <Flex vertical gap={4}>
            <Typography.Text strong style={{ fontSize: 13 }}>
              Chat ID
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Your Telegram chat ID for receiving notifications
            </Typography.Text>
            <Input
              placeholder="e.g. 123456789"
              value={form.chatId ?? ""}
              onChange={(e) => update("chatId", e.target.value || null)}
              style={{ maxWidth: 280 }}
            />
          </Flex>
          <Flex vertical gap={4}>
            <Typography.Text strong style={{ fontSize: 13 }}>
              Username
            </Typography.Text>
            <Input
              placeholder="e.g. myuser"
              value={form.username ?? ""}
              onChange={(e) => update("username", e.target.value || null)}
              style={{ maxWidth: 280 }}
            />
          </Flex>
        </Flex>
      </Card>
      <Card size="small" title="Notifications">
        <Flex vertical gap={12}>
          <Flex align="center" gap={8}>
            <Switch
              checked={form.notificationsEnabled}
              onChange={(v) => update("notificationsEnabled", v)}
            />
            <Typography.Text>Enable notifications</Typography.Text>
          </Flex>
          {form.notificationsEnabled && (
            <Flex vertical gap={4}>
              <Typography.Text strong style={{ fontSize: 13 }}>
                Notification Sources
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Receive notifications only from selected sources. Leave empty for all.
              </Typography.Text>
              <Checkbox.Group
                value={form.notificationSources}
                onChange={(v) => update("notificationSources", v as string[])}
                options={sources.map((s) => ({ label: s.displayName, value: s.id }))}
              />
            </Flex>
          )}
        </Flex>
      </Card>
      <SaveBar
        isDirty={isDirty}
        saved={saved}
        saving={saveMutation.isPending}
        onSave={() => saveMutation.mutate(form, { onSuccess: () => setSaved(true) })}
        onDiscard={reset}
      />
    </Flex>
  );
};
