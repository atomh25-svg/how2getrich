import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { SignInButton, useUser } from "@clerk/tanstack-react-start";
import { PageLayout } from "@/components/how2getrich/PageLayout";
import { DottedSpine } from "@/components/how2getrich/DottedSpine";
import {
  generateH2GRPlan,
  generatePlanPreview,
  getH2GRPlan,
  getH2GRStatus,
  replaceCurrentPlan,
} from "@/lib/h2gr-plan";
import { createCheckoutSession } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/entitlement";
import { RingLoader } from "@/components/how2getrich/RingLoader";
import { Wordmark } from "@/components/how2getrich/Wordmark";

// ──────────────────────────────────────────────────────────
// Server fn: mint a Stripe Checkout session, return its URL.
// Inlined here (previously lived on /todo/upgrade which has been
// removed — the "$9.99 Full Plan" button now goes straight to
// Stripe instead of an intermediate paywall screen).
// ──────────────────────────────────────────────────────────

const startCheckout = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { sessionId: string; returnPath?: string }) => ({
      sessionId: typeof data?.sessionId === "string" ? data.sessionId : "",
      returnPath:
        typeof data?.returnPath === "string" ? data.returnPath : "/my-plan",
    }),
  )
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; url: string } | { ok: false; reason: string }> => {
      const user = await getCurrentUser(env as unknown as { DB?: D1Database });
      if (!user) return { ok: false, reason: "not-signed-in" };

      const origin = process.env.PUBLIC_ORIGIN ?? "https://how2getrich.online";
      try {
        const url = await createCheckoutSession({
          tier: "basic",
          clerkUserId: user.clerkUserId,
          email: user.email,
          sessionId: data.sessionId,
          existingCustomerId: user.stripeCustomerId ?? undefined,
          successUrl: `${origin}${data.returnPath}?subscribed=1`,
          cancelUrl: `${origin}/todo?s=${encodeURIComponent(data.sessionId)}`,
        });
        return { ok: true, url };
      } catch (err) {
        console.error(
          "[checkout] failed:",
          err instanceof Error
            ? `${err.name}: ${err.message}\n${err.stack}`
            : String(err),
        );
        const message =
          err instanceof Error ? err.message : String(err);
        return { ok: false, reason: `stripe: ${message.slice(0, 200)}` };
      }
    },
  );

// Inline type + static fallback so this route doesn't pull the
// server-side ideas-generator module (and its `process.env` access)
// into the client bundle. The server function returns the same shape.
type H2GRPlanStep = { day: string; title: string; body: string };
// Initial render state — replaced by the API-generated plan within ~1s.
// Mirrors the 4-phase 30-day arc in src/lib/ideas-generator.ts so the
// fallback still reads cleanly if the API call ever fails outright.
const STATIC_PLAN: H2GRPlanStep[] = [
  // Phase 1 — Validate & shape the offer
  { day: "day 1", title: "Pick one boring skill people pay for", body: "" },
  { day: "day 2", title: "Pick one specific painful customer", body: "" },
  { day: "day 3", title: "Find 20 people already getting paid", body: "" },
  { day: "day 4", title: "Write the dumbest possible offer", body: "" },
  { day: "day 5", title: "Build a one-page Carrd site", body: "" },
  { day: "day 6", title: "Make one tiny sample result", body: "" },
  { day: "day 7", title: "Send the offer to 25 real people", body: "" },
  // Phase 2 — First paying customer
  { day: "day 8", title: "Re-read the 25 replies, cut the noise", body: "" },
  { day: "day 9", title: "Follow up with the 3 warmest maybes", body: "" },
  { day: "day 10", title: "Productize: fixed scope, fixed price", body: "" },
  { day: "day 11", title: "Ship one upgrade based on feedback", body: "" },
  { day: "day 12", title: "Send the new offer to 25 more", body: "" },
  { day: "day 13", title: "Ask your first paying customer for a quote", body: "" },
  { day: "day 14", title: "Post your first build-in-public update", body: "" },
  // Phase 3 — Repeat & raise prices
  { day: "day 15", title: "Reach 25 people in a second niche", body: "" },
  { day: "day 16", title: "Land customer #2, same script", body: "" },
  { day: "day 17", title: "Post 'how I got my first $X' to a subreddit", body: "" },
  { day: "day 18", title: "Land customer #3, kill the fluke fear", body: "" },
  { day: "day 19", title: "Raise prices 20% on the next lead", body: "" },
  { day: "day 20", title: "Set up Stripe Payment Link or Gumroad", body: "" },
  { day: "day 21", title: "Automate the most annoying step", body: "" },
  // Phase 4 — Compound & systematize
  { day: "day 22", title: "Launch in one new distribution channel", body: "" },
  { day: "day 23", title: "Start a tiny email list on ConvertKit", body: "" },
  { day: "day 24", title: "Batch a week of social content", body: "" },
  { day: "day 25", title: "Add a referral mechanic", body: "" },
  { day: "day 26", title: "DM 5 micro-influencers in the niche", body: "" },
  { day: "day 27", title: "Document onboarding for customer #10", body: "" },
  { day: "day 28", title: "Audit where people drop off the funnel", body: "" },
  { day: "day 29", title: "Write your month-1 retrospective post", body: "" },
  { day: "day 30", title: "Decide: KEEP, KILL, or DOUBLE-DOWN", body: "" },
];

