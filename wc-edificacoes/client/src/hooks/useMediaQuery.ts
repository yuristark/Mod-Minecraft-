import { useCallback, useSyncExternalStore } from "react";

/** true/false conforme a media query (atualiza ao girar o celular ou redimensionar a janela). */
export function useMediaQuery(query: string) {
  const subscribe = useCallback((cb: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
