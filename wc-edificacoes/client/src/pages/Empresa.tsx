import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SectionLabel } from "@/components/Brand";
import { ProjectArt } from "@/components/ProjectArt";
import { site } from "@/config/site";
import { COMMITMENTS } from "@/data/services";
import { useSeo } from "@/hooks/useSeo";

const VALUES = [
  { t: "Transparência", d: "Orçamento aberto por etapa, medições combinadas e relatórios com fotos. Você sabe onde está cada real investido." },
  { t: "Responsabilidade técnica", d: "Engenheiro responsável em todas as obras, com ART registrada e decisões baseadas em projeto e norma." },
  { t: "Compromisso com prazo", d: "Planejamento antes de começar e cronograma físico-financeiro acompanhado a cada medição." },
  { t: "Canteiro seguro e limpo", d: "Equipe treinada, uso de EPI, organização diária e respeito aos vizinhos da obra." },
];

export default function Empresa() {
  useSeo("A empresa", `Conheça a ${site.name}: construtora e edificadora que atende ${site.serviceArea}.`);
  const years = new Date().getFullYear() - site.foundedYear;
  return (
    <>
      <section className="on-dark relative overflow-hidden bg-ink text-paper">
        <div aria-hidden="true" className="absolute inset-0 blueprint-grid" />
        <div className="container relative grid gap-12 py-16 md:py-24 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <SectionLabel className="text-paper/60">A empresa</SectionLabel>
            <h1 className="mt-6 text-display-xl uppercase text-balance">Gente de obra, com cabeça de engenharia.</h1>
          </div>
          <p className="text-lg leading-relaxed text-paper/75">
            A {site.name} nasceu em {site.foundedYear} com uma ideia simples: obra boa é obra planejada. Há {years > 0 ? years : "—"} anos
            construímos e reformamos imóveis residenciais, comerciais e industriais em {site.serviceArea}.
          </p>
        </div>
      </section>

      <section className="section-pad">
        <div className="container grid gap-14 lg:grid-cols-2 lg:items-center">
          <div className="space-y-5 text-lg leading-relaxed text-ink-2">
            <SectionLabel index="01">Nossa forma de trabalhar</SectionLabel>
            <h2 className="text-display-md uppercase text-ink">Planejar antes, para não improvisar depois.</h2>
            <p>
              Toda obra começa no papel: levantamento do terreno, compatibilização de projetos e um orçamento detalhado por etapa.
              Só então assinamos contrato com prazo e cronograma definidos.
            </p>
            <p>
              Durante a execução, o cliente acompanha tudo por relatórios periódicos com fotos e medições. Ao final,
              entregamos o imóvel com vistoria conjunta, manual do proprietário e atendimento de garantia.
            </p>
          </div>
          <div className="reveal border border-line bg-concrete-2 p-3">
            <ProjectArt seed="empresa-sede" category="residencial" status="concluida" className="h-auto w-full" label="Ilustração técnica de uma residência" />
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-concrete-2/60 section-pad">
        <div className="container">
          <SectionLabel index="02">Valores</SectionLabel>
          <ul className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v, i) => (
              <li key={v.t} className="reveal bg-concrete p-7">
                <span className="font-mono text-sm text-signal-strong">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-6 text-xl font-bold">{v.t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-3">{v.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-pad">
        <div className="container grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <SectionLabel index="03">Dados da empresa</SectionLabel>
            <h2 className="mt-5 text-display-md uppercase">Registro e responsabilidade</h2>
            <p className="mt-5 text-ink-3">Informações para conferência de clientes, condomínios e departamentos de compras.</p>
          </div>
          <dl className="divide-y divide-line border-y border-ink">
            {[["Razão social", site.legalName], ["CNPJ", site.cnpj], ["Registro profissional", site.crea], ["Área de atuação", site.serviceArea], ["Endereço", site.contact.address]].map(([k, v]) => (
              <div key={k} className="grid gap-1 py-4 sm:grid-cols-[200px_1fr]">
                <dt className="label-mono text-ink-3">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="container mt-16 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {COMMITMENTS.map((c) => (
            <div key={c.k} className="bg-paper p-6">
              <p className="label-mono text-signal-strong">{c.k}</p>
              <p className="mt-2 font-semibold">{c.v}</p>
            </div>
          ))}
        </div>
        <div className="container mt-12">
          <Link to="/obras" className="btn btn-ink">Ver obras realizadas <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
      </section>
    </>
  );
}
