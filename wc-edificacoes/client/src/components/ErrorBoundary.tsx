import { Component, type ErrorInfo, type ReactNode } from "react";
import { site, whatsappLink } from "@/config/site";

/**
 * Se algo falhar ao desenhar a página (navegador muito antigo, extensão, erro inesperado),
 * o visitante vê uma tela útil com os contatos — nunca uma página em branco.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro ao renderizar a página", error, info.componentStack);
  }

  render() {
    return this.state.failed ? <ErrorScreen /> : this.props.children;
  }
}

/** Tela de erro amigável (também usada pelo roteador como errorElement). */
export function ErrorScreen() {
  return (
      <main className="grid min-h-[100dvh] place-items-center bg-ink px-6 py-16 text-paper">
        <div className="max-w-md text-center">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-signal">{site.name}</p>
          <h1 className="mt-4 text-3xl font-bold uppercase">Não foi possível carregar esta página</h1>
          <p className="mt-4 text-paper/70">
            Tente recarregar. Se o problema continuar, atualize o navegador do celular ou fale com a gente:
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <button type="button" className="btn btn-signal" onClick={() => window.location.reload()}>Recarregar</button>
            <a className="btn btn-ghost" href={whatsappLink()} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            <a className="btn btn-ghost" href={`tel:${site.contact.phoneHref}`}>{site.contact.phone}</a>
          </div>
        </div>
      </main>
  );
}
