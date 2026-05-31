import { Link } from "@tanstack/react-router";
import { Show, SignInButton } from "@clerk/tanstack-react-start";

/**
 * Left-side nav rail used on every how2getrich screen. Three primary
 * items (Home / About / Dashboard) plus an auth-state-aware Account
 * link at the bottom. All in JetBrains Mono — smaller than the
 * wordmark on purpose so the wordmark stays the primary focal point.
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
      <SidebarLink to="/todo" label="About" className="mt-[17px]" />
      <Divider />
      <SidebarLink to="/todo/upgrade" label="Dashboard" className="mt-[17px]" />
      <Divider />
      {/* Signed in → "Account" routes to /account.
          Signed out → "Sign in" opens Clerk's modal in place. */}
      <Show when="signed-in">
        <SidebarLink to="/account" label="Account" className="mt-[17px]" />
      </Show>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            className="mt-[17px] block h-[21px] w-full cursor-pointer text-center text-[17px] leading-none text-white/90 transition hover:text-white"
          >
            Sign in
          </button>
        </SignInButton>
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

/** 31px white underline tucked between two sidebar items. */
function Divider() {
  return (
    <span
      aria-hidden
      className="mx-auto mt-[17px] block h-px w-[22px] bg-white/55"
    />
  );
}
