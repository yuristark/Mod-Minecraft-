/**
 * Widgets de animação inspirados no Flutter, implementados para React com Motion.
 *
 * O Flutter tem um vocabulário de animação muito claro (AnimatedSwitcher,
 * TweenAnimationBuilder, Interval/staggered, Hero, page transitions). O site é
 * React, então não dá para rodar Flutter aqui — mas dá para trazer o mesmo modelo
 * mental e as mesmas curvas. Cada componente abaixo documenta o equivalente.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { animate, AnimatePresence, motion, useInView, useReducedMotion, type Variants } from "motion/react";
import { curves, durations, stagger as staggerTokens } from "./tokens";

/* ------------------------------------------------------------------ */
/* AnimatedSwitcher                                                    */
/* ------------------------------------------------------------------ */

const SWITCH_TRANSITIONS = {
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  fadeScale: { initial: { opacity: 0, scale: 0.94 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1.04 } },
  slideUp: { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } },
} as const;

/**
 * Flutter: `AnimatedSwitcher` — troca o filho com transição quando `switchKey` muda.
 * (Usa o modo "wait" do AnimatePresence; o modo "popLayout" injetaria <style> e quebraria a CSP.)
 */
export function AnimatedSwitcher({
  switchKey, children, transition = "slideUp", duration = durations.fast, className, as = "span",
}: {
  switchKey: string | number;
  children: ReactNode;
  transition?: keyof typeof SWITCH_TRANSITIONS;
  duration?: number;
  className?: string;
  as?: "span" | "div";
}) {
  const t = SWITCH_TRANSITIONS[transition];
  const Tag = as === "div" ? motion.div : motion.span;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Tag key={switchKey} className={className} {...t} transition={{ duration, ease: curves.fastOutSlowIn }}>
        {children}
      </Tag>
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Staggered animations (Interval)                                     */
/* ------------------------------------------------------------------ */

const staggerParent = (gap: number, delay: number): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: durations.slower, ease: curves.easeOutExpo } },
};

/**
 * Flutter: animação escalonada (`StaggeredAnimation` com `Interval`).
 * Os filhos `<StaggerItem>` entram um após o outro quando o grupo aparece na tela.
 */
export function Staggered({
  children, className, gap = staggerTokens.base, delay = 0, as = "div", once = true, amount = 0.2,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
  as?: "div" | "ul" | "ol" | "dl";
  once?: boolean;
  amount?: number;
}) {
  const Tag = motion[as];
  return (
    <Tag className={className} variants={staggerParent(gap, delay)} initial="hidden" whileInView="show" viewport={{ once, amount }}>
      {children}
    </Tag>
  );
}

export function StaggerItem({
  children, className, as = "div", variants = staggerChild, style,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
  variants?: Variants;
  style?: CSSProperties;
}) {
  const Tag = as === "li" ? motion.li : motion.div;
  return <Tag className={className} variants={variants} style={style}>{children}</Tag>;
}

/* ------------------------------------------------------------------ */
/* TweenAnimationBuilder<double>                                       */
/* ------------------------------------------------------------------ */

/**
 * Flutter: `TweenAnimationBuilder<double>` — interpola um número sempre que `value` muda.
 * Escreve direto no DOM (sem re-render do React a cada quadro).
 * Com `fromZero`, a primeira contagem começa em 0 quando o número entra na tela.
 */
export function TweenNumber({
  value, format = (n) => String(Math.round(n)), duration = durations.slower, fromZero = false, className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  fromZero?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const current = useRef<number | null>(fromZero ? 0 : value);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  // O texto inicial é renderizado uma única vez; depois o DOM é atualizado pela animação
  // (assim o React nunca "pisca" o valor final antes da interpolação).
  const [initialText] = useState(() => format(fromZero ? 0 : value));

  useEffect(() => {
    const el = ref.current;
    if (!el || !Number.isFinite(value)) return;
    if (reduce || (fromZero && !inView)) {
      if (reduce || !fromZero) { current.current = value; el.textContent = format(value); }
      return;
    }
    const from = current.current ?? value;
    const controls = animate(from, value, {
      duration,
      ease: curves.easeOutExpo,
      onUpdate: (v) => { current.current = v; el.textContent = format(v); },
    });
    return () => controls.stop();
  }, [value, inView, reduce, duration, fromZero, format]);

  return <span ref={ref} className={className}>{initialText}</span>;
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

/**
 * Flutter: `Hero` — o mesmo elemento "voa" de uma página para a outra.
 * Na web isso é feito pela View Transitions API: dois elementos com o mesmo
 * `view-transition-name` (um na página de origem, outro na de destino) são
 * interpolados pelo navegador. As curvas ficam em index.css (::view-transition-*).
 */
export const heroName = (tag: string) => ({ viewTransitionName: `hero-${tag}` }) as CSSProperties;
