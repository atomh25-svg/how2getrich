import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { ClerkProvider } from "@clerk/tanstack-react-start";

import appCss from "../styles.css?url";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;
// Cropped, tighter-bounding-box version of the money stack so the
// pixel art actually fills the favicon area at 16/32px instead of
// shrinking into a sea of transparent padding.
import moneyFaviconUrl from "../assets/money-favicon.png?url";

// Themed 404/error pages — match the black + VT323 + green-accent
// brand instead of generic tailwind grays. Both pages stand on their
// own (no PageLayout/sidebar) since sidebar nav routes could be the
// thing that's broken.
const FONT =
  '"VT323", "JetBrains Mono", ui-monospace, "SF Mono", monospace';

function NotFoundComponent() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-black px-4 text-white"
      style={{ fontFamily: FONT }}
    >
      <div className="max-w-md text-center">
        <h1 className="text-[80px] leading-none text-emerald-400/90">404</h1>
        <h2 className="mt-[12px] text-[20px] text-white/90">page not found</h2>
        <p className="mt-[10px] text-[14px] text-white/55">
          the page you're looking for doesn't exist (or maybe it does, just
          not where you typed). try the home page.
        </p>
        <div className="mt-[20px]">
          <Link
            to="/"
            className="inline-flex h-[44px] items-center justify-center rounded-[4px] bg-emerald-400/20 px-[20px] text-[14px] text-emerald-300 transition hover:bg-emerald-400/30 hover:text-emerald-100"
          >
            go home →
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-black px-4 text-white"
      style={{ fontFamily: FONT }}
    >
      <div className="max-w-md text-center">
        <h1 className="text-[22px] tracking-tight text-white">
          something broke
        </h1>
        <p className="mt-[10px] text-[14px] text-white/55">
          not your fault. try refreshing or head back home — if it keeps
          happening, email{" "}
          <a
            href="mailto:support@how2getrich.online"
            className="text-emerald-400 transition hover:text-emerald-200"
          >
            support@how2getrich.online
          </a>
          .
        </p>
        <div className="mt-[20px] flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-[44px] items-center justify-center rounded-[4px] bg-emerald-400/20 px-[20px] text-[14px] text-emerald-300 transition hover:bg-emerald-400/30 hover:text-emerald-100"
          >
            try again
          </button>
          <a
            href="/"
            className="inline-flex h-[44px] items-center justify-center rounded-[4px] border border-white/20 px-[20px] text-[14px] text-white/85 transition hover:bg-white/10"
          >
            go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "how2getrich.online — your tailored 30-day plan" },
      {
        name: "description",
        content:
          "Tell us about you. AI hands you a real 30-day plan to start making money — no guru fluff. $9.99/mo, cancel anytime.",
      },
      { name: "author", content: "how2getrich.online" },
      // Open Graph — drives link-preview cards in iMessage, Slack,
      // Discord, WhatsApp, LinkedIn, Telegram, X feed posts.
      { property: "og:title", content: "how2getrich.online" },
      {
        property: "og:description",
        content:
          "Tell us about you. AI hands you a real 30-day plan to start making money.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://how2getrich.online" },
      {
        property: "og:image",
        content: "https://how2getrich.online/og-image.png",
      },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      // Twitter / X
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "how2getrich.online" },
      {
        name: "twitter:description",
        content:
          "Tell us about you. AI hands you a real 30-day plan to start making money.",
      },
      {
        name: "twitter:image",
        content: "https://how2getrich.online/og-image.png",
      },
      // Crawl / index defaults — individual pages can override.
      { name: "robots", content: "index, follow" },
      // Theme color shows up in mobile address bars (Safari iOS,
      // Chrome Android) and PWA install screens.
      { name: "theme-color", content: "#000000" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // Favicon = the same green pixel-art money stack used in the
      // how2getrich wordmark. Pixelated rendering keeps the chunky
      // 8-bit aesthetic at small sizes.
      { rel: "icon", type: "image/png", href: moneyFaviconUrl },
      { rel: "apple-touch-icon", href: moneyFaviconUrl },
      // Geist — Vercel's geometric sans (variable weight 100-900)
      // for the hero headline + giant LaunchFly wordmark.
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@400..900&family=Concert+One&family=Chakra+Petch:wght@400;500;600;700&family=Averia+Serif+Libre:wght@300;400;700&family=Spectral:wght@400;500;600;700&family=Dosis:wght@400;700;800&family=Nunito:wght@400;700;800;900&family=Patrick+Hand&family=Mali:wght@400;500;600;700&family=Handlee&family=Londrina+Solid:wght@100;300;400;900&family=Ramaraja&family=Moderustic:wght@300;400;500;600;700;800&family=Martel+Sans:wght@200;300;400;600;700;800;900&family=Sansita:wght@400;700;800;900&family=Anton&family=Lexend:wght@100..900&family=Cabin+Condensed:wght@400;500;600;700&family=Gravitas+One&family=Radio+Canada:wght@300;400;500;600;700&family=Geo:ital@0;1&family=Rationale&family=Kode+Mono:wght@400;500;600;700&family=Athiti:wght@200;300;400;500;600;700&family=Ovo&family=Miltonian&family=Rakkas&family=VT323&family=Geist+Mono:wght@100..900&family=Iceland&family=Oxanium:wght@200..800&family=Handjet:wght@100..900&family=JetBrains+Mono:wght@400;500;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Clerk wraps everything so any route can call `useUser()` /
  // `<SignedIn>` / `<UserButton>`. Appearance is themed to the
  // warm-dark/gold how2getrich palette so the hosted sign-in pages
  // + UserButton popovers don't look like a different product.
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      // After OAuth (Google) completes, send the user back to the
      // homepage. Without these set, Clerk dev mode bounces through
      // hosted callback URLs that don't exist on this app and our
      // 500 ErrorComponent renders.
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      appearance={{
        variables: {
          colorPrimary: "rgb(214, 166, 81)",         // warm gold
          colorBackground: "rgb(26, 22, 18)",         // warm dark
          colorText: "rgb(244, 239, 230)",            // bone white
          colorInputBackground: "rgb(36, 30, 24)",
          colorInputText: "rgb(244, 239, 230)",
          colorTextSecondary: "rgb(154, 146, 134)",
          borderRadius: "0.5rem",
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>
    </ClerkProvider>
  );
}
