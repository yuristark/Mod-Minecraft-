/**
 * MODO DEMONSTRAÇÃO — usado apenas no build `npm run build:demo`.
 * Simula a API em memória para mostrar o site e o painel sem servidor.
 * Nada aqui é enviado a lugar nenhum; ao recarregar a página tudo volta ao início.
 */
import samples from "@/data/sample-projects.json";
import { ApiError } from "./apiError";
import { computeEstimate } from "./estimate";
import type { Project, ProjectImage, Quote, SimulatorSettings } from "./types";

export const DEMO_LOGIN = { email: "demo@wcedificacoes.com.br", password: "demonstracao-2026" };

interface Store {
  projects: Project[];
  images: Record<number, ProjectImage[]>;
  quotes: Quote[];
  simulator: SimulatorSettings;
  loggedIn: boolean;
  audit: { id: number; action: string; entity: string | null; entityId: string | null; createdAt: string; adminName: string | null }[];
  seq: number;
}

let store: Store | null = null;

function daysAgo(n: number, h = 10) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, 12, 0, 0);
  return d.toISOString();
}

function init(): Store {
  const projects: Project[] = (samples as Array<Omit<Project, "id" | "published" | "cover">>).map((p, i) => ({
    ...p,
    id: i + 1,
    published: true,
    cover: null,
    imageCount: 0,
  })) as Project[];

  const simulator: SimulatorSettings = {
    pricePerM2: {
      residencial: { economico: 2100, medio: 2800, alto: 3900 },
      comercial: { economico: 2300, medio: 3100, alto: 4300 },
      industrial: { economico: 1700, medio: 2300, alto: 3200 },
      reforma: { economico: 900, medio: 1500, alto: 2400 },
    },
    variationPercent: 12,
    extras: {
      projetoArquitetonico: { label: "Projeto arquitetônico e complementares", percent: 6 },
      terraplenagem: { label: "Terraplenagem e fundação especial", percent: 5 },
      areaExterna: { label: "Área externa / paisagismo", percent: 4 },
    },
    referenceNote: "Valores de referência por m², sem terreno. A proposta final depende de projeto, solo e especificações.",
  };

  const q = (id: number, d: number, data: Partial<Quote>): Quote => {
    const est = computeEstimate(simulator, {
      projectType: data.projectType ?? "residencial", standard: data.standard ?? null, areaM2: data.areaM2 ?? null,
    });
    return {
      id, protocol: `WC2609-DEMO${id}`, name: "", email: "", phone: "", city: "", projectType: "residencial",
      standard: null, areaM2: null, hasLand: null, hasProject: null, startWindow: null,
      estimateMin: est?.min ?? null, estimateMax: est?.max ?? null, message: "", status: "novo", notes: "",
      consentAt: daysAgo(d), createdAt: daysAgo(d), updatedAt: daysAgo(d), ...data,
    };
  };

  // Pedidos FICTÍCIOS apenas para ilustrar o painel na demonstração
  const quotes: Quote[] = [
    q(6, 0, { name: "Cliente Exemplo 6", email: "cliente6@exemplo.com", phone: "31900000006", city: "Contagem – MG", projectType: "residencial", standard: "medio", areaM2: 180, hasLand: true, hasProject: false, startWindow: "3_meses", message: "Tenho um lote de 360 m² e quero construir uma casa térrea com 3 quartos." }),
    q(5, 1, { name: "Cliente Exemplo 5", email: "cliente5@exemplo.com", phone: "31900000005", city: "Betim – MG", projectType: "industrial", standard: "economico", areaM2: 1200, hasLand: true, hasProject: true, startWindow: "6_meses", status: "em_contato", notes: "Ligar na segunda para agendar visita técnica." }),
    q(4, 3, { name: "Cliente Exemplo 4", email: "cliente4@exemplo.com", phone: "31900000004", city: "Belo Horizonte – MG", projectType: "reforma", standard: "alto", areaM2: 140, hasLand: null, hasProject: false, startWindow: "imediato", status: "proposta", message: "Reforma completa de apartamento, incluindo cozinha e banheiros." }),
    q(3, 8, { name: "Cliente Exemplo 3", email: "cliente3@exemplo.com", phone: "31900000003", city: "Nova Lima – MG", projectType: "residencial", standard: "alto", areaM2: 390, hasLand: true, hasProject: true, startWindow: "3_meses", status: "fechado" }),
    q(2, 15, { name: "Cliente Exemplo 2", email: "cliente2@exemplo.com", phone: "31900000002", city: "Contagem – MG", projectType: "comercial", standard: "medio", areaM2: 450, hasLand: false, hasProject: false, startWindow: "sem_data", status: "descartado" }),
    q(1, 22, { name: "Cliente Exemplo 1", email: "cliente1@exemplo.com", phone: "31900000001", city: "Ibirité – MG", projectType: "residencial", standard: "economico", areaM2: 90, hasLand: true, hasProject: false, startWindow: "6_meses", status: "em_contato" }),
  ];

  return { projects, images: {}, quotes, simulator, loggedIn: false, audit: [], seq: 100 };
}

