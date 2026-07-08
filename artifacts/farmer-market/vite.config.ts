import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT ?? "5173";
const port = Number(rawPort);

const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig(async ({ mode }) => {
  // Load environment variables from the workspace root (.env)
  const env = loadEnv(mode, path.resolve(import.meta.dirname, "../../"), "");

  const clerkPublishableKey = env.VITE_CLERK_PUBLISHABLE_KEY || env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || "";
  const hasClerkKey = !!clerkPublishableKey;

  return {
    base: basePath,
    define: {
      // Bridge server-side secret to Vite's client env (CLERK_PUBLISHABLE_KEY is a public key)
      "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify(clerkPublishableKey),
    },
    plugins: [
      react(),
      tailwindcss({ optimize: false }),
      runtimeErrorOverlay(),
      ...(process.env.NODE_ENV !== "production" &&
      process.env.REPL_ID !== undefined
        ? [
            await import("@replit/vite-plugin-cartographer").then((m) =>
              m.cartographer({
                root: path.resolve(import.meta.dirname, ".."),
              }),
            ),
            await import("@replit/vite-plugin-dev-banner").then((m) =>
              m.devBanner(),
            ),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
        ...(!hasClerkKey
          ? {
              "@clerk/react": path.resolve(import.meta.dirname, "src/clerk-mock.tsx"),
              "@clerk/react/internal": path.resolve(import.meta.dirname, "src/clerk-mock.tsx"),
              "@clerk/shared/keys": path.resolve(import.meta.dirname, "src/clerk-mock.tsx"),
            }
          : {}),
      },
      dedupe: ["react", "react-dom"],
    },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  };
});
