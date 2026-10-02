/**
 * Maquete 3D do simulador — estética de maquete arquitetônica: base giratória, terreno,
 * volumes claros com detalhes (portas, janelas, telhados, brises), sombras suaves.
 *
 * Tudo responde às escolhas do visitante:
 *  - tipo de obra e padrão de acabamento mudam a arquitetura;
 *  - área muda o tamanho e o número de pavimentos;
 *  - itens adicionais aparecem na maquete (paisagismo → jardim e árvores; terraplenagem →
 *    terreno em camadas e muro de arrimo; projeto → cotas e linhas de projeto).
 *
 * Trocar tipo/padrão faz a obra "crescer" do chão; ligar um adicional anima só aquele item.
 * Arraste para girar; parada, a maquete gira devagar.
 */
import {
  BoxGeometry, BufferGeometry, CylinderGeometry, DirectionalLight, EdgesGeometry, ExtrudeGeometry, Float32BufferAttribute,
  Group, HemisphereLight, IcosahedronGeometry, LineBasicMaterial, LineDashedMaterial, LineSegments, Mesh,
  MeshStandardMaterial, Shape, SphereGeometry, type Material, type Object3D,
} from "three";
import type { Category, Standard } from "@/lib/types";
import { curveFns } from "@/motion/tokens";
import { massing, type Feature } from "./massing";
import { createStage, damp, disposeTree } from "./stage";

export interface ModelProps { category: Category; standard: Standard; area: number; features: Feature[] }
export interface ModelOptions { reducedMotion: boolean; onReady?: () => void }

type Tag = "base" | "building" | Feature;
interface Part { obj: Object3D; delay: number; tag: Tag; mode: "grow" | "pop"; animate: boolean }

/* ------------------------------ Materiais ------------------------------ */
const std = (color: string, roughness = 0.85, extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}) =>
  new MeshStandardMaterial({ color, roughness, ...extra });

const M = {
  wall: std("#f4f0e8", 0.9),
  wallWarm: std("#e9e1d3", 0.9),
  trim: std("#d9d1c3", 0.85),
  old: std("#c4bba9", 0.95),
  concrete: std("#bfb8ab", 0.95),
  roof: std("#4b5059", 0.7),
  metal: std("#cfd3d8", 0.55, { metalness: 0.35 }),
  dark: std("#2f3237", 0.75),
  glass: std("#2c4656", 0.12, { metalness: 0.55, emissive: "#0f1d26", emissiveIntensity: 0.6 }),
  glassWarm: std("#3a4f5c", 0.15, { metalness: 0.5, emissive: "#ffb46b", emissiveIntensity: 0.18 }),
  wood: std("#b07d52", 0.8),
  door: std("#6b4a33", 0.7),
  accent: std("#e8642c", 0.55, { metalness: 0.15 }),
  sand: std("#dcd2c1", 1),
  grass: std("#7d9b57", 1),
  grassDark: std("#5f7d43", 1),
  leaf: std("#6f9150", 0.9, { flatShading: true }),
  leaf2: std("#88a95f", 0.9, { flatShading: true }),
  trunk: std("#7a5a3e", 0.9),
  earth1: std("#a07c56", 1),
  earth2: std("#8a6747", 1),
  earth3: std("#6e523a", 1),
  stone: std("#cfc6b6", 0.95),
  water: std("#56b6d6", 0.08, { metalness: 0.2, emissive: "#1d5d73", emissiveIntensity: 0.35 }),
  base: std("#1f2125", 0.6),
  person: std("#e8642c", 0.6),
};
const edge = new LineBasicMaterial({ color: "#17181a", transparent: true, opacity: 0.18 });
const cota = new LineBasicMaterial({ color: "#e8642c" });
const dashed = new LineDashedMaterial({ color: "#e8642c", dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.9 });

/* ------------------------------ Peças ------------------------------ */
/** Caixa com origem na base (cresce de baixo para cima), sombras e contorno leve. */
function box(w: number, h: number, d: number, mat: Material, x = 0, y = 0, z = 0, edges = true) {
  const g = new Group();
  const geo = new BoxGeometry(Math.max(w, 0.01), Math.max(h, 0.01), Math.max(d, 0.01)).translate(0, h / 2, 0);
  const m = new Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  if (edges) g.add(new LineSegments(new EdgesGeometry(geo), edge));
  g.position.set(x, y, z);
  return g;
}

