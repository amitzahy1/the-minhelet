import type { NextConfig } from "next";

// A unique id per deploy. On Vercel this is the git SHA (stable + meaningful);
// locally it falls back to a build timestamp so each `next build` differs.
// Baked into the client bundle (NEXT_PUBLIC_) AND readable by /api/version, so a
// stale client can detect that a newer version has shipped and offer a reload.
// This is the update mechanism for the standalone iOS PWA (no service worker).
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  `dev-${Date.now()}`;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
  async headers() {
    return [
      {
        // Hashed, content-addressed build assets are immutable — let iOS cache
        // them long-term (avoids needless re-downloads); a new deploy emits new
        // hashes so this never serves stale code.
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Everything else (notably the HTML document) must always revalidate so
        // a new deploy is picked up on the next document fetch / reload.
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
