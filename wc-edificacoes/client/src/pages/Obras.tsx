import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SectionLabel } from "@/components/Brand";
import { ProjectCard, ProjectCardSkeleton } from "@/components/ProjectCard";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/config/site";
import { useSeo } from "@/hooks/useSeo";
import { api, errorMessage } from "@/lib/api";
import type { Category, Project, ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE = 9;
const isCategory = (v: string | null): v is Category => !!v && v in CATEGORY_LABEL;
const isStatus = (v: string | null): v is ProjectStatus => !!v && v in STATUS_LABEL;

export default function Obras() {
  useSeo("Obras", "Portfólio de obras residenciais, comerciais, industriais e reformas executadas pela WC Edificações.");
  const [params, setParams] = useSearchParams();
  // Valores da URL são validados contra listas fixas antes de serem usados
  const category = isCategory(params.get("tipo")) ? (params.get("tipo") as Category) : undefined;
  const status = isStatus(params.get("fase")) ? (params.get("fase") as ProjectStatus) : undefined;

  const [items, setItems] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.projects.list({ category, status, page, limit: PAGE })
      .then((res) => {
        if (!active) return;
        setItems((prev) => (page === 1 ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
      })
      .catch((err) => active && setError(errorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [category, status, page]);

  const setFilter = (key: "tipo" | "fase", value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setPage(1);
    setParams(next, { replace: true });
  };

  return (
    <>
      <section className="border-b border-line">
        <div className="container pb-12 pt-14 md:pb-16 md:pt-20">
          <SectionLabel>Portfólio</SectionLabel>
          <div className="mt-5 grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
            <h1 className="text-display-xl uppercase">Obras</h1>
            <p className="max-w-md text-lg leading-relaxed text-ink-3">
              Projetos entregues, em execução e em lançamento. Filtre por tipo e fase para encontrar obras parecidas com a sua.
            </p>
          </div>
        </div>
      </section>

      <div className="sticky top-[var(--header-h)] z-30 border-b border-line bg-concrete/95 backdrop-blur supports-[backdrop-filter]:bg-concrete/80">
        <div className="container flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterGroup label="Tipo" value={category} options={CATEGORY_LABEL} onChange={(v) => setFilter("tipo", v)} />
          <FilterGroup label="Fase" value={status} options={STATUS_LABEL} onChange={(v) => setFilter("fase", v)} />
        </div>
      </div>

      <section className="container py-12 md:py-16" aria-live="polite" aria-busy={loading}>
        <p className="label-mono mb-6 text-ink-3">
          {loading && page === 1 ? "Carregando…" : `${total} ${total === 1 ? "obra encontrada" : "obras encontradas"}`}
        </p>
        {error && <p role="alert" className="border border-danger/40 bg-[#fbefed] p-4 text-danger">{error}</p>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p, i) => <ProjectCard key={p.id} project={p} index={i} />)}
          {loading && Array.from({ length: page === 1 ? 6 : 3 }).map((_, i) => <ProjectCardSkeleton key={`s${i}`} />)}
        </div>
        {!loading && !error && items.length === 0 && (
          <div className="border border-dashed border-line p-12 text-center">
            <p className="text-lg font-semibold">Nenhuma obra com esses filtros.</p>
            <button type="button" className="btn btn-ghost mt-5" onClick={() => { setPage(1); setParams({}, { replace: true }); }}>Limpar filtros</button>
          </div>
        )}
        {!loading && items.length < total && (
          <div className="mt-10 flex justify-center">
            <button type="button" className="btn btn-ink" onClick={() => setPage((p) => p + 1)}>Carregar mais obras</button>
          </div>
        )}
      </section>
    </>
  );
}

function FilterGroup({ label, value, options, onChange }: {
  label: string; value?: string; options: Record<string, string>; onChange: (v?: string) => void;
}) {
  return (
    <div role="group" aria-label={`Filtrar por ${label.toLowerCase()}`} className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] -mx-1 px-1">
      <span className="label-mono mr-1 shrink-0 text-ink-3">{label}</span>
      <Chip active={!value} onClick={() => onChange(undefined)}>Todas</Chip>
      {Object.entries(options).map(([k, v]) => (
        <Chip key={k} active={value === k} onClick={() => onChange(k)}>{v}</Chip>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "shrink-0 border px-3.5 py-2 text-sm font-medium transition-colors",
        active ? "border-ink bg-ink text-paper" : "border-line bg-paper hover:border-ink",
      )}
    >
      {children}
    </button>
  );
}