/** Telhado de duas águas: cumeeira ao longo de x. */
function gableRoof(w: number, rise: number, d: number, mat: Material, y: number, x = 0, z = 0) {
  const s = new Shape();
  s.moveTo(-d / 2, 0);
  s.lineTo(d / 2, 0);
  s.lineTo(0, rise);
  s.closePath();
  const geo = new ExtrudeGeometry(s, { depth: w, bevelEnabled: false }).translate(0, 0, -w / 2).rotateY(Math.PI / 2);
  const g = new Group();
  const m = new Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m, new LineSegments(new EdgesGeometry(geo), edge));
  g.position.set(x, y, z);
  return g;
}

function tree(x: number, z: number, s: number, alt = false) {
  const g = new Group();
  const trunk = new Mesh(new CylinderGeometry(0.12 * s, 0.16 * s, 1.6 * s, 6).translate(0, 0.8 * s, 0), M.trunk);
  const crown = new Mesh(new IcosahedronGeometry(1.15 * s, 0).translate(0, 2.35 * s, 0), alt ? M.leaf2 : M.leaf);
  const top = new Mesh(new IcosahedronGeometry(0.75 * s, 0).translate(0.25 * s, 3.1 * s, -0.1 * s), alt ? M.leaf : M.leaf2);
  for (const m of [trunk, crown, top]) { m.castShadow = true; m.receiveShadow = true; }
  g.add(trunk, crown, top);
  g.position.set(x, 0, z);
  g.rotation.y = x * 1.7 + z;
  return g;
}

function lines(points: number[], mat: LineBasicMaterial | LineDashedMaterial) {
  const l = new LineSegments(new BufferGeometry().setAttribute("position", new Float32BufferAttribute(points, 3)), mat);
  if (mat instanceof LineDashedMaterial) l.computeLineDistances();
  return l;
}

/** Fileira de janelas (vidro) numa fachada voltada para +z. */
function windowRow(parts: (o: Object3D, d: number) => void, x0: number, x1: number, y: number, h: number, z: number, n: number, mat: Material, delay: number) {
  const span = x1 - x0;
  const ww = (span / n) * 0.62;
  for (let i = 0; i < n; i++) {
    const x = x0 + (span / n) * (i + 0.5);
    parts(box(ww, h, 0.12, mat, x, y, z, false), delay + i * 0.02);
  }
}

