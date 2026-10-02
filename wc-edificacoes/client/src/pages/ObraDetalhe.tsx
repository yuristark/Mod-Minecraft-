import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Expand, Share2, X } from "lucide-react";
import { Link } from "@/components/Link";
import { Modal } from "@/components/Modal";
import { ProjectArt } from "@/components/ProjectArt";
import { ProjectCard, StatusPill } from "@/components/ProjectCard";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/config/site";
import { useAsync } from "@/hooks/useAsync";
import { useSeo } from "@/hooks/useSeo";
import { api } from "@/lib/api";
import { num } from "@/lib/estimate";
import { shareLink } from "@/lib/share";
import { heroName, StaggerItem, Staggered } from "@/motion/flutter";
import { curves, durations } from "@/motion/tokens";
import { Reveal, SplitWords } from "@/motion/ui";
import NotFound from "./NotFound";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default function ObraDetalhe() {
  const { slug = "" } = useParams();
  const valid = SLUG_RE.test(slug) && slug.length <= 140;
  const { data, error, loading } = useAsync(
    () => (valid ? api.projects.get(slug) : Promise.reject(new Error("invalid"))),
    [slug, valid],
  );
  // `data` pode ser da obra anterior enquanto a nova carrega; o resumo da listagem (peek) cobre esse intervalo
  const full = data && data.slug === slug ? data : null;
  const project = full ?? (valid ? api.projects.peek(slug) : null);
  const related = useAsync(
    () => (project ? api.projects.list({ category: project.category, limit: 4 }) : Promise.resolve(null)),
    [project?.category],
  );
  const [lightbox, setLightbox] = useState<number | null>(null);
  useSeo(project?.title ?? (loading ? "Carregando obra" : "Obra"), project?.summary);

  if (!valid || (!loading && error)) return <NotFound title="Obra não encontrada" />;
  if (!project) {
    return <div className="container py-24" aria-busy="true"><div className="shimmer h-12 w-2/3" /></div>;
  }

  const images = full?.images ?? [];
  const others = (related.data?.items ?? []).filter((p) => p.id !== project.id).slice(0, 3);
  const paragraphs = (full?.description ?? "").split(/\n{2,}/).filter(Boolean);

  return (
    <>
      <article>
        <header className="border-b border-line">
          <div className="container pb-10 pt-10 md:pt-14">
            <Link to="/obras" className="label-mono inline-flex items-center gap-2 text-ink-3 hover:text-ink">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Todas as obras
            </Link>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <StatusPill status={project.status} className="border border-line" />
              <span className="label-mono text-ink-3">{CATEGORY_LABEL[project.category]}</span>
              <button
                type="button"
                onClick={() => shareLink({ title: project.title, text: project.summary })}
                className="ml-auto inline-flex items-center gap-2 border border-line bg-paper px-3 py-2 text-sm font-medium transition-colors hover:border-ink"
              >
                <Share2 className="h-4 w-4" aria-hidden="true" /> Compartilhar
              </button>
            </div>
            <h1 className="mt-5 max-w-5xl text-display-lg uppercase text-balance"><SplitWords key={project.slug} text={project.title} gap={0.04} /></h1>
            <Reveal delay={0.3} y={16}><p className="mt-6 max-w-3xl text-xl leading-relaxed text-ink-3 text-pretty">{project.summary}</p></Reveal>
          </div>
        </header>

        {/* Imagem principal */}
        <div className="container mt-10" style={heroName(`obra-${project.slug}`)}>
          {images.length > 0 ? (
            <button type="button" onClick={() => setLightbox(0)} className="group relative block w-full overflow-hidden bg-concrete-2" aria-label="Ampliar imagem principal">
              <img
                src={images[0].url}
                alt={images[0].alt || project.title}
                width={images[0].width}
                height={images[0].height}
                fetchPriority="high"
                className="aspect-[16/9] w-full object-cover transition-transform [transition-duration:1400ms] [transition-timing-function:var(--ease-out-expo)] group-hover:scale-[1.03]"
              />
              <span className="absolute bottom-4 right-4 inline-flex items-center gap-2 bg-ink/85 px-3 py-2 text-sm text-paper">
                <Expand className="h-4 w-4" aria-hidden="true" /> {images.length} {images.length === 1 ? "foto" : "fotos"}
              </span>
            </button>
          ) : !full && project.cover ? (
            <img src={project.cover.thumbUrl} alt={project.cover.alt || project.title} width={project.cover.width} height={project.cover.height} className="aspect-[16/9] w-full bg-concrete-2 object-cover" />
          ) : (
            <div className="border border-line bg-concrete-2">
              <ProjectArt seed={project.slug} category={project.category} status={project.status} animate fit="meet" className="aspect-[16/8] h-auto w-full" label={`Desenho ilustrativo da fachada de ${project.title}`} />
            </div>
          )}
        </div>

        <div className="container grid gap-12 py-14 lg:grid-cols-[1fr_340px] lg:gap-20">
          <div className="max-w-2xl space-y-5 text-lg leading-relaxed text-ink-2">
            {!full && <div aria-busy="true" className="space-y-3"><div className="shimmer h-4 w-full" /><div className="shimmer h-4 w-11/12" /><div className="shimmer h-4 w-4/5" /></div>}
            {paragraphs.map((p, i) => <Reveal key={i} as="p" y={20} delay={i * 0.05} className="whitespace-pre-line text-pretty">{p}</Reveal>)}

            {images.length > 1 && (
              <div className="!mt-12">
                <h2 className="label-mono mb-4 text-ink-3">Galeria</h2>
                <Staggered as="ul" gap={0.05} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {images.slice(1).map((img, i) => (
                    <StaggerItem as="li" key={img.id}>
                      <button type="button" onClick={() => setLightbox(i + 1)} className="block w-full overflow-hidden bg-concrete-2" aria-label={`Ampliar foto ${i + 2}`}>
                        <img src={img.thumbUrl} alt={img.alt || `${project.title} — foto ${i + 2}`} width={img.width} height={img.height} loading="lazy" decoding="async" className="aspect-square w-full object-cover transition-transform duration-500 hover:scale-105" />
                      </button>
                    </StaggerItem>
                  ))}
                </Staggered>
              </div>
            )}
          </div>

          <aside className="lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:self-start">
            <dl className="divide-y divide-line border-y border-ink">
              <Spec label="Tipo" value={CATEGORY_LABEL[project.category]} />
              <Spec label="Fase" value={STATUS_LABEL[project.status]} />
              <Spec label="Local" value={project.city} />
              <Spec label="Área construída" value={project.areaM2 ? `${num(project.areaM2)} m²` : "—"} />
              <Spec label={project.status === "concluida" ? "Entrega" : "Previsão"} value={project.year ? String(project.year) : "—"} />
              <Spec label="Prazo de execução" value={project.durationMonths ? `${project.durationMonths} meses` : "—"} />
            </dl>
            <div className="mt-8 bg-ink p-6 text-paper on-dark">
              <p className="text-lg font-bold leading-snug">Quer uma obra parecida?</p>
              <p className="mt-2 text-sm text-paper/70">Conte o que você precisa e receba um orçamento detalhado.</p>
              <Link to={`/orcamento?tipo=${project.category}`} className="btn btn-signal mt-5 w-full">Pedir orçamento</Link>
            </div>
          </aside>
        </div>
      </article>

      {others.length > 0 && (
        <section className="border-t border-line bg-concrete-2/60 py-16" aria-labelledby="rel-titulo">
          <div className="container">
            <div className="flex items-end justify-between gap-4">
              <h2 id="rel-titulo" className="text-display-md uppercase">Mais obras · {CATEGORY_LABEL[project.category]}</h2>
              <Link to={`/obras?tipo=${project.category}`} className="hidden items-center gap-2 font-semibold text-signal-strong sm:inline-flex">Ver todas <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((p, i) => <Reveal key={p.id} delay={i * 0.1} className="h-full"><ProjectCard project={p} /></Reveal>)}
            </div>
          </div>
        </section>
      )}

      <Lightbox images={images} index={lightbox} onChange={setLightbox} title={project.title} />
    </>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3.5">
      <dt className="label-mono text-ink-3">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

function Lightbox({ images, index, onChange, title }: {
  images: { url: string; alt: string; width: number; height: number }[];
  index: number | null;
  onChange: (i: number | null) => void;
  title: string;
}) {
  const close = useCallback(() => onChange(null), [onChange]);
  const [dir, setDir] = useState(1);
  const go = useCallback((delta: number) => {
    if (index === null) return;
    setDir(delta);
    onChange((index + delta + images.length) % images.length);
  }, [index, images.length, onChange]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go]);

  const img = index !== null ? images[index] : null;
  return (
    <Modal open={index !== null} onClose={close} label={`Galeria de fotos — ${title}`}>
      {img && (
        <div className="relative flex h-[100dvh] w-screen items-center justify-center p-4 md:p-12">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.img
              key={img.url}
              src={img.url}
              alt={img.alt || title}
              width={img.width}
              height={img.height}
              className="max-h-full max-w-full object-contain"
              custom={dir}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: d * 80, scale: 0.98 }),
                center: { opacity: 1, x: 0, scale: 1 },
                exit: (d: number) => ({ opacity: 0, x: d * -80, scale: 0.98 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: durations.medium, ease: curves.fastOutSlowIn }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.6}
              onDragEnd={(_, info) => { if (info.offset.x < -80) go(1); else if (info.offset.x > 80) go(-1); }}
            />
          </AnimatePresence>
          <p className="label-mono absolute left-4 top-4 bg-ink/80 px-2 py-1 text-paper">{(index ?? 0) + 1} / {images.length}</p>
          <button type="button" onClick={close} className="absolute right-4 top-4 grid h-11 w-11 place-items-center bg-paper text-ink" aria-label="Fechar galeria"><X className="h-5 w-5" aria-hidden="true" /></button>
          {images.length > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} className="absolute left-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center bg-paper/90 text-ink" aria-label="Foto anterior"><ChevronLeft className="h-6 w-6" aria-hidden="true" /></button>
              <button type="button" onClick={() => go(1)} className="absolute right-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center bg-paper/90 text-ink" aria-label="Próxima foto"><ChevronRight className="h-6 w-6" aria-hidden="true" /></button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
