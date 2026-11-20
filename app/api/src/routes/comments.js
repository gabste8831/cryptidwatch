import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { withTransaction } from '../db.js';
import { HttpError, notFound } from '../errors.js';
import { rateLimit } from '../ratelimit.js';
import { commentSchema, reportSchema, uuidParam } from '../validation.js';

export const REPORTS_TO_HIDE = 3; // SEC-94

const parseId = (raw) => {
  const id = uuidParam.safeParse(raw);
  if (!id.success) throw notFound();
  return id.data;
};

// SEC-95: só id e nome do autor; nunca e-mail.
export const toComment = (r) => ({
  id: r.id,
  body: r.body,
  createdAt: r.created_at,
  author: { id: r.author_id, name: r.author_name },
});

export function commentRoutes({ db, config, rateStore }) {
  const router = Router();
  const limiter = rateLimit({
    store: rateStore, name: 'comments', ...config.limits.comments, keyFn: (req) => req.user.id,
  });

  // SEC-92: comentários só existem em avistamentos aprovados.
  async function approvedSighting(id) {
    const { rows } = await db.query(`SELECT id FROM sightings WHERE id = $1 AND status = 'aprovado'`, [id]);
    if (!rows[0]) throw notFound();
  }

  router.get('/sightings/:id/comments', async (req, res) => {
    const id = parseId(req.params.id);
    await approvedSighting(id);
    const { rows } = await db.query(
      `SELECT c.id, c.body, c.created_at, c.author_id, u.name AS author_name
         FROM comments c JOIN users u ON u.id = c.author_id
        WHERE c.sighting_id = $1 AND c.status = 'visivel'
        ORDER BY c.created_at LIMIT 500`,
      [id],
    );
    res.json({ items: rows.map(toComment) });
  });

  router.post('/sightings/:id/comments', requireAuth, limiter, async (req, res) => {
    const id = parseId(req.params.id);
    const { body } = commentSchema.parse(req.body);
    await approvedSighting(id);
    const { rows: [c] } = await db.query(
      `INSERT INTO comments (sighting_id, author_id, body) VALUES ($1, $2, $3) RETURNING id, body, created_at`,
      [id, req.user.id, body],
    );
    res.status(201).json(toComment({ ...c, author_id: req.user.id, author_name: req.user.name }));
  });

  // SEC-93: autor apaga o próprio; moderador remove qualquer um (com auditoria).
  router.delete('/comments/:id', requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    const isModerator = req.user.role === 'moderador';
    await withTransaction(db, async (client) => {
      const { rows } = await client.query(
        `UPDATE comments SET status = 'removido', removed_by = $2, removed_at = now()
          WHERE id = $1 AND status <> 'removido' AND (author_id = $2 OR $3)
          RETURNING author_id`,
        [id, req.user.id, isModerator],
      );
      if (!rows[0]) throw notFound();
      if (rows[0].author_id !== req.user.id) {
        await client.query(
          `INSERT INTO audit_log (actor_id, action, target_type, target_id, ip)
           VALUES ($1, 'comentario.remover', 'comentario', $2, $3)`,
          [req.user.id, id, req.ip],
        );
      }
    });
    res.status(204).end();
  });

  // SEC-94: uma denúncia por pessoa; com 3, o comentário fica oculto.
  router.post('/comments/:id/report', requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    const { reason } = reportSchema.parse(req.body);
    const result = await withTransaction(db, async (client) => {
      const { rows } = await client.query(
        `SELECT author_id FROM comments WHERE id = $1 AND status = 'visivel' FOR UPDATE`,
        [id],
      );
      if (!rows[0]) throw notFound();
      if (rows[0].author_id === req.user.id) throw new HttpError(400, 'não dá para denunciar o próprio comentário');
      await client.query(
        `INSERT INTO comment_reports (comment_id, reporter_id, reason) VALUES ($1, $2, $3)
         ON CONFLICT (comment_id, reporter_id) DO NOTHING`,
        [id, req.user.id, reason],
      );
      const { rows: [{ total }] } = await client.query(
        'SELECT COUNT(*)::int AS total FROM comment_reports WHERE comment_id = $1',
        [id],
      );
      if (total >= REPORTS_TO_HIDE) {
        await client.query(`UPDATE comments SET status = 'oculto' WHERE id = $1`, [id]);
      }
      return { reports: total, hidden: total >= REPORTS_TO_HIDE };
    });
    res.json(result);
  });

  return router;
}
