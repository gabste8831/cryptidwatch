import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createMemoryRankingCache } from '../src/ranking.js';
import { buildTestApp, cookieFor, createSighting, createUser, cryptidId, resetDb, sightingPayload } from './helpers.js';

const totalOf = (res, slug) => res.body.items.find((i) => i.slug === slug).total;

describe('Ranking (specs/05-ranking.md)', () => {
  beforeEach(resetDb);

  it('SEC-50: criar relato não muda o ranking; aprovar soma 1', async () => {
    const { app } = await buildTestApp({ rankingCache: createMemoryRankingCache() });
    const author = await createUser();
    const mod = await createUser({ role: 'moderador' });

    expect(totalOf(await request(app).get('/api/ranking'), 'chupa-cabra')).toBe(0);

    const created = await request(app).post('/api/sightings').set('Cookie', cookieFor(author))
      .send({ cryptidId: await cryptidId('chupa-cabra'), ...sightingPayload() });
    const afterCreate = await request(app).get('/api/ranking');
    expect(afterCreate.body.source).toBe('cache');
    expect(totalOf(afterCreate, 'chupa-cabra')).toBe(0);

    await request(app).post(`/api/moderation/sightings/${created.body.id}/approve`).set('Cookie', cookieFor(mod));
    expect(totalOf(await request(app).get('/api/ranking'), 'chupa-cabra')).toBe(1);
  });

  it('SEC-52: com o Redis fora do ar, o ranking vem do banco', async () => {
    const broken = {
      get: async () => { throw new Error('redis fora do ar'); },
      increment: async () => { throw new Error('redis fora do ar'); },
      rebuild: async () => { throw new Error('redis fora do ar'); },
    };
    const { app } = await buildTestApp({ rankingCache: broken });
    const author = await createUser();
    await createSighting(author, { status: 'aprovado', slug: 'mapinguari' });
    await createSighting(author, { status: 'aprovado', slug: 'mapinguari' });
    await createSighting(author, { status: 'pendente', slug: 'mapinguari' });

    const res = await request(app).get('/api/ranking');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('banco');
    expect(res.body.items[0]).toMatchObject({ slug: 'mapinguari', total: 2 });
  });
});
