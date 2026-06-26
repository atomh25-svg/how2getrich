import { Link } from "@tanstack/react-router";

/**
 * Legal disclaimer footer shown on every how2getrich screen.
 *
 * Two layouts:
 *   - "center" (default): fixed bottom-center strip across the viewport.
 *   - "bottom-right": tight 4-line paragraph anchored to the bottom-right
 *     corner. Used on /my-plan (unlocked unlimited view) so the disclaimer
 *     sits clear of the centered days list AND the right-rail "More info"
 *     bar. Explicit line breaks + whitespace-nowrap keep the block exactly
 *     4 lines tall regardless of viewport / scale.
 */
export function Footer({
  align = "center",
}: {
  align?: "center" | "bottom-right";
}) {
  if (align === "bottom-right") {
    return (
      <footer
        aria-label="Legal disclaimer"
        className="pointer-events-none fixed bottom-[14px] right-[28px] z-30 text-center"
        style={{
          fontFamily:
            '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
        }}
      >
        {/* 4 lines, each exactly 30 chars in VT323 (monospace) so the
            block reads as a literal square of text. Padding dots on
            lines 3 and 4 keep the widths matched. */}
        <p className="text-[10px] leading-snug text-white/35">
          <span className="block whitespace-nowrap">
            &gt; not financial advice · plans
          </span>
          <span className="block whitespace-nowrap">
            AI-generated, results may vary
          </span>
          <span className="block whitespace-nowrap text-white/25">
            © 2026 · how2getrich.online ··
          </span>
          <span className="block whitespace-nowrap text-white/25">
            ·<Link
              to="/privacy"
              className="pointer-events-auto underline-offset-2 transition hover:text-white/55 hover:underline"
            >privacy</Link>·<Link
              to="/terms"
              className="pointer-events-auto underline-offset-2 transition hover:text-white/55 hover:underline"
            >terms</Link>·<Link
              to="/refunds"
              className="pointer-events-auto underline-offset-2 transition hover:text-white/55 hover:underline"
            >refunds</Link>·<a
              href="mailto:support@how2getrich.online"
              className="pointer-events-auto underline-offset-2 transition hover:text-white/55 hover:underline"
            >contact</a>
          </span>
        </p>
      </footer>
    );
  }

  return (
    <footer
      aria-label="Legal disclaimer"
      className="pointer-events-none fixed inset-x-0 bottom-[10px] z-30 px-4 text-center"
      style={{
        fontFamily:
          '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
      }}
    >
      <p className="text-[9px] leading-[1.1] text-white/35">
        &gt; not financial advice · results vary wildly · plans are AI-generated · your money, your choice
      </p>
      <p className="mt-[1px] text-[9px] leading-[1.1] text-white/25">
        © 2026 how2getrich.online ·{" "}
        <Link
          to="/privacy"
          className="pointer-events-auto underline-offset-2 transition hover:text-white/50 hover:underline"
        >
          privacy
        </Link>{" "}
        ·{" "}
        <Link
          to="/terms"
          className="pointer-events-auto underline-offset-2 transition hover:text-white/50 hover:underline"
        >
          terms
        </Link>{" "}
        ·{" "}
        <Link
          to="/refunds"
          className="pointer-events-auto underline-offset-2 transition hover:text-white/50 hover:underline"
        >
          refunds
        </Link>{" "}
        ·{" "}
        <a
          href="mailto:support@how2getrich.online"
          className="pointer-events-auto underline-offset-2 transition hover:text-white/50 hover:underline"
        >
          contact
        </a>
      </p>
    </footer>
  );
}
