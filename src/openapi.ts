const patientProperties = {
  patient_id: { type: "string", format: "uuid", readOnly: true },
  first_name: { type: "string", minLength: 1, maxLength: 50, example: "Jane" },
  last_name: { type: "string", minLength: 1, maxLength: 50, example: "Doe" },
  date_of_birth: { type: "string", pattern: "^\\d{2}/\\d{2}/\\d{4}$", example: "04/15/1988" },
  sex: { type: "string", enum: ["Male", "Female", "Other", "Decline to Answer"] },
  phone_number: { type: "string", pattern: "^\\+1[2-9]\\d{2}[2-9]\\d{6}$", example: "+12025550123" },
  email: { type: ["string", "null"], format: "email" },
  address_line_1: { type: "string", minLength: 1, maxLength: 200, example: "123 Main Street" },
  address_line_2: { type: ["string", "null"], maxLength: 100, example: "Apt 4B" },
  city: { type: "string", minLength: 1, maxLength: 100, example: "Chicago" },
  state: { type: "string", pattern: "^[A-Z]{2}$", example: "IL" },
  zip_code: { type: "string", pattern: "^\\d{5}(-\\d{4})?$", example: "60601" },
  insurance_provider: { type: ["string", "null"], maxLength: 100 },
  insurance_member_id: { type: ["string", "null"], pattern: "^[A-Za-z0-9]+$", maxLength: 50 },
  preferred_language: { type: "string", maxLength: 50, default: "English" },
  emergency_contact_name: { type: ["string", "null"], maxLength: 100 },
  emergency_contact_phone: { type: ["string", "null"], pattern: "^\\+1[2-9]\\d{2}[2-9]\\d{6}$" },
  created_at: { type: "string", format: "date-time", readOnly: true },
  updated_at: { type: "string", format: "date-time", readOnly: true },
  deleted_at: { type: ["string", "null"], format: "date-time", readOnly: true },
};

const required = ["first_name", "last_name", "date_of_birth", "sex", "phone_number", "address_line_1", "city", "state", "zip_code"];
const bearer = [{ bearerAuth: [] }];
const standardErrors = {
  "401": { $ref: "#/components/responses/Unauthorized" },
  "413": { $ref: "#/components/responses/PayloadTooLarge" },
};

export function openApiDocument(origin: string): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "CareCloud Voice Patient Registry API",
      version: "1.0.0",
      description: "Persistent patient demographics API used by the Vapi voice intake agent. Use synthetic data only.",
    },
    servers: [{ url: origin }],
    paths: {
      "/health": {
        get: { operationId: "health", summary: "Service and database health", responses: { "200": { description: "Healthy" }, "503": { description: "Database unavailable" } } },
      },
      "/patients": {
        get: {
          operationId: "listPatients",
          summary: "List and filter active patients",
          security: bearer,
          parameters: [
            { name: "last_name", in: "query", schema: { type: "string", maxLength: 50 } },
            { name: "date_of_birth", in: "query", schema: { type: "string", pattern: "^\\d{2}/\\d{2}/\\d{4}$" } },
            { name: "phone_number", in: "query", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
            { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
          ],
          responses: { "200": { description: "Patient list" }, ...standardErrors },
        },
        post: {
          operationId: "createPatient",
          summary: "Create a patient",
          security: bearer,
          parameters: [{ name: "Idempotency-Key", in: "header", required: false, schema: { type: "string", minLength: 1, maxLength: 128 } }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PatientCreate" } } } },
          responses: {
            "200": { description: "Idempotent replay" },
            "201": { description: "Created" },
            "409": { description: "Duplicate phone number or idempotency conflict" },
            "422": { $ref: "#/components/responses/ValidationError" },
            ...standardErrors,
          },
        },
      },
      "/patients/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        get: { operationId: "getPatient", summary: "Retrieve a patient", security: bearer, responses: { "200": { description: "Patient" }, "404": { description: "Not found" }, ...standardErrors } },
        put: {
          operationId: "updatePatient",
          summary: "Partially update a patient",
          security: bearer,
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PatientUpdate" } } } },
          responses: { "200": { description: "Updated" }, "404": { description: "Not found" }, "409": { description: "Duplicate phone number" }, "422": { $ref: "#/components/responses/ValidationError" }, ...standardErrors },
        },
        delete: { operationId: "deletePatient", summary: "Soft-delete a patient", security: bearer, responses: { "200": { description: "Soft deleted" }, "404": { description: "Not found" }, ...standardErrors } },
      },
      "/calls": {
        get: {
          operationId: "listCalls",
          summary: "List recent call outcomes",
          security: bearer,
          parameters: [{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } }],
          responses: { "200": { description: "Recent calls" }, ...standardErrors },
        },
      },
    },
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
      schemas: {
        Patient: { type: "object", additionalProperties: false, properties: patientProperties, required: [...required, "patient_id", "created_at", "updated_at"] },
        PatientCreate: { type: "object", additionalProperties: false, properties: patientProperties, required },
        PatientUpdate: { type: "object", additionalProperties: false, properties: patientProperties, minProperties: 1 },
        Envelope: { type: "object", properties: { data: {}, error: { type: ["object", "null"] } }, required: ["data", "error"] },
      },
      responses: {
        Unauthorized: { description: "Missing or invalid Bearer token" },
        ValidationError: { description: "One or more fields failed validation" },
        PayloadTooLarge: { description: "JSON body exceeds the allowed size" },
      },
    },
  };
}

export function docsHtml(nonce: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="description" content="CareCloud voice registry API documentation"><title>CareCloud Registry API</title><style nonce="${nonce}">body{font:16px/1.6 system-ui;background:#f5f4ef;color:#17242d;margin:0}main{max-width:900px;margin:60px auto;padding:0 24px}h1{font:500 44px Georgia,serif}code{background:#e7ebe7;padding:3px 6px;border-radius:5px}.card{background:#fff;border:1px solid #d9ddd8;border-radius:16px;padding:22px;margin:16px 0}.method{color:#087f72;font-weight:800;display:inline-block;width:70px}a{color:#087f72}</style></head><body><main><p><a href="/dashboard">← Dashboard</a></p><h1>Patient Registry API</h1><p>All patient and call routes require <code>Authorization: Bearer &lt;API_KEY&gt;</code>. Responses use the envelope <code>{ "data": ..., "error": null }</code>.</p><div class="card"><div><span class="method">GET</span><code>/patients</code></div><div><span class="method">GET</span><code>/patients/:id</code></div><div><span class="method">POST</span><code>/patients</code></div><div><span class="method">PUT</span><code>/patients/:id</code></div><div><span class="method">DELETE</span><code>/patients/:id</code></div><div><span class="method">GET</span><code>/calls</code></div></div><p><a href="/openapi.json">Download the complete OpenAPI 3.1 document →</a></p><p><strong>Safety:</strong> synthetic data only; this demo is not a HIPAA production environment.</p></main></body></html>`;
}