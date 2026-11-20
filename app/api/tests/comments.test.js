import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildTestApp, cookieFor, createSighting, createUser, getDb, resetDb } from './helpers.js';

describe('Comentários (specs/08-comentarios.md)', () => {
  let app;
  let author;
  let sightingId;
  beforeEach(async () => {
    await resetDb();
    ({ app } = await buildTestApp());
    author = await createUser();
    sightingId = await createSighting(author, { status: 'aprovado' });
  });

  const comment = (user, body = 'Vi algo parecido na mesma região!') => request(app)
    .post(`/api/sightings/${sightingId}/comments`).set('Cookie', cookieFor(user)).send({ body });

  it('SEC-90: anônimo não comenta', async () => {
    const res = await request(app).post(`/api/sightings/${sightingId}/comments`).send({ body: 'oi, tudo bem?' });
    expect(res.status).toBe(401);
  });

  it('SEC-90: comentário com mais de 1000 caracteres é recusado', async () => {
    expect((await comment(author, 'x'.repeat(1001))).status).toBe(400);
  });

  it('SEC-90: HTML é guardado como texto puro', async () => {
    await comment(author, '<script>alert(1)</script>');
    const res = await request(app).get(`/api/sightings/${sightingId}/comments`);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.items[0].body).toBe('<script>alert(1)</script>');
  });

  it('SEC-91: o 21º comentário na mesma hora recebe 429', async () => {
    for (let i = 0; i < 20; i += 1) expect((await comment(author, `comentário ${i}`)).status).toBe(201);
    expect((await comment(author)).status).toBe(429);
  });

  it('SEC-92: não dá para comentar em relato pendente', async () => {
    const pending = await createSighting(author);
    const res = await request(app).post(`/api/sightings/${pending}/comments`)
      .set('Cookie', cookieFor(author)).send({ body: 'comentário qualquer' });
    expect(res.status).toBe(404);
  });

  it('SEC-93: outro usuário não apaga o comentário; o autor apaga', async () => {
    const { body: c } = await comment(author);
    const intruder = await createUser();
    expect((await request(app).delete(`/api/comments/${c.id}`).set('Cookie', cookieFor(intruder))).status).toBe(404);
    expect((await request(app).delete(`/api/comments/${c.id}`).set('Cookie', cookieFor(author))).status).toBe(204);
    const list = await request(app).get(`/api/sightings/${sightingId}/comments`);
    expect(list.body.items).toHaveLength(0);
  });

  it('SEC-93: moderador remove comentário alheio e fica no audit_log', async () => {
    const { body: c } = await comment(author);
    const mod = await createUser({ role: 'moderador' });
    expect((await request(app).delete(`/api/comments/${c.id}`).set('Cookie', cookieFor(mod))).status).toBe(204);
    const db = await getDb();
    const { rows } = await db.query(`SELECT action FROM audit_log WHERE target_id = $1`, [c.id]);
    expect(rows.map((r) => r.action)).toEqual(['comentario.remover']);
  });

  it('SEC-94: denúncia repetida conta uma vez; 3 pessoas ocultam o comentário', async () => {
    const { body: c } = await comment(author);
    const [u1, u2, u3] = await Promise.all([createUser(), createUser(), createUser()]);
    const report = (u) => request(app).post(`/api/comments/${c.id}/report`).set('Cookie', cookieFor(u))
      .send({ reason: 'spam' });

    expect((await report(u1)).body).toEqual({ reports: 1, hidden: false });
    expect((await report(u1)).body).toEqual({ reports: 1, hidden: false });
    await report(u2);
    expect((await report(u3)).body).toEqual({ reports: 3, hidden: true });

    const list = await request(app).get(`/api/sightings/${sightingId}/comments`);
    expect(list.body.items).toHaveLength(0);
  });

  it('SEC-94: ninguém denuncia o próprio comentário', async () => {
    const { body: c } = await comment(author);
    const res = await request(app).post(`/api/comments/${c.id}/report`).set('Cookie', cookieFor(author))
      .send({ reason: 'teste' });
    expect(res.status).toBe(400);
  });

  it('SEC-94: moderador restaura comentário oculto', async () => {
    const { body: c } = await comment(author);
    const db = await getDb();
    await db.query(`UPDATE comments SET status = 'oculto' WHERE id = $1`, [c.id]);
    const mod = await createUser({ role: 'moderador' });
    const queue = await request(app).get('/api/moderation/queue').set('Cookie', cookieFor(mod));
    expect(queue.body.comments.map((x) => x.id)).toEqual([c.id]);
    const res = await request(app).post(`/api/moderation/comments/${c.id}/restore`).set('Cookie', cookieFor(mod));
    expect(res.status).toBe(204);
    const list = await request(app).get(`/api/sightings/${sightingId}/comments`);
    expect(list.body.items).toHaveLength(1);
  });

  it('SEC-95: listagem não expõe e-mail dos autores', async () => {
    await comment(author);
    const res = await request(app).get(`/api/sightings/${sightingId}/comments`);
    expect(JSON.stringify(res.body)).not.toContain('@');
    expect(res.body.items[0].author).toEqual({ id: author.id, name: author.name });
  });

  it('contagem de comentários aparece na lista de avistamentos', async () => {
    await comment(author);
    await comment(author, 'Mais um comentário');
    const res = await request(app).get('/api/sightings');
    expect(res.body.items[0].commentCount).toBe(2);
  });

  it('moderador define o nível de credibilidade ao aprovar', async () => {
    const pending = await createSighting(author);
    const mod = await createUser({ role: 'moderador' });
    const bad = await request(app).post(`/api/moderation/sightings/${pending}/approve`)
      .set('Cookie', cookieFor(mod)).send({ credibility: 9 });
    expect(bad.status).toBe(400);
    await request(app).post(`/api/moderation/sightings/${pending}/approve`)
      .set('Cookie', cookieFor(mod)).send({ credibility: 5 });
    const detail = await request(app).get(`/api/sightings/${pending}`);
    expect(detail.body.credibility).toBe(5);
  });
});
