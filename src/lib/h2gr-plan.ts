import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";

import { canAccessMonth, getCurrentUser } from "./entitlement";
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
 * Pick the right tier for generation. We accept either the cookie
 * user's tier OR look up by session_id → email link (so a user who
 * subscribed on Device A still gets paid output on Device B as long
 * as they sign in).
 */
async function resolveTier(
  db: D1Database | undefined,
  sessionId: string,
): Promise<{ tier: Tier; email: string | null }> {
  // First: current cookie user (authenticated).
  const user = await getCurrentUser({ DB: db });
  if (user) return { tier: user.tier, email: user.email };
  // Second: session_id → email link, then email → user.
  if (db) {
    const row = await db
      .prepare(
        `SELECT u.email, u.tier, u.current_period_end
           FROM h2gr_session_email se
           JOIN h2gr_users u ON u.email = se.email
          WHERE se.session_id = ?`,
      )
      .bind(sessionId)
      .first<{ email: string; tier: string | null; current_period_end: number | null }>();
    if (row) {
      const tier =
        row.tier === "basic" || row.tier === "premium"
          ? row.current_period_end != null &&
            row.current_period_end < Math.floor(Date.now() / 1000)
            ? "free"
            : row.tier
          : "free";
      return { tier, email: row.email };
    }
  }
  return { tier: "free", email: null };
}

/* -------------------------------------------------------------------------- */
/*  Plan generator + getter                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Generate (or return cached) the 7-day plan for a given (session, month).
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
              if (Array.isArray(plan) && plan.length === 7) {
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
        if (!Array.isArray(plan) || plan.length === 0) {
          return { ok: false, reason: "bad-plan" };
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
          ? Math.max(1, Math.min(7, Math.round(data.dayNumber)))
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
      email: string | null;
      monthsGenerated: number[];
    }> => {
      const sessionId = data.sessionId.trim();
      const db = (env as unknown as Env).DB;
      const { tier, email } = await resolveTier(db, sessionId);
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
      return { tier, email, monthsGenerated };
    },
  );