/* ------------------------------ Montagem ------------------------------ */
function build(p: ModelProps) {
  const root = new Group();
  const parts: Part[] = [];
  const has = (f: Feature) => p.features.includes(f);
  const add = (tag: Tag, mode: Part["mode"] = "grow") => (obj: Object3D, delay: number) => {
    root.add(obj);
    parts.push({ obj, delay, tag, mode, animate: true });
  };
  const B = add("building");

  const m = massing(p.category, p.standard, p.area);
  const { width: w, depth: d, floorH: fh, floors } = m;
  let top = m.height;

  // Terreno: margem proporcional, maior com paisagismo (jardim na frente)
  const margin = Math.max(3.2, Math.min(w, d) * 0.45);
  const lotW = w + margin * 2;
  const lotD = d + margin * 2 + (has("landscape") ? margin * 0.6 : 0);
  const lotZ = has("landscape") ? margin * 0.3 : 0; // empurra o terreno para a frente (+z)
  const unit = Math.max(1, Math.min(lotW, lotD) / 18); // escala de detalhes (árvores, cotas)

  /* ---------- Terreno / base ---------- */
  const lotH = has("earthwork") ? 1.6 * unit : 0.3 * unit;
  if (has("earthwork")) {
    const E = add("earthwork");
    // camadas de solo visíveis nas laterais
    E(box(lotW, lotH * 0.34, lotD, M.earth3, 0, -lotH, lotZ, false), 0);
    E(box(lotW * 0.998, lotH * 0.33, lotD * 0.998, M.earth2, 0, -lotH * 0.66, lotZ, false), 0.06);
    E(box(lotW * 0.996, lotH * 0.33, lotD * 0.996, M.earth1, 0, -lotH * 0.33, lotZ, false), 0.12);
    // muro de arrimo no fundo do lote
    E(box(lotW, 1.4 * unit, 0.35 * unit, M.concrete, 0, 0, lotZ - lotD / 2 + 0.18 * unit), 0.2);
    // estacas de fundação aparentes ao redor da obra
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      E(box(0.4 * unit, 0.5 * unit, 0.4 * unit, M.concrete, sx * (w / 2 + 0.4 * unit), 0, sz * (d / 2 + 0.4 * unit)), 0.25);
    }
  } else {
    add("base")(box(lotW, lotH, lotD, M.trim, 0, -lotH, lotZ, false), 0);
  }
  add(has("landscape") ? "landscape" : "base")(
    box(lotW * 0.985, 0.04 * unit, lotD * 0.985, has("landscape") ? M.grass : M.sand, 0, 0, lotZ, false), 0.02);

  // Base giratória (pódio) com aro laranja
  const radius = Math.hypot(lotW, lotD) / 2 + 1.5 * unit;
  const podium = new Mesh(new CylinderGeometry(radius, radius * 1.02, 0.9 * unit, 64).translate(0, -lotH - 0.45 * unit, lotZ), M.base);
  podium.receiveShadow = true;
  // aro laranja: um pouco maior e logo abaixo do topo do pódio — só a borda fina aparece
  const ring = new Mesh(new CylinderGeometry(radius * 1.012, radius * 1.012, 0.08 * unit, 64).translate(0, -lotH - 0.08 * unit, lotZ), M.accent);
  root.add(podium, ring);

  /* ---------- Arquitetura ---------- */
  const fz = d / 2; // fachada principal
  if (p.category === "residencial") {
    if (p.standard === "economico") {
      B(box(w, fh * floors, d, M.wall), 0);
      for (let f = 0; f < floors; f++) windowRow(B, -w / 2 + w * 0.32, w / 2 - 0.6, f * fh + fh * 0.35, fh * 0.42, fz + 0.04, Math.max(1, Math.round(w / 4)), M.glass, 0.15 + f * 0.08);
      B(box(1.1, 2.2, 0.14, M.door, -w / 2 + w * 0.18, 0, fz + 0.05, false), 0.2);
      const rise = Math.min(3.2, Math.max(1.6, d * 0.32));
      B(gableRoof(w + 1, rise, d + 1, M.roof, fh * floors), 0.3);
      B(box(w * 0.32, 0.18, 1.6, M.trim, -w / 2 + w * 0.18, 2.6, fz + 0.8), 0.32);
      top += rise;
    } else if (p.standard === "medio") {
      const lw = w * 0.62;
      B(box(lw, fh, d, M.wall, -w / 2 + lw / 2), 0);
      B(box(w - lw, fh, d * 0.78, M.wallWarm, w / 2 - (w - lw) / 2, 0, -d * 0.11), 0.06);
      B(box(lw * 0.62, fh * 0.78, 0.14, M.glass, -w / 2 + lw * 0.42, 0.25, fz + 0.04, false), 0.18);
      B(box(1.1, 2.3, 0.14, M.door, w / 2 - (w - lw) / 2, 0, fz - d * 0.22 + 0.05, false), 0.2);
      if (floors > 1) {
        const uw = w * 0.74;
        B(box(uw, fh, d * 0.92, M.wall, w * 0.08, fh, -d * 0.04), 0.25);
        windowRow(B, w * 0.08 - uw / 2 + 0.6, w * 0.08 + uw * 0.1, fh * 1.3, fh * 0.5, fz - d * 0.08 + 0.04, 2, M.glass, 0.35);
        // brise de madeira
        const bx0 = w * 0.08 + uw * 0.18;
        const n = Math.max(5, Math.round((uw * 0.3) / 0.35));
        for (let i = 0; i < n; i++) B(box(0.12, fh * 0.8, 0.22, M.wood, bx0 + i * ((uw * 0.3) / n), fh * 1.1, fz - d * 0.08 + 0.12, false), 0.4 + i * 0.01);
      }
      B(box(w + 0.8, 0.28, d + 0.8, M.trim, 0, fh * floors, 0), 0.45);
      // garagem coberta
      B(box(4.2, 0.22, 5.2, M.trim, -w / 2 - 2.4, 2.7, fz - 2.3), 0.5);
      for (const z of [fz - 4.6, fz]) B(box(0.18, 2.7, 0.18, M.dark, -w / 2 - 4.2, 0, z), 0.48);
    } else {
      // alto padrão: térreo envidraçado recuado, volume superior em balanço com madeira
      B(box(w * 0.3, fh, d * 0.9, M.wall, -w / 2 + w * 0.15), 0);
      B(box(w * 0.66, fh * 0.92, d * 0.8, M.glassWarm, w * 0.15, 0, -d * 0.04), 0.06);
      const upper = floors > 1 ? fh : 0;
      if (upper) {
        B(box(w, fh, d, M.wall, 0, fh, 1.2), 0.25);
        B(box(w * 0.42, fh * 0.98, 0.14, M.wood, -w * 0.29, fh, fz + 1.27, false), 0.35);
        B(box(w * 0.5, fh * 0.55, 0.14, M.glass, w * 0.2, fh * 1.25, fz + 1.27, false), 0.37);
      }
      B(box(w + 1.4, 0.3, d + 1.6, M.trim, 0, fh * Math.max(1, floors), upper ? 0.9 : 0.3), 0.45);
      // piscina com deck e pergolado
      const pw = Math.min(10, w * 0.6);
      const pd = Math.min(4, Math.max(2.5, d * 0.32));
      const pz = fz + 2.2 + pd / 2;
      B(box(pw + 3, 0.12, pd + 1.6, M.wood, w * 0.1, 0, pz), 0.5);
      B(box(pw, 0.16, pd, M.water, w * 0.1, 0.02, pz, false), 0.55);
      B(box(3.4, 0.14, 3.2, M.wood, w / 2 + 2.2, 2.7, fz - 1), 0.6);
      for (const [sx, sz] of [[0, 0], [3, 0], [0, -3], [3, -3]]) B(box(0.14, 2.7, 0.14, M.wood, w / 2 + 0.7 + sx, 0, fz + 0.5 + sz), 0.58);
    }
  } else if (p.category === "comercial") {
    const podiumH = fh * 1.3;
    B(box(w * 0.94, podiumH - 0.3, d * 0.94, M.glassWarm), 0);
    B(box(w + 0.3, 0.3, d + 0.3, M.trim, 0, podiumH - 0.3, 0), 0.05);
    B(box(w * 0.4, 0.22, 2.2, M.dark, 0, podiumH * 0.62, fz + 1.1), 0.1); // marquise
    for (let i = 1; i < floors; i++) {
      const y = podiumH + (i - 1) * fh;
      const glass = p.standard === "economico" ? M.wall : M.glass;
      B(box(w * 0.96, fh - 0.3, d * 0.96, glass, 0, y), i * 0.06);
      if (p.standard === "economico") windowRow(B, -w / 2 + 0.5, w / 2 - 0.5, y + fh * 0.25, fh * 0.45, fz * 0.96 + 0.04, Math.max(2, Math.round(w / 3)), M.glass, i * 0.06 + 0.02);
      B(box(w + 0.25, 0.3, d + 0.25, M.trim, 0, y + fh - 0.3, 0), i * 0.06 + 0.03);
    }
    top = podiumH + Math.max(0, floors - 1) * fh;
    if (p.standard !== "economico" && floors > 1) {
      const n = Math.max(4, Math.round(w / 2));
      const mat = p.standard === "alto" ? M.accent : M.trim;
      for (let k = 0; k <= n; k++) B(box(0.18, top - podiumH, 0.5, mat, -w / 2 + (w / n) * k, podiumH, fz + 0.2, false), 0.5 + k * 0.01);
    }
    B(box(w * 0.36, 2, d * 0.36, M.dark, 0, top, 0), 0.6);
    top += 2;
  } else if (p.category === "industrial") {
    B(box(w, fh, d, M.metal), 0);
    const ribs = Math.min(40, Math.round(w / 1.5));
    for (let i = 1; i < ribs; i++) B(box(0.08, fh, 0.08, M.trim, -w / 2 + (w / ribs) * i, 0, fz + 0.04, false), 0.08);
    const rise = Math.max(1.2, d * 0.09);
    B(gableRoof(w + 0.6, rise, d + 0.8, M.roof, fh), 0.2);
    top += rise;
    const docks = Math.max(2, Math.min(10, Math.round(w / 9)));
    for (let k = 0; k < docks; k++) {
      const x = -w / 2 + (w / (docks + 1)) * (k + 1);
      const dw = Math.min(4, w / (docks + 2));
      B(box(dw, Math.min(4.6, fh * 0.6), 0.16, M.dark, x, 0, fz + 0.05, false), 0.28 + k * 0.03);
      B(box(dw * 1.2, 0.16, 2.4, M.accent, x, Math.min(4.6, fh * 0.6) + 0.3, fz + 1.2), 0.32 + k * 0.03);
    }
    if (p.standard !== "economico") {
      for (const sz of [-0.22, 0.22]) B(box(w * 0.8, 0.25, Math.max(0.6, d * 0.05), M.glass, 0, fh + rise * 0.48, sz * d, false), 0.45);
      B(box(Math.min(14, w * 0.25), 6.6, 6, M.glass, -w / 2 + Math.min(14, w * 0.25) / 2, 0, fz + 3), 0.5); // escritório
      B(box(Math.min(14, w * 0.25) + 0.4, 0.3, 6.4, M.trim, -w / 2 + Math.min(14, w * 0.25) / 2, 6.6, fz + 3), 0.52);
    }
  } else {
    // reforma: prédio existente + andaime + trechos renovados
    for (let i = 0; i < floors; i++) {
      const renewed = i === floors - 1 || (p.standard === "alto" && i >= floors - 2);
      B(box(w, fh, d, renewed ? M.wall : M.old, 0, i * fh), i * 0.06);
      windowRow(B, -w / 2 + 0.6, w / 2 - 0.6, i * fh + fh * 0.3, fh * 0.45, fz + 0.04, Math.max(2, Math.round(w / 3)), renewed ? M.glass : M.dark, i * 0.06 + 0.03);
    }
    B(box(w + 0.6, 0.3, d + 0.6, M.trim, 0, top, 0), floors * 0.06);
    const sz = fz + 1;
    const cols = Math.max(2, Math.round(w / 2.2));
    const pts: number[] = [];
    for (let k = 0; k <= cols; k++) { const x = -w / 2 + (w / cols) * k; pts.push(x, 0, sz, x, top + 1, sz); }
    for (let i = 0; i <= floors; i++) pts.push(-w / 2, i * fh, sz, w / 2, i * fh, sz);
    for (let i = 0; i < floors; i++) for (let k = 0; k < cols; k++) {
      const x1 = -w / 2 + (w / cols) * k;
      const x2 = x1 + w / cols;
      if ((i + k) % 2) pts.push(x1, i * fh, sz, x2, (i + 1) * fh, sz); else pts.push(x2, i * fh, sz, x1, (i + 1) * fh, sz);
    }
    const sc = new Group();
    sc.add(lines(pts, cota));
    B(sc, floors * 0.06 + 0.1);
  }

  // Pessoa em escala (1,75 m)
  const person = new Group();
  const body = new Mesh(new CylinderGeometry(0.2, 0.22, 1.3, 10).translate(0, 0.65, 0), M.person);
  const head = new Mesh(new SphereGeometry(0.16, 12, 8).translate(0, 1.55, 0), M.person);
  body.castShadow = true;
  person.add(body, head);
  person.position.set(-w / 2 - 1.4, 0, fz + 1.6);
  add("building", "pop")(person, 0.1);

  /* ---------- Paisagismo ---------- */
  if (has("landscape")) {
    const L = add("landscape", "pop");
    const ts = Math.max(1, unit * 0.9);
    const front = lotZ + lotD / 2;
    const spots: [number, number][] = [
      [-lotW / 2 + margin * 0.45, front - margin * 0.5], [lotW / 2 - margin * 0.45, front - margin * 0.55],
      [-lotW / 2 + margin * 0.4, -d / 2 - margin * 0.45], [lotW / 2 - margin * 0.4, -d / 2 - margin * 0.4],
      [-lotW / 2 + margin * 0.45, 0], [lotW / 2 - margin * 0.4, d * 0.1],
      [w * 0.15, front - margin * 0.35],
    ];
    spots.forEach(([x, z], i) => L(tree(x, z, ts * (0.85 + ((i * 37) % 10) / 30), i % 2 === 1), 0.05 + i * 0.06));
    // cerca viva na frente e caminho de pedras até a entrada
    L(box(lotW * 0.42, 0.9 * unit * 0.6, 0.7 * unit * 0.6, M.grassDark, -lotW * 0.27, 0, front - 0.6 * unit), 0.1);
    L(box(lotW * 0.3, 0.9 * unit * 0.6, 0.7 * unit * 0.6, M.grassDark, lotW * 0.33, 0, front - 0.6 * unit), 0.12);
    const steps = 5;
    for (let i = 0; i < steps; i++) {
      const z = fz + 0.9 + ((front - fz - 1.2) / steps) * i;
      L(box(1.4, 0.08, 0.7, M.stone, w * 0.04 + (i % 2 ? 0.25 : -0.25), 0.03, z, false), 0.2 + i * 0.04);
    }
  }

  /* ---------- Projeto: cotas e linhas de projeto ---------- */
  if (has("design")) {
    const D = add("design", "pop");
    const off = 1.4 * unit;
    const t = 0.35 * unit;
    const y = 0.08;
    const zc = d / 2 + off;
    const xc = w / 2 + off;
    const pts = [
      -w / 2, y, zc, w / 2, y, zc, -w / 2, y, zc - t, -w / 2, y, zc + t, w / 2, y, zc - t, w / 2, y, zc + t,
      xc, y, -d / 2, xc, y, d / 2, xc - t, y, -d / 2, xc + t, y, -d / 2, xc - t, y, d / 2, xc + t, y, d / 2,
      // altura
      w / 2 + off, 0, -d / 2 - off * 0.2, w / 2 + off, top, -d / 2 - off * 0.2,
      w / 2 + off - t, top, -d / 2 - off * 0.2, w / 2 + off + t, top, -d / 2 - off * 0.2,
    ];
    const g = new Group();
    g.add(lines(pts, cota));
    D(g, 0.05);
    // contorno tracejado do recuo e eixos
    const r = 0.8 * unit;
    const g2 = new Group();
    g2.add(lines([
      -w / 2 - r, y, -d / 2 - r, w / 2 + r, y, -d / 2 - r, w / 2 + r, y, -d / 2 - r, w / 2 + r, y, d / 2 + r,
      w / 2 + r, y, d / 2 + r, -w / 2 - r, y, d / 2 + r, -w / 2 - r, y, d / 2 + r, -w / 2 - r, y, -d / 2 - r,
      0, y, -d / 2 - r * 2.5, 0, y, d / 2 + r * 2.5, -w / 2 - r * 2.5, y, 0, w / 2 + r * 2.5, y, 0,
    ], dashed));
    D(g2, 0.12);
  }

  const span = Math.max(lotW, lotD, top * 1.25) + 3 * unit;
  return { root, parts, span, top, lotZ, lotH, unit };
}

