import { useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Imagem que aparece suavemente quando termina de carregar (sem "estalo" de linha a linha). */
export function FadeImg({ className, onLoad, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      {...props}
      ref={(el) => { if (el?.complete && el.naturalWidth > 0 && !loaded) setLoaded(true); }}
      onLoad={(e) => { setLoaded(true); onLoad?.(e); }}
      className={cn("transition-[opacity,filter] duration-700 ease-out motion-reduce:transition-none", loaded ? "opacity-100 blur-0" : "opacity-0 blur-sm", className)}
    />
  );
}
