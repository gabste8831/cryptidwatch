import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildConfig } from '../src/config.js';
import { buildTestApp, cookieFor, createUser, resetDb } from './helpers.js';

describe('Requisitos transversais (specs/README.md)', () => {
  let app;
  beforeAll(async () => {
    await resetDb();
    ({ app } = await buildTestApp());
  });

  it('SEC-05: erro interno não vaza stack trace nem detalhe do banco', async () => {
    const { app: broken } = await buildTestApp({
      db: { query: async () => { throw new Error('relation "users" does not exist at /src/db.js:42'); } },
    });
    const res = await request(broken).get('/api/cryptids');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'erro interno', requestId: expect.any(String) });
    expect(JSON.stringify(res.body)).not.toMatch(/relation|db\.js|at /);
  });

  it('SEC-06: cabeçalhos de segurança presentes', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('SEC-07: corpo acima de 20 KB é recusado', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/sightings').set('Cookie', cookieFor(user))
      .send({ description: 'x'.repeat(25_000) });
    expect(res.status).toBe(413);
  });

  it('SEC-12: segredo JWT curto impede a API de subir', () => {
    expect(() => buildConfig({ JWT_SECRET: 'curto' })).toThrow(/SEC-12/);
  });

  it('CSRF: POST de formulário (não JSON) é recusado com 415', async () => {
    const res = await request(app).post('/api/auth/login')
      .type('form').send('email=a@b.c&password=1234567890');
    expect(res.status).toBe(415);
  });

  it('rota inexistente retorna 404 em JSON', async () => {
    const res = await request(app).get('/api/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('lista os criptídeos cadastrados', async () => {
    const res = await request(app).get('/api/cryptids');
    expect(res.body.items.length).toBeGreaterThanOrEqual(10);
  });
});
