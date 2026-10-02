import { ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "@/components/Link";
import { useSeo } from "@/hooks/useSeo";
import { springs } from "@/motion/tokens";
import { Reveal, SplitWords } from "@/motion/ui";

export default function NotFound({ title = "Página não encontrada" }: { title?: string }) {
  useSeo(title);
  return (
    <section className="container relative grid min-h-[70vh] place-content-center overflow-hidden py-20 text-center">
      {/* Gancho de grua balançando, com o "404" pendurado */}
      <div aria-hidden="true" className="swing mx-auto flex flex-col items-center motion-reduce:animate-none">
        <span className="h-24 w-px bg-ink/40 md:h-32" />
        <svg viewBox="0 0 40 46" className="-mt-px h-10 w-9 text-signal-strong">
          <rect x="12" y="0" width="16" height="12" fill="currentColor" />
          <path d="M20 12 v14 a9 9 0 1 1 -9 -9" fill="none" stroke="currentColor" strokeWidth="4" />
        </svg>
        <motion.p
          className="-mt-1 border-2 border-ink bg-paper px-6 py-2 font-mono text-7xl font-medium text-signal-strong md:text-9xl"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={springs.bouncy}
        >
          404
        </motion.p>
      </div>
      <h1 className="mt-10 text-display-md uppercase"><SplitWords text={title} delay={0.3} /></h1>
      <Reveal delay={0.5}>
        <p className="mx-auto mt-4 max-w-md text-ink-3">O endereço pode ter mudado ou a página foi removida.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/" className="btn btn-ink"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Ir para o início</Link>
          <Link to="/obras" className="btn btn-ghost">Ver obras</Link>
        </div>
      </Reveal>
    </section>
  );
}
