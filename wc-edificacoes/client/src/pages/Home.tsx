import { useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Calculator } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { SectionLabel } from "@/components/Brand";
import { Link } from "@/components/Link";
import { Faq } from "@/components/Faq";
import { ProjectArt } from "@/components/ProjectArt";
import { ProjectCard, ProjectCardSkeleton } from "@/components/ProjectCard";
import { CATEGORY_LABEL, STANDARD_LABEL, site } from "@/config/site";
import { COMMITMENTS, PROCESS, SERVICES } from "@/data/services";
import { useAsync } from "@/hooks/useAsync";
import { useSeo } from "@/hooks/useSeo";
import { api } from "@/lib/api";
import { brl, computeEstimate, num } from "@/lib/estimate";
import type { Category, Standard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StaggerItem, Staggered, TweenNumber } from "@/motion/flutter";
import { curves, durations, springs } from "@/motion/tokens";
import { Magnetic, Reveal, ScrollLine, SplitWords, useScrollSkew } from "@/motion/ui";
import { ThreeCanvas } from "@/three/ThreeCanvas";
import type { HeroOptions, HeroProps } from "@/three/hero";

const loadHero = () => import("@/three/hero");
const NO_PROPS: HeroProps = {};
const fmtInt = (n: number) => num(Math.round(n));

