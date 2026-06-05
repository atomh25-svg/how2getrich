/**
 * Animated SVG ring that fills 0% → ~92% over `durationMs` (default
 * 6s) on mount, then holds. The "hold" point sits short of 100% so a
 * fast plan generation visibly snaps the ring forward when navigation
 * actually happens — feels responsive without lying about progress.
 *
 * Loosely inspired by the Claude context-window pie indicator: a
 * partial ring stroke around a quiet center, easing toward 'full'
 * without overshooting.
 *
 * The label prop renders the center text (e.g. "generating…"); kept
 * generic so other screens (per-day breakdown loader, etc.) can
 * reuse without restyling.
 */
export function RingLoader({
  label = "generating your plan…",
  durationMs = 6000,
  size = 96,
  strokeWidth = 6,
  color = "rgb(120, 220, 130)",
  trackColor = "rgba(255, 255, 255, 0.08)",
}: {
  label?: string;
  durationMs?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Hold at 92% so a quick completion visibly snaps forward when the
  // page actually navigates away to render the loaded content.
  const endOffset = circumference * (1 - 0.92);
  const anim = `ring-fill-${Math.round(circumference)}`;

  return (
    <div className="flex flex-col items-center gap-[14px]">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        {/* Track ring — full circle at low opacity. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress ring — starts empty (full dashoffset), animates
            to 92% filled over durationMs. transform rotates the start
            point to 12 o'clock so the arc reads as a clockwise fill. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            animation: `${anim} ${durationMs}ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
            filter: `drop-shadow(0 0 6px ${color})`,
          }}
        />
      </svg>
      <style>{`
        @keyframes ${anim} {
          0%   { stroke-dashoffset: ${circumference}; }
          100% { stroke-dashoffset: ${endOffset}; }
        }
      `}</style>
      <span
        className="text-[15px] tracking-wide text-white/70"
        style={{
          fontFamily:
            '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
        }}
      >
        {label}
      </span>
    </div>
  );
}
