import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Calculator } from "lucide-react";
import { SectionLabel } from "@/components/Brand";
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
      {/* ============================ HERO ============================ */}
      <section className="on-dark relative overflow-hidden bg-ink text-paper">
        <div aria-hidden="true" className="absolute inset-0 blueprint-grid text-paper" />
        <div className="container relative grid gap-12 pb-16 pt-12 md:pb-24 md:pt-20 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:items-center lg:gap-12">
          <div>
            <p className="label-mono fade-up text-paper/60">
              <span className="text-signal">●</span>&nbsp; {site.tagline} · desde {site.foundedYear}
            </p>
            <h1 className="fade-up mt-6 text-display-xl uppercase text-balance" style={{ ["--d" as string]: "0.08s" }}>
              Construímos com método.{" "}
              <span className="text-signal">Entregamos no prazo.</span>
            </h1>
            <p className="fade-up mt-7 max-w-xl text-lg leading-relaxed text-paper/75 text-pretty" style={{ ["--d" as string]: "0.16s" }}>
              {site.pitch}
            </p>
            <div className="fade-up mt-9 flex flex-col gap-3 sm:flex-row" style={{ ["--d" as string]: "0.24s" }}>
              <Link to="/orcamento" className="btn btn-signal">Pedir orçamento <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              <Link to="/simulador" className="btn btn-ghost"><Calculator className="h-4 w-4" aria-hidden="true" />Simular custo da obra</Link>
            </div>

            <dl className="fade-up mt-14 grid max-w-xl grid-cols-3 border-t border-paper/15" style={{ ["--d" as string]: "0.32s" }}>
              <Stat label="Anos de atuação" value={years > 0 ? String(years) : "—"} />
              <Stat label="Obras no portfólio" value={projects.loading ? "…" : String(projects.data?.total ?? 0)} />
              <Stat label="m² no portfólio" value={projects.loading ? "…" : num(totalArea)} />
            </dl>
          </div>

          <figure className="relative fade-up" style={{ ["--d" as string]: "0.1s" }}>
            <div className="relative border border-paper/20 bg-ink-2/60 p-3 backdrop-blur-[1px]">
              <CornerMarks />
              <ProjectArt
                seed="wc-hero-prancha"
                category="comercial"
                status="em_andamento"
                tone="dark"
                animate
                className="h-auto w-full"
                label="Desenho técnico de um edifício comercial em construção, com grua"
              />
              <figcaption className="mt-3 grid grid-cols-3 border-t border-paper/15 pt-3 font-mono text-[0.65rem] uppercase tracking-wider text-paper/55">
                <span>Prancha 01</span>
                <span className="text-center">Elevação frontal</span>
                <span className="text-right">Esc. 1:200</span>
              </figcaption>
            </div>
          </figure>
        </div>
      </section>

      {/* Faixa de serviços */}
      <div className="overflow-hidden border-y border-ink bg-signal text-ink" aria-hidden="true">
        <div className="marquee-track flex w-max gap-10 py-3.5 font-bold uppercase stretch-wide text-sm">
          {Array.from({ length: 2 }).flatMap((_, j) =>
            ["Residencial", "Comercial", "Industrial", "Galpões", "Reformas", "Retrofit", "Fachadas", "Projetos"].map((t) => (
              <span key={`${j}-${t}`} className="flex items-center gap-10">{t}<span className="h-2 w-2 rotate-45 bg-ink" /></span>
            )),
          )}
        </div>
      </div>

      {/* ========================== SERVIÇOS ========================== */}
      <section className="section-pad" aria-labelledby="servicos-titulo">
        <div className="container">
          <div className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-end">
            <div>
              <SectionLabel index="01">O que fazemos</SectionLabel>
              <h2 id="servicos-titulo" className="mt-5 text-display-lg uppercase text-balance">Do alicerce ao acabamento.</h2>
            </div>
            <p className="max-w-xl text-lg leading-relaxed text-ink-3 md:justify-self-end">
              Uma única equipe responsável por projeto, aprovação, execução e entrega — com engenheiro acompanhando cada etapa.
            </p>
          </div>

          <ul className="mt-14 grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s, i) => (
              <li key={s.id} className="reveal group relative border-b border-r border-line bg-concrete p-6 transition-colors hover:bg-paper md:p-8">
                <div className="flex items-start justify-between">
                  <s.icon className="h-7 w-7 text-signal-strong" aria-hidden="true" strokeWidth={1.6} />
                  <span className="label-mono text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-10 text-xl font-bold">
                  <Link to={`/servicos#${s.id}`} className="after:absolute after:inset-0 after:content-['']">{s.title}</Link>
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-3">{s.lead}</p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-signal-strong">
                  Saiba mais <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ======================= OBRAS EM DESTAQUE ======================= */}
      <section className="section-pad border-t border-line bg-concrete-2/60" aria-labelledby="obras-titulo">
        <div className="container">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <SectionLabel index="02">Portfólio</SectionLabel>
              <h2 id="obras-titulo" className="mt-5 text-display-lg uppercase">Obras em destaque</h2>
            </div>
            <Link to="/obras" className="btn btn-ghost self-start md:self-auto">Ver todas as obras <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:grid-rows-2">
            {projects.loading && Array.from({ length: 3 }).map((_, i) => <div key={i} className={cn(i === 0 && "lg:row-span-2")}><ProjectCardSkeleton /></div>)}
            {projects.error && <p className="text-danger" role="alert">{projects.error}</p>}
            {!projects.loading && featured.map((p, i) => (
              <div key={p.id} className={cn(i === 0 && "lg:row-span-2")}>
                <ProjectCard project={p} size={i === 0 ? "lg" : "md"} />
              </div>
            ))}
            {!projects.loading && !projects.error && featured.length === 0 && (
              <p className="text-ink-3">As obras serão publicadas em breve.</p>
            )}
          </div>
        </div>
      </section>

      {/* =========================== PROCESSO =========================== */}
      <section className="section-pad" aria-labelledby="processo-titulo">
        <div className="container">
          <SectionLabel index="03">Como trabalhamos</SectionLabel>
          <h2 id="processo-titulo" className="mt-5 max-w-3xl text-display-lg uppercase text-balance">Cinco etapas. Nenhuma surpresa.</h2>

          <ol className="relative mt-16 grid gap-10 md:grid-cols-5 md:gap-6">
            <span aria-hidden="true" className="absolute left-0 right-0 top-[11px] hidden h-px bg-ink md:block reveal-x" />
            {PROCESS.map((step, i) => (
              <li key={step.title} className="reveal relative pl-10 md:pl-0">
                <span aria-hidden="true" className="absolute left-0 top-0 grid h-[23px] w-[23px] place-items-center border border-ink bg-concrete font-mono text-[0.65rem] md:relative">
                  {i + 1}
                </span>
                <h3 className="text-lg font-bold leading-snug md:mt-6">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-3">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ======================== MINI SIMULADOR ======================== */}
      <section className="on-dark relative overflow-hidden bg-ink-2 text-paper" aria-labelledby="sim-titulo">
        <div aria-hidden="true" className="absolute inset-0 blueprint-grid-fine text-paper" />
        <div className="container relative grid gap-12 py-20 md:py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionLabel index="04" className="text-paper/70">Simulador</SectionLabel>
            <h2 id="sim-titulo" className="mt-5 text-display-lg uppercase text-balance">Quanto custa construir?</h2>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-paper/70">
              Tenha uma estimativa inicial em segundos. Depois, nossa equipe faz o orçamento detalhado para o seu projeto.
            </p>
            <Link to="/simulador" className="btn btn-signal mt-8">Abrir simulador completo <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
          <MiniSimulator settings={simulator.data} />
        </div>
      </section>

      {/* ========================= COMPROMISSOS ========================= */}
      <section className="section-pad" aria-labelledby="comp-titulo">
        <div className="container grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <SectionLabel index="05">Compromissos</SectionLabel>
            <h2 id="comp-titulo" className="mt-5 text-display-lg uppercase text-balance">Engenharia que dá para conferir.</h2>
            <Link to="/empresa" className="mt-8 inline-flex items-center gap-2 font-semibold text-signal-strong link-underline">Conheça a empresa <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
          <dl className="grid gap-px border border-line bg-line sm:grid-cols-2">
            {COMMITMENTS.map((c) => (
              <div key={c.k} className="reveal bg-concrete p-7">
                <dt className="label-mono text-signal-strong">{c.k}</dt>
                <dd className="mt-3 text-lg font-semibold leading-snug">{c.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-paper/15 py-5 pr-4 last:border-r-0 [&:not(:first-child)]:pl-4">
      <dd className="text-3xl font-bold tabular stretch-wide md:text-4xl">{value}</dd>
      <dt className="label-mono mt-2 text-[0.62rem] text-paper/55">{label}</dt>
    </div>
  );
}

function CornerMarks() {
  const c = "absolute h-3 w-3 border-signal";
  return (
    <>
      <span aria-hidden="true" className={cn(c, "-left-px -top-px border-l-2 border-t-2")} />
      <span aria-hidden="true" className={cn(c, "-right-px -top-px border-r-2 border-t-2")} />
      <span aria-hidden="true" className={cn(c, "-bottom-px -left-px border-b-2 border-l-2")} />
      <span aria-hidden="true" className={cn(c, "-bottom-px -right-px border-b-2 border-r-2")} />
    </>
  );
}

function MiniSimulator({ settings }: { settings: Parameters<typeof computeEstimate>[0] }) {
  const [type, setType] = useState<Category>("residencial");
  const [standard, setStandard] = useState<Standard>("medio");
  const [area, setArea] = useState(150);
  const est = computeEstimate(settings, { projectType: type, standard, areaM2: area });

  return (
    <div className="border border-paper/15 bg-ink p-6 md:p-8">
      <fieldset>
        <legend className="label-mono text-paper/60">Tipo de obra</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
            <label key={c} className="cursor-pointer">
              <input type="radio" name="mini-type" value={c} checked={type === c} onChange={() => setType(c)} className="peer sr-only" />
              <span className="block border border-paper/20 px-2 py-2.5 text-center text-sm peer-checked:border-signal peer-checked:bg-signal peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-signal">
                {CATEGORY_LABEL[c].split(" ")[0]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="label-mono text-paper/60">Padrão de acabamento</legend>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(Object.keys(STANDARD_LABEL) as Standard[]).map((s) => (
            <label key={s} className="cursor-pointer">
              <input type="radio" name="mini-std" value={s} checked={standard === s} onChange={() => setStandard(s)} className="peer sr-only" />
              <span className="block border border-paper/20 px-2 py-2.5 text-center text-sm peer-checked:border-paper peer-checked:bg-paper peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-signal">
                {STANDARD_LABEL[s]}
              </span>
            </label>
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
          className="mt-3 w-full accent-[#e8642c]"
        />
      </div>

      <div className="mt-8 border-t border-paper/15 pt-6" aria-live="polite">
        <p className="label-mono text-paper/60">Estimativa inicial</p>
        <p className="mt-2 text-3xl font-bold tabular stretch-wide md:text-4xl">
          {est ? <>{brl(est.min)} <span className="text-paper/40">–</span> {brl(est.max)}</> : "—"}
        </p>
        <p className="mt-2 text-xs text-paper/50">Referência sem terreno. Não substitui o orçamento detalhado.</p>
      </div>
    </div>
  );
}
