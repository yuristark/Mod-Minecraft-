import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { QUOTE_STATUS_LABEL } from "@/config/site";
import type { QuoteStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------ Toasts ------------------------------ */
/* Implementação própria (sem bibliotecas que injetam <style>), compatível com a CSP estrita. */
type ToastItem = { id: number; kind: "ok" | "error"; text: string };
const ToastCtx = createContext<(kind: ToastItem["kind"], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const push = useCallback((kind: ToastItem["kind"], text: string) => {
    const id = ++seq.current;
    setItems((l) => [...l.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), kind === "error" ? 7000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cn("pointer-events-auto flex items-start gap-3 border p-4 text-sm shadow-lg fade-up", t.kind === "ok" ? "border-ink bg-ink text-paper" : "border-danger bg-[#fbefed] text-danger")}>
            {t.kind === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-signal" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />}
            <span className="flex-1">{t.text}</span>
            <button type="button" onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))} aria-label="Fechar aviso"><X className="h-4 w-4" aria-hidden="true" /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ----------------------------- Confirmação ----------------------------- */
type ConfirmOpts = { title: string; body?: string; confirmLabel?: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => { resolver.current = resolve; setOpts(o); }), []);
  const done = useCallback((v: boolean) => { resolver.current(v); setOpts(null); }, []);
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!opts} onClose={() => done(false)} labelledBy="confirm-title" className="m-auto">
        {opts && (
          <div className="w-[min(92vw,440px)] bg-paper p-6 text-ink">
            <h2 id="confirm-title" className="text-lg font-bold">{opts.title}</h2>
            {opts.body && <p className="mt-2 text-sm leading-relaxed text-ink-3">{opts.body}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => done(false)}>Cancelar</button>
              <button type="button" className={cn("btn btn-sm", opts.danger ? "bg-danger text-white hover:bg-ink" : "btn-ink")} onClick={() => done(true)} autoFocus>
                {opts.confirmLabel ?? "Confirmar"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmCtx.Provider>
  );
}

/* ------------------------------ Diversos ------------------------------ */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl font-bold uppercase stretch-wide">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const STATUS_STYLE: Record<QuoteStatus, string> = {
  novo: "bg-signal text-ink",
  em_contato: "bg-[#d9e4f2] text-[#1f3d63]",
  proposta: "bg-[#efe3c4] text-[#5a4511]",
  fechado: "bg-[#d5e8da] text-ok",
  descartado: "bg-concrete-2 text-ink-3",
};

export function QuoteBadge({ status }: { status: QuoteStatus }) {
  return <span className={cn("label-mono inline-block whitespace-nowrap px-2 py-1 text-[0.62rem]", STATUS_STYLE[status])}>{QUOTE_STATUS_LABEL[status]}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="border border-dashed border-line p-10 text-center text-ink-3">{children}</div>;
}
