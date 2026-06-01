import { useEffect, useRef, useState } from "react";
import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { SignInButton, useUser } from "@clerk/tanstack-react-start";

import { PageLayout } from "@/components/how2getrich/PageLayout";
import { RightRailWithMoreInfo } from "./todo";
import { createCheckoutSession } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/entitlement";

const FONT_STACK =
  '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace';

// ──────────────────────────────────────────────────────────
// Server fn: mint a Stripe Checkout session, return its URL
// ──────────────────────────────────────────────────────────

const startCheckout = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { tier: string; sessionId: string; returnPath?: string }) => ({
      tier:
        data?.tier === "basic" || data?.tier === "premium"
          ? data.tier
          : ("basic" as const),
      sessionId: typeof data?.sessionId === "string" ? data.sessionId : "",
      returnPath:
        typeof data?.returnPath === "string" ? data.returnPath : "/todo",
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
          tier: data.tier,
          clerkUserId: user.clerkUserId,
          email: user.email,
          sessionId: data.sessionId,
          existingCustomerId: user.stripeCustomerId ?? undefined,
          successUrl: `${origin}${data.returnPath}?subscribed=1`,
          cancelUrl: `${origin}/todo/upgrade?s=${encodeURIComponent(data.sessionId)}`,
        });
        return { ok: true, url };
      } catch (err) {
        // Surface the actual Stripe error message back to the client so
        // the user-facing alert is diagnostic instead of generic. Stripe
        // errors look like: "No such price: 'price_xxx'", "Invalid API
        // Key provided", etc. — much more useful than "stripe-error".
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

// ──────────────────────────────────────────────────────────
// Route
// ──────────────────────────────────────────────────────────

export const Route = createFileRoute("/todo_/upgrade")({
  head: () => ({
    meta: [
      { title: "Unlock Full Plan — how2getrich.online" },
      { name: "description", content: "Unlock the full how2getrich plan." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    s: typeof search.s === "string" ? search.s : "",
    // After Clerk sign-in we redirect back here with ?intent=<tier> so
    // we can auto-resume the checkout that the user was trying to
    // start before they got bounced into the sign-in modal.
    intent:
      search.intent === "basic" || search.intent === "premium"
        ? search.intent
        : "",
  }),
  component: TodoPaywall,
});

type Tier = {
  id: "basic" | "premium";
  name: string;
  description?: string;
  price: string;
};

const TIERS: Tier[] = [
  { id: "basic", name: "Basic Plan", price: "$9.99 a month" },
  {
    id: "premium",
    name: "Premium Plan",
    description:
      "Deeper per-day detail · more examples · common pitfalls · tool picks",
    price: "$19.99 a month",
  },
];

function TodoPaywall() {
  const { s: sessionIdFromUrl, intent } = useSearch({
    from: "/todo_/upgrade",
  });
  const { isSignedIn, isLoaded } = useUser();
  const navigate = useNavigate();
  const [pending, setPending] = useState<Tier["id"] | null>(null);
  const autoResumed = useRef(false);

  // Resolve / lazy-create the anonymous session_id so we can stamp it
  // into Stripe metadata + use it in URLs.
  function resolveSessionId(): string {
    let sid = sessionIdFromUrl;
    if (!sid && typeof window !== "undefined") {
      sid =
        window.localStorage.getItem("h2gr.sessionId") ?? crypto.randomUUID();
      window.localStorage.setItem("h2gr.sessionId", sid);
    }
    return sid ?? "";
  }

  async function openCheckout(tier: Tier["id"]) {
    if (pending) return;
    const sessionId = resolveSessionId();
    setPending(tier);
    try {
      const result = await startCheckout({
        data: { tier, sessionId, returnPath: "/todo" },
      });
      if (result.ok) {
        window.location.href = result.url;
      } else if (result.reason === "not-signed-in") {
        // Shouldn't happen — UI gates this — but surface it cleanly.
        window.alert(
          "Sign in first — click a plan below and we'll prompt you.",
        );
      } else {
        window.alert(`Couldn't open checkout: ${result.reason}`);
      }
    } finally {
      setPending(null);
    }
  }

  // Auto-resume checkout after the user returns from Clerk sign-in.
  // The SignInButton's forceRedirectUrl puts ?intent=<tier> in the URL;
  // once Clerk's `isLoaded && isSignedIn` flip true, fire the checkout
  // and clean the URL so refreshing doesn't loop.
  useEffect(() => {
    if (autoResumed.current) return;
    if (!isLoaded || !isSignedIn) return;
    if (intent !== "basic" && intent !== "premium") return;
    autoResumed.current = true;
    // Strip ?intent from URL so a refresh doesn't re-trigger.
    navigate({
      to: "/todo/upgrade",
      search: { s: sessionIdFromUrl ?? "" },
      replace: true,
    });
    openCheckout(intent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, intent]);

  return (
    <PageLayout rightRail={<RightRailWithMoreInfo />}>
      <h1
        className="text-[22px] leading-tight text-white"
        style={{ fontFamily: FONT_STACK }}
      >
        To Do:
      </h1>

      <div className="mt-[28px] flex w-full justify-center">
        <div
          className="flex w-[437px] max-w-full flex-col items-center rounded-2xl bg-white px-[36px] pt-[40px] pb-[56px] text-black"
          style={{ fontFamily: FONT_STACK }}
        >
          <h2 className="w-full text-center text-[24px] leading-none text-black/85">
            Unlock Full Plan
          </h2>

          {/* Tier cards are ALWAYS visible. Click handler branches by
              auth state — signed-out users get the Clerk sign-in modal
              (with redirect back here + intent=<tier> so we auto-resume),
              signed-in users go straight to Stripe Checkout. */}
          <ul className="mt-[52px] flex w-full flex-col gap-[52px]">
            {TIERS.map((tier) => (
              <li key={tier.id}>
                <TierRow
                  tier={tier}
                  isSignedIn={Boolean(isSignedIn)}
                  pending={pending === tier.id}
                  disabled={pending != null}
                  sessionId={sessionIdFromUrl}
                  onSubscribe={() => openCheckout(tier.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PageLayout>
  );
}

/**
 * One tier row. When signed-in, behaves as a normal button calling
 * onSubscribe. When signed-out, the button is wrapped in <SignInButton>
 * so the click opens Clerk's modal — and forceRedirectUrl brings the
 * user back to /todo/upgrade?intent=<tier>, which then auto-fires
 * checkout via the effect in the parent.
 */
function TierRow({
  tier,
  isSignedIn,
  pending,
  disabled,
  sessionId,
  onSubscribe,
}: {
  tier: Tier;
  isSignedIn: boolean;
  pending: boolean;
  disabled: boolean;
  sessionId: string;
  onSubscribe: () => void;
}) {
  const inner = (
    <button
      type="button"
      onClick={isSignedIn ? onSubscribe : undefined}
      disabled={disabled}
      className="group block w-full cursor-pointer text-center transition hover:opacity-80 focus:outline-none focus-visible:underline disabled:cursor-wait disabled:opacity-60"
    >
      <div className="text-[15px] leading-snug text-black/85">{tier.name}</div>
      {tier.description && (
        <div className="mx-auto mt-[8px] max-w-[300px] text-[14px] leading-snug text-black/55">
          {tier.description}
        </div>
      )}
      <div className="mt-[8px] text-[14px] leading-snug text-black/85">
        {pending ? "opening checkout..." : tier.price}
      </div>
    </button>
  );

  if (isSignedIn) return inner;

  // Build the post-sign-in redirect URL so Clerk brings the user back
  // to this page with the intent baked in. Absolute path; Clerk wants
  // a relative URL OR a fully-qualified URL on the same origin.
  const redirectUrl = `/todo/upgrade?s=${encodeURIComponent(sessionId)}&intent=${tier.id}`;
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
