import { useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { PageLayout } from "@/components/how2getrich/PageLayout";
import { RightRailWithMoreInfo } from "./todo";
import { createCheckoutSession } from "@/lib/stripe";

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
  .handler(async ({ data }): Promise<{ ok: true; url: string } | { ok: false; reason: string }> => {
    if (!data.sessionId) return { ok: false, reason: "missing-session-id" };
    const origin = process.env.PUBLIC_ORIGIN ?? "https://how2getrich.online";
    try {
      const url = await createCheckoutSession({
        tier: data.tier,
        sessionId: data.sessionId,
        successUrl: `${origin}${data.returnPath}?subscribed=1`,
        cancelUrl: `${origin}/todo_/upgrade?s=${encodeURIComponent(data.sessionId)}`,
      });
      return { ok: true, url };
    } catch (err) {
      console.error("[checkout] failed:", err);
      return { ok: false, reason: "stripe-error" };
    }
  });

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
    description: "Deeper per-day detail · more examples · common pitfalls · tool picks",
    price: "$19.99 a month",
  },
];

function TodoPaywall() {
  const { s: sessionIdFromUrl } = useSearch({ from: "/todo_/upgrade" });
  const [pending, setPending] = useState<Tier["id"] | null>(null);

  async function onSubscribe(tier: Tier["id"]) {
    if (pending) return;
    // Fall back to a localStorage session_id if the URL didn't carry one.
    let sessionId = sessionIdFromUrl;
    if (!sessionId && typeof window !== "undefined") {
      sessionId =
        window.localStorage.getItem("h2gr.sessionId") ??
        crypto.randomUUID();
      window.localStorage.setItem("h2gr.sessionId", sessionId);
    }
    setPending(tier);
    try {
      const result = await startCheckout({
        data: {
          tier,
          sessionId,
          returnPath: "/todo",
        },
      });
      if (result.ok) {
        window.location.href = result.url;
      } else {
        window.alert(
          `Couldn't open checkout: ${result.reason}. Try again in a moment.`,
        );
      }
    } finally {
      setPending(null);
    }
  }

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

          <ul className="mt-[52px] flex w-full flex-col gap-[52px]">
            {TIERS.map((tier) => (
              <li key={tier.id}>
                <TierBlock
                  tier={tier}
                  pending={pending === tier.id}
                  disabled={pending != null}
                  onSubscribe={() => onSubscribe(tier.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PageLayout>
  );
}

function TierBlock({
  tier,
  pending,
  disabled,
  onSubscribe,
}: {
  tier: Tier;
  pending: boolean;
  disabled: boolean;
  onSubscribe: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSubscribe}
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
}
