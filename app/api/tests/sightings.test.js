import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildTestApp, cookieFor, createSighting, createUser, cryptidId, resetDb, sightingPayload } from './helpers.js';

describe('Avistamentos (specs/02-avistamentos.md)', () => {
  let app;
  let author;
  beforeEach(async () => {
    await resetDb();
    ({ app } = await buildTestApp());
    author = await createUser();
  });

  const create = async (overrides = {}, user = author) => request(app).post('/api/sightings')
    .set('Cookie', cookieFor(user))
    .send({ cryptidId: await cryptidId(), ...sightingPayload(overrides) });

  it('cria avistamento autenticado e exige login', async () => {
    expect((await create()).status).toBe(201);
    const anon = await request(app).post('/api/sightings').send({ cryptidId: 1, ...sightingPayload() });
    expect(anon.status).toBe(401);
  });

  it('SEC-01: injeção de SQL na busca é tratada como texto comum', async () => {
    await createSighting(author, { status: 'aprovado' });
    const res = await request(app).get('/api/sightings').query({ q: "' OR 1=1--" });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });

  it('SEC-01: ordenação por coluna fora da lista é recusada', async () => {
    const res = await request(app).get('/api/sightings').query({ sort: 'password_hash' });
    expect(res.status).toBe(400);
  });

  it('SEC-01: curingas do LIKE (% e _) são literais', async () => {
    await createSighting(author, { status: 'aprovado', title: 'Avistamento comum' });
    const res = await request(app).get('/api/sightings').query({ q: '%' });
    expect(res.body.items).toHaveLength(0);
  });

  it('SEC-02: mais de 10 relatos por hora recebe 429', async () => {
    for (let i = 0; i < 10; i += 1) expect((await create()).status).toBe(201);
    expect((await create()).status).toBe(429);
  });

  it('SEC-07: campo desconhecido no corpo é recusado', async () => {
    const res = await create({ status: 'aprovado' });
    expect(res.status).toBe(400);
  });

  it('SEC-20: título com 121 caracteres é recusado', async () => {
    expect((await create({ title: 'x'.repeat(121) })).status).toBe(400);
  });

  it('SEC-20: data futura é recusada', async () => {
    const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    expect((await create({ seenAt: tomorrow })).status).toBe(400);
  });

  it('SEC-20: UF fora da lista é recusada', async () => {
    expect((await create({ uf: 'XX' })).status).toBe(400);
  });

  it('SEC-22: relato novo nasce pendente e não aparece na lista pública', async () => {
    const res = await create();
    expect(res.body.status).toBe('pendente');
    const list = await request(app).get('/api/sightings');
    expect(list.body.items).toHaveLength(0);
    const detail = await request(app).get(`/api/sightings/${res.body.id}`);
    expect(detail.status).toBe(404);
    const own = await request(app).get(`/api/sightings/${res.body.id}`).set('Cookie', cookieFor(author));
    expect(own.status).toBe(200);
  });

  it('SEC-23: outro usuário não edita nem apaga o relato (IDOR)', async () => {
    const id = await createSighting(author);
    const intruder = await createUser();
    const patch = await request(app).patch(`/api/sightings/${id}`).set('Cookie', cookieFor(intruder))
      .send({ title: 'Hackeado' });
    expect(patch.status).toBe(404);
    const del = await request(app).delete(`/api/sightings/${id}`).set('Cookie', cookieFor(intruder));
    expect(del.status).toBe(404);
    const ownPatch = await request(app).patch(`/api/sightings/${id}`).set('Cookie', cookieFor(author))
      .send({ title: 'Título corrigido' });
    expect(ownPatch.status).toBe(204);
  });

  it('SEC-23: relato já aprovado não pode mais ser editado', async () => {
    const id = await createSighting(author, { status: 'aprovado' });
    const res = await request(app).patch(`/api/sightings/${id}`).set('Cookie', cookieFor(author))
      .send({ title: 'Mudando depois' });
    expect(res.status).toBe(404);
  });

  it('SEC-24: no máximo 50 itens por página', async () => {
    for (let i = 0; i < 55; i += 1) await createSighting(author, { status: 'aprovado', title: `Relato ${i}` });
    const res = await request(app).get('/api/sightings').query({ limit: 500 });
    expect(res.body.items).toHaveLength(50);
    expect(res.body.total).toBe(55);
  });

  it('filtra por criptídeo, UF e texto', async () => {
    await createSighting(author, { status: 'aprovado', slug: 'pe-grande', uf: 'SC', title: 'Pegadas na neve' });
    await createSighting(author, { status: 'aprovado', slug: 'chupa-cabra', uf: 'PB', title: 'Cabras mortas' });
    const byCryptid = await request(app).get('/api/sightings').query({ cryptid: 'pe-grande' });
    expect(byCryptid.body.items.map((s) => s.title)).toEqual(['Pegadas na neve']);
    const byUf = await request(app).get('/api/sightings').query({ uf: 'PB' });
    expect(byUf.body.items.map((s) => s.title)).toEqual(['Cabras mortas']);
    const byText = await request(app).get('/api/sightings').query({ q: 'cabras' });
    expect(byText.body.items).toHaveLength(1);
  });

  it('ID que não é UUID retorna 404 sem erro interno', async () => {
    const res = await request(app).get("/api/sightings/1' OR '1'='1");
    expect(res.status).toBe(404);
  });
});
