import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // argon2 ships a native binary. Keep it (and pino's worker threads) out of the bundle.
  serverExternalPackages: ["@node-rs/argon2", "pino", "pino-pretty"],
};

export default nextConfig;
