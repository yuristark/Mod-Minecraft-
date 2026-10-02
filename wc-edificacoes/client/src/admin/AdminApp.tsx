import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Building2, Calculator, ExternalLink, Inbox, LayoutDashboard, LogOut, Menu, UserCog, X } from "lucide-react";
import { Logo } from "@/components/Brand";
import { api, IS_DEMO, onUnauthorized, setCsrfToken } from "@/lib/api";
import type { Admin } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ConfirmProvider, ToastProvider } from "./ui";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Quotes from "./pages/Quotes";
import Projects from "./pages/Projects";
import ProjectEdit from "./pages/ProjectEdit";
import SimulatorSettingsPage from "./pages/SimulatorSettings";
import Account from "./pages/Account";

interface AuthState {
  admin: Admin | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const AuthCtx = createContext<AuthState>(null as unknown as AuthState);
export const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.auth.me()
      .then((r) => { if (active) { setCsrfToken(r.csrfToken); setAdmin(r.admin); } })
      .catch(() => active && setAdmin(null))
      .finally(() => active && setLoading(false));
    const off = onUnauthorized(() => { setCsrfToken(null); setAdmin(null); });
    return () => { active = false; off(); };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.auth.login(email, password);
    setCsrfToken(r.csrfToken);
    setAdmin(r.admin);
  }, []);

  const logout = useCallback(async () => {
    try { await api.auth.logout(); } finally { setCsrfToken(null); setAdmin(null); }
  }, []);

  return <AuthCtx.Provider value={{ admin, loading, login, logout }}>{children}</AuthCtx.Provider>;
}

function RequireAuth() {
  const { admin, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="grid min-h-screen place-items-center font-mono text-sm text-ink-3">Verificando sessão…</div>;
  if (!admin) return <Navigate to="/admin/entrar" replace state={{ from: location.pathname }} />;
  return <AdminLayout />;
}

const NAV = [
  { to: "/admin", label: "Visão geral", icon: LayoutDashboard, end: true },
  { to: "/admin/orcamentos", label: "Orçamentos", icon: Inbox },
  { to: "/admin/obras", label: "Obras", icon: Building2 },
  { to: "/admin/simulador", label: "Simulador", icon: Calculator },
  { to: "/admin/conta", label: "Conta e segurança", icon: UserCog },
];

function AdminLayout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  const doLogout = async () => { await logout(); navigate("/admin/entrar", { replace: true }); };

  const sidebar = (
    <div className="on-dark flex h-full flex-col bg-ink text-paper">
      <div className="flex h-16 items-center justify-between border-b border-paper/10 px-5">
        <Logo tone="light" />
        <button type="button" className="lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu"><X className="h-5 w-5" aria-hidden="true" /></button>
      </div>
      <nav aria-label="Painel" className="flex-1 space-y-1 p-3">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors", isActive ? "bg-paper text-ink" : "text-paper/75 hover:bg-paper/10 hover:text-paper")}>
            <n.icon className="h-4 w-4" aria-hidden="true" /> {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-1 border-t border-paper/10 p-3 text-sm">
        <a href={import.meta.env.VITE_ROUTER === "hash" ? "#/" : "/"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2.5 text-paper/75 hover:text-paper"><ExternalLink className="h-4 w-4" aria-hidden="true" /> Ver site</a>
        <button type="button" onClick={doLogout} className="flex w-full items-center gap-3 px-3 py-2.5 text-paper/75 hover:text-paper"><LogOut className="h-4 w-4" aria-hidden="true" /> Sair</button>
        <p className="truncate px-3 pt-2 font-mono text-[0.68rem] text-paper/45">{admin?.email}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-concrete lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-ink/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px]">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-line bg-paper px-4 lg:hidden">
          <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menu" className="grid h-10 w-10 place-items-center border border-line"><Menu className="h-5 w-5" aria-hidden="true" /></button>
          <span className="font-bold uppercase stretch-wide">Painel</span>
          <span className="w-10" />
        </header>
        {IS_DEMO && <p className="bg-signal px-4 py-1.5 text-center font-mono text-[0.68rem] uppercase tracking-wider text-ink">Painel de demonstração · alterações não são salvas</p>}
        <main className="mx-auto max-w-6xl p-4 md:p-8 lg:p-10"><Outlet /></main>
      </div>
    </div>
  );
}

export default function AdminApp() {
  useEffect(() => {
    // O painel não deve ser indexado por buscadores
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    const prev = document.title;
    document.title = "Painel · WC Edificações";
    return () => { meta.remove(); document.title = prev; };
  }, []);

  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <Routes>
            <Route path="entrar" element={<Login />} />
            <Route element={<RequireAuth />}>
              <Route index element={<Dashboard />} />
              <Route path="orcamentos" element={<Quotes />} />
              <Route path="obras" element={<Projects />} />
              <Route path="obras/nova" element={<ProjectEdit />} />
              <Route path="obras/:id" element={<ProjectEdit />} />
              <Route path="simulador" element={<SimulatorSettingsPage />} />
              <Route path="conta" element={<Account />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
