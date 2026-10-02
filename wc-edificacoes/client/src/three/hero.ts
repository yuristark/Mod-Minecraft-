/**
 * Cena 3D do topo da página inicial: um edifício sendo erguido pavimento por pavimento
 * (animação escalonada, como uma StaggeredAnimation do Flutter), grua em operação
 * içando vigas até a laje, faíscas de solda, janelas acendendo e pavimentos futuros
 * desenhados em linha tracejada — a "prancha" virando obra.
 *
 * Carregada sob demanda (import dinâmico) para não pesar o carregamento inicial.
 */
import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, DirectionalLight, EdgesGeometry, Float32BufferAttribute,
  GridHelper, Group, HemisphereLight, InstancedMesh, LineBasicMaterial, LineDashedMaterial, LineSegments, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, PointLight, Points, PointsMaterial, ShadowMaterial,
  SphereGeometry, Vector3,
} from "three";
import { curveFns, interval } from "@/motion/tokens";
import { createStage, damp, dampAngle, PALETTE } from "./stage";

export type HeroProps = Record<string, never>;
export interface HeroOptions {
  reducedMotion: boolean;
  /** progresso de rolagem do hero (0..1), lido a cada quadro — sem re-render do React */
  scroll?: { get(): number };
  onProgress?: (p: number) => void;
  onReady?: () => void;
}

const W = 8; // largura (x)
const D = 6; // profundidade (z)
const FH = 1.25; // pé-direito
const TOTAL = 14; // pavimentos do projeto
const BUILT = 10; // pavimentos com estrutura pronta
const GLAZED = BUILT - 2; // pavimentos já com fachada
const STEP = 0.3; // intervalo entre pavimentos na animação de entrada (s)
const INTRO_START = 0.35;

const CRANE = new Vector3(W / 2 + 3, 0, -D / 2 - 2.6);
const MAST_H = TOTAL * FH + 2.2;
const JIB = 16;
const COUNTER = 5;

