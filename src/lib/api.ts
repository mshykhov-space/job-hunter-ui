import axios, { isAxiosError } from "axios";
export { isAxiosError };
import { API_URL } from "@/config/constants";
import { formatApiError } from "@/lib/apiErrors";
import { SessionChangedError, SessionExpiredError } from "@/lib/oidcSession";
import type { ApiError } from "@/types";

declare module "axios" {
  interface AxiosRequestConfig {
    skipErrorHandler?: boolean;
    _retried?: boolean;
    _authGeneration?: number;
  }
}

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

type ErrorHandler = (title: string, detail: string) => void;
type TokenGetter = () => Promise<string>;
type AuthErrorHandler = () => void;

let errorHandler: ErrorHandler | null = null;
let tokenGetter: TokenGetter | null = null;
let tokenRefresher: TokenGetter | null = null;
let authErrorHandler: AuthErrorHandler | null = null;
let authGeneration = 0;

export const registerErrorHandler = (handler: ErrorHandler) => {
  errorHandler = handler;
};

export const registerTokenGetter = (getter: TokenGetter) => {
  tokenGetter = getter;
  authGeneration++;
  return () => {
    if (tokenGetter === getter) {
      tokenGetter = null;
      authGeneration++;
    }
  };
};

export const registerTokenRefresher = (refresher: TokenGetter) => {
  tokenRefresher = refresher;
  refreshPromise = null;
  return () => {
    tokenRefresher = null;
  };
};

export const registerAuthErrorHandler = (handler: AuthErrorHandler) => {
  authErrorHandler = handler;
  return () => {
    authErrorHandler = null;
  };
};

api.interceptors.request.use(async (config) => {
  if (config._authGeneration !== undefined && config._authGeneration !== authGeneration) {
    throw new SessionChangedError();
  }
  if (tokenGetter && !config._retried) {
    const generation = authGeneration;
    const token = await tokenGetter();
    if (generation !== authGeneration) throw new SessionChangedError();
    config._authGeneration = generation;
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

const refreshTokenOnce = (previousCredential: unknown): Promise<string> | null => {
  if (!tokenRefresher) return null;
  if (!refreshPromise) {
    const refresher = tokenRefresher;
    const getter = tokenGetter;
    const pending = (async () => {
      const current = await getter?.();
      if (current && previousCredential !== `Bearer ${current}`) return current;
      return refresher();
    })().finally(() => {
      if (refreshPromise === pending) refreshPromise = null;
    });
    refreshPromise = pending;
  }
  return refreshPromise;
};

api.interceptors.response.use(
  (response) => {
    if (
      response.config._authGeneration !== undefined &&
      response.config._authGeneration !== authGeneration
    ) {
      return Promise.reject(new SessionChangedError());
    }
    return response;
  },
  async (error: unknown) => {
    if (error instanceof SessionChangedError) return Promise.reject(error);
    if (error instanceof SessionExpiredError) {
      authErrorHandler?.();
      return Promise.reject(error);
    }
    if (!isAxiosError<ApiError>(error)) {
      errorHandler?.(
        "Session Unavailable",
        "Cannot renew your session. Check your connection and try again."
      );
      return Promise.reject(error);
    }
    const originalRequest = error.config;
    const hadToken = !!originalRequest?.headers?.Authorization;
    if (
      originalRequest?._authGeneration !== undefined &&
      originalRequest._authGeneration !== authGeneration
    ) {
      return Promise.reject(new SessionChangedError());
    }

    if (
      error.response?.status === 401 &&
      hadToken &&
      originalRequest &&
      !originalRequest._retried
    ) {
      const pending = refreshTokenOnce(originalRequest.headers.Authorization);
      if (pending) {
        originalRequest._retried = true;
        try {
          const freshToken = await pending;
          if (originalRequest._authGeneration !== authGeneration) throw new SessionChangedError();
          originalRequest.headers.Authorization = `Bearer ${freshToken}`;
          return api(originalRequest);
        } catch (renewalError) {
          if (renewalError instanceof SessionExpiredError) {
            authErrorHandler?.();
          } else if (
            !(renewalError instanceof SessionChangedError) &&
            !originalRequest.skipErrorHandler
          ) {
            errorHandler?.(
              "Session Unavailable",
              "Cannot renew your session. Check your connection and try again."
            );
          }
          return Promise.reject(renewalError);
        }
      }
      authErrorHandler?.();
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && hadToken && originalRequest?._retried) {
      authErrorHandler?.();
      return Promise.reject(error);
    }

    if (!originalRequest?.skipErrorHandler && error.response?.status !== 401) {
      const { title, detail } = formatApiError(error);
      errorHandler?.(title, detail);
    }
    return Promise.reject(error);
  }
);

export { API_PATHS } from "@/config/apiPaths";
