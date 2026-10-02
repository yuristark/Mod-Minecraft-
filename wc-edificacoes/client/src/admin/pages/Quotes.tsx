import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Mail, MessageCircle, Phone, Search, Trash2, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { CATEGORY_LABEL, QUOTE_STATUS_LABEL, STANDARD_LABEL, START_WINDOW_LABEL } from "@/config/site";
import { useAsync } from "@/hooks/useAsync";
import { api, errorMessage } from "@/lib/api";
import { brl, formatDate, formatPhone, num } from "@/lib/estimate";
import type { Quote, QuoteStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Empty, PageHeader, QuoteBadge, useConfirm, useToast } from "../ui";

const STATUSES = Object.keys(QUOTE_STATUS_LABEL) as QuoteStatus[];
const LIMIT = 20;

export default function Quotes() {
  const [params, setParams] = useSearchParams();
  const statusParam = params.get("status");
  const status = statusParam && STATUSES.includes(statusParam as QuoteStatus) ? (statusParam as QuoteStatus) : undefined;
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(() => {
    const n = Number(params.get("abrir"));
    return Number.isInteger(n) && n > 0 ? n : null;
  });
  const toast = useToast();
  const closeDrawer = useCallback(() => setOpenId(null), []);

  // Busca com "debounce" para não disparar uma requisição por tecla
  useEffect(() => {
    const t = window.setTimeout(() => { setQ(search.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data, error, loading, reload } = useAsync(() => api.admin.quotes.list({ status, q, page, limit: LIMIT }), [status, q, page]);
  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;

  const setStatus = (s?: QuoteStatus) => {
    const next = new URLSearchParams(params);
    if (s) next.set("status", s); else next.delete("status");
    next.delete("abrir");
    setParams(next, { replace: true });
    setPage(1);
  };

  async function exportCsv() {
    try {
      const blob = await api.admin.quotes.exportCsv({ status, q });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orcamentos-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      toast("error", errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title="Orçamentos"
        subtitle="Pedidos enviados pelo formulário do site."
        actions={<button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv}><Download className="h-4 w-4" aria-hidden="true" /> Exportar CSV</button>}
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Filtrar por status" className="flex gap-1 overflow-x-auto">
          {[undefined, ...STATUSES].map((s) => (
            <button key={s ?? "all"} role="tab" aria-selected={status === s} type="button" onClick={() => setStatus(s)}
              className={cn("shrink-0 border px-3 py-1.5 text-sm", status === s ? "border-ink bg-ink text-paper" : "border-line bg-paper hover:border-ink")}>
              {s ? QUOTE_STATUS_LABEL[s] : "Todos"}
            </button>
          ))}
        </div>
        <div className="relative lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <label htmlFor="busca" className="sr-only">Buscar</label>
          <input id="busca" type="search" placeholder="Nome, e-mail, cidade, protocolo…" maxLength={80} className="field h-10 pl-9 text-sm"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {error && <p role="alert" className="mb-4 text-danger">{error}</p>}
      <div className="overflow-x-auto border border-line bg-paper">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="label-mono border-b border-line text-left text-ink-3">
            <tr><th className="p-4 font-normal">Data</th><th className="p-4 font-normal">Cliente</th><th className="p-4 font-normal">Obra</th><th className="p-4 font-normal">Estimativa</th><th className="p-4 font-normal">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data?.items.map((item) => (
              <tr key={item.id} className="cursor-pointer hover:bg-concrete" onClick={() => setOpenId(item.id)}>
                <td className="whitespace-nowrap p-4 font-mono text-xs">{formatDate(item.createdAt, true)}<span className="block text-ink-3">{item.protocol}</span></td>
                <td className="p-4">
                  <button type="button" className="text-left font-semibold hover:underline" onClick={(e) => { e.stopPropagation(); setOpenId(item.id); }}>{item.name}</button>
                  <span className="block text-xs text-ink-3">{item.city}</span>
                </td>
                <td className="p-4">{CATEGORY_LABEL[item.projectType]}{item.areaM2 ? <span className="block font-mono text-xs text-ink-3">{num(item.areaM2)} m²</span> : null}</td>
                <td className="whitespace-nowrap p-4 font-mono text-xs">{item.estimateMin ? `${brl(item.estimateMin)} – ${brl(item.estimateMax ?? 0)}` : "—"}</td>
                <td className="p-4"><QuoteBadge status={item.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="p-5 font-mono text-sm text-ink-3">Carregando…</p>}
        {!loading && data?.items.length === 0 && <div className="p-5"><Empty>Nenhum pedido encontrado.</Empty></div>}
      </div>

      {data && data.total > LIMIT && (
        <nav aria-label="Paginação" className="mt-4 flex items-center justify-between text-sm">
          <span className="font-mono text-xs text-ink-3">{data.total} pedidos · página {page} de {pages}</span>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</button>
          </div>
        </nav>
      )}

      <QuoteDrawer id={openId} onClose={closeDrawer} onChanged={reload} />
    </>
  );
}

function QuoteDrawer({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (id === null) { setQuote(null); return; }
    let active = true;
    api.admin.quotes.get(id)
      .then((q) => { if (active) { setQuote(q); setNotes(q.notes); } })
      .catch((err) => { toast("error", errorMessage(err)); onClose(); });
    return () => { active = false; };
  }, [id, toast, onClose]);

  async function update(d: { status?: QuoteStatus; notes?: string }) {
    if (!quote) return;
    setSaving(true);
    try {
      const q = await api.admin.quotes.update(quote.id, d);
      setQuote(q);
      onChanged();
      toast("ok", "Pedido atualizado.");
    } catch (err) {
      toast("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!quote) return;
    const ok = await confirm({ title: "Excluir este pedido?", body: "Os dados do cliente serão apagados definitivamente (use para atender pedidos de exclusão da LGPD).", confirmLabel: "Excluir definitivamente", danger: true });
    if (!ok) return;
    try {
      await api.admin.quotes.remove(quote.id);
      toast("ok", "Pedido excluído.");
      onChanged();
      onClose();
    } catch (err) {
      toast("error", errorMessage(err));
    }
  }

  const yesNo = (v: boolean | null) => (v === null ? "Não informado" : v ? "Sim" : "Não");
  const wa = quote ? `https://wa.me/55${quote.phone}?text=${encodeURIComponent(`Olá, ${quote.name.split(" ")[0]}! Aqui é da WC Edificações, sobre seu pedido de orçamento ${quote.protocol}.`)}` : "#";

  return (
    <Modal open={id !== null} onClose={onClose} labelledBy="drawer-t" className="ml-auto mr-0 h-[100dvh]">
      <div className="flex h-[100dvh] w-[min(100vw,560px)] flex-col bg-paper text-ink">
        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div>
            <p className="label-mono text-ink-3">{quote?.protocol ?? "…"}</p>
            <h2 id="drawer-t" className="mt-1 text-xl font-bold">{quote?.name ?? "Carregando…"}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center border border-line" aria-label="Fechar"><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>
        {quote && (
          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            <div className="flex flex-wrap gap-2">
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-ink btn-sm"><MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp</a>
              <a href={`tel:+55${quote.phone}`} className="btn btn-ghost btn-sm"><Phone className="h-4 w-4" aria-hidden="true" /> Ligar</a>
              <a href={`mailto:${quote.email}?subject=${encodeURIComponent(`Orçamento ${quote.protocol}`)}`} className="btn btn-ghost btn-sm"><Mail className="h-4 w-4" aria-hidden="true" /> E-mail</a>
            </div>

            <div>
              <label htmlFor="q-status" className="field-label">Status</label>
              <select id="q-status" className="field" value={quote.status} disabled={saving} onChange={(e) => update({ status: e.target.value as QuoteStatus })}>
                {STATUSES.map((s) => <option key={s} value={s}>{QUOTE_STATUS_LABEL[s]}</option>)}
              </select>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-line py-4 text-sm">
              <Item k="E-mail" v={quote.email} wide />
              <Item k="Telefone" v={formatPhone(quote.phone)} />
              <Item k="Cidade" v={quote.city} />
              <Item k="Tipo" v={CATEGORY_LABEL[quote.projectType]} />
              <Item k="Padrão" v={quote.standard ? STANDARD_LABEL[quote.standard] : "Não informado"} />
              <Item k="Área" v={quote.areaM2 ? `${num(quote.areaM2)} m²` : "Não informada"} />
              <Item k="Início" v={quote.startWindow ? START_WINDOW_LABEL[quote.startWindow] : "Não informado"} />
              <Item k="Tem terreno" v={yesNo(quote.hasLand)} />
              <Item k="Tem projeto" v={yesNo(quote.hasProject)} />
              <Item k="Estimativa" v={quote.estimateMin ? `${brl(quote.estimateMin)} – ${brl(quote.estimateMax ?? 0)}` : "—"} wide />
              <Item k="Recebido em" v={formatDate(quote.createdAt, true)} />
              <Item k="Consentimento" v={formatDate(quote.consentAt, true)} />
            </dl>

            <div>
              <p className="field-label">Mensagem do cliente</p>
              {/* Renderizado como texto puro — o React escapa qualquer HTML enviado pelo visitante */}
              <p className="whitespace-pre-wrap break-words border border-line bg-concrete p-4 text-sm leading-relaxed">{quote.message || "—"}</p>
            </div>

            <div>
              <label htmlFor="q-notes" className="field-label">Notas internas</label>
              <textarea id="q-notes" className="field text-sm" rows={4} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} />
              <button type="button" className="btn btn-ink btn-sm mt-2" disabled={saving || notes === quote.notes} onClick={() => update({ notes })}>Salvar notas</button>
            </div>
          </div>
        )}
        {quote && (
          <div className="border-t border-line p-5">
            <button type="button" onClick={remove} className="inline-flex items-center gap-2 text-sm font-semibold text-danger hover:underline"><Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir pedido</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Item({ k, v, wide }: { k: string; v: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="label-mono text-[0.62rem] text-ink-3">{k}</dt>
      <dd className="mt-0.5 break-words font-medium">{v}</dd>
    </div>
  );
}
