/**
 * Indeterminate spinning ring loader. A partial-arc circle rotates
 * continuously — never "freezes" mid-load even if the underlying
 * request takes longer than expected. White stroke on a quiet track,
 * tuned for the warm-black how2getrich palette.
 *
 * Generic `label` prop renders centered text below the ring so other
 * screens (per-day breakdown loader, next-month sentinel, etc.) can
 * reuse without restyling. `durationMs` controls spin speed only —
 * the animation loops forever; it doesn't "complete."
 */
export function RingLoader({
  label = "generating your plan…",
  durationMs = 900,
  size = 56,
  strokeWidth = 4,
  color = "rgba(255, 255, 255, 0.92)",
  trackColor = "rgba(255, 255, 255, 0.08)",
}: {
  label?: string;
  /** Time for one full rotation (ms). Smaller = faster spin. */
  durationMs?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Visible arc length = ~25% of the circle. Feels active without
  // looking like a finished progress bar.
  const arcLength = circumference * 0.25;
  const gapLength = circumference - arcLength;
  // Unique animation name so multiple ring instances on the same
  // page don't collide on the @keyframes block.
  const animName = `ring-spin-${size}-${Math.round(durationMs)}`;

  return (
    <div className="flex flex-col items-center gap-[14px]">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        {/* Track — quiet full ring under the spinning arc. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Spinning arc — rotates clockwise forever. The whole circle
            (not just the dasharray pattern) is rotated via CSS
            transform so the arc visibly travels around the track. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${arcLength} ${gapLength}`}
          style={{
            transformOrigin: `${size / 2}px ${size / 2}px`,
            animation: `${animName} ${durationMs}ms linear infinite`,
          }}
        />
      </svg>
      <style>{`
        @keyframes ${animName} {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
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
