import { Alert, Button } from "antd";

interface PreferencesLoadErrorProps {
  retrying: boolean;
  onRetry: () => void;
}

export const PreferencesLoadError = ({ retrying, onRetry }: PreferencesLoadErrorProps) => (
  <Alert
    type="error"
    showIcon
    title="Preferences unavailable"
    description="Your saved preferences could not be loaded. Retry before making changes."
    action={
      <Button size="small" loading={retrying} onClick={onRetry}>
        Retry
      </Button>
    }
  />
);
