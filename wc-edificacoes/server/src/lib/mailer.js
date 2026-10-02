import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { logger } from './logger.js';

/**
 * Aviso por e-mail a cada novo pedido de orçamento.
 * Desligado se SMTP_HOST ou NOTIFY_EMAIL não estiverem configurados.
 * Falhas de envio nunca impedem o pedido de ser salvo (o pedido sempre fica no painel).
 */
let transport = null;
let overridden = false;

function getTransport() {
  if (overridden) return transport;
  if (!config.mail.host || config.mail.notifyTo.length === 0) return null;
  if (!transport) {
    transport = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transport;
}

/** Só para testes: injeta um transporte falso (ou null para desligar). */
export function setMailTransport(t) {
  transport = t;
  overridden = true;
  sentTimes.length = 0;
}

// Teto global de avisos por hora: mesmo um ataque de spam vindo de muitos IPs não lota a caixa
// de entrada nem queima a cota do provedor de e-mail. Os pedidos continuam todos no painel.
const MAX_PER_HOUR = 30;
const sentTimes = [];
function allowSend() {
  const cutoff = Date.now() - 3600_000;
  while (sentTimes.length && sentTimes[0] < cutoff) sentTimes.shift();
  if (sentTimes.length >= MAX_PER_HOUR) return false;
  sentTimes.push(Date.now());
  return true;
}

const LABELS = {
  residencial: 'Residencial', comercial: 'Comercial', industrial: 'Industrial', reforma: 'Reforma & retrofit',
  economico: 'Econômico', medio: 'Médio', alto: 'Alto padrão',
  imediato: 'Imediatamente', '3_meses': 'Em até 3 meses', '6_meses': 'Em até 6 meses', sem_data: 'Ainda sem data',
};
const yesNo = (v) => (v === true ? 'Sim' : v === false ? 'Não' : 'Não informado');
const brl = (n) => (n == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n));
// Remove quebras de linha de campos que vão no assunto (defesa contra injeção de cabeçalho)
const oneLine = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ').slice(0, 120);

export async function notifyNewQuote(q) {
  const t = getTransport();
  if (!t) return false;
  if (!allowSend()) {
    logger.warn('limite de avisos por e-mail atingido nesta hora; pedido salvo apenas no painel');
    return false;
  }
  const text = [
    `Novo pedido de orçamento pelo site — protocolo ${q.protocol}`,
    '',
    `Nome: ${q.name}`,
    `Telefone: ${q.phone}`,
    `E-mail: ${q.email}`,
    `Cidade: ${q.city || '—'}`,
    '',
    `Tipo de obra: ${LABELS[q.projectType] || q.projectType}`,
    `Padrão: ${LABELS[q.standard] || '—'}`,
    `Área: ${q.areaM2 ? `${q.areaM2} m²` : '—'}`,
    `Tem terreno: ${yesNo(q.hasLand)}  ·  Tem projeto: ${yesNo(q.hasProject)}`,
    `Início: ${LABELS[q.startWindow] || '—'}`,
    `Estimativa do simulador: ${brl(q.estimateMin)} a ${brl(q.estimateMax)}`,
    '',
    'Mensagem:',
    q.message || '—',
    '',
    `Ver no painel: ${config.siteUrl}/admin/orcamentos`,
  ].join('\n');

  try {
    await t.sendMail({
      from: config.mail.from || config.mail.user,
      to: config.mail.notifyTo,
      replyTo: q.email,
      subject: oneLine(`Novo orçamento ${q.protocol} — ${q.name}`),
      text,
    });
    return true;
  } catch (err) {
    logger.error({ err: { message: err.message, code: err.code } }, 'falha ao enviar e-mail de novo orçamento');
    return false;
  }
}
