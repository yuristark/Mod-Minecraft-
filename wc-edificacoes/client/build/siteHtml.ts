/**
 * Plugin de build: gera, a partir de src/config/site.ts (fonte única dos dados da empresa),
 *  - metatags de SEO e compartilhamento (título, descrição, canonical, Open Graph, Twitter);
 *  - dados estruturados JSON-LD (GeneralContractor) para o Google;
 *  - uma tela de reserva dentro de #root, visível só se o JavaScript não rodar
 *    (visualizador de arquivos do celular, navegador muito antigo, bloqueio de scripts).
 *    Com JavaScript, o React substitui esse conteúdo antes de ele aparecer.
 */
import type { Plugin } from "vite";
import { site, whatsappLink } from "../src/config/site.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function siteHtml(): Plugin {
  const title = `${site.name} — ${site.tagline}`;
  const description = `${site.name}: construção residencial, comercial e industrial, reformas e retrofit em ${site.serviceArea}. Peça seu orçamento e simule o custo da sua obra.`;
  const ogImage = `${site.url}/og-image.png`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "GeneralContractor",
    name: site.name,
    legalName: site.legalName,
    url: site.url,
    logo: `${site.url}/icon-512.png`,
    image: ogImage,
    description: site.pitch,
    telephone: site.contact.phoneHref,
    email: site.contact.email,
    address: site.contact.address,
    areaServed: site.serviceArea,
    foundingDate: String(site.foundedYear),
    sameAs: Object.values(site.social).filter(Boolean),
  };

  const head = `
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${esc(site.url)}/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(site.name)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(site.pitch)}" />
    <meta property="og:url" content="${esc(site.url)}/" />
    <meta property="og:image" content="${esc(ogImage)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="pt_BR" />
    <meta name="twitter:card" content="summary_large_image" />
    <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`;

  const shell = `
      <div class="boot-fallback on-dark grid min-h-[100dvh] place-items-center bg-ink px-6 py-16 text-center text-paper">
        <div class="max-w-md">
          <p class="font-mono text-xs uppercase tracking-[0.14em] text-signal">${esc(site.tagline)}</p>
          <h1 class="mt-4 text-4xl font-bold uppercase">${esc(site.name)}</h1>
          <p class="mt-4 text-paper/70">${esc(site.pitch)}</p>
          <p class="mt-6 text-sm text-paper/60">Para ver o site completo, abra este endereço no Chrome ou no Safari atualizados.</p>
          <div class="mt-8 flex flex-col gap-3">
            <a class="btn btn-signal" href="${esc(whatsappLink())}" target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a>
            <a class="btn btn-ghost" href="tel:${esc(site.contact.phoneHref)}">${esc(site.contact.phone)}</a>
            <a class="btn btn-ghost" href="mailto:${esc(site.contact.email)}">${esc(site.contact.email)}</a>
          </div>
        </div>
      </div>`;

  return {
    name: "wc-site-html",
    transformIndexHtml: {
      order: "pre",
      handler: (html) =>
        html
          .replace("<!--SITE_HEAD-->", head)
          .replace('<div id="root"></div>', `<div id="root">${shell}\n    </div>`),
    },
  };
}
