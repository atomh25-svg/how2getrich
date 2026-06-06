import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";

import { canAccessMonth, getCurrentUser } from "./entitlement";
import { createCustomerPortalSession } from "./stripe";
import {
  generateH2GRDayDetailFor,
  generateSevenDayPlanFor,
  type H2GRDayDetail,
  type H2GRPlanStep,
  type Tier,
} from "./ideas-generator";

type Env = { DB?: D1Database };

const MAX_MONTH = 12;

/**
 * Pick the right tier for generation. Priority:
 *   1. Current Clerk session → that user's tier from D1
 *   2. session_id → clerk_user_id link → that user's tier
 *   3. Anonymous → "free"
 *
 * (2) covers the case where someone subscribed on Device A and is now
 * deep-linking into the URL on Device B without being signed in to
 * Clerk yet. We honor the paid month even pre-signin so they're not
 * locked out by a stale tab.
 */
async function resolveTier(
  db: D1Database | undefined,
  sessionId: string,
): Promise<{ tier: Tier; clerkUserId: string | null }> {
  const user = await getCurrentUser({ DB: db });
  if (user) return { tier: user.tier, clerkUserId: user.clerkUserId };

  if (db && sessionId) {
    const row = await db
      .prepare(
        `SELECT u.clerk_user_id, u.tier, u.current_period_end
           FROM h2gr_session_user su
           JOIN h2gr_users u ON u.clerk_user_id = su.clerk_user_id
          WHERE su.session_id = ?`,
      )
      .bind(sessionId)
      .first<{
        clerk_user_id: string;
        tier: string | null;
        current_period_end: number | null;
      }>();
    if (row) {
      const tier =
        row.tier === "basic" || row.tier === "premium"
          ? row.current_period_end != null &&
            row.current_period_end < Math.floor(Date.now() / 1000)
            ? "free"
            : row.tier
          : "free";
      return { tier, clerkUserId: row.clerk_user_id };
    }
  }
  return { tier: "free", clerkUserId: null };
}

/* -------------------------------------------------------------------------- */
/*  Plan generator + getter                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Generate (or return cached) the 30-day plan for a given (session, month).
 *
 * Month 1 is free for everyone — no auth needed, just an anonymous
 * session_id. Month 2+ requires a paid tier (basic or premium), looked
 * up from either the auth cookie or the session→email link table.
 */
export const generateH2GRPlan = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string; input: string; month?: number }) => ({
    sessionId: typeof data?.sessionId === "string" ? data.sessionId : "",
    input: typeof data?.input === "string" ? data.input : "",
    month:
      typeof data?.month === "number" && Number.isFinite(data.month)
        ? Math.max(1, Math.min(MAX_MONTH, Math.round(data.month)))
        : 1,
  }))
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; plan: H2GRPlanStep[]; cached: boolean; month: number }
      | { ok: false; reason: string }
    > => {
      const sessionId = data.sessionId.trim();
      const input = data.input.trim();
      const month = data.month;
      if (!sessionId) return { ok: false, reason: "missing-session-id" };

      const db = (env as unknown as Env).DB;

      // Gate Month 2+ behind a paid tier.
      const { tier } = await resolveTier(db, sessionId);
      if (!canAccessMonth(tier, month)) {
        return { ok: false, reason: "requires-subscription" };
      }

      // Cache hit — same session + same month + same input → return stored.
      if (db) {
        try {
          const cached = await db
            .prepare(
              `SELECT input, plan_json FROM h2gr_plans
                WHERE session_id = ? AND month = ?`,
            )
            .bind(sessionId, month)
            .first<{ input: string; plan_json: string }>();
          if (cached && cached.input === input) {
            try {
              const plan = JSON.parse(cached.plan_json) as H2GRPlanStep[];
              if (Array.isArray(plan) && plan.length === 30) {
                return { ok: true, plan, cached: true, month };
              }
            } catch {
              /* fall through */
            }
          }
        } catch (err) {
          console.error("[h2gr-plan] cache lookup failed:", err);
        }
      }

      // For Month 2+: load prior months so the generator can reference
      // what the user's already been told to do.
      let priorMonths: H2GRPlanStep[][] = [];
      if (month > 1 && db) {
        try {
          const rows = await db
            .prepare(
              `SELECT month, plan_json FROM h2gr_plans
                WHERE session_id = ? AND month < ? ORDER BY month ASC`,
            )
            .bind(sessionId, month)
            .all<{ month: number; plan_json: string }>();
          for (const r of rows.results ?? []) {
            try {
              const parsed = JSON.parse(r.plan_json) as H2GRPlanStep[];
              if (Array.isArray(parsed)) priorMonths.push(parsed);
            } catch {
              /* skip malformed */
            }
          }
        } catch (err) {
          console.error("[h2gr-plan] prior-month load failed:", err);
        }
      }

      const plan = await generateSevenDayPlanFor(input, month, priorMonths);

      if (db) {
        try {
          await db
            .prepare(
              `INSERT INTO h2gr_plans (session_id, month, input, plan_json)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(session_id, month) DO UPDATE SET
                 input = excluded.input,
                 plan_json = excluded.plan_json,
                 generated_at = unixepoch()`,
            )
            .bind(sessionId, month, input, JSON.stringify(plan))
            .run();
        } catch (err) {
          console.error("[h2gr-plan] persistence failed:", err);
        }
      }

      return { ok: true, plan, cached: false, month };
    },
  );

