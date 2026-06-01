// Stripe wrapper for how2getrich subscriptions.
//
// Two responsibilities:
//   1. createCheckoutSession() — kicks off Subscribe flow from /todo/upgrade
//   2. handleWebhookEvent() — keeps our h2gr_users row in sync with
//      Stripe's truth (tier, current_period_end, sub IDs)
//
// We use the `stripe` npm package. It does fetch under the hood with
// `httpClient: Stripe.createFetchHttpClient()` so it works on Workers
// runtime (no node:net). Default API version pinned to the SDK's
// to avoid silent breakage.

import Stripe from "stripe";

export type Tier = "free" | "basic" | "premium";

// ──────────────────────────────────────────────────────────
// Client factory
// ──────────────────────────────────────────────────────────

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  stripeClient = new Stripe(key, {
    // Workers don't have node:net — force fetch transport.
    httpClient: Stripe.createFetchHttpClient(),
    // Don't pin apiVersion here; let the SDK use its built-in default
    // so SDK upgrades stay coherent with their typings.
  });
  return stripeClient;
}

// Map our internal tier names to the Stripe Price IDs the user
// configured in their dashboard. These two env vars get set via
// `wrangler secret put` once the user creates the products.
function priceIdForTier(tier: Exclude<Tier, "free">): string {
  const id =
    tier === "basic"
      ? process.env.STRIPE_PRICE_BASIC
      : process.env.STRIPE_PRICE_PREMIUM;
  if (!id) {
    throw new Error(
      `Missing STRIPE_PRICE_${tier.toUpperCase()} — set it via wrangler secret put`,
    );
  }
  return id;
}

// Inverse: when a webhook tells us "the user is now on price X", map
// back to our tier name. Anything we don't recognize → null (logged).
export function tierForPriceId(priceId: string | null | undefined): Tier | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_BASIC) return "basic";
  if (priceId === process.env.STRIPE_PRICE_PREMIUM) return "premium";
  return null;
}

// ──────────────────────────────────────────────────────────
// Checkout session
// ──────────────────────────────────────────────────────────

interface CheckoutArgs {
  tier: "basic" | "premium";
  clerkUserId: string;      // who's subscribing — bound into metadata so the webhook can persist tier against the right user
  email: string;            // pre-fills Stripe Checkout so the user doesn't retype
  sessionId: string;        // anonymous session UUID — lets us link the user's free Month 1 to their authed account
  successUrl: string;       // absolute URL Stripe redirects to on success
  cancelUrl: string;        // absolute URL on cancel
  existingCustomerId?: string; // resubscribe path — reuse the existing Stripe Customer
}

/**
 * Create a Checkout Session and return its hosted URL. Caller
 * (client) just window.location.href = url.
 */
export async function createCheckoutSession(args: CheckoutArgs): Promise<string> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceIdForTier(args.tier), quantity: 1 }],
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    // If we already have a Stripe Customer for this user, reuse it
    // (lets them keep saved payment methods + billing history). On a
    // first-time sub there's no customer yet, so we let Stripe create
    // one and (when we know it) pre-fill the email collection box.
    ...(args.existingCustomerId
      ? { customer: args.existingCustomerId }
      : {
          customer_creation: "always",
          // Stripe rejects empty-string email; omit the field if we
          // don't have one and let Checkout collect it on the page.
          ...(args.email ? { customer_email: args.email } : {}),
        }),
    // Plumb our identity + intent through to the webhook.
    client_reference_id: args.sessionId,
    metadata: {
      clerk_user_id: args.clerkUserId,
      session_id: args.sessionId,
      tier: args.tier,
    },
    subscription_data: {
      metadata: {
        clerk_user_id: args.clerkUserId,
        session_id: args.sessionId,
        tier: args.tier,
      },
    },
    allow_promotion_codes: true,
  });
  if (!session.url) {
    throw new Error("Stripe Checkout did not return a URL");
  }
  return session.url;
}

// ──────────────────────────────────────────────────────────
// Customer Portal (for /account "Manage subscription")
// ──────────────────────────────────────────────────────────

export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<string> {
  const stripe = getStripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return portal.url;
}

// ──────────────────────────────────────────────────────────
// Webhook signature verification + dispatch
// ──────────────────────────────────────────────────────────

type Env = { DB?: D1Database };

/**
 * Verify a Stripe webhook payload + signature and apply its effects
 * to our DB. Returns the event type processed (or "ignored" for
 * events we don't care about). Throws on signature failure.
 *
 * The `rawBody` MUST be the exact bytes Stripe sent — re-serializing
 * JSON will break the HMAC. Read it via `request.text()` before
 * touching the body anywhere else.
 */
export async function handleWebhookEvent({
  rawBody,
  signature,
  env,
}: {
  rawBody: string;
  signature: string | null;
  /** No longer used — kept in the signature for future use (e.g. email links). */
  origin?: string;
  env: Env;
}): Promise<{ ok: true; type: string } | { ok: false; reason: string }> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return { ok: false, reason: "no-webhook-secret" };
  if (!signature) return { ok: false, reason: "no-signature" };

  let event: Stripe.Event;
  try {
    // constructEventAsync is the Workers-safe variant (uses WebCrypto
    // instead of the sync node:crypto version).
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return { ok: false, reason: "bad-signature" };
  }

  switch (event.type) {
    case "checkout.session.completed":
      await onCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
        { env },
      );
      return { ok: true, type: event.type };

    case "customer.subscription.updated":
    case "customer.subscription.created":
      await onSubscriptionUpserted(
        event.data.object as Stripe.Subscription,
        { env },
      );
      return { ok: true, type: event.type };

    case "customer.subscription.deleted":
      await onSubscriptionDeleted(
        event.data.object as Stripe.Subscription,
        { env },
      );
      return { ok: true, type: event.type };

    case "invoice.payment_failed":
      console.warn(
        "[stripe-webhook] payment failed for customer",
        (event.data.object as Stripe.Invoice).customer,
      );
      // We don't immediately revoke — Stripe keeps the sub `past_due`
      // and will eventually fire subscription.deleted if it dunns out.
      return { ok: true, type: event.type };

    default:
      return { ok: true, type: "ignored" };
  }
}