export default function Home() {
  useSeo(null, site.pitch);
  const projects = useAsync(() => api.projects.list({ limit: 24 }), []);
  const simulator = useAsync(() => api.simulator(), []);

  const items = projects.data?.items ?? [];
  const featured = useMemo(() => {
    const f = items.filter((p) => p.featured);
    return (f.length >= 3 ? f : [...f, ...items.filter((p) => !p.featured)]).slice(0, 3);
  }, [items]);
  const totalArea = items.reduce((acc, p) => acc + (p.areaM2 ?? 0), 0);
  const years = new Date().getFullYear() - site.foundedYear;

  return (
    <>
      <Hero
        stats={[
          { label: "Anos de atuação", value: years > 0 ? years : null },
          { label: "Obras no portfólio", value: projects.loading ? undefined : projects.data?.total ?? 0 },
          { label: "m² no portfólio", value: projects.loading ? undefined : totalArea },
        ]}
      />

      <Marquee />

      {/* ========================== SERVIÇOS ========================== */}
      <section className="section-pad" aria-labelledby="servicos-titulo">
        <div className="container">
          <div className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-end">
            <div>
              <Reveal><SectionLabel index="01">O que fazemos</SectionLabel></Reveal>
              <h2 id="servicos-titulo" className="mt-5 text-display-lg uppercase text-balance">
                <SplitWords text="Do alicerce ao acabamento." onView />
              </h2>
            </div>
            <Reveal delay={0.15}>
              <p className="max-w-xl text-lg leading-relaxed text-ink-3 md:justify-self-end">
                Uma única equipe responsável por projeto, aprovação, execução e entrega — com engenheiro acompanhando cada etapa.
              </p>
            </Reveal>
          </div>

          <Staggered as="ul" className="mt-14 grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s, i) => (
              <StaggerItem as="li" key={s.id} className="hover-fill group relative border-b border-r border-line bg-concrete p-6 md:p-8 [--fill:rgb(var(--c-ink))]">
                <div className="flex items-start justify-between">
                  <s.icon className="h-7 w-7 text-signal-strong transition-[color,transform] duration-500 [transition-timing-function:var(--ease-out-back)] group-hover:-rotate-6 group-hover:scale-110 group-hover:text-signal" aria-hidden="true" strokeWidth={1.6} />
                  <span className="label-mono text-ink-3 transition-colors duration-500 group-hover:text-paper/50">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-10 text-xl font-bold transition-colors duration-500 group-hover:text-paper">
                  <Link to={`/servicos#${s.id}`} className="after:absolute after:inset-0 after:content-['']">{s.title}</Link>
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-3 transition-colors duration-500 group-hover:text-paper/70">{s.lead}</p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-signal-strong transition-colors duration-500 group-hover:text-signal">
                  Saiba mais <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </StaggerItem>
            ))}
          </Staggered>
        </div>
      </section>

      {/* ======================= OBRAS EM DESTAQUE ======================= */}
      <section className="cv-auto section-pad border-t border-line bg-concrete-2/60" aria-labelledby="obras-titulo">
        <div className="container">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <Reveal><SectionLabel index="02">Portfólio</SectionLabel></Reveal>
              <h2 id="obras-titulo" className="mt-5 text-display-lg uppercase"><SplitWords text="Obras em destaque" onView /></h2>
            </div>
            <Reveal delay={0.1}>
              <Link to="/obras" className="btn btn-ghost self-start md:self-auto">Ver todas as obras <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </Reveal>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:grid-rows-2">
            {projects.loading && Array.from({ length: 3 }).map((_, i) => <div key={i} className={cn(i === 0 && "lg:row-span-2")}><ProjectCardSkeleton /></div>)}
            {projects.error && <p className="text-danger" role="alert">{projects.error}</p>}
            {!projects.loading && featured.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.12} className={cn("h-full", i === 0 && "lg:row-span-2")}>
                <ProjectCard project={p} size={i === 0 ? "lg" : "md"} />
              </Reveal>
            ))}
            {!projects.loading && !projects.error && featured.length === 0 && (
              <p className="text-ink-3">As obras serão publicadas em breve.</p>
            )}
          </div>
        </div>
      </section>

      {/* =========================== PROCESSO =========================== */}
      <section className="cv-auto section-pad" aria-labelledby="processo-titulo">
        <div className="container">
          <Reveal><SectionLabel index="03">Como trabalhamos</SectionLabel></Reveal>
          <h2 id="processo-titulo" className="mt-5 max-w-3xl text-display-lg uppercase text-balance">
            <SplitWords text="Cinco etapas." highlight="Nenhuma surpresa." highlightClassName="text-signal-strong" onView />
          </h2>

          <div className="relative mt-16">
            <span aria-hidden="true" className="absolute left-0 right-0 top-[11px] hidden h-px bg-line md:block" />
            <ScrollLine className="absolute left-0 right-0 top-[11px] hidden h-[2px] -translate-y-[0.5px] bg-signal-strong md:block" />
            <span aria-hidden="true" className="absolute bottom-0 left-[11px] top-0 w-px bg-line md:hidden" />
            <ScrollLine vertical className="absolute bottom-0 left-[10.5px] top-0 w-[2px] bg-signal-strong md:hidden" />
            <Staggered as="ol" gap={0.12} className="relative grid gap-10 md:grid-cols-5 md:gap-6">
              {PROCESS.map((step, i) => (
                <StaggerItem as="li" key={step.title} className="relative pl-10 md:pl-0">
                  <motion.span
                    aria-hidden="true"
                    className="absolute left-0 top-0 grid h-[23px] w-[23px] place-items-center border border-ink bg-concrete font-mono text-[0.65rem] md:relative"
                    initial={{ scale: 0.4, rotate: 45 }}
                    whileInView={{ scale: 1, rotate: 0, backgroundColor: "rgb(23 24 26)", color: "rgb(248 246 242)" }}
                    viewport={{ once: true, amount: 1, margin: "0px 0px -30% 0px" }}
                    transition={{ ...springs.bouncy, delay: i * 0.12 }}
                  >
                    {i + 1}
                  </motion.span>
                  <h3 className="text-lg font-bold leading-snug md:mt-6">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-3">{step.text}</p>
                </StaggerItem>
              ))}
            </Staggered>
          </div>
        </div>
      </section>

      {/* ======================== MINI SIMULADOR ======================== */}
      <section className="cv-auto on-dark grain relative overflow-hidden bg-ink-2 text-paper" aria-labelledby="sim-titulo">
        <div aria-hidden="true" className="blueprint-grid-fine blueprint-pan absolute inset-0 text-paper" />
        <div className="container relative grid gap-12 py-20 md:py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <Reveal><SectionLabel index="04" className="text-paper/70">Simulador</SectionLabel></Reveal>
            <h2 id="sim-titulo" className="mt-5 text-display-lg uppercase text-balance"><SplitWords text="Quanto custa construir?" onView /></h2>
            <Reveal delay={0.15}>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-paper/70">
                Tenha uma estimativa inicial em segundos. Depois, nossa equipe faz o orçamento detalhado para o seu projeto.
              </p>
              <Magnetic className="mt-8">
                <Link to="/simulador" className="btn btn-signal">Abrir simulador com maquete 3D <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              </Magnetic>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <MiniSimulator settings={simulator.data} />
          </Reveal>
        </div>
      </section>

      {/* ========================= COMPROMISSOS ========================= */}
      <section className="cv-auto section-pad" aria-labelledby="comp-titulo">
        <div className="container grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <Reveal><SectionLabel index="05">Compromissos</SectionLabel></Reveal>
            <h2 id="comp-titulo" className="mt-5 text-display-lg uppercase text-balance"><SplitWords text="Engenharia que dá para conferir." onView /></h2>
            <Reveal delay={0.2}>
              <Link to="/empresa" className="mt-8 inline-flex items-center gap-2 font-semibold text-signal-strong link-underline">Conheça a empresa <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </Reveal>
          </div>
          <Staggered as="dl" className="grid gap-px border border-line bg-line sm:grid-cols-2">
            {COMMITMENTS.map((c) => (
              <StaggerItem key={c.k} className="hover-fill group bg-concrete p-7">
                <dt className="label-mono text-signal-strong">{c.k}</dt>
                <dd className="mt-3 text-lg font-semibold leading-snug">{c.v}</dd>
              </StaggerItem>
            ))}
          </Staggered>
        </div>
      </section>

      <Faq index="06" />
    </>
  );
}

