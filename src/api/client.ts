/**
 * The one place the app makes an HTTP request.
 *
 * Rules this enforces, from docs/MOBILE_APP_SPEC.md and web/CLAUDE.md:
 *   - `Authorization: Bearer <supabase access token>` is attached whenever a
 *     session exists (§5.3 / D3). The web helper
 *     `getCurrentAccountFromRequest()` treats a Bearer header that fails to
 *     verify as an auth failure, never a fall-through, so we send it only when
 *     we actually have one.
 *   - Every request is a billed Vercel invocation. Callers must not poll
 *     without a bound; see `pollUntil` in src/api/scan.ts.
 *   - Responses are parsed through zod schemas mirrored from the web routes,
 *     so a shape change surfaces here rather than as a blank screen.
 */
import { z } from "zod";
import { API_BASE } from "./config";
import { describeErrorBody } from "./contracts";
import { getAccessToken } from "./supabase";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly body: unknown;

  constructor(status: number, message: string, code: string | null, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

export type RequestOptions<T> = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** JSON body. The scan route requires the address here, never in the URL. */
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  schema: z.ZodType<T>;
  /** "required" throws before the request when there is no session. */
  auth?: "none" | "optional" | "required";
  /**
   * Extra request headers. Added for `X-Request-Edit-Token`, the capability an
   * anonymous requester holds instead of a session (see src/api/requests.ts).
   * Never a place for the Supabase token — that is `auth` above, so there is
   * one code path that attaches it.
   */
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 30_000;

export async function apiRequest<T>(path: string, options: RequestOptions<T>): Promise<T> {
  const { method = "GET", body, query, schema, auth = "optional", signal } = options;

  const url = new URL(path.startsWith("http") ? path : `${API_BASE}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth !== "none") {
    const token = await getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else if (auth === "required") {
      throw new ApiError(401, "Sign in to do that.", "not_signed_in", null);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    throw new ApiError(0, err instanceof Error ? err.message : "Network request failed", "network", null);
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    // Failure bodies are {error, message?, ...}; `error` is often a machine
    // code, so the sentence comes from describeErrorBody, not the raw field.
    const { code, message } = describeErrorBody(response.status, payload);
    throw new ApiError(response.status, message, code, payload);
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ApiError(
      response.status,
      `Unexpected response shape from ${path}: ${result.error.issues[0]?.message ?? "invalid"}`,
      "schema_mismatch",
      payload,
    );
  }
  return result.data;
}
