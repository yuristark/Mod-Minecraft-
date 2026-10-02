import { ArrowUp, ArrowUpRight, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Logo } from "@/components/Brand";
import { useLocation } from "react-router-dom";
import { Link } from "@/components/Link";
import { site, whatsappLink } from "@/config/site";
import { StaggerItem, Staggered } from "@/motion/flutter";
import { Magnetic, Reveal, SplitWords } from "@/motion/ui";

const ext = { target: "_blank", rel: "noopener noreferrer" } as const;

export function SiteFooter() {
  const year = new Date().getFullYear();
  const socials = Object.entries(site.social).filter(([, url]) => url);
  // Na própria página de orçamento a chamada "Pedir orçamento" é redundante
  const showCta = useLocation().pathname !== "/orcamento";
  return (
    <footer className="on-dark bg-ink text-paper">
      {/* Faixa de chamada */}
      {showCta && <div className="grain relative overflow-hidden border-b border-paper/10 text-paper">
        <div aria-hidden="true" className="blueprint-grid blueprint-pan absolute inset-0" />
        <div className="container relative grid gap-8 py-16 md:grid-cols-[1.4fr_1fr] md:items-end md:py-24">
          <div>
            <Reveal><p className="label-mono text-signal mb-5">Próximo passo</p></Reveal>
            <h2 className="text-display-lg uppercase text-balance"><SplitWords text="Sua obra começa com" highlight="uma boa conversa." highlightClassName="text-signal" onView /></h2>
          </div>
          <Reveal delay={0.2} className="flex flex-col gap-3 sm:flex-row md:justify-end">
            <Magnetic><Link to="/orcamento" className="btn btn-signal w-full sm:w-auto">Pedir orçamento <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link></Magnetic>
            <Magnetic><a href={whatsappLink()} {...ext} className="btn btn-ghost w-full sm:w-auto"><MessageCircle className="h-4 w-4" aria-hidden="true" />WhatsApp</a></Magnetic>
          </Reveal>
        </div>
      </div>}

      <Staggered className="container grid gap-12 py-14 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <StaggerItem className="space-y-5">
          <Logo tone="light" />
          <p className="max-w-sm text-sm leading-relaxed text-paper/65">{site.pitch}</p>
        </StaggerItem>

        <StaggerItem>
          <h3 className="label-mono text-paper/50 mb-4">Contato</h3>
          <ul className="space-y-3 text-sm">
            <li><a href={`tel:${site.contact.phoneHref}`} className="inline-flex gap-2.5 transition-colors hover:text-signal"><Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{site.contact.phone}</a></li>
            <li><a href={`mailto:${site.contact.email}`} className="inline-flex gap-2.5 break-all hover:text-signal"><Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{site.contact.email}</a></li>
            <li><a href={site.contact.mapsUrl} {...ext} className="inline-flex gap-2.5 transition-colors hover:text-signal"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{site.contact.address}</a></li>
          </ul>
          <p className="mt-4 text-xs text-paper/50">{site.contact.hours}</p>
        </StaggerItem>

        <StaggerItem>
          <h3 className="label-mono text-paper/50 mb-4">Navegação</h3>
          <ul className="space-y-2.5 text-sm">
            {[["/obras", "Obras"], ["/servicos", "Serviços"], ["/simulador", "Simulador de custo"], ["/empresa", "A empresa"], ["/orcamento", "Orçamento e contato"]].map(([to, label]) => (
              <li key={to}><Link to={to} className="link-underline text-paper/80 hover:text-paper">{label}</Link></li>
            ))}
          </ul>
        </StaggerItem>

        <StaggerItem>
          <h3 className="label-mono text-paper/50 mb-4">Redes</h3>
          <ul className="space-y-2.5 text-sm">
            {socials.map(([name, url]) => (
              <li key={name}>
                <a href={url} {...ext} className="inline-flex items-center gap-1.5 capitalize text-paper/80 hover:text-paper">
                  {name}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs leading-relaxed text-paper/50">Atendemos {site.serviceArea}.</p>
        </StaggerItem>
      </Staggered>

      <div className="border-t border-paper/10">
        <div className="container flex flex-col gap-3 py-6 text-xs text-paper/50 md:flex-row md:items-center md:justify-between">
          <p>© {year} {site.legalName} · CNPJ {site.cnpj} · {site.crea}</p>
          <p className="flex items-center gap-5">
            <Link to="/privacidade" className="link-underline hover:text-paper">Privacidade e LGPD</Link>
            <Link to="/admin" className="link-underline hover:text-paper" rel="nofollow">Área restrita</Link>
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="group inline-flex items-center gap-1.5 border border-paper/20 px-2.5 py-1.5 transition-colors hover:border-paper hover:text-paper" aria-label="Voltar ao topo">
              Topo <ArrowUp className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5" aria-hidden="true" />
            </button>
          </p>
        </div>
      </div>
    </footer>
  );
}
