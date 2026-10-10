import type { Env } from "./types";

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  request_id?: string;
}

export function json(data: unknown, status = 200, error: ApiError | null = null, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify({ data, error }), { status, headers });
}

export function failure(status: number, code: string, message: string, details?: unknown, requestId?: string): Response {
  return json(null, status, { code, message, ...(details === undefined ? {} : { details }), ...(requestId ? { request_id: requestId } : {}) });
}

export async function readJson(request: Request): Promise<{ value?: unknown; response?: Response }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { response: failure(400, "INVALID_CONTENT_TYPE", "Content-Type must be application/json.") };
  }
  try {
    return { value: await request.json() };
  } catch {
    return { response: failure(400, "INVALID_JSON", "Request body is not valid JSON.") };
  }
}

function suppliedBearer(request: Request): string | undefined {
  const value = request.headers.get("authorization");
  if (!value?.startsWith("Bearer ")) return undefined;
  return value.slice(7);
}

export function requireApiKey(request: Request, env: Env): Response | null {
  if (!env.API_KEY) {
    if (env.ENVIRONMENT === "production") return failure(503, "SERVER_MISCONFIGURED", "Mutation authentication is not configured.");
    return null;
  }
  if (suppliedBearer(request) !== env.API_KEY) {
    return failure(401, "UNAUTHORIZED", "A valid Bearer API key is required.", undefined, request.headers.get("cf-ray") ?? undefined);
  }
  return null;
}

export function requireVapiSecret(request: Request, env: Env): Response | null {
  if (!env.VAPI_WEBHOOK_SECRET) {
    if (env.ENVIRONMENT === "production") return failure(503, "SERVER_MISCONFIGURED", "Vapi webhook authentication is not configured.");
    return null;
  }
  if (suppliedBearer(request) !== env.VAPI_WEBHOOK_SECRET) return failure(401, "UNAUTHORIZED", "Invalid Vapi webhook credential.");
  return null;
}

export function withSecurityHeaders(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "no-referrer");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  headers.set("content-security-policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");

  const origin = request.headers.get("origin");
  if (origin && env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function optionsResponse(request: Request, env: Env): Response {
  const origin = request.headers.get("origin");
  if (!origin || !env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
      "access-control-allow-headers": "Authorization, Content-Type, Idempotency-Key",
      "access-control-max-age": "86400",
      vary: "Origin",
    },
  });
}
