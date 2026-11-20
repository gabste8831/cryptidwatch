import { beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { SESSION_COOKIE } from '../src/auth.js';
import { buildTestApp, config, createUser, getDb, resetDb, TEST_PASSWORD } from './helpers.js';

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

describe('Autenticação (specs/01-autenticacao.md)', () => {
  let app;
  beforeEach(async () => {
    await resetDb();
    ({ app } = await buildTestApp());
  });

  it('SEC-10: senha é guardada com bcrypt, nunca em texto puro', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ name: 'Ana', email: 'Ana@Teste.local', password: 'uma-senha-forte' });
    expect(res.status).toBe(201);
    const db = await getDb();
    const { rows } = await db.query('SELECT email, password_hash FROM users');
    expect(rows[0].email).toBe('ana@teste.local'); // SEC-11: e-mail normalizado
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
    expect(rows[0].password_hash).not.toContain('uma-senha-forte');
  });

  it('SEC-11: senha com menos de 10 caracteres é recusada', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ name: 'Ana', email: 'ana@teste.local', password: '123456789' });
    expect(res.status).toBe(400);
  });

  it('SEC-12: token com alg "none" é rejeitado', async () => {
    const user = await createUser();
    const forged = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ sub: user.id })}.`;
    const res = await request(app).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${forged}`);
    expect(res.status).toBe(401);
  });

  it('SEC-12: token assinado com outro segredo é rejeitado', async () => {
    const user = await createUser();
    const token = jwt.sign({ sub: user.id }, 'outro-segredo-qualquer-com-32-bytes-ou-mais');
    const res = await request(app).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${token}`);
    expect(res.status).toBe(401);
  });

  it('SEC-12: token expirado é rejeitado', async () => {
    const user = await createUser();
    const token = jwt.sign({ sub: user.id, exp: Math.floor(Date.now() / 1000) - 10 }, config.jwtSecret);
    const res = await request(app).get('/api/auth/me').set('Cookie', `${SESSION_COOKIE}=${token}`);
    expect(res.status).toBe(401);
  });

  it('SEC-13: cookie de sessão é HttpOnly, Secure e SameSite=Strict', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(res.body).not.toHaveProperty('token'); // o token não aparece no corpo
  });

  it('SEC-14: e-mail inexistente e senha errada têm a mesma resposta', async () => {
    const user = await createUser();
    const wrongPass = await request(app).post('/api/auth/login').send({ email: user.email, password: 'senha-errada-123' });
    const noUser = await request(app).post('/api/auth/login').send({ email: 'nao-existe@teste.local', password: 'senha-errada-123' });
    expect(wrongPass.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(noUser.body).toEqual(wrongPass.body);
  });

  it('SEC-15: cadastro não aceita o campo role (ninguém vira moderador sozinho)', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ name: 'Eva', email: 'eva@teste.local', password: 'uma-senha-forte', role: 'moderador' });
    expect(res.status).toBe(400);
    const db = await getDb();
    const { rows } = await db.query(`SELECT COUNT(*)::int AS n FROM users WHERE role = 'moderador'`);
    expect(rows[0].n).toBe(0);
  });

  it('SEC-16: a 6ª tentativa de login no mesmo minuto recebe 429', async () => {
    const user = await createUser();
    for (let i = 0; i < 5; i += 1) {
      const r = await request(app).post('/api/auth/login').send({ email: user.email, password: 'errada-errada' });
      expect(r.status).toBe(401);
    }
    const blocked = await request(app).post('/api/auth/login').send({ email: user.email, password: TEST_PASSWORD });
    expect(blocked.status).toBe(429);
  });

  it('SEC-52: se o armazenamento do rate limit cair, o login falha fechado (503)', async () => {
    const broken = { hit: async () => { throw new Error('redis fora do ar'); } };
    const { app: appSemRedis } = await buildTestApp({ rateStore: broken });
    const user = await createUser();
    const res = await request(appSemRedis).post('/api/auth/login').send({ email: user.email, password: TEST_PASSWORD });
    expect(res.status).toBe(503);
  });

  it('login, /me e logout funcionam de ponta a ponta', async () => {
    const user = await createUser({ name: 'Bia' });
    const agent = request.agent(app);
    // supertest usa http: o cookie Secure não voltaria sozinho, então reenviamos manualmente.
    const login = await agent.post('/api/auth/login').send({ email: user.email, password: TEST_PASSWORD });
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.body.user).toMatchObject({ name: 'Bia', role: 'usuario' });
    const out = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(204);
    expect(out.headers['set-cookie'][0]).toMatch(/cw_session=;/);
  });
});
