import { createStart, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { clerkMiddleware } from "@clerk/tanstack-react-start/server";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      "[errorMiddleware] caught:",
      error instanceof Error
        ? `${error.name}: ${error.message}\n${error.stack}`
        : JSON.stringify(error),
    );

    // Clerk's handshake verification can throw on malformed/expired
    // tokens — that shouldn't take down the page. Strip the handshake
    // param and bounce to the same URL so the user can continue
    // (they'll just appear signed-out and can retry sign-in).
    if (message.includes("Handshake token verification failed")) {
      try {
        const req = getRequest();
        if (req) {
          const cleanUrl = new URL(req.url);
          if (cleanUrl.searchParams.has("__clerk_handshake")) {
            console.error(
              "[errorMiddleware] handshake param length:",
              (cleanUrl.searchParams.get("__clerk_handshake") ?? "").length,
            );
            cleanUrl.searchParams.delete("__clerk_handshake");
            cleanUrl.searchParams.delete("__clerk_help");
            return new Response(null, {
              status: 302,
              headers: { Location: cleanUrl.toString() },
            });
          }
        }
      } catch (innerErr) {
        console.error("[errorMiddleware] handshake recovery failed:", innerErr);
      }
    }

    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Order matters: errorMiddleware (outer) wraps everything; clerkMiddleware
// (inner) attaches Clerk auth state to the request so server fns and
// route loaders can call `auth()` / `clerkClient()`.
export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, clerkMiddleware()],
}));
