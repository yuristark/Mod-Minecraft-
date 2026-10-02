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
  /** liga sombras também no celular (cenas pequenas, como a maquete) */
  mobileShadows?: boolean;
  /** resolução mínima da qualidade adaptativa (cenas leves podem manter nitidez) */
  minPixelRatio?: number;
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

export function createStage({ canvas, fov = 35, fog, shadows = true, mobileShadows = false, minPixelRatio, still = false, onFrame }: StageOptions): Stage {
  const host = canvas.parentElement ?? canvas;
  const isMobile = window.matchMedia("(max-width: 767px)").matches || navigator.maxTouchPoints > 1;

  // Celular: sem antisserrilhado (MSAA é dos itens mais caros da GPU; em telas densas quase não se nota)
  // e sem pedir a GPU de alto desempenho (poupa bateria).
  const renderer = new WebGLRenderer({ canvas, antialias: !isMobile, alpha: true, powerPreference: isMobile ? "default" : "high-performance" });
  const maxRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.75);
  const minRatio = Math.min(maxRatio, minPixelRatio ?? (isMobile ? 0.75 : 1));
  let ratio = maxRatio;
  renderer.setPixelRatio(ratio);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = shadows && (!isMobile || mobileShadows);
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

  /*
   * Qualidade adaptativa: mede o tempo real entre quadros. Se o aparelho não sustenta ~45 fps,
   * reduz a resolução da cena em degraus; no mínimo de resolução e ainda lento, passa a desenhar
   * a 30 fps. Assim a rolagem da página continua fluida em celulares mais simples.
   */
  let avgFrame = 1 / 60;
  let slowFor = 0;
  let skip = false;
  let odd = false;
  let pendingDt = 0;
  const adapt = (rawDt: number) => {
    if (rawDt > 0.25) return; // aba voltou / pausa: não conta
    avgFrame = avgFrame * 0.9 + rawDt * 0.1;
    slowFor = avgFrame > 1 / 45 ? slowFor + rawDt : 0;
    if (slowFor < 1.2) return;
    slowFor = 0;
    if (ratio > minRatio) {
      ratio = Math.max(minRatio, ratio - 0.25);
      renderer.setPixelRatio(ratio);
      resize();
    } else if (!skip) {
      skip = true;
    }
  };

  // No celular, a rolagem da página tem prioridade: enquanto o dedo rola, a cena congela no
  // último quadro (custo zero de GPU) e continua de onde parou assim que a rolagem termina.
  let scrollingUntil = 0;
  const onScroll = () => { scrollingUntil = performance.now() + 140; };
  if (isMobile) window.addEventListener("scroll", onScroll, { passive: true });

  const loop = () => {
    raf = requestAnimationFrame(loop);
    timer.update();
    const raw = timer.getDelta();
    if (isMobile && performance.now() < scrollingUntil) return;
    adapt(skip ? raw * 0.5 : raw);
    const dt = Math.min(raw, 1 / 20); // evita "saltos" após a aba voltar
    if (skip) {
      odd = !odd;
      pendingDt += dt;
      if (odd) return; // desenha um quadro sim, outro não (30 fps)
    }
    const step = skip ? Math.min(pendingDt, 1 / 15) : dt;
    pendingDt = 0;
    elapsed += step;
    onFrame(elapsed, step);
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
      window.removeEventListener("scroll", onScroll);
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