/* ================================================================== */
/* HERO                                                               */
/* ================================================================== */

function Hero({ stats }: { stats: { label: string; value: number | null | undefined }[] }) {
  const ref = useRef<HTMLElement>(null);
  const hudRef = useRef<HTMLSpanElement>(null);
  const floorsRef = useRef<HTMLSpanElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const textY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const options = useMemo<Omit<HeroOptions, "reducedMotion" | "onReady">>(() => ({
    scroll: scrollYProgress,
    onProgress: (p) => {
      if (hudRef.current) hudRef.current.textContent = `${Math.round(p * 100)}%`;
      if (floorsRef.current) floorsRef.current.textContent = String(Math.round(p * 14)).padStart(2, "0");
    },
  }), [scrollYProgress]);

  return (
    <section ref={ref} className="on-dark grain relative overflow-hidden bg-ink text-paper">
      <div aria-hidden="true" className="blueprint-grid blueprint-pan absolute inset-0 text-paper" />
      <div aria-hidden="true" className="glow pointer-events-none absolute -right-72 top-0 h-[900px] w-[900px]" />

      <div className="container relative grid min-h-[calc(100svh-var(--header-h))] content-center gap-10 pb-12 pt-12 lg:static lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:pb-24 lg:pt-16">
        <motion.div className="relative z-10" style={{ y: textY, opacity: textOpacity }}>
          <motion.p
            className="label-mono flex items-center gap-3 text-paper/60"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: durations.slower, ease: curves.easeOutExpo }}
          >
            <span className="pulse-ring inline-block h-2 w-2 rounded-full bg-signal text-signal" aria-hidden="true" />
            {site.tagline} · desde {site.foundedYear}
          </motion.p>
          <h1 className="mt-6 text-[clamp(2.4rem,5.3vw,5rem)] font-bold uppercase leading-[0.94] tracking-[-0.02em] text-balance">
            <SplitWords text="Construímos com método." highlight="Entregamos no prazo." highlightClassName="text-signal" delay={0.15} />
          </h1>
          <motion.p
            className="mt-7 max-w-xl text-lg leading-relaxed text-paper/75 text-pretty"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: durations.slower, ease: curves.easeOutExpo, delay: 0.65 }}
          >
            {site.pitch}
          </motion.p>
          <motion.div
            className="mt-9 flex flex-col gap-3 sm:flex-row"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: durations.slower, ease: curves.easeOutExpo, delay: 0.8 }}
          >
            <Magnetic><Link to="/orcamento" className="btn btn-signal w-full sm:w-auto">Pedir orçamento <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Magnetic>
            <Magnetic><Link to="/simulador" className="btn btn-ghost w-full sm:w-auto"><Calculator className="h-4 w-4" aria-hidden="true" />Simular custo da obra</Link></Magnetic>
          </motion.div>

          <motion.dl
            className="mt-14 grid max-w-xl grid-cols-3 border-t border-paper/15"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: durations.slower, delay: 0.95 }}
          >
            {stats.map((s) => (
              <div key={s.label} className="border-r border-paper/15 py-5 pr-4 last:border-r-0 [&:not(:first-child)]:pl-4">
                <dd className="text-2xl font-bold tabular stretch-wide sm:text-3xl md:text-4xl">
                  {s.value === undefined ? "…" : s.value === null ? "—" : <TweenNumber value={s.value} format={fmtInt} fromZero duration={1.8} />}
                </dd>
                <dt className="label-mono mt-2 text-[0.62rem] text-paper/55">{s.label}</dt>
              </div>
            ))}
          </motion.dl>
        </motion.div>

        {/* Cena 3D: no celular fica abaixo do texto; no desktop ocupa a metade direita do hero */}
        <div className="relative -mx-4 h-[380px] sm:-mx-6 sm:h-[460px] lg:absolute lg:inset-y-0 lg:right-0 lg:mx-0 lg:h-auto lg:w-[58%]">
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-[1] hidden w-1/3 bg-gradient-to-r from-ink to-transparent lg:block" />
          <ThreeCanvas
            load={loadHero}
            props={NO_PROPS}
            options={options}
            className="scanline h-full w-full overflow-hidden"
            label="Ilustração 3D animada de um edifício em construção, com grua içando vigas até o último pavimento"
            placeholder={<span className="label-mono animate-pulse text-paper/40">Carregando maquete 3D…</span>}
            fallback={
              <div className="grid h-full place-items-center p-6">
                <ProjectArt seed="wc-hero-prancha" category="comercial" status="em_andamento" tone="dark" animate className="h-auto w-full max-w-xl" label="Desenho técnico de um edifício comercial em construção, com grua" />
              </div>
            }
          >
            <HeroHud floorsRef={floorsRef} hudRef={hudRef} />
          </ThreeCanvas>
        </div>
      </div>

      <motion.a
        href="#servicos-titulo"
        aria-label="Rolar para o conteúdo"
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-paper/50 transition-colors hover:text-paper lg:flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
      >
        <span className="label-mono text-[0.6rem]">Role</span>
        <ArrowDown className="scroll-cue h-4 w-4" aria-hidden="true" />
      </motion.a>
    </section>
  );
}

