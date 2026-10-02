import { Link } from "react-router-dom";
import { Eye, EyeOff, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { ProjectCover } from "@/components/ProjectCard";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/config/site";
import { useAsync } from "@/hooks/useAsync";
import { api, errorMessage } from "@/lib/api";
import type { Project } from "@/lib/types";
import { Empty, PageHeader, useConfirm, useToast } from "../ui";

export default function Projects() {
  const { data, error, loading, reload } = useAsync(() => api.admin.projects.list(), []);
  const toast = useToast();
  const confirm = useConfirm();

  async function remove(p: Project) {
    const ok = await confirm({ title: `Excluir "${p.title}"?`, body: "A obra e todas as fotos serão apagadas definitivamente.", confirmLabel: "Excluir", danger: true });
    if (!ok) return;
    try {
      await api.admin.projects.remove(p.id);
      toast("ok", "Obra excluída.");
      reload();
    } catch (err) {
      toast("error", errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title="Obras"
        subtitle="Portfólio exibido no site. Somente obras publicadas aparecem para visitantes."
        actions={<Link to="/admin/obras/nova" className="btn btn-ink btn-sm"><Plus className="h-4 w-4" aria-hidden="true" /> Nova obra</Link>}
      />
      {error && <p role="alert" className="text-danger">{error}</p>}
      {loading && <p className="font-mono text-sm text-ink-3">Carregando…</p>}
      {data && data.items.length === 0 && <Empty>Nenhuma obra cadastrada. <Link to="/admin/obras/nova" className="font-semibold underline">Cadastre a primeira</Link>.</Empty>}
      {data && data.items.length > 0 && (
        <ul className="divide-y divide-line border border-line bg-paper">
          {data.items.map((p) => (
            <li key={p.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="aspect-[4/3] w-full shrink-0 overflow-hidden border border-line sm:w-32">
                <ProjectCover project={p} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <Link to={`/admin/obras/${p.id}`} className="font-semibold hover:underline">{p.title}</Link>
                  {p.featured && <span className="label-mono inline-flex items-center gap-1 bg-signal-soft px-1.5 py-0.5 text-[0.6rem] text-signal-strong"><Star className="h-3 w-3" aria-hidden="true" />Destaque</span>}
                </p>
                <p className="mt-1 text-xs text-ink-3">{CATEGORY_LABEL[p.category]} · {STATUS_LABEL[p.status]} · {p.city} · {p.imageCount ?? 0} foto(s)</p>
              </div>
              <span className={`label-mono inline-flex items-center gap-1.5 text-[0.65rem] ${p.published ? "text-ok" : "text-ink-3"}`}>
                {p.published ? <Eye className="h-3.5 w-3.5" aria-hidden="true" /> : <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />}
                {p.published ? "Publicada" : "Rascunho"}
              </span>
              <div className="flex gap-2">
                <Link to={`/admin/obras/${p.id}`} className="btn btn-ghost btn-sm"><Pencil className="h-4 w-4" aria-hidden="true" /> Editar</Link>
                <button type="button" onClick={() => remove(p)} className="btn btn-sm border border-line text-danger hover:border-danger" aria-label={`Excluir ${p.title}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
