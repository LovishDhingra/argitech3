import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

const rawPort = process.env.PORT ?? "5173";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    mockupPreviewPlugin(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@/lib/utils": path.resolve(import.meta.dirname, "../farmer-market/src/lib/utils.ts"),
      "@/components/ui/input": path.resolve(import.meta.dirname, "../farmer-market/src/components/ui/input.tsx"),
      "@/components/ui/textarea": path.resolve(import.meta.dirname, "../farmer-market/src/components/ui/textarea.tsx"),
      "@/hooks/use-mobile": path.resolve(import.meta.dirname, "../farmer-market/src/hooks/use-mobile.tsx"),
      "@/components/ui/separator": path.resolve(import.meta.dirname, "../farmer-market/src/components/ui/separator.tsx"),
      "@/components/ui/sheet": path.resolve(import.meta.dirname, "../farmer-market/src/components/ui/sheet.tsx"),
      "@/components/ui/skeleton": path.resolve(import.meta.dirname, "../farmer-market/src/components/ui/skeleton.tsx"),
      "@/components/ui/tooltip": path.resolve(import.meta.dirname, "../farmer-market/src/components/ui/tooltip.tsx"),
      "@/components/ui/toast": path.resolve(import.meta.dirname, "../farmer-market/src/components/ui/toast.tsx"),
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
