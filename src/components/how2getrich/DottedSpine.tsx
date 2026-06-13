import type { CSSProperties } from "react";

/**
 * Vertical dotted spine used as the visual backbone on every screen.
 * Screen 1 places it centered; screens 2/3 move it to the far right
 * to cue progression through the flow. Built with a repeating radial
 * gradient so dots stay perfectly round at any zoom level.
 */
export function DottedSpine({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        // Narrow column + linear-gradient repeating horizontal stripes
        // → each "dot" reads as a thin short bar. Period dropped from
        // 5.2px → 5.0px to slip ~3 more dots into the same spine
        // length on the landing page (366px tall = 73 dots vs 70).
        width: 2.7,
        backgroundImage:
          "linear-gradient(to bottom, rgba(255,255,255,0.95) 0 1px, transparent 1px)",
        backgroundSize: "100% 5.0px",
        backgroundRepeat: "repeat-y",
        ...style,
      }}
    />
  );
}
