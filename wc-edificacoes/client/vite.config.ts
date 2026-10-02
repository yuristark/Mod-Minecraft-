import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// `npm run build`       → build de produção (servido pelo Express, com API real)
// `npm run build:demo`  → arquivo único HTML com dados de demonstração (sem back-end)
export default defineConfig(({ mode }) => {
  const demo = mode === "demo";
  return {
    plugins: [react(), ...(demo ? [viteSingleFile()] : [])],
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
    build: {
      outDir: demo ? "dist-demo" : "dist",
      sourcemap: false, // não publica o código-fonte original em produção
      assetsInlineLimit: demo ? 100_000_000 : 4096,
      cssCodeSplit: !demo,
      // three.js (~570 kB) fica num chunk próprio, carregado só quando uma cena 3D aparece
      chunkSizeWarningLimit: 700,
    },
    server: {
      port: 5173,
      proxy: {
        "/api": { target: "http://localhost:3000", changeOrigin: false },
        "/uploads": { target: "http://localhost:3000", changeOrigin: false },
      },
    },
  };
});
