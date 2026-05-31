// Entitlement — read the auth cookie, look up the user in D1, decide
// what they're allowed to do.
//
// Two layers:
//   1. `getCurrentEmail(request)` — pure cookie check, no DB hit.
//      Returns email if the signed cookie is valid + unexpired.
//   2. `getCurrentUser(request, env)` — adds a D1 lookup so we know
//      the current tier + period_end. Use sparingly.
//
// The "is this user allowed to access Month N?" rule:
//   - month === 1 → always yes (free lead magnet)
//   - month >= 2 → tier in {basic, premium} AND current_period_end
//                  is either NULL (Stripe hasn't sent the update yet)
//                  or in the future
//
// We don't trust the cookie's email blindly for tier — we always
// re-read from D1 because the user could have cancelled mid-session.

import { getCookie } from "@tanstack/react-start/server";

import { AUTH_COOKIE_NAME, verifySessionCookie } from "./auth";
import type { Tier } from "./stripe";

type Env = { DB?: D1Database };

export interface CurrentUser {
  email: string;
  tier: Tier;
  currentPeriodEnd: number | null;
  stripeCustomerId: string | null;
}

function getSecret(): string {
  const s = process.env.MAGIC_LINK_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "MAGIC_LINK_SECRET is missing or too short (need 16+ chars)",
    );
  }
  return s;
}

/**
 * Pull the email from the auth cookie, or null if unauth'd. Server-only.
 * Uses TanStack Start's ambient request context (AsyncLocalStorage) via
 * `getCookie`, so no Request param needed inside server fns.
 */
export async function getCurrentEmail(): Promise<string | null> {
  let cookie: string | undefined;
  try {
    cookie = getCookie(AUTH_COOKIE_NAME);
  } catch {
    // Not in a request context (e.g. called from server.ts intercept
    // before TanStack runs) — caller should pass a Request instead.
    return null;
  }
  if (!cookie) return null;
  try {
    return await verifySessionCookie(cookie, getSecret());
  } catch (err) {
    console.error("[entitlement] cookie verify failed:", err);
    return null;
  }
}

/**
 * Full user lookup: cookie → email → D1 row. Returns null if
 * unauth'd or if the cookie email isn't in our users table.
 */
export async function getCurrentUser(env: Env): Promise<CurrentUser | null> {
  const email = await getCurrentEmail();
  if (!email) return null;
  const db = env.DB;
  if (!db) return null;
  const row = await db
    .prepare(
      `SELECT email, tier, stripe_customer_id, current_period_end
         FROM h2gr_users WHERE email = ?`,
    )
    .bind(email)
    .first<{
      email: string;
      tier: string | null;
      stripe_customer_id: string | null;
      current_period_end: number | null;
    }>();
  if (!row) return null;
  return {
    email: row.email,
    tier: normalizeTier(row.tier, row.current_period_end),
    currentPeriodEnd: row.current_period_end,
    stripeCustomerId: row.stripe_customer_id,
  };
}

/**
 * Coerce a raw `tier` column to a usable Tier, downgrading to "free"
 * if the subscription has expired (current_period_end is in the past).
 */
function normalizeTier(
  raw: string | null,
  currentPeriodEnd: number | null,
): Tier {
  if (raw !== "basic" && raw !== "premium") return "free";
  if (currentPeriodEnd != null && currentPeriodEnd < Math.floor(Date.now() / 1000)) {
    return "free";
  }
  return raw;
}

/** Can this user generate / view Month N? */
export function canAccessMonth(tier: Tier, month: number): boolean {
  if (month <= 1) return true;
  return tier === "basic" || tier === "premium";
}

export const _AUTH_COOKIE_NAME = AUTH_COOKIE_NAME; // re-export for routes that set cookies
