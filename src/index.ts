import { dashboardHtml } from "./dashboard";
import { docsHtml, openApiDocument } from "./openapi";
import {
  createPatient,
  DuplicatePatientError,
  getPatient,
  IdempotencyConflictError,
  listCallSessions,
  listPatients,
  softDeletePatient,
  toPublicPatient,
  updatePatient,
} from "./patients";
import type { Env } from "./types";
import { isUuid, normalizeUsPhone, parseDateOfBirth, validatePatient, validatePatientPatch } from "./validation";
import { failure, json, optionsResponse, readJson, requireApiKey, withSecurityHeaders } from "./http";
import { handleVapiWebhook } from "./vapi";

function methodNotAllowed(allow: string): Response {
  const response = failure(405, "METHOD_NOT_ALLOWED", "The HTTP method is not supported for this route.");
  response.headers.set("allow", allow);
  return response;
}

function conflictResponse(error: unknown): Response | null {
  if (error instanceof DuplicatePatientError) {
    return failure(409, "DUPLICATE_PATIENT", "An active patient already uses that phone number.", { patient_id: error.patientId });
  }
  if (error instanceof IdempotencyConflictError) {
    return failure(409, "IDEMPOTENCY_CONFLICT", "That Idempotency-Key was already used with a different patient payload.");
  }
  return null;
}

async function handlePatients(request: Request, env: Env, url: URL): Promise<Response> {
  const authError = requireApiKey(request, env);
  if (authError) return authError;

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 1 || parts.length > 2 || parts[0] !== "patients") return failure(404, "NOT_FOUND", "Route not found.");
  const id = parts[1];
  if (id && !isUuid(id)) return failure(400, "INVALID_PATIENT_ID", "Patient ID must be a valid UUID.");

  if (!id && request.method === "GET") {
    const limitRaw = Number(url.searchParams.get("limit") ?? 50);
    const offsetRaw = Number(url.searchParams.get("offset") ?? 0);
    if (!Number.isInteger(limitRaw) || limitRaw < 1 || limitRaw > 100 || !Number.isInteger(offsetRaw) || offsetRaw < 0) {
      return failure(400, "INVALID_PAGINATION", "limit must be 1–100 and offset must be zero or greater.");
    }
    const lastName = url.searchParams.get("last_name")?.trim();
    if (lastName && lastName.length > 50) return failure(400, "INVALID_FILTER", "last_name exceeds 50 characters.");
    const dobRaw = url.searchParams.get("date_of_birth")?.trim();
    const dateOfBirth = dobRaw ? parseDateOfBirth(dobRaw) : undefined;
    if (dobRaw && !dateOfBirth) return failure(400, "INVALID_FILTER", "date_of_birth must be MM/DD/YYYY and cannot be in the future.");
    const phoneRaw = url.searchParams.get("phone_number")?.trim();
    const phoneNumber = phoneRaw ? normalizeUsPhone(phoneRaw) : undefined;
    if (phoneRaw && !phoneNumber) return failure(400, "INVALID_FILTER", "phone_number must be a valid U.S. 10-digit number.");
    const result = await listPatients(env.DB, { lastName, dateOfBirth, phoneNumber, limit: limitRaw, offset: offsetRaw });
    return json({ items: result.rows.map(toPublicPatient), pagination: { total: result.total, limit: limitRaw, offset: offsetRaw } });
  }

  if (!id && request.method === "POST") {
    const body = await readJson(request);
    if (body.response) return body.response;
    const validated = validatePatient(body.value);
    if (!validated.value) return failure(422, "VALIDATION_FAILED", "One or more patient fields are invalid.", validated.errors);
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (idempotencyKey && !/^[\x21-\x7E]{1,128}$/.test(idempotencyKey)) {
      return failure(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key must contain 1–128 printable ASCII characters without spaces.");
    }
    try {
      const created = await createPatient(env.DB, validated.value, idempotencyKey || undefined);
      return json(toPublicPatient(created.row), created.replayed ? 200 : 201, null, { "idempotency-replayed": String(created.replayed) });
    } catch (error) {
      const conflict = conflictResponse(error);
      if (conflict) return conflict;
      throw error;
    }
  }

  if (id && request.method === "GET") {
    const row = await getPatient(env.DB, id);
    return row ? json(toPublicPatient(row)) : failure(404, "PATIENT_NOT_FOUND", "No active patient exists with that ID.");
  }

  if (id && request.method === "PUT") {
    const body = await readJson(request);
    if (body.response) return body.response;
    const validated = validatePatientPatch(body.value);
    if (!validated.value) return failure(422, "VALIDATION_FAILED", "One or more patient fields are invalid.", validated.errors);
    try {
      const row = await updatePatient(env.DB, id, validated.value);
      return row ? json(toPublicPatient(row)) : failure(404, "PATIENT_NOT_FOUND", "No active patient exists with that ID.");
    } catch (error) {
      const conflict = conflictResponse(error);
      if (conflict) return conflict;
      throw error;
    }
  }

  if (id && request.method === "DELETE") {
    const row = await softDeletePatient(env.DB, id);
    return row ? json(toPublicPatient(row)) : failure(404, "PATIENT_NOT_FOUND", "No active patient exists with that ID.");
  }

  return methodNotAllowed(id ? "GET, PUT, DELETE" : "GET, POST");
}

