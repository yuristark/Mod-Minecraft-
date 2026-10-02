import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { SectionLabel } from "@/components/Brand";
import { ProjectArt } from "@/components/ProjectArt";
import { PROCESS, SERVICES } from "@/data/services";
import { useSeo } from "@/hooks/useSeo";

export default function Servicos() {
  useSeo("Serviços", "Construção residencial, obras comerciais, galpões industriais, reformas e retrofit.");
  return (
    <>
      <section className="border-b border-line">
        <div className="container pb-12 pt-14 md:pt-20">
          <SectionLabel>Serviços</SectionLabel>
          <div className="mt-5 grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
            <h1 className="text-display-xl uppercase">Uma construtora, quatro frentes</h1>
            <p className="max-w-md text-lg leading-relaxed text-ink-3">
              Cada tipo de obra tem suas normas, riscos e prazos. Organizamos equipes e processos para cada um deles.
            </p>
          </div>
          <nav aria-label="Atalhos dos serviços" className="mt-10 flex flex-wrap gap-2">
            {SERVICES.map((s, i) => (
              <Link key={s.id} to={{ hash: s.id }} replace className="border border-line bg-paper px-4 py-2 text-sm font-medium hover:border-ink">
                <span className="label-mono mr-2 text-ink-3">{String(i + 1).padStart(2, "0")}</span>{s.title}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      {SERVICES.map((s, i) => (
        <section key={s.id} id={s.id} className="border-b border-line" aria-labelledby={`${s.id}-t`}>
          <div className={`container grid gap-10 py-16 md:py-24 lg:grid-cols-2 lg:items-center lg:gap-16 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
            <div className="reveal border border-line bg-concrete-2">
              <ProjectArt seed={`servico-${s.id}`} category={s.id} status={i === 1 ? "em_andamento" : "concluida"} className="h-auto w-full" label={`Ilustração técnica — ${s.title}`} />
            </div>
            <div>
              <p className="label-mono flex items-center gap-3 text-signal-strong">
                <s.icon className="h-5 w-5" aria-hidden="true" strokeWidth={1.6} /> {String(i + 1).padStart(2, "0")}
              </p>
              <h2 id={`${s.id}-t`} className="mt-4 text-display-md uppercase">{s.title}</h2>
              <p className="mt-5 text-lg leading-relaxed text-ink-3">{s.lead}</p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {s.items.map((it) => (
                  <li key={it} className="flex gap-3 border-t border-line pt-3 text-[0.95rem]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal-strong" aria-hidden="true" />{it}
                  </li>
                ))}
              </ul>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link to={`/orcamento?tipo=${s.id}`} className="btn btn-ink h-auto min-h-12 whitespace-normal py-3 text-left">Orçar {s.title.toLowerCase()} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                <Link to={`/obras?tipo=${s.id}`} className="btn btn-ghost">Ver obras</Link>
              </div>
            </div>
          </div>
        </section>
      ))}

      <section className="section-pad">
        <div className="container">
          <SectionLabel>Método</SectionLabel>
          <h2 className="mt-5 text-display-lg uppercase">Em todas as obras</h2>
          <ol className="mt-12 grid gap-px border border-line bg-line md:grid-cols-5">
            {PROCESS.map((p, i) => (
              <li key={p.title} className="bg-concrete p-6">
                <span className="font-mono text-3xl font-medium text-signal-strong">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-4 font-bold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-3">{p.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
