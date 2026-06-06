import { Link } from "@tanstack/react-router";
import { Show, SignInButton } from "@clerk/tanstack-react-start";

/**
 * Left-side nav rail used on every how2getrich screen. Items in 17px
 * VT323 — smaller than the wordmark on purpose so the wordmark stays
 * the primary focal point.
 *
 * Structure:
 *   Home
 *   About
 *   My Plan          ← only visible when signed in (route itself gates
 *                       on paid status; signed-in non-payers see the
 *                       paywall when they click)
 *   Login / Account  ← switches based on Clerk auth state
 *
 * The legacy bottom-left <AuthCorner /> avatar was removed in favor of
 * this inline approach so all nav lives in one place.
 */
export function Sidebar() {
  return (
    <nav
      aria-label="Primary"
      className="w-[156px] shrink-0 text-white"
      style={{
        fontFamily:
          '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
      }}
    >
      <SidebarLink to="/" label="Home" />
      <Divider />
      <SidebarLink to="/about" label="About" className="mt-[12.5px]" />

      {/* My Plan — only surfaces in the rail once the user is signed
          in. The /my-plan route enforces paid status server-side, so
          a signed-in-but-unpaid click lands on the upgrade page. */}
      <Show when="signed-in">
        <Divider />
        <SidebarLink to="/my-plan" label="My Plan" className="mt-[12.5px]" />
      </Show>

      <Divider />

      {/* Auth — single rail item that flips between Login (modal) and
          Account (route) based on Clerk session. Replaces the old
          fixed bottom-left widget. */}
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            className="block h-[21px] w-full cursor-pointer text-center text-[17px] leading-none text-white/90 transition hover:text-white mt-[12.5px]"
            style={{
              fontFamily:
                '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
            }}
          >
            Login
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <SidebarLink to="/account" label="Account" className="mt-[12.5px]" />
      </Show>
    </nav>
  );
}

function SidebarLink({
  to,
  label,
  className = "",
}: {
  to: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`block h-[21px] text-center text-[17px] leading-none text-white/90 transition hover:text-white ${className}`}
    >
      {label}
    </Link>
  );
}

/** 22px white underline tucked between two sidebar items. */
function Divider() {
  return (
    <span
      aria-hidden
      className="mx-auto mt-[12.5px] block h-px w-[22px] bg-white/55"
    />
  );
}
