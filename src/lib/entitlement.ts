// Entitlement — read the Clerk-authenticated user, look up their tier
// in D1, decide what they're allowed to do.
//
// Server-side only. Call from inside `createServerFn(...).handler`,
// route loaders, or the Stripe webhook (where we have request context).
//
// The "is this user allowed to access Month N?" rule:
//   - month === 1 → always yes (free lead magnet, even unauthenticated)
//   - month >= 2 → tier in {basic, premium} AND current_period_end
//                  is either NULL (Stripe hasn't sent the update yet)
//                  or in the future
//
// We don't trust the Clerk session for tier — we always re-read from D1
// because the user could have cancelled mid-session.

import { auth, clerkClient } from "@clerk/tanstack-react-start/server";

import type { Tier } from "./stripe";

type Env = { DB?: D1Database };

export interface CurrentUser {
  clerkUserId: string;
  email: string;
  tier: Tier;
  currentPeriodEnd: number | null;
  stripeCustomerId: string | null;
}

/**
 * The signed-in user from Clerk, or null if unauthenticated. Does NOT
 * hit D1 — use `getCurrentUser` for that. Cheap, safe to call often.
 */
export async function getCurrentClerkUserId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    return userId ?? null;
  } catch {
    // Outside of a request context (e.g. called from server.ts intercept
    // before Clerk middleware runs).
    return null;
  }
}

/**
 * Full user resolution: Clerk session → D1 row → tier. Returns null
 * when unauthenticated. Returns a `tier: 'free'` row when the user is
 * signed in but has never paid (no h2gr_users row yet) — we still need
 * to know their email/clerkUserId in that case.
 */
export async function getCurrentUser(env: Env): Promise<CurrentUser | null> {
  const clerkUserId = await getCurrentClerkUserId();
  if (!clerkUserId) return null;

  const db = env.DB;
  let row:
    | {
        email: string;
        tier: string | null;
        stripe_customer_id: string | null;
        current_period_end: number | null;
      }
    | null = null;
  if (db) {
    row = await db
      .prepare(
        `SELECT email, tier, stripe_customer_id, current_period_end
           FROM h2gr_users WHERE clerk_user_id = ?`,
      )
      .bind(clerkUserId)
      .first<{
        email: string;
        tier: string | null;
        stripe_customer_id: string | null;
        current_period_end: number | null;
      }>();
  }

  // Signed in but never paid → fetch email from Clerk so the caller has
  // something to use for Stripe Checkout pre-fill.
  if (!row) {
    const email = await fetchClerkPrimaryEmail(clerkUserId);
    if (!email) return null; // Clerk lookup failed; refuse rather than guess
    return {
      clerkUserId,
      email,
      tier: "free",
      currentPeriodEnd: null,
      stripeCustomerId: null,
    };
  }

  return {
    clerkUserId,
    email: row.email,
    tier: normalizeTier(row.tier, row.current_period_end),
    currentPeriodEnd: row.current_period_end,
    stripeCustomerId: row.stripe_customer_id,
  };
}

/**
 * Pull the user's primary email address from Clerk. Used during
 * Checkout-session creation (so Stripe collects the right email) and
 * during webhook handling (so we have an email even if the user never
 * paid before).
 */
export async function fetchClerkPrimaryEmail(
  clerkUserId: string,
): Promise<string | null> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkUserId);
    const primaryId = user.primaryEmailAddressId;
    const primary = user.emailAddresses.find((e) => e.id === primaryId);
    return primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
  } catch (err) {
    console.error("[entitlement] clerk user lookup failed:", err);
    return null;
  }
}

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
