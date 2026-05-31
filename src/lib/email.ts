// Email sender — Resend. We only have one transactional template right
// now: the magic-link sign-in. Send from `noreply@how2getrich.online`
// once the domain is verified in Resend.
//
// The `resend` npm SDK uses fetch under the hood, so it works on
// Cloudflare Workers without nodejs_compat tricks.

import { Resend } from "resend";

const FROM_ADDRESS = "how2getrich <noreply@how2getrich.online>";

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set — emails cannot be sent");
  }
  return new Resend(apiKey);
}

interface MagicLinkArgs {
  to: string;
  url: string;
  /**
   * Whether this is the user's first link after signup (different copy
   * than a recovery link).
   */
  context: "signup" | "signin";
}

/**
 * Send a sign-in link. Returns the Resend message id on success;
 * throws on transport failure.
 */
export async function sendMagicLink({
  to,
  url,
  context,
}: MagicLinkArgs): Promise<string> {
  const resend = getResend();
  const subject =
    context === "signup"
      ? "Welcome to how2getrich — your sign-in link"
      : "Your how2getrich sign-in link";

  const intro =
    context === "signup"
      ? "Thanks for subscribing. Click below to access your plan from any device — this link works for the next 15 minutes."
      : "Click below to sign in to how2getrich. This link works for the next 15 minutes.";

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    html: renderMagicLinkHtml({ url, intro }),
    text: renderMagicLinkText({ url, intro }),
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message ?? JSON.stringify(error)}`);
  }
  return data?.id ?? "";
}

// ──────────────────────────────────────────────────────────
// Plain-text + HTML rendering
// ──────────────────────────────────────────────────────────

function renderMagicLinkText({
  url,
  intro,
}: {
  url: string;
  intro: string;
}): string {
  return [
    intro,
    "",
    url,
    "",
    "If you didn't request this, you can ignore this email.",
    "",
    "— how2getrich.online",
  ].join("\n");
}

function renderMagicLinkHtml({
  url,
  intro,
}: {
  url: string;
  intro: string;
}): string {
  // Minimal inline-styled HTML. Dark warm palette matching the site so
  // the email feels like the same product. Keep it small + tableless
  // — modern mail clients render it fine and it's easier to maintain.
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#1a1612;font-family:Helvetica,Arial,sans-serif;color:#f4efe6;">
    <div style="max-width:520px;margin:0 auto;padding:48px 24px;">
      <div style="font-size:14px;letter-spacing:0.04em;text-transform:uppercase;color:#d6a651;margin-bottom:24px;">
        how2getrich
      </div>
      <p style="font-size:16px;line-height:1.5;color:#f4efe6;margin:0 0 32px 0;">
        ${escapeHtml(intro)}
      </p>
      <a href="${escapeAttr(url)}"
         style="display:inline-block;padding:14px 28px;background:#d6a651;color:#1a1612;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        Sign in
      </a>
      <p style="font-size:13px;line-height:1.5;color:#9a9286;margin:32px 0 8px 0;">
        Or paste this URL into your browser:
      </p>
      <p style="font-size:12px;line-height:1.4;color:#9a9286;word-break:break-all;margin:0 0 32px 0;">
        ${escapeHtml(url)}
      </p>
      <p style="font-size:12px;line-height:1.5;color:#6b6457;margin:0;">
        Didn't request this? You can safely ignore this email.
      </p>
    </div>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
