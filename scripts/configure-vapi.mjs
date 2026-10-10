import { readFile } from "node:fs/promises";

const required = ["VAPI_API_KEY", "PUBLIC_BASE_URL", "VAPI_WEBHOOK_SECRET"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const apiKey = process.env.VAPI_API_KEY;
const baseUrl = process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;
const prompt = await readFile(new URL("../config/assistant-prompt.md", import.meta.url), "utf8");
const webhookServer = {
  url: `${baseUrl}/webhooks/vapi`,
  timeoutSeconds: 10,
  headers: { Authorization: `Bearer ${webhookSecret}` },
};

const optionalString = (description, extra = {}) => ({ type: ["string", "null"], description, ...extra });
const patientProperties = {
  first_name: { type: "string", description: "Confirmed legal first name, letters with hyphens or apostrophes." },
  last_name: { type: "string", description: "Confirmed legal last name, letters with hyphens or apostrophes." },
  date_of_birth: { type: "string", description: "Confirmed date of birth, exactly MM/DD/YYYY." },
  sex: { type: "string", enum: ["Male", "Female", "Other", "Decline to Answer"] },
  phone_number: { type: "string", description: "Confirmed 10-digit US phone number." },
  email: optionalString("Confirmed email, or null when skipped."),
  address_line_1: { type: "string", description: "Confirmed street address." },
  address_line_2: optionalString("Confirmed apartment, suite, or unit, or null."),
  city: { type: "string" },
  state: { type: "string", description: "Confirmed two-letter US state or DC abbreviation." },
  zip_code: { type: "string", description: "Confirmed 5-digit ZIP or ZIP+4." },
  insurance_provider: optionalString("Insurance company, or null when skipped."),
  insurance_member_id: optionalString("Alphanumeric member ID, or null when skipped."),
  preferred_language: optionalString("Preferred language; use English when skipped."),
  emergency_contact_name: optionalString("Emergency contact full name, or null when skipped."),
  emergency_contact_phone: optionalString("Emergency contact 10-digit US phone, or null."),
  caller_confirmed: { type: "boolean", const: true, description: "True only after explicit confirmation of the complete readback." },
};
const requiredPatient = ["first_name", "last_name", "date_of_birth", "sex", "phone_number", "address_line_1", "city", "state", "zip_code", "caller_confirmed"];

const functionTool = (name, description, properties, required) => ({
  type: "function",
  async: false,
  function: { name, description, strict: true, parameters: { type: "object", additionalProperties: false, properties, required } },
  server: webhookServer,
});

const payload = {
  name: "CareCloud Patient Intake",
  firstMessage: "Hello, you've reached the demonstration patient registration line. Please use test information only. I’m Maya. Would you like to register a patient today?",
  endCallMessage: "Thank you for calling. Take care.",
  model: {
    provider: "openai",
    model: process.env.VAPI_MODEL || "gpt-5.4-mini",
    temperature: 0.2,
    maxTokens: 500,
    messages: [{ role: "system", content: prompt }],
    tools: [
      functionTool("lookup_patient_by_phone", "Look up an existing active patient immediately after obtaining a valid phone number.", { phone_number: { type: "string", description: "10-digit US phone number stated by the caller." } }, ["phone_number"]),
      functionTool("register_patient", "Persist a new patient only after a complete readback and explicit caller confirmation.", patientProperties, requiredPatient),
      functionTool("update_patient", "Update confirmed fields for an existing patient only after a complete corrected readback and explicit confirmation.", { patient_id: { type: "string", description: "UUID returned by lookup_patient_by_phone." }, ...Object.fromEntries(Object.entries(patientProperties).map(([key, value]) => [key, key === "caller_confirmed" ? value : { ...value }])) }, ["patient_id", "caller_confirmed"]),
      { type: "endCall" },
    ],
  },
  transcriber: { provider: "deepgram", model: "nova-3", language: "multi" },
  voice: { provider: "vapi", voiceId: process.env.VAPI_VOICE || "Clara", version: 2, language: "auto" },
  server: webhookServer,
  serverMessages: ["end-of-call-report"],
  silenceTimeoutSeconds: 30,
  maxDurationSeconds: 900,
  backgroundDenoisingEnabled: true,
  recordingEnabled: false,
  metadata: { project: "carecloud-voice-patient-registry", environment: process.env.ENVIRONMENT || "production" },
};

const assistantId = process.env.VAPI_ASSISTANT_ID;
const endpoint = assistantId ? `https://api.vapi.ai/assistant/${assistantId}` : "https://api.vapi.ai/assistant";
const response = await fetch(endpoint, {
  method: assistantId ? "PATCH" : "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
const result = await response.json();
if (!response.ok) {
  console.error("Vapi rejected the assistant configuration:", JSON.stringify(result, null, 2));
  process.exit(1);
}

if (process.env.VAPI_PHONE_NUMBER_ID) {
  const phoneResponse = await fetch(`https://api.vapi.ai/phone-number/${process.env.VAPI_PHONE_NUMBER_ID}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ assistantId: result.id }),
  });
  if (!phoneResponse.ok) {
    console.error("Assistant was configured, but phone assignment failed:", await phoneResponse.text());
    process.exit(1);
  }
}

console.log(JSON.stringify({ assistantId: result.id, model: payload.model.model, webhook: webhookServer.url, phoneAssigned: Boolean(process.env.VAPI_PHONE_NUMBER_ID) }, null, 2));
