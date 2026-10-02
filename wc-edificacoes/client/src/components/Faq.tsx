import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { SectionLabel } from "@/components/Brand";
import { Link } from "@/components/Link";
import { FAQ } from "@/data/faq";
import { curves, durations } from "@/motion/tokens";
import { Reveal, SplitWords } from "@/motion/ui";

/** Perguntas frequentes em sanfona acessível (botão com aria-expanded + região). */
export function Faq({ index = "06" }: { index?: string }) {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();
  return (
    <section className="cv-auto section-pad border-t border-line" aria-labelledby={`${base}-t`}>
      <div className="container grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <Reveal><SectionLabel index={index}>Dúvidas frequentes</SectionLabel></Reveal>
          <h2 id={`${base}-t`} className="mt-5 text-display-lg uppercase text-balance"><SplitWords text="Perguntas antes de começar." onView /></h2>
          <Reveal delay={0.15}>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-3">Não achou a sua? Mande pelo formulário ou pelo WhatsApp — respondemos em até 1 dia útil.</p>
            <Link to="/orcamento" className="btn btn-ink mt-8">Tirar uma dúvida</Link>
          </Reveal>
        </div>
        <ul className="border-t border-ink">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <li key={item.q} className="border-b border-line">
                <h3>
                  <button
                    type="button"
                    id={`${base}-b${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`${base}-p${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="group flex w-full items-center justify-between gap-6 py-5 text-left text-lg font-semibold transition-colors hover:text-signal-strong"
                  >
                    {item.q}
                    <span className={`grid h-9 w-9 shrink-0 place-items-center border transition-colors duration-300 ${isOpen ? "border-ink bg-ink text-paper" : "border-line group-hover:border-ink"}`}>
                      <Plus className={`h-4 w-4 transition-transform duration-500 [transition-timing-function:var(--ease-out-back)] ${isOpen ? "rotate-45" : ""}`} aria-hidden="true" />
                    </span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`${base}-p${i}`}
                      role="region"
                      aria-labelledby={`${base}-b${i}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: durations.medium, ease: curves.fastOutSlowIn }}
                      className="overflow-hidden"
                    >
                      <p className="max-w-2xl pb-6 pr-12 leading-relaxed text-ink-3">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