/**
 * Fetch-only: returns the plan for (session, month), or null if not
 * generated yet. Month 2+ still requires tier check.
 */
export const getH2GRPlan = createServerFn({ method: "GET" })
  .inputValidator((data: { sessionId: string; month?: number }) => ({
    sessionId: typeof data?.sessionId === "string" ? data.sessionId : "",
    month:
      typeof data?.month === "number" && Number.isFinite(data.month)
        ? Math.max(1, Math.min(MAX_MONTH, Math.round(data.month)))
        : 1,
  }))
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; plan: H2GRPlanStep[]; input: string; month: number }
      | { ok: false; reason: string }
    > => {
      const sessionId = data.sessionId.trim();
      const month = data.month;
      if (!sessionId) return { ok: false, reason: "missing-session-id" };

      const db = (env as unknown as Env).DB;
      if (!db) return { ok: false, reason: "no-db" };

      const { tier } = await resolveTier(db, sessionId);
      if (!canAccessMonth(tier, month)) {
        return { ok: false, reason: "requires-subscription" };
      }

      const row = await db
        .prepare(
          `SELECT input, plan_json FROM h2gr_plans
            WHERE session_id = ? AND month = ?`,
        )
        .bind(sessionId, month)
        .first<{ input: string; plan_json: string }>();
      if (!row) return { ok: false, reason: "not-found" };

      try {
        const plan = JSON.parse(row.plan_json) as H2GRPlanStep[];
        // A legacy 7-day cached plan would render as a broken month
        // (days 1-7 then jump to 31). Treat shorter plans as a cache
        // miss so the caller regenerates a full 30-day plan.
        if (!Array.isArray(plan) || plan.length < 30) {
          return { ok: false, reason: "stale-plan-length" };
        }
        return { ok: true, plan, input: row.input, month };
      } catch {
        return { ok: false, reason: "bad-json" };
      }
    },
  );

/* -------------------------------------------------------------------------- */
/*  Per-day detail (clicked from /todo into /todo/$day)                       */
/* -------------------------------------------------------------------------- */

