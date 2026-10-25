import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { isAllowedDomainRequest } from "./lib/domain-lock.server";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

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

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const domainLockMiddleware = createMiddleware().server(async ({ next, handlerType }) => {
  const host = getRequestHeader("host");
  const origin = getRequestHeader("origin");
  if (!isAllowedDomainRequest(host, origin)) {
    return new Response(
      handlerType === "router" ? "Forbidden" : JSON.stringify({ error: "Forbidden" }),
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type":
            handlerType === "router" ? "text/plain; charset=utf-8" : "application/json",
        },
      },
    );
  }
  return next();
});

const marketplaceHomeRedirectMiddleware = createMiddleware().server(
  async ({ next, handlerType }) => {
    if (handlerType === "router") {
      const request = getRequest();
      const { pathname } = new URL(request.url);
      if (pathname === "/marketplace" || pathname === "/marketplace/") {
        return new Response(null, {
          status: 301,
          headers: { Location: "/" },
        });
      }
    }
    return next();
  },
);

const localeCacheMiddleware = createMiddleware().server(async ({ next, handlerType }) => {
  const result = await next();
  if (
    handlerType === "router" &&
    result.response.headers.get("content-type")?.includes("text/html")
  ) {
    const headers = new Headers(result.response.headers);
    const vary = new Set(
      (headers.get("vary") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
    vary.add("Cookie");
    vary.add("Accept-Language");
    headers.set("vary", [...vary].join(", "));
    headers.set("cache-control", "private, no-cache");
    return {
      ...result,
      response: new Response(result.response.body, {
        status: result.response.status,
        statusText: result.response.statusText,
        headers,
      }),
    };
  }
  return result;
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [
    domainLockMiddleware,
    marketplaceHomeRedirectMiddleware,
    errorMiddleware,
    csrfMiddleware,
    localeCacheMiddleware,
  ],
}));
