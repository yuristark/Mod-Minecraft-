import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Info } from "lucide-react";
import { SectionLabel } from "@/components/Brand";
import { CATEGORY_LABEL, STANDARD_LABEL } from "@/config/site";
import { useAsync } from "@/hooks/useAsync";
import { useSeo } from "@/hooks/useSeo";
import { api } from "@/lib/api";
import { brl, computeEstimate, num } from "@/lib/estimate";
import type { Category, Standard } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Distribuição típica aproximada do custo de uma obra por etapa (referência genérica). */
const STAGES: Record<Category, { label: string; pct: number }[]> = {
  residencial: [
    { label: "Fundação e infraestrutura", pct: 10 }, { label: "Estrutura", pct: 20 }, { label: "Alvenaria e vedações", pct: 11 },
    { label: "Cobertura e impermeabilização", pct: 8 }, { label: "Instalações elétricas e hidráulicas", pct: 14 },
    { label: "Esquadrias e vidros", pct: 9 }, { label: "Revestimentos e acabamentos", pct: 22 }, { label: "Serviços gerais e limpeza", pct: 6 },
  ],
  comercial: [
    { label: "Fundação e infraestrutura", pct: 11 }, { label: "Estrutura", pct: 23 }, { label: "Alvenaria e vedações", pct: 9 },
    { label: "Cobertura e impermeabilização", pct: 6 }, { label: "Instalações e climatização", pct: 19 },
    { label: "Fachada e esquadrias", pct: 12 }, { label: "Revestimentos e acabamentos", pct: 15 }, { label: "Serviços gerais e limpeza", pct: 5 },
  ],
  industrial: [
    { label: "Terraplenagem e fundação", pct: 14 }, { label: "Estrutura pré-moldada / metálica", pct: 30 }, { label: "Piso industrial", pct: 16 },
    { label: "Cobertura e fechamentos", pct: 18 }, { label: "Instalações", pct: 12 }, { label: "Docas, portões e acabamentos", pct: 10 },
  ],
  reforma: [
    { label: "Demolição e retirada", pct: 8 }, { label: "Instalações elétricas e hidráulicas", pct: 22 }, { label: "Alvenaria e regularização", pct: 12 },
    { label: "Impermeabilização", pct: 8 }, { label: "Revestimentos e pisos", pct: 26 }, { label: "Pintura", pct: 10 },
    { label: "Esquadrias, louças e metais", pct: 14 },
  ],
};

