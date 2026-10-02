import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Menu, Phone, X } from "lucide-react";
import { Logo } from "@/components/Brand";
import { Link, NavLink } from "@/components/Link";
import { Modal } from "@/components/Modal";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";
import { curves, durations, springs } from "@/motion/tokens";
import { ScrollProgress } from "@/motion/ui";

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
  const [hidden, setHidden] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const { pathname } = useLocation();
  const { scrollY } = useScroll();

  useEffect(() => setOpen(false), [pathname]);

  // Esconde ao rolar para baixo e reaparece ao rolar para cima (mais área útil no celular)
  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 8);
    if (Math.abs(y - prev) < 4) return;
    setHidden(y > prev && y > 320);
  });
  useEffect(() => {
    // barras "sticky" (ex.: filtros de obras) acompanham o cabeçalho
    document.documentElement.style.setProperty("--header-offset", hidden ? "0px" : "var(--header-h)");
  }, [hidden]);

  const active = NAV.find((n) => pathname.startsWith(n.to))?.to ?? null;
  const indicator = hover ?? active;

  return (
    <motion.header
      className={cn(
        "site-header on-dark sticky top-0 z-40 bg-ink/95 text-paper backdrop-blur-md supports-[backdrop-filter]:bg-ink/85",
        "transition-shadow duration-300",
        scrolled && !hidden && "shadow-[0_1px_0_0_rgba(255,255,255,0.08),0_10px_30px_-12px_rgba(0,0,0,0.5)]",
      )}
      animate={{ y: hidden && !open ? "-100%" : "0%" }}
      transition={{ duration: durations.medium, ease: hidden ? curves.emphasizedAccelerate : curves.emphasizedDecelerate }}
    >
      <a
        href="#conteudo"
        onClick={(e) => { e.preventDefault(); const m = document.getElementById("conteudo"); m?.focus(); m?.scrollIntoView(); }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:bg-signal focus:px-4 focus:py-2 focus:text-ink">
        Pular para o conteúdo
      </a>
      <div className="container flex h-[var(--header-h)] items-center justify-between gap-6">
        <Link to="/" aria-label={`${site.name} — página inicial`} className="group shrink-0">
          <Logo tone="light" />
        </Link>

        <nav aria-label="Principal" className="hidden lg:block" onMouseLeave={() => setHover(null)}>
          <ul className="flex items-center gap-1 text-[0.95rem] font-medium">
            {NAV.map((n) => (
              <li key={n.to} className="relative">
                <NavLink
                  to={n.to}
                  onMouseEnter={() => setHover(n.to)}
                  onFocus={() => setHover(n.to)}
                  onBlur={() => setHover(null)}
                  className="relative z-10 block px-4 py-2 text-paper/75 transition-colors duration-200 hover:text-paper aria-[current=page]:text-paper"
                >
                  {n.label}
                </NavLink>
                {/* Indicador compartilhado: desliza entre os itens (layoutId, como um Hero local) */}
                {indicator === n.to && (
                  <motion.span
                    layoutId="nav-indicator"
                    aria-hidden="true"
                    className="absolute inset-x-2 bottom-0 h-[2px] bg-signal"
                    transition={springs.snappy}
                  />
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <a href={`tel:${site.contact.phoneHref}`} className="hidden xl:inline-flex items-center gap-2 font-mono text-sm text-paper/70 transition-colors hover:text-paper">
            <Phone className="h-4 w-4" aria-hidden="true" />
            {site.contact.phone}
          </a>
          <Link to="/orcamento" className="btn btn-signal btn-sm hidden sm:inline-flex h-10 px-4">
            Pedir orçamento
          </Link>
          <button
            type="button"
            data-ripple
            className="relative overflow-hidden lg:hidden inline-flex h-11 w-11 items-center justify-center border border-paper/25 transition-colors hover:border-paper"
            aria-label="Abrir menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <ScrollProgress className="absolute inset-x-0 bottom-0 h-[2px] bg-signal" />

      <Modal open={open} onClose={() => setOpen(false)} label="Menu de navegação" className="m-0 h-[100dvh] w-full">
        <AnimatePresence>
          {open && (
            <motion.div
              className="on-dark relative flex h-[100dvh] w-screen flex-col overflow-hidden bg-ink text-paper"
              initial={{ clipPath: "circle(0% at 100% 0%)" }}
              animate={{ clipPath: "circle(150% at 100% 0%)" }}
              transition={{ duration: durations.slower, ease: curves.emphasizedDecelerate }}
            >
              <div aria-hidden="true" className="blueprint-grid blueprint-pan absolute inset-0 text-paper" />
              <div className="container relative flex h-[var(--header-h)] items-center justify-between">
                <Logo tone="light" />
                <button type="button" onClick={() => setOpen(false)} className="inline-flex h-11 w-11 items-center justify-center border border-paper/25" aria-label="Fechar menu">
                  <motion.span initial={{ rotate: -90 }} animate={{ rotate: 0 }} transition={springs.bouncy}><X className="h-5 w-5" aria-hidden="true" /></motion.span>
                </button>
              </div>
              <nav aria-label="Menu móvel" className="container relative mt-8 flex-1">
                <motion.ul
                  className="divide-y divide-paper/10 border-y border-paper/10"
                  initial="hidden"
                  animate="show"
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.18 } } }}
                >
                  {[{ to: "/", label: "Início" }, ...NAV].map((n, i) => (
                    <motion.li
                      key={n.to}
                      className="overflow-hidden"
                      variants={{ hidden: { opacity: 0, y: 40 }, show: { opacity: 1, y: 0, transition: { duration: durations.slow, ease: curves.easeOutExpo } } }}
                    >
                      <NavLink to={n.to} end={n.to === "/"} className="group flex items-baseline gap-4 py-5 text-3xl font-bold stretch-wide aria-[current=page]:text-signal">
                        <span className="label-mono text-paper/40">{String(i).padStart(2, "0")}</span>
                        <span className="transition-transform duration-300 group-hover:translate-x-2">{n.label}</span>
                      </NavLink>
                    </motion.li>
                  ))}
                </motion.ul>
              </nav>
              <motion.div
                className="container relative space-y-3 pb-8 pt-6"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: durations.slow, ease: curves.easeOutExpo }}
              >
                <Link to="/orcamento" className="btn btn-signal w-full">Pedir orçamento</Link>
                <a href={`tel:${site.contact.phoneHref}`} className="btn btn-ghost w-full"><Phone className="h-4 w-4" aria-hidden="true" />{site.contact.phone}</a>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>
    </motion.header>
  );
}
