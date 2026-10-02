import { toast } from "@/components/Toast";

/**
 * Compartilha um link: no celular abre a folha nativa (WhatsApp, Instagram...);
 * no computador copia o link e avisa.
 */
export async function shareLink({ title, text, url = window.location.href }: { title: string; text?: string; url?: string }) {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const data: ShareData = { title, text, url };
  if (nav.share && (!nav.canShare || nav.canShare(data)) && window.matchMedia("(pointer: coarse)").matches) {
    try { await nav.share(data); return; } catch (err) { if ((err as Error).name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copiado — é só colar no WhatsApp ou e-mail");
  } catch {
    // navegadores sem a API de área de transferência (ou contexto sem HTTPS)
    window.prompt("Copie o link:", url);
  }
}
