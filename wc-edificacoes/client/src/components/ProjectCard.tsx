import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { ProjectArt } from "@/components/ProjectArt";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/config/site";
import { num } from "@/lib/estimate";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusPill({ status, className }: { status: Project["status"]; className?: string }) {
  return (
    <span className={cn("label-mono inline-flex items-center gap-1.5 bg-paper/95 px-2 py-1 text-[0.62rem] text-ink", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "concluida" && "bg-ok",
          status === "em_andamento" && "bg-signal animate-pulse motion-reduce:animate-none",
          status === "lancamento" && "bg-ink-3",
        )}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ProjectCover({ project, priority = false, className }: { project: Project; priority?: boolean; className?: string }) {
  if (project.cover) {
    return (
      <img
        src={project.cover.thumbUrl}
        alt={project.cover.alt || project.title}
        width={project.cover.width}
        height={project.cover.height}
        loading={priority ? undefined : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  return (
    <ProjectArt
      seed={project.slug}
      category={project.category}
      status={project.status}
      className={cn("h-full w-full bg-concrete-2", className)}
      label={`Desenho ilustrativo da fachada de ${project.title}`}
    />
  );
}

export function ProjectCard({ project, index, size = "md" }: { project: Project; index?: number; size?: "md" | "lg" }) {
  return (
    <article className="group relative flex flex-col bg-paper reveal">
      <div className={cn("relative overflow-hidden border-b border-line", size === "lg" ? "aspect-[16/10]" : "aspect-[4/3]")}>
        <div className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none">
          <ProjectCover project={project} />
        </div>
        <StatusPill status={project.status} className="absolute left-3 top-3" />
        {index !== undefined && (
          <span className="label-mono absolute right-3 top-3 text-ink/60">{String(index + 1).padStart(2, "0")}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5 md:p-6">
        <p className="label-mono text-ink-3">{CATEGORY_LABEL[project.category]} · {project.city}</p>
        <h3 className={cn("font-bold leading-tight text-balance", size === "lg" ? "text-2xl md:text-3xl" : "text-xl")}>
          <Link to={`/obras/${project.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {project.title}
          </Link>
        </h3>
        <p className="text-sm leading-relaxed text-ink-3 line-clamp-3">{project.summary}</p>
        <dl className="mt-auto grid grid-cols-3 border-t border-line pt-4 font-mono text-xs">
          <div><dt className="text-ink-3">Área</dt><dd className="mt-0.5 font-medium tabular">{project.areaM2 ? `${num(project.areaM2)} m²` : "—"}</dd></div>
          <div><dt className="text-ink-3">Ano</dt><dd className="mt-0.5 font-medium tabular">{project.year ?? "—"}</dd></div>
          <div><dt className="text-ink-3">Prazo</dt><dd className="mt-0.5 font-medium tabular">{project.durationMonths ? `${project.durationMonths} meses` : "—"}</dd></div>
        </dl>
      </div>
      <span aria-hidden="true" className="absolute bottom-5 right-5 grid h-9 w-9 place-items-center bg-ink text-paper opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <ArrowUpRight className="h-4 w-4" />
      </span>
    </article>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="bg-paper" aria-hidden="true">
      <div className="aspect-[4/3] animate-pulse bg-concrete-2 motion-reduce:animate-none" />
      <div className="space-y-3 p-6">
        <div className="h-3 w-1/3 bg-concrete-2" />
        <div className="h-5 w-3/4 bg-concrete-2" />
        <div className="h-3 w-full bg-concrete-2" />
      </div>
    </div>
  );
}
