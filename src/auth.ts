import { failure, json, readJson, requireApiKey } from "./http";
import type { Env } from "./types";

const SESSION_COOKIE = "cc_session";
const SESSION_SECONDS = 8 * 60 * 60;
const PASSWORD_ALGORITHM = "hmac_sha256_v1";
const MAX_AUTH_BODY = 8 * 1024;
const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

interface UserAuthRow {
  user_id: string;
  email: string;
  display_name: string;
  password_hash: string;
  failed_attempts: number;
  locked_until: string | null;
}

export interface AuthUser {
  user_id: string;
  email: string;
  display_name: string;
}

interface AuthInput {
  email: string;
  password: string;
  display_name?: string;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): Uint8Array | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return undefined;
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return undefined;
  }
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return difference === 0;
}

function randomToken(size = 32): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(size)));
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return encodeBase64Url(new Uint8Array(digest));
}

export function normalizeAccountEmail(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || /[\x00-\x20\x7f]/.test(email)) return undefined;
  return /^[^@]+@[^@]+\.[^@]+$/.test(email) ? email : undefined;
}

export function validateAccountPassword(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length < 12 || value.length > 128) return undefined;
  if (new TextEncoder().encode(value).byteLength > 256 || /[\x00-\x1f\x7f]/.test(value)) return undefined;
  return value;
}

function normalizeDisplayName(value: unknown, email: string): string | undefined {
  if (value === undefined) return email.split("@")[0]?.slice(0, 80) || "Reviewer";
  if (typeof value !== "string") return undefined;
  const displayName = value.trim().replace(/\s+/g, " ");
  if (displayName.length < 1 || displayName.length > 80 || /[\x00-\x1f\x7f]/.test(displayName)) return undefined;
  return displayName;
}

function parseAuthInput(value: unknown, signup: boolean): { input?: AuthInput; response?: Response } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { response: failure(422, "VALIDATION_FAILED", "Enter a valid email address and password.") };
  }
  const record = value as Record<string, unknown>;
  const allowed = signup ? new Set(["email", "password", "display_name"]) : new Set(["email", "password"]);
  if (Object.keys(record).some((key) => !allowed.has(key))) {
    return { response: failure(422, "VALIDATION_FAILED", "The request contains unsupported fields.") };
  }
  const email = normalizeAccountEmail(record.email);
  const password = validateAccountPassword(record.password);
  const displayName = signup && email ? normalizeDisplayName(record.display_name, email) : undefined;
  if (!email || !password || (signup && !displayName)) {
    return { response: failure(422, "VALIDATION_FAILED", signup
      ? "Use a valid email, a display name up to 80 characters, and a password of 12–128 characters."
      : "Enter a valid email address and password.") };
  }
  return { input: { email, password, ...(displayName ? { display_name: displayName } : {}) } };
}

