import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { siteHtml } from "./build/siteHtml.ts";

// `npm run build`       → build de produção (servido pelo Express, com API real)
// `npm run build:demo`  → arquivo único HTML com dados de demonstração (sem back-end)
export default defineConfig(({ mode }) => {
  const demo = mode === "demo";
  return {
    plugins: [react(), siteHtml(), ...(demo ? [viteSingleFile()] : [])],
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
    build: {
      outDir: demo ? "dist-demo" : "dist",
      sourcemap: false, // não publica o código-fonte original em produção
      // Compatibilidade com celulares mais antigos (iPhone com iOS 14+, Android com Chrome 87+).
      // O padrão do Vite só atende navegadores de 2023 em diante — em aparelhos antigos o script
      // nem chegava a rodar e a página ficava em branco.
      target: ["es2020", "safari14", "ios14", "chrome87", "edge88", "firefox78"],
      cssTarget: ["safari14", "ios14", "chrome87", "edge88", "firefox78"],
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
