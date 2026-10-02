import { lazy, Suspense, useEffect } from "react";
import { Outlet, Route, Routes, useLocation } from "react-router-dom";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { IS_DEMO } from "@/lib/api";
import Home from "@/pages/Home";
import Obras from "@/pages/Obras";
import ObraDetalhe from "@/pages/ObraDetalhe";
import Orcamento from "@/pages/Orcamento";
import Servicos from "@/pages/Servicos";
import Simulador from "@/pages/Simulador";
import Empresa from "@/pages/Empresa";
import Privacidade from "@/pages/Privacidade";
import NotFound from "@/pages/NotFound";

// O painel é carregado sob demanda: visitantes do site não baixam o código do admin
const AdminApp = lazy(() => import("@/admin/AdminApp"));

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      // aguarda a página renderizar antes de rolar até a âncora
      const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 60);
      return () => window.clearTimeout(t);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function PublicLayout() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      {IS_DEMO && (
        <div className="bg-signal px-4 py-1.5 text-center font-mono text-[0.7rem] uppercase tracking-wider text-ink">
          Demonstração · obras e dados de exemplo
        </div>
      )}
      <SiteHeader />
      <main id="conteudo" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="obras" element={<Obras />} />
          <Route path="obras/:slug" element={<ObraDetalhe />} />
          <Route path="servicos" element={<Servicos />} />
          <Route path="simulador" element={<Simulador />} />
          <Route path="orcamento" element={<Orcamento />} />
          <Route path="empresa" element={<Empresa />} />
          <Route path="privacidade" element={<Privacidade />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route
          path="admin/*"
          element={
            <Suspense fallback={<div className="grid min-h-screen place-items-center bg-ink font-mono text-sm text-paper/60">Carregando painel…</div>}>
              <AdminApp />
            </Suspense>
          }
        />
      </Routes>
    </>
  );
}