// ──────────────────────────────────────────────────────────
// Event handlers
// ──────────────────────────────────────────────────────────

async function onCheckoutCompleted(
  session: Stripe.Checkout.Session,
  ctx: { env: Env },
): Promise<void> {
  const db = ctx.env.DB;
  if (!db) {
    console.error("[stripe-webhook] no DB binding — can't persist user");
    return;
  }

  // The Clerk user id was stamped onto the session in metadata when we
  // created it. Without it we can't bind this payment to a user.
  const clerkUserId = session.metadata?.clerk_user_id ?? null;
  if (!clerkUserId) {
    console.error("[stripe-webhook] checkout completed without clerk_user_id metadata");
    return;
  }

  const email = session.customer_details?.email ?? session.customer_email;
  if (!email) {
    console.error("[stripe-webhook] checkout completed with no email");
    return;
  }
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  // Figure out tier — prefer metadata.tier from the checkout session,
  // fall back to looking up the subscription's price.
  let tier: Tier | null = null;
  const metaTier = session.metadata?.tier;
  if (metaTier === "basic" || metaTier === "premium") tier = metaTier;

  let currentPeriodEnd: number | null = null;
  if (subscriptionId) {
    try {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      currentPeriodEnd =
        typeof sub.current_period_end === "number"
          ? sub.current_period_end
          : null;
      if (!tier) {
        const priceId = sub.items.data[0]?.price.id ?? null;
        tier = tierForPriceId(priceId);
      }
    } catch (err) {
      console.error("[stripe-webhook] couldn't fetch subscription:", err);
    }
  }

  // Upsert into h2gr_users, keyed by Clerk user id.
  await db
    .prepare(
      `INSERT INTO h2gr_users
         (clerk_user_id, email, tier, stripe_customer_id, stripe_subscription_id, current_period_end, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, unixepoch())
       ON CONFLICT(clerk_user_id) DO UPDATE SET
         email = excluded.email,
         tier = excluded.tier,
         stripe_customer_id = excluded.stripe_customer_id,
         stripe_subscription_id = excluded.stripe_subscription_id,
         current_period_end = excluded.current_period_end,
         updated_at = unixepoch()`,
    )
    .bind(clerkUserId, email, tier ?? "basic", customerId, subscriptionId, currentPeriodEnd)
    .run();

  // Link the anonymous session_id (carried in client_reference_id +
  // metadata.session_id) to this clerk_user_id so the user's free
  // Month 1 plan is still theirs after they sign in on another device.
  const sessionId =
    session.client_reference_id ?? session.metadata?.session_id ?? null;
  if (sessionId) {
    await db
      .prepare(
        `INSERT INTO h2gr_session_user (session_id, clerk_user_id)
         VALUES (?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
           clerk_user_id = excluded.clerk_user_id,
           linked_at = unixepoch()`,
      )
      .bind(sessionId, clerkUserId)
      .run();
  }
}

async function onSubscriptionUpserted(
  sub: Stripe.Subscription,
  ctx: { env: Env },
): Promise<void> {
  const db = ctx.env.DB;
  if (!db) return;

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const priceId = sub.items.data[0]?.price.id ?? null;
  const tier = tierForPriceId(priceId);
  const currentPeriodEnd =
    typeof sub.current_period_end === "number" ? sub.current_period_end : null;

  // Look up the Clerk user id by customer_id (set during checkout).
  const row = await db
    .prepare(`SELECT clerk_user_id FROM h2gr_users WHERE stripe_customer_id = ?`)
    .bind(customerId)
    .first<{ clerk_user_id: string }>();
  if (!row) {
    console.warn(
      "[stripe-webhook] subscription.updated for unknown customer:",
      customerId,
    );
    return;
  }

  await db
    .prepare(
      `UPDATE h2gr_users SET
         tier = ?,
         stripe_subscription_id = ?,
         current_period_end = ?,
         updated_at = unixepoch()
       WHERE clerk_user_id = ?`,
    )
    .bind(tier ?? "basic", sub.id, currentPeriodEnd, row.clerk_user_id)
    .run();
}

async function onSubscriptionDeleted(
  sub: Stripe.Subscription,
  ctx: { env: Env },
): Promise<void> {
  const db = ctx.env.DB;
  if (!db) return;
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  // Null out the tier (treat as free). Keep customer_id around so
  // they can resubscribe without creating a new Stripe Customer.
  await db
    .prepare(
      `UPDATE h2gr_users SET
         tier = NULL,
         stripe_subscription_id = NULL,
         current_period_end = NULL,
         updated_at = unixepoch()
       WHERE stripe_customer_id = ?`,
    )
    .bind(customerId)
    .run();
}

