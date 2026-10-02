import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { api, ApiError, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/estimate";
import { useAuth } from "../AdminApp";
import { PageHeader, useToast } from "../ui";

const ACTION_LABEL: Record<string, string> = {
  "login.success": "Login realizado",
  "login.failed": "Tentativa de login com senha errada",
  "login.locked": "Conta bloqueada temporariamente",
  logout: "Saiu do painel",
  "password.changed": "Senha alterada",
  "quote.update": "Pedido atualizado",
  "quote.delete": "Pedido excluído",
  "quotes.export": "Pedidos exportados (CSV)",
  "project.create": "Obra criada",
  "project.update": "Obra editada",
  "project.delete": "Obra excluída",
  "images.upload": "Fotos enviadas",
  "image.delete": "Foto excluída",
  "simulator.update": "Valores do simulador alterados",
};

export default function Account() {
  const { admin } = useAuth();
  const toast = useToast();
  const audit = useAsync(() => api.admin.audit(), []);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api.auth.changePassword(current, next);
      setCurrent(""); setNext("");
      toast("ok", "Senha alterada. As outras sessões foram encerradas.");
      audit.reload();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      toast("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Conta e segurança" subtitle={admin ? `${admin.name} · ${admin.email}` : undefined} />
      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <form onSubmit={onSubmit} className="space-y-5 self-start border border-line bg-paper p-6">
          <h2 className="font-bold">Alterar senha</h2>
          {/* campo oculto ajuda gerenciadores de senha a associar a conta */}
          <input type="email" autoComplete="username" value={admin?.email ?? ""} readOnly hidden />
          <div>
            <label htmlFor="current-password" className="field-label">Senha atual</label>
            <input id="current-password" type="password" autoComplete="current-password" required maxLength={256} className="field"
              value={current} onChange={(e) => setCurrent(e.target.value)} aria-invalid={!!errors.currentPassword || undefined} />
            {errors.currentPassword && <p className="mt-1.5 text-sm font-medium text-danger">{errors.currentPassword}</p>}
          </div>
          <div className="pw-field">
            <label htmlFor="new-password" className="field-label">Nova senha</label>
            <p id="pw-rules" className="field-hint">Mínimo de 12 caracteres, com letras e números. Uma frase longa é uma ótima senha.</p>
            <input id="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}
              pattern="(?=.*[A-Za-z])(?=.*\d).{12,128}" className="field" aria-describedby="pw-rules"
              value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={!!errors.newPassword || undefined} />
            <p className="field-error">A senha não atende aos requisitos acima.</p>
            {errors.newPassword && <p className="mt-1.5 text-sm font-medium text-danger">{errors.newPassword}</p>}
          </div>
          <button type="submit" className="btn btn-ink" disabled={saving}>{saving ? "Salvando…" : "Alterar senha"}</button>
        </form>

        <section className="border border-line bg-paper" aria-labelledby="audit-t">
          <div className="flex items-center gap-2 border-b border-line p-5">
            <ShieldCheck className="h-4 w-4 text-ok" aria-hidden="true" />
            <h2 id="audit-t" className="font-bold">Registro de atividades</h2>
          </div>
          {audit.loading && <p className="p-5 font-mono text-sm text-ink-3">Carregando…</p>}
          {audit.error && <p className="p-5 text-danger">{audit.error}</p>}
          <ul className="max-h-[520px] divide-y divide-line overflow-y-auto text-sm">
            {audit.data?.items.map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-4 px-5 py-3">
                <span>
                  <span className={a.action.startsWith("login.f") || a.action.startsWith("login.l") ? "font-semibold text-danger" : "font-medium"}>{ACTION_LABEL[a.action] ?? a.action}</span>
                  {a.entityId && a.entity !== "admin" && <span className="ml-1.5 font-mono text-xs text-ink-3">#{a.entityId}</span>}
                  <span className="block text-xs text-ink-3">{a.adminName ?? "—"}</span>
                </span>
                <span className="whitespace-nowrap font-mono text-xs text-ink-3">{formatDate(a.createdAt, true)}</span>
              </li>
            ))}
            {audit.data?.items.length === 0 && <li className="p-5 text-ink-3">Nenhuma atividade registrada.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
