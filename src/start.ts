import { createStart, createMiddleware } from "@tanstack/react-start";
import { clerkMiddleware } from "@clerk/tanstack-react-start/server";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
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
