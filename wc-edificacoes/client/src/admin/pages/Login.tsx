import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock } from "lucide-react";
import { LogoMark } from "@/components/Brand";
import { ProjectArt } from "@/components/ProjectArt";
import { site } from "@/config/site";
import { errorMessage, IS_DEMO } from "@/lib/api";
import { DEMO_LOGIN } from "@/lib/mock";
import { useAuth } from "../AdminApp";

/** Só aceita voltar para rotas internas do painel (evita "open redirect"). */
function safeFrom(v: unknown) {
  return typeof v === "string" && /^\/admin(\/[a-z0-9\-/]*)?$/.test(v) && !v.includes("//") ? v : "/admin";
}

export default function Login() {
  const { admin, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(IS_DEMO ? DEMO_LOGIN.email : "");
  const [password, setPassword] = useState(IS_DEMO ? DEMO_LOGIN.password : "");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!loading && admin) return <Navigate to="/admin" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await login(email, password);
      setPassword("");
      navigate(safeFrom((location.state as { from?: string } | null)?.from), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-concrete lg:grid-cols-2">
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          <LogoMark className="h-11 w-11 text-ink" />
          <h1 className="mt-8 text-3xl font-bold uppercase stretch-wide">Área restrita</h1>
          <p className="mt-2 text-sm text-ink-3">Acesso exclusivo para a equipe da {site.name}.</p>

          {IS_DEMO && (
            <p className="mt-6 border border-ink/20 bg-paper p-3 font-mono text-xs leading-relaxed">
              Demonstração — dados de acesso já preenchidos:<br />{DEMO_LOGIN.email}<br />{DEMO_LOGIN.password}
            </p>
          )}

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            {error && <p role="alert" className="border-l-4 border-danger bg-[#fbefed] p-3 text-sm font-medium text-danger">{error}</p>}
            <div>
              <label htmlFor="email" className="field-label">E-mail</label>
              <input id="email" name="email" type="email" autoComplete="username" required maxLength={160} className="field"
                value={email} onChange={(e) => setEmail(e.target.value)} enterKeyHint="next" />
            </div>
            <div>
              <label htmlFor="current-password" className="field-label">Senha</label>
              <div className="relative">
                <input id="current-password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required maxLength={256}
                  className="field pr-12" value={password} onChange={(e) => setPassword(e.target.value)} enterKeyHint="done" />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center text-ink-3 hover:text-ink"
                  aria-label={show ? "Ocultar senha" : "Mostrar senha"} aria-pressed={show}>
                  {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-ink w-full" disabled={sending}>
              <Lock className="h-4 w-4" aria-hidden="true" /> {sending ? "Entrando…" : "Entrar no painel"}
            </button>
            <p className="text-xs text-ink-3">Esqueceu a senha? Peça ao responsável técnico do site para redefini-la pelo servidor.</p>
          </form>
        </div>
      </div>
      <div className="on-dark relative hidden overflow-hidden bg-ink lg:block">
        <div className="absolute inset-0 blueprint-grid text-paper" aria-hidden="true" />
        <div className="relative flex h-full items-center p-12">
          <ProjectArt seed="painel-login" category="industrial" status="em_andamento" tone="dark" animate className="h-auto w-full" />
        </div>
      </div>
    </div>
  );
}