export default function Simulador() {
  useSeo("Simulador de custo de obra", "Simule quanto custa construir ou reformar por m², por tipo de obra e padrão de acabamento.");
  const { data: settings, error, loading } = useAsync(() => api.simulator(), []);
  const [type, setType] = useState<Category>("residencial");
  const [standard, setStandard] = useState<Standard>("medio");
  const [area, setArea] = useState<number>(180);
  const [extras, setExtras] = useState<string[]>([]);

  const safeArea = Number.isFinite(area) ? Math.min(Math.max(area, 0), 100000) : 0;
  const est = computeEstimate(settings, { projectType: type, standard, areaM2: safeArea || null, extras });
  const extrasPct = extras.reduce((a, k) => a + (settings?.extras[k]?.percent ?? 0), 0);
  const stages = useMemo(() => STAGES[type], [type]);
  const maxPct = Math.max(...stages.map((s) => s.pct));

  const toggleExtra = (k: string) => setExtras((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  const quoteLink = `/orcamento?${new URLSearchParams({ tipo: type, padrao: standard, area: String(safeArea || ""), extras: extras.join(",") })}`;

  return (
    <>
      <section className="border-b border-line">
        <div className="container pb-12 pt-14 md:pt-20">
          <SectionLabel>Ferramenta</SectionLabel>
          <div className="mt-5 grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
            <h1 className="text-display-xl uppercase">Simulador de obra</h1>
            <p className="max-w-md text-lg leading-relaxed text-ink-3">
              Escolha o tipo de obra, a área e o padrão de acabamento para ter uma faixa de investimento inicial.
            </p>
          </div>
        </div>
      </section>

      <section className="container grid gap-10 py-12 md:py-16 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        {/* ----------------- Entradas ----------------- */}
        <form className="space-y-10" onSubmit={(e) => e.preventDefault()} aria-describedby="sim-nota">
          <fieldset>
            <legend className="text-lg font-bold"><span className="label-mono mr-3 text-signal-strong">A</span>Tipo de obra</legend>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                <OptionCard key={c} name="tipo" checked={type === c} onChange={() => setType(c)} title={CATEGORY_LABEL[c]}
                  subtitle={settings ? `a partir de ${brl(settings.pricePerM2[c].economico)}/m²` : " "} />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-lg font-bold"><span className="label-mono mr-3 text-signal-strong">B</span>Área a construir</legend>
            <div className="mt-4 flex items-stretch gap-3">
              <label htmlFor="sim-area" className="sr-only">Área em metros quadrados</label>
              <div className="relative w-40">
                <input id="sim-area" type="number" inputMode="numeric" min={10} max={100000} step={1} value={Number.isFinite(area) ? area : ""}
                  onChange={(e) => setArea(e.target.valueAsNumber)} className="field pr-12 font-mono text-lg tabular" required />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-ink-3">m²</span>
              </div>
              <input type="range" min={20} max={2000} step={10} value={Math.min(safeArea, 2000)} onChange={(e) => setArea(Number(e.target.value))}
                className="flex-1 accent-[#b9461a]" aria-label="Ajustar área" />
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-lg font-bold"><span className="label-mono mr-3 text-signal-strong">C</span>Padrão de acabamento</legend>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(Object.keys(STANDARD_LABEL) as Standard[]).map((s) => (
                <OptionCard key={s} name="padrao" checked={standard === s} onChange={() => setStandard(s)} title={STANDARD_LABEL[s]}
                  subtitle={settings ? `${brl(settings.pricePerM2[type][s])}/m²` : " "} />
              ))}
            </div>
          </fieldset>

          {settings && Object.keys(settings.extras).length > 0 && (
            <fieldset>
              <legend className="text-lg font-bold"><span className="label-mono mr-3 text-signal-strong">D</span>Itens adicionais</legend>
              <div className="mt-4 space-y-2">
                {Object.entries(settings.extras).map(([k, e]) => (
                  <label key={k} className="flex cursor-pointer items-center justify-between gap-4 border border-line bg-paper px-4 py-3.5 hover:border-ink has-[:checked]:border-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal-strong">
                    <span className="flex items-center gap-3">
                      <input type="checkbox" checked={extras.includes(k)} onChange={() => toggleExtra(k)} className="h-4 w-4 accent-[#17181a]" />
                      <span className="font-medium">{e.label}</span>
                    </span>
                    <span className="font-mono text-sm text-ink-3">+{num(e.percent, 1)}%</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </form>

        {/* ----------------- Resultado ----------------- */}
        <div className="lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:self-start">
          <div className="on-dark bg-ink p-6 text-paper md:p-9" aria-live="polite">
            <p className="label-mono text-paper/60">Investimento estimado</p>
            {loading && <p className="mt-4 text-paper/60">Carregando valores de referência…</p>}
            {error && <p role="alert" className="mt-4 text-signal">{error}</p>}
            {settings && (
              <>
                <p className="mt-3 text-[clamp(2rem,4.4vw,3.25rem)] font-bold leading-none tabular stretch-wide">
                  {est ? brl(est.min) : "—"}
                </p>
                <p className="mt-2 text-xl text-paper/70 tabular">até {est ? brl(est.max) : "—"}</p>

                <dl className="mt-8 grid grid-cols-2 gap-px bg-paper/10 font-mono text-sm sm:grid-cols-4">
                  <Cell k="Área" v={`${num(safeArea)} m²`} />
                  <Cell k="Base/m²" v={brl(settings.pricePerM2[type][standard])} />
                  <Cell k="Adicionais" v={`+${num(extrasPct, 1)}%`} />
                  <Cell k="Variação" v={`±${num(settings.variationPercent)}%`} />
                </dl>

                <Link to={quoteLink} className={cn("btn btn-signal mt-8 w-full", !est && "pointer-events-none opacity-60")} aria-disabled={!est}>
                  Quero um orçamento detalhado <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <p id="sim-nota" className="mt-5 flex gap-2 text-xs leading-relaxed text-paper/55">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {settings.referenceNote}
                </p>
              </>
            )}
          </div>

          {est && (
            <figure className="mt-6 border border-line bg-paper p-6">
              <figcaption>
                <p className="font-bold">Para onde vai o investimento</p>
                <p className="mt-1 text-xs text-ink-3">Distribuição típica aproximada ({CATEGORY_LABEL[type]}) — varia conforme o projeto.</p>
              </figcaption>
              <table className="mt-5 w-full text-sm">
                <caption className="sr-only">Distribuição estimada do custo por etapa</caption>
                <thead className="sr-only"><tr><th>Etapa</th><th>Percentual</th><th>Valor médio</th></tr></thead>
                <tbody>
                  {stages.map((s) => (
                    <tr key={s.label} className="group" title={`${s.label}: ${s.pct}% ≈ ${brl((est.base * s.pct) / 100)}`}>
                      <th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-2">
                        {s.label}
                        <span aria-hidden="true" className="mt-1.5 block h-2 bg-concrete-2">
                          <span className="block h-full bg-signal-strong transition-[width] duration-500 group-hover:bg-ink" style={{ width: `${(s.pct / maxPct) * 100}%` }} />
                        </span>
                      </th>
                      <td className="w-12 py-1.5 text-right align-bottom font-mono text-ink-3 tabular">{s.pct}%</td>
                      <td className="w-28 py-1.5 text-right align-bottom font-mono tabular">{brl((est.base * s.pct) / 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </figure>
          )}
        </div>
      </section>
    </>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="bg-ink p-3">
      <dt className="text-[0.65rem] uppercase tracking-wider text-paper/50">{k}</dt>
      <dd className="mt-1 text-paper tabular">{v}</dd>
    </div>
  );
}

function OptionCard({ name, checked, onChange, title, subtitle }: { name: string; checked: boolean; onChange: () => void; title: string; subtitle: string }) {
  return (
    <label className="relative cursor-pointer">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="peer sr-only" />
      <span className="block h-full border border-line bg-paper p-4 transition-colors hover:border-ink peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal-strong">
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block font-mono text-xs opacity-70">{subtitle}</span>
      </span>
    </label>
  );
}
