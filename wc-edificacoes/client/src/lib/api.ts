import type {
  Admin, AuditEntry, Category, Paged, Project, ProjectImage, ProjectInput, ProjectStatus, Quote, QuoteInput,
  QuoteStatus, SimulatorSettings, Stats,
} from "./types";
import { mockRequest } from "./mock";
import { ApiError } from "./apiError";

export { ApiError };

export const IS_DEMO = import.meta.env.VITE_DEMO === "1";

// O token CSRF fica só em memória (nunca em localStorage). O cookie de sessão é httpOnly.
let csrfToken: string | null = null;
export const setCsrfToken = (t: string | null) => { csrfToken = t; };

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
const unauthorizedListeners = new Set<() => void>();
export const onUnauthorized = (fn: () => void) => { unauthorizedListeners.add(fn); return () => unauthorizedListeners.delete(fn); };

async function request<T>(method: Method, path: string, body?: unknown, opts: { raw?: boolean } = {}): Promise<T> {
  if (IS_DEMO) return mockRequest<T>(method, path, body);

  const headers: Record<string, string> = { Accept: "application/json" };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  if (method !== "GET" && csrfToken) headers["X-CSRF-Token"] = csrfToken;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method, headers, body: payload,
      credentials: "same-origin",
      redirect: "error",
      signal: AbortSignal.timeout(body instanceof FormData ? 120_000 : 20_000),
    });
  } catch {
    throw new ApiError(0, "Sem conexão com o servidor. Verifique sua internet e tente novamente.");
  }

  if (res.status === 204) return undefined as T;
  if (opts.raw && res.ok) return (await res.blob()) as T;

  let data: unknown = null;
  const type = res.headers.get("content-type") || "";
  if (type.includes("application/json")) data = await res.json().catch(() => null);

  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; fields?: Record<string, string> };
    if (res.status === 401 && path.startsWith("/admin")) unauthorizedListeners.forEach((fn) => fn());
    throw new ApiError(res.status, d.error || "Não foi possível concluir a ação.", d.fields);
  }
  return data as T;
}

const seg = (v: string | number) => encodeURIComponent(String(v));
const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
};

// Resumos de obras já vistos em listagens: a página de detalhe abre instantaneamente
// com eles (título, capa) enquanto busca o restante — e a transição "Hero" encontra a capa.
const projectPeek = new Map<string, Project>();

export const api = {
  projects: {
    list: async (p: { category?: Category; status?: ProjectStatus; featured?: boolean; page?: number; limit?: number } = {}) => {
      const res = await request<Paged<Project>>("GET", `/projects${qs({ ...p, featured: p.featured ? 1 : undefined })}`);
      res.items.forEach((it) => { if (projectPeek.size < 300) projectPeek.set(it.slug, it); });
      return res;
    },
    get: (slug: string) => request<Project>("GET", `/projects/${seg(slug)}`),
    peek: (slug: string) => projectPeek.get(slug) ?? null,
  },
  simulator: () => request<SimulatorSettings>("GET", "/simulator"),
  createQuote: (q: QuoteInput) => request<{ protocol: string }>("POST", "/quotes", q),

  auth: {
    login: (email: string, password: string) => request<{ admin: Admin; csrfToken: string }>("POST", "/auth/login", { email, password }),
    me: () => request<{ admin: Admin | null; csrfToken: string | null }>("GET", "/auth/me"),
    logout: () => request<void>("POST", "/auth/logout"),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<void>("POST", "/auth/password", { currentPassword, newPassword }),
  },

  admin: {
    stats: () => request<Stats>("GET", "/admin/stats"),
    quotes: {
      list: (p: { status?: QuoteStatus; q?: string; page?: number; limit?: number }) =>
        request<Paged<Quote>>("GET", `/admin/quotes${qs(p)}`),
      get: (id: number) => request<Quote>("GET", `/admin/quotes/${seg(id)}`),
      update: (id: number, d: { status?: QuoteStatus; notes?: string }) => request<Quote>("PATCH", `/admin/quotes/${seg(id)}`, d),
      remove: (id: number) => request<void>("DELETE", `/admin/quotes/${seg(id)}`),
      exportCsv: (p: { status?: QuoteStatus; q?: string }) => request<Blob>("GET", `/admin/quotes/export.csv${qs(p)}`, undefined, { raw: true }),
    },
    projects: {
      list: () => request<{ items: Project[] }>("GET", "/admin/projects"),
      get: (id: number) => request<Project>("GET", `/admin/projects/${seg(id)}`),
      create: (d: ProjectInput) => request<{ id: number; slug: string }>("POST", "/admin/projects", d),
      update: (id: number, d: ProjectInput) => request<{ id: number; slug: string }>("PUT", `/admin/projects/${seg(id)}`, d),
      remove: (id: number) => request<void>("DELETE", `/admin/projects/${seg(id)}`),
      uploadImages: (id: number, files: File[]) => {
        const fd = new FormData();
        files.forEach((f) => fd.append("images", f));
        return request<{ items: ProjectImage[] }>("POST", `/admin/projects/${seg(id)}/images`, fd);
      },
    },
    images: {
      update: (id: number, d: { alt?: string; position?: number }) => request<ProjectImage>("PATCH", `/admin/images/${seg(id)}`, d),
      remove: (id: number) => request<void>("DELETE", `/admin/images/${seg(id)}`),
    },
    simulator: {
      get: () => request<SimulatorSettings>("GET", "/admin/simulator"),
      save: (d: SimulatorSettings) => request<SimulatorSettings>("PUT", "/admin/simulator", d),
    },
    audit: () => request<{ items: AuditEntry[] }>("GET", "/admin/audit"),
  },
};

export function errorMessage(err: unknown) {
  if (err instanceof ApiError) return err.message;
  return "Algo deu errado. Tente novamente.";
}
