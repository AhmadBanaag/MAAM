import type { NextConfig } from "next";
import os from "node:os";

function getDevOrigins(): string[] {
  const origins = ["localhost", "127.0.0.1", "localhost:3000", "127.0.0.1:3000"];
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          origins.push(iface.address);
          origins.push(`${iface.address}:3000`);
        }
      }
    }
  } catch {
    // ignore
  }
  return origins;
}

const nextConfig: NextConfig = {
  // Automatically permit all local network adapters for smartphone access
  allowedDevOrigins: getDevOrigins(),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
