import "./polyfills";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, createHashRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import { routes } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Em produção usamos URLs limpas (/obras). Na demonstração (arquivo único), rotas com # .
// Roteador "de dados" (createBrowserRouter): necessário para as View Transitions entre páginas.
const createRouter = import.meta.env.VITE_ROUTER === "hash" ? createHashRouter : createBrowserRouter;
const router = createRouter(routes);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>,
);
