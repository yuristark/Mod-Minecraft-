import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { CATEGORY_LABEL, STANDARD_LABEL } from "@/config/site";
import { api, ApiError, errorMessage } from "@/lib/api";
import { brl } from "@/lib/estimate";
import type { Category, SimulatorSettings, Standard } from "@/lib/types";
import { PageHeader, useToast } from "../ui";

type ExtraRow = { key: string; label: string; percent: number };

function keyFromLabel(label: string, taken: Set<string>) {
  const base = label.normalize("NFD").replace(/[^a-zA-Z ]/g, "").trim().split(/\s+/).slice(0, 3)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join("") || "adicional";
  let k = base.slice(0, 36); let n = 2;
  while (taken.has(k)) k = `${base.slice(0, 34)}${String.fromCharCode(64 + n++)}`;
  return k;
}

export default function SimulatorSettingsPage() {
  const toast = useToast();
  const [data, setData] = useState<SimulatorSettings | null>(null);
  const [extras, setExtras] = useState<ExtraRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.admin.simulator.get()
      .then((s) => { setData(s); setExtras(Object.entries(s.extras).map(([key, v]) => ({ key, ...v }))); })
      .catch((err) => toast("error", errorMessage(err)));
  }, [toast]);

  if (!data) return <p className="font-mono text-sm text-ink-3">Carregando…</p>;

  const setPrice = (c: Category, s: Standard, v: number) =>
    setData({ ...data, pricePerM2: { ...data.pricePerM2, [c]: { ...data.pricePerM2[c], [s]: v } } });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    const taken = new Set<string>();
    const ex: SimulatorSettings["extras"] = {};
    for (const row of extras) {
      if (!row.label.trim()) continue;
      const key = /^[a-zA-Z]{2,40}$/.test(row.key) && !taken.has(row.key) ? row.key : keyFromLabel(row.label, taken);
      taken.add(key);
      ex[key] = { label: row.label.trim(), percent: row.percent };
    }
    setSaving(true);
    try {
      const saved = await api.admin.simulator.save({ ...data, extras: ex });
      setData(saved);
      setExtras(Object.entries(saved.extras).map(([key, v]) => ({ key, ...v })));
      toast("ok", "Valores do simulador atualizados.");
    } catch (err) {
      toast("error", err instanceof ApiError && err.fields ? `${errorMessage(err)} (${Object.values(err.fields)[0]})` : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Simulador" subtitle="Valores de referência por m² usados no simulador público e nas estimativas dos pedidos." />
      <form onSubmit={onSubmit} className="space-y-8">
        <section className="overflow-x-auto border border-line bg-paper">
          <table className="w-full min-w-[620px] text-sm">
            <caption className="border-b border-line p-5 text-left font-bold">Preço por m² (R$)</caption>
            <thead className="label-mono text-left text-ink-3">
              <tr><th className="p-4 font-normal">Tipo de obra</th>{(Object.keys(STANDARD_LABEL) as Standard[]).map((s) => <th key={s} className="p-4 font-normal">{STANDARD_LABEL[s]}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                <tr key={c}>
                  <th scope="row" className="p-4 text-left font-semibold">{CATEGORY_LABEL[c]}</th>
                  {(Object.keys(STANDARD_LABEL) as Standard[]).map((s) => (
                    <td key={s} className="p-3">
                      <label className="sr-only" htmlFor={`p-${c}-${s}`}>{CATEGORY_LABEL[c]} — {STANDARD_LABEL[s]}</label>
                      <input id={`p-${c}-${s}`} type="number" min={0} max={100000} step={10} required className="field h-10 font-mono"
                        value={data.pricePerM2[c][s]} onChange={(e) => setPrice(c, s, e.target.valueAsNumber || 0)} />
                      <span className="mt-1 block font-mono text-[0.65rem] text-ink-3">{brl(data.pricePerM2[c][s])}/m²</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="border border-line bg-paper p-5">
            <label htmlFor="variation" className="field-label">Margem de variação (±%)</label>
            <p className="field-hint">Define a largura da faixa exibida (ex.: 12% → de 88% a 112% do valor base).</p>
            <input id="variation" type="number" min={0} max={50} step={1} required className="field w-32 font-mono" value={data.variationPercent}
              onChange={(e) => setData({ ...data, variationPercent: e.target.valueAsNumber || 0 })} />
          </div>
          <div className="border border-line bg-paper p-5">
            <label htmlFor="note" className="field-label">Observação exibida ao visitante</label>
            <textarea id="note" maxLength={300} className="field min-h-[90px] text-sm" value={data.referenceNote} onChange={(e) => setData({ ...data, referenceNote: e.target.value })} />
          </div>
        </section>

        <section className="border border-line bg-paper p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Itens adicionais</h2>
            <button type="button" className="btn btn-ghost btn-sm" disabled={extras.length >= 10} onClick={() => setExtras((l) => [...l, { key: "", label: "", percent: 5 }])}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Adicionar
            </button>
          </div>
          <ul className="mt-4 space-y-2">
            {extras.map((row, i) => (
              <li key={i} className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`ex-l-${i}`}>Descrição do adicional</label>
                <input id={`ex-l-${i}`} className="field h-10 flex-1 text-sm" maxLength={80} placeholder="Ex.: Piscina" value={row.label}
                  onChange={(e) => setExtras((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <label className="sr-only" htmlFor={`ex-p-${i}`}>Percentual</label>
                <div className="relative w-28">
                  <input id={`ex-p-${i}`} type="number" min={0} max={100} step={0.5} className="field h-10 pr-8 font-mono text-sm" value={row.percent}
                    onChange={(e) => setExtras((l) => l.map((x, j) => (j === i ? { ...x, percent: e.target.valueAsNumber || 0 } : x)))} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-ink-3">%</span>
                </div>
                <button type="button" className="grid h-10 w-10 place-items-center border border-line text-danger" aria-label="Remover adicional" onClick={() => setExtras((l) => l.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <button type="submit" className="btn btn-signal" disabled={saving}>{saving ? "Salvando…" : "Salvar valores"}</button>
      </form>
    </>
  );
}
