import { config } from "./config";
import { getToken, clearAuthData } from "./auth-storage";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Callback for handling 401 — set by AuthProvider
let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(callback: (() => void) | null) {
  onUnauthorized = callback;
}

/**
 * Typed fetch wrapper for the backend API.
 * Automatically attaches the auth token and handles JSON.
 * On 401, clears auth data and triggers re-authentication.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {} } = options;
  const token = await getToken();

  const url = `${config.apiBaseUrl}${path}`;
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    if (res.status === 401) {
      await clearAuthData();
      onUnauthorized?.();
    }
    const errorBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, errorBody.error || res.statusText);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),

  /**
   * Upload files via multipart/form-data.
   * Content-Type header is set automatically by fetch for FormData.
   */
  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const token = await getToken();
    const url = `${config.apiBaseUrl}${path}`;
    const headers: Record<string, string> = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!res.ok) {
      if (res.status === 401) {
        await clearAuthData();
        onUnauthorized?.();
      }
      const errorBody = await res.json().catch(() => ({ error: res.statusText }));
      throw new ApiError(res.status, errorBody.error || res.statusText);
    }

    return res.json() as Promise<T>;
  },
};

export { ApiError };
