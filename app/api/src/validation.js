import { z } from 'zod';
import { ALLOWED_TYPES } from './images.js';

// SEC-07: todo schema tem tamanho máximo, e os de corpo são .strict() (campo desconhecido → 400).

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const todayUtc = () => new Date().toISOString().slice(0, 10);
const isoDate = z.string().date('data inválida (use AAAA-MM-DD)');

export const uuidParam = z.string().uuid();

// SEC-11 / SEC-15: `role` não existe no schema; enviar o campo é rejeitado pelo .strict().
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10, 'a senha precisa ter pelo menos 10 caracteres').max(128),
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254),
  password: z.string().max(128),
}).strict();

const sightingFields = {
  cryptidId: z.number().int().positive(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(4000),
  city: z.string().trim().min(2).max(80),
  uf: z.enum(UFS),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  seenAt: isoDate.refine((d) => d <= todayUtc(), 'a data não pode ser futura'),
};

export const createSightingSchema = z.object(sightingFields).strict();
export const updateSightingSchema = z.object(sightingFields).partial().strict()
  .refine((o) => Object.keys(o).length > 0, 'nada para atualizar');

// SEC-01: ordenação só por colunas de uma lista fechada. SEC-24: no máximo 50 por página.
export const SORT_COLUMNS = {
  seen_at: 's.seen_at', created_at: 's.created_at', title: 's.title', credibility: 's.credibility',
};

export const listSightingsQuery = z.object({
  q: z.string().trim().max(100).optional(),
  cryptid: z.string().trim().max(40).optional(),
  uf: z.enum(UFS).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  sort: z.enum(Object.keys(SORT_COLUMNS)).default('seen_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).default(20).transform((n) => Math.min(n, 50)),
});

export const uploadUrlSchema = z.object({
  contentType: z.enum(ALLOWED_TYPES, { message: 'só JPEG, PNG ou WEBP' }),
}).strict();

export const photoVariantQuery = z.object({
  variant: z.enum(['thumb', 'full']).default('full'),
});

export const approveSchema = z.object({
  credibility: z.number().int().min(1).max(5).default(3),
}).strict();

// SEC-90: texto puro, 2 a 1000 caracteres.
export const commentSchema = z.object({
  body: z.string().trim().min(2, 'comentário muito curto').max(1000),
}).strict();

export const reportSchema = z.object({
  reason: z.string().trim().min(3, 'informe o motivo').max(300),
}).strict();

// SEC-42: motivo obrigatório na rejeição.
export const rejectSchema = z.object({
  reason: z.string().trim().min(3, 'informe o motivo').max(500),
}).strict();
