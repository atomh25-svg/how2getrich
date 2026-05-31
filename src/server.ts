import "./lib/error-capture";

import {
  buildAuthCookieHeader,
  hashToken,
  signSessionCookie,
} from "./lib/auth";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleWebhookEvent } from "./lib/stripe";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

// Intercept the Stripe webhook before TanStack Start touches the body
// — signature verification needs the exact bytes Stripe sent, and any
// middleware that parses/re-serializes JSON in front of us would break
// the HMAC. Returns Response directly; never falls through.
async function handleStripeWebhook(
  request: Request,
  env: unknown,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const origin = new URL(request.url).origin;
  try {
    const result = await handleWebhookEvent({
      rawBody,
      signature,
      origin,
      env: env as { DB?: D1Database },
    });
    if (!result.ok) {
      console.warn("[stripe-webhook] rejected:", result.reason);
      return new Response(result.reason, { status: 400 });
    }
    return new Response(JSON.stringify({ received: true, type: result.type }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[stripe-webhook] handler threw:", err);
    return new Response("Webhook handler error", { status: 500 });
  }
}

// Magic-link verifier. Lives in server.ts (not as a React route) so
// we can set the Set-Cookie header alongside a redirect with full
// control + no SSR overhead. Flow:
//   1. Take ?token from query
//   2. Look up SHA-256(token) in h2gr_magic_links
//   3. If unused + unexpired, mark used, mint a signed session cookie,
//      redirect to /todo (or ?next= if present)
//   4. On any failure, redirect to /auth/signin?error=...
async function handleAuthVerify(
  request: Request,
  env: unknown,
): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const nextPath = sanitizeNextPath(url.searchParams.get("next"));
  const origin = url.origin;

  function failRedirect(reason: string): Response {
    return Response.redirect(
      `${origin}/auth/signin?error=${encodeURIComponent(reason)}`,
      302,
    );
  }

  if (!token) return failRedirect("missing-token");
  const db = (env as { DB?: D1Database }).DB;
  if (!db) return failRedirect("no-db");

  const tokenHash = await hashToken(token);
  const row = await db
    .prepare(
      `SELECT email, expires_at, used_at FROM h2gr_magic_links
        WHERE token_hash = ?`,
    )
    .bind(tokenHash)
    .first<{ email: string; expires_at: number; used_at: number | null }>();

  if (!row) return failRedirect("invalid-token");
  if (row.used_at != null) return failRedirect("token-already-used");
  if (row.expires_at < Math.floor(Date.now() / 1000)) {
    return failRedirect("token-expired");
  }

  // Mark used + mint the session cookie.
  await db
    .prepare(`UPDATE h2gr_magic_links SET used_at = unixepoch() WHERE token_hash = ?`)
    .bind(tokenHash)
    .run();

  const secret = process.env.MAGIC_LINK_SECRET;
  if (!secret) {
    console.error("[auth/verify] MAGIC_LINK_SECRET not set");
    return failRedirect("server-misconfigured");
  }
  const cookieValue = await signSessionCookie(row.email, secret);

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}${nextPath}`,
      "Set-Cookie": buildAuthCookieHeader(cookieValue),
    },
  });
}

// Only allow relative paths starting with /. Prevents open-redirect
// via ?next=https://evil.com.
function sanitizeNextPath(next: string | null): string {
  if (!next) return "/todo";
  if (!next.startsWith("/") || next.startsWith("//")) return "/todo";
  return next;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    if (url.pathname === "/api/stripe/webhook") {
      return handleStripeWebhook(request, env);
    }
    if (url.pathname === "/auth/verify") {
      return handleAuthVerify(request, env);
    }
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