function htmlResponse(content: string, nonce: string): Response {
  return new Response(content, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-content-security-nonce": nonce,
    },
  });
}

async function route(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return optionsResponse(request, env);
  if (url.pathname === "/") return Response.redirect(`${url.origin}/dashboard`, 302);

  if (url.pathname === "/dashboard") {
    if (request.method !== "GET") return methodNotAllowed("GET");
    const nonce = crypto.randomUUID().replaceAll("-", "");
    return htmlResponse(dashboardHtml(nonce), nonce);
  }
  if (url.pathname === "/docs") {
    if (request.method !== "GET") return methodNotAllowed("GET");
    const nonce = crypto.randomUUID().replaceAll("-", "");
    return htmlResponse(docsHtml(nonce), nonce);
  }
  if (url.pathname === "/openapi.json") {
    if (request.method !== "GET") return methodNotAllowed("GET");
    return new Response(JSON.stringify(openApiDocument(url.origin)), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  }

  if (url.pathname === "/health") {
    if (request.method !== "GET") return methodNotAllowed("GET");
    try {
      await env.DB.prepare("SELECT 1 AS ok").first();
      return json({ status: "ok", database: "connected", timestamp: new Date().toISOString(), version: "1.0.0" });
    } catch {
      return failure(503, "DATABASE_UNAVAILABLE", "The database health check failed.");
    }
  }

  if (url.pathname === "/webhooks/vapi") {
    if (request.method !== "POST") return methodNotAllowed("POST");
    return handleVapiWebhook(request, env, context);
  }

  if (url.pathname === "/calls") {
    if (request.method !== "GET") return methodNotAllowed("GET");
    const authError = requireApiKey(request, env);
    if (authError) return authError;
    const raw = Number(url.searchParams.get("limit") ?? 25);
    if (!Number.isInteger(raw) || raw < 1 || raw > 100) return failure(400, "INVALID_PAGINATION", "limit must be an integer from 1–100.");
    return json({ items: await listCallSessions(env.DB, raw) });
  }

  if (url.pathname === "/patients" || url.pathname.startsWith("/patients/")) return handlePatients(request, env, url);
  return failure(404, "NOT_FOUND", "Route not found.");
}

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    const requestId = request.headers.get("cf-ray") ?? crypto.randomUUID();
    try {
      const response = await route(request, env, context);
      const secured = withSecurityHeaders(response, request, env);
      secured.headers.set("x-request-id", requestId);
      return secured;
    } catch (error) {
      console.error(JSON.stringify({ event: "unhandled_request_error", request_id: requestId, method: request.method, path: new URL(request.url).pathname, message: error instanceof Error ? error.message : "Unknown error" }));
      const response = failure(500, "INTERNAL_ERROR", "An unexpected error occurred.", undefined, requestId);
      return withSecurityHeaders(response, request, env);
    }
  },
} satisfies ExportedHandler<Env>;