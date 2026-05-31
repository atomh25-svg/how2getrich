import { useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";

import { PageLayout } from "@/components/how2getrich/PageLayout";
import { Wordmark } from "@/components/how2getrich/Wordmark";
import { sendSignInLink } from "@/lib/stripe";

const FONT_STACK =
  '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace';

// ──────────────────────────────────────────────────────────
// Server fn: mint + email a new magic link, if the email is a
// known h2gr_users row. We intentionally return `{ ok: true }`
// in BOTH cases (real send + email not in DB) so we don't leak
// which addresses are paid users.
// ──────────────────────────────────────────────────────────

const requestMagicLink = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => ({
    email: typeof data?.email === "string" ? data.email.trim().toLowerCase() : "",
  }))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; reason: string }> => {
    if (!data.email || !data.email.includes("@")) {
      return { ok: false, reason: "invalid-email" };
    }
    const db = (env as unknown as { DB?: D1Database }).DB;
    if (!db) return { ok: false, reason: "no-db" };

    // Only send if the email exists in h2gr_users (i.e. they've paid
    // at least once). Silently no-op otherwise so we don't expose
    // membership status.
    const row = await db
      .prepare(`SELECT email FROM h2gr_users WHERE email = ?`)
      .bind(data.email)
      .first<{ email: string }>();
    if (row) {
      const origin = getOriginFromRequest();
      try {
        await sendSignInLink(data.email, origin, "signin", db);
      } catch (err) {
        console.error("[auth/signin] sendSignInLink failed:", err);
        // Still return ok=true to avoid leaking — but log it loudly.
      }
    }
    return { ok: true };
  });

// We can't easily get the request URL inside a server fn without
// importing more from start-server-core; just pull from env which
// will be set at deploy time, falling back to localhost for dev.
function getOriginFromRequest(): string {
  return (
    process.env.PUBLIC_ORIGIN ?? "https://how2getrich.online"
  );
}

// ──────────────────────────────────────────────────────────
// Route
// ──────────────────────────────────────────────────────────

export const Route = createFileRoute("/auth_/signin")({
  head: () => ({
    meta: [
      { title: "Sign in — how2getrich.online" },
      {
        name: "description",
        content: "Sign in to how2getrich with a magic link.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === "string" ? search.error : "",
  }),
  component: SignInPage,
});

function SignInPage() {
  const { error } = useSearch({ from: "/auth_/signin" });
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await requestMagicLink({ data: { email } });
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageLayout>
      <Wordmark />
      <h1
        className="mt-[28px] text-center text-[22px] leading-tight text-white"
        style={{ fontFamily: FONT_STACK }}
      >
        Sign in
      </h1>

      {/* Friendly explainer of the verify error if we redirected here */}
      {error && (
        <p
          className="mt-[12px] text-center text-[12px] text-amber-200/80"
          style={{ fontFamily: FONT_STACK }}
        >
          {explainError(error)}
        </p>
      )}

      <p
        className="mt-[12px] text-center text-[14px] text-white/60"
        style={{ fontFamily: FONT_STACK }}
      >
        We&apos;ll email you a one-time sign-in link.
      </p>

      {sent ? (
        <div
          className="mx-auto mt-[28px] w-[297px] max-w-full rounded-[6px] border border-white/15 bg-white/[0.03] px-[18px] py-[16px] text-center text-[14px] text-white/85"
          style={{ fontFamily: FONT_STACK }}
        >
          if that email has an account, a sign-in link is on its way.
          check your inbox.
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="mx-auto mt-[28px] flex w-[297px] max-w-full flex-col items-stretch gap-[12px]"
        >
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-[6px] border border-white/15 bg-white/[0.03] px-[14px] py-[10px] text-[14.4px] text-white placeholder:text-white/35 focus:border-white/35 focus:outline-none"
            style={{ fontFamily: FONT_STACK }}
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-[6px] bg-white px-[14px] py-[10px] text-[14px] font-medium text-black transition hover:bg-white/90 disabled:opacity-50"
            style={{ fontFamily: FONT_STACK }}
          >
            {submitting ? "sending..." : "send magic link"}
          </button>
        </form>
      )}
    </PageLayout>
  );
}

function explainError(code: string): string {
  switch (code) {
    case "missing-token":
      return "that sign-in link was missing a token. request a new one below.";
    case "invalid-token":
      return "we don't recognize that link. it may have already been used.";
    case "token-already-used":
      return "that sign-in link was already used. request a new one below.";
    case "token-expired":
      return "that link expired (links last 15 minutes). request a new one below.";
    case "server-misconfigured":
      return "something is wrong on our end. try again in a minute.";
    case "no-db":
      return "temporary database hiccup. try again in a minute.";
    default:
      return "we couldn't sign you in. request a new link below.";
  }
}
