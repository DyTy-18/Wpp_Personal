import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Baileys/Prisma solo corren en el worker y el servidor, no en el bundle del cliente
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
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
