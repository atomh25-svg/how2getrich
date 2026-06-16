import { Link } from "@tanstack/react-router";

/**
 * Legal disclaimer footer shown on every how2getrich screen.
 *
 * Two layouts:
 *   - "center" (default): fixed bottom-center strip across the viewport.
 *   - "bottom-right": single tight paragraph anchored to the bottom-right
 *     corner. Used on /todo so the disclaimer doesn't fight the centered
 *     days list.
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
        className="pointer-events-none fixed bottom-[14px] right-[18px] z-30 max-w-[260px] text-right"
        style={{
          fontFamily:
            '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
        }}
      >
        <p className="text-[10px] leading-snug text-white/35">
          &gt; not financial advice · results vary wildly · plans are
          AI-generated · your money, your choice. © 2026 how2getrich.online ·{" "}
          <Link
            to="/privacy"
            className="pointer-events-auto underline-offset-2 transition hover:text-white/55 hover:underline"
          >
            privacy
          </Link>{" "}
          ·{" "}
          <Link
            to="/terms"
            className="pointer-events-auto underline-offset-2 transition hover:text-white/55 hover:underline"
          >
            terms
          </Link>{" "}
          ·{" "}
          <Link
            to="/refunds"
            className="pointer-events-auto underline-offset-2 transition hover:text-white/55 hover:underline"
          >
            refunds
          </Link>{" "}
          ·{" "}
          <a
            href="mailto:support@how2getrich.online"
            className="pointer-events-auto underline-offset-2 transition hover:text-white/55 hover:underline"
          >
            contact
          </a>
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
