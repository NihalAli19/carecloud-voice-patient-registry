import { dashboardHtml } from "./dashboard";
import { docsHtml, openApiDocument } from "./openapi";
import { createPatient, getPatient, listCallSessions, listPatients, softDeletePatient, toPublicPatient, updatePatient } from "./patients";
import type { Env } from "./types";
import { formatDateOfBirth, isUuid, normalizeUsPhone, parseDateOfBirth, validatePatient, validatePatientPatch } from "./validation";
import { failure, json, optionsResponse, readJson, requireApiKey, withSecurityHeaders } from "./http";
import { handleVapiWebhook } from "./vapi";

async function handlePatients(request: Request, env: Env, url: URL): Promise<Response> {
  const authError = requireApiKey(request, env);
  if (authError) return authError;
  const parts = url.pathname.split("/").filter(Boolean);
  const id = parts.length === 2 ? parts[1] : undefined;

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
    const dob = dobRaw ? parseDateOfBirth(dobRaw) : undefined;
    if (dobRaw && !dob) return failure(400, "INVALID_FILTER", "date_of_birth must be MM/DD/YYYY and cannot be in the future.");
    const phoneRaw = url.searchParams.get("phone_number")?.trim();
    const phone = phoneRaw ? normalizeUsPhone(phoneRaw) : undefined;
    if (phoneRaw && !phone) return failure(400, "INVALID_FILTER", "phone_number must be a valid U.S. 10-digit number.");
    const result = await listPatients(env.DB, { lastName, dateOfBirth: dob, phoneNumber: phone, limit: limitRaw, offset: offsetRaw });
    return json({ items: result.rows.map(toPublicPatient), pagination: { total: result.total, limit: limitRaw, offset: offsetRaw } });
  }

  if (!id && request.method === "POST") {
    const body = await readJson(request);
    if (body.response) return body.response;
    const validated = validatePatient(body.value);
    if (!validated.value) return failure(422, "VALIDATION_FAILED", "One or more patient fields are invalid.", validated.errors);
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (idempotencyKey && idempotencyKey.length > 128) return failure(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key cannot exceed 128 characters.");
    const created = await createPatient(env.DB, validated.value, idempotencyKey || undefined);
    return json(toPublicPatient(created.row), created.replayed ? 200 : 201, null, { "idempotency-replayed": String(created.replayed) });
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
    const row = await updatePatient(env.DB, id, validated.value);
    return row ? json(toPublicPatient(row)) : failure(404, "PATIENT_NOT_FOUND", "No active patient exists with that ID.");
  }

  if (id && request.method === "DELETE") {
    const row = await softDeletePatient(env.DB, id);
    return row ? json(toPublicPatient(row)) : failure(404, "PATIENT_NOT_FOUND", "No active patient exists with that ID.");
  }
  return failure(405, "METHOD_NOT_ALLOWED", "The HTTP method is not supported for this route.");
}

async function route(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return optionsResponse(request, env);
  if (url.pathname === "/") return Response.redirect(`${url.origin}/dashboard`, 302);
  if (url.pathname === "/dashboard" && request.method === "GET") return new Response(dashboardHtml, { headers: { "content-type": "text/html; charset=utf-8" } });
  if (url.pathname === "/docs" && request.method === "GET") return new Response(docsHtml, { headers: { "content-type": "text/html; charset=utf-8" } });
  if (url.pathname === "/openapi.json" && request.method === "GET") return new Response(JSON.stringify(openApiDocument(url.origin)), { headers: { "content-type": "application/json; charset=utf-8" } });

  if (url.pathname === "/health" && request.method === "GET") {
    try {
      await env.DB.prepare("SELECT 1 AS ok").first();
      return json({ status: "ok", database: "connected", timestamp: new Date().toISOString(), version: "1.0.0" });
    } catch {
      return failure(503, "DATABASE_UNAVAILABLE", "The database health check failed.");
    }
  }

  if (url.pathname === "/webhooks/vapi") {
    if (request.method !== "POST") return failure(405, "METHOD_NOT_ALLOWED", "Vapi webhooks require POST.");
    return handleVapiWebhook(request, env, context);
  }

  if (url.pathname === "/calls" && request.method === "GET") {
    const authError = requireApiKey(request, env);
    if (authError) return authError;
    const raw = Number(url.searchParams.get("limit") ?? 25);
    const limit = Number.isInteger(raw) && raw >= 1 && raw <= 100 ? raw : 25;
    return json({ items: await listCallSessions(env.DB, limit) });
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
      return withSecurityHeaders(failure(500, "INTERNAL_ERROR", "An unexpected error occurred.", undefined, requestId), request, env);
    }
  },
} satisfies ExportedHandler<Env>;
