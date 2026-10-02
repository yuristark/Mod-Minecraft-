import type { Category, SimulatorSettings, Standard } from "./types";

/** Mesmo cálculo do servidor (server/src/lib/estimate.js). O servidor recalcula ao receber o pedido. */
export function computeEstimate(
  settings: SimulatorSettings | null | undefined,
  input: { projectType: Category | ""; standard: Standard | null; areaM2: number | null; extras?: string[] },
) {
  if (!settings || !input.projectType || !input.standard || !input.areaM2) return null;
  const base = settings.pricePerM2?.[input.projectType]?.[input.standard];
  if (!Number.isFinite(base) || base <= 0) return null;
  let extraPct = 0;
  for (const key of new Set(input.extras ?? [])) {
    const e = settings.extras?.[key];
    if (e && Number.isFinite(e.percent)) extraPct += e.percent;
  }
  const total = base * input.areaM2 * (1 + extraPct / 100);
  const v = (settings.variationPercent ?? 10) / 100;
  const round = (n: number) => Math.round(n / 1000) * 1000;
  return { min: round(total * (1 - v)), max: round(total * (1 + v)), base: Math.round(total), perM2: base };
}

export const brl = (n: number, digits = 0) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: digits, minimumFractionDigits: digits });

export const num = (n: number, digits = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: digits });

export const formatPhone = (digits: string) => {
  const d = digits.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits;
};

export const formatDate = (iso: string, withTime = false) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "America/Sao_Paulo",
  });
