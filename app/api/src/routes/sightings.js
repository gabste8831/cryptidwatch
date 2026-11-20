import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { notFound } from '../errors.js';
import { rateLimit } from '../ratelimit.js';
import {
  createSightingSchema, updateSightingSchema, listSightingsQuery, uuidParam, SORT_COLUMNS,
} from '../validation.js';

const SIGHTING_COLUMNS = `
  s.id, s.title, s.description, s.city, s.uf, s.latitude, s.longitude,
  to_char(s.seen_at, 'YYYY-MM-DD') AS seen_at, s.status, s.reject_reason, s.created_at,
  s.author_id, u.name AS author_name, c.id AS cryptid_id, c.slug AS cryptid_slug, c.name AS cryptid_name`;

const SIGHTING_FROM = `
  FROM sightings s
  JOIN users u ON u.id = s.author_id
  JOIN cryptids c ON c.id = s.cryptid_id`;

export function toSighting(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    city: r.city,
    uf: r.uf,
    latitude: r.latitude === null ? null : Number(r.latitude),
    longitude: r.longitude === null ? null : Number(r.longitude),
    seenAt: r.seen_at,
    status: r.status,
    rejectReason: r.reject_reason,
    createdAt: r.created_at,
    author: { id: r.author_id, name: r.author_name },
    cryptid: { id: r.cryptid_id, slug: r.cryptid_slug, name: r.cryptid_name },
  };
}

// Escapa % e _ para a busca por texto ser literal no ILIKE.
const escapeLike = (s) => s.replace(/[\\%_]/g, (ch) => `\\${ch}`);

