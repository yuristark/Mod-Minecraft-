import { useEffect } from "react";
import { site } from "@/config/site";

/** Atualiza título e descrição da página (SPA). */
export function useSeo(title: string | null, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${site.name}` : `${site.name} — Construtora e Edificadora`;
    if (description) {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "description";
        document.head.appendChild(meta);
      }
      meta.content = description;
    }
  }, [title, description]);
}
