import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";
import { AuthCorner } from "./AuthCorner";

/**
 * Shared chrome for every how2getrich screen.
 *
 * Layout model:
 *   - Stage (540px) is mx-auto centered on the viewport so the
 *     wordmark, spine, and textarea sit perfectly on the vertical
 *     midline regardless of viewport width.
 *   - Sidebar is absolutely positioned 100px to the LEFT of the stage's
 *     left edge using `right-full mr-[100px]` — it floats next to the
 *     stage without ever pushing it off-center.
 *   - rightRail (optional) is positioned absolutely against the viewport
 *     right edge for screens 2/3.
 *
 * On viewports narrower than ~1100px the sidebar clips off the left
 * — hidden behind `md:block` so it disappears cleanly on tablets.
 */
export function PageLayout({
  children,
  rightRail,
}: {
  children: ReactNode;
  rightRail?: ReactNode;
}) {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-black text-white">
      {/* Stage column is a flex container with a fixed minimum height
          so its children's flex-1 (e.g. the dotted spine) actually
          stretches to fill the page instead of collapsing to its
          min-height. */}
      <div className="relative mx-auto flex w-[540px] max-w-full flex-col items-center px-6 pt-[48px]">
        {/* Sidebar — anchored to the stage's left edge with a 55px
            gap. The stage stays perfectly viewport-centered because
            the sidebar is absolutely positioned outside the flow. */}
        <div className="absolute right-full top-[186px] mr-[25px] hidden md:block">
          <Sidebar />
        </div>
        {children}
      </div>
      {rightRail}
      <Footer />
      {/* Auth widget pinned to the bottom-left corner of the viewport. */}
      <AuthCorner />
    </main>
  );
}
