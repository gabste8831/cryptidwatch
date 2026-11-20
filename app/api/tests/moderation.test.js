import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildTestApp, cookieFor, createSighting, createUser, getDb, resetDb } from './helpers.js';

describe('Moderação (specs/04-moderacao.md)', () => {
  let app;
  let author;
  let moderator;
  beforeEach(async () => {
    await resetDb();
    ({ app } = await buildTestApp());
    author = await createUser();
    moderator = await createUser({ role: 'moderador', name: 'Mod' });
  });

  it('SEC-03: usuário comum não aprova relato (403)', async () => {
    const id = await createSighting(author);
    const other = await createUser();
    const res = await request(app).post(`/api/moderation/sightings/${id}/approve`).set('Cookie', cookieFor(other));
    expect(res.status).toBe(403);
    expect((await request(app).get('/api/moderation/queue').set('Cookie', cookieFor(other))).status).toBe(403);
  });

  it('SEC-03: moderador rebaixado perde acesso mesmo com token válido', async () => {
    const id = await createSighting(author);
    const cookie = cookieFor(moderator); // token emitido enquanto era moderador
    const db = await getDb();
    await db.query(`UPDATE users SET role = 'usuario' WHERE id = $1`, [moderator.id]);
    const res = await request(app).post(`/api/moderation/sightings/${id}/approve`).set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  it('moderador aprova e o relato passa a ser público', async () => {
    const id = await createSighting(author);
    const res = await request(app).post(`/api/moderation/sightings/${id}/approve`).set('Cookie', cookieFor(moderator));
    expect(res.status).toBe(200);
    const list = await request(app).get('/api/sightings');
    expect(list.body.items.map((s) => s.id)).toEqual([id]);
  });

  it('SEC-40: decisão grava log de auditoria com moderador e IP', async () => {
    const id = await createSighting(author);
    await request(app).post(`/api/moderation/sightings/${id}/approve`).set('Cookie', cookieFor(moderator));
    const db = await getDb();
    const { rows } = await db.query('SELECT * FROM audit_log');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor_id: moderator.id, action: 'avistamento.aprovar', target_id: id });
    expect(rows[0].ip).toBeTruthy();
  });

  it('SEC-40: o log de auditoria não pode ser alterado nem apagado', async () => {
    const id = await createSighting(author);
    await request(app).post(`/api/moderation/sightings/${id}/approve`).set('Cookie', cookieFor(moderator));
    const db = await getDb();
    await expect(db.query(`UPDATE audit_log SET action = 'nada'`)).rejects.toThrow(/somente inserção/);
    await expect(db.query('DELETE FROM audit_log')).rejects.toThrow(/somente inserção/);
  });

  it('SEC-41: moderador não modera o próprio relato', async () => {
    const own = await createSighting(moderator);
    const res = await request(app).post(`/api/moderation/sightings/${own}/approve`).set('Cookie', cookieFor(moderator));
    expect(res.status).toBe(403);
  });

  it('SEC-42: rejeitar exige motivo, e o autor vê o motivo', async () => {
    const id = await createSighting(author);
    const noReason = await request(app).post(`/api/moderation/sightings/${id}/reject`)
      .set('Cookie', cookieFor(moderator)).send({});
    expect(noReason.status).toBe(400);
    const ok = await request(app).post(`/api/moderation/sightings/${id}/reject`)
      .set('Cookie', cookieFor(moderator)).send({ reason: 'Relato duplicado' });
    expect(ok.status).toBe(200);
    const mine = await request(app).get('/api/sightings/mine').set('Cookie', cookieFor(author));
    expect(mine.body.items[0]).toMatchObject({ status: 'rejeitado', rejectReason: 'Relato duplicado' });
  });

  it('item já moderado não é moderado de novo (409)', async () => {
    const id = await createSighting(author);
    await request(app).post(`/api/moderation/sightings/${id}/approve`).set('Cookie', cookieFor(moderator));
    const again = await request(app).post(`/api/moderation/sightings/${id}/approve`).set('Cookie', cookieFor(moderator));
    expect(again.status).toBe(409);
  });

  it('fila mostra relatos pendentes', async () => {
    await createSighting(author);
    await createSighting(author, { status: 'aprovado' });
    const res = await request(app).get('/api/moderation/queue').set('Cookie', cookieFor(moderator));
    expect(res.status).toBe(200);
    expect(res.body.sightings).toHaveLength(1);
  });
});