/* ------------------------------ Cena ------------------------------ */
export default function createModelScene(canvas: HTMLCanvasElement, opts: ModelOptions) {
  const still = opts.reducedMotion;
  const stage = createStage({ canvas, fov: 30, still, mobileShadows: true, minPixelRatio: 1.25, onFrame: frame });
  const { scene, camera, renderer } = stage;
  renderer.toneMappingExposure = 1.12;

  scene.add(new HemisphereLight("#fff6ea", "#2a2622", 1.15));
  const sun = new DirectionalLight("#fff1dc", 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const fill = new DirectionalLight("#9fb6d6", 0.55);
  scene.add(fill);

  let current: (ReturnType<typeof build> & { born: number }) | null = null;
  let clock = 0;
  let kindKey = "";
  let featKey = "";
  const view = { az: 0.75, dist: 40, ty: 3, goalDist: 40, goalTy: 3, el: 0.52 };
  let drag: { x: number; az: number } | null = null;
  let vel = 0;
  let idle = 0;
  let ready = false;

  function setProps(p: ModelProps, animate: "all" | Set<Tag> | null) {
    if (current) { scene.remove(current.root); disposeTree(current.root, { materials: false }); }
    const b = build(p);
    for (const part of b.parts) {
      part.animate = !still && (animate === "all" || (animate instanceof Set && animate.has(part.tag)));
      if (animate instanceof Set && part.animate) part.delay = Math.max(0, part.delay - 0.02);
    }
    scene.add(b.root);
    current = { ...b, born: clock };
    const tall = b.top > b.span * 0.55; // torres: enquadra pela altura
    const fit = (b.span / 2 / Math.tan((camera.fov * Math.PI) / 360)) * (camera.aspect < 1.2 ? 1.28 : camera.aspect > 1.9 ? 1.12 : 0.98) * (tall ? 1.18 : 1);
    view.goalDist = fit + b.span * 0.12;
    view.goalTy = Math.max(0, b.top * (tall ? 0.42 : 0.3));
    // obras grandes (galpões de milhares de m²) ficam longe: o plano de corte acompanha
    camera.near = Math.max(0.1, view.goalDist / 400);
    camera.far = Math.max(200, view.goalDist * 3 + b.span * 2);
    camera.updateProjectionMatrix();
    const s = b.span;
    sun.position.set(s * 0.55, s * 1.15, s * 0.75 + b.lotZ);
    sun.target.position.set(0, 0, b.lotZ);
    fill.position.set(-s * 0.8, s * 0.5, -s * 0.6);
    Object.assign(sun.shadow.camera, { left: -s * 0.75, right: s * 0.75, top: s * 0.75, bottom: -s * 0.75, near: 0.5, far: s * 4 });
    sun.shadow.camera.updateProjectionMatrix();
    if (!ready || still) { view.dist = view.goalDist; view.ty = view.goalTy; }
    stage.requestRender();
  }

  function frame(_t: number, dt: number) {
    clock += dt;
    if (current) {
      for (const part of current.parts) {
        const pr = part.animate ? Math.min(1, Math.max(0, (clock - current.born - part.delay) / 0.7)) : 1;
        const e = Math.max(0.0001, curveFns.easeOutBack(pr));
        if (part.mode === "pop") part.obj.scale.setScalar(e);
        else part.obj.scale.y = e;
        part.obj.visible = pr > 0;
      }
    }
    idle += dt;
    if (!drag && !still) {
      vel = idle > 1.5 ? damp(vel, 0.2, 1.5, dt) : damp(vel, 0, 3, dt);
      view.az += vel * dt;
    }
    view.dist = damp(view.dist, view.goalDist, 4, dt || 1);
    view.ty = damp(view.ty, view.goalTy, 4, dt || 1);
    const z0 = current?.lotZ ?? 0;
    camera.position.set(Math.sin(view.az) * Math.cos(view.el) * view.dist, view.ty + Math.sin(view.el) * view.dist, z0 + Math.cos(view.az) * Math.cos(view.el) * view.dist);
    camera.lookAt(0, view.ty, z0);
    if (!ready) { ready = true; queueMicrotask(() => opts.onReady?.()); }
  }

  // Arrastar para girar (horizontal). touch-action: pan-y no canvas mantém a rolagem vertical no celular.
  const onDown = (e: PointerEvent) => { drag = { x: e.clientX, az: view.az }; idle = 0; canvas.setPointerCapture(e.pointerId); };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const az = drag.az - ((e.clientX - drag.x) / canvas.clientWidth) * Math.PI * 1.4;
    vel = Math.max(-4, Math.min(4, (az - view.az) * 30));
    view.az = az;
    idle = 0;
    if (still) stage.requestRender();
  };
  const onUp = () => { drag = null; idle = 0; };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  let pending: ReturnType<typeof setTimeout> | undefined;
  return {
    update(p: ModelProps) {
      const k = `${p.category}|${p.standard}`;
      const f = [...p.features].sort().join(",");
      const prevFeatures = new Set(featKey ? featKey.split(",") : []);
      const kindChanged = k !== kindKey;
      const featChanged = f !== featKey;
      kindKey = k;
      featKey = f;
      clearTimeout(pending);
      if (kindChanged || !current) setProps(p, "all");
      else if (featChanged) setProps(p, new Set(p.features.filter((x) => !prevFeatures.has(x)) as Tag[]));
      else pending = setTimeout(() => setProps(p, null), 50); // só a área mudou: troca instantânea
    },
    dispose() {
      clearTimeout(pending);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      stage.dispose();
    },
  };
}