export const getH2GRDayDetail = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { sessionId: string; dayNumber: number; month?: number }) => ({
      sessionId: typeof data?.sessionId === "string" ? data.sessionId : "",
      dayNumber:
        typeof data?.dayNumber === "number" && Number.isFinite(data.dayNumber)
          ? Math.max(1, Math.min(30, Math.round(data.dayNumber)))
          : 0,
      month:
        typeof data?.month === "number" && Number.isFinite(data.month)
          ? Math.max(1, Math.min(MAX_MONTH, Math.round(data.month)))
          : 1,
    }),
  )
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; detail: H2GRDayDetail; cached: boolean; tier: Tier }
      | { ok: false; reason: string }
    > => {
      const { sessionId, dayNumber, month } = data;
      if (!sessionId) return { ok: false, reason: "missing-session-id" };
      if (!dayNumber) return { ok: false, reason: "missing-day-number" };

      const db = (env as unknown as Env).DB;
      if (!db) return { ok: false, reason: "no-db" };

      const { tier } = await resolveTier(db, sessionId);
      if (!canAccessMonth(tier, month)) {
        return { ok: false, reason: "requires-subscription" };
      }

      // Cache hit — same (session, month, day) AT THE SAME TIER. If the
      // user upgraded free → premium we don't want to serve them the
      // shallow cached version, so we key the cache on tier too.
      try {
        const cached = await db
          .prepare(
            `SELECT detail_json, tier FROM h2gr_day_details
              WHERE session_id = ? AND month = ? AND day_number = ?`,
          )
          .bind(sessionId, month, dayNumber)
          .first<{ detail_json: string; tier: string }>();
        if (cached && cached.tier === tier) {
          try {
            const detail = JSON.parse(cached.detail_json) as H2GRDayDetail;
            if (Array.isArray(detail.steps) && detail.steps.length > 0) {
              return { ok: true, detail, cached: true, tier };
            }
          } catch {
            /* fall through */
          }
        }
      } catch (err) {
        console.error("[h2gr-day-detail] cache lookup failed:", err);
      }

      const planRow = await db
        .prepare(
          `SELECT input, plan_json FROM h2gr_plans
            WHERE session_id = ? AND month = ?`,
        )
        .bind(sessionId, month)
        .first<{ input: string; plan_json: string }>();
      if (!planRow) return { ok: false, reason: "no-plan" };

      let plan: H2GRPlanStep[] = [];
      try {
        plan = JSON.parse(planRow.plan_json) as H2GRPlanStep[];
      } catch {
        return { ok: false, reason: "bad-plan-json" };
      }
      if (!Array.isArray(plan) || plan.length < dayNumber) {
        return { ok: false, reason: "plan-too-short" };
      }

      const detail = await generateH2GRDayDetailFor(
        planRow.input,
        plan,
        dayNumber,
        tier,
      );

      try {
        await db
          .prepare(
            `INSERT INTO h2gr_day_details
               (session_id, month, day_number, detail_json, tier)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(session_id, month, day_number) DO UPDATE SET
               detail_json = excluded.detail_json,
               tier = excluded.tier,
               generated_at = unixepoch()`,
          )
          .bind(sessionId, month, dayNumber, JSON.stringify(detail), tier)
          .run();
      } catch (err) {
        console.error("[h2gr-day-detail] persistence failed:", err);
      }

      return { ok: true, detail, cached: false, tier };
    },
  );

/* -------------------------------------------------------------------------- */
/*  Read-only: what tier is the current visitor + what months exist           */
/* -------------------------------------------------------------------------- */

/**
 * Used by /todo to render the right "Continue to Month N" CTA without
 * leaking server-fn-call boilerplate into the React component.
 */
export const getH2GRStatus = createServerFn({ method: "GET" })
  .inputValidator((data: { sessionId: string }) => ({
    sessionId: typeof data?.sessionId === "string" ? data.sessionId : "",
  }))
  .handler(
    async ({
      data,
    }): Promise<{
      tier: Tier;
      clerkUserId: string | null;
      monthsGenerated: number[];
    }> => {
      const sessionId = data.sessionId.trim();
      const db = (env as unknown as Env).DB;
      const { tier, clerkUserId } = await resolveTier(db, sessionId);
      let monthsGenerated: number[] = [];
      if (db && sessionId) {
        try {
          const rows = await db
            .prepare(
              `SELECT month FROM h2gr_plans WHERE session_id = ? ORDER BY month ASC`,
            )
            .bind(sessionId)
            .all<{ month: number }>();
          monthsGenerated = (rows.results ?? []).map((r) => r.month);
        } catch (err) {
          console.error("[h2gr-status] months lookup failed:", err);
        }
      }
      return { tier, clerkUserId, monthsGenerated };
    },
  );

/* -------------------------------------------------------------------------- */
/*  Plan PREVIEW (in-memory) + REPLACE (commit) — used when a paid user       */
/*  generates a new plan from the homepage. The preview lets them see the    */
/*  new plan WITHOUT clobbering their existing one; the replace happens only */
/*  when they explicitly click "Choose This Plan."                            */
/* -------------------------------------------------------------------------- */

/**
 * Generate a 30-day plan from the given input WITHOUT persisting. Used
 * by /todo when a paid user submits the homepage form again — we want
 * to render a preview so they can decide whether to keep their current
 * plan or swap to this new one. No D1 writes, no tier checks (the
 * caller is already paid by definition of this flow), no caching.
 */
export const generatePlanPreview = createServerFn({ method: "POST" })
  .inputValidator((data: { input: string }) => ({
    input: typeof data?.input === "string" ? data.input : "",
  }))
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; plan: H2GRPlanStep[] }
      | { ok: false; reason: string }
    > => {
      const input = data.input.trim().slice(0, 800);
      if (!input) return { ok: false, reason: "empty-input" };
      try {
        const plan = await generateSevenDayPlanFor(input, 1, []);
        return { ok: true, plan };
      } catch (err) {
        console.error("[h2gr-preview] generation failed:", err);
        return { ok: false, reason: "generation-failed" };
      }
    },
  );

