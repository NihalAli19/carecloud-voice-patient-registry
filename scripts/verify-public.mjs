const baseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
if (!baseUrl) {
  console.error("PUBLIC_BASE_URL is required.");
  process.exit(1);
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

const [healthResponse, dashboardResponse, docsResponse, openApiResponse] = await Promise.all([
  fetch(`${baseUrl}/health`),
  fetch(`${baseUrl}/dashboard`),
  fetch(`${baseUrl}/docs`),
  fetch(`${baseUrl}/openapi.json`),
]);
requireCondition(healthResponse.ok, `Health returned ${healthResponse.status}.`);
requireCondition(dashboardResponse.ok, `Dashboard returned ${dashboardResponse.status}.`);
requireCondition(docsResponse.ok, `Docs returned ${docsResponse.status}.`);
requireCondition(openApiResponse.ok, `OpenAPI returned ${openApiResponse.status}.`);

const health = await healthResponse.json();
const dashboard = await dashboardResponse.text();
const docs = await docsResponse.text();
const openApi = await openApiResponse.json();
const csp = dashboardResponse.headers.get("content-security-policy") ?? "";
const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];

requireCondition(health?.data?.status === "ok" && health?.data?.database === "connected", "Health payload is not healthy.");
requireCondition(Boolean(nonce), "Dashboard CSP does not contain a nonce.");
requireCondition(dashboard.includes(`<style nonce="${nonce}">`) && dashboard.includes(`<script nonce="${nonce}">`), "Dashboard HTML nonce does not match CSP.");
requireCondition(dashboard.includes("Patient registration operations") && dashboard.includes("Recent call activity"), "Operations dashboard sections are incomplete.");
requireCondition(dashboard.includes('id="serviceStatus"') && dashboard.includes('id="signOut"'), "Operational status or sign-out controls are missing.");
requireCondition(!csp.includes("unsafe-inline") && csp.includes("frame-ancestors 'none'"), "Dashboard CSP is weaker than expected.");
const secureOrigin = new URL(baseUrl).protocol === "https:";
if (secureOrigin) requireCondition(dashboardResponse.headers.get("strict-transport-security")?.includes("max-age=31536000"), "HSTS is missing.");
requireCondition(dashboardResponse.headers.get("x-frame-options") === "DENY", "Frame protection is missing.");
requireCondition(dashboardResponse.headers.get("cache-control")?.includes("no-store"), "No-store caching policy is missing.");
requireCondition(docs.includes("Patient Registry API"), "Human API documentation is missing.");
requireCondition(openApi.openapi === "3.1.0" && openApi.paths?.["/calls"], "OpenAPI document is incomplete.");

console.log(JSON.stringify({
  health: health.data.status,
  database: health.data.database,
  dashboardStatus: dashboardResponse.status,
  docsStatus: docsResponse.status,
  openApiVersion: openApi.openapi,
  hsts: secureOrigin ? true : "not applicable on HTTP",
  nonceCsp: true,
  frameProtection: true,
  noStore: true,
}, null, 2));
