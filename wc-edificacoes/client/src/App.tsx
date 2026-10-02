import { lazy, Suspense, useEffect } from "react";
import { Outlet, ScrollRestoration, type RouteObject } from "react-router-dom";
import { MotionConfig } from "motion/react";
import { ErrorScreen } from "@/components/ErrorBoundary";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { IS_DEMO } from "@/lib/api";
import { installRipple } from "@/lib/ripple";
import { NavProgress } from "@/components/NavProgress";
import { Toaster } from "@/components/Toast";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";

// A página inicial vem no pacote principal; as demais são baixadas quando o visitante navega
// (menos JavaScript no primeiro acesso — diferença grande em 4G).
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await load()).default });

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
      <WhatsAppButton />
      <NavProgress />
      <Toaster />
    </div>
  );
}

export const routes: RouteObject[] = [
  {
    element: <Root />,
    errorElement: <ErrorScreen />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { index: true, element: <Home /> },
          { path: "obras", lazy: page(() => import("@/pages/Obras")) },
          { path: "obras/:slug", lazy: page(() => import("@/pages/ObraDetalhe")) },
          { path: "servicos", lazy: page(() => import("@/pages/Servicos")) },
          { path: "simulador", lazy: page(() => import("@/pages/Simulador")) },
          { path: "orcamento", lazy: page(() => import("@/pages/Orcamento")) },
          { path: "empresa", lazy: page(() => import("@/pages/Empresa")) },
          { path: "privacidade", lazy: page(() => import("@/pages/Privacidade")) },
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
