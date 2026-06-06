/**
 * Indeterminate spinning ring loader with the label centered INSIDE
 * the ring (not below). A 25%-arc white stroke rotates clockwise
 * forever on a quiet track; the text sits inert in the middle while
 * the arc travels around it.
 *
 * Sized for the label to fit comfortably inside on the default
 * (180px). Pass a smaller `size` for tight contexts — at <120px the
 * label gets cramped, so set `label=""` for tiny indeterminate
 * spinners.
 */
export function RingLoader({
  label = "generating…",
  durationMs = 900,
  size = 180,
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
  const arcLength = circumference * 0.25;
  const gapLength = circumference - arcLength;
  const animName = `ring-spin-${size}-${Math.round(durationMs)}`;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
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
        {/* Spinning arc — rotates clockwise forever. */}
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
      {label && (
        <span
          className="absolute inset-0 flex items-center justify-center text-center leading-tight tracking-wide text-white/75"
          style={{
            // Scale font with ring size so the label sits inside
            // cleanly at any size, with a floor of 10px for legibility.
            fontSize: `${Math.max(10, Math.round(size * 0.085))}px`,
            // 14% inner padding so multi-word labels wrap inside the
            // ring rather than colliding with the arc.
            padding: `0 ${Math.round(size * 0.14)}px`,
            fontFamily:
              '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
