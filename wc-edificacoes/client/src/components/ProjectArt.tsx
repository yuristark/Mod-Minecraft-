import { memo, type ReactNode } from "react";
import type { Category, ProjectStatus } from "@/lib/types";

/**
 * Desenho técnico procedural (elevação de fachada) gerado a partir do slug da obra.
 * Usado como capa enquanto a obra não tem fotos — cada obra ganha um desenho único,
 * coerente com o tipo (residencial, comercial...) e a fase (em andamento mostra grua).
 */

function hash(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Tone = "light" | "dark";
interface Props {
  seed: string;
  category: Category;
  status: ProjectStatus;
  tone?: Tone;
  animate?: boolean;
  className?: string;
  label?: string;
  width?: number;
  height?: number;
  fit?: "slice" | "meet";
}

const W = 400;
const H = 260;
const G = 212; // linha do terreno

export const ProjectArt = memo(function ProjectArt({
  seed, category, status, tone = "light", animate = false, className, label, width = W, height = H, fit = "slice",
}: Props) {
  const r = rng(`${seed}:${category}`);
  const between = (a: number, b: number) => a + r() * (b - a);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];

  const ink = tone === "dark" ? "#f1ede6" : "#17181a";
  const faint = tone === "dark" ? "rgba(241,237,230,0.14)" : "rgba(23,24,26,0.09)";
  const fill = tone === "dark" ? "rgba(241,237,230,0.05)" : "rgba(23,24,26,0.045)";
  const accent = tone === "dark" ? "#e8642c" : "#b9461a";
  const glass = tone === "dark" ? "rgba(232,100,44,0.10)" : "rgba(23,24,26,0.10)";

  const planned = status === "lancamento";
  const building = status === "em_andamento";
  const dash = planned ? "5 4" : undefined;
  let k = 0;
  const d = () => ({ ["--d" as string]: `${(k++ % 40) * 0.035}s` });
  const drawProps = animate ? { pathLength: 1, className: "draw-path" } : {};
  const sw = 1.4;

  const shapes: ReactNode[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number, o: { c?: string; w?: number; dashed?: boolean } = {}) =>
    shapes.push(<line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={o.c ?? ink} strokeWidth={o.w ?? sw} strokeDasharray={o.dashed || dash ? dash ?? "4 3" : undefined} style={d()} {...drawProps} />);
  const rect = (x: number, y: number, w: number, h: number, o: { c?: string; f?: string; w?: number; dashed?: boolean } = {}) =>
    shapes.push(<rect key={k} x={x} y={y} width={w} height={h} stroke={o.c ?? ink} strokeWidth={o.w ?? sw} fill={o.f ?? "none"} strokeDasharray={o.dashed || dash ? dash ?? "4 3" : undefined} style={d()} {...drawProps} />);
  const poly = (pts: [number, number][], o: { c?: string; f?: string; close?: boolean; dashed?: boolean } = {}) => {
    const pp = pts.map((p) => p.join(",")).join(" ");
    const Tag = o.close ? "polygon" : "polyline";
    shapes.push(<Tag key={k} points={pp} stroke={o.c ?? ink} strokeWidth={sw} fill={o.f ?? "none"} strokeLinejoin="miter" strokeDasharray={o.dashed || dash ? dash ?? "4 3" : undefined} style={d()} {...drawProps} />);
  };

  const windowRow = (x: number, y: number, w: number, h: number, n: number, gap: number) => {
    const ww = (w - gap * (n + 1)) / n;
    for (let i = 0; i < n; i++) {
      const wx = x + gap + i * (ww + gap);
      rect(wx, y, ww, h, { f: glass, w: 1 });
      if (ww > 18) line(wx + ww / 2, y, wx + ww / 2, y + h, { w: 0.8 });
    }
  };

  let bx = 0; let bw = 0; let topY = G;

  if (category === "residencial") {
    const floors = r() < 0.55 ? 2 : 1;
    bw = between(170, 230);
    bx = between(70, W - bw - 60);
    const fh = 50;
    topY = G - floors * fh;
    rect(bx, G - fh, bw, fh, { f: fill });
    // porta e pano de vidro
    const doorX = bx + between(18, 40);
    rect(doorX, G - 38, 20, 38, { w: 1.1 });
    const gx = doorX + 34;
    const gw = Math.min(bx + bw - gx - 14, between(70, 110));
    rect(gx, G - 40, gw, 32, { f: glass, w: 1 });
    for (let i = 1; i < 4; i++) line(gx + (gw / 4) * i, G - 40, gx + (gw / 4) * i, G - 8, { w: 0.7 });
    if (floors === 2) {
      const shift = pick([-28, -14, 16, 30]);
      const uw = bw * between(0.62, 0.86);
      const ux = Math.max(30, Math.min(W - uw - 30, bx + (shift > 0 ? bw - uw + shift : shift)));
      rect(ux, G - 2 * fh, uw, fh, { f: fill });
      line(ux - 4, G - fh, ux + uw + 4, G - fh, { w: 2.2 });
      // brise / ripado
      const slatX = ux + uw * between(0.5, 0.62);
      for (let x = slatX; x < ux + uw - 8; x += 6) line(x, G - 2 * fh + 10, x, G - fh - 8, { w: 0.8 });
      windowRow(ux + 6, G - 2 * fh + 12, slatX - ux - 14, 24, 2, 8);
      line(ux - 6, G - 2 * fh, ux + uw + 6, G - 2 * fh, { w: 3 });
      topY = G - 2 * fh;
    } else {
      if (r() < 0.5) poly([[bx - 10, G - fh], [bx + bw + 10, G - fh - 22]], { c: ink });
      else line(bx - 8, G - fh, bx + bw + 8, G - fh, { w: 3 });
    }
    // muro e vegetação estilizada
    line(30, G - 14, bx - 6, G - 14, { w: 1 });
    shapes.push(<circle key={k} cx={bx + bw + 30} cy={G - 26} r={16} stroke={ink} strokeWidth={1} fill="none" strokeDasharray={dash} style={d()} {...drawProps} />);
    line(bx + bw + 30, G - 10, bx + bw + 30, G, { w: 1 });
  }

  if (category === "comercial") {
    const floors = Math.floor(between(5, 8));
    const fh = Math.min(24, (G - 46) / (floors + 1));
    const groundH = fh + 8;
    bw = between(140, 180);
    bx = between(80, W - bw - 90);
    topY = G - groundH - (floors - 1) * fh;
    const cols = Math.floor(between(4, 7));
    const unfinishedFrom = building ? floors - Math.floor(between(2, 4)) : floors + 1;
    for (let f = 1; f < floors; f++) {
      const y = G - groundH - f * fh;
      const unfinished = f >= unfinishedFrom;
      if (unfinished) {
        line(bx, y, bx + bw, y, { w: 2.2, c: accent });
        for (let c = 0; c <= cols; c++) line(bx + (bw / cols) * c, y, bx + (bw / cols) * c, y + fh, { w: 1, dashed: true });
      } else {
        rect(bx, y, bw, fh, { f: fill, w: 1.1 });
        windowRow(bx, y + 5, bw, fh - 10, cols, 4);
      }
    }
    rect(bx, G - groundH, bw, groundH, { f: fill });
    windowRow(bx, G - groundH + 6, bw, groundH - 6, 4, 6);
    line(bx - 10, G - groundH, bx + bw + 10, G - groundH, { w: 2.4 }); // marquise
    if (!building) {
      rect(bx + bw * 0.6, topY - 14, bw * 0.28, 14, { w: 1 }); // casa de máquinas
      line(bx, topY, bx + bw, topY, { w: 2.6 });
    }
    // bloco anexo baixo
    const aw = between(50, 70);
    rect(bx + bw, G - 54, aw, 54, { f: fill, w: 1.1 });
    windowRow(bx + bw, G - 44, aw, 18, 2, 6);
  }

  if (category === "industrial") {
    bw = between(240, 290);
    bx = (W - bw) / 2 + between(-20, 10);
    const wallH = between(58, 70);
    const top = G - wallH;
    rect(bx, top, bw, wallH, { f: fill });
    const saw = r() < 0.45;
    if (saw) {
      const teeth = Math.floor(between(3, 5));
      const tw = bw / teeth;
      const pts: [number, number][] = [];
      for (let i = 0; i < teeth; i++) {
        pts.push([bx + i * tw, top], [bx + i * tw, top - 20], [bx + (i + 1) * tw, top]);
      }
      poly(pts);
      topY = top - 20;
    } else {
      poly([[bx - 6, top], [bx + bw / 2, top - 22], [bx + bw + 6, top]]);
      topY = top - 22;
    }
    const docks = Math.floor(between(3, 6));
    const dw = 26;
    const startX = bx + bw - docks * (dw + 10) - 10;
    for (let i = 0; i < docks; i++) {
      const x = startX + i * (dw + 10);
      rect(x, G - 34, dw, 34, { w: 1 });
      for (let y = G - 30; y < G; y += 5) line(x + 2, y, x + dw - 2, y, { w: 0.5 });
    }
    // escritório anexo
    rect(bx + 10, G - 44, startX - bx - 26, 44, { w: 1.1 });
    windowRow(bx + 10, G - 34, startX - bx - 26, 16, 3, 6);
    for (let x = bx + 40; x < bx + bw; x += 40) line(x, top, x, top + 8, { w: 0.8 });
  }

  if (category === "reforma") {
    const floors = Math.floor(between(3, 5));
    const fh = 34;
    bw = between(150, 190);
    bx = between(80, W - bw - 80);
    topY = G - floors * fh;
    for (let f = 0; f < floors; f++) {
      const y = G - (f + 1) * fh;
      rect(bx, y, bw, fh, { f: fill, w: 1.1 });
      windowRow(bx, y + 8, bw, fh - 16, 3, 12);
    }
    line(bx - 6, topY, bx + bw + 6, topY, { w: 2.6 });
    // andaime em destaque
    const sx = bx - 10;
    const sw2 = bw * between(0.5, 0.75);
    for (let x = sx; x <= sx + sw2; x += 22) line(x, topY - 6, x, G, { c: accent, w: 1 });
    for (let y = G - 18; y > topY - 4; y -= 22) line(sx, y, sx + sw2, y, { c: accent, w: 1 });
    for (let x = sx, i = 0; x + 22 <= sx + sw2; x += 22, i++) {
      const y1 = G - 18 - (i % 3) * 22;
      line(x, y1, x + 22, y1 - 22, { c: accent, w: 0.8 });
    }
  }

  // Grua para obras em andamento
  if (building) {
    const mx = category === "comercial" ? bx + bw + between(70, 90) : Math.min(W - 34, bx + bw + between(16, 30));
    const mastTop = 34;
    line(mx, G, mx, mastTop, { c: accent, w: 1.2 });
    line(mx + 7, G, mx + 7, mastTop, { c: accent, w: 1.2 });
    for (let y = G; y > mastTop + 8; y -= 12) line(mx, y, mx + 7, y - 12, { c: accent, w: 0.7 });
    const jibL = Math.min(mx - 40, between(150, 200));
    line(mx - jibL, mastTop, mx + 52, mastTop, { c: accent, w: 1.4 });
    line(mx - jibL, mastTop + 6, mx + 7, mastTop + 6, { c: accent, w: 0.8 });
    poly([[mx - jibL, mastTop + 6], [mx + 3, mastTop - 18], [mx + 52, mastTop]], { c: accent });
    rect(mx + 34, mastTop + 1, 16, 10, { c: accent, f: accent, w: 1 });
    const hookX = mx - jibL * between(0.35, 0.7);
    line(hookX, mastTop + 6, hookX, Math.min(topY - 10, mastTop + 70), { c: accent, w: 0.8 });
  }

  // Estacas de locação para lançamentos
  if (planned) {
    for (const x of [bx - 14, bx + bw + 14]) {
      line(x, G - 16, x, G + 6, { c: accent, w: 1.6 });
    }
  }

  // Terreno com hachura
  line(14, G, W - 14, G, { w: 1.8 });
  for (let x = 20; x < W - 14; x += 9) line(x, G + 2, x - 6, G + 8, { w: 0.6, c: faint });

  // Cota da fachada
  const dy = G + 22;
  line(bx, dy, bx + bw, dy, { w: 0.8 });
  line(bx, dy - 5, bx, dy + 5, { w: 0.8 });
  line(bx + bw, dy - 5, bx + bw, dy + 5, { w: 0.8 });
  line(bx - 3, dy + 3, bx + 3, dy - 3, { w: 1 });
  line(bx + bw - 3, dy + 3, bx + bw + 3, dy - 3, { w: 1 });

  // Nível
  const ly = topY;
  const lx = 22;
  poly([[lx, ly], [lx + 6, ly - 6], [lx - 6, ly - 6]], { close: true, c: ink });
  line(lx + 10, ly, bx - 6, ly, { w: 0.6, dashed: true, c: faint });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={width}
      height={height}
      role="img"
      aria-label={label ?? "Desenho técnico ilustrativo da fachada"}
      className={className}
      preserveAspectRatio={`xMidYMid ${fit}`}
    >
      {/* grade fina */}
      <g stroke={faint} strokeWidth={0.5}>
        {Array.from({ length: Math.ceil(W / 20) }, (_, i) => <line key={`gx${i}`} x1={i * 20} y1={0} x2={i * 20} y2={H} />)}
        {Array.from({ length: Math.ceil(H / 20) }, (_, i) => <line key={`gy${i}`} x1={0} y1={i * 20} x2={W} y2={i * 20} />)}
      </g>
      <g fill="none" strokeLinecap="square">{shapes}</g>
      <text x={bx + bw / 2} y={dy - 6} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={8} fill={ink} opacity={0.75} letterSpacing={1}>
        FACHADA
      </text>
      <text x={lx + 10} y={ly - 4} fontFamily="IBM Plex Mono, monospace" fontSize={7} fill={ink} opacity={0.6}>
        {`+${((G - topY) / 16).toFixed(2).replace(".", ",")}`}
      </text>
    </svg>
  );
});
