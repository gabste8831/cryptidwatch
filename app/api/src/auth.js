import jwt from 'jsonwebtoken';
import { HttpError } from './errors.js';

export const SESSION_COOKIE = 'cw_session';

export function signToken(user, config) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwtExpiresSec,
  });
}

// SEC-13: cookie HttpOnly (fora do alcance do JavaScript), Secure e SameSite=Strict.
export function sessionCookieOptions(config) {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: config.jwtExpiresSec * 1000,
  };
}

/**
 * Identifica o usuário a partir do cookie. Token inválido = visitante anônimo.
 * SEC-12: só HS256 é aceito (bloqueia `alg: none` e confusão de algoritmo).
 * SEC-03: o papel vem do banco a cada requisição, não do token; rebaixar um
 * moderador tem efeito imediato.
 */
export function authenticate({ db, config }) {
  return async (req, _res, next) => {
    req.user = null;
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) return next();
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    } catch {
      return next();
    }
    const { rows } = await db.query('SELECT id, email, name, role FROM users WHERE id = $1', [payload.sub]);
    req.user = rows[0] ?? null;
    return next();
  };
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'não autenticado'));
  return next();
}

export function requireRole(role) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'não autenticado'));
    if (req.user.role !== role) return next(new HttpError(403, 'acesso negado'));
    return next();
  };
}
