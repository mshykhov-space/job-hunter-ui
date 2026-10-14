import { createContext, useContext } from "react";

export const PERMISSIONS = {
  READ_JOBS: "read:jobs",
  WRITE_JOBS: "write:jobs",
  MANAGE_JOBS: "manage:jobs",
  READ_PREFERENCES: "read:preferences",
  WRITE_PREFERENCES: "write:preferences",
  READ_AUTOMATION: "read:automation",
  WRITE_AUTOMATION: "write:automation",
} as const;

export interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  permissions: string[];
  user?: { subject?: string; email?: string; name?: string; picture?: string };
  loginWithRedirect: () => Promise<void>;
  logout: (options?: { logoutParams?: { returnTo?: string } }) => Promise<void>;
  invalidateSession?: () => Promise<void>;
  getAccessTokenSilently: (options?: {
    cacheMode?: "on" | "off" | "cache-only";
  }) => Promise<string>;
}

export const noopAuth: AuthContextValue = {
  isAuthenticated: false,
  isLoading: false,
  isConfigured: false,
  permissions: [],
  loginWithRedirect: () => Promise.resolve(),
  logout: () => Promise.resolve(),
  getAccessTokenSilently: () => Promise.reject(new Error("OIDC not configured")),
};

export const AuthContext = createContext<AuthContextValue>(noopAuth);

export const useAuth = () => useContext(AuthContext);
