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

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
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
      { title: "Lovable App" },
      { name: "description", content: "Lovable Generated Project" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "Lovable Generated Project" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
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
