import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Info } from "lucide-react";
import { springs } from "@/motion/tokens";

/** Avisos curtos ("Link copiado", etc.). Chame toast("texto") de qualquer lugar. */
type Item = { id: number; text: string; tone: "ok" | "info" };
let items: Item[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string, tone: Item["tone"] = "ok") {
  const id = ++seq;
  items = [...items.slice(-2), { id, text, tone }];
  emit();
  window.setTimeout(() => { items = items.filter((i) => i.id !== id); emit(); }, 3200);
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => items;

export function Toaster() {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-8">
      <AnimatePresence initial={false}>
        {list.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={springs.snappy}
            className="pointer-events-auto flex items-center gap-2.5 bg-ink px-4 py-3 text-sm font-medium text-paper shadow-[0_18px_40px_-16px_rgb(0_0_0/0.6)]"
          >
            {t.tone === "ok" ? <CheckCircle2 className="h-4 w-4 text-signal" aria-hidden="true" /> : <Info className="h-4 w-4 text-signal" aria-hidden="true" />}
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
