// Auth primitives for how2getrich. We have two kinds of credentials:
//
// 1. **Magic-link tokens** — opaque random strings emailed to a user
//    after they pay or request sign-in. The plain token rides the
//    URL; we store only SHA-256(token) in D1 so a DB leak doesn't
//    grant access. One-time use, 15min expiry.
//
// 2. **Session cookies** — HMAC-signed `{email, iat, exp}` payload.
//    Set after a magic link is consumed. Lets us identify the user
//    without hitting D1 on every request (we only query when we
//    actually need the tier). 30-day expiry, sliding.
//
// Crypto: WebCrypto SubtleCrypto, available in Cloudflare Workers
// runtime. No node:crypto needed.

const COOKIE_NAME = "__Secure-h2gr_auth";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const MAGIC_LINK_TTL_SECONDS = 60 * 15; // 15 minutes

// ──────────────────────────────────────────────────────────
// Hex / base64url helpers (WebCrypto returns ArrayBuffers)
// ──────────────────────────────────────────────────────────

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bufToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBuf(b64url: string): ArrayBuffer {
  const b64 = b64url.replaceAll("-", "+").replaceAll("_", "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function stringToBuf(s: string): ArrayBuffer {
  return new TextEncoder().encode(s).buffer as ArrayBuffer;
}

function bufToString(buf: ArrayBuffer): string {
  return new TextDecoder().decode(buf);
}

// Constant-time string compare so signature checks don't leak length
// or position via timing. Returns false on length mismatch.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// ──────────────────────────────────────────────────────────
// Magic-link tokens (opaque, DB-backed)
// ──────────────────────────────────────────────────────────

/**
 * Generate a fresh magic-link token. Returns `{ token, tokenHash }`.
 * Store the hash; email the plain token in the URL.
 */
export async function createMagicLinkToken(): Promise<{
  token: string;
  tokenHash: string;
  expiresAt: number;
}> {
  // 32 bytes of randomness → 43-char base64url. Plenty of entropy.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = bufToBase64Url(bytes.buffer);
  const tokenHash = await hashToken(token);
  const expiresAt = Math.floor(Date.now() / 1000) + MAGIC_LINK_TTL_SECONDS;
  return { token, tokenHash, expiresAt };
}

/** SHA-256 of the token, hex-encoded. Stable for DB indexing. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", stringToBuf(token));
  return bufToHex(digest);
}

// ──────────────────────────────────────────────────────────
// Session cookies (HMAC-signed payload, stateless)
// ──────────────────────────────────────────────────────────

interface SessionPayload {
  email: string;
  iat: number; // issued at (unix seconds)
  exp: number; // expires at (unix seconds)
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    stringToBuf(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, stringToBuf(data));
  return bufToBase64Url(sig);
}

/**
 * Sign a session payload into a compact `payload.signature` string.
 * Payload is base64url(JSON); signature is HMAC-SHA256 of the payload.
 */
export async function signSessionCookie(
  email: string,
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    email,
    iat: now,
    exp: now + COOKIE_MAX_AGE_SECONDS,
  };
  const encodedPayload = bufToBase64Url(stringToBuf(JSON.stringify(payload)));
  const signature = await hmacSign(secret, encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * Verify a session cookie string and return the email if valid.
 * Returns null on missing, malformed, bad signature, or expired.
 */
export async function verifySessionCookie(
  cookieValue: string | undefined,
  secret: string,
): Promise<string | null> {
  if (!cookieValue) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  const expectedSig = await hmacSign(secret, encodedPayload);
  if (!timingSafeEqual(signature, expectedSig)) return null;
  try {
    const payload = JSON.parse(
      bufToString(base64UrlToBuf(encodedPayload)),
    ) as SessionPayload;
    if (typeof payload.email !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.email;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────
// Cookie header helpers
// ──────────────────────────────────────────────────────────

/** Parse the auth cookie value out of a `Cookie:` header. */
export function readAuthCookie(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === COOKIE_NAME) return rest.join("=");
  }
  return undefined;
}

/**
 * Build the Set-Cookie header value for the session cookie. Uses
 * __Secure- prefix → forces Secure flag, HTTPS-only, no JS access.
 */
export function buildAuthCookieHeader(signedValue: string): string {
  return [
    `${COOKIE_NAME}=${signedValue}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
  ].join("; ");
}

/** Build an expiring Set-Cookie header to log out. */
export function buildAuthCookieClearHeader(): string {
  return [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0",
  ].join("; ");
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;
export const MAGIC_LINK_TTL = MAGIC_LINK_TTL_SECONDS;
