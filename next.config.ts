import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Supabase is used over REST only (never Realtime). Keep the client + its transitive ws/realtime deps
  // external from the bundled Node serverless functions: `ws` references __dirname for its optional native
  // addons, and bundling it throws "ReferenceError: __dirname is not defined" at runtime on Vercel.
  // External = required from node_modules at runtime, where __dirname resolves.
  // (NOTE: the project's Vercel "Framework Preset" MUST be Next.js — a blank/"Other" project ignores the
  // .next output entirely and serves only public/ + a 404 catch-all.)
  serverExternalPackages: ["@supabase/supabase-js", "@supabase/realtime-js", "ws"],
  webpack: (config, { isServer, nextRuntime }) => {
    if (isServer && nextRuntime === "nodejs") {
      const external = { ws: "commonjs ws", bufferutil: "commonjs bufferutil", "utf-8-validate": "commonjs utf-8-validate" };
      config.externals = Array.isArray(config.externals) ? [...config.externals, external] : [config.externals, external];
    }
    return config;
  },
};

export default nextConfig;
