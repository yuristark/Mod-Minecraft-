/**
 * Micro-interações e animações de interface (UI animations).
 * Todas respeitam `prefers-reduced-motion` (MotionConfig reducedMotion="user" em App.tsx
 * desliga transformações; aqui também checamos manualmente onde há física de ponteiro).
 */
import { Fragment, useRef, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import {
  motion, useMotionTemplate, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, useVelocity,
  type MotionValue,
} from "motion/react";
import { cn } from "@/lib/utils";
import { curves, durations, springs } from "./tokens";

/** Revela o bloco ao entrar na tela (fade + subida). */
export function Reveal({
  children, className, delay = 0, y = 32, as = "div", amount = 0.25,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: "div" | "section" | "li" | "figure" | "p";
  amount?: number;
}) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: durations.slower, ease: curves.easeOutExpo, delay }}
    >
      {children}
    </Tag>
  );
}

/**
 * Título com revelação palavra por palavra, cada palavra subindo de dentro de uma "máscara".
 * O texto completo continua acessível (aria-label no contêiner; palavras com aria-hidden).
 */
export function SplitWords({
  text, className, delay = 0, gap = 0.055, highlight, highlightClassName, onView = false,
}: {
  text: string;
  className?: string;
  delay?: number;
  gap?: number;
  /** trecho final do texto que recebe destaque de cor */
  highlight?: string;
  highlightClassName?: string;
  /** anima ao entrar na tela (padrão: anima ao montar) */
  onView?: boolean;
}) {
  const full = highlight ? `${text} ${highlight}` : text;
  const base = text.split(" ").filter(Boolean).map((w) => ({ w, hl: false }));
  const hl = highlight ? highlight.split(" ").filter(Boolean).map((w) => ({ w, hl: true })) : [];
  const words = [...base, ...hl];
  const trigger = onView
    ? { initial: "hidden", whileInView: "show", viewport: { once: true, amount: 0.5 } }
    : { initial: "hidden", animate: "show" };
  return (
    <motion.span
      aria-label={full}
      role="text"
      className={cn("inline", className)}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
      {...trigger}
    >
      {words.map(({ w, hl: isHl }, i) => (
        <Fragment key={i}>
          <span aria-hidden="true" className="inline-block overflow-hidden pb-[0.1em] -mb-[0.1em] align-top">
            <motion.span
              className={cn("inline-block", isHl && highlightClassName)}
              variants={{
                hidden: { y: "105%", rotate: 4 },
                show: { y: "0%", rotate: 0, transition: { duration: durations.slower + 0.1, ease: curves.easeOutExpo } },
              }}
            >
              {w}
            </motion.span>
          </span>
          {i < words.length - 1 && " "}
        </Fragment>
      ))}
    </motion.span>
  );
}

/** Efeito "magnético": o elemento é atraído pelo ponteiro e volta com mola. */
export function Magnetic({ children, strength = 0.28, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const x = useSpring(0, springs.bouncy);
  const y = useSpring(0, springs.bouncy);
  const onMove = (e: RPointerEvent) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const reset = () => { x.set(0); y.set(0); };
  return (
    <motion.div ref={ref} onPointerMove={onMove} onPointerLeave={reset} style={{ x, y }} className={cn("inline-flex", className)}>
      {children}
    </motion.div>
  );
}

/**
 * Cartão com inclinação 3D seguindo o ponteiro + brilho especular.
 * Expõe --mx/--my (posição do ponteiro em %) para o brilho em CSS (.tilt-glare).
 */
// Telas de toque não têm "hover": lá o cartão é um bloco simples (sem camadas 3D extras para a GPU).
const canHover = typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

export function TiltCard(props: { children: ReactNode; className?: string; max?: number }) {
  if (!canHover) return <div className={cn("tilt", props.className)}>{props.children}</div>;
  return <TiltCardInteractive {...props} />;
}

function TiltCardInteractive({ children, className, max = 6 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), springs.follow);
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), springs.follow);
  const mx = useTransform(px, (v) => `${v * 100}%`);
  const my = useTransform(py, (v) => `${v * 100}%`);
  const onMove = (e: RPointerEvent) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const reset = () => { px.set(0.5); py.set(0.5); };
  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={cn("tilt [perspective:1200px]", className)}
      style={{ ["--mx" as string]: mx, ["--my" as string]: my } as unknown as CSSProperties}
    >
      <motion.div className="h-full [transform-style:preserve-3d]" style={{ rotateX: reduce ? 0 : rx, rotateY: reduce ? 0 : ry }}>
        {children}
      </motion.div>
    </motion.div>
  );
}

/** Barra de progresso de leitura no topo da página (mola suaviza a rolagem). */
export function ScrollProgress({ className }: { className?: string }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 220, damping: 34, mass: 0.4 });
  return <motion.div aria-hidden="true" className={cn("origin-left", className)} style={{ scaleX }} />;
}

/** Inclinação proporcional à velocidade de rolagem (para faixas tipo letreiro). */
export function useScrollSkew(maxDeg = 8): MotionValue<number> {
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smooth = useSpring(velocity, { stiffness: 260, damping: 50 });
  return useTransform(smooth, [-2500, 0, 2500], [maxDeg, 0, -maxDeg], { clamp: true });
}

/** Parallax vertical simples ligado à posição do elemento na janela. */
export function Parallax({ children, className, distance = 60 }: { children: ReactNode; className?: string; distance?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  return (
    <motion.div ref={ref} className={className} style={{ y: reduce ? 0 : y }}>
      {children}
    </motion.div>
  );
}

/** Linha que se "desenha" conforme a seção rola (linha do tempo do processo). */
export function ScrollLine({ className, vertical = false }: { className?: string; vertical?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 45%"] });
  const p = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  const right = useTransform(p, (v) => (vertical ? 0 : (1 - v) * 100));
  const bottom = useTransform(p, (v) => (vertical ? (1 - v) * 100 : 0));
  const clip = useMotionTemplate`inset(0 ${right}% ${bottom}% 0)`;
  return <motion.span ref={ref} aria-hidden="true" className={className} style={{ clipPath: clip }} />;
}
