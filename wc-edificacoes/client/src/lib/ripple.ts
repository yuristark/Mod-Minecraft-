/**
 * Onda de toque nos botões (equivalente ao InkWell / splash do Material no Flutter).
 * Um único listener no documento atende todos os `.btn` e `[data-ripple]`.
 * O estilo vem de `.ripple-ink` (index.css); posição e tamanho são definidos via CSSOM,
 * o que é permitido pela CSP estrita (sem atributos style inline no HTML).
 */
export function installRipple() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const host = (e.target as Element | null)?.closest<HTMLElement>(".btn, [data-ripple]");
    if (!host || host.matches(":disabled, [aria-disabled='true']")) return;
    const r = host.getBoundingClientRect();
    const size = Math.hypot(Math.max(e.clientX - r.left, r.right - e.clientX), Math.max(e.clientY - r.top, r.bottom - e.clientY)) * 2;
    const ink = document.createElement("span");
    ink.className = "ripple-ink";
    ink.setAttribute("aria-hidden", "true");
    ink.style.setProperty("left", `${e.clientX - r.left}px`);
    ink.style.setProperty("top", `${e.clientY - r.top}px`);
    ink.style.setProperty("width", `${size}px`);
    ink.style.setProperty("height", `${size}px`);
    host.appendChild(ink);
    ink.addEventListener("animationend", () => ink.remove(), { once: true });
    window.setTimeout(() => ink.remove(), 1200);
  };
  document.addEventListener("pointerdown", onDown, { passive: true });
  return () => document.removeEventListener("pointerdown", onDown);
}
