import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { site } from "@/config/site";

function setMeta(selector: string, attr: "name" | "property", key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}

/** Atualiza título, descrição, link canônico e Open Graph de cada página (SPA). */
export function useSeo(title: string | null, description?: string) {
  const { pathname } = useLocation();
  useEffect(() => {
    const fullTitle = title ? `${title} · ${site.name}` : `${site.name} — ${site.tagline}`;
    document.title = fullTitle;
    setMeta('meta[property="og:title"]', "property", "og:title", fullTitle);
    if (description) {
      setMeta('meta[name="description"]', "name", "description", description);
      setMeta('meta[property="og:description"]', "property", "og:description", description);
    }
    const url = `${site.url}${pathname === "/" ? "/" : pathname}`;
    setMeta('meta[property="og:url"]', "property", "og:url", url);
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = url;
  }, [title, description, pathname]);
}
