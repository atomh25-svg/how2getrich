import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";

import { PageLayout } from "@/components/how2getrich/PageLayout";
import { Wordmark } from "@/components/how2getrich/Wordmark";
import { getCurrentUser } from "@/lib/entitlement";
import { createCustomerPortalSession } from "@/lib/stripe";

const FONT_STACK =
  '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace';

// ──────────────────────────────────────────────────────────
// Server fns
// ──────────────────────────────────────────────────────────

/**
 * Read the current user for the account page. Returns null if the
 * cookie is missing — the route loader uses this to redirect to
 * /auth/signin.
 */
const fetchAccount = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getCurrentUser(env as unknown as { DB?: D1Database });
  if (!user) return null;
  return {
    email: user.email,
    tier: user.tier,
    currentPeriodEnd: user.currentPeriodEnd,
    hasStripeCustomer: user.stripeCustomerId != null,
  };
});

/**
 * Mint a Customer Portal session URL for the current user. Returns
 * { ok: true, url } or { ok: false, reason }. Client navigates to
 * the URL.
 */
const openCustomerPortal = createServerFn({ method: "POST" }).handler(
  async (): Promise<
    { ok: true; url: string } | { ok: false; reason: string }
  > => {
    const user = await getCurrentUser(env as unknown as { DB?: D1Database });
    if (!user) return { ok: false, reason: "not-signed-in" };
    if (!user.stripeCustomerId) return { ok: false, reason: "no-stripe-customer" };
    try {
      const origin = process.env.PUBLIC_ORIGIN ?? "https://how2getrich.online";
      const url = await createCustomerPortalSession(
        user.stripeCustomerId,
        `${origin}/account`,
      );
      return { ok: true, url };
    } catch (err) {
      console.error("[account] portal session failed:", err);
      return { ok: false, reason: "portal-failed" };
    }
  },
);

// ──────────────────────────────────────────────────────────
// Route
// ──────────────────────────────────────────────────────────

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account — how2getrich.online" },
      {
        name: "description",
        content: "Manage your how2getrich subscription.",
      },
    ],
  }),
  loader: async () => {
    const data = await fetchAccount();
    if (!data) {
      // Not signed in → bounce to sign-in, returning here after.
      throw redirect({
        to: "/auth_/signin",
        search: { error: "" },
      });
    }
    return data;
  },
  component: AccountPage,
});

function AccountPage() {
  const data = Route.useLoaderData();

  async function onManage() {
    const result = await openCustomerPortal();
    if (result.ok) {
      window.location.href = result.url;
    } else {
      window.alert(`Couldn't open billing portal: ${result.reason}`);
    }
  }

  const tierLabel =
    data.tier === "premium"
      ? "Premium ($19.99/mo)"
      : data.tier === "basic"
        ? "Basic ($9.99/mo)"
        : "Free";
  const periodEndStr = data.currentPeriodEnd
    ? new Date(data.currentPeriodEnd * 1000).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <PageLayout>
      <Wordmark />
      <h1
        className="mt-[28px] text-[22px] leading-tight text-white"
        style={{ fontFamily: FONT_STACK }}
      >
        Account
      </h1>

      <dl
        className="mt-[28px] flex flex-col gap-[14px] text-[14px] text-white/85"
        style={{ fontFamily: FONT_STACK }}
      >
        <Row label="signed in as" value={data.email} />
        <Row label="plan" value={tierLabel} />
        {periodEndStr && (
          <Row
            label={
              data.tier === "free" ? "expired on" : "renews on"
            }
            value={periodEndStr}
          />
        )}
      </dl>

      {data.hasStripeCustomer ? (
        <button
          type="button"
          onClick={onManage}
          className="mt-[36px] rounded-[6px] bg-white px-[18px] py-[10px] text-[14px] font-medium text-black transition hover:bg-white/90"
          style={{ fontFamily: FONT_STACK }}
        >
          manage subscription
        </button>
      ) : (
        <p
          className="mt-[36px] text-[13px] text-white/55"
          style={{ fontFamily: FONT_STACK }}
        >
          no stripe customer on record yet. subscribe from /todo to set one up.
        </p>
      )}
    </PageLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-[12px]">
      <dt className="w-[110px] shrink-0 text-white/50">{label}</dt>
      <dd className="text-white/90">{value}</dd>
    </div>
  );
}
