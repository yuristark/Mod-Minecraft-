import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/config/site";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { Category, ProjectImage, ProjectInput, ProjectStatus } from "@/lib/types";
import { PageHeader, useConfirm, useToast } from "../ui";

const EMPTY: ProjectInput = {
  title: "", slug: "", category: "residencial", status: "concluida", city: "", areaM2: null, year: new Date().getFullYear(),
  durationMonths: null, summary: "", description: "", featured: false, published: false,
};
const MAX_MB = 8;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ProjectEdit() {
  const { id: idParam } = useParams();
  const id = idParam && /^\d+$/.test(idParam) ? Number(idParam) : null;
  const isNew = id === null;
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState<ProjectInput>(EMPTY);
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew) { setForm(EMPTY); setImages([]); setLoading(false); return; }
    let active = true;
    setLoading(true);
    api.admin.projects.get(id)
      .then((p) => {
        if (!active) return;
        setForm({ title: p.title, slug: p.slug, category: p.category, status: p.status, city: p.city, areaM2: p.areaM2, year: p.year,
          durationMonths: p.durationMonths, summary: p.summary, description: p.description, featured: p.featured, published: p.published });
        setImages(p.images ?? []);
      })
      .catch((err) => { toast("error", errorMessage(err)); navigate("/admin/obras", { replace: true }); })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id, isNew, navigate, toast]);

  const set = <K extends keyof ProjectInput>(k: K, v: ProjectInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => { if (!e[k]) return e; const n = { ...e }; delete n[k]; return n; });
  };
  const numOrNull = (v: string) => (v === "" ? null : Number(v));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const payload = { ...form, slug: form.slug?.trim() || "" };
      if (isNew) {
        const r = await api.admin.projects.create(payload);
        toast("ok", "Obra criada. Agora adicione as fotos.");
        navigate(`/admin/obras/${r.id}`, { replace: true });
      } else {
        const r = await api.admin.projects.update(id, payload);
        set("slug", r.slug);
        toast("ok", "Alterações salvas.");
      }
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      toast("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onFiles(list: FileList | null) {
    if (!list || id === null) return;
    const files = Array.from(list).slice(0, 10);
    // Validação no navegador só melhora a experiência; o servidor valida de verdade
    const bad = files.find((f) => !TYPES.includes(f.type) || f.size > MAX_MB * 1024 * 1024);
    if (bad) { toast("error", `"${bad.name}" não é JPG/PNG/WebP ou passa de ${MAX_MB} MB.`); return; }
    setUploading(true);
    try {
      const r = await api.admin.projects.uploadImages(id, files);
      setImages((prev) => [...prev, ...r.items]);
      toast("ok", `${r.items.length} foto(s) enviada(s).`);
    } catch (err) {
      toast("error", errorMessage(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function move(index: number, delta: number) {
    const j = index + delta;
    if (j < 0 || j >= images.length) return;
    const a = images[index]; const b = images[j];
    const next = images.slice();
    next[index] = { ...b, position: a.position };
    next[j] = { ...a, position: b.position };
    // posições iguais (legado) → normaliza pela ordem atual
    const pa = a.position === b.position ? j : b.position;
    const pb = a.position === b.position ? index : a.position;
    setImages(next);
    try {
      await Promise.all([api.admin.images.update(a.id, { position: pa }), api.admin.images.update(b.id, { position: pb })]);
    } catch (err) {
      toast("error", errorMessage(err));
    }
  }

  async function saveAlt(img: ProjectImage, alt: string) {
    if (alt === img.alt) return;
    try {
      const u = await api.admin.images.update(img.id, { alt });
      setImages((l) => l.map((x) => (x.id === img.id ? { ...x, alt: u.alt } : x)));
      toast("ok", "Descrição salva.");
    } catch (err) {
      toast("error", errorMessage(err));
    }
  }

  async function removeImage(img: ProjectImage) {
    if (!(await confirm({ title: "Excluir esta foto?", confirmLabel: "Excluir", danger: true }))) return;
    try {
      await api.admin.images.remove(img.id);
      setImages((l) => l.filter((x) => x.id !== img.id));
    } catch (err) {
      toast("error", errorMessage(err));
    }
  }

  if (loading) return <p className="font-mono text-sm text-ink-3">Carregando…</p>;
  const err = (k: string) => errors[k] ? <p className="mt-1.5 text-sm font-medium text-danger">{errors[k]}</p> : null;
  const inv = (k: string) => (errors[k] ? { "aria-invalid": true as const } : {});

  return (
    <>
      <Link to="/admin/obras" className="label-mono mb-4 inline-flex items-center gap-2 text-ink-3 hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Obras</Link>
      <PageHeader title={isNew ? "Nova obra" : "Editar obra"} subtitle={!isNew && form.published ? `Publicada em /obras/${form.slug}` : undefined} />

      <div className="grid gap-8 xl:grid-cols-[1.3fr_1fr]">
        <form onSubmit={onSubmit} className="space-y-5 border border-line bg-paper p-5 md:p-7">
          <div>
            <label htmlFor="title" className="field-label">Título</label>
            <input id="title" className="field" required minLength={3} maxLength={140} value={form.title} onChange={(e) => set("title", e.target.value)} {...inv("title")} />
            {err("title")}
          </div>
          <div>
            <label htmlFor="slug" className="field-label">Endereço (slug) <span className="font-normal text-ink-3">— deixe vazio para gerar automaticamente</span></label>
            <input id="slug" className="field font-mono text-sm" maxLength={140} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug ?? ""} onChange={(e) => set("slug", e.target.value.toLowerCase())} {...inv("slug")} />
            {err("slug")}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="category" className="field-label">Tipo</label>
              <select id="category" className="field" value={form.category} onChange={(e) => set("category", e.target.value as Category)}>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="status" className="field-label">Fase</label>
              <select id="status" className="field" value={form.status} onChange={(e) => set("status", e.target.value as ProjectStatus)}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="city" className="field-label">Cidade</label>
              <input id="city" className="field" required minLength={2} maxLength={100} value={form.city} onChange={(e) => set("city", e.target.value)} {...inv("city")} />
              {err("city")}
            </div>
            <div>
              <label htmlFor="area" className="field-label">Área (m²)</label>
              <input id="area" type="number" min={1} max={1000000} step="0.01" className="field font-mono" value={form.areaM2 ?? ""} onChange={(e) => set("areaM2", numOrNull(e.target.value))} {...inv("areaM2")} />
              {err("areaM2")}
            </div>
            <div>
              <label htmlFor="year" className="field-label">Ano de entrega / previsão</label>
              <input id="year" type="number" min={1950} max={2100} className="field font-mono" value={form.year ?? ""} onChange={(e) => set("year", numOrNull(e.target.value))} {...inv("year")} />
              {err("year")}
            </div>
            <div>
              <label htmlFor="duration" className="field-label">Prazo de execução (meses)</label>
              <input id="duration" type="number" min={1} max={240} className="field font-mono" value={form.durationMonths ?? ""} onChange={(e) => set("durationMonths", numOrNull(e.target.value))} {...inv("durationMonths")} />
              {err("durationMonths")}
            </div>
          </div>
          <div>
            <label htmlFor="summary" className="field-label">Resumo <span className="font-normal text-ink-3">(aparece nos cards — até 280 caracteres)</span></label>
            <textarea id="summary" className="field min-h-[90px]" required minLength={10} maxLength={280} value={form.summary} onChange={(e) => set("summary", e.target.value)} {...inv("summary")} />
            <p className="mt-1 text-right font-mono text-xs text-ink-3">{form.summary.length}/280</p>
            {err("summary")}
          </div>
          <div>
            <label htmlFor="description" className="field-label">Descrição completa <span className="font-normal text-ink-3">(separe parágrafos com uma linha em branco)</span></label>
            <textarea id="description" className="field min-h-[200px]" maxLength={8000} value={form.description} onChange={(e) => set("description", e.target.value)} {...inv("description")} />
            {err("description")}
          </div>
          <div className="flex flex-wrap gap-6 border-t border-line pt-5">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
              <input type="checkbox" className="h-4 w-4 accent-[#17181a]" checked={form.published} onChange={(e) => set("published", e.target.checked)} /> Publicada no site
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
              <input type="checkbox" className="h-4 w-4 accent-[#17181a]" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} /> Destaque na página inicial
            </label>
          </div>
          <button type="submit" className="btn btn-signal" disabled={saving}>{saving ? "Salvando…" : isNew ? "Criar obra" : "Salvar alterações"}</button>
        </form>

        <section className="border border-line bg-paper p-5 md:p-7" aria-labelledby="fotos-t">
          <h2 id="fotos-t" className="font-bold">Fotos</h2>
          {isNew ? (
            <p className="mt-3 text-sm text-ink-3">Salve a obra primeiro para enviar fotos.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-ink-3">A primeira foto é a capa. JPG, PNG ou WebP até {MAX_MB} MB. Os metadados (GPS, câmera) são removidos automaticamente no servidor.</p>
              <label className="mt-5 flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-line p-8 text-center hover:border-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal-strong">
                <ImagePlus className="h-6 w-6 text-ink-3" aria-hidden="true" />
                <span className="text-sm font-semibold">{uploading ? "Enviando…" : "Selecionar fotos"}</span>
                <span className="text-xs text-ink-3">até 10 por vez</span>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={uploading} onChange={(e) => onFiles(e.target.files)} />
              </label>
              <ul className="mt-5 space-y-3">
                {images.map((img, i) => (
                  <li key={img.id} className="flex gap-3 border border-line p-2">
                    <img src={img.thumbUrl} alt="" width={img.width} height={img.height} className="aspect-square w-20 shrink-0 object-cover" />
                    <div className="min-w-0 flex-1">
                      {i === 0 && <span className="label-mono bg-ink px-1.5 py-0.5 text-[0.58rem] text-paper">Capa</span>}
                      <label htmlFor={`alt-${img.id}`} className="mt-1 block text-xs text-ink-3">Descrição da foto (acessibilidade e Google)</label>
                      <input id={`alt-${img.id}`} defaultValue={img.alt} maxLength={200} className="field mt-1 h-9 text-sm" onBlur={(e) => saveAlt(img, e.target.value.trim())} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <button type="button" className="grid h-8 w-8 place-items-center border border-line disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Mover para cima"><ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /></button>
                      <button type="button" className="grid h-8 w-8 place-items-center border border-line disabled:opacity-30" disabled={i === images.length - 1} onClick={() => move(i, 1)} aria-label="Mover para baixo"><ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /></button>
                      <button type="button" className="grid h-8 w-8 place-items-center border border-line text-danger" onClick={() => removeImage(img)} aria-label="Excluir foto"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </>
  );
}
