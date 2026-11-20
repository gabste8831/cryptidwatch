import { Router } from 'express';
import { requireRole } from '../auth.js';
import { withTransaction } from '../db.js';
import { HttpError, notFound } from '../errors.js';
import { bumpRanking } from '../ranking.js';
import { approveSchema, rejectSchema, uuidParam } from '../validation.js';
import { toSighting } from './sightings.js';

// SEC-40: a decisão e o log de auditoria entram na mesma transação.
async function audit(client, req, action, targetType, targetId, reason = null) {
  await client.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, reason, ip)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [req.user.id, action, targetType, targetId, reason, req.ip],
  );
}

export function moderationRoutes(deps) {
  const { db, config, storage } = deps;
  const router = Router();

  // SEC-03: todas as rotas daqui exigem moderador (papel lido do banco em authenticate).
  router.use(requireRole('moderador'));

  router.get('/queue', async (req, res) => {
    const { rows: sightings } = await db.query(
      `SELECT s.id, s.title, s.description, s.city, s.uf, s.latitude, s.longitude,
              to_char(s.seen_at, 'YYYY-MM-DD') AS seen_at, s.status, s.reject_reason, s.created_at,
              s.author_id, u.name AS author_name, c.id AS cryptid_id, c.slug AS cryptid_slug, c.name AS cryptid_name
         FROM sightings s JOIN users u ON u.id = s.author_id JOIN cryptids c ON c.id = s.cryptid_id
        WHERE s.status = 'pendente' ORDER BY s.created_at LIMIT 100`,
    );
    const { rows: photos } = await db.query(
      `SELECT p.id, p.sighting_id, p.thumb_key, p.object_key, p.owner_id, s.title AS sighting_title,
              p.width, p.height, p.size_bytes, p.sha256
         FROM photos p JOIN sightings s ON s.id = p.sighting_id
        WHERE p.status = 'pendente' ORDER BY p.created_at LIMIT 100`,
    );
    const { rows: comments } = await db.query(
      `SELECT c.id, c.body, c.created_at, c.author_id, u.name AS author_name, c.sighting_id,
              s.title AS sighting_title,
              (SELECT array_agg(r.reason) FROM comment_reports r WHERE r.comment_id = c.id) AS reasons
         FROM comments c JOIN users u ON u.id = c.author_id JOIN sightings s ON s.id = c.sighting_id
        WHERE c.status = 'oculto' ORDER BY c.created_at LIMIT 100`,
    );
    const expires = config.upload.getUrlExpiresSec;
    res.json({
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.created_at,
        author: { id: c.author_id, name: c.author_name },
        sightingId: c.sighting_id,
        sightingTitle: c.sighting_title,
        reasons: c.reasons ?? [],
      })),
      sightings: sightings.map(toSighting),
      photos: await Promise.all(photos.map(async (p) => ({
        id: p.id,
        sightingId: p.sighting_id,
        sightingTitle: p.sighting_title,
        ownerId: p.owner_id,
        width: p.width,
        height: p.height,
        sizeBytes: p.size_bytes,
        sha256: p.sha256,
        thumbUrl: await storage.presignGet(p.thumb_key, expires),
        url: await storage.presignGet(p.object_key, expires),
      }))),
    });
  });

  async function decide(req, { table, action, reason, credibility = null }) {
    const id = uuidParam.safeParse(req.params.id);
    if (!id.success) throw notFound();
    const ownerColumn = table === 'sightings' ? 'author_id' : 'owner_id';
    const status = action.endsWith('aprovar') ? 'aprovado' : 'rejeitado';

    return withTransaction(db, async (client) => {
      const { rows } = await client.query(
        `SELECT id, status, ${ownerColumn} AS owner_id${table === 'sightings' ? ', cryptid_id' : ''}
           FROM ${table} WHERE id = $1 FOR UPDATE`,
        [id.data],
      );
      const item = rows[0];
      if (!item) throw notFound();
      // SEC-41: segregação de funções.
      if (item.owner_id === req.user.id) throw new HttpError(403, 'você não pode moderar o próprio conteúdo');
      if (item.status !== 'pendente') throw new HttpError(409, 'item já foi moderado');

      const extra = table === 'sightings' ? ', moderated_by = $4, moderated_at = now(), credibility = $5' : '';
      const params = [id.data, status, reason];
      if (extra) params.push(req.user.id, credibility);
      await client.query(`UPDATE ${table} SET status = $2, reject_reason = $3${extra} WHERE id = $1`, params);
      await audit(client, req, action, table === 'sightings' ? 'avistamento' : 'foto', id.data, reason);
      return item;
    });
  }

  router.post('/sightings/:id/approve', async (req, res) => {
    const { credibility } = approveSchema.parse(req.body ?? {});
    const item = await decide(req, { table: 'sightings', action: 'avistamento.aprovar', reason: null, credibility });
    await bumpRanking({ ...deps, log: req.log }, item.cryptid_id); // SEC-50
    res.json({ id: item.id, status: 'aprovado', credibility });
  });

  // SEC-94: comentários ocultos por denúncia esperam a decisão do moderador.
  async function decideComment(req, status, action) {
    const id = uuidParam.safeParse(req.params.id);
    if (!id.success) throw notFound();
    await withTransaction(db, async (client) => {
      const { rowCount } = await client.query(
        `UPDATE comments SET status = $2,
                removed_by = CASE WHEN $2 = 'removido' THEN $3::uuid END,
                removed_at = CASE WHEN $2 = 'removido' THEN now() END
          WHERE id = $1 AND status = 'oculto'`,
        [id.data, status, req.user.id],
      );
      if (!rowCount) throw notFound();
      if (status === 'visivel') await client.query('DELETE FROM comment_reports WHERE comment_id = $1', [id.data]);
      await audit(client, req, action, 'comentario', id.data);
    });
  }

  router.post('/comments/:id/restore', async (req, res) => {
    await decideComment(req, 'visivel', 'comentario.restaurar');
    res.status(204).end();
  });

  router.post('/comments/:id/remove', async (req, res) => {
    await decideComment(req, 'removido', 'comentario.remover');
    res.status(204).end();
  });

  router.post('/sightings/:id/reject', async (req, res) => {
    const { reason } = rejectSchema.parse(req.body);
    const item = await decide(req, { table: 'sightings', action: 'avistamento.rejeitar', reason });
    res.json({ id: item.id, status: 'rejeitado' });
  });

  router.post('/photos/:id/approve', async (req, res) => {
    const item = await decide(req, { table: 'photos', action: 'foto.aprovar', reason: null });
    res.json({ id: item.id, status: 'aprovado' });
  });

  router.post('/photos/:id/reject', async (req, res) => {
    const { reason } = rejectSchema.parse(req.body);
    const item = await decide(req, { table: 'photos', action: 'foto.rejeitar', reason });
    res.json({ id: item.id, status: 'rejeitado' });
  });

  router.get('/audit', async (req, res) => {
    const { rows } = await db.query(
      `SELECT a.id, a.action, a.target_type, a.target_id, a.reason, a.ip, a.created_at, u.name AS actor_name
         FROM audit_log a JOIN users u ON u.id = a.actor_id
        ORDER BY a.created_at DESC LIMIT 100`,
    );
    res.json({ items: rows });
  });

  return router;
}
