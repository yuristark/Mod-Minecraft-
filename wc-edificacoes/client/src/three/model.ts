/**
 * Maquete 3D do simulador: a volumetria muda conforme tipo de obra, padrão e área.
 * Ao trocar tipo/padrão, as peças "crescem" do chão uma após a outra (stagger + easeOutBack).
 * Arraste para girar; parada, a maquete gira devagar sozinha.
 */
import {
  BoxGeometry, BufferGeometry, CylinderGeometry, DirectionalLight, EdgesGeometry, ExtrudeGeometry, Float32BufferAttribute,
  GridHelper, Group, HemisphereLight, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial, PlaneGeometry,
  ShadowMaterial, Shape, SphereGeometry, Vector3, type Material, type Object3D,
} from "three";
import type { Category, Standard } from "@/lib/types";
import { curveFns } from "@/motion/tokens";
import { massing } from "./massing";
import { createStage, damp, disposeTree, PALETTE } from "./stage";

export interface ModelProps { category: Category; standard: Standard; area: number }
export interface ModelOptions { reducedMotion: boolean; onReady?: () => void }

interface Part { obj: Object3D; delay: number }

const mats = {
  wall: new MeshStandardMaterial({ color: "#ebe6dc", roughness: 0.85 }),
  concrete: new MeshStandardMaterial({ color: PALETTE.concrete, roughness: 0.92 }),
  dark: new MeshStandardMaterial({ color: "#3a3d42", roughness: 0.8 }),
  roof: new MeshStandardMaterial({ color: "#5c5f66", roughness: 0.75 }),
  glass: new MeshStandardMaterial({ color: PALETTE.glass, roughness: 0.15, metalness: 0.4, emissive: "#1d2a33", emissiveIntensity: 0.6 }),
  accent: new MeshStandardMaterial({ color: PALETTE.signal, roughness: 0.55, metalness: 0.2 }),
  pool: new MeshStandardMaterial({ color: "#4fa8c4", roughness: 0.1, metalness: 0.1, emissive: "#14495a", emissiveIntensity: 0.5 }),
  wood: new MeshStandardMaterial({ color: "#a2764f", roughness: 0.8 }),
};
const edgeMat = new LineBasicMaterial({ color: PALETTE.ink, transparent: true, opacity: 0.35 });
const accentLine = new LineBasicMaterial({ color: PALETTE.signal });

/** Caixa com origem na base, sombra e contorno. */
function block(w: number, h: number, d: number, mat: Material, x = 0, y = 0, z = 0, edges = true) {
  const g = new Group();
  const geo = new BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const m = new Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  if (edges) g.add(new LineSegments(new EdgesGeometry(geo), edgeMat));
  g.position.set(x, y, z);
  return g;
}

/** Telhado de duas águas ao longo de z. */
function gable(w: number, h: number, d: number, mat: Material, y: number) {
  const s = new Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const geo = new ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2);
  const g = new Group();
  const m = new Mesh(geo, mat);
  m.castShadow = true;
  g.add(m, new LineSegments(new EdgesGeometry(geo), edgeMat));
  g.position.y = y;
  return g;
}

