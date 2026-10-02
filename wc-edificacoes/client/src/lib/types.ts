export type Category = "residencial" | "comercial" | "industrial" | "reforma";
export type ProjectStatus = "concluida" | "em_andamento" | "lancamento";
export type Standard = "economico" | "medio" | "alto";
export type QuoteStatus = "novo" | "em_contato" | "proposta" | "fechado" | "descartado";
export type StartWindow = "imediato" | "3_meses" | "6_meses" | "sem_data";

export interface ProjectImage {
  id: number;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  alt: string;
  position: number;
}

export interface Project {
  id: number;
  slug: string;
  title: string;
  category: Category;
  status: ProjectStatus;
  city: string;
  areaM2: number | null;
  year: number | null;
  durationMonths: number | null;
  summary: string;
  description: string;
  featured: boolean;
  published: boolean;
  cover: (Omit<ProjectImage, "id" | "position">) | null;
  imageCount?: number;
  images?: ProjectImage[];
  updatedAt?: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface SimulatorSettings {
  pricePerM2: Record<Category, Record<Standard, number>>;
  variationPercent: number;
  extras: Record<string, { label: string; percent: number }>;
  referenceNote: string;
}

export interface QuoteInput {
  name: string;
  email: string;
  phone: string;
  city: string;
  projectType: Category | "";
  standard: Standard | null;
  areaM2: number | null;
  hasLand: boolean | null;
  hasProject: boolean | null;
  startWindow: StartWindow | null;
  extras: string[];
  message: string;
  consent: boolean;
  website: string;
  startedAt: number;
  turnstileToken?: string;
}

export interface Quote {
  id: number;
  protocol: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  projectType: Category;
  standard: Standard | null;
  areaM2: number | null;
  hasLand: boolean | null;
  hasProject: boolean | null;
  startWindow: StartWindow | null;
  estimateMin: number | null;
  estimateMax: number | null;
  message: string;
  status: QuoteStatus;
  notes: string;
  consentAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Admin {
  id: number;
  name: string;
  email: string;
}

export interface Stats {
  quotesByStatus: Partial<Record<QuoteStatus, number>>;
  quotesTotal: number;
  quotesPerDay: { day: string; n: number }[];
  projects: { published: number; total: number };
  recentQuotes: Quote[];
}

export interface AuditEntry {
  id: number;
  action: string;
  entity: string | null;
  entityId: string | null;
  createdAt: string;
  adminName: string | null;
}

export type ProjectInput = Omit<Project, "id" | "cover" | "imageCount" | "images" | "updatedAt">;
