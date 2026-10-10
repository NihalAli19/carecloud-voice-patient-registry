const apiKey = process.env.VAPI_API_KEY;
const assistantId = process.env.VAPI_ASSISTANT_ID;
const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;
const baseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
if (!apiKey || !assistantId || !phoneNumberId || !webhookSecret || !baseUrl) {
  console.error("VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID, VAPI_WEBHOOK_SECRET, and PUBLIC_BASE_URL are required.");
  process.exit(1);
}

async function get(path) {
  const response = await fetch(`https://api.vapi.ai${path}`, { headers: { authorization: `Bearer ${apiKey}` } });
  const body = await response.json();
  if (!response.ok) throw new Error(`Vapi ${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

const [assistant, phone] = await Promise.all([
  get(`/assistant/${assistantId}`),
  get(`/phone-number/${phoneNumberId}`),
]);

const tools = assistant.model?.tools ?? [];
const lookup = tools.find((tool) => tool.function?.name === "lookup_patient_by_phone");
const register = tools.find((tool) => tool.function?.name === "register_patient");
const update = tools.find((tool) => tool.function?.name === "update_patient");
const lookupRequired = lookup?.function?.parameters?.required ?? [];
const updateRequired = update?.function?.parameters?.required ?? [];

requireCondition(assistant.id === assistantId, "Assistant ID does not match.");
requireCondition(assistant.server?.url === `${baseUrl}/webhooks/vapi`, "Assistant webhook URL is incorrect.");
requireCondition(assistant.server?.headers?.Authorization === `Bearer ${webhookSecret}`, "Assistant webhook authorization header is incorrect.");
requireCondition(lookupRequired.includes("phone_number") && lookupRequired.includes("date_of_birth"), "Lookup tool does not require phone and DOB.");
requireCondition(Boolean(register), "Registration tool is missing.");
requireCondition(updateRequired.includes("patient_id") && updateRequired.includes("verification_date_of_birth") && updateRequired.includes("caller_confirmed"), "Update tool lacks identity or confirmation requirements.");
requireCondition(assistant.maxDurationSeconds === 600, "Call duration limit is not 600 seconds.");
requireCondition(assistant.recordingEnabled === false, "Recording must remain disabled.");
requireCondition(phone.assistantId === assistantId, "Phone number is not assigned to the expected assistant.");

console.log(JSON.stringify({
  assistantId: assistant.id,
  assistantName: assistant.name,
  model: assistant.model?.model,
  webhook: assistant.server?.url,
  tools: tools.map((tool) => tool.function?.name ?? tool.type),
  lookupRequired,
  updateRequired,
  maxDurationSeconds: assistant.maxDurationSeconds,
  recordingEnabled: assistant.recordingEnabled,
  phoneNumber: phone.number,
  phoneProvider: phone.provider,
  phoneStatus: phone.status,
  phoneAssigned: phone.assistantId === assistantId,
}, null, 2));
