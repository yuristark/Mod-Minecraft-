import { Link } from "react-router-dom";
import { ArrowUpRight, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Logo } from "@/components/Brand";
import { site, whatsappLink } from "@/config/site";

const ext = { target: "_blank", rel: "noopener noreferrer" } as const;

export function SiteFooter() {
  const year = new Date().getFullYear();
  const socials = Object.entries(site.social).filter(([, url]) => url);
  return (
    <footer className="on-dark bg-ink text-paper">
      {/* Faixa de chamada */}
      <div className="border-b border-paper/10 blueprint-grid text-paper">
        <div className="container grid gap-8 py-16 md:grid-cols-[1.4fr_1fr] md:items-end md:py-24">
          <div>
            <p className="label-mono text-signal mb-5">Próximo passo</p>
            <h2 className="text-display-lg uppercase text-balance">Sua obra começa com uma boa conversa.</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
            <Link to="/orcamento" className="btn btn-signal">Pedir orçamento <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
            <a href={whatsappLink()} {...ext} className="btn btn-ghost"><MessageCircle className="h-4 w-4" aria-hidden="true" />WhatsApp</a>
          </div>
        </div>
      </div>

      <div className="container grid gap-12 py-14 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div className="space-y-5">
          <Logo tone="light" />
          <p className="max-w-sm text-sm leading-relaxed text-paper/65">{site.pitch}</p>
        </div>

        <div>
          <h3 className="label-mono text-paper/50 mb-4">Contato</h3>
          <ul className="space-y-3 text-sm">
            <li><a href={`tel:${site.contact.phoneHref}`} className="inline-flex gap-2.5 hover:text-signal"><Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{site.contact.phone}</a></li>
            <li><a href={`mailto:${site.contact.email}`} className="inline-flex gap-2.5 break-all hover:text-signal"><Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{site.contact.email}</a></li>
            <li><a href={site.contact.mapsUrl} {...ext} className="inline-flex gap-2.5 hover:text-signal"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{site.contact.address}</a></li>
          </ul>
          <p className="mt-4 text-xs text-paper/50">{site.contact.hours}</p>
        </div>

        <div>
          <h3 className="label-mono text-paper/50 mb-4">Navegação</h3>
          <ul className="space-y-2.5 text-sm">
            {[["/obras", "Obras"], ["/servicos", "Serviços"], ["/simulador", "Simulador de custo"], ["/empresa", "A empresa"], ["/orcamento", "Orçamento e contato"]].map(([to, label]) => (
              <li key={to}><Link to={to} className="link-underline text-paper/80 hover:text-paper">{label}</Link></li>
            ))}
          </ul>
        </div>

        <div>
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
        </div>
      </div>

      <div className="border-t border-paper/10">
        <div className="container flex flex-col gap-3 py-6 text-xs text-paper/50 md:flex-row md:items-center md:justify-between">
          <p>© {year} {site.legalName} · CNPJ {site.cnpj} · {site.crea}</p>
          <p className="flex gap-5">
            <Link to="/privacidade" className="hover:text-paper">Privacidade e LGPD</Link>
            <Link to="/admin" className="hover:text-paper" rel="nofollow">Área restrita</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