/** Treliça de seção quadrada ao longo de +Y (mastro e lança da grua). */
function truss(len: number, w: number, step: number) {
  const h = w / 2;
  const c: [number, number][] = [[-h, -h], [h, -h], [h, h], [-h, h]];
  const pts: number[] = [];
  for (const [x, z] of c) pts.push(x, 0, z, x, len, z);
  const n = Math.max(1, Math.round(len / step));
  for (let i = 0; i <= n; i++) {
    const y = (i * len) / n;
    for (let k = 0; k < 4; k++) {
      const [x1, z1] = c[k];
      const [x2, z2] = c[(k + 1) % 4];
      pts.push(x1, y, z1, x2, y, z2);
      if (i < n) {
        const y2 = ((i + 1) * len) / n;
        if ((i + k) % 2 === 0) pts.push(x1, y, z1, x2, y2, z2);
        else pts.push(x2, y, z2, x1, y2, z1);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pts, 3));
  return g;
}

/** Geometria com origem na base (para "crescer" de baixo para cima com scale.y). */
const baseBox = (w: number, h: number, d: number) => new BoxGeometry(w, h, d).translate(0, h / 2, 0);

export default function createHeroScene(canvas: HTMLCanvasElement, opts: HeroOptions) {
  const still = opts.reducedMotion;
  const pointer = { x: 0, y: 0 };
  const cam = { az: 1.05, el: 0.62, r: 44 }; // começa afastada e alta → "dolly in"
  let lastProgress = -1;
  let readySent = false;

  const stage = createStage({ canvas, fov: 32, fog: { color: PALETTE.ink, near: 30, far: 75 }, still, onFrame: frame });
  const { scene, camera, isMobile } = stage;

  /* ---------------- Luz ---------------- */
  scene.add(new HemisphereLight(PALETTE.paper, PALETTE.ink, 1.1));
  const sun = new DirectionalLight("#fff3e6", 2.4);
  sun.position.set(14, 26, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 70 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  const rim = new DirectionalLight("#8fa6c0", 0.7);
  rim.position.set(-12, 9, -10);
  scene.add(rim);

  /* ---------------- Terreno ---------------- */
  const grid = new GridHelper(90, 90, PALETTE.signal, PALETTE.paper);
  const gm = grid.material as LineBasicMaterial;
  gm.transparent = true;
  gm.opacity = 0.09;
  gm.depthWrite = false;
  scene.add(grid);

  const ground = new Mesh(new PlaneGeometry(90, 90), new ShadowMaterial({ opacity: 0.38 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.001;
  ground.receiveShadow = true;
  scene.add(ground);

  // limite do lote (tracejado laranja)
  const lot = new LineSegments(new EdgesGeometry(new BoxGeometry(W + 7, 0.001, D + 7)), new LineDashedMaterial({ color: PALETTE.signal, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.85 }));
  lot.position.set(0.8, 0.02, -0.6);
  lot.computeLineDistances();
  scene.add(lot);

  const concrete = new MeshStandardMaterial({ color: PALETTE.concrete, roughness: 0.92, metalness: 0 });
  const concreteDark = new MeshStandardMaterial({ color: PALETTE.concreteDark, roughness: 0.95 });
  const core = new MeshStandardMaterial({ color: PALETTE.ink2, roughness: 0.7 });
  const steel = new MeshStandardMaterial({ color: PALETTE.signal, roughness: 0.5, metalness: 0.35 });

  const foundation = new Mesh(baseBox(W + 1.2, 0.35, D + 1.2), concreteDark);
  foundation.receiveShadow = true;
  foundation.castShadow = true;
  scene.add(foundation);

  /* ---------------- Edifício ---------------- */
  const building = new Group();
  building.position.y = 0.35;
  scene.add(building);

  const COLS: [number, number][] = [];
  for (const x of [-W / 2, 0, W / 2]) for (const z of [-D / 2, D / 2]) COLS.push([x, z]);
  COLS.push([-W / 2, 0], [W / 2, 0]);

  const colGeo = baseBox(0.3, FH - 0.22, 0.3);
  const slabGeo = new BoxGeometry(W + 0.5, 0.22, D + 0.5);
  const coreGeo = baseBox(W - 0.7, FH - 0.22, D - 0.7);
  const edgeMat = new LineBasicMaterial({ color: PALETTE.paper, transparent: true, opacity: 0.35 });
  const slabEdges = new EdgesGeometry(slabGeo);

  interface Floor { columns: Group; slab: Group; core: Mesh }
  const floors: Floor[] = [];
  for (let i = 0; i < BUILT; i++) {
    const y = i * FH;
    const columns = new Group();
    columns.position.y = y;
    for (const [x, z] of COLS) {
      const c = new Mesh(colGeo, concrete);
      c.position.set(x, 0, z);
      c.castShadow = true;
      columns.add(c);
    }
    const slab = new Group();
    const s = new Mesh(slabGeo, concrete);
    s.castShadow = true;
    s.receiveShadow = true;
    slab.add(s, new LineSegments(slabEdges, edgeMat));
    slab.position.y = y + FH - 0.11;
    const coreMesh = new Mesh(coreGeo, core);
    coreMesh.position.y = y;
    coreMesh.visible = i < GLAZED;
    building.add(columns, slab, coreMesh);
    floors.push({ columns, slab, core: coreMesh });
  }

  // esperas de armadura no último pavimento
  const rebarPts: number[] = [];
  for (const [x, z] of COLS) for (const dx of [-0.08, 0.08]) rebarPts.push(x + dx, BUILT * FH, z, x + dx, BUILT * FH + 0.7, z);
  const rebars = new LineSegments(new BufferGeometry().setAttribute("position", new Float32BufferAttribute(rebarPts, 3)), new LineBasicMaterial({ color: PALETTE.concreteDark }));
  building.add(rebars);

  // pavimentos futuros: tracejado de projeto
  const ghostMat = new LineDashedMaterial({ color: PALETTE.paper, dashSize: 0.22, gapSize: 0.16, transparent: true, opacity: 0.38 });
  const ghostGeo = new EdgesGeometry(new BoxGeometry(W + 0.5, FH, D + 0.5));
  for (let i = BUILT; i < TOTAL; i++) {
    const g = new LineSegments(ghostGeo, ghostMat);
    g.position.y = i * FH + FH / 2;
    g.computeLineDistances();
    building.add(g);
  }

  // fachada: painéis de vidro (instanciados), alguns acesos
  interface Pane { floor: number; m: Matrix4; lit: boolean }
  const panes: Pane[] = [];
  const tmp = new Object3D();
  const PW = 1.05;
  const PH = FH - 0.42;
  for (let i = 0; i < GLAZED; i++) {
    const y = i * FH + 0.1 + PH / 2;
    const addRow = (n: number, len: number, place: (u: number) => [number, number, number]) => {
      for (let k = 0; k < n; k++) {
        const u = -len / 2 + (len / n) * (k + 0.5);
        const [x, z, rot] = place(u);
        tmp.position.set(x, y, z);
        tmp.rotation.set(0, rot, 0);
        tmp.scale.set(1, 1, 1);
        tmp.updateMatrix();
        panes.push({ floor: i, m: tmp.matrix.clone(), lit: Math.random() < 0.22 });
      }
    };
    const ox = W / 2 - 0.33;
    const oz = D / 2 - 0.33;
    addRow(6, W - 0.8, (u) => [u, oz, 0]);
    addRow(6, W - 0.8, (u) => [u, -oz, Math.PI]);
    addRow(4, D - 0.8, (u) => [ox, u, Math.PI / 2]);
    addRow(4, D - 0.8, (u) => [-ox, u, -Math.PI / 2]);
  }
  const paneMesh = new InstancedMesh(new PlaneGeometry(PW, PH), new MeshBasicMaterial({ color: 0xffffff }), panes.length);
  const unlit = PALETTE.glass;
  const lit = PALETTE.warm;
  panes.forEach((p, idx) => { paneMesh.setMatrixAt(idx, p.m); paneMesh.setColorAt(idx, p.lit ? lit : unlit); });
  building.add(paneMesh);

  /* ---------------- Grua ---------------- */
  const crane = new Group();
  crane.position.copy(CRANE);
  scene.add(crane);
  const craneLine = new LineBasicMaterial({ color: PALETTE.signal });
  const base = new Mesh(baseBox(1.6, 0.5, 1.6), concreteDark);
  base.castShadow = true;
  crane.add(base, new LineSegments(truss(MAST_H, 0.6, 0.6), craneLine));

  const slew = new Group(); // parte giratória
  slew.position.y = MAST_H;
  crane.add(slew);
  const jib = new LineSegments(truss(JIB + COUNTER, 0.5, 0.7), craneLine);
  jib.rotation.z = -Math.PI / 2; // treliça ao longo de +X
  jib.position.x = -COUNTER;
  slew.add(jib);
  const apexPts = [0, 0, 0, 0, 2.6, 0, 0, 2.6, 0, JIB * 0.72, 0.25, 0, 0, 2.6, 0, -COUNTER, 0.25, 0];
  slew.add(new LineSegments(new BufferGeometry().setAttribute("position", new Float32BufferAttribute(apexPts, 3)), new LineBasicMaterial({ color: PALETTE.paper, transparent: true, opacity: 0.6 })));
  const weight = new Mesh(new BoxGeometry(1.6, 1.1, 0.9), concreteDark);
  weight.position.set(-COUNTER + 1, -0.3, 0);
  weight.castShadow = true;
  const cab = new Mesh(new BoxGeometry(0.9, 0.8, 0.8), steel);
  cab.position.set(0.7, -0.55, 0.55);
  slew.add(weight, cab);

  const trolley = new Mesh(new BoxGeometry(0.6, 0.2, 0.6), steel);
  trolley.position.y = -0.35;
  slew.add(trolley);
  const cableGeo = new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array(6), 3));
  const cable = new LineSegments(cableGeo, new LineBasicMaterial({ color: PALETTE.paper, transparent: true, opacity: 0.75 }));
  cable.frustumCulled = false;
  slew.add(cable);
  const hook = new Group();
  const hookBlock = new Mesh(new BoxGeometry(0.32, 0.4, 0.32), steel);
  const load = new Mesh(new BoxGeometry(3.4, 0.22, 0.28), steel);
  load.position.y = -0.55;
  load.castShadow = true;
  hookBlock.castShadow = true;
  hook.add(hookBlock, load);
  slew.add(hook);

  // pilha de vigas no canteiro (ponto de coleta)
  const pickDir = new Vector3(1, 0, 0.42).normalize();
  const R0 = 7.2;
  const pickPos = CRANE.clone().addScaledVector(pickDir, R0);
  for (let i = 0; i < 3; i++) {
    const b = new Mesh(new BoxGeometry(3.4, 0.22, 0.28), steel);
    b.position.set(pickPos.x, 0.11 + i * 0.24, pickPos.z + (i - 1) * 0.36);
    b.rotation.y = Math.atan2(-pickDir.z, pickDir.x);
    b.castShadow = true;
    scene.add(b);
  }
  const toTarget = new Vector3(0.4, 0, 0.2).sub(CRANE);
  const R1 = Math.hypot(toTarget.x, toTarget.z);
  const A0 = Math.atan2(-pickDir.z, pickDir.x);
  const A1 = Math.atan2(-toTarget.z, toTarget.x);

  const beacon = new Mesh(new SphereGeometry(0.16, 12, 8), new MeshBasicMaterial({ color: "#ff5a2a" }));
  beacon.position.set(0, 2.75, 0);
  slew.add(beacon);

  /* ---------------- Partículas ---------------- */
  const DUST = isMobile ? 160 : 360;
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 40;
    dustPos[i * 3 + 1] = Math.random() * 24;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 40;
  }
  const dustGeo = new BufferGeometry().setAttribute("position", new BufferAttribute(dustPos, 3));
  const dust = new Points(dustGeo, new PointsMaterial({ color: PALETTE.paper, size: 0.06, transparent: true, opacity: 0.35, depthWrite: false }));
  scene.add(dust);

  // faíscas de solda no último pavimento
  const SPARKS = 60;
  const weld = new Vector3(W / 2, 0.35 + (BUILT - 1) * FH + 0.4, D / 2);
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkVel = new Float32Array(SPARKS * 3);
  const sparkLife = new Float32Array(SPARKS);
  const sparkGeo = new BufferGeometry().setAttribute("position", new BufferAttribute(sparkPos, 3));
  const sparks = new Points(sparkGeo, new PointsMaterial({ color: "#ffb35c", size: 0.09, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false }));
  sparks.frustumCulled = false;
  scene.add(sparks);
  const respawn = (i: number) => {
    sparkPos.set([weld.x, weld.y, weld.z], i * 3);
    sparkVel.set([(Math.random() - 0.2) * 2.4, Math.random() * 2.2, (Math.random() - 0.2) * 2.4], i * 3);
    sparkLife[i] = 0.3 + Math.random() * 0.7;
  };
  for (let i = 0; i < SPARKS; i++) { respawn(i); sparkLife[i] = Math.random(); }
  const weldLight = new PointLight("#ff9a40", 0, 7, 1.6);
  weldLight.position.copy(weld);
  scene.add(weldLight);

  /* ---------------- Interação ---------------- */
  const onPointer = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  const target = new Vector3(1.8, 7.6, -0.8);
  let lightTimer = 0;
  let weldOn = 0;
  let panesSettled = false;

  /* ---------------- Quadro a quadro ---------------- */
  function frame(t: number, dt: number) {
    const T = still ? 999 : t;

    // 1. Edifício: pavimentos sobem em sequência (Interval + easeOutBack)
    let done = 0;
    for (let i = 0; i < BUILT; i++) {
      const start = INTRO_START + i * STEP;
      const p = Math.min(1, Math.max(0, (T - start) / 0.95));
      const f = floors[i];
      f.columns.scale.y = Math.max(0.0001, interval(p, 0, 0.55, curveFns.easeOutCubic));
      f.columns.visible = p > 0;
      const sp = interval(p, 0.3, 1, curveFns.easeOutBack);
      f.slab.visible = p > 0.3;
      f.slab.position.y = i * FH + FH - 0.11 + (1 - sp) * 2.2;
      f.slab.scale.set(0.9 + 0.1 * sp, 1, 0.9 + 0.1 * sp);
      if (i < GLAZED) {
        const gp = interval(T, start + 1.1, start + 1.9, curveFns.easeOutCubic);
        f.core.visible = gp > 0;
        f.core.scale.set(1, Math.max(0.0001, gp), 1);
      }
      if (p >= 1) done++;
    }
    rebars.visible = T > INTRO_START + BUILT * STEP + 0.6;

    // painéis surgem junto com o núcleo de cada pavimento; janelas acendem/apagam
    // Atualiza as matrizes dos painéis durante a entrada e uma última vez ao terminar
    const introGlass = T < INTRO_START + GLAZED * STEP + 2.2;
    if (introGlass || !panesSettled) {
      if (!introGlass) panesSettled = true;
      panes.forEach((p, idx) => {
        const start = INTRO_START + p.floor * STEP + 1.3;
        const s = interval(T, start, start + 0.6, curveFns.easeOutBack);
        tmp.matrix.copy(p.m);
        tmp.matrix.decompose(tmp.position, tmp.quaternion, tmp.scale);
        tmp.scale.set(Math.max(0.0001, s), Math.max(0.0001, s), 1);
        tmp.updateMatrix();
        paneMesh.setMatrixAt(idx, tmp.matrix);
      });
      paneMesh.instanceMatrix.needsUpdate = true;
    }
    lightTimer += dt;
    if (!still && lightTimer > 0.45) {
      lightTimer = 0;
      const idx = Math.floor(Math.random() * panes.length);
      panes[idx].lit = !panes[idx].lit;
      paneMesh.setColorAt(idx, panes[idx].lit ? lit : unlit);
      if (paneMesh.instanceColor) paneMesh.instanceColor.needsUpdate = true;
    }

    const progress = done / TOTAL;
    if (progress !== lastProgress) { lastProgress = progress; opts.onProgress?.(progress); }

    // 2. Grua: ciclo de içamento (16 s)
    const P = 16;
    const c = still ? 0.26 : ((Math.max(0, T - 1.2) % P) / P);
    const ease = curveFns.easeInOutCubic;
    const safeY = MAST_H - 3.2;
    const groundY = 1.2;
    const dropY = 0.35 + BUILT * FH + 1.1;
    let ang = A0; let rad = R0; let hy = groundY; let carrying = true;
    if (c < 0.12) { hy = groundY + (safeY - groundY) * interval(c, 0, 0.12, ease); }
    else if (c < 0.4) { const k = interval(c, 0.12, 0.4, ease); ang = A0 + shortest(A0, A1) * k; rad = R0 + (R1 - R0) * k; hy = safeY; }
    else if (c < 0.52) { ang = A1; rad = R1; hy = safeY + (dropY - safeY) * interval(c, 0.4, 0.52, ease); }
    else if (c < 0.58) { ang = A1; rad = R1; hy = dropY; carrying = c < 0.555; }
    else if (c < 0.68) { ang = A1; rad = R1; carrying = false; hy = dropY + (safeY - dropY) * interval(c, 0.58, 0.68, ease); }
    else if (c < 0.92) { const k = interval(c, 0.68, 0.92, ease); ang = A1 + shortest(A1, A0) * k; rad = R1 + (R0 - R1) * k; hy = safeY; carrying = false; }
    else { hy = safeY + (groundY - safeY) * interval(c, 0.92, 1, ease); carrying = c > 0.985; }
    const prevAng = slew.rotation.y;
    slew.rotation.y = still ? ang : dampAngle(prevAng, ang, 12, dt || 1);
    const swing = still ? 0 : Math.sin(t * 2.1) * Math.min(0.35, Math.abs(slew.rotation.y - prevAng) * 40);
    trolley.position.x = rad;
    hook.position.set(rad + swing, hy - MAST_H, 0);
    hook.rotation.z = -swing * 0.25;
    load.visible = carrying;
    const pos = cableGeo.attributes.position as BufferAttribute;
    pos.setXYZ(0, rad, -0.4, 0);
    pos.setXYZ(1, rad + swing, hy - MAST_H + 0.2, 0);
    pos.needsUpdate = true;
    beacon.visible = still || Math.sin(t * 5) > -0.2;

    // 3. Partículas
    if (!still) {
      for (let i = 0; i < DUST; i++) {
        let y = dustPos[i * 3 + 1] + dt * 0.25;
        if (y > 24) y = 0;
        dustPos[i * 3 + 1] = y;
        dustPos[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.05;
      }
      dustGeo.attributes.position.needsUpdate = true;

      const welding = T > INTRO_START + BUILT * STEP + 0.8 && Math.sin(t * 0.9) > -0.1;
      weldOn = damp(weldOn, welding ? 1 : 0, 10, dt);
      for (let i = 0; i < SPARKS; i++) {
        sparkLife[i] -= dt;
        if (sparkLife[i] <= 0) { if (welding) respawn(i); else sparkPos[i * 3 + 1] = -50; continue; }
        sparkVel[i * 3 + 1] -= 9.8 * dt;
        sparkPos[i * 3] += sparkVel[i * 3] * dt;
        sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
        sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      weldLight.intensity = weldOn * (6 + Math.random() * 10);
    } else {
      sparks.visible = false;
    }

    // 4. Câmera: entrada em "dolly", órbita lenta, ponteiro e rolagem
    const scroll = Math.min(1, Math.max(0, opts.scroll?.get() ?? 0));
    const narrow = camera.aspect < 0.9;
    const goalR = (narrow ? 52 : 38) - scroll * 6;
    const goalAz = 0.72 + Math.sin(t * 0.07) * 0.16 + pointer.x * 0.22 - scroll * 0.6;
    const goalEl = 0.3 + pointer.y * 0.06 + scroll * 0.22;
    if (still) { cam.r = goalR; cam.az = goalAz; cam.el = goalEl; }
    else {
      cam.r = damp(cam.r, goalR, 1.6, dt);
      cam.az = damp(cam.az, goalAz, 2, dt);
      cam.el = damp(cam.el, goalEl, 2, dt);
    }
    camera.position.set(
      target.x + cam.r * Math.cos(cam.el) * Math.sin(cam.az),
      target.y + cam.r * Math.sin(cam.el),
      target.z + cam.r * Math.cos(cam.el) * Math.cos(cam.az),
    );
    camera.lookAt(target);

    if (!readySent) { readySent = true; queueMicrotask(() => opts.onReady?.()); }
  }

  return {
    update() { if (still) stage.requestRender(); },
    dispose() {
      window.removeEventListener("pointermove", onPointer);
      stage.dispose();
    },
  };
}

function shortest(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