export function sightingRoutes({ db, config, storage, rateStore }) {
  const router = Router();
  const expires = config.upload.getUrlExpiresSec;

  const createLimiter = rateLimit({
    store: rateStore, name: 'sightings', ...config.limits.sightings, keyFn: (req) => req.user.id,
  });

  // Lista pública: só relatos aprovados (SEC-22). Tudo parametrizado (SEC-01).
  router.get('/', async (req, res) => {
    const q = listSightingsQuery.parse(req.query);
    const where = [`s.status = 'aprovado'`];
    const params = [];
    const param = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (q.q) {
      const p = param(`%${escapeLike(q.q)}%`);
      where.push(`(s.title ILIKE ${p} OR s.description ILIKE ${p} OR s.city ILIKE ${p})`);
    }
    if (q.cryptid) where.push(`c.slug = ${param(q.cryptid)}`);
    if (q.uf) where.push(`s.uf = ${param(q.uf)}`);
    if (q.from) where.push(`s.seen_at >= ${param(q.from)}`);
    if (q.to) where.push(`s.seen_at <= ${param(q.to)}`);

    // Coluna e direção vêm de listas fechadas, nunca do texto do usuário.
    const orderBy = `${SORT_COLUMNS[q.sort]} ${q.order === 'asc' ? 'ASC' : 'DESC'}, s.id`;
    const limit = param(q.limit);
    const offset = param((q.page - 1) * q.limit);

    const { rows } = await db.query(
      `SELECT ${SIGHTING_COLUMNS}, COUNT(*) OVER() AS total_count,
         (SELECT p.thumb_key FROM photos p
           WHERE p.sighting_id = s.id AND p.status = 'aprovado'
           ORDER BY p.created_at LIMIT 1) AS cover_key
       ${SIGHTING_FROM}
       WHERE ${where.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    const items = await Promise.all(rows.map(async (r) => ({
      ...toSighting(r),
      coverUrl: r.cover_key ? await storage.presignGet(r.cover_key, expires) : null,
    })));
    res.json({ items, page: q.page, limit: q.limit, total: rows[0] ? Number(rows[0].total_count) : 0 });
  });

  // Relatos do próprio usuário, em qualquer status (com o motivo de rejeição, SEC-42).
  router.get('/mine', requireAuth, async (req, res) => {
    const { rows } = await db.query(
      `SELECT ${SIGHTING_COLUMNS} ${SIGHTING_FROM} WHERE s.author_id = $1 ORDER BY s.created_at DESC LIMIT 200`,
      [req.user.id],
    );
    res.json({ items: rows.map(toSighting) });
  });

  router.get('/:id', async (req, res) => {
    const id = uuidParam.safeParse(req.params.id);
    if (!id.success) throw notFound();
    const { rows } = await db.query(`SELECT ${SIGHTING_COLUMNS} ${SIGHTING_FROM} WHERE s.id = $1`, [id.data]);
    const row = rows[0];
    const isOwner = row && req.user?.id === row.author_id;
    const isModerator = req.user?.role === 'moderador';
    // Não aprovado só é visível para o autor e moderadores; para os outros "não existe".
    if (!row || (row.status !== 'aprovado' && !isOwner && !isModerator)) throw notFound();

    const { rows: photos } = await db.query(
      `SELECT id, status, object_key, thumb_key, reject_reason FROM photos
        WHERE sighting_id = $1 AND thumb_key IS NOT NULL ORDER BY created_at`,
      [row.id],
    );
    const visible = photos.filter((p) => (p.status === 'aprovado' && row.status === 'aprovado') || isOwner || isModerator);
    const photoItems = await Promise.all(visible.map(async (p) => ({
      id: p.id,
      status: p.status,
      rejectReason: p.reject_reason,
      url: await storage.presignGet(p.object_key, expires),
      thumbUrl: await storage.presignGet(p.thumb_key, expires),
    })));
    res.json({ ...toSighting(row), photos: photoItems });
  });

  router.post('/', requireAuth, createLimiter, async (req, res) => {
    const input = createSightingSchema.parse(req.body);
    const { rows } = await db.query(
      `INSERT INTO sightings (author_id, cryptid_id, title, description, city, uf, latitude, longitude, seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [req.user.id, input.cryptidId, input.title, input.description, input.city, input.uf,
        input.latitude ?? null, input.longitude ?? null, input.seenAt],
    );
    res.status(201).json({ id: rows[0].id, status: 'pendente' });
  });

  // SEC-23: o filtro por author_id e status fica no próprio UPDATE/DELETE (sem IDOR).
  router.patch('/:id', requireAuth, async (req, res) => {
    const id = uuidParam.safeParse(req.params.id);
    if (!id.success) throw notFound();
    const input = updateSightingSchema.parse(req.body);
    const columns = {
      cryptidId: 'cryptid_id', title: 'title', description: 'description', city: 'city',
      uf: 'uf', latitude: 'latitude', longitude: 'longitude', seenAt: 'seen_at',
    };
    const params = [id.data, req.user.id];
    const sets = Object.entries(input).map(([key, value]) => {
      params.push(value);
      return `${columns[key]} = $${params.length}`;
    });
    const { rowCount } = await db.query(
      `UPDATE sightings SET ${sets.join(', ')}, updated_at = now()
        WHERE id = $1 AND author_id = $2 AND status = 'pendente'`,
      params,
    );
    if (!rowCount) throw notFound();
    res.status(204).end();
  });

  router.delete('/:id', requireAuth, async (req, res) => {
    const id = uuidParam.safeParse(req.params.id);
    if (!id.success) throw notFound();
    const { rows: photos } = await db.query(
      `SELECT p.object_key, p.thumb_key FROM photos p JOIN sightings s ON s.id = p.sighting_id
        WHERE s.id = $1 AND s.author_id = $2 AND s.status = 'pendente'`,
      [id.data, req.user.id],
    );
    const { rowCount } = await db.query(
      `DELETE FROM sightings WHERE id = $1 AND author_id = $2 AND status = 'pendente'`,
      [id.data, req.user.id],
    );
    if (!rowCount) throw notFound();
    const keys = photos.flatMap((p) => [p.object_key, p.thumb_key]).filter(Boolean);
    await Promise.allSettled(keys.map((k) => storage.deleteObject(k)));
    res.status(204).end();
  });

  return router;
}