export async function hashAccountPassword(password: string, pepper: string, salt: Uint8Array<ArrayBufferLike> = crypto.getRandomValues(new Uint8Array(16))): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const passwordBytes = new TextEncoder().encode(password);
  const input = new Uint8Array(salt.length + passwordBytes.length);
  input.set(salt);
  input.set(passwordBytes, salt.length);
  const signature = await crypto.subtle.sign("HMAC", key, input);
  return `${PASSWORD_ALGORITHM}$${encodeBase64Url(salt)}$${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAccountPassword(password: string, encoded: string, pepper: string): Promise<boolean> {
  const [algorithm, saltRaw, expectedRaw] = encoded.split("$");
  const salt = saltRaw ? decodeBase64Url(saltRaw) : undefined;
  const expected = expectedRaw ? decodeBase64Url(expectedRaw) : undefined;
  if (algorithm !== PASSWORD_ALGORITHM || !salt || salt.length !== 16 || !expected || expected.length !== 32) return false;
  const candidate = await hashAccountPassword(password, pepper, salt);
  const actualRaw = candidate.split("$")[2];
  const actual = actualRaw ? decodeBase64Url(actualRaw) : undefined;
  return Boolean(actual && constantTimeEqual(actual, expected));
}

function cookieToken(request: Request): string | undefined {
  const cookie = request.headers.get("cookie") ?? "";
  for (const item of cookie.split(";")) {
    const [name, ...parts] = item.trim().split("=");
    if (name === SESSION_COOKIE) {
      const token = parts.join("=");
      return /^[A-Za-z0-9_-]{40,64}$/.test(token) ? token : undefined;
    }
  }
  return undefined;
}

function sessionCookie(request: Request, token: string, maxAge: number): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function accountPepper(env: Env): string | undefined {
  return env.AUTH_PEPPER && env.AUTH_PEPPER.length >= 32 ? env.AUTH_PEPPER : undefined;
}

function sameOriginError(request: Request): Response | null {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if ((origin && origin !== url.origin) || fetchSite === "cross-site") {
    return failure(403, "CROSS_SITE_REQUEST", "Cross-site authentication requests are not allowed.");
  }
  return null;
}

async function createSession(request: Request, db: D1Database, user: AuthUser, status = 200): Promise<Response> {
  const token = randomToken();
  const sessionHash = await sha256(token);
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await db.batch([
    db.prepare("DELETE FROM app_sessions WHERE expires_at <= ?").bind(createdAt),
    db.prepare("INSERT INTO app_sessions (session_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .bind(sessionHash, user.user_id, createdAt, expiresAt),
  ]);
  return json(user, status, null, { "set-cookie": sessionCookie(request, token, SESSION_SECONDS) });
}

export async function getSessionUser(request: Request, env: Env): Promise<AuthUser | null> {
  const token = cookieToken(request);
  if (!token) return null;
  const sessionHash = await sha256(token);
  return env.DB.prepare(`
    SELECT u.user_id, u.email, u.display_name
    FROM app_sessions s
    JOIN app_users u ON u.user_id = s.user_id
    WHERE s.session_hash = ? AND s.expires_at > ?
  `).bind(sessionHash, new Date().toISOString()).first<AuthUser>();
}

export async function requireApiKeyOrSession(request: Request, env: Env): Promise<Response | null> {
  if (request.headers.has("authorization")) return requireApiKey(request, env);
  if (await getSessionUser(request, env)) return null;
  return failure(401, "UNAUTHORIZED", "Sign in to access the registry.");
}

export async function handleSignUp(request: Request, env: Env): Promise<Response> {
  const originError = sameOriginError(request);
  if (originError) return originError;
  const pepper = accountPepper(env);
  if (!pepper) return failure(503, "SERVER_MISCONFIGURED", "Account authentication is temporarily unavailable.");
  const body = await readJson(request, MAX_AUTH_BODY);
  if (body.response) return body.response;
  const parsed = parseAuthInput(body.value, true);
  if (!parsed.input) return parsed.response!;

  const passwordHash = await hashAccountPassword(parsed.input.password, pepper);
  const now = new Date().toISOString();
  const user: AuthUser = {
    user_id: crypto.randomUUID(),
    email: parsed.input.email,
    display_name: parsed.input.display_name!,
  };
  try {
    await env.DB.prepare(`
      INSERT INTO app_users (user_id, email, display_name, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(user.user_id, user.email, user.display_name, passwordHash, now, now).run();
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      return failure(409, "ACCOUNT_EXISTS", "An account with that email already exists. Sign in instead.");
    }
    throw error;
  }
  return createSession(request, env.DB, user, 201);
}

export async function handleSignIn(request: Request, env: Env): Promise<Response> {
  const originError = sameOriginError(request);
  if (originError) return originError;
  const pepper = accountPepper(env);
  if (!pepper) return failure(503, "SERVER_MISCONFIGURED", "Account authentication is temporarily unavailable.");
  const body = await readJson(request, MAX_AUTH_BODY);
  if (body.response) return body.response;
  const parsed = parseAuthInput(body.value, false);
  if (!parsed.input) return parsed.response!;

  const user = await env.DB.prepare(`
    SELECT user_id, email, display_name, password_hash, failed_attempts, locked_until
    FROM app_users WHERE email = ? COLLATE NOCASE
  `).bind(parsed.input.email).first<UserAuthRow>();

  if (!user) {
    await hashAccountPassword(parsed.input.password, pepper, new Uint8Array(16));
    return failure(401, "INVALID_CREDENTIALS", "The email or password is incorrect.");
  }

  const now = new Date();
  if (user.locked_until && user.locked_until > now.toISOString()) {
    return failure(429, "ACCOUNT_LOCKED", "Too many failed attempts. Try again in 15 minutes.");
  }

  const valid = await verifyAccountPassword(parsed.input.password, user.password_hash, pepper);
  if (!valid) {
    const priorAttempts = user.locked_until ? 0 : user.failed_attempts;
    const nextAttempts = priorAttempts + 1;
    const shouldLock = nextAttempts >= LOCKOUT_ATTEMPTS;
    const lockedUntil = shouldLock ? new Date(now.getTime() + LOCKOUT_MINUTES * 60_000).toISOString() : null;
    await env.DB.prepare("UPDATE app_users SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE user_id = ?")
      .bind(shouldLock ? 0 : nextAttempts, lockedUntil, now.toISOString(), user.user_id).run();
    return failure(401, "INVALID_CREDENTIALS", "The email or password is incorrect.");
  }

  await env.DB.prepare("UPDATE app_users SET failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE user_id = ?")
    .bind(now.toISOString(), user.user_id).run();
  return createSession(request, env.DB, { user_id: user.user_id, email: user.email, display_name: user.display_name });
}

export async function handleSignOut(request: Request, env: Env): Promise<Response> {
  const originError = sameOriginError(request);
  if (originError) return originError;
  const token = cookieToken(request);
  if (token) await env.DB.prepare("DELETE FROM app_sessions WHERE session_hash = ?").bind(await sha256(token)).run();
  return json({ signed_out: true }, 200, null, { "set-cookie": sessionCookie(request, "", 0) });
}

export async function handleCurrentUser(request: Request, env: Env): Promise<Response> {
  const user = await getSessionUser(request, env);
  return user ? json(user) : failure(401, "UNAUTHORIZED", "Sign in to access the registry.");
}
