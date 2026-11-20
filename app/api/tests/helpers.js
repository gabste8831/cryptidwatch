import bcrypt from 'bcryptjs';
import pg from 'pg';
import pino from 'pino';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { signToken, SESSION_COOKIE } from '../src/auth.js';
import { buildConfig } from '../src/config.js';
import { migrate } from '../src/db.js';
import { MemoryRateStore } from '../src/ratelimit.js';
import { createMemoryStorage } from '../src/storage.js';

export const TEST_PASSWORD = 'senha-muito-secreta';

export const config = buildConfig({
  NODE_ENV: 'test',
  JWT_SECRET: 'segredo-de-teste-com-mais-de-32-bytes-para-o-hs256',
  DATABASE_URL: process.env.TEST_DATABASE_URL
    || 'postgres://cryptidwatch:cryptidwatch@localhost:5433/cryptidwatch_test',
});

let pool;

export async function getDb() {
  if (!pool) {
    pool = new pg.Pool(config.db);
    await migrate(pool);
  }
  return pool;
}

export async function closeDb() {
  if (pool) await pool.end();
  pool = undefined;
}

export async function resetDb() {
  const db = await getDb();
  await db.query('TRUNCATE audit_log, photos, sightings, users RESTART IDENTITY CASCADE');
}

/** App novo a cada chamada (rate limit zerado). Storage e cache em memória. */
export async function buildTestApp(overrides = {}) {
  const db = await getDb();
  const storage = createMemoryStorage();
  const rateStore = new MemoryRateStore();
  const deps = {
    db,
    config,
    logger: pino({ level: 'silent' }),
    storage,
    rateStore,
    rankingCache: null,
    ...overrides,
  };
  return { app: createApp(deps), ...deps };
}

let userSeq = 0;
export async function createUser({ role = 'usuario', name = 'Testemunha' } = {}) {
  const db = await getDb();
  userSeq += 1;
  const email = `user${userSeq}-${Date.now()}@teste.local`;
  const hash = await bcrypt.hash(TEST_PASSWORD, 4);
  const { rows } = await db.query(
    `INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role`,
    [email, name, hash, role],
  );
  return rows[0];
}

export const cookieFor = (user) => `${SESSION_COOKIE}=${signToken(user, config)}`;

export async function cryptidId(slug = 'chupa-cabra') {
  const db = await getDb();
  const { rows } = await db.query('SELECT id FROM cryptids WHERE slug = $1', [slug]);
  return rows[0].id;
}

export function sightingPayload(overrides = {}) {
  return {
    title: 'Vulto estranho no pasto',
    description: 'Vi uma criatura de olhos brilhantes perto do curral por volta das 2h.',
    city: 'Rio do Sul',
    uf: 'SC',
    seenAt: '2025-05-10',
    ...overrides,
  };
}

/** Insere um avistamento direto no banco (já com o status desejado). */
export async function createSighting(author, { status = 'pendente', slug = 'chupa-cabra', ...fields } = {}) {
  const db = await getDb();
  const p = sightingPayload(fields);
  const { rows } = await db.query(
    `INSERT INTO sightings (author_id, cryptid_id, title, description, city, uf, seen_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [author.id, await cryptidId(slug), p.title, p.description, p.city, p.uf, p.seenAt, status],
  );
  return rows[0].id;
}

/** PNG pequeno; com `exif`, grava metadados (inclusive GPS) para testar a remoção. */
export async function makePng({ width = 64, height = 48, exif } = {}) {
  let img = sharp({ create: { width, height, channels: 3, background: { r: 120, g: 60, b: 20 } } });
  if (exif) img = img.withExif(exif);
  return img.png().toBuffer();
}

export async function makeJpeg({ width = 64, height = 48, exif } = {}) {
  let img = sharp({ create: { width, height, channels: 3, background: { r: 10, g: 90, b: 40 } } });
  if (exif) img = img.withExif(exif);
  return img.jpeg().toBuffer();
}
