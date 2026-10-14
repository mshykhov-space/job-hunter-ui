import { type ReactNode, useEffect, useMemo } from "react";
import { BrowserRouter } from "react-router-dom";

import { QueryClientProvider } from "@tanstack/react-query";
import { App, ConfigProvider } from "antd";

import { ApiErrorHandler } from "@/components/ApiErrorHandler";
import { useAuth } from "@/hooks/useAuth";
import { createQueryClient } from "@/lib/queryClient";
import { darkTheme, lightTheme } from "@/styles/theme";

interface AppProvidersProps {
  children: ReactNode;
  isDark: boolean;
}

export const AppProviders = ({ children, isDark }: AppProvidersProps) => {
  const { user } = useAuth();
  const subject = user?.subject;
  const queryClient = useMemo(() => createQueryClient(subject), [subject]);
  useEffect(() => () => queryClient.clear(), [queryClient]);
  return (
    <QueryClientProvider key={subject ?? "anonymous"} client={queryClient}>
      <ConfigProvider theme={isDark ? darkTheme : lightTheme}>
        <App>
          <ApiErrorHandler />
          <BrowserRouter>{children}</BrowserRouter>
        </App>
      </ConfigProvider>
    </QueryClientProvider>
  );
};