function build(p: ModelProps): { root: Group; parts: Part[]; size: Vector3 } {
  const root = new Group();
  const parts: Part[] = [];
  const add = (obj: Object3D, delay: number) => { root.add(obj); parts.push({ obj, delay }); };
  const m = massing(p.category, p.standard, p.area);
  const { width: w, depth: d, floorH: fh, floors } = m;
  let top = m.height;

  if (p.category === "residencial") {
    for (let i = 0; i < floors; i++) {
      const shrink = i === 0 ? 1 : 0.78;
      const off = i === 0 ? 0 : w * 0.11 * (i % 2 ? 1 : -1);
      add(block(w * shrink, fh, d, mats.wall, off, i * fh, 0), i * 0.18);
      // pano de vidro na fachada
      add(block(w * shrink * 0.42, fh * 0.7, 0.08, mats.glass, off + w * shrink * 0.18, i * fh + fh * 0.12, d / 2 + 0.02, false), i * 0.18 + 0.1);
      if (p.standard !== "economico") add(block(w * shrink + 0.6, 0.25, d + 0.6, mats.concrete, off, (i + 1) * fh - 0.02, 0), i * 0.18 + 0.15);
    }
    if (p.standard === "economico") {
      add(gable(w + 0.8, Math.max(1.6, w * 0.18), d + 0.8, mats.roof, floors * fh), floors * 0.18);
      top += Math.max(1.6, w * 0.18);
    }
    if (p.standard === "alto") {
      add(block(Math.min(8, w * 0.6), 0.3, Math.min(3.5, d * 0.4), mats.pool, -w * 0.05, 0, d / 2 + Math.min(3.5, d * 0.4) / 2 + 1.2, false), floors * 0.18 + 0.1);
      for (let k = 0; k < 6; k++) add(block(0.12, 2.6, 0.12, mats.wood, w / 2 + 1.6 + (k % 2) * 3, 0, -d / 4 + Math.floor(k / 2) * (d / 4)), floors * 0.18 + 0.15 + k * 0.03);
      add(block(3.4, 0.14, d * 0.6, mats.wood, w / 2 + 3.1, 2.6, 0), floors * 0.18 + 0.35);
    }
  } else if (p.category === "comercial") {
    const podium = Math.min(floors, 1);
    for (let i = 0; i < floors; i++) {
      const h = i < podium ? fh * 1.3 : fh;
      const y = i < podium ? 0 : fh * 1.3 + (i - podium) * fh;
      const inset = i < podium ? 0 : 0.35;
      add(block(w - inset, h - 0.28, d - inset, mats.glass, 0, y, 0, false), i * 0.07);
      add(block(w + 0.25 - inset, 0.28, d + 0.25 - inset, mats.concrete, 0, y + h - 0.28, 0), i * 0.07 + 0.04);
      // brises verticais na fachada principal
      if (p.standard !== "economico" && i >= podium) {
        const n = Math.max(3, Math.round(w / 1.6));
        for (let k = 0; k <= n; k++) add(block(0.12, h - 0.28, 0.4, p.standard === "alto" ? mats.accent : mats.concrete, -w / 2 + (w / n) * k, y, d / 2 - inset / 2 + 0.2, false), i * 0.07 + 0.05);
      }
    }
    top = fh * 1.3 + Math.max(0, floors - 1) * fh;
    add(block(w * 0.35, 1.8, d * 0.35, mats.dark, 0, top, 0), floors * 0.07 + 0.1);
    top += 1.8;
  } else if (p.category === "industrial") {
    add(block(w, fh, d, mats.wall, 0, 0, 0), 0);
    const rise = Math.max(1.2, w * 0.08);
    const roof = gable(d + 0.8, rise, w + 0.8, mats.roof, fh);
    roof.rotation.y = Math.PI / 2;
    add(roof, 0.15);
    top += rise;
    const docks = Math.max(2, Math.min(10, Math.round(w / 9)));
    for (let k = 0; k < docks; k++) {
      const x = -w / 2 + (w / (docks + 1)) * (k + 1);
      add(block(Math.min(4, w / (docks + 2)), Math.min(4.5, fh * 0.55), 0.3, mats.dark, x, 0, d / 2 + 0.15, false), 0.25 + k * 0.04);
      add(block(Math.min(4.6, w / (docks + 1.6)), 0.2, 2.4, mats.accent, x, Math.min(4.5, fh * 0.55) + 0.2, d / 2 + 1.2, false), 0.3 + k * 0.04);
    }
    if (p.standard !== "economico") add(block(w * 0.8, 0.2, Math.max(0.6, d * 0.06), mats.glass, 0, fh + rise * 0.98, 0, false), 0.45);
  } else {
    // reforma: prédio existente + andaime e trechos renovados em laranja
    for (let i = 0; i < floors; i++) {
      add(block(w, fh, d, i % 2 ? mats.concrete : mats.wall, 0, i * fh, 0), i * 0.08);
      add(block(w * 0.7, fh * 0.55, 0.08, mats.glass, 0, i * fh + fh * 0.22, d / 2 + 0.02, false), i * 0.08 + 0.05);
    }
    const pts: number[] = [];
    const z = d / 2 + 0.9;
    const cols = Math.max(2, Math.round(w / 2));
    for (let k = 0; k <= cols; k++) { const x = -w / 2 + (w / cols) * k; pts.push(x, 0, z, x, top + 1, z); }
    for (let i = 0; i <= floors; i++) pts.push(-w / 2, i * fh, z, w / 2, i * fh, z);
    for (let i = 0; i < floors; i++) for (let k = 0; k < cols; k++) {
      const x1 = -w / 2 + (w / cols) * k;
      const x2 = x1 + w / cols;
      if ((i + k) % 2) pts.push(x1, i * fh, z, x2, (i + 1) * fh, z); else pts.push(x2, i * fh, z, x1, (i + 1) * fh, z);
    }
    const scaffold = new Group();
    scaffold.add(new LineSegments(new BufferGeometry().setAttribute("position", new Float32BufferAttribute(pts, 3)), accentLine));
    add(scaffold, floors * 0.08 + 0.1);
    add(block(w + 0.4, 0.25, d + 0.4, mats.accent, 0, top, 0), floors * 0.08 + 0.2);
  }

  // figura humana em escala (1,75 m)
  const person = new Group();
  const body = new Mesh(new CylinderGeometry(0.22, 0.22, 1.35, 10).translate(0, 0.68, 0), mats.accent);
  const head = new Mesh(new SphereGeometry(0.17, 12, 8).translate(0, 1.58, 0), mats.accent);
  body.castShadow = true;
  person.add(body, head);
  person.position.set(-w / 2 - 1.6, 0, d / 2 + 1.2);
  add(person, 0.05);

  return { root, parts, size: new Vector3(w + 6, top, d + 6) };
}

