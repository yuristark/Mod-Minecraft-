import { useEffect, useState } from "react";
import { useNavigation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";

/** Barra fina no topo enquanto a próxima página é baixada (só aparece se demorar mais de 120 ms). */
export function NavProgress() {
  const loading = useNavigation().state === "loading";
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!loading) { setShow(false); return; }
    const t = window.setTimeout(() => setShow(true), 120);
    return () => window.clearTimeout(t);
  }, [loading]);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          aria-hidden="true"
          className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-signal"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 0.85, transition: { duration: 2.5, ease: [0.1, 0.6, 0.2, 1] } }}
          exit={{ scaleX: 1, opacity: 0, transition: { duration: 0.3 } }}
        />
      )}
    </AnimatePresence>
  );
}
