import { Show, SignInButton, UserButton } from "@clerk/tanstack-react-start";

/**
 * Fixed widget pinned to the bottom-left corner of the viewport.
 * Shows the Clerk UserButton avatar when signed in, a small "sign in"
 * text link when signed out (opens Clerk's modal in place).
 *
 * Mounted once in PageLayout so it appears on every screen at the
 * same coordinates. Sits in the same z-30 layer as the disclaimer
 * footer so it never gets clipped by stage content.
 */
export function AuthCorner() {
  return (
    <div className="fixed bottom-[10px] left-[14px] z-30">
      <Show when="signed-in">
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              // Trim the avatar a touch so it visually weighs the same
              // as the 10px disclaimer line at the bottom-center.
              userButtonAvatarBox: { width: 26, height: 26 },
            },
          }}
        />
      </Show>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            className="cursor-pointer text-[12px] leading-none text-white/60 transition hover:text-white"
            style={{
              fontFamily:
                '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace',
            }}
          >
            sign in
          </button>
        </SignInButton>
      </Show>
    </div>
  );
}
