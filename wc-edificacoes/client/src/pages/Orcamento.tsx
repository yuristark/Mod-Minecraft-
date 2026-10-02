import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { SectionLabel } from "@/components/Brand";
import { Turnstile, TURNSTILE_ENABLED } from "@/components/Turnstile";
import { CATEGORY_LABEL, STANDARD_LABEL, START_WINDOW_LABEL, site, whatsappLink } from "@/config/site";
import { useAsync } from "@/hooks/useAsync";
import { useSeo } from "@/hooks/useSeo";
import { api, ApiError, errorMessage } from "@/lib/api";
import { brl, computeEstimate } from "@/lib/estimate";
import type { Category, QuoteInput, Standard, StartWindow } from "@/lib/types";

const ext = { target: "_blank", rel: "noopener noreferrer" } as const;
const MAX_MSG = 3000;

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

type Tri = "sim" | "nao" | "";
const triToBool = (t: Tri) => (t === "sim" ? true : t === "nao" ? false : null);

export default function Orcamento() {
  useSeo("Orçamento e contato", `Peça um orçamento para sua obra com a ${site.name}. Respondemos em até 1 dia útil.`);
  const [params] = useSearchParams();
  const simulator = useAsync(() => api.simulator(), []);

  // Pré-preenchimento vindo do simulador — cada valor é validado contra listas fixas
  const initial = useMemo(() => {
    const tipo = params.get("tipo");
    const padrao = params.get("padrao");
    const area = Number(params.get("area"));
    return {
      projectType: (tipo && tipo in CATEGORY_LABEL ? tipo : "") as Category | "",
      standard: (padrao && padrao in STANDARD_LABEL ? padrao : "") as Standard | "",
      area: Number.isFinite(area) && area > 0 && area <= 100000 ? String(Math.round(area)) : "",
      extras: (params.get("extras") || "").split(",").filter((e) => /^[a-zA-Z]{2,40}$/.test(e)).slice(0, 10),
    };
  }, [params]);

  const [form, setForm] = useState({
    name: "", email: "", phone: "", city: "",
    projectType: initial.projectType, standard: initial.standard, area: initial.area,
    hasLand: "" as Tri, hasProject: "" as Tri, startWindow: "" as StartWindow | "",
    message: "", consent: false, website: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [protocol, setProtocol] = useState("");
  const [token, setToken] = useState<string | undefined>();
  const [resetKey, setResetKey] = useState(0);
  const startedAt = useRef(Date.now());
  const formRef = useRef<HTMLFormElement>(null);
  const onToken = useCallback((t: string | undefined) => setToken(t), []);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k as string]) setErrors((e) => { const n = { ...e }; delete n[k as string]; return n; });
  };

  const areaNum = form.area ? Number(form.area) : null;
  const est = computeEstimate(simulator.data, {
    projectType: form.projectType, standard: (form.standard || null) as Standard | null, areaM2: areaNum, extras: initial.extras,
  });

  useEffect(() => { if (status === "done") window.scrollTo({ top: 0, behavior: "smooth" }); }, [status]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!formRef.current?.checkValidity()) { formRef.current?.reportValidity(); return; }
    if (TURNSTILE_ENABLED && !token) { setFormError("Confirme a verificação anti-robô para enviar."); return; }

    const payload: QuoteInput = {
      name: form.name, email: form.email, phone: form.phone, city: form.city,
      projectType: form.projectType, standard: (form.standard || null) as Standard | null,
      areaM2: areaNum, hasLand: triToBool(form.hasLand), hasProject: triToBool(form.hasProject),
      startWindow: (form.startWindow || null) as StartWindow | null, extras: initial.extras,
      message: form.message, consent: form.consent, website: form.website, startedAt: startedAt.current,
      turnstileToken: token,
    };
    setStatus("sending");
    try {
      const res = await api.createQuote(payload);
      setProtocol(res.protocol);
      setStatus("done");
    } catch (err) {
      setStatus("idle");
      setResetKey((k) => k + 1);
      if (err instanceof ApiError && err.fields) {
        setErrors(err.fields);
        const first = Object.keys(err.fields)[0];
        formRef.current?.querySelector<HTMLElement>(`[name="${CSS.escape(first)}"]`)?.focus();
      }
      setFormError(errorMessage(err));
    }
  }

  if (status === "done") {
    return (
      <section className="container max-w-3xl py-20 md:py-28">
        <CheckCircle2 className="h-12 w-12 text-ok" aria-hidden="true" />
        <h1 className="mt-6 text-display-lg uppercase" tabIndex={-1}>Pedido recebido!</h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-3">
          Obrigado, {form.name.split(" ")[0]}. Nossa equipe vai analisar as informações e entrar em contato em até 1 dia útil.
        </p>
        <div className="mt-8 inline-block border border-ink bg-paper px-6 py-4">
          <p className="label-mono text-ink-3">Protocolo</p>
          <p className="mt-1 font-mono text-2xl font-medium tracking-wider">{protocol}</p>
        </div>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <a href={whatsappLink(`Olá! Acabei de enviar um pedido de orçamento pelo site (protocolo ${protocol}).`)} {...ext} className="btn btn-ink">
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> Falar no WhatsApp
          </a>
          <Link to="/obras" className="btn btn-ghost">Ver nossas obras</Link>
        </div>
      </section>
    );
  }

  const err = (k: string) => errors[k];
  const aria = (k: string) => (err(k) ? { "aria-invalid": true as const, "aria-errormessage": `${k}-erro` } : {});

  return (
    <>
      <section className="border-b border-line">
        <div className="container pb-12 pt-14 md:pt-20">
          <SectionLabel>Orçamento e contato</SectionLabel>
          <div className="mt-5 grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
            <h1 className="text-display-xl uppercase">Vamos conversar sobre a sua obra</h1>
            <p className="max-w-md text-lg leading-relaxed text-ink-3">
              Preencha o formulário e receba o contato de um engenheiro em até 1 dia útil. Sem compromisso.
            </p>
          </div>
        </div>
      </section>

      <section className="container grid gap-12 py-12 md:py-16 lg:grid-cols-[1.5fr_1fr] lg:gap-16">
        <form ref={formRef} onSubmit={onSubmit} noValidate={false} className="space-y-10" aria-describedby="form-obs">
          {formError && (
            <div role="alert" className="border-l-4 border-danger bg-[#fbefed] p-4 font-medium text-danger">{formError}</div>
          )}

          <fieldset className="space-y-5">
            <legend className="mb-5 text-xl font-bold"><span className="label-mono mr-3 text-signal-strong">01</span>Seus dados</legend>
            <div>
              <label htmlFor="name" className="field-label">Nome completo</label>
              <input id="name" name="name" className="field" autoComplete="name" required minLength={2} maxLength={120}
                value={form.name} onChange={(e) => set("name", e.target.value)} enterKeyHint="next" {...aria("name")} />
              <p id="name-erro" className="field-error" data-show={!!err("name")}>{err("name") || "Informe seu nome."}</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="field-label">E-mail</label>
                <input id="email" name="email" type="email" className="field" autoComplete="email" required maxLength={160}
                  value={form.email} onChange={(e) => set("email", e.target.value)} enterKeyHint="next" {...aria("email")} />
                <p id="email-erro" className="field-error" data-show={!!err("email")}>{err("email") || "Informe um e-mail válido."}</p>
              </div>
              <div>
                <label htmlFor="phone" className="field-label">Telefone / WhatsApp</label>
                <input id="phone" name="phone" type="tel" inputMode="tel" className="field font-mono" autoComplete="tel-national" required
                  pattern="\(\d{2}\) \d{4,5}-\d{4}" placeholder="(31) 90000-0000"
                  value={form.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} enterKeyHint="next" {...aria("phone")} />
                <p id="phone-erro" className="field-error" data-show={!!err("phone")}>{err("phone") || "Use DDD + número."}</p>
              </div>
            </div>
            <div>
              <label htmlFor="city" className="field-label">Cidade da obra</label>
              <input id="city" name="city" className="field" autoComplete="address-level2" required minLength={2} maxLength={100}
                value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Ex.: Contagem – MG" {...aria("city")} />
              <p id="city-erro" className="field-error" data-show={!!err("city")}>{err("city") || "Informe a cidade."}</p>
            </div>
          </fieldset>

          <fieldset className="space-y-5">
            <legend className="mb-5 text-xl font-bold"><span className="label-mono mr-3 text-signal-strong">02</span>Sobre a obra</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="projectType" className="field-label">Tipo de obra</label>
                <select id="projectType" name="projectType" className="field" required value={form.projectType}
                  onChange={(e) => set("projectType", e.target.value as Category | "")} {...aria("projectType")}>
                  <option value="">Selecione…</option>
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <p id="projectType-erro" className="field-error" data-show={!!err("projectType")}>{err("projectType") || "Escolha o tipo de obra."}</p>
              </div>
              <div>
                <label htmlFor="standard" className="field-label">Padrão de acabamento <span className="font-normal text-ink-3">(opcional)</span></label>
                <select id="standard" name="standard" className="field" value={form.standard} onChange={(e) => set("standard", e.target.value as Standard | "")}>
                  <option value="">Ainda não sei</option>
                  {Object.entries(STANDARD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="area" className="field-label">Área aproximada <span className="font-normal text-ink-3">(m², opcional)</span></label>
                <input id="area" name="areaM2" type="number" inputMode="numeric" min={1} max={100000} step={1} className="field font-mono"
                  value={form.area} onChange={(e) => set("area", e.target.value)} {...aria("areaM2")} />
                <p id="areaM2-erro" className="field-error" data-show={!!err("areaM2")}>{err("areaM2") || "Informe um valor entre 1 e 100.000."}</p>
              </div>
              <div>
                <label htmlFor="startWindow" className="field-label">Quando quer começar?</label>
                <select id="startWindow" name="startWindow" className="field" value={form.startWindow} onChange={(e) => set("startWindow", e.target.value as StartWindow | "")}>
                  <option value="">Selecione…</option>
                  {Object.entries(START_WINDOW_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <TriRadio name="hasLand" legend="Já possui o terreno/imóvel?" value={form.hasLand} onChange={(v) => set("hasLand", v)} />
              <TriRadio name="hasProject" legend="Já tem projeto arquitetônico?" value={form.hasProject} onChange={(v) => set("hasProject", v)} />
            </div>

            {est && (
              <p className="border border-line bg-paper p-4 text-sm">
                <span className="label-mono text-ink-3">Estimativa de referência · </span>
                <strong className="tabular">{brl(est.min)} a {brl(est.max)}</strong>
                <span className="text-ink-3"> (sem terreno; será refinada no orçamento)</span>
              </p>
            )}

            <div>
              <label htmlFor="message" className="field-label">Conte mais sobre o que você precisa <span className="font-normal text-ink-3">(opcional)</span></label>
              <textarea id="message" name="message" className="field" rows={5} maxLength={MAX_MSG}
                value={form.message} onChange={(e) => set("message", e.target.value)} aria-describedby="message-count" {...aria("message")} />
              <p id="message-count" className="mt-1 text-right font-mono text-xs text-ink-3">{form.message.length}/{MAX_MSG}</p>
            </div>
          </fieldset>

          {/* Honeypot anti-spam: invisível para pessoas, robôs costumam preencher */}
          <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
            <label htmlFor="website">Não preencha este campo</label>
            <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)} />
          </div>

          <div className="space-y-6 border-t border-line pt-8">
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
              <input type="checkbox" name="consent" required checked={form.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#17181a]" {...aria("consent")} />
              <span>
                Concordo que a {site.name} use meus dados apenas para responder a este pedido de orçamento, conforme a{" "}
                <Link to="/privacidade" className="font-semibold underline underline-offset-2" target="_blank" rel="noopener">Política de Privacidade</Link>.
              </span>
            </label>
            {err("consent") && <p className="text-sm font-medium text-danger">{err("consent")}</p>}

            <Turnstile onToken={onToken} resetKey={resetKey} />

            <button type="submit" className="btn btn-signal w-full sm:w-auto" disabled={status === "sending"}>
              {status === "sending" ? "Enviando…" : "Enviar pedido de orçamento"}
            </button>
            <p id="form-obs" className="text-xs text-ink-3">Seus dados trafegam com criptografia (HTTPS) e não são compartilhados com terceiros.</p>
          </div>
        </form>

        <aside className="space-y-4 lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:self-start">
          <div className="on-dark bg-ink p-6 text-paper">
            <p className="label-mono text-paper/60">Prefere conversar agora?</p>
            <a href={whatsappLink()} {...ext} className="btn btn-signal mt-4 w-full"><MessageCircle className="h-4 w-4" aria-hidden="true" /> Chamar no WhatsApp</a>
            <a href={`tel:${site.contact.phoneHref}`} className="btn btn-ghost mt-3 w-full"><Phone className="h-4 w-4" aria-hidden="true" /> {site.contact.phone}</a>
          </div>
          <ul className="divide-y divide-line border border-line bg-paper text-sm">
            <li className="flex gap-3 p-5"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-signal-strong" aria-hidden="true" /><a href={`mailto:${site.contact.email}`} className="break-all hover:underline">{site.contact.email}</a></li>
            <li className="flex gap-3 p-5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-signal-strong" aria-hidden="true" /><a href={site.contact.mapsUrl} {...ext} className="hover:underline">{site.contact.address}</a></li>
            <li className="flex gap-3 p-5"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-signal-strong" aria-hidden="true" /><span>{site.contact.hours}</span></li>
          </ul>
        </aside>
      </section>
    </>
  );
}

function TriRadio({ name, legend, value, onChange }: { name: string; legend: string; value: Tri; onChange: (v: Tri) => void }) {
  const opts: [Tri, string][] = [["sim", "Sim"], ["nao", "Não"], ["", "Não sei"]];
  return (
    <fieldset>
      <legend className="field-label">{legend}</legend>
      <div className="grid grid-cols-3 gap-2">
        {opts.map(([v, l]) => (
          <label key={l} className="cursor-pointer">
            <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} className="peer sr-only" />
            <span className="block border border-line bg-paper py-2.5 text-center text-sm peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-signal-strong">{l}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
