/**
 * Infraestrutura comum das cenas 3D (three.js):
 * renderer, câmera, redimensionamento, pausa automática fora da tela / aba oculta,
 * limite de pixel ratio (desempenho em celulares) e liberação de memória da GPU.
 */
import {
  ACESFilmicToneMapping, Color, Fog, Material, Mesh, PCFShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Timer,
  WebGLRenderer, type Object3D,
} from "three";

export const PALETTE = {
  ink: new Color("#17181a"),
  ink2: new Color("#2a2c30"),
  paper: new Color("#f1ede6"),
  concrete: new Color("#cfc9be"),
  concreteDark: new Color("#8f8a81"),
  signal: new Color("#e8642c"),
  glass: new Color("#30414d"),
  warm: new Color("#ffcf8a"),
};

export interface StageOptions {
  canvas: HTMLCanvasElement;
  fov?: number;
  fog?: { color: Color; near: number; far: number };
  shadows?: boolean;
  /** quando true, só renderiza sob demanda (prefers-reduced-motion) */
  still?: boolean;
  onFrame: (t: number, dt: number) => void;
}

export interface Stage {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  isMobile: boolean;
  requestRender: () => void;
  dispose: () => void;
}

export function createStage({ canvas, fov = 35, fog, shadows = true, still = false, onFrame }: StageOptions): Stage {
  const host = canvas.parentElement ?? canvas;
  const isMobile = window.matchMedia("(max-width: 767px)").matches || navigator.maxTouchPoints > 1;

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = shadows && !isMobile;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  if (fog) scene.fog = new Fog(fog.color, fog.near, fog.far);
  const camera = new PerspectiveCamera(fov, 1, 0.1, 200);

  const timer = new Timer();
  // Tempo da cena: só avança enquanto ela está sendo desenhada. Assim, se a cena começar fora da
  // tela (celular) ou a aba for trocada, a animação continua de onde parou em vez de "pular".
  let elapsed = 0;
  let raf = 0;
  let visible = true;
  let pageVisible = !document.hidden;

  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (still) queueRender();
  };

  // Renderizações avulsas vão para o próximo quadro: a cena termina de montar antes do primeiro desenho
  let pending = 0;
  const queueRender = () => {
    if (!pending) pending = requestAnimationFrame(() => { pending = 0; renderOnce(); });
  };

  const renderOnce = () => {
    timer.update();
    onFrame(elapsed, 0);
    renderer.render(scene, camera);
  };

  const loop = () => {
    raf = requestAnimationFrame(loop);
    timer.update();
    const dt = Math.min(timer.getDelta(), 1 / 20); // evita "saltos" após a aba voltar
    elapsed += dt;
    onFrame(elapsed, dt);
    renderer.render(scene, camera);
  };

  const sync = () => {
    const shouldRun = !still && visible && pageVisible;
    if (shouldRun && !raf) { timer.update(); raf = requestAnimationFrame(loop); }
    if (!shouldRun && raf) { cancelAnimationFrame(raf); raf = 0; }
  };

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: "120px" });
  io.observe(host);
  const onVis = () => { pageVisible = !document.hidden; sync(); };
  document.addEventListener("visibilitychange", onVis);

  resize();
  sync();

  return {
    scene,
    camera,
    renderer,
    isMobile,
    requestRender: () => { if (!raf) queueRender(); },
    dispose: () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(pending);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      timer.dispose();
      disposeTree(scene);
      renderer.dispose();
    },
  };
}

/** Libera geometrias e materiais de uma árvore de objetos. */
export function disposeTree(root: Object3D, { materials = true } = {}) {
  const mats = new Set<Material>();
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as Material | Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => mats.add(x));
    else if (mat) mats.add(mat);
  });
  if (materials) mats.forEach((m) => m.dispose());
}

/** Aproxima `current` de `target` de forma independente do frame rate (amortecimento exponencial). */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));

/** Interpolação de ângulo pelo caminho mais curto. */
export const dampAngle = (current: number, target: number, lambda: number, dt: number) => {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return current + d * (1 - Math.exp(-lambda * dt));
};
