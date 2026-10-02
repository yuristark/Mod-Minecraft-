import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/** Contrato das cenas: um módulo carregado sob demanda que cria a cena no canvas. */
export interface SceneInstance<P> { update(props: P): void; dispose(): void }
export interface BaseSceneOptions { reducedMotion: boolean; onReady?: () => void }
export type SceneFactory<P, O extends BaseSceneOptions> = (canvas: HTMLCanvasElement, opts: O) => SceneInstance<P>;

let webglOk: boolean | null = null;
function hasWebGL() {
  if (webglOk !== null) return webglOk;
  try {
    const c = document.createElement("canvas");
    webglOk = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webglOk = false;
  }
  return webglOk;
}

/**
 * Monta uma cena three.js carregada sob demanda (o three.js só é baixado quando a cena entra em uso).
 * Sem WebGL ou se o módulo falhar, mostra o `fallback` (ex.: o desenho técnico em SVG).
 */
export function ThreeCanvas<P, O extends BaseSceneOptions>({
  load, props, options, className, canvasClassName, fallback, placeholder, label, children,
}: {
  load: () => Promise<{ default: SceneFactory<P, O> }>;
  props: P;
  options?: Omit<O, "reducedMotion" | "onReady">;
  className?: string;
  canvasClassName?: string;
  fallback?: ReactNode;
  /** exibido enquanto o three.js carrega */
  placeholder?: ReactNode;
  label: string;
  children?: ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instance = useRef<SceneInstance<P> | null>(null);
  const propsRef = useRef(props);
  const optsRef = useRef(options);
  const reduce = useReducedMotion() ?? false;
  const [failed, setFailed] = useState(() => typeof window !== "undefined" && !hasWebGL());
  const [ready, setReady] = useState(false);

  propsRef.current = props;
  optsRef.current = options;

  useEffect(() => {
    if (failed || !canvasRef.current) return;
    let cancelled = false;
    const canvas = canvasRef.current;
    load()
      .then((mod) => {
        if (cancelled) return;
        const inst = mod.default(canvas, { ...(optsRef.current as O), reducedMotion: reduce, onReady: () => !cancelled && setReady(true) });
        instance.current = inst;
        inst.update(propsRef.current);
      })
      .catch(() => !cancelled && setFailed(true));
    const onLost = (e: Event) => { e.preventDefault(); setFailed(true); };
    canvas.addEventListener("webglcontextlost", onLost);
    return () => {
      cancelled = true;
      canvas.removeEventListener("webglcontextlost", onLost);
      instance.current?.dispose();
      instance.current = null;
      setReady(false);
    };
  }, [load, reduce, failed]);

  useEffect(() => { instance.current?.update(props); }, [props]);

  if (failed) return <div className={className}>{fallback}</div>;
  return (
    <div className={cn("relative", className)}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className={cn("block h-full w-full transition-opacity [transition-duration:1200ms] ease-out", ready ? "opacity-100" : "opacity-0", canvasClassName)}
      />
      {!ready && placeholder && <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">{placeholder}</div>}
      {children}
    </div>
  );
}
