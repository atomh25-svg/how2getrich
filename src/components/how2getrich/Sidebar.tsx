import { Link } from "@tanstack/react-router";

/**
 * Left-side nav rail used on every how2getrich screen. Three items
 * (Home / About / Dashboard) in 17px VT323 — smaller than the
 * wordmark on purpose so the wordmark stays the primary focal point.
 *
 * Auth (Sign in / Account) lives in <AuthCorner /> at the bottom-left
 * of the viewport instead of inside this rail — keeps the three primary
 * items as a tight visual group.
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
