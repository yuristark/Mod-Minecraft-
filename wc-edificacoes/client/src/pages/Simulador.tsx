import { useMemo, useState, type CSSProperties } from "react";
import { motion } from "motion/react";
import { ArrowRight, Info, Move3d } from "lucide-react";
import { SectionLabel } from "@/components/Brand";
import { Link } from "@/components/Link";
import { CATEGORY_LABEL, STANDARD_LABEL } from "@/config/site";
import { useAsync } from "@/hooks/useAsync";
import { useSeo } from "@/hooks/useSeo";
import { api } from "@/lib/api";
import { brl, computeEstimate, num } from "@/lib/estimate";
import type { Category, Standard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AnimatedSwitcher, TweenNumber } from "@/motion/flutter";
import { curves, durations, springs } from "@/motion/tokens";
import { Reveal, SplitWords } from "@/motion/ui";
import { massing } from "@/three/massing";
import type { ModelProps } from "@/three/model";
import { ThreeCanvas } from "@/three/ThreeCanvas";

const loadModel = () => import("@/three/model");
const fmtBrl = (n: number) => brl(Math.round(n / 100) * 100);
const fmt1 = (n: number) => num(n, 1);

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

  const modelProps = useMemo<ModelProps>(() => ({ category: type, standard, area: safeArea || 20 }), [type, standard, safeArea]);
  const vol = massing(type, standard, safeArea || 20);

  const toggleExtra = (k: string) => setExtras((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  const quoteLink = `/orcamento?${new URLSearchParams({ tipo: type, padrao: standard, area: String(safeArea || ""), extras: extras.join(",") })}`;

  return (
    <>
      <section className="border-b border-line">
        <div className="container pb-12 pt-14 md:pt-20">
          <SectionLabel>Ferramenta</SectionLabel>
          <div className="mt-5 grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
            <h1 className="text-display-xl uppercase"><SplitWords text="Simulador de obra" /></h1>
            <Reveal delay={0.25}>
              <p className="max-w-md text-lg leading-relaxed text-ink-3">
                Escolha o tipo de obra, a área e o padrão de acabamento para ter uma faixa de investimento inicial — e veja a volumetria em uma maquete 3D.
              </p>
            </Reveal>
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
                className="range flex-1 text-ink [--range-fill:var(--signal-strong)]" aria-label="Ajustar área"
                style={{ ["--range-pct" as string]: `${((Math.min(safeArea, 2000) - 20) / 1980) * 100}%` } as CSSProperties} />
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
                  <label key={k} data-ripple className="relative overflow-hidden flex cursor-pointer items-center justify-between gap-4 border border-line bg-paper px-4 py-3.5 hover:border-ink has-[:checked]:border-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal-strong">
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
        <div className="lg:sticky lg:top-[calc(var(--header-offset)+24px)] lg:self-start lg:transition-[top] lg:duration-300">
          {/* Maquete 3D */}
          <div className="on-dark relative overflow-hidden border-b border-paper/10 bg-ink text-paper">
            <div aria-hidden="true" className="blueprint-grid-fine absolute inset-0 text-paper" />
            <ThreeCanvas
              load={loadModel}
              props={modelProps}
              className="h-[260px] md:h-[300px]"
              canvasClassName="cursor-grab touch-pan-y active:cursor-grabbing"
              label={`Maquete 3D ilustrativa: ${CATEGORY_LABEL[type]}, ${vol.floors} pavimento(s), cerca de ${num(Math.round(vol.width))} por ${num(Math.round(vol.depth))} metros`}
              placeholder={<span className="label-mono animate-pulse text-paper/40">Carregando maquete 3D…</span>}
              fallback={null}
            >
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-4 top-3 flex items-start justify-between font-mono text-[0.62rem] uppercase tracking-wider text-paper/55">
                <span className="text-signal">Maquete · volumetria</span>
                <span className="flex items-center gap-1.5"><Move3d className="h-3.5 w-3.5" />Arraste para girar</span>
              </div>
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-4 bottom-3 grid grid-cols-3 border-t border-paper/15 pt-2 font-mono text-[0.62rem] uppercase tracking-wider text-paper/55">
                <span>≈ <TweenNumber value={vol.width} format={fmt1} duration={durations.slow} /> × <TweenNumber value={vol.depth} format={fmt1} duration={durations.slow} /> m</span>
                <span className="text-center"><AnimatedSwitcher switchKey={vol.floors}>{vol.floors} {vol.floors === 1 ? "pavimento" : "pavimentos"}</AnimatedSwitcher></span>
                <span className="text-right">h ≈ <TweenNumber value={vol.height} format={fmt1} duration={durations.slow} /> m</span>
              </div>
            </ThreeCanvas>
          </div>
          <div className="on-dark bg-ink p-6 text-paper md:p-9" aria-live="polite">
            <p className="label-mono text-paper/60">Investimento estimado</p>
            {loading && <p className="mt-4 text-paper/60">Carregando valores de referência…</p>}
            {error && <p role="alert" className="mt-4 text-signal">{error}</p>}
            {settings && (
              <>
                <p className="mt-3 text-[clamp(2rem,4.4vw,3.25rem)] font-bold leading-none tabular stretch-wide">
                  {est ? <TweenNumber value={est.min} format={fmtBrl} /> : "—"}
                </p>
                <p className="mt-2 text-xl text-paper/70 tabular">até {est ? <TweenNumber value={est.max} format={fmtBrl} /> : "—"}</p>

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
                    <tr key={`${type}-${s.label}`} className="group" title={`${s.label}: ${s.pct}% ≈ ${brl((est.base * s.pct) / 100)}`}>
                      <th scope="row" className="py-1.5 pr-3 text-left font-normal text-ink-2">
                        {s.label}
                        <span aria-hidden="true" className="mt-1.5 block h-2 bg-concrete-2">
                          <motion.span
                            className="block h-full origin-left bg-signal-strong transition-colors duration-300 group-hover:bg-ink"
                            style={{ width: `${(s.pct / maxPct) * 100}%` }}
                            initial={{ scaleX: 0 }}
                            whileInView={{ scaleX: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: durations.slower, ease: curves.easeOutExpo, delay: stages.indexOf(s) * 0.06 }}
                          />
                        </span>
                      </th>
                      <td className="w-12 py-1.5 text-right align-bottom font-mono text-ink-3 tabular">{s.pct}%</td>
                      <td className="w-28 py-1.5 text-right align-bottom font-mono tabular"><TweenNumber value={(est.base * s.pct) / 100} format={fmtBrl} duration={durations.slow} /></td>
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
      <span className="relative block h-full overflow-hidden border border-line bg-paper p-4 transition-colors duration-300 hover:border-ink peer-checked:border-ink peer-checked:text-paper peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal-strong">
        {checked && <motion.span layoutId={`opt-${name}`} aria-hidden="true" className="absolute inset-0 bg-ink" transition={springs.snappy} />}
        <span className="relative block font-semibold">{title}</span>
        <span className="relative mt-1 block font-mono text-xs opacity-70">
          <AnimatedSwitcher switchKey={subtitle}>{subtitle}</AnimatedSwitcher>
        </span>
      </span>
    </label>
  );
}
