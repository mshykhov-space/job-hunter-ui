import type { AxiosError } from "axios";

import type { ApiError } from "@/types";

export const formatApiError = (error: AxiosError<ApiError>): { title: string; detail: string } => {
  if (!error.response) {
    return { title: "Network Error", detail: "Cannot reach the server. Check your connection." };
  }
  const { status, data } = error.response;
  const message = data?.message ?? error.message;
  if (status === 403) return { title: "Access Denied", detail: message };
  if (status === 404) return { title: "Not Found", detail: message };
  if (status === 400) return { title: "Bad Request", detail: message };
  if (status >= 500) return { title: "Server Error", detail: message };
  return { title: `Error ${status}`, detail: message };
};
