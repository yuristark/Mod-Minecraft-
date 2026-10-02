import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY as string | undefined;
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
export const TURNSTILE_ENABLED = Boolean(SITEKEY) && import.meta.env.VITE_DEMO !== "1";

let loader: Promise<void> | null = null;
function load() {
  if (window.turnstile) return Promise.resolve();
  loader ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => { loader = null; reject(new Error("turnstile")); };
    document.head.appendChild(s);
  });
  return loader;
}

/** Verificação anti-robô (Cloudflare Turnstile), ativada só se VITE_TURNSTILE_SITEKEY estiver definida. */
export function Turnstile({ onToken, resetKey }: { onToken: (t: string | undefined) => void; resetKey: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_ENABLED || !ref.current) return;
    let cancelled = false;
    load().then(() => {
      if (cancelled || !ref.current || !window.turnstile) return;
      widget.current = window.turnstile.render(ref.current, {
        sitekey: SITEKEY,
        language: "pt-br",
        theme: "light",
        callback: (t: string) => onToken(t),
        "expired-callback": () => onToken(undefined),
        "error-callback": () => onToken(undefined),
      });
    }).catch(() => onToken(undefined));
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [onToken]);

  useEffect(() => {
    if (resetKey && widget.current && window.turnstile) window.turnstile.reset(widget.current);
  }, [resetKey]);

  if (!TURNSTILE_ENABLED) return null;
  return <div ref={ref} className="min-h-[65px]" />;
}
