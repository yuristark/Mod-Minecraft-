import { Link } from "react-router-dom";
import { useSeo } from "@/hooks/useSeo";

export default function NotFound({ title = "Página não encontrada" }: { title?: string }) {
  useSeo(title);
  return (
    <section className="container grid min-h-[60vh] place-content-center py-20 text-center">
      <p className="font-mono text-7xl font-medium text-signal-strong md:text-9xl">404</p>
      <h1 className="mt-6 text-display-md uppercase">{title}</h1>
      <p className="mx-auto mt-4 max-w-md text-ink-3">O endereço pode ter mudado ou a página foi removida.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link to="/" className="btn btn-ink">Ir para o início</Link>
        <Link to="/obras" className="btn btn-ghost">Ver obras</Link>
      </div>
    </section>
  );
}