function HeroHud({ floorsRef, hudRef }: { floorsRef: React.RefObject<HTMLSpanElement | null>; hudRef: React.RefObject<HTMLSpanElement | null> }) {
  const c = "absolute h-3 w-3 border-signal";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-4 z-[2] font-mono text-[0.62rem] uppercase tracking-wider text-paper/55 lg:inset-y-10 lg:left-[18%] lg:right-10">
      <span className={cn(c, "left-0 top-0 border-l-2 border-t-2")} />
      <span className={cn(c, "right-0 top-0 border-r-2 border-t-2")} />
      <span className={cn(c, "bottom-0 left-0 border-b-2 border-l-2")} />
      <span className={cn(c, "bottom-0 right-0 border-b-2 border-r-2")} />
      <div className="absolute left-5 top-4 space-y-1">
        <p className="text-signal">Prancha 01 · Modelo 3D</p>
        <p>Ed. comercial · 14 pav.</p>
      </div>
      <div className="absolute right-5 top-4 text-right">
        <p>Pavimentos</p>
        <p className="mt-1 text-xl font-medium text-paper tabular"><span ref={floorsRef}>00</span><span className="text-paper/40">/14</span></p>
      </div>
      <div className="absolute bottom-4 left-5 right-5 grid grid-cols-3 border-t border-paper/15 pt-3">
        <span>Elevação</span>
        <span className="text-center">Estrutura <span ref={hudRef} className="text-signal">0%</span></span>
        <span className="text-right">Esc. 1:200</span>
      </div>
    </div>
  );
}

