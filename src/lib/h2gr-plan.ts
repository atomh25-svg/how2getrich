import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import {
  generateH2GRDayDetailFor,
  generateSevenDayPlanFor,
  type H2GRDayDetail,
  type H2GRPlanStep,
} from "./ideas-generator";

type Env = { DB?: D1Database };

/**
 * Server function for the how2getrich 7-day plan.
 *
 * Persists each (session_id → input + plan) row in D1 so reloading the
 * /todo page or copying the URL to another device returns the same
 * tailored plan instead of re-billing Claude. The session_id is just
 * a UUID the client generates on submit — no auth, no email, anonymous.
 *
 * Flow:
 *  1. Client posts { sessionId, input } from /
 *  2. We compute the plan via generateSevenDayPlanFor (Claude or
 *     static fallback) and INSERT OR REPLACE into h2gr_plans
 *  3. Client navigates to /todo?s={sessionId}, calls getH2GRPlan
 *     with the same id, and renders whatever we stored.
 */
export const generateH2GRPlan = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string; input: string }) => ({
    sessionId: typeof data?.sessionId === "string" ? data.sessionId : "",
    input: typeof data?.input === "string" ? data.input : "",
  }))
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; plan: H2GRPlanStep[]; cached: boolean }
      | { ok: false; reason: string }
    > => {
      const sessionId = data.sessionId.trim();
      const input = data.input.trim();
      if (!sessionId) return { ok: false, reason: "missing-session-id" };

      const db = (env as unknown as Env).DB;

      // Cache hit — same session_id + same input → return the stored plan.
      if (db) {
        try {
          const cached = await db
            .prepare(
              `SELECT input, plan_json FROM h2gr_plans WHERE session_id = ?`,
            )
            .bind(sessionId)
            .first<{ input: string; plan_json: string }>();
          if (cached && cached.input === input) {
            try {
              const plan = JSON.parse(cached.plan_json) as H2GRPlanStep[];
              if (Array.isArray(plan) && plan.length === 7) {
                return { ok: true, plan, cached: true };
              }
            } catch {
              // bad JSON in DB — fall through and regenerate
            }
          }
        } catch (err) {
          console.error("[h2gr-plan] cache lookup failed:", err);
        }
      }

      const plan = await generateSevenDayPlanFor(input);

      if (db) {
        try {
          await db
            .prepare(
              `INSERT INTO h2gr_plans (session_id, input, plan_json)
               VALUES (?, ?, ?)
               ON CONFLICT(session_id) DO UPDATE SET
                 input = excluded.input,
                 plan_json = excluded.plan_json,
                 generated_at = unixepoch()`,
            )
            .bind(sessionId, input, JSON.stringify(plan))
            .run();
        } catch (err) {
          console.error("[h2gr-plan] persistence failed:", err);
          // Non-fatal — still return the plan, just don't cache.
        }
      }

      return { ok: true, plan, cached: false };
    },
  );

/**
 * Fetch-only: returns whatever's in D1 for this session_id, or null
 * if there's nothing yet. Used by /todo when the user lands with a
 * session_id in the URL after the form on / has already POSTed.
 */
export const getH2GRPlan = createServerFn({ method: "GET" })
  .inputValidator((data: { sessionId: string }) => ({
    sessionId: typeof data?.sessionId === "string" ? data.sessionId : "",
  }))
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; plan: H2GRPlanStep[]; input: string }
      | { ok: false; reason: string }
    > => {
      const sessionId = data.sessionId.trim();
      if (!sessionId) return { ok: false, reason: "missing-session-id" };

      const db = (env as unknown as Env).DB;
      if (!db) return { ok: false, reason: "no-db" };

      const row = await db
        .prepare(
          `SELECT input, plan_json FROM h2gr_plans WHERE session_id = ?`,
        )
        .bind(sessionId)
        .first<{ input: string; plan_json: string }>();
      if (!row) return { ok: false, reason: "not-found" };

      try {
        const plan = JSON.parse(row.plan_json) as H2GRPlanStep[];
        if (!Array.isArray(plan) || plan.length === 0) {
          return { ok: false, reason: "bad-plan" };
        }
        return { ok: true, plan, input: row.input };
      } catch {
        return { ok: false, reason: "bad-json" };
      }
    },
  );

/* -------------------------------------------------------------------------- */
/*  Per-day detail (clicked from /todo into /todo/$day)                       */
/* -------------------------------------------------------------------------- */

/**
 * Generates (or returns from cache) the expanded breakdown for ONE day
 * of the user's 7-day plan. Loads the user's input + plan from D1 by
 * session_id so each detail can reference what they actually said.
 */
export const getH2GRDayDetail = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string; dayNumber: number }) => ({
    sessionId: typeof data?.sessionId === "string" ? data.sessionId : "",
    dayNumber:
      typeof data?.dayNumber === "number" && Number.isFinite(data.dayNumber)
        ? Math.max(1, Math.min(7, Math.round(data.dayNumber)))
        : 0,
  }))
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; detail: H2GRDayDetail; cached: boolean }
      | { ok: false; reason: string }
    > => {
      const { sessionId, dayNumber } = data;
      if (!sessionId) return { ok: false, reason: "missing-session-id" };
      if (!dayNumber) return { ok: false, reason: "missing-day-number" };

      const db = (env as unknown as Env).DB;
      if (!db) return { ok: false, reason: "no-db" };

      // Cache hit — instant, free.
      try {
        const cached = await db
          .prepare(
            `SELECT detail_json FROM h2gr_day_details
              WHERE session_id = ? AND day_number = ?`,
          )
          .bind(sessionId, dayNumber)
          .first<{ detail_json: string }>();
        if (cached) {
          try {
            const detail = JSON.parse(cached.detail_json) as H2GRDayDetail;
            if (Array.isArray(detail.steps) && detail.steps.length > 0) {
              return { ok: true, detail, cached: true };
            }
          } catch {
            /* bad JSON — fall through and regenerate */
          }
        }
      } catch (err) {
        console.error("[h2gr-day-detail] cache lookup failed:", err);
      }

      // Need the user's input + plan to generate a tailored detail.
      const planRow = await db
        .prepare(
          `SELECT input, plan_json FROM h2gr_plans WHERE session_id = ?`,
        )
        .bind(sessionId)
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
      );

      try {
        await db
          .prepare(
            `INSERT INTO h2gr_day_details (session_id, day_number, detail_json)
             VALUES (?, ?, ?)
             ON CONFLICT(session_id, day_number) DO UPDATE SET
               detail_json = excluded.detail_json,
               generated_at = unixepoch()`,
          )
          .bind(sessionId, dayNumber, JSON.stringify(detail))
          .run();
      } catch (err) {
        console.error("[h2gr-day-detail] persistence failed:", err);
      }

      return { ok: true, detail, cached: false };
    },
  );
