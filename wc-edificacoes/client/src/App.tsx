import { lazy, Suspense, useEffect } from "react";
import { Outlet, ScrollRestoration, type RouteObject } from "react-router-dom";
import { MotionConfig } from "motion/react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { IS_DEMO } from "@/lib/api";
import { installRipple } from "@/lib/ripple";
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

function Root() {
  useEffect(() => installRipple(), []);
  return (
    // reducedMotion="user": quem pede menos movimento no sistema não recebe transformações animadas
    <MotionConfig reducedMotion="user">
      {/* rola ao topo a cada página, restaura a posição ao voltar e respeita âncoras (#) */}
      <ScrollRestoration />
      <Outlet />
    </MotionConfig>
  );
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

export const routes: RouteObject[] = [
  {
    element: <Root />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { index: true, element: <Home /> },
          { path: "obras", element: <Obras /> },
          { path: "obras/:slug", element: <ObraDetalhe /> },
          { path: "servicos", element: <Servicos /> },
          { path: "simulador", element: <Simulador /> },
          { path: "orcamento", element: <Orcamento /> },
          { path: "empresa", element: <Empresa /> },
          { path: "privacidade", element: <Privacidade /> },
          { path: "*", element: <NotFound /> },
        ],
      },
      {
        path: "admin/*",
        element: (
          <Suspense fallback={<div className="grid min-h-screen place-items-center bg-ink font-mono text-sm text-paper/60">Carregando painel…</div>}>
            <AdminApp />
          </Suspense>
        ),
      },
    ],
  },
];
