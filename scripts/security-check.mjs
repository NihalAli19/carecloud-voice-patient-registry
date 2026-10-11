import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const forbiddenNames = [
  /(^|\/)\.dev\.vars$/i,
  /(^|\/)\.env(?:\..+)?$/i,
  /\.(?:pem|p12|pfx|key|keystore)$/i,
  /(^|\/)(?:id_rsa|id_ed25519)$/i,
];
const allowedEnvironmentTemplates = new Set([".env.example"]);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
];

const failures = [];
for (const file of files) {
  const normalized = file.replaceAll("\\", "/");
  const basename = normalized.split("/").at(-1);
  if (!allowedEnvironmentTemplates.has(basename) && forbiddenNames.some((pattern) => pattern.test(normalized))) {
    failures.push(`${file}: credential-bearing filename must not be tracked`);
    continue;
  }
  const bytes = readFileSync(file);
  if (bytes.includes(0)) failures.push(`${file}: contains NUL bytes`);
  const text = bytes.toString("utf8");
  const patterns = basename?.startsWith(".env")
    ? [...secretPatterns, /\b(?:VAPI_API_KEY|VAPI_WEBHOOK_SECRET|AUTH_PEPPER|API_KEY)\s*=\s*(?!replace-|example-|test-|your-|<)[^\s#]{12,}/i]
    : secretPatterns;
  for (const pattern of patterns) {
    if (pattern.test(text)) failures.push(`${file}: matches secret pattern ${pattern}`);
  }
}

if (failures.length) {
  console.error("Security check failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log(`Security check passed (${files.length} tracked files scanned).`);