export const Route = createFileRoute("/todo")({
  head: () => ({
    meta: [
      { title: "To Do — how2getrich.online" },
      { name: "description", content: "Your tailored 30-day plan." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    s: typeof search.s === "string" ? search.s : "",
    // Which month's plan we're viewing. 1 = the free lead magnet.
    // 2+ requires a paid tier and gets gated server-side.
    month:
      typeof search.month === "number"
        ? Math.max(1, Math.min(12, Math.round(search.month)))
        : typeof search.month === "string" && /^\d+$/.test(search.month)
          ? Math.max(1, Math.min(12, parseInt(search.month, 10)))
          : 1,
    // Set to "1" by Stripe Checkout's success_url so we can show a
    // welcome banner the first time the user lands here after paying.
    subscribed:
      typeof search.subscribed === "string" ? search.subscribed : "",
    // Set to "new" by the homepage form submit. Tells /todo that the
    // user just submitted fresh input — paid users see a 10-day
    // preview + 'Choose This Plan' instead of being auto-bounced to
    // /my-plan.
    intent: typeof search.intent === "string" ? search.intent : "",
  }),
  component: TodoPlan,
});

/**
 * Screen 2 — the tailored 30-day plan. After the user submits Screen 1
 * they land here. The plan is generated by Claude via the
 * generateH2GRPlan server function (reusing the same Anthropic API
 * pipeline that powers the LaunchFly Blueprint generator) and cached
 * in localStorage so we don't burn tokens regenerating on every
 * navigation.
 *
 * Layout: same chrome as Screen 1 (sidebar + right spine + "More info →")
 * with the plan rendered as a list, and the "Get year-long →" upsell
 * tucked at the bottom.
 */

function TodoPlan() {
  // session_id from the ?s= query param (or localStorage as a backup,
  // for users who hit /todo directly without coming from /).
  const { s: sessionIdFromUrl, month, subscribed, intent } = Route.useSearch();
  const navigate = useNavigate();
  const { isSignedIn, isLoaded: clerkLoaded } = useUser();
  const [checkoutPending, setCheckoutPending] = useState(false);
  const autoResumedCheckout = useRef(false);

  // Echo the user's answer back at the top of the plan once we have it.
  const [tellMe, setTellMe] = useState<string>("");
  const [plan, setPlan] = useState<H2GRPlanStep[]>(STATIC_PLAN);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Tier-aware state for the CTA + "what month am I on" header.
  const [tier, setTier] = useState<"free" | "basic" | "premium">("free");
  const [monthsGenerated, setMonthsGenerated] = useState<number[]>([]);
  const [generatingNextMonth, setGeneratingNextMonth] = useState(false);
  // Set when a paid user lands here with intent=new — they're previewing
  // a NEW plan generated from fresh homepage input. The plan in state is
  // in-memory only (not persisted) until they click "Choose This Plan".
  const [previewMode, setPreviewMode] = useState(false);
  const [committingChoice, setCommittingChoice] = useState(false);
  // Styled confirm modal (replaces native window.confirm) — only opens
  // when the paid user clicks "Choose This Plan" so they explicitly
  // re-confirm before we overwrite their existing plan.
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  useEffect(() => {
    let sessionId = sessionIdFromUrl;
    let input = "";
    try {
      if (!sessionId) sessionId = window.localStorage.getItem("h2gr:sessionId") ?? "";
      input = window.localStorage.getItem("h2gr:tellMeAboutYourself") ?? "";
    } catch {
      /* private mode */
    }
    setTellMe(input);

    // If we have neither a session nor an input, there's nothing to
    // generate — leave the static plan visible.
    if (!sessionId && !input) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // Kick off the tier/months lookup in parallel so the CTA is
        // accurate as soon as the plan finishes loading.
        const statusPromise = sessionId
          ? getH2GRStatus({ data: { sessionId } }).catch(() => null)
          : Promise.resolve(null);

        // === PAID + intent=new path ===
        // Paid user submitted fresh input from the homepage. Generate
        // an in-memory preview WITHOUT persisting; if they click
        // "Choose This Plan" we commit it via replaceCurrentPlan.
        // We resolve status first so we don't run the preview path for
        // a free user with intent=new (they should see the normal
        // free preview + paywall instead).
        if (intent === "new" && input) {
          const status = await statusPromise;
          if (cancelled) return;
          const isPaid =
            status &&
            (status.tier === "basic" || status.tier === "premium");
          if (isPaid) {
            // Set tier WITHOUT going through applyStatus — applyStatus
            // bounces paid users to /my-plan, which is exactly what
            // we're trying to avoid here. The preview is in-memory and
            // shouldn't redirect.
            setTier(status.tier);
            setMonthsGenerated(status.monthsGenerated);
            const preview = await generatePlanPreview({
              data: { input },
            });
            if (cancelled) return;
            if (preview.ok && Array.isArray(preview.plan)) {
              setPlan(preview.plan);
              setPreviewMode(true);
            } else {
              setError(
                `Couldn't generate a preview: ${
                  preview.ok ? "unknown" : preview.reason
                }`,
              );
            }
            setLoading(false);
            return;
          }
        }

        // Try the persisted plan first — same session id + month returns
        // the exact plan we already paid Claude for.
        if (sessionId) {
          const cached = await getH2GRPlan({ data: { sessionId, month } });
          if (cancelled) return;
          if (cached.ok && Array.isArray(cached.plan)) {
            setPlan(cached.plan);
            if (cached.input) setTellMe(cached.input);
            await applyStatus(await statusPromise);
            setLoading(false);
            return;
          }
          if (!cached.ok && cached.reason === "requires-subscription") {
            // Free user deep-linked into a paid month. The upgrade
            // interstitial has been retired — leave them on /todo
            // showing the static preview + the "$9.99 Full Plan"
            // button (which now opens Stripe Checkout directly).
            setLoading(false);
            return;
          }
        }

        // Cache miss → generate + persist. Server handles the Claude
        // call and writes to D1 for future loads.
        const res = await generateH2GRPlan({
          data: { sessionId: sessionId ?? "", input, month },
        });
        if (cancelled) return;
        if (res.ok && Array.isArray(res.plan)) setPlan(res.plan);
        // requires-subscription: fall through and show the free
        // preview + the paywall CTA below. No upgrade page to redirect
        // to anymore.
        await applyStatus(await statusPromise);
      } catch (err) {
        if (cancelled) return;
        console.error("[todo] plan generation failed", err);
        setError("Couldn't reach the plan generator — showing the default plan.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // eslint-disable-next-line @typescript-eslint/no-inner-declarations
    async function applyStatus(
      status: { tier: "free" | "basic" | "premium"; monthsGenerated: number[] } | null,
    ) {
      if (cancelled || !status) return;
      setTier(status.tier);
      setMonthsGenerated(status.monthsGenerated);
      // Paid users should never see /todo (it's the 10-day preview +
      // paywall for free users). Bounce them to the full /my-plan view.
      if (status.tier === "basic" || status.tier === "premium") {
        navigate({ to: "/my-plan" });
      }
    }

    return () => {
      cancelled = true;
    };
  }, [sessionIdFromUrl, month, navigate]);

  // Open Stripe Checkout for the $9.99 Full Plan. Called by the
  // paywall CTA below (or auto-resumed after Clerk sign-in).
  async function openCheckout() {
    if (checkoutPending) return;
    const sessionId =
      sessionIdFromUrl ||
      (typeof window !== "undefined"
        ? window.localStorage.getItem("h2gr:sessionId") ?? ""
        : "");
    setCheckoutPending(true);
    try {
      const result = await startCheckout({
        data: { sessionId, returnPath: "/my-plan" },
      });
      if (result.ok) {
        window.location.href = result.url;
      } else if (result.reason === "not-signed-in") {
        window.alert("Sign in first — the button below opens the sign-in.");
      } else {
        window.alert(`Couldn't open checkout: ${result.reason}`);
      }
    } finally {
      setCheckoutPending(false);
    }
  }

  // Auto-resume checkout after Clerk sign-in redirect. The paywall
  // <SignInButton> sets forceRedirectUrl to /todo?intent=basic; once
  // Clerk resolves signed-in, fire checkout and drop the intent from
  // the URL so a refresh doesn't loop.
  useEffect(() => {
    if (autoResumedCheckout.current) return;
    if (!clerkLoaded || !isSignedIn) return;
    if (intent !== "basic") return;
    autoResumedCheckout.current = true;
    navigate({
      to: "/todo",
      search: { s: sessionIdFromUrl, month, subscribed, intent: "" },
      replace: true,
    });
    openCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clerkLoaded, isSignedIn, intent]);

  // Generate Month N+1 on demand (subscribers only).
  async function onGenerateNextMonth() {
    const sessionId =
      sessionIdFromUrl ||
      (typeof window !== "undefined"
        ? window.localStorage.getItem("h2gr:sessionId") ?? ""
        : "");
    if (!sessionId || generatingNextMonth) return;
    const input =
      typeof window !== "undefined"
        ? window.localStorage.getItem("h2gr:tellMeAboutYourself") ?? ""
        : "";
    setGeneratingNextMonth(true);
    try {
      const nextMonth = month + 1;
      const res = await generateH2GRPlan({
        data: { sessionId, input, month: nextMonth },
      });
      if (res.ok) {
        navigate({
          to: "/todo",
          search: { s: sessionId, month: nextMonth },
        });
      } else if (res.reason === "requires-subscription") {
        // Shouldn't happen — this button only shows for subscribed
        // users. Prompt them to re-check their subscription state.
        window.alert(
          "This action needs an active subscription. Reload the page or check /account.",
        );
      } else {
        window.alert(`Couldn't generate Month ${nextMonth}: ${res.reason}`);
      }
    } finally {
      setGeneratingNextMonth(false);
    }
  }

  const isSubscribed = tier === "basic" || tier === "premium";
  const nextMonth = month + 1;
  const nextMonthExists = monthsGenerated.includes(nextMonth);

  return (
    <PageLayout
      rightRail={loading ? undefined : <RightRailWithMoreInfo />}
    >
      {/* While Claude is generating: brand only (Wordmark) + loader.
          The "To Do:" header, the "based on: ..." echo, and the
          right-rail "More info" are intentionally hidden so the
          waiting screen is clean and obviously a transitional state. */}
      {loading ? (
        <>
          <Wordmark />
          {/* Ring loader centered under the wordmark. mx-auto +
              items-center on a self-contained flex column guarantees
              dead-center alignment regardless of stage width. */}
          <div className="mt-[64px] flex w-full flex-col items-center justify-center">
            <RingLoader label="generating your plan…" size={60} />
          </div>
        </>
      ) : (
        <>
          <Header />

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
            className="mt-[28px] flex w-full max-w-[271px] flex-col gap-[10px] text-white/90"
            style={{
              fontFamily:
                '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
            }}
          >
            {/* Free preview = first 10 days of the personalized plan.
                Days 11-30 (plus all subsequent months) live behind the
                $9.99/mo paywall on /my-plan. */}
            {plan.slice(0, 10).map((step, i) => (
              <li key={step.day}>
                {/* Whole row is a clickable Link → /todo/{N}?s=…
                    -mx-3 px-3 -my-1 py-1 widens the click hit area
                    beyond the visible text without affecting layout;
                    rounded + hover bg gives obvious cursor feedback. */}
                <Link
                  to="/todo/$day"
                  params={{ day: String(i + 1) }}
                  search={{ s: sessionIdFromUrl, month }}
                  className="group -mx-3 -my-1 flex cursor-pointer items-baseline gap-[8px] rounded-[4px] px-3 py-1 leading-snug transition hover:bg-white/[0.04]"
                >
                  <span className="w-[44px] shrink-0 text-[13.2px] text-white/55 transition group-hover:text-white/80">
                    {step.day}:
                  </span>
                  <span className="flex-1 text-[13.6px] text-white/90 transition group-hover:text-white group-hover:underline group-hover:decoration-white/40 group-hover:underline-offset-[3px]">
                    {step.title}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}

      {/* Just-paid welcome banner — shown once on the redirect from
          Stripe Checkout (success_url includes ?subscribed=1). */}
      {!loading && subscribed === "1" && (
        <div
          className="mt-[28px] rounded-[6px] border border-amber-200/30 bg-amber-200/10 px-[18px] py-[14px] text-center text-[14px] text-amber-100"
          style={{
            fontFamily:
              '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
          }}
        >
          you&apos;re in. check your email for a sign-in link so you can
          access this plan from any device.
        </div>
      )}

      {/* Bottom CTA. Two states:
          - previewMode = true → paid user generated a new plan from
            the homepage. Show "Choose This Plan" with a warning that
            it'll replace their current plan.
          - previewMode = false → free user looking at the 10-day
            preview. Show the upgrade paywall. */}
      {!loading && previewMode && (
        <div className="mt-[40px] flex w-full flex-col items-center gap-[14px]">
          <button
            type="button"
            disabled={committingChoice}
            onClick={() => setConfirmModalOpen(true)}
            className="group inline-flex h-[80px] w-[437px] max-w-full items-center justify-center gap-[16px] rounded-[6px] bg-white text-[16px] text-black/80 transition hover:text-black focus:outline-none focus:ring-2 focus:ring-white/40 disabled:cursor-wait disabled:opacity-60"
            style={{
              fontFamily:
                '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
            }}
          >
            <span>
              {committingChoice ? "switching plans…" : "Choose This Plan"}
            </span>
            {!committingChoice && (
              <Arrow className="h-[9px] w-[44px] text-black" />
            )}
          </button>
          <Link
            to="/my-plan"
            className="mt-[4px] text-[13px] text-white/45 transition hover:text-white/75"
            style={{
              fontFamily:
                '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
            }}
          >
            ← keep my current plan
          </Link>
        </div>
      )}

      {/* Free-user paywall — only shown when NOT in previewMode (paid
          users see the "Choose This Plan" block above instead).
          Clicking opens Stripe Checkout directly. Signed-out users
          get the Clerk modal first with a redirect back to
          /todo?intent=basic so the auto-resume effect above can
          continue into checkout after sign-in. */}
      {!loading && !previewMode && (
        <div className="mt-[40px] flex w-full justify-center">
          <PaywallCTA
            sessionId={sessionIdFromUrl}
            isSignedIn={Boolean(isSignedIn)}
            pending={checkoutPending}
            onOpenCheckout={openCheckout}
          />
        </div>
      )}

      {/* "Month N of …" indicator, shown only past Month 1 so the free
          page stays uncluttered. */}
      {!loading && month > 1 && (
        <p
          className="mt-[16px] text-center text-[13px] text-white/40"
          style={{
            fontFamily:
              '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
          }}
        >
          Month {month}
        </p>
      )}

      {/* Bottom spacer — keeps the CTA + "keep my current plan" link
          from sitting on top of the fixed-position disclaimer footer. */}
      <div className="h-[72px] w-full shrink-0" aria-hidden />

      {/* "Choose This Plan" confirmation modal. Shown only when the
          user clicks the button (replaces the inline amber warning).
          Centered overlay with backdrop click-to-dismiss. */}
      {confirmModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={() => {
            if (!committingChoice) setConfirmModalOpen(false);
          }}
        >
          <div
            className="w-[420px] max-w-full rounded-[8px] border border-white/40 bg-[#0a0a0a] p-[24px] text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{
              fontFamily:
                '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
            }}
          >
            <h3 className="text-[18px] leading-tight text-white">
              heads up
            </h3>
            <p className="mt-[12px] text-[14px] leading-snug text-white/80">
              choosing this plan will <strong>replace</strong> your current
              plan. your old plan and any generated months will be erased.
            </p>
            <p className="mt-[8px] text-[13px] leading-snug text-white/55">
              this cannot be undone. continue?
            </p>
            <div className="mt-[20px] flex justify-end gap-[10px]">
              <button
                type="button"
                disabled={committingChoice}
                onClick={() => setConfirmModalOpen(false)}
                className="inline-flex h-[40px] items-center rounded-[4px] border border-white/20 px-[16px] text-[14px] text-white/80 transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
              >
                cancel
              </button>
              <button
                type="button"
                disabled={committingChoice}
                onClick={async () => {
                  const sid =
                    sessionIdFromUrl ||
                    (typeof window !== "undefined"
                      ? window.localStorage.getItem("h2gr:sessionId") ?? ""
                      : "");
                  const input =
                    typeof window !== "undefined"
                      ? window.localStorage.getItem("h2gr:tellMeAboutYourself") ?? ""
                      : "";
                  if (!sid || !input || !plan.length) return;
                  setCommittingChoice(true);
                  try {
                    const res = await replaceCurrentPlan({
                      data: { sessionId: sid, input, plan },
                    });
                    if (res.ok) {
                      setConfirmModalOpen(false);
                      navigate({ to: "/my-plan" });
                    } else {
                      window.alert(`Couldn't switch plans: ${res.reason}`);
                    }
                  } finally {
                    setCommittingChoice(false);
                  }
                }}
                className="inline-flex h-[40px] items-center rounded-[4px] bg-white px-[16px] text-[14px] font-medium text-black transition hover:bg-white/90 disabled:cursor-wait disabled:opacity-60"
              >
                {committingChoice ? "switching…" : "yes, replace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

/** "To Do:" header in JetBrains Mono, centered. */
function Header() {
  return (
    <h1
      className="mt-[8px] text-[22px] leading-tight text-white"
      style={{
        fontFamily:
          '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
      }}
    >
      To Do:
    </h1>
  );
}

/**
 * Floating right rail: dotted spine + "More info →" mid-height.
 * Anchored to the viewport RIGHT but pulled inward 140-165px so it
 * sits closer to the stage instead of hugging the viewport edge.
 */
export function RightRailWithMoreInfo() {
  return (
    <>
      <DottedSpine className="absolute top-[80px] bottom-[70px] right-[260px] z-10" />
      <div
        className="absolute right-[285px] top-[280px] z-10 flex flex-col items-end gap-[8px] text-white/40"
        style={{
          fontFamily:
            '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
        }}
      >
        <span className="text-[20px] leading-none">More info</span>
        <Arrow className="h-[5px] w-[44px] text-white/40" />
      </div>
    </>
  );
}

/**
 * $9.99 Full Plan CTA at the bottom of the free preview.
 *
 * When signed-in: click opens Stripe Checkout directly (via
 *   the openCheckout callback the parent supplies).
 * When signed-out: click opens the Clerk sign-in modal with
 *   forceRedirectUrl back to /todo?intent=basic — the parent's
 *   useEffect auto-fires checkout once Clerk resolves.
 */
function PaywallCTA({
  sessionId,
  isSignedIn,
  pending,
  onOpenCheckout,
}: {
  sessionId: string;
  isSignedIn: boolean;
  pending: boolean;
  onOpenCheckout: () => void;
}) {
  const label = pending ? "opening checkout…" : "$9.99 Full Plan";
  const inner = (
    <button
      type="button"
      onClick={isSignedIn ? onOpenCheckout : undefined}
      disabled={pending}
      className="group inline-flex h-[80px] w-[437px] max-w-full items-center justify-center gap-[16px] rounded-[6px] bg-white text-[16px] text-black/80 transition hover:text-black focus:outline-none focus:ring-2 focus:ring-white/40 disabled:cursor-wait disabled:opacity-60"
      style={{
        fontFamily:
          '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
      }}
    >
      <span>{label}</span>
      {!pending && <Arrow className="h-[9px] w-[44px] text-black" />}
    </button>
  );

  if (isSignedIn) return inner;

  const redirectUrl = `/todo?s=${encodeURIComponent(sessionId)}&intent=basic`;
  return (
    <SignInButton
      mode="modal"
      forceRedirectUrl={redirectUrl}
      signUpForceRedirectUrl={redirectUrl}
    >
      {inner}
    </SignInButton>
  );
}

/** Thin right-pointing arrow — used in the CTA + "More info →". */
export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 63 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      aria-hidden
    >
      <path d="M0 3h60" />
      <path d="M57 0l5 3-5 3" fill="currentColor" />
    </svg>
  );
}
