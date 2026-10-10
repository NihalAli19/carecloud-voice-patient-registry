import {
  createPatient,
  DuplicatePatientError,
  findByPhone,
  getPatient,
  IdempotencyConflictError,
  linkCallToPatient,
  recordCallReport,
  toPublicPatient,
  updatePatient,
} from "./patients";
import type { Env, VapiMessage, VapiToolCall } from "./types";
import { normalizeUsPhone, parseDateOfBirth, validatePatient, validatePatientPatch } from "./validation";
import { failure, readJson, requireVapiSecret } from "./http";

const MAX_WEBHOOK_BYTES = 512 * 1024;
const MAX_TOOL_CALLS = 8;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

type ToolResult = { toolCallId: string; result?: string; error?: string };

function vapiResponse(results: ToolResult[], status = 200): Response {
  return new Response(JSON.stringify({ results }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function singleLine(value: unknown): string {
  return JSON.stringify(value).replace(/[\r\n]+/g, " ");
}

function toolArguments(call: VapiToolCall): Record<string, unknown> {
  const args = call.function?.arguments;
  if (typeof args === "string") {
    try {
      const parsed: unknown = JSON.parse(args);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return args && typeof args === "object" ? args : {};
}

function toolError(call: VapiToolCall, message: string): ToolResult {
  return { toolCallId: SAFE_ID.test(call.id) ? call.id : "invalid-tool-call", error: message };
}

async function executeTool(call: VapiToolCall, message: VapiMessage, env: Env): Promise<ToolResult> {
  if (!SAFE_ID.test(call.id)) return toolError(call, "The tool call identifier is invalid.");

  const name = call.function?.name;
  const args = toolArguments(call);
  const callId = message.call?.id;
  const callerNumber = message.call?.customer?.number ?? message.customer?.number;

  try {
    if (name === "lookup_patient_by_phone") {
      const phone = normalizeUsPhone(args.phone_number ?? callerNumber);
      const dateOfBirth = parseDateOfBirth(args.date_of_birth);
      if (!phone) return toolError(call, "The phone number is invalid. Ask for a valid 10-digit U.S. phone number.");
      if (!dateOfBirth) return toolError(call, "The date of birth is invalid. Ask for it in MM/DD/YYYY format before lookup.");
      const patient = await findByPhone(env.DB, phone);
      if (!patient) return { toolCallId: call.id, result: singleLine({ found: false, phone_number: phone }) };
      if (patient.date_of_birth !== dateOfBirth) {
        return { toolCallId: call.id, result: singleLine({ found: true, identity_verified: false, message: "The provided date of birth did not match. Do not reveal the patient's name, ID, or stored details, and do not create or update a record." }) };
      }
      return {
        toolCallId: call.id,
        result: singleLine({ found: true, identity_verified: true, patient_id: patient.patient_id, first_name: patient.first_name, last_name: patient.last_name }),
      };
    }

    if (name === "register_patient") {
      if (!callId || !SAFE_ID.test(callId)) return toolError(call, "The call identifier is missing. Do not save or claim success.");
      if (args.caller_confirmed !== true) return toolError(call, "Do not save yet. Read every collected field back and obtain explicit caller confirmation first.");

      const candidate = { ...args };
      delete candidate.caller_confirmed;
      const validated = validatePatient(candidate);
      if (!validated.value) return toolError(call, singleLine({ message: "Validation failed. Correct only these fields, then reconfirm the entire record.", fields: validated.errors }));

      const duplicate = await findByPhone(env.DB, validated.value.phone_number);
      if (duplicate) {
        return toolError(call, singleLine({ code: "DUPLICATE_PATIENT", message: `A record already exists for ${duplicate.first_name} ${duplicate.last_name}. Verify the caller's date of birth before offering an update.`, patient_id: duplicate.patient_id }));
      }

      const created = await createPatient(env.DB, validated.value, `vapi:${callId}`);
      await linkCallToPatient(env.DB, callId, normalizeUsPhone(callerNumber), created.row.patient_id);
      console.log(JSON.stringify({ event: "patient_registered", data_classification: "synthetic_demo_only", call_id: callId, replayed: created.replayed, patient: toPublicPatient(created.row) }));
      return { toolCallId: call.id, result: singleLine({ success: true, patient_id: created.row.patient_id, first_name: created.row.first_name, replayed: created.replayed }) };
    }

    if (name === "update_patient") {
      if (!callId || !SAFE_ID.test(callId)) return toolError(call, "The call identifier is missing. Do not update or claim success.");
      const patientId = typeof args.patient_id === "string" && SAFE_ID.test(args.patient_id) ? args.patient_id : "";
      const existing = patientId ? await getPatient(env.DB, patientId) : null;
      if (!existing) return toolError(call, "The patient record was not found. Do not claim the update succeeded.");
      if (args.caller_confirmed !== true) return toolError(call, "Do not update yet. Read the complete corrected record back and obtain explicit caller confirmation first.");

      const verificationDob = parseDateOfBirth(args.verification_date_of_birth);
      if (!verificationDob || verificationDob !== existing.date_of_birth) {
        return toolError(call, "Identity verification failed. Do not reveal or update the existing record. Ask the caller to contact the clinic.");
      }

      const patch = { ...args };
      delete patch.patient_id;
      delete patch.caller_confirmed;
      delete patch.verification_date_of_birth;
      const validated = validatePatientPatch(patch);
      if (!validated.value) return toolError(call, singleLine({ message: "Validation failed. Correct these fields and reconfirm.", fields: validated.errors }));
      const updated = await updatePatient(env.DB, patientId, validated.value);
      if (!updated) return toolError(call, "The patient record could not be updated.");
      await linkCallToPatient(env.DB, callId, normalizeUsPhone(callerNumber), updated.patient_id);
      console.log(JSON.stringify({ event: "patient_updated", data_classification: "synthetic_demo_only", call_id: callId, patient: toPublicPatient(updated) }));
      return { toolCallId: call.id, result: singleLine({ success: true, patient_id: updated.patient_id, first_name: updated.first_name }) };
    }

    return toolError(call, `Unsupported tool: ${name ?? "unknown"}`);
  } catch (error) {
    const code = error instanceof DuplicatePatientError
      ? "DUPLICATE_PATIENT"
      : error instanceof IdempotencyConflictError
        ? "IDEMPOTENCY_CONFLICT"
        : "REGISTRY_UNAVAILABLE";
    console.error(JSON.stringify({ event: "vapi_tool_error", call_id: callId, tool: name, code, message: error instanceof Error ? error.message : "Unknown error" }));
    const messageText = error instanceof DuplicatePatientError
      ? "A patient already uses that phone number. Do not create or update a duplicate."
      : error instanceof IdempotencyConflictError
        ? "This call already saved a different confirmed payload. Do not retry the write automatically."
        : "The registry is temporarily unavailable. Apologize, tell the caller their information was not saved, and ask them to try again later.";
    return toolError(call, singleLine({ code, message: messageText }));
  }
}

export async function handleVapiWebhook(request: Request, env: Env, _context: ExecutionContext): Promise<Response> {
  const authError = requireVapiSecret(request, env);
  if (authError) return authError;

  const body = await readJson(request, MAX_WEBHOOK_BYTES);
  if (body.response) return body.response;
  const root = body.value as { message?: VapiMessage } | null;
  const message = root?.message;
  if (!message?.type) return failure(400, "INVALID_WEBHOOK", "Missing Vapi message type.");

  if (message.type === "tool-calls") {
    const calls = message.toolCallList ?? [];
    if (calls.length > MAX_TOOL_CALLS) return failure(400, "TOO_MANY_TOOL_CALLS", `A webhook cannot contain more than ${MAX_TOOL_CALLS} tool calls.`);
    if (!calls.length) return vapiResponse([]);

    const results: ToolResult[] = [];
    for (const call of calls) results.push(await executeTool(call, message, env));
    return vapiResponse(results);
  }

  if (message.type === "end-of-call-report") {
    const callId = message.call?.id;
    if (!callId || !SAFE_ID.test(callId)) return failure(400, "INVALID_WEBHOOK", "The call report is missing a valid call ID.");
    try {
      await recordCallReport(env.DB, {
        callId,
        callerNumber: normalizeUsPhone(message.call?.customer?.number ?? message.customer?.number),
        endedReason: message.endedReason,
        transcript: message.artifact?.transcript,
        summary: message.analysis?.summary ?? message.summary,
      });
    } catch (error) {
      console.error(JSON.stringify({ event: "call_report_error", call_id: callId, message: error instanceof Error ? error.message : "Unknown error" }));
      return failure(503, "CALL_REPORT_PERSISTENCE_FAILED", "The call report could not be persisted; Vapi may retry the webhook.");
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}