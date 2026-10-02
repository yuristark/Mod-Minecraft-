/**
 * Calcula a faixa estimada no servidor — o valor enviado pelo navegador
 * nunca é confiável (poderia ser adulterado).
 */
export function computeEstimate(settings, { projectType, standard, areaM2, extras = [] }) {
  if (!settings || !projectType || !standard || !areaM2) return null;
  const base = settings.pricePerM2?.[projectType]?.[standard];
  if (!Number.isFinite(base) || base <= 0) return null;
  let extraPct = 0;
  for (const key of new Set(extras)) {
    const e = settings.extras?.[key];
    if (e && Number.isFinite(e.percent)) extraPct += e.percent;
  }
  const total = base * areaM2 * (1 + extraPct / 100);
  const v = (settings.variationPercent ?? 10) / 100;
  const round = (n) => Math.round(n / 1000) * 1000;
  return { min: round(total * (1 - v)), max: round(total * (1 + v)), base: Math.round(total) };
}