/**
 * Commit a previously-previewed plan as the user's official plan.
 * Overwrites month 1 with the new (input, plan) tuple AND wipes any
 * month 2+ rows for this session, since those were generated from the
 * OLD input and would no longer be coherent extensions.
 *
 * Per-day detail rows are also wiped — they reference the prior plan's
 * day content; stale details would surface wrong text on /todo/$day.
 */
export const replaceCurrentPlan = createServerFn({ method: "POST" })
  .inputValidator((data: {
    sessionId: string;
    input: string;
    plan: H2GRPlanStep[];
  }) => ({
    sessionId: typeof data?.sessionId === "string" ? data.sessionId : "",
    input: typeof data?.input === "string" ? data.input : "",
    plan: Array.isArray(data?.plan) ? data.plan : [],
  }))
  .handler(
    async ({
      data,
    }): Promise<{ ok: true } | { ok: false; reason: string }> => {
      const { sessionId, input, plan } = data;
      if (!sessionId) return { ok: false, reason: "no-session" };
      if (!input.trim()) return { ok: false, reason: "empty-input" };
      if (!plan.length) return { ok: false, reason: "empty-plan" };

      const db = (env as unknown as Env).DB;
      if (!db) return { ok: false, reason: "no-db" };

      // Tier guard — only paid users can replace plans. Free users
      // can only ever have the initial preview-as-plan.
      const { tier } = await resolveTier(db, sessionId);
      if (tier === "free") {
        return { ok: false, reason: "requires-subscription" };
      }

      try {
        // Overwrite month 1 with the new (input, plan).
        await db
          .prepare(
            `INSERT INTO h2gr_plans (session_id, month, input, plan_json)
             VALUES (?, 1, ?, ?)
             ON CONFLICT(session_id, month) DO UPDATE SET
               input = excluded.input,
               plan_json = excluded.plan_json,
               generated_at = unixepoch()`,
          )
          .bind(sessionId, input.trim().slice(0, 800), JSON.stringify(plan))
          .run();

        // Wipe months 2+ — they were continuations of the old plan
        // and would read as discontinuous after the swap.
        await db
          .prepare(`DELETE FROM h2gr_plans WHERE session_id = ? AND month > 1`)
          .bind(sessionId)
          .run();

        // Wipe per-day detail cache for this session — stale entries
        // would surface old plan content on /todo/$day.
        await db
          .prepare(`DELETE FROM h2gr_day_details WHERE session_id = ?`)
          .bind(sessionId)
          .run();

        return { ok: true };
      } catch (err) {
        console.error("[h2gr-replace] failed:", err);
        return { ok: false, reason: "db-error" };
      }
    },
  );

/* -------------------------------------------------------------------------- */
/*  Open Stripe Customer Portal for the current user                          */
/* -------------------------------------------------------------------------- */

/**
 * Mint a Stripe Customer Portal URL for whoever's signed in. Used by
 * the /my-plan "manage subscription" link and the /account page so
 * both shortcuts go straight to Stripe in one click (no detour
 * through /account). Surfaces specific failure reasons so the UI
 * can render an actionable error instead of "did nothing happen?".
 */
export const openH2GRCustomerPortal = createServerFn({ method: "POST" })
  .handler(
    async (): Promise<
      { ok: true; url: string } | { ok: false; reason: string }
    > => {
      const user = await getCurrentUser(
        env as unknown as { DB?: D1Database },
      );
      if (!user) return { ok: false, reason: "not-signed-in" };
      if (!user.stripeCustomerId) {
        return { ok: false, reason: "no-stripe-customer" };
      }
      try {
        const origin =
          process.env.PUBLIC_ORIGIN ?? "https://how2getrich.online";
        const url = await createCustomerPortalSession(
          user.stripeCustomerId,
          `${origin}/my-plan`,
        );
        return { ok: true, url };
      } catch (err) {
        // Surface the actual Stripe error message so the user sees
        // 'No configuration provided…' (Customer Portal not enabled
        // in live mode — the #1 production cause) instead of a bare
        // 'portal-failed'. Logs the full error server-side too.
        console.error("[h2gr-portal] failed:", err);
        let message = "portal-failed";
        if (err instanceof Error) message = err.message;
        else if (typeof err === "string") message = err;
        else if (err && typeof err === "object") {
          const e = err as Record<string, unknown>;
          if (typeof e.message === "string") message = e.message;
          else if (e.raw && typeof e.raw === "object") {
            const raw = e.raw as Record<string, unknown>;
            if (typeof raw.message === "string") message = raw.message;
          }
        }
        return { ok: false, reason: message };
      }
    },
  );
