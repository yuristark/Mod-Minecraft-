/**
 * ==================================================================
 *  SISTEMA DE MOVIMENTO (motion design tokens)
 *  Uma única fonte de verdade para durações, curvas e molas.
 *  Os mesmos valores existem como variáveis CSS em index.css
 *  (--dur-*, --ease-*), então animações em CSS, em Motion (React)
 *  e na cena 3D (three.js) têm o mesmo "ritmo".
 *
 *  As curvas seguem a nomenclatura do Flutter (`Curves.*`) e do
 *  Material 3 — o mesmo vocabulário usado por designers de motion
 *  em apps — portadas para a web.
 * ==================================================================
 */

export type Bezier = readonly [number, number, number, number];

/** Curvas cúbicas — equivalentes às constantes `Curves` do Flutter. */
export const curves = {
  /** Curves.ease */
  ease: [0.25, 0.1, 0.25, 1],
  /** Curves.easeOutCubic — padrão para entradas */
  easeOutCubic: [0.215, 0.61, 0.355, 1],
  /** Curves.easeInOutCubic */
  easeInOutCubic: [0.645, 0.045, 0.355, 1],
  /** Curves.fastOutSlowIn — a curva "padrão" do Material */
  fastOutSlowIn: [0.4, 0, 0.2, 1],
  /** Curves.easeOutBack — leve ultrapassagem, bom para peças "encaixando" */
  easeOutBack: [0.175, 0.885, 0.32, 1.275],
  /** Material 3 · emphasized decelerate — entradas de destaque */
  emphasizedDecelerate: [0.05, 0.7, 0.1, 1],
  /** Material 3 · emphasized accelerate — saídas */
  emphasizedAccelerate: [0.3, 0, 0.8, 0.15],
  /** Curves.easeOutExpo — revelações longas (texto, imagens) */
  easeOutExpo: [0.16, 1, 0.3, 1],
} as const satisfies Record<string, Bezier>;

/** Curvas não cúbicas do Flutter, para uso em JS (three.js, contadores). */
export const curveFns = {
  linear: (t: number) => t,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  /** Curves.easeOutBack */
  easeOutBack: (t: number, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  /** Curves.elasticOut (ElasticOutCurve, period = 0.4) */
  elasticOut: (t: number, period = 0.4) => {
    if (t <= 0 || t >= 1) return t <= 0 ? 0 : 1;
    const s = period / 4;
    return Math.pow(2, -10 * t) * Math.sin(((t - s) * (Math.PI * 2)) / period) + 1;
  },
  /** Curves.bounceOut */
  bounceOut: (t: number) => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },
} as const;

/**
 * Interval do Flutter: mapeia o progresso global [0..1] para um trecho [begin..end].
 * É a base das "staggered animations" (cada peça anima numa fatia do tempo total).
 */
export const interval = (t: number, begin: number, end: number, curve: (x: number) => number = curveFns.linear) =>
  curve(Math.min(1, Math.max(0, (t - begin) / (end - begin))));

/** Durações em segundos (Motion usa segundos). Espelham --dur-* no CSS. */
export const durations = {
  instant: 0.1,
  fast: 0.2, // kThemeChangeDuration / microinterações
  medium: 0.3, // transições de página do Material
  slow: 0.5,
  slower: 0.8,
  cinematic: 1.2,
} as const;

/** Molas no formato SpringDescription do Flutter (mass, stiffness, damping). */
export const springs = {
  /** Botões, chips, indicadores — responde rápido sem balançar */
  snappy: { type: "spring", mass: 1, stiffness: 520, damping: 38 },
  /** Cartões, painéis, layout */
  gentle: { type: "spring", mass: 1, stiffness: 180, damping: 26 },
  /** Elementos "magnéticos" e de destaque — um pouco de rebote */
  bouncy: { type: "spring", mass: 1, stiffness: 300, damping: 14 },
  /** Seguir o ponteiro / rolagem suavizada */
  follow: { type: "spring", mass: 0.6, stiffness: 140, damping: 22 },
} as const;

/** Escalonamento padrão entre itens de uma lista (StaggeredAnimation). */
export const stagger = { tight: 0.04, base: 0.07, loose: 0.12 } as const;
