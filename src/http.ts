import type { Env } from "./types";

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  request_id?: string;
}

const DEFAULT_JSON_LIMIT = 64 * 1024;

export function json(data: unknown, status = 200, error: ApiError | null = null, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify({ data, error }), { status, headers });
}

export function failure(status: number, code: string, message: string, details?: unknown, requestId?: string): Response {
  return json(null, status, { code, message, ...(details === undefined ? {} : { details }), ...(requestId ? { request_id: requestId } : {}) });
}

async function readBodyWithLimit(request: Request, maxBytes: number): Promise<string | Response> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isFinite(parsedLength) || parsedLength < 0) return failure(400, "INVALID_CONTENT_LENGTH", "Content-Length is invalid.");
    if (parsedLength > maxBytes) return failure(413, "PAYLOAD_TOO_LARGE", `JSON request bodies cannot exceed ${maxBytes} bytes.`);
  }

  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel("payload too large");
      return failure(413, "PAYLOAD_TOO_LARGE", `JSON request bodies cannot exceed ${maxBytes} bytes.`);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export async function readJson(request: Request, maxBytes = DEFAULT_JSON_LIMIT): Promise<{ value?: unknown; response?: Response }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json(?:\s*;|\s*$)/i.test(contentType)) {
    return { response: failure(400, "INVALID_CONTENT_TYPE", "Content-Type must be application/json.") };
  }
  try {
    const body = await readBodyWithLimit(request, maxBytes);
    if (body instanceof Response) return { response: body };
    if (!body.trim()) return { response: failure(400, "INVALID_JSON", "Request body is not valid JSON.") };
    return { value: JSON.parse(body) as unknown };
  } catch {
    return { response: failure(400, "INVALID_JSON", "Request body is not valid UTF-8 JSON.") };
  }
}

function suppliedBearer(request: Request): string | undefined {
  const value = request.headers.get("authorization");
  const match = value?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) return undefined;
  const token = match[1];
  return token && !/\s/.test(token) ? token : undefined;
}

function constantTimeEqual(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  let difference = actual.length ^ expected.length;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ (actual.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function unauthorized(message: string, realm: string, requestId?: string): Response {
  const response = failure(401, "UNAUTHORIZED", message, undefined, requestId);
  response.headers.set("www-authenticate", `Bearer realm="${realm}"`);
  return response;
}

export function requireApiKey(request: Request, env: Env): Response | null {
  if (!env.API_KEY) {
    if (env.ENVIRONMENT === "production") return failure(503, "SERVER_MISCONFIGURED", "API authentication is not configured.");
    return null;
  }
  if (!constantTimeEqual(suppliedBearer(request), env.API_KEY)) {
    return unauthorized("A valid Bearer API key is required.", "carecloud-api", request.headers.get("cf-ray") ?? undefined);
  }
  return null;
}

export function requireVapiSecret(request: Request, env: Env): Response | null {
  if (!env.VAPI_WEBHOOK_SECRET) {
    if (env.ENVIRONMENT === "production") return failure(503, "SERVER_MISCONFIGURED", "Vapi webhook authentication is not configured.");
    return null;
  }
  if (!constantTimeEqual(suppliedBearer(request), env.VAPI_WEBHOOK_SECRET)) {
    return unauthorized("Invalid Vapi webhook credential.", "carecloud-vapi");
  }
  return null;
}

export function withSecurityHeaders(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers);
  const nonce = headers.get("x-content-security-nonce");
  headers.delete("x-content-security-nonce");
  const scriptSource = nonce ? `'self' 'nonce-${nonce}'` : "'self'";
  const styleSource = nonce ? `'self' 'nonce-${nonce}'` : "'self'";

  headers.set("cache-control", "no-store, max-age=0");
  headers.set("pragma", "no-cache");
  if (new URL(request.url).protocol === "https:") headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("x-permitted-cross-domain-policies", "none");
  headers.set("x-robots-tag", "noindex, nofollow");
  headers.set("referrer-policy", "no-referrer");
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set("cross-origin-resource-policy", "same-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("content-security-policy", `default-src 'none'; style-src ${styleSource}; script-src ${scriptSource}; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'`);

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