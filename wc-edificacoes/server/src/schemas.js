import { z } from 'zod';
import { stripControl } from './lib/security.js';

export const CATEGORIES = ['residencial', 'comercial', 'industrial', 'reforma'];
export const STATUSES = ['concluida', 'em_andamento', 'lancamento'];
export const STANDARDS = ['economico', 'medio', 'alto'];
export const QUOTE_STATUSES = ['novo', 'em_contato', 'proposta', 'fechado', 'descartado'];
export const START_WINDOWS = ['imediato', '3_meses', '6_meses', 'sem_data'];

/** Texto de linha única: remove controles, colapsa espaços, aplica limites. */
const line = (min, max, label) =>
  z.string({ error: `${label} é obrigatório` })
    .transform((s) => stripControl(s).replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(min, min > 0 ? `${label} é obrigatório` : undefined).max(max, `${label}: máximo de ${max} caracteres`));

/** Texto multilinha. */
const text = (max, label) =>
  z.string()
    .transform((s) => stripControl(s).replace(/\r\n/g, '\n').trim())
    .pipe(z.string().max(max, `${label}: máximo de ${max} caracteres`));

const email = z.string({ error: 'Informe um e-mail' })
  .transform((s) => s.trim().toLowerCase())
  .pipe(z.email('E-mail inválido').max(160, 'E-mail muito longo'));

// Telefone brasileiro: aceita (31) 99999-9999, +55..., etc. Armazena só dígitos.
const phoneBR = z.string({ error: 'Informe um telefone' })
  .transform((s) => s.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''))
  .pipe(z.string().regex(/^[1-9]{2}9?\d{8}$/, 'Telefone inválido — use DDD + número'));

const optionalPositive = (max, label) =>
  z.union([z.number(), z.null(), z.undefined()])
    .refine((v) => v === null || v === undefined || (Number.isFinite(v) && v > 0 && v <= max), `${label} fora do intervalo permitido`)
    .transform((v) => (v === undefined ? null : v));

export const idParam = z.object({ id: z.coerce.number().int().positive().max(2_147_483_647) });
export const slugParam = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(140) });

export const projectListQuery = z.object({
  category: z.enum(CATEGORIES).optional(),
  status: z.enum(STATUSES).optional(),
  featured: z.enum(['1', 'true']).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(24).default(12),
});

export const quoteCreate = z.object({
  name: line(2, 120, 'Nome').refine((s) => /\p{L}/u.test(s), 'Nome inválido'),
  email,
  phone: phoneBR,
  city: line(2, 100, 'Cidade'),
  projectType: z.enum(CATEGORIES, { error: 'Escolha o tipo de obra' }),
  standard: z.enum(STANDARDS).nullish().transform((v) => v ?? null),
  areaM2: optionalPositive(100_000, 'Área'),
  hasLand: z.boolean().nullish().transform((v) => v ?? null),
  hasProject: z.boolean().nullish().transform((v) => v ?? null),
  startWindow: z.enum(START_WINDOWS).nullish().transform((v) => v ?? null),
  extras: z.array(z.string().max(40)).max(10).default([]),
  message: text(3000, 'Mensagem').default(''),
  consent: z.literal(true, { error: 'É preciso aceitar a política de privacidade' }),
  // Anti-spam
  website: z.string().max(200).optional(), // honeypot: humanos não preenchem
  startedAt: z.number().int().positive(),
  turnstileToken: z.string().max(2048).optional(),
});

export const loginBody = z.object({
  email: z.string().trim().toLowerCase().max(160),
  password: z.string().min(1).max(256),
});

// Senhas que aparecem no topo de todos os vazamentos (com ou sem números no fim)
const COMMON = ['senha', 'password', 'admin', 'qwerty', 'abc123', '123456', 'mudar', 'trocar', 'teste', 'brasil', 'construtora', 'edificacoes'];
const isCommon = (s) => {
  const base = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const word = base.replace(/^\d+|\d+$/g, ''); // "Senha2026", "123admin" → palavra-base
  return COMMON.includes(word) || /^(.)\1+$/.test(base);
};

export const passwordPolicy = z.string()
  .min(12, 'A senha precisa ter pelo menos 12 caracteres')
  .max(128, 'A senha pode ter no máximo 128 caracteres')
  .refine((s) => /[a-zA-Z]/.test(s) && /\d/.test(s), 'Use letras e números')
  .refine((s) => !/^(.)\1+$/.test(s), 'Senha muito fraca')
  .refine((s) => !isCommon(s), 'Senha muito comum — escolha outra');

export const changePasswordBody = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: passwordPolicy,
});

export const quoteListQuery = z.object({
  status: z.enum(QUOTE_STATUSES).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const quoteUpdate = z.object({
  status: z.enum(QUOTE_STATUSES).optional(),
  notes: text(4000, 'Notas').optional(),
}).refine((v) => v.status !== undefined || v.notes !== undefined, 'Nada para atualizar');

export const projectBody = z.object({
  title: line(3, 140, 'Título'),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use apenas letras minúsculas, números e hífen').max(140).optional().or(z.literal('')),
  category: z.enum(CATEGORIES),
  status: z.enum(STATUSES),
  city: line(2, 100, 'Cidade'),
  areaM2: optionalPositive(1_000_000, 'Área'),
  year: z.union([z.number().int().min(1950).max(2100), z.null()]).optional().transform((v) => v ?? null),
  durationMonths: z.union([z.number().int().min(1).max(240), z.null()]).optional().transform((v) => v ?? null),
  summary: line(10, 280, 'Resumo'),
  description: text(8000, 'Descrição').default(''),
  featured: z.boolean().default(false),
  published: z.boolean().default(false),
});

export const imageUpdate = z.object({
  alt: line(0, 200, 'Texto alternativo').optional(),
  position: z.number().int().min(0).max(1000).optional(),
});

const price = z.number().min(0).max(100_000);
const tier = z.object({ economico: price, medio: price, alto: price }).strict();

export const simulatorSettings = z.object({
  pricePerM2: z.object({ residencial: tier, comercial: tier, industrial: tier, reforma: tier }).strict(),
  variationPercent: z.number().min(0).max(50),
  extras: z.record(
    z.string().regex(/^[a-zA-Z]{2,40}$/),
    z.object({ label: line(2, 80, 'Rótulo'), percent: z.number().min(0).max(100) }).strict(),
  ).refine((o) => Object.keys(o).length <= 10, 'No máximo 10 adicionais'),
  referenceNote: line(0, 300, 'Observação'),
}).strict();