export default function createModelScene(canvas: HTMLCanvasElement, opts: ModelOptions) {
  const still = opts.reducedMotion;
  const stage = createStage({ canvas, fov: 30, still, onFrame: frame });
  const { scene, camera } = stage;

  scene.add(new HemisphereLight(PALETTE.paper, PALETTE.ink, 1.25));
  const sun = new DirectionalLight("#fff3e6", 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  const grid = new GridHelper(1, 24, PALETTE.signal, PALETTE.paper);
  (grid.material as LineBasicMaterial).transparent = true;
  (grid.material as LineBasicMaterial).opacity = 0.14;
  scene.add(grid);
  const ground = new Mesh(new PlaneGeometry(1, 1), new ShadowMaterial({ opacity: 0.4 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  let current: { root: Group; parts: Part[]; size: Vector3; born: number } | null = null;
  const leaving: { root: Group; t0: number }[] = [];
  let clock = 0;
  let key = "";
  const view = { az: 0.75, dist: 30, ty: 3, goalDist: 30, goalTy: 3 };
  let drag: { x: number; az: number } | null = null;
  let vel = 0;
  let idle = 0;
  let ready = false;

  function setProps(p: ModelProps, animateIn: boolean) {
    if (current) {
      if (animateIn && !still) leaving.push({ root: current.root, t0: clock });
      else { scene.remove(current.root); disposeTree(current.root, { materials: false }); }
    }
    const b = build(p);
    scene.add(b.root);
    current = { ...b, born: animateIn && !still ? clock : -999 };
    const span = Math.max(b.size.x, b.size.z, b.size.y * 1.15);
    const fit = (span / 2 / Math.tan((camera.fov * Math.PI) / 360)) * (camera.aspect < 1.2 ? 1.3 : 0.95);
    view.goalDist = fit + span * 0.2;
    view.goalTy = b.size.y * 0.42;
    const g = Math.max(20, span * 2.4);
    grid.scale.setScalar(g);
    ground.scale.setScalar(g);
    sun.position.set(span * 0.9, span * 1.5, span * 0.7);
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 0.5, far: span * 5 });
    sun.shadow.camera.updateProjectionMatrix();
    if (!ready || still) { view.dist = view.goalDist; view.ty = view.goalTy; }
    stage.requestRender();
  }

  function frame(_t: number, dt: number) {
    clock += dt;
    if (current) {
      for (const part of current.parts) {
        const p = Math.min(1, Math.max(0, (clock - current.born - part.delay) / 0.75));
        part.obj.scale.y = Math.max(0.0001, curveFns.easeOutBack(p));
        part.obj.visible = p > 0;
      }
    }
    for (let i = leaving.length - 1; i >= 0; i--) {
      const l = leaving[i];
      const p = Math.min(1, (clock - l.t0) / 0.3);
      l.root.scale.set(1 - p * 0.08, Math.max(0.0001, 1 - curveFns.easeInOutCubic(p)), 1 - p * 0.08);
      if (p >= 1) { scene.remove(l.root); disposeTree(l.root, { materials: false }); leaving.splice(i, 1); }
    }

    idle += dt;
    if (!drag && !still) {
      if (idle > 1.5) vel = damp(vel, 0.22, 1.5, dt);
      else vel = damp(vel, 0, 3, dt);
      view.az += vel * dt;
    }
    view.dist = damp(view.dist, view.goalDist, 4, dt);
    view.ty = damp(view.ty, view.goalTy, 4, dt);
    const el = 0.42;
    camera.position.set(Math.sin(view.az) * Math.cos(el) * view.dist, view.ty + Math.sin(el) * view.dist, Math.cos(view.az) * Math.cos(el) * view.dist);
    camera.lookAt(0, view.ty, 0);

    if (!ready) { ready = true; queueMicrotask(() => opts.onReady?.()); }
  }

  // Arrastar para girar (horizontal). touch-action: pan-y no canvas mantém a rolagem vertical no celular.
  const onDown = (e: PointerEvent) => { drag = { x: e.clientX, az: view.az }; idle = 0; canvas.setPointerCapture(e.pointerId); };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const az = drag.az - ((e.clientX - drag.x) / canvas.clientWidth) * Math.PI * 1.4;
    vel = dtSafe((az - view.az) * 30);
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
      const changedKind = k !== key;
      key = k;
      clearTimeout(pending);
      // troca de tipo/padrão: anima; só área (arrastando o controle): troca instantânea, com pequeno debounce
      if (changedKind || !current) setProps(p, true);
      else pending = setTimeout(() => setProps(p, false), 50);
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

const dtSafe = (v: number) => Math.max(-4, Math.min(4, v));
