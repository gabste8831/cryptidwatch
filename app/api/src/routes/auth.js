import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth, signToken, sessionCookieOptions, SESSION_COOKIE } from '../auth.js';
import { HttpError } from '../errors.js';
import { rateLimit } from '../ratelimit.js';
import { registerSchema, loginSchema } from '../validation.js';

// Hash fixo para comparar quando o e-mail não existe: o tempo de resposta fica igual (SEC-14).
const DUMMY_HASH = bcrypt.hashSync('cryptidwatch-dummy-password', 4);

export function authRoutes({ db, config, rateStore }) {
  const router = Router();

  const loginLimiter = rateLimit({
    store: rateStore, name: 'login', ...config.limits.login, keyFn: (req) => req.ip, failClosed: true,
  });
  const registerLimiter = rateLimit({
    store: rateStore, name: 'register', ...config.limits.register, keyFn: (req) => req.ip, failClosed: true,
  });

  router.post('/register', registerLimiter, async (req, res) => {
    const input = registerSchema.parse(req.body);
    const hash = await bcrypt.hash(input.password, config.bcryptRounds); // SEC-10
    const { rows } = await db.query(
      `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, name, role`,
      [input.email, input.name, hash],
    );
    if (!rows[0]) throw new HttpError(409, 'e-mail já cadastrado');
    res.cookie(SESSION_COOKIE, signToken(rows[0], config), sessionCookieOptions(config));
    res.status(201).json({ user: rows[0] });
  });

  router.post('/login', loginLimiter, async (req, res) => {
    const input = loginSchema.parse(req.body);
    const { rows } = await db.query(
      'SELECT id, email, name, role, password_hash FROM users WHERE email = $1',
      [input.email],
    );
    const user = rows[0];
    const ok = await bcrypt.compare(input.password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !ok) {
      req.log?.warn({ email: input.email, ip: req.ip }, 'falha de login'); // SEC-16
      throw new HttpError(401, 'credenciais inválidas'); // SEC-14: mesma resposta nos dois casos
    }
    res.cookie(SESSION_COOKIE, signToken(user, config), sessionCookieOptions(config));
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });

  router.post('/logout', (_req, res) => {
    const { maxAge: _maxAge, ...opts } = sessionCookieOptions(config);
    res.clearCookie(SESSION_COOKIE, opts);
    res.status(204).end();
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}
