import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageLayout } from "@/components/how2getrich/PageLayout";
import {
  generateH2GRPlan,
  getH2GRPlan,
  getH2GRStatus,
} from "@/lib/h2gr-plan";
import { Wordmark } from "@/components/how2getrich/Wordmark";
import { RingLoader } from "@/components/how2getrich/RingLoader";

// Inline type so we don't pull the server-side generator module (and
// its `process.env` access) into the client bundle.
type H2GRPlanStep = { day: string; title: string; body: string };

// Each plan is 30 days. /my-plan stacks all generated months end-to-end
// and renders a flat day-numbered list (1, 2, ..., 30, 31, 32, ...).
type StackedDay = {
  day: number; // absolute day number across all months
  month: number;
  step: H2GRPlanStep;
};

export const Route = createFileRoute("/my-plan")({
  head: () => ({
    meta: [
      { title: "My Plan — how2getrich.online" },
      {
        name: "description",
        content:
          "Your unlocked 30-day plan. Scroll down to generate the next month.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    // Stripe Checkout's success_url sets ?subscribed=1 so we can show
    // a one-time welcome banner the first time the user lands here
    // after paying.
    subscribed:
      typeof search.subscribed === "string" ? search.subscribed : "",
  }),
  component: MyPlan,
});

/**
 * Screen 4 — /my-plan. The paid view.
 *
 * - Loads month 1 (days 1-30) on mount.
 * - On scroll to the bottom, generates the next month (days 31-60,
 *   then 61-90, etc.). Each generated month is appended to the
 *   `stacked` array so the user just sees an ever-growing single list.
 * - Gates on tier — if the user isn't paid we bounce them to the
 *   upgrade page so they don't see an empty/broken view.
 */
function MyPlan() {
  const { subscribed } = Route.useSearch();
  const navigate = useNavigate();

  const [stacked, setStacked] = useState<StackedDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingNext, setGeneratingNext] = useState(false);
  // How many months we've already requested. Starts at 0; each
  // successful load bumps to N. Used so the sentinel at the bottom of
  // the list triggers month N+1 generation.
  const monthsLoaded = useRef(0);

  // Fetch helpers — shared so both the initial load and the
  // infinite-scroll handler can append to the same `stacked` array.
  async function loadMonth(
    sessionId: string,
    input: string,
    month: number,
  ): Promise<H2GRPlanStep[] | { error: string }> {
    // Cache-first.
    const cached = await getH2GRPlan({ data: { sessionId, month } });
    if (cached.ok && Array.isArray(cached.plan)) return cached.plan;
    if (!cached.ok && cached.reason === "requires-subscription") {
      return { error: "requires-subscription" };
    }
    // Cache miss → generate (server handles tier check too).
    const res = await generateH2GRPlan({
      data: { sessionId, input, month },
    });
    if (res.ok && Array.isArray(res.plan)) return res.plan;
    return { error: res.ok ? "no-plan" : res.reason };
  }

  function appendMonth(month: number, plan: H2GRPlanStep[]) {
    // Use the CUMULATIVE length of what's already rendered, not a
    // `(month - 1) * 30` formula. A legacy month with fewer than 30
    // entries would otherwise leave a numbering gap (1..7 → 31..60).
    setStacked((prev) => {
      const startDay = prev.length;
      return [
        ...prev,
        ...plan.map((step, i) => ({
          day: startDay + i + 1,
          month,
          step,
        })),
      ];
    });
  }

  useEffect(() => {
    let sessionId = "";
    let input = "";
    try {
      sessionId = window.localStorage.getItem("h2gr:sessionId") ?? "";
      input = window.localStorage.getItem("h2gr:tellMeAboutYourself") ?? "";
    } catch {
      /* private mode */
    }

    // No session = redirect home so they fill the form.
    if (!sessionId) {
      navigate({ to: "/" });
      return;
    }

    let cancelled = false;
    (async () => {
      // Tier guard — non-paid users go to the upgrade page rather
      // than seeing an empty/loading view forever.
      const status = await getH2GRStatus({
        data: { sessionId },
      }).catch(() => null);
      if (cancelled) return;
      if (!status || status.tier === "free") {
        navigate({ to: "/todo/upgrade", search: { s: sessionId } });
        return;
      }

      // Load month 1.
      const month1 = await loadMonth(sessionId, input, 1);
      if (cancelled) return;
      if ("error" in month1) {
        if (month1.error === "requires-subscription") {
          navigate({ to: "/todo/upgrade", search: { s: sessionId } });
          return;
        }
        setError(`Couldn't load your plan: ${month1.error}`);
        setLoading(false);
        return;
      }
      appendMonth(1, month1);
      monthsLoaded.current = 1;
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Infinite-scroll sentinel — IntersectionObserver triggers the next
  // month's generation when it scrolls into view. Cheaper than a
  // scroll event listener.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (loading) return;
    const node = sentinelRef.current;
    if (!node) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !generatingNext) {
            void onLoadNextMonth();
          }
        }
      },
      { rootMargin: "240px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, stacked.length, generatingNext]);

  async function onLoadNextMonth() {
    if (generatingNext) return;
    const sessionId =
      typeof window !== "undefined"
        ? window.localStorage.getItem("h2gr:sessionId") ?? ""
        : "";
    const input =
      typeof window !== "undefined"
        ? window.localStorage.getItem("h2gr:tellMeAboutYourself") ?? ""
        : "";
    if (!sessionId) return;
    setGeneratingNext(true);
    try {
      const next = monthsLoaded.current + 1;
      const plan = await loadMonth(sessionId, input, next);
      if ("error" in plan) {
        // No more months to load = silently stop. Other errors get
        // surfaced.
        if (plan.error !== "no-plan") setError(`Couldn't load month ${next}: ${plan.error}`);
        return;
      }
      appendMonth(next, plan);
      monthsLoaded.current = next;
    } finally {
      setGeneratingNext(false);
    }
  }

  return (
    <PageLayout>
      {loading ? (
        <>
          <Wordmark />
          <div className="mt-[64px] flex w-full flex-col items-center justify-center">
            <RingLoader label="loading your plan…" size={120} />
          </div>
        </>
      ) : (
        <>
          <Header />

          {/* Just-paid welcome banner — shown once on the redirect from
              Stripe Checkout success_url. */}
          {subscribed === "1" && (
            <div
              className="mt-[20px] rounded-[6px] border border-amber-200/30 bg-amber-200/10 px-[18px] py-[14px] text-center text-[14px] text-amber-100"
              style={{
                fontFamily:
                  '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
              }}
            >
              you&apos;re in. scroll down to keep generating more days.
            </div>
          )}

          {error && (
            <p
              className="mt-[12px] text-[14px] text-white/40"
              style={{
                fontFamily:
                  '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
              }}
            >
              {error}
            </p>
          )}

          <ol
            className="mt-[28px] flex w-full max-w-[407px] flex-col gap-[16px] text-white/90"
            style={{
              fontFamily:
                '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
            }}
          >
            {stacked.map((item) => (
              <li key={item.day}>
                {/* Clickable into the per-day detail. day_.$day expects
                    1-30 (single month); for absolute days >30 we pass
                    the modulo so the existing detail route still works
                    on the correct day-of-month + month query param. */}
                <Link
                  to="/todo/$day"
                  params={{
                    day: String(((item.day - 1) % 30) + 1),
                  }}
                  search={{
                    s:
                      typeof window !== "undefined"
                        ? window.localStorage.getItem("h2gr:sessionId") ?? ""
                        : "",
                    month: item.month,
                  }}
                  className="group -mx-3 -my-1 flex cursor-pointer items-baseline gap-[8px] rounded-[4px] px-3 py-1 leading-snug transition hover:bg-white/[0.04]"
                >
                  <span className="w-[64px] shrink-0 text-[13.2px] text-white/55 transition group-hover:text-white/80">
                    day {item.day}:
                  </span>
                  <span className="flex-1 text-[13.6px] text-white/90 transition group-hover:text-white group-hover:underline group-hover:decoration-white/40 group-hover:underline-offset-[3px]">
                    {item.step.title}
                  </span>
                </Link>
              </li>
            ))}
          </ol>

          {/* Sentinel + status row at the bottom of the list. When the
              sentinel scrolls into view, IntersectionObserver triggers
              the next-month generation. */}
          <div
            ref={sentinelRef}
            className="mt-[36px] flex w-full justify-center"
          >
            {generatingNext ? (
              <RingLoader
                label="loading next month…"
                size={140}
                strokeWidth={3}
              />
            ) : (
              <button
                type="button"
                onClick={onLoadNextMonth}
                className="text-[14px] text-white/50 transition hover:text-white/80"
                style={{
                  fontFamily:
                    '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
                }}
              >
                load 30 more days →
              </button>
            )}
          </div>

          <div className="mt-[40px] flex w-full justify-center">
            <Link
              to="/account"
              className="text-[12.5px] text-white/40 transition hover:text-white/70"
              style={{
                fontFamily:
                  '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
              }}
            >
              manage subscription →
            </Link>
          </div>

          {/* Bottom spacer — keeps content above the fixed-position
              disclaimer footer at the viewport bottom. */}
          <div className="h-[72px] w-full shrink-0" aria-hidden />
        </>
      )}
    </PageLayout>
  );
}

function Header() {
  return (
    <div className="mt-[4px] flex w-full max-w-[420px] flex-col items-center">
      <h1
        className="text-center text-[28px] leading-none text-white"
        style={{
          fontFamily:
            '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
          letterSpacing: "0.5px",
        }}
      >
        My Plan
      </h1>
    </div>
  );
}
