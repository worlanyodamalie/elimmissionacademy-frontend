// Same-origin reverse proxy to the backend.
//
// Why: the backend doesn't (yet) send CORS headers for our origin, so the
// browser blocks direct calls. By routing every API request through this
// handler we keep the browser on the same origin and let the Next.js server
// talk to the backend, where CORS doesn't apply.
//
// The frontend talks to `/api/proxy/<backend-path>`. We strip `/api/proxy`
// and forward to `${BACKEND_API_BASE_URL}/<backend-path>`, preserving method,
// query string, headers (minus hop-by-hop), and body.

import { NextResponse, type NextRequest } from "next/server";

const BACKEND_API_BASE_URL = process.env.BACKEND_API_BASE_URL;

if (!BACKEND_API_BASE_URL) {
  throw new Error(
    "BACKEND_API_BASE_URL is not set. Add it to .env.local (server-side, not NEXT_PUBLIC_).",
  );
}

const BACKEND = BACKEND_API_BASE_URL.replace(/\/$/, "");

// Path segments must be plain. Stops smuggling of `..`, `%2F`, `;`, etc. that
// could let a caller probe sibling paths on the upstream host (e.g. Spring
// Actuator endpoints on a `/api/v1`-rooted backend).
const SAFE_SEGMENT = /^[A-Za-z0-9._~-]+$/;

// Headers we forward from the browser to the backend.
//
// We use an allow-list rather than a deny-list because browser-set headers
// like `Origin`, `Referer`, `Sec-Fetch-*`, and `Cookie` cause many backends
// (including Spring Security and Cloudflare-fronted apps) to treat the
// request as a suspicious cross-origin call and return 403. Stripping them
// makes the request look like a clean server-to-server call.
const FORWARDABLE_REQUEST_HEADERS = new Set([
  "accept",
  "accept-language",
  "authorization",
  "content-type",
  "x-school-code",
]);

// Response headers we do NOT pass back to the browser. Hop-by-hop and
// content-encoding (because fetch already decoded the body for us).
const SKIP_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "content-encoding",
  "content-length",
]);

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, ctx: Ctx): Promise<Response> {
  // Reject cross-origin POSTs/PUTs/etc. that attempt to drive our proxy from
  // a third-party site. Same-origin requests don't send `Origin` for safe
  // navigations, so absence is allowed; presence must match our deployment.
  const incomingOrigin = req.headers.get("origin");
  if (incomingOrigin) {
    const ourOrigin = new URL(req.nextUrl.toString()).origin;
    if (incomingOrigin !== ourOrigin) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  }

  const { path } = await ctx.params;
  if (!path.length || !path.every((seg) => SAFE_SEGMENT.test(seg))) {
    return NextResponse.json(
      { message: "Invalid request path." },
      { status: 400 },
    );
  }

  const target = new URL(`${BACKEND}/${path.join("/")}`);
  // Defence-in-depth: even after segment validation, make sure URL parsing
  // didn't escape the backend prefix.
  if (!target.toString().startsWith(`${BACKEND}/`)) {
    return NextResponse.json(
      { message: "Invalid request path." },
      { status: 400 },
    );
  }

  req.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.append(key, value);
  });

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (FORWARDABLE_REQUEST_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  // Identify ourselves to the backend; some hosts block the default
  // "node" user-agent.
  if (!headers.has("user-agent")) {
    headers.set("user-agent", "ema-dashboard-proxy/1.0");
  }

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      method: req.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });
  } catch (err) {
    return NextResponse.json(
      {
        message:
          err instanceof Error
            ? `Upstream request failed: ${err.message}`
            : "Upstream request failed.",
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!SKIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;

// Keep this dynamic — auth tokens and bodies must never be cached.
export const dynamic = "force-dynamic";
