import { ArrowRight } from "lucide-react";
import { SectionLabel } from "@/components/Brand";
import { Link } from "@/components/Link";
import { ProjectArt } from "@/components/ProjectArt";
import { site } from "@/config/site";
import { COMMITMENTS } from "@/data/services";
import { useSeo } from "@/hooks/useSeo";
import { StaggerItem, Staggered, TweenNumber } from "@/motion/flutter";
import { Magnetic, Parallax, Reveal, SplitWords } from "@/motion/ui";

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
      <section className="on-dark grain relative overflow-hidden bg-ink text-paper">
        <div aria-hidden="true" className="blueprint-grid blueprint-pan absolute inset-0" />
        <div aria-hidden="true" className="glow pointer-events-none absolute -bottom-40 -left-64 h-[700px] w-[700px]" />
        <div className="container relative grid gap-12 py-16 md:py-24 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <SectionLabel className="text-paper/60">A empresa</SectionLabel>
            <h1 className="mt-6 text-display-xl uppercase text-balance"><SplitWords text="Gente de obra," highlight="com cabeça de engenharia." highlightClassName="text-signal" /></h1>
          </div>
          <Reveal delay={0.5}>
            {years > 0 && (
              <p className="flex items-baseline gap-3">
                <TweenNumber value={years} fromZero duration={1.6} className="text-7xl font-bold leading-none tabular stretch-wide text-signal md:text-8xl" />
                <span className="label-mono text-paper/60">anos de obra</span>
              </p>
            )}
            <p className="mt-6 text-lg leading-relaxed text-paper/75">
              A {site.name} nasceu em {site.foundedYear} com uma ideia simples: obra boa é obra planejada. Há {years > 0 ? years : "—"} anos
              construímos e reformamos imóveis residenciais, comerciais e industriais em {site.serviceArea}.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="section-pad">
        <div className="container grid gap-14 lg:grid-cols-2 lg:items-center">
          <div className="space-y-5 text-lg leading-relaxed text-ink-2">
            <SectionLabel index="01">Nossa forma de trabalhar</SectionLabel>
            <h2 className="text-display-md uppercase text-ink"><SplitWords text="Planejar antes, para não improvisar depois." onView /></h2>
            <p>
              Toda obra começa no papel: levantamento do terreno, compatibilização de projetos e um orçamento detalhado por etapa.
              Só então assinamos contrato com prazo e cronograma definidos.
            </p>
            <p>
              Durante a execução, o cliente acompanha tudo por relatórios periódicos com fotos e medições. Ao final,
              entregamos o imóvel com vistoria conjunta, manual do proprietário e atendimento de garantia.
            </p>
          </div>
          <Reveal className="overflow-hidden border border-line bg-concrete-2 p-3">
            <Parallax distance={20}>
              <ProjectArt seed="empresa-sede" category="residencial" status="concluida" animate className="h-auto w-full" label="Ilustração técnica de uma residência" />
            </Parallax>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-line bg-concrete-2/60 section-pad">
        <div className="container">
          <SectionLabel index="02">Valores</SectionLabel>
          <Staggered as="ul" className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v, i) => (
              <StaggerItem as="li" key={v.t} className="hover-fill group bg-concrete p-7 [--fill:rgb(var(--c-ink))]">
                <span className="font-mono text-sm text-signal-strong transition-colors duration-500 group-hover:text-signal">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-6 text-xl font-bold transition-colors duration-500 group-hover:text-paper">{v.t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-3 transition-colors duration-500 group-hover:text-paper/70">{v.d}</p>
              </StaggerItem>
            ))}
          </Staggered>
        </div>
      </section>

      <section className="section-pad">
        <div className="container grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <SectionLabel index="03">Dados da empresa</SectionLabel>
            <h2 className="mt-5 text-display-md uppercase">Registro e responsabilidade</h2>
            <p className="mt-5 text-ink-3">Informações para conferência de clientes, condomínios e departamentos de compras.</p>
          </div>
          <Staggered as="dl" gap={0.05} className="divide-y divide-line border-y border-ink">
            {[["Razão social", site.legalName], ["CNPJ", site.cnpj], ["Registro profissional", site.crea], ["Área de atuação", site.serviceArea], ["Endereço", site.contact.address]].map(([k, v]) => (
              <StaggerItem key={k} className="grid gap-1 py-4 sm:grid-cols-[200px_1fr]">
                <dt className="label-mono text-ink-3">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </StaggerItem>
            ))}
          </Staggered>
        </div>
        <div className="container mt-16">
          <Staggered className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {COMMITMENTS.map((c) => (
              <StaggerItem key={c.k} className="bg-paper p-6">
                <p className="label-mono text-signal-strong">{c.k}</p>
                <p className="mt-2 font-semibold">{c.v}</p>
              </StaggerItem>
            ))}
          </Staggered>
        </div>
        <div className="container mt-12">
          <Magnetic><Link to="/obras" className="btn btn-ink">Ver obras realizadas <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Magnetic>
        </div>
      </section>
    </>
  );
}
