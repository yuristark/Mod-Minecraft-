import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { MessageCircle } from "lucide-react";
import { whatsappLink } from "@/config/site";
import { springs } from "@/motion/tokens";

/**
 * Botão flutuante de WhatsApp — principal canal de contato de construtoras no Brasil.
 * Aparece depois de um pouco de rolagem (não compete com o topo) e some no formulário de orçamento.
 */
export function WhatsAppButton() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 280);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const show = visible && pathname !== "/orcamento";
  return (
    <AnimatePresence>
      {show && (
        <motion.a
          href={whatsappLink()}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Conversar no WhatsApp"
          className="group fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 items-center gap-0 overflow-hidden rounded-full bg-[#25d366] pl-4 pr-4 text-[#0b3d1f] shadow-[0_12px_30px_-10px_rgb(0_0_0/0.5)] md:bottom-6 md:right-6"
          initial={{ scale: 0, opacity: 0, rotate: -30 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={springs.bouncy}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.94 }}
        >
          <span className="pulse-ring relative grid h-6 w-6 place-items-center rounded-full text-[#25d366]">
            <MessageCircle className="h-6 w-6 text-[#0b3d1f]" aria-hidden="true" strokeWidth={2.2} />
          </span>
          <span className="max-w-0 whitespace-nowrap text-sm font-bold opacity-0 transition-all duration-500 [transition-timing-function:var(--ease-emphasized)] group-hover:ml-2 group-hover:max-w-[200px] group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-[200px] group-focus-visible:opacity-100">
            Fale no WhatsApp
          </span>
        </motion.a>
      )}
    </AnimatePresence>
  );
}
