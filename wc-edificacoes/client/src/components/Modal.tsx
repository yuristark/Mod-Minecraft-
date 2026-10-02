import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Dialog nativo (<dialog> + showModal): foco preso, Esc fecha, camada superior.
 * Fecha ao clicar fora com `closedby="any"` e, onde não houver suporte (Safari), via fallback.
 */
export function Modal({
  open, onClose, children, labelledBy, label, className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    const handleClose = () => onClose();
    dlg.addEventListener("close", handleClose);
    let handleClick: ((e: MouseEvent) => void) | null = null;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      handleClick = (e: MouseEvent) => {
        if (e.target !== dlg) return;
        const r = dlg.getBoundingClientRect();
        const inside = r.top <= e.clientY && e.clientY <= r.top + r.height && r.left <= e.clientX && e.clientX <= r.left + r.width;
        if (!inside) dlg.close();
      };
      dlg.addEventListener("click", handleClick);
    }
    return () => {
      dlg.removeEventListener("close", handleClose);
      if (handleClick) dlg.removeEventListener("click", handleClick);
    };
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      closedby="any"
      aria-labelledby={labelledBy}
      aria-label={label}
      className={cn("wc-dialog", className)}
    >
      {open ? children : null}
    </dialog>
  );
}
