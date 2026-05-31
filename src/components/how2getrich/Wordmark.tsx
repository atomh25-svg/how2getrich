import moneyStack from "@/assets/money-stack.png";

/**
 * "how2getrich" wordmark with the money stack overhang on the right.
 *
 * Used as the brand header on the landing page (/) and also on /todo
 * while a tailored plan is generating — so users see the brand instead
 * of an empty "To Do:" header during the wait.
 *
 * Style notes:
 *   - Cabin Condensed Bold + a 0.9px text-stroke to fake an extra-bold
 *     weight without the synthesized-bold uglies.
 *   - scaleY(0.70) scaleX(0.88) gives the marquee proportion the user
 *     dialed in iteratively — keep these in sync if they get adjusted.
 *   - The two "h"s get an extra 5% horizontal stretch so the round
 *     shapes don't visually collapse from the parent's scaleX.
 */
export function Wordmark() {
  return (
    <div className="relative mt-[44.3px] inline-block">
      <h1
        className="text-[33.1px] leading-none text-white"
        style={{
          fontFamily: '"Handjet", "Oxanium", system-ui, sans-serif',
          fontWeight: 700,
          WebkitTextStroke: "0.5px white",
          letterSpacing: "0.5px",
          transform: "scaleY(0.70) scaleX(0.65)",
          transformOrigin: "center",
          display: "inline-block",
          position: "relative",
          top: "4.4px",
        }}
      >
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
        width={29}
        height={29}
        className="absolute left-full top-1/2 ml-[-22px] h-[30px] w-[30px] object-contain"
        style={{
          imageRendering: "pixelated",
          transform: "translateY(calc(-50% + 5px))",
          filter:
            "drop-shadow(0 0 7px rgba(0, 217, 54, 0.35)) drop-shadow(0 0 14px rgba(0, 217, 54, 0.15))",
        }}
        draggable={false}
      />
    </div>
  );
}
