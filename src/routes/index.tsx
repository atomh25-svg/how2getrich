import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageLayout } from "@/components/how2getrich/PageLayout";
import { DottedSpine } from "@/components/how2getrich/DottedSpine";
import { Wordmark } from "@/components/how2getrich/Wordmark";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "how2getrich.online" },
      {
        name: "description",
        content:
          "Tell us about yourself. We hand you the 7-day playbook to get rich doing the boring thing nobody wants to do.",
      },
    ],
  }),
  component: Landing,
});

/**
 * Screen 1 — landing. Pure black canvas with a centered "how2getrich"
 * wordmark + green pixel-art money stack, a centered dotted spine
 * acting as the visual backbone, and a single textarea for the
 * "Tell me about yourself:" capture. On submit, advance to /todo.
 *
 * Sizes are scaled ~30% down from the original Figma 2201-canvas
 * mockup so the proportions read correctly at typical 1440-1920px
 * desktop widths.
 */
function Landing() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    // Generate (or reuse) an anonymous session id. Stored in
    // localStorage so the same browser keeps the same plan across
    // visits, and passed as a query param so the /todo page knows
    // which row in D1 to load.
    let sessionId = "";
    try {
      sessionId = window.localStorage.getItem("h2gr:sessionId") ?? "";
    } catch {
      /* private mode */
    }
    if (!sessionId) {
      sessionId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      try {
        window.localStorage.setItem("h2gr:sessionId", sessionId);
      } catch {
        /* private mode */
      }
    }
    try {
      window.localStorage.setItem("h2gr:tellMeAboutYourself", trimmed);
    } catch {
      /* private mode */
    }

    // /todo picks up the session id + intent from the URL.
    // intent=new tells /todo "the user just submitted a NEW input from
    // the homepage" — paid users see a 10-day preview + 'Choose This
    // Plan' button instead of being auto-bounced to /my-plan.
    navigate({
      to: "/todo",
      search: { s: sessionId, intent: "new" },
    });
  }

  return (
    <PageLayout>
      <Wordmark />
      {/* Thin white underline under "how2getrich" — visually caps the
          wordmark and reads as the top of the dotted spine. */}
      <span
        aria-hidden
        className="mt-[6px] block h-px w-[90px] self-center bg-white/55"
        style={{ transform: "scaleY(0.7)" }}
      />
      {/* Spine begins ~10px below the wordmark and stretches down
          to the label. min-height keeps it visible on shorter
          windows. */}
      {/* Spine is a fixed height so the form falls naturally just
          below it instead of being pushed around by viewport-height
          tricks. The page now sizes to content rather than min-h-screen. */}
      <DottedSpine
        className="mt-[11.5px] mb-[10px] h-[371px] self-center"
      />
      <form
        onSubmit={handleSubmit}
        className="mt-[7.5px] flex w-full flex-col items-center gap-[7.5px]"
      >
        {/* Thin white bar above "Tell me about yourself" — mirrors the
            bar under the wordmark and caps the bottom of the spine. */}
        <span
          aria-hidden
          className="-mb-[2px] block h-px w-[110px] bg-white/85"
          style={{ transform: "scaleY(0.5)" }}
        />
        <label
          htmlFor="tell"
          className="text-[16.4px] leading-tight text-white/90"
          style={{
            fontFamily:
              '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
            letterSpacing: "0.18px",
          }}
        >
          Tell me about yourself:
        </label>
        <textarea
          id="tell"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Plain Enter submits (advances to /todo with the tailored
            // plan); Shift+Enter still inserts a newline so multi-line
            // answers are possible.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder="Type here"
          rows={5}
          className="w-[259px] max-w-full resize-none rounded-[6px] bg-white px-[14px] py-[11px] text-[14.4px] text-black placeholder:text-[15px] placeholder:text-black/70 focus:outline-none focus:ring-2 focus:ring-white/40"
          style={{
            fontFamily:
              '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
            lineHeight: 1.2,
            minHeight: 100,
          }}
        />
        {/* Hidden submit so Cmd/Ctrl+Enter works and the form is keyboard
            accessible without forcing a visible button (matches Figma —
            no submit button is shown). */}
        <button type="submit" className="sr-only">
          Submit
        </button>
      </form>
    </PageLayout>
  );
}

/**
 * Deprecated inline copy of the Wordmark — kept here so any direct
 * references in older diffs still resolve. The exported version now
 * lives at src/components/how2getrich/Wordmark.tsx and is imported
 * above. This local copy is unused.
 */
function _LegacyWordmark() {
  return (
    // Inline-block container is centered by the parent's items-center.
    // The h1 sits inside, dead-center on the spine. The money image
    // is absolutely positioned at the h1's right edge so it overhangs
    // the centerline rather than pulling the wordmark off-axis.
    <div className="relative mt-[51px] inline-block">
      <h1
        className="text-[32.9px] leading-none text-white"
        style={{
          // Londrina Solid from Google Fonts — chunky display
          // sans, retro poster feel. Available weights: 100/300/400/900.
          fontFamily: '"Cabin Condensed", "Lexend", system-ui, sans-serif',
          fontWeight: 700,
          WebkitTextStroke: "0.9px white",
          letterSpacing: "0.5px",
          // Squash vertically 9% + horizontally 5% — gives "how2getrich"
          // a flatter, slightly condensed marquee-style proportion.
          transform: "scaleY(0.70) scaleX(0.88)",
          transformOrigin: "center",
          display: "inline-block",
          // Nudge the wordmark down 0.5px. position:relative + top lets
          // the h1 move without growing the container, so the absolutely-
          // positioned money icon (centered on the container) stays put.
          position: "relative",
          top: "2px",
        }}
      >
        {/* The two "h"s get a slight horizontal stretch on top of the
            parent's scaleX — display: inline-block makes the per-letter
            transform actually apply. */}
        <span style={{ display: "inline-block", transform: "scaleX(1.05)" }}>
          h
        </span>
        ow2getric
        <span style={{ display: "inline-block", transform: "scaleX(1.05)" }}>
          h
        </span>
      </h1>
      <img
        src={moneyStack}
        alt=""
        aria-hidden
        width={41}
        height={41}
        className="absolute left-full top-1/2 ml-[0px] h-[41px] w-[41px] object-contain"
        style={{
          imageRendering: "pixelated",
          // -50% centers against the wordmark baseline; the +3px nudges
          // the money stack 3px below center.
          transform: "translateY(calc(-50% + 1px))",
          filter:
            "drop-shadow(0 0 7px rgba(0, 217, 54, 0.35)) drop-shadow(0 0 14px rgba(0, 217, 54, 0.15))",
        }}
        draggable={false}
      />
    </div>
  );
}
