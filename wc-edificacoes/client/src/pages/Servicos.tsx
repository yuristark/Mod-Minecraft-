import { ArrowRight, Check } from "lucide-react";
import { SectionLabel } from "@/components/Brand";
import { Link } from "@/components/Link";
import { ProjectArt } from "@/components/ProjectArt";
import { PROCESS, SERVICES } from "@/data/services";
import { useSeo } from "@/hooks/useSeo";
import { StaggerItem, Staggered } from "@/motion/flutter";
import { Magnetic, Parallax, Reveal, SplitWords } from "@/motion/ui";

export default function Servicos() {
  useSeo("Serviços", "Construção residencial, obras comerciais, galpões industriais, reformas e retrofit.");
  return (
    <>
      <section className="border-b border-line">
        <div className="container pb-12 pt-14 md:pt-20">
          <SectionLabel>Serviços</SectionLabel>
          <div className="mt-5 grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
            <h1 className="text-display-xl uppercase"><SplitWords text="Uma construtora," highlight="quatro frentes" highlightClassName="text-signal-strong" /></h1>
            <Reveal delay={0.3}>
              <p className="max-w-md text-lg leading-relaxed text-ink-3">
                Cada tipo de obra tem suas normas, riscos e prazos. Organizamos equipes e processos para cada um deles.
              </p>
            </Reveal>
          </div>
          <nav aria-label="Atalhos dos serviços">
            <Staggered className="mt-10 flex flex-wrap gap-2" delay={0.4} gap={0.06}>
              {SERVICES.map((s, i) => (
                <StaggerItem key={s.id}>
                  <Link to={{ hash: s.id }} replace viewTransition={false} className="hover-fill group block border border-line bg-paper px-4 py-2 text-sm font-medium transition-colors duration-300 hover:border-ink hover:text-paper [--fill:rgb(var(--c-ink))]">
                    <span className="label-mono mr-2 text-ink-3 transition-colors group-hover:text-signal">{String(i + 1).padStart(2, "0")}</span>{s.title}
                  </Link>
                </StaggerItem>
              ))}
            </Staggered>
          </nav>
        </div>
      </section>

      {SERVICES.map((s, i) => (
        <section key={s.id} id={s.id} className="border-b border-line" aria-labelledby={`${s.id}-t`}>
          <div className={`container grid gap-10 py-16 md:py-24 lg:grid-cols-2 lg:items-center lg:gap-16 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
            <Reveal className="overflow-hidden border border-line bg-concrete-2">
              <Parallax distance={24}>
                <ProjectArt seed={`servico-${s.id}`} category={s.id} status={i === 1 ? "em_andamento" : "concluida"} animate className="h-auto w-full scale-[1.08]" label={`Ilustração técnica — ${s.title}`} />
              </Parallax>
            </Reveal>
            <div>
              <p className="label-mono flex items-center gap-3 text-signal-strong">
                <s.icon className="h-5 w-5" aria-hidden="true" strokeWidth={1.6} /> {String(i + 1).padStart(2, "0")}
              </p>
              <h2 id={`${s.id}-t`} className="mt-4 text-display-md uppercase"><SplitWords text={s.title} onView /></h2>
              <Reveal delay={0.1}><p className="mt-5 text-lg leading-relaxed text-ink-3">{s.lead}</p></Reveal>
              <Staggered as="ul" className="mt-8 grid gap-3 sm:grid-cols-2" gap={0.06}>
                {s.items.map((it) => (
                  <StaggerItem as="li" key={it} className="group flex gap-3 border-t border-line pt-3 text-[0.95rem]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal-strong transition-transform duration-300 group-hover:scale-125" aria-hidden="true" />{it}
                  </StaggerItem>
                ))}
              </Staggered>
              <Reveal delay={0.2} className="mt-9 flex flex-wrap gap-3">
                <Magnetic><Link to={`/orcamento?tipo=${s.id}`} className="btn btn-ink h-auto min-h-12 whitespace-normal py-3 text-left">Orçar {s.title.toLowerCase()} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Magnetic>
                <Magnetic><Link to={`/obras?tipo=${s.id}`} className="btn btn-ghost">Ver obras</Link></Magnetic>
              </Reveal>
            </div>
          </div>
        </section>
      ))}

      <section className="section-pad">
        <div className="container">
          <SectionLabel>Método</SectionLabel>
          <h2 className="mt-5 text-display-lg uppercase"><SplitWords text="Em todas as obras" onView /></h2>
          <Staggered as="ol" className="mt-12 grid gap-px border border-line bg-line md:grid-cols-5">
            {PROCESS.map((p, i) => (
              <StaggerItem as="li" key={p.title} className="hover-fill group bg-concrete p-6 [--fill:rgb(var(--c-ink))]">
                <span className="font-mono text-3xl font-medium text-signal-strong transition-colors duration-500 group-hover:text-signal">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-4 font-bold transition-colors duration-500 group-hover:text-paper">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-3 transition-colors duration-500 group-hover:text-paper/70">{p.text}</p>
              </StaggerItem>
            ))}
          </Staggered>
        </div>
      </section>
    </>
  );
}