const s = () => (store ??= init());
const wait = (ms = 220) => new Promise((r) => setTimeout(r, ms));

const MockError = ApiError;

function withCover(p: Project): Project {
  const imgs = (s().images[p.id] ?? []).slice().sort((a, b) => a.position - b.position);
  const c = imgs[0];
  return { ...p, imageCount: imgs.length, cover: c ? { url: c.url, thumbUrl: c.thumbUrl, width: c.width, height: c.height, alt: c.alt || p.title } : null };
}

function log(action: string, entity: string | null = null, entityId: string | number | null = null) {
  s().audit.unshift({ id: ++s().seq, action, entity, entityId: entityId === null ? null : String(entityId), createdAt: new Date().toISOString(), adminName: "Demonstração" });
}

function slugify(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

function requireLogin() {
  if (!s().loggedIn) throw new MockError(401, "Sessão expirada. Entre novamente.");
}

export async function mockRequest<T>(method: string, fullPath: string, body?: unknown): Promise<T> {
  await wait();
  const [path, query = ""] = fullPath.split("?");
  const params = new URLSearchParams(query);
  const st = s();
  const b = (body ?? {}) as Record<string, unknown>;
  let m: RegExpMatchArray | null;

  {
    // ---------- Público ----------
    if (method === "GET" && path === "/projects") {
      let items = st.projects.filter((p) => p.published);
      const cat = params.get("category"); const status = params.get("status");
      if (cat) items = items.filter((p) => p.category === cat);
      if (status) items = items.filter((p) => p.status === status);
      if (params.get("featured")) items = items.filter((p) => p.featured);
      items.sort((a, b2) => Number(b2.featured) - Number(a.featured) || (b2.year ?? 0) - (a.year ?? 0));
      const limit = Number(params.get("limit") || 12); const page = Number(params.get("page") || 1);
      return { items: items.slice((page - 1) * limit, page * limit).map(withCover), total: items.length, page, limit } as T;
    }
    if (method === "GET" && (m = path.match(/^\/projects\/([a-z0-9-]+)$/))) {
      const p = st.projects.find((x) => x.slug === m![1] && x.published);
      if (!p) throw new MockError(404, "Obra não encontrada");
      return { ...withCover(p), images: (st.images[p.id] ?? []).slice().sort((a, b2) => a.position - b2.position) } as T;
    }
    if (method === "GET" && path === "/simulator") return structuredClone(st.simulator) as T;
    if (method === "POST" && path === "/quotes") {
      const id = ++st.seq;
      const est = computeEstimate(st.simulator, b as never);
      const now = new Date().toISOString();
      const protocol = `WC2610-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      st.quotes.unshift({
        id, protocol, name: String(b.name), email: String(b.email), phone: String(b.phone).replace(/\D/g, ""), city: String(b.city),
        projectType: b.projectType as Quote["projectType"], standard: (b.standard as Quote["standard"]) ?? null,
        areaM2: (b.areaM2 as number) ?? null, hasLand: (b.hasLand as boolean) ?? null, hasProject: (b.hasProject as boolean) ?? null,
        startWindow: (b.startWindow as Quote["startWindow"]) ?? null, estimateMin: est?.min ?? null, estimateMax: est?.max ?? null,
        message: String(b.message ?? ""), status: "novo", notes: "", consentAt: now, createdAt: now, updatedAt: now,
      });
      return { protocol } as T;
    }

    // ---------- Autenticação ----------
    if (method === "POST" && path === "/auth/login") {
      if (String(b.email).toLowerCase() !== DEMO_LOGIN.email || b.password !== DEMO_LOGIN.password) {
        throw new MockError(401, "E-mail ou senha incorretos.");
      }
      st.loggedIn = true; log("login.success", "admin", 1);
      return { admin: { id: 1, name: "Demonstração", email: DEMO_LOGIN.email }, csrfToken: "demo" } as T;
    }
    if (method === "GET" && path === "/auth/me") {
      if (!st.loggedIn) return { admin: null, csrfToken: null } as T;
      return { admin: { id: 1, name: "Demonstração", email: DEMO_LOGIN.email }, csrfToken: "demo" } as T;
    }
    if (method === "POST" && path === "/auth/logout") { st.loggedIn = false; return undefined as T; }
    if (method === "POST" && path === "/auth/password") {
      requireLogin();
      throw new MockError(400, "Na demonstração a senha não pode ser alterada.");
    }

    // ---------- Admin ----------
    if (path.startsWith("/admin")) requireLogin();

    if (method === "GET" && path === "/admin/stats") {
      const byStatus: Record<string, number> = {};
      st.quotes.forEach((q) => { byStatus[q.status] = (byStatus[q.status] ?? 0) + 1; });
      const perDay: Record<string, number> = {};
      st.quotes.forEach((q) => { const d = new Date(q.createdAt).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); perDay[d] = (perDay[d] ?? 0) + 1; });
      return {
        quotesByStatus: byStatus, quotesTotal: st.quotes.length,
        quotesPerDay: Object.entries(perDay).map(([day, n]) => ({ day, n })).sort((a, b2) => a.day.localeCompare(b2.day)),
        projects: { published: st.projects.filter((p) => p.published).length, total: st.projects.length },
        recentQuotes: st.quotes.slice(0, 6),
      } as T;
    }
    if (method === "GET" && (path === "/admin/quotes" || path === "/admin/quotes/export.csv")) {
      let items = st.quotes.slice();
      const status = params.get("status"); const q = (params.get("q") || "").toLowerCase();
      if (status) items = items.filter((x) => x.status === status);
      if (q) items = items.filter((x) => [x.name, x.email, x.city, x.protocol, x.phone].some((v) => v.toLowerCase().includes(q)));
      if (path.endsWith(".csv")) {
        const cell = (v: unknown) => { let t = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; return /[";\n,]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
        const rows = [["Protocolo", "Data", "Nome", "E-mail", "Telefone", "Cidade", "Tipo", "Status"], ...items.map((x) => [x.protocol, x.createdAt, x.name, x.email, x.phone, x.city, x.projectType, x.status])];
        return new Blob(["﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n")], { type: "text/csv" }) as T;
      }
      const limit = Number(params.get("limit") || 20); const page = Number(params.get("page") || 1);
      return { items: items.slice((page - 1) * limit, page * limit), total: items.length, page, limit } as T;
    }
    if ((m = path.match(/^\/admin\/quotes\/(\d+)$/))) {
      const id = Number(m[1]);
      const idx = st.quotes.findIndex((x) => x.id === id);
      if (idx < 0) throw new MockError(404, "Orçamento não encontrado");
      if (method === "GET") return st.quotes[idx] as T;
      if (method === "PATCH") {
        st.quotes[idx] = { ...st.quotes[idx], ...(b.status ? { status: b.status as Quote["status"] } : {}), ...(b.notes !== undefined ? { notes: String(b.notes) } : {}), updatedAt: new Date().toISOString() };
        log("quote.update", "quote", id);
        return st.quotes[idx] as T;
      }
      if (method === "DELETE") { st.quotes.splice(idx, 1); log("quote.delete", "quote", id); return undefined as T; }
    }
    if (method === "GET" && path === "/admin/projects") {
      return { items: st.projects.map(withCover) } as T;
    }
    if (method === "POST" && path === "/admin/projects") {
      const id = ++st.seq;
      let slug = (b.slug as string) || slugify(String(b.title));
      if (st.projects.some((p) => p.slug === slug)) slug = `${slug}-${id}`;
      st.projects.unshift({ ...(b as unknown as Project), id, slug, cover: null });
      log("project.create", "project", id);
      return { id, slug } as T;
    }
    if ((m = path.match(/^\/admin\/projects\/(\d+)$/))) {
      const id = Number(m[1]);
      const idx = st.projects.findIndex((p) => p.id === id);
      if (idx < 0) throw new MockError(404, "Obra não encontrada");
      if (method === "GET") return { ...withCover(st.projects[idx]), images: (st.images[id] ?? []).slice().sort((a, b2) => a.position - b2.position) } as T;
      if (method === "PUT") {
        let slug = (b.slug as string) || slugify(String(b.title));
        if (st.projects.some((p) => p.slug === slug && p.id !== id)) slug = `${slug}-${id}`;
        st.projects[idx] = { ...st.projects[idx], ...(b as unknown as Project), id, slug };
        log("project.update", "project", id);
        return { id, slug } as T;
      }
      if (method === "DELETE") { st.projects.splice(idx, 1); delete st.images[id]; log("project.delete", "project", id); return undefined as T; }
    }
    if (method === "POST" && (m = path.match(/^\/admin\/projects\/(\d+)\/images$/))) {
      const id = Number(m[1]);
      const files = (body as FormData).getAll("images") as File[];
      const list = (st.images[id] ??= []);
      const created: ProjectImage[] = [];
      for (const f of files) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) throw new MockError(400, "Formato não permitido. Use JPG, PNG ou WebP.");
        const url = URL.createObjectURL(f);
        const dims = await new Promise<{ w: number; h: number }>((res) => {
          const img = new Image(); img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight }); img.onerror = () => res({ w: 1600, h: 1000 }); img.src = url;
        });
        const im: ProjectImage = { id: ++st.seq, url, thumbUrl: url, width: dims.w, height: dims.h, alt: "", position: list.length };
        list.push(im); created.push(im);
      }
      log("images.upload", "project", id);
      return { items: created } as T;
    }
    if ((m = path.match(/^\/admin\/images\/(\d+)$/))) {
      const id = Number(m[1]);
      for (const [pid, list] of Object.entries(st.images)) {
        const idx = list.findIndex((i) => i.id === id);
        if (idx < 0) continue;
        if (method === "PATCH") { list[idx] = { ...list[idx], ...(b as Partial<ProjectImage>) }; return list[idx] as T; }
        if (method === "DELETE") { list.splice(idx, 1); log("image.delete", "project", pid); return undefined as T; }
      }
      throw new MockError(404, "Imagem não encontrada");
    }
    if (path === "/admin/simulator") {
      if (method === "GET") return structuredClone(st.simulator) as T;
      if (method === "PUT") { st.simulator = structuredClone(b as unknown as SimulatorSettings); log("simulator.update", "settings", "simulator"); return st.simulator as T; }
    }
    if (method === "GET" && path === "/admin/audit") return { items: st.audit.slice(0, 100) } as T;

    throw new MockError(404, "Rota não encontrada");
  }
}
