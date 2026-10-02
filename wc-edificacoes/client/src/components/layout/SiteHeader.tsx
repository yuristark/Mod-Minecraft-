import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, Phone, X } from "lucide-react";
import { Logo } from "@/components/Brand";
import { Modal } from "@/components/Modal";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/obras", label: "Obras" },
  { to: "/servicos", label: "Serviços" },
  { to: "/simulador", label: "Simulador" },
  { to: "/empresa", label: "Empresa" },
  { to: "/orcamento", label: "Contato" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "on-dark sticky top-0 z-40 bg-ink text-paper transition-shadow",
        scrolled && "shadow-[0_1px_0_0_rgba(255,255,255,0.08),0_10px_30px_-12px_rgba(0,0,0,0.5)]",
      )}
    >
      <a
        href="#conteudo"
        onClick={(e) => { e.preventDefault(); const m = document.getElementById("conteudo"); m?.focus(); m?.scrollIntoView(); }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:bg-signal focus:px-4 focus:py-2 focus:text-ink">
        Pular para o conteúdo
      </a>
      <div className="container flex h-[var(--header-h)] items-center justify-between gap-6">
        <Link to="/" aria-label={`${site.name} — página inicial`} className="shrink-0">
          <Logo tone="light" />
        </Link>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-8 text-[0.95rem] font-medium">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} className="link-underline py-1 text-paper/80 hover:text-paper aria-[current=page]:text-paper">
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <a href={`tel:${site.contact.phoneHref}`} className="hidden xl:inline-flex items-center gap-2 font-mono text-sm text-paper/70 hover:text-paper">
            <Phone className="h-4 w-4" aria-hidden="true" />
            {site.contact.phone}
          </a>
          <Link to="/orcamento" className="btn btn-signal btn-sm hidden sm:inline-flex h-10 px-4">
            Pedir orçamento
          </Link>
          <button
            type="button"
            className="lg:hidden inline-flex h-11 w-11 items-center justify-center border border-paper/25 hover:border-paper"
            aria-label="Abrir menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} label="Menu de navegação" className="m-0 h-[100dvh] w-full">
        <div className="on-dark flex h-[100dvh] w-screen flex-col bg-ink text-paper blueprint-grid">
          <div className="container flex h-[var(--header-h)] items-center justify-between">
            <Logo tone="light" />
            <button type="button" onClick={() => setOpen(false)} className="inline-flex h-11 w-11 items-center justify-center border border-paper/25" aria-label="Fechar menu">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Menu móvel" className="container mt-8 flex-1">
            <ul className="divide-y divide-paper/10 border-y border-paper/10">
              <li><NavLink to="/" end className="flex items-baseline gap-4 py-5 text-3xl font-bold stretch-wide aria-[current=page]:text-signal"><span className="label-mono text-paper/40">00</span>Início</NavLink></li>
              {NAV.map((n, i) => (
                <li key={n.to}>
                  <NavLink to={n.to} className="flex items-baseline gap-4 py-5 text-3xl font-bold stretch-wide aria-[current=page]:text-signal">
                    <span className="label-mono text-paper/40">{String(i + 1).padStart(2, "0")}</span>
                    {n.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="container pb-8 pt-6 space-y-3">
            <Link to="/orcamento" className="btn btn-signal w-full">Pedir orçamento</Link>
            <a href={`tel:${site.contact.phoneHref}`} className="btn btn-ghost w-full"><Phone className="h-4 w-4" aria-hidden="true" />{site.contact.phone}</a>
          </div>
        </div>
      </Modal>
    </header>
  );
}