/* ================================================================== */
/* MARQUEE (letreiro reage à velocidade da rolagem)                    */
/* ================================================================== */

function Marquee() {
  const skew = useScrollSkew(10);
  return (
    <div className="marquee-wrap overflow-hidden border-y border-ink bg-signal text-ink" aria-hidden="true">
      <motion.div style={{ skewX: skew }}>
        <div className="marquee-track flex w-max gap-10 py-3.5 text-sm font-bold uppercase stretch-wide">
          {Array.from({ length: 2 }).flatMap((_, j) =>
            ["Residencial", "Comercial", "Industrial", "Galpões", "Reformas", "Retrofit", "Fachadas", "Projetos"].map((t) => (
              <span key={`${j}-${t}`} className="flex items-center gap-10">{t}<span className="h-2 w-2 rotate-45 bg-ink" /></span>
            )),
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ================================================================== */
/* MINI SIMULADOR                                                      */
/* ================================================================== */

const fmtBrl = (n: number) => brl(Math.round(n / 100) * 100);

function MiniSimulator({ settings }: { settings: Parameters<typeof computeEstimate>[0] }) {
  const [type, setType] = useState<Category>("residencial");
  const [standard, setStandard] = useState<Standard>("medio");
  const [area, setArea] = useState(150);
  const est = computeEstimate(settings, { projectType: type, standard, areaM2: area });
  const pct = ((area - 30) / (1000 - 30)) * 100;

  return (
    <div className="conic-border bg-ink p-6 md:p-8">
      <fieldset>
        <legend className="label-mono text-paper/60">Tipo de obra</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
            <PillOption key={c} group="mini-type" checked={type === c} onChange={() => setType(c)} label={CATEGORY_LABEL[c].split(" ")[0]} tone="signal" />
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="label-mono text-paper/60">Padrão de acabamento</legend>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(Object.keys(STANDARD_LABEL) as Standard[]).map((s) => (
            <PillOption key={s} group="mini-std" checked={standard === s} onChange={() => setStandard(s)} label={STANDARD_LABEL[s]} tone="paper" />
          ))}
        </div>
      </fieldset>

      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <label htmlFor="mini-area" className="label-mono text-paper/60">Área construída</label>
          <output htmlFor="mini-area" className="font-mono text-lg tabular">{num(area)} m²</output>
        </div>
        <input
          id="mini-area"
          type="range"
          min={30}
          max={1000}
          step={10}
          value={area}
          onChange={(e) => setArea(Number(e.target.value))}
          className="range mt-2 w-full text-paper"
          style={{ ["--range-pct" as string]: `${pct}%` } as CSSProperties}
        />
      </div>

      <div className="mt-8 border-t border-paper/15 pt-6" aria-live="polite">
        <p className="label-mono text-paper/60">Estimativa inicial</p>
        <p className="mt-2 text-3xl font-bold tabular stretch-wide md:text-4xl">
          {est ? (
            <>
              <TweenNumber value={est.min} format={fmtBrl} duration={durations.slow} /> <span className="text-paper/40">–</span>{" "}
              <TweenNumber value={est.max} format={fmtBrl} duration={durations.slow} />
            </>
          ) : "—"}
        </p>
        <p className="mt-2 text-xs text-paper/50">Referência sem terreno. Não substitui o orçamento detalhado.</p>
      </div>
    </div>
  );
}

/** Opção de rádio com fundo que desliza entre as opções (layoutId). */
function PillOption({ group, checked, onChange, label, tone }: { group: string; checked: boolean; onChange: () => void; label: string; tone: "signal" | "paper" }) {
  return (
    <label className="relative cursor-pointer">
      <input type="radio" name={group} checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        className={cn(
          "relative block border border-paper/20 px-2 py-2.5 text-center text-sm transition-colors duration-300 hover:border-paper/50 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-signal",
          checked && "border-transparent text-ink",
        )}
      >
        {checked && (
          <motion.span
            layoutId={`${group}-pill`}
            aria-hidden="true"
            className={cn("absolute inset-0", tone === "signal" ? "bg-signal" : "bg-paper")}
            transition={springs.snappy}
          />
        )}
        <span className="relative">{label}</span>
      </span>
    </label>
  );
}
