import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Info, MessageCircle, Mountain, Move3d, Ruler, Share2, Trees } from "lucide-react";
import { SectionLabel } from "@/components/Brand";
import { Link } from "@/components/Link";
import { CATEGORY_LABEL, STANDARD_LABEL, whatsappLink } from "@/config/site";
import { useAsync } from "@/hooks/useAsync";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useSeo } from "@/hooks/useSeo";
import { api } from "@/lib/api";
import { brl, computeEstimate, num } from "@/lib/estimate";
import type { Category, Standard } from "@/lib/types";
import { shareLink } from "@/lib/share";
import { cn } from "@/lib/utils";
import { AnimatedSwitcher, TweenNumber } from "@/motion/flutter";
import { curves, durations, springs } from "@/motion/tokens";
import { Reveal, SplitWords } from "@/motion/ui";
import { FEATURE_LABEL, featureOf, massing, type Feature } from "@/three/massing";
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
  // Estado inicial vem do link (simulação compartilhada) — cada valor é validado contra listas fixas
  const [params, setParams] = useSearchParams();
  const [type, setType] = useState<Category>(() => { const v = params.get("tipo"); return v && v in CATEGORY_LABEL ? (v as Category) : "residencial"; });
  const [standard, setStandard] = useState<Standard>(() => { const v = params.get("padrao"); return v && v in STANDARD_LABEL ? (v as Standard) : "medio"; });
  const [area, setArea] = useState<number>(() => { const n = Number(params.get("area")); return Number.isFinite(n) && n >= 10 && n <= 100000 ? Math.round(n) : 180; });
  const [extras, setExtras] = useState<string[]>(() => (params.get("extras") || "").split(",").filter((e) => /^[a-zA-Z]{2,40}$/.test(e)).slice(0, 10));

  // Mantém o link sempre atualizado (debounce: o controle deslizante muda muitas vezes por segundo)
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = new URLSearchParams({ tipo: type, padrao: standard, area: String(Number.isFinite(area) ? Math.round(area) : "") });
      if (extras.length) next.set("extras", extras.join(","));
      if (next.toString() !== params.toString()) setParams(next, { replace: true, preventScrollReset: true });
    }, 400);
    return () => window.clearTimeout(t);
  }, [type, standard, area, extras, params, setParams]);

  const safeArea = Number.isFinite(area) ? Math.min(Math.max(area, 0), 100000) : 0;
  const est = computeEstimate(settings, { projectType: type, standard, areaM2: safeArea || null, extras });
  const extrasPct = extras.reduce((a, k) => a + (settings?.extras[k]?.percent ?? 0), 0);
  const stages = useMemo(() => STAGES[type], [type]);
  const maxPct = Math.max(...stages.map((s) => s.pct));

  // Adicionais marcados → efeitos visuais na maquete (jardim, terreno, cotas de projeto)
  const features = useMemo(() => {
    const set = new Set<Feature>();
    for (const k of extras) { const f = featureOf(k, settings?.extras[k]?.label); if (f) set.add(f); }
    return [...set];
  }, [extras, settings]);
  const featureKey = features.join(",");
  const modelProps = useMemo<ModelProps>(
    () => ({ category: type, standard, area: safeArea || 20, features: featureKey ? (featureKey.split(",") as Feature[]) : [] }),
    [type, standard, safeArea, featureKey],
  );
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const vol = massing(type, standard, safeArea || 20);

  const toggleExtra = (k: string) => setExtras((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  const quoteLink = `/orcamento?${new URLSearchParams({ tipo: type, padrao: standard, area: String(safeArea || ""), extras: extras.join(",") })}`;

  const maquete = (
                    <div className="on-dark relative overflow-hidden border-b border-paper/10 bg-ink text-paper">
            <div aria-hidden="true" className="studio-bg absolute inset-0" />
            <ThreeCanvas
              load={loadModel}
              props={modelProps}
              className={isDesktop ? "h-[340px]" : "h-[230px] sm:h-[280px]"}
              canvasClassName="cursor-grab touch-pan-y active:cursor-grabbing"
              label={`Maquete 3D ilustrativa: ${CATEGORY_LABEL[type]}, ${vol.floors} pavimento(s), cerca de ${num(Math.round(vol.width))} por ${num(Math.round(vol.depth))} metros`}
              placeholder={<span className="label-mono animate-pulse text-paper/40">Carregando maquete 3D…</span>}
              fallback={null}
            >
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-4 top-3 flex items-start justify-between font-mono text-[0.62rem] uppercase tracking-wider text-paper/55">
                <span className="flex flex-col gap-1.5">
                  <span className="text-signal">Maquete · {CATEGORY_LABEL[type]} · {STANDARD_LABEL[standard]}</span>
                  <span className="flex flex-wrap gap-1">
                    <AnimatePresence initial={false}>
                      {features.map((f) => (
                        <motion.span key={f} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={springs.bouncy}
                          className="border border-signal/50 bg-signal/15 px-1.5 py-0.5 text-paper">+ {FEATURE_LABEL[f]}</motion.span>
                      ))}
                    </AnimatePresence>
                  </span>
                </span>
                <span className="flex items-center gap-1.5"><Move3d className="h-3.5 w-3.5" />Arraste para girar</span>
              </div>
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-4 bottom-3 grid grid-cols-3 border-t border-paper/15 pt-2 font-mono text-[0.62rem] uppercase tracking-wider text-paper/55">
                <span>≈ <TweenNumber value={vol.width} format={fmt1} duration={durations.slow} /> × <TweenNumber value={vol.depth} format={fmt1} duration={durations.slow} /> m</span>
                <span className="text-center"><AnimatedSwitcher switchKey={vol.floors}>{vol.floors} {vol.floors === 1 ? "pavimento" : "pavimentos"}</AnimatedSwitcher></span>
                <span className="text-right">h ≈ <TweenNumber value={vol.height} format={fmt1} duration={durations.slow} /> m</span>
              </div>
            </ThreeCanvas>
          </div>
  );

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

      <section className="container grid gap-10 pb-28 pt-6 md:pt-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:py-16">
        {/* Celular: maquete fixa no topo enquanto se escolhem as opções — cada toque aparece na hora */}
        {!isDesktop && (
          <div className="sticky top-[var(--header-offset)] z-20 -mx-4 shadow-[0_14px_30px_-18px_rgb(0_0_0/0.6)] transition-[top] duration-300 sm:-mx-6">
            {maquete}
          </div>
        )}
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
                {Object.entries(settings.extras).map(([k, e]) => {
                  const on = extras.includes(k);
                  const f = featureOf(k, e.label);
                  const Icon = f === "landscape" ? Trees : f === "earthwork" ? Mountain : f === "design" ? Ruler : null;
                  return (
                    <label key={k} data-ripple className={cn(
                      "relative flex cursor-pointer items-center justify-between gap-4 overflow-hidden border px-4 py-3.5 transition-colors duration-300 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal-strong",
                      on ? "border-ink bg-ink text-paper" : "border-line bg-paper hover:border-ink",
                    )}>
                      <span className="flex items-center gap-3">
                        <input type="checkbox" checked={on} onChange={() => toggleExtra(k)} className="peer sr-only" />
                        <span aria-hidden="true" className={cn("grid h-5 w-5 shrink-0 place-items-center border transition-colors", on ? "border-signal bg-signal text-ink" : "border-ink-3")}>
                          <AnimatePresence initial={false}>
                            {on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={springs.bouncy}><Check className="h-3.5 w-3.5" strokeWidth={3} /></motion.span>}
                          </AnimatePresence>
                        </span>
                        <span className="font-medium">{e.label}</span>
                        {Icon && <Icon className={cn("h-4 w-4 shrink-0", on ? "text-signal" : "text-ink-3")} aria-hidden="true" />}
                      </span>
                      <span className={cn("font-mono text-sm", on ? "text-paper/70" : "text-ink-3")}>+{num(e.percent, 1)}%</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
        </form>

        {/* ----------------- Resultado ----------------- */}
        <div className="lg:sticky lg:top-[calc(var(--header-offset)+24px)] lg:self-start lg:transition-[top] lg:duration-300">
          {isDesktop && maquete}
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
                <button
                  type="button"
                  className="btn btn-ghost mt-3 w-full"
                  onClick={() => shareLink({
                    title: "Minha simulação de obra",
                    text: est ? `${CATEGORY_LABEL[type]}, ${num(safeArea)} m², padrão ${STANDARD_LABEL[standard].toLowerCase()}: de ${brl(est.min)} a ${brl(est.max)}` : undefined,
                  })}
                >
                  <Share2 className="h-4 w-4" aria-hidden="true" /> Compartilhar simulação
                </button>
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

      {/* Celular: barra fixa com o valor e o próximo passo */}
      {!isDesktop && est && (
        <div className="on-dark fixed inset-x-0 bottom-0 z-40 border-t border-paper/10 bg-ink/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 text-paper backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="label-mono text-[0.6rem] text-paper/55">Estimativa</p>
              <p className="truncate font-bold tabular stretch-wide">
                <TweenNumber value={est.min} format={fmtBrl} duration={durations.slow} /> <span className="text-paper/40">–</span> <TweenNumber value={est.max} format={fmtBrl} duration={durations.slow} />
              </p>
            </div>
            <a href={whatsappLink(`Olá! Fiz uma simulação no site: ${CATEGORY_LABEL[type]}, ${num(safeArea)} m², padrão ${STANDARD_LABEL[standard].toLowerCase()}. Gostaria de um orçamento.`)}
              target="_blank" rel="noopener noreferrer" aria-label="Falar no WhatsApp" className="grid h-11 w-11 shrink-0 place-items-center bg-[#25d366] text-[#0b3d1f]">
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </a>
            <Link to={quoteLink} className="btn btn-signal h-11 shrink-0 px-4">Orçar</Link>
          </div>
        </div>
      )}
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
