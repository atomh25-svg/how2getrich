import { Link } from "@tanstack/react-router";

/**
 * Legal disclaimer footer shown on every how2getrich screen.
 *
 * Fixed at the bottom of the viewport so it survives any layout,
 * dim and small so it doesn't fight the minimalist composition but
 * visible enough to count as a "clear and conspicuous" disclosure
 * under FTC guidance. The links to Privacy / Terms / Refunds are
 * pointer-events-auto'd individually so they remain clickable while
 * the rest of the footer stays click-through.
 */
export function Footer() {
  return (
    <footer
      aria-label="Legal disclaimer"
      className="pointer-events-none fixed inset-x-0 bottom-[10px] z-30 px-4 text-center"
      style={{
        fontFamily:
          '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
      }}
    >
      <p className="text-[10px] leading-tight text-white/35">
        &gt; not financial advice · results vary wildly · plans are AI-generated · your money, your choice
      </p>
      <p className="mt-[2px] text-[10px] leading-tight text-white/25">
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
