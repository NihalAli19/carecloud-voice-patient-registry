import { createPatient, findByPhone, getPatient, linkCallToPatient, recordCallReport, toPublicPatient, updatePatient } from "./patients";
import type { Env, VapiMessage, VapiToolCall } from "./types";
import { normalizeUsPhone, validatePatient, validatePatientPatch } from "./validation";
import { failure, readJson, requireVapiSecret } from "./http";

function vapiResponse(results: Array<{ toolCallId: string; result?: string; error?: string }>): Response {
  return new Response(JSON.stringify({ results }), {
    status: 200,
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
    } catch { return {}; }
  }
  return args && typeof args === "object" ? args : {};
}

async function executeTool(call: VapiToolCall, message: VapiMessage, env: Env): Promise<{ toolCallId: string; result?: string; error?: string }> {
  const name = call.function?.name;
  const args = toolArguments(call);
  const callId = message.call?.id;
  const callerNumber = message.call?.customer?.number ?? message.customer?.number;

  try {
    if (name === "lookup_patient_by_phone") {
      const phone = normalizeUsPhone(args.phone_number ?? callerNumber);
      if (!phone) return { toolCallId: call.id, error: "The phone number is invalid. Ask for a 10-digit U.S. phone number." };
      const patient = await findByPhone(env.DB, phone);
      return {
        toolCallId: call.id,
        result: singleLine(patient
          ? { found: true, patient_id: patient.patient_id, first_name: patient.first_name, last_name: patient.last_name, phone_number: patient.phone_number }
          : { found: false, phone_number: phone }),
      };
    }

    if (name === "register_patient") {
      if (args.caller_confirmed !== true) return { toolCallId: call.id, error: "Do not save yet. Read every collected field back and obtain explicit caller confirmation first." };
      const candidate = { ...args };
      delete candidate.caller_confirmed;
      const validated = validatePatient(candidate);
      if (!validated.value) return { toolCallId: call.id, error: singleLine({ message: "Validation failed. Correct only these fields, then reconfirm the entire record.", fields: validated.errors }) };

      const duplicate = await findByPhone(env.DB, validated.value.phone_number);
      if (duplicate) {
        return { toolCallId: call.id, error: singleLine({ code: "DUPLICATE_PATIENT", message: `A record already exists for ${duplicate.first_name} ${duplicate.last_name}. Ask whether the caller wants to update it.`, patient_id: duplicate.patient_id }) };
      }

      const created = await createPatient(env.DB, validated.value, `vapi:${call.id}`);
      await linkCallToPatient(env.DB, callId, normalizeUsPhone(callerNumber), created.row.patient_id);
      console.log(JSON.stringify({ event: "patient_registered", call_id: callId, replayed: created.replayed, patient: toPublicPatient(created.row) }));
      return { toolCallId: call.id, result: singleLine({ success: true, patient_id: created.row.patient_id, first_name: created.row.first_name, replayed: created.replayed }) };
    }

    if (name === "update_patient") {
      const patientId = typeof args.patient_id === "string" ? args.patient_id : "";
      if (!patientId || !await getPatient(env.DB, patientId)) return { toolCallId: call.id, error: "The patient record was not found. Do not claim the update succeeded." };
      if (args.caller_confirmed !== true) return { toolCallId: call.id, error: "Do not update yet. Read the complete corrected record back and obtain explicit caller confirmation first." };
      const patch = { ...args };
      delete patch.patient_id;
      delete patch.caller_confirmed;
      const validated = validatePatientPatch(patch);
      if (!validated.value) return { toolCallId: call.id, error: singleLine({ message: "Validation failed. Correct these fields and reconfirm.", fields: validated.errors }) };
      const updated = await updatePatient(env.DB, patientId, validated.value);
      if (!updated) return { toolCallId: call.id, error: "The patient record could not be updated." };
      await linkCallToPatient(env.DB, callId, normalizeUsPhone(callerNumber), updated.patient_id);
      console.log(JSON.stringify({ event: "patient_updated", call_id: callId, patient: toPublicPatient(updated) }));
      return { toolCallId: call.id, result: singleLine({ success: true, patient_id: updated.patient_id, first_name: updated.first_name }) };
    }

    return { toolCallId: call.id, error: `Unsupported tool: ${name ?? "unknown"}` };
  } catch (error) {
    console.error(JSON.stringify({ event: "vapi_tool_error", call_id: callId, tool: name, message: error instanceof Error ? error.message : "Unknown error" }));
    return { toolCallId: call.id, error: "The registry is temporarily unavailable. Apologize, tell the caller their information was not saved, and ask them to try again later." };
  }
}

export async function handleVapiWebhook(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
  const authError = requireVapiSecret(request, env);
  if (authError) return authError;
  const body = await readJson(request);
  if (body.response) return body.response;
  const root = body.value as { message?: VapiMessage } | null;
  const message = root?.message;
  if (!message?.type) return failure(400, "INVALID_WEBHOOK", "Missing Vapi message type.");

  if (message.type === "tool-calls") {
    const calls = message.toolCallList ?? [];
    if (!calls.length) return vapiResponse([]);
    return vapiResponse(await Promise.all(calls.map((call) => executeTool(call, message, env))));
  }

  if (message.type === "end-of-call-report" && message.call?.id) {
    context.waitUntil(recordCallReport(env.DB, {
      callId: message.call.id,
      callerNumber: normalizeUsPhone(message.call.customer?.number ?? message.customer?.number),
      endedReason: message.endedReason,
      transcript: message.artifact?.transcript,
      summary: message.summary,
    }).catch((error) => console.error(JSON.stringify({ event: "call_report_error", call_id: message.call?.id, message: error instanceof Error ? error.message : "Unknown error" }))));
  }
  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "content-type": "application/json" } });
}
