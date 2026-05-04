import type { NextConfig } from "next";

// Content-Security-Policy. Tight by default; relaxes a couple of directives
// in development because Next.js' dev tooling (HMR overlay, RSC streams) uses
// inline event handlers and `eval`. Production gets the strict version.
//
// Note: a fully nonce-based script-src would be stricter still, but requires
// middleware-generated nonces. We can move there later — this is already a
// massive improvement over no policy.
function buildCsp(isDev: boolean): string {
  const scriptSrc = isDev
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self' 'unsafe-inline'";
  const styleSrc = "'self' 'unsafe-inline'"; // Tailwind / inline styles
  const connectSrc = isDev
    ? "'self' ws: wss:" // HMR websocket
    : "'self'";
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: buildCsp(process.env.NODE_ENV !== "production"),
  },
  // Legacy backup for browsers that don't honour `frame-ancestors`.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

// Token-bearing email links must NEVER leak through the Referer header to
// any future third-party asset on these pages.
const NO_REFERRER = [{ key: "Referrer-Policy", value: "no-referrer" }];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: "/admin-setup", headers: NO_REFERRER },
      { source: "/setup-password", headers: NO_REFERRER },
      { source: "/reset-password", headers: NO_REFERRER },
    ];
  },
};

export default nextConfig;
