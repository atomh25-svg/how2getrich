/**
 * Legal disclaimer footer shown on every how2getrich screen.
 *
 * Fixed at the bottom of the viewport so it survives any layout,
 * dim and small (10px / 30% white) so it doesn't fight the
 * minimalist composition, but visible enough to count as a
 * "clear and conspicuous" disclosure under FTC guidance.
 *
 * Covers the bare-minimum legal points for a get-rich-branded
 * paid product:
 *   - "not financial advice"  (no SEC/fiduciary exposure)
 *   - "results vary wildly"   (FTC Operation Income Illusion)
 *   - "plans are AI-generated" (LLM-output disclosure)
 *   - "your money, your choice" (user takes responsibility)
 *   - copyright + year
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
        © 2026 how2getrich.online
      </p>
    </footer>
  );
}
