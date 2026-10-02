import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { CATEGORY_LABEL, QUOTE_STATUS_LABEL } from "@/config/site";
import { useAsync } from "@/hooks/useAsync";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/estimate";
import type { QuoteStatus } from "@/lib/types";
import { useAuth } from "../AdminApp";
import { Empty, PageHeader, QuoteBadge } from "../ui";

const ORDER: QuoteStatus[] = ["novo", "em_contato", "proposta", "fechado", "descartado"];

export default function Dashboard() {
  const { admin } = useAuth();
  const { data, error, loading } = useAsync(() => api.admin.stats(), []);

  // Série de 30 dias com dias vazios preenchidos com zero
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const key = d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    return { key, n: data?.quotesPerDay.find((x) => x.day === key)?.n ?? 0, label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) };
  });
  const max = Math.max(1, ...days.map((d) => d.n));
  const last30 = days.reduce((a, d) => a + d.n, 0);

  return (
    <>
      <PageHeader title={`Olá, ${admin?.name.split(" ")[0] ?? ""}`} subtitle="Resumo dos pedidos de orçamento e do portfólio." />
      {error && <p role="alert" className="text-danger">{error}</p>}
      {loading && <p className="font-mono text-sm text-ink-3">Carregando…</p>}
      {data && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-3 lg:grid-cols-6">
            <Tile label="Total de pedidos" value={data.quotesTotal} strong />
            {ORDER.map((s) => (
              <Link key={s} to={`/admin/orcamentos?status=${s}`} className="bg-paper p-5 transition-colors hover:bg-concrete">
                <p className="label-mono text-ink-3">{QUOTE_STATUS_LABEL[s]}</p>
                <p className="mt-2 text-3xl font-bold tabular">{data.quotesByStatus[s] ?? 0}</p>
              </Link>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <section className="border border-line bg-paper p-6" aria-labelledby="chart-t">
              <div className="flex items-baseline justify-between">
                <h2 id="chart-t" className="font-bold">Pedidos por dia</h2>
                <p className="font-mono text-xs text-ink-3">últimos 30 dias · {last30} no total</p>
              </div>
              <div className="relative mt-6 h-40">
                <div className="absolute inset-x-0 top-0 border-t border-dashed border-line" aria-hidden="true" />
                <span className="absolute -top-2.5 right-0 bg-paper pl-1 font-mono text-[0.65rem] text-ink-3" aria-hidden="true">{max}</span>
                <ol className="flex h-full items-end gap-[2px] border-b border-ink" aria-label="Pedidos por dia nos últimos 30 dias">
                  {days.map((d) => (
                    <li key={d.key} className="group relative flex h-full flex-1 items-end" aria-label={`${d.label}: ${d.n} ${d.n === 1 ? "pedido" : "pedidos"}`}>
                      <span className="block w-full rounded-t-[2px] bg-signal-strong transition-colors group-hover:bg-ink" style={{ height: d.n ? `${(d.n / max) * 100}%` : "0" }} />
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap bg-ink px-2 py-1 font-mono text-[0.65rem] text-paper group-hover:block">
                        {d.label} · {d.n}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="mt-2 flex justify-between font-mono text-[0.65rem] text-ink-3" aria-hidden="true">
                <span>{days[0].label}</span><span>{days[14].label}</span><span>hoje</span>
              </div>
            </section>

            <section className="border border-line bg-paper p-6">
              <h2 className="font-bold">Portfólio</h2>
              <p className="mt-4 text-4xl font-bold tabular">{data.projects.published}<span className="text-xl text-ink-3"> / {data.projects.total}</span></p>
              <p className="mt-1 text-sm text-ink-3">obras publicadas no site</p>
              <Link to="/admin/obras/nova" className="btn btn-ink btn-sm mt-6">Cadastrar obra</Link>
            </section>
          </div>

          <section className="border border-line bg-paper">
            <div className="flex items-center justify-between border-b border-line p-5">
              <h2 className="font-bold">Pedidos recentes</h2>
              <Link to="/admin/orcamentos" className="inline-flex items-center gap-1.5 text-sm font-semibold text-signal-strong">Ver todos <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </div>
            {data.recentQuotes.length === 0 ? <div className="p-5"><Empty>Nenhum pedido ainda.</Empty></div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="label-mono text-left text-ink-3"><tr><th className="p-4 font-normal">Data</th><th className="p-4 font-normal">Nome</th><th className="p-4 font-normal">Obra</th><th className="p-4 font-normal">Status</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {data.recentQuotes.map((q) => (
                      <tr key={q.id} className="hover:bg-concrete">
                        <td className="whitespace-nowrap p-4 font-mono text-xs">{formatDate(q.createdAt)}</td>
                        <td className="p-4 font-medium"><Link to={`/admin/orcamentos?abrir=${q.id}`} className="hover:underline">{q.name}</Link><span className="block text-xs text-ink-3">{q.city}</span></td>
                        <td className="p-4">{CATEGORY_LABEL[q.projectType]}</td>
                        <td className="p-4"><QuoteBadge status={q.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function Tile({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={strong ? "on-dark bg-ink p-5 text-paper" : "bg-paper p-5"}>
      <p className="label-mono opacity-60">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular">{value}</p>
    </div>
  );
}
