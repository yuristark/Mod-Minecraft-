/**
 * Gera os ícones do site (favicon PNG, ícone de app, apple-touch-icon) e a imagem de
 * compartilhamento (og-image.png, 1200×630 — aparece ao enviar o link no WhatsApp,
 * Facebook, LinkedIn...) a partir de public/favicon.svg e de src/config/site.ts.
 *
 * Rode depois de trocar logo, nome ou textos da empresa:
 *   npx playwright install chromium   (só na primeira vez)
 *   npm run assets
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { site } from "../src/config/site.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");
const svg = fs.readFileSync(path.join(pub, "favicon.svg"), "utf8");
const font = (f: string) => `data:font/woff2;base64,${fs.readFileSync(path.join(root, "src/assets/fonts", f)).toString("base64")}`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();

// Ícones quadrados: o logo com margem de segurança (ícones "maskable" do Android cortam as bordas)
for (const [file, size, pad] of [["icon-192.png", 192, 0.12], ["icon-512.png", 512, 0.12], ["apple-touch-icon.png", 180, 0.1], ["favicon-48.png", 48, 0]] as const) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:#17181a;display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${Math.round(size * (1 - pad * 2))}px;height:${Math.round(size * (1 - pad * 2))}px">${svg.replace("<svg", '<svg width="100%" height="100%"')}</div></body></html>`);
  await page.screenshot({ path: path.join(pub, file) });
}

// Imagem de compartilhamento
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<html><head><style>
  @font-face { font-family: Archivo; src: url(${font("archivo-var.woff2")}); font-weight: 100 900; font-stretch: 62% 125%; }
  @font-face { font-family: Plex; src: url(${font("plex-mono-500.woff2")}); }
  body { margin: 0; width: 1200px; height: 630px; background: #17181a; color: #f8f6f2; font-family: Archivo; position: relative; overflow: hidden;
    background-image: linear-gradient(to right, rgb(248 246 242 / .07) 1px, transparent 1px), linear-gradient(to bottom, rgb(248 246 242 / .07) 1px, transparent 1px);
    background-size: 48px 48px; }
  .glow { position: absolute; right: -160px; top: 80px; width: 620px; height: 620px; border-radius: 50%; background: rgb(232 100 44 / .18); filter: blur(90px); }
  .wrap { position: absolute; inset: 72px 80px; display: flex; flex-direction: column; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 20px; }
  .brand svg { width: 72px; height: 72px; }
  .name { font-size: 34px; font-weight: 800; font-stretch: 125%; text-transform: uppercase; }
  .tag { font-family: Plex; font-size: 16px; letter-spacing: .16em; text-transform: uppercase; color: rgb(248 246 242 / .6); margin-top: 6px; }
  h1 { margin: 0; font-size: 76px; line-height: .95; font-weight: 700; font-stretch: 112%; text-transform: uppercase; letter-spacing: -.02em; max-width: 900px; }
  h1 span { color: #e8642c; }
  .foot { display: flex; justify-content: space-between; font-family: Plex; font-size: 18px; letter-spacing: .1em; text-transform: uppercase; color: rgb(248 246 242 / .65); border-top: 1px solid rgb(248 246 242 / .2); padding-top: 22px; }
  .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 10px; background: #e8642c; }
</style></head><body><div class="glow"></div><div class="wrap">
  <div class="brand">${svg}<div><div class="name">${esc(site.name)}</div><div class="tag">${esc(site.tagline)}</div></div></div>
  <h1>Construímos com método. <span>Entregamos no prazo.</span></h1>
  <div class="foot"><span>${esc(site.serviceArea.split(",")[0])} e região</span><span>${esc(site.url.replace(/^https?:\/\//, ""))}</span></div>
</div><div class="bar"></div></body></html>`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(pub, "og-image.png") });

await browser.close();
console.log("Ícones e og-image.png gerados em public/");
