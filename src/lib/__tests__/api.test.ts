import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const API_BASE = "http://localhost:8095";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());

describe("api interceptors", () => {
  let api: typeof import("../api");

  beforeEach(async () => {
    vi.resetModules();
    api = await import("../api");
    server.resetHandlers();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe("request interceptor — token attachment", () => {
    it("attaches Bearer token when tokenGetter is registered", async () => {
      let capturedAuth = "";
      server.use(
        http.get(`${API_BASE}/test`, ({ request }) => {
          capturedAuth = request.headers.get("authorization") ?? "";
          return HttpResponse.json({ ok: true });
        })
      );

      api.registerTokenGetter(() => Promise.resolve("my-token"));
      await api.api.get("/test");

      expect(capturedAuth).toBe("Bearer my-token");
    });

    it("does not send an authenticated request when token renewal is unavailable", async () => {
      let requests = 0;
      server.use(
        http.get(`${API_BASE}/test`, () => {
          requests++;
          return HttpResponse.json({ ok: true });
        })
      );

      api.registerTokenGetter(() => Promise.reject(new Error("expired")));
      await expect(api.api.get("/test")).rejects.toThrow("expired");

      expect(requests).toBe(0);
    });
  });

  describe("response interceptor — 401 retry", () => {
    it("retries with fresh token on 401", async () => {
      let callCount = 0;
      const credentials: (string | null)[] = [];
      server.use(
        http.get(`${API_BASE}/data`, ({ request }) => {
          credentials.push(request.headers.get("authorization"));
          callCount++;
          if (callCount === 1) return new HttpResponse(null, { status: 401 });
          return HttpResponse.json({ result: "ok" });
        })
      );

      api.registerTokenGetter(() => Promise.resolve("old-token"));
      api.registerTokenRefresher(() => Promise.resolve("fresh-token"));

      const response = await api.api.get("/data");

      expect(callCount).toBe(2);
      expect(credentials).toEqual(["Bearer old-token", "Bearer fresh-token"]);
      expect(response.data).toEqual({ result: "ok" });
    });

    it("does not retry more than once (prevents infinite loop)", async () => {
      let callCount = 0;
      server.use(
        http.get(`${API_BASE}/data`, () => {
          callCount++;
          return new HttpResponse(null, { status: 401 });
        })
      );

      const authHandler = vi.fn();
      api.registerTokenGetter(() => Promise.resolve("token"));
      api.registerTokenRefresher(() => Promise.resolve("fresh-token"));
      api.registerAuthErrorHandler(authHandler);

      await expect(api.api.get("/data")).rejects.toThrow();

      // First call + one retry = 2 total, then stops
      expect(callCount).toBe(2);
      expect(authHandler).toHaveBeenCalledOnce();
    });

    it("deduplicates concurrent refresh calls", async () => {
      let refreshCount = 0;
      let callCount = 0;

      server.use(
        http.get(`${API_BASE}/a`, () => {
          callCount++;
          if (callCount <= 2) return new HttpResponse(null, { status: 401 });
          return HttpResponse.json({ id: "a" });
        }),
        http.get(`${API_BASE}/b`, () => {
          callCount++;
          if (callCount <= 2) return new HttpResponse(null, { status: 401 });
          return HttpResponse.json({ id: "b" });
        })
      );

      api.registerTokenGetter(() => Promise.resolve("old-token"));
      api.registerTokenRefresher(() => {
        refreshCount++;
        return new Promise((resolve) => setTimeout(() => resolve("fresh-token"), 10));
      });

      const [resA, resB] = await Promise.all([api.api.get("/a"), api.api.get("/b")]);

      // Only ONE refresh call despite two concurrent 401s
      expect(refreshCount).toBe(1);
      expect(resA.data).toEqual({ id: "a" });
      expect(resB.data).toEqual({ id: "b" });
    });

    it("keeps the session when refresh fails temporarily", async () => {
      server.use(http.get(`${API_BASE}/data`, () => new HttpResponse(null, { status: 401 })));

      const authHandler = vi.fn();
      api.registerTokenGetter(() => Promise.resolve("token"));
      api.registerTokenRefresher(() => Promise.reject(new Error("refresh failed")));
      api.registerAuthErrorHandler(authHandler);

      await expect(api.api.get("/data")).rejects.toThrow();
      expect(authHandler).not.toHaveBeenCalled();
    });

    it("does not replay an old account's mutation with a new account's token", async () => {
      const credentials: (string | null)[] = [];
      let release: () => void = () => undefined;
      server.use(
        http.put(`${API_BASE}/preferences`, async ({ request }) => {
          credentials.push(request.headers.get("authorization"));
          if (credentials.length === 1) {
            await new Promise<void>((resolve) => {
              release = resolve;
            });
          }
          return new HttpResponse(null, { status: 401 });
        })
      );
      api.registerTokenGetter(() => Promise.resolve("account-a"));
      api.registerTokenRefresher(() => Promise.resolve("account-a-refreshed"));
      const result = api.api
        .put("/preferences", { about: "Account A" })
        .catch((error: unknown) => error);
      await vi.waitFor(() => expect(credentials).toHaveLength(1));
      api.registerTokenGetter(() => Promise.resolve("account-b"));
      api.registerTokenRefresher(() => Promise.resolve("account-b-refreshed"));
      release();

      expect(await result).toBeInstanceOf(Error);
      expect(credentials).toEqual(["Bearer account-a"]);
    });

    it("calls authErrorHandler when no refresher is registered", async () => {
      server.use(http.get(`${API_BASE}/data`, () => new HttpResponse(null, { status: 401 })));

      const authHandler = vi.fn();
      api.registerTokenGetter(() => Promise.resolve("token"));
      api.registerAuthErrorHandler(authHandler);

      await expect(api.api.get("/data")).rejects.toThrow();
      expect(authHandler).toHaveBeenCalledOnce();
    });

    it("does not trigger auth handler for requests without token", async () => {
      server.use(
        http.get(`${API_BASE}/public/data`, () => new HttpResponse(null, { status: 401 }))
      );

      const authHandler = vi.fn();
      api.registerAuthErrorHandler(authHandler);

      await expect(api.api.get("/public/data")).rejects.toThrow();
      expect(authHandler).not.toHaveBeenCalled();
    });
  });

  describe("response interceptor — error formatting", () => {
    it("calls error handler with formatted message for non-401 errors", async () => {
      server.use(
        http.get(`${API_BASE}/data`, () =>
          HttpResponse.json({ message: "Resource missing" }, { status: 404 })
        )
      );

      const errorHandler = vi.fn();
      api.registerErrorHandler(errorHandler);

      await expect(api.api.get("/data")).rejects.toThrow();
      expect(errorHandler).toHaveBeenCalledWith("Not Found", "Resource missing");
    });

    it("skips error handler when skipErrorHandler is set", async () => {
      server.use(http.get(`${API_BASE}/data`, () => new HttpResponse(null, { status: 500 })));

      const errorHandler = vi.fn();
      api.registerErrorHandler(errorHandler);

      await expect(api.api.get("/data", { skipErrorHandler: true })).rejects.toThrow();
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it("does not call error handler for 401 errors (handled by auth flow)", async () => {
      server.use(http.get(`${API_BASE}/data`, () => new HttpResponse(null, { status: 401 })));

      const errorHandler = vi.fn();
      api.registerErrorHandler(errorHandler);

      await expect(api.api.get("/data")).rejects.toThrow();
      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe("handler cleanup", () => {
    it("clears token getter on cleanup", async () => {
      let capturedAuth: string | null = null;
      server.use(
        http.get(`${API_BASE}/test`, ({ request }) => {
          capturedAuth = request.headers.get("authorization");
          return HttpResponse.json({ ok: true });
        })
      );

      const cleanup = api.registerTokenGetter(() => Promise.resolve("token"));
      cleanup();

      await api.api.get("/test");
      expect(capturedAuth).toBeNull();
    });
  });
});
