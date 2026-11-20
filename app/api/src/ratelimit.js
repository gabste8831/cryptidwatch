import { HttpError } from './errors.js';

/** Janela fixa em memória. Usada nos testes e quando não há Redis (dev local). */
export class MemoryRateStore {
  constructor() {
    this.entries = new Map();
  }

  async hit(key, windowMs) {
    const now = Date.now();
    let entry = this.entries.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      this.entries.set(key, entry);
    }
    entry.count += 1;
    return entry.count;
  }
}

/** Janela fixa no Redis: o limite vale para todas as réplicas da API. */
export class RedisRateStore {
  constructor(redis) {
    this.redis = redis;
  }

  async hit(key, windowMs) {
    const k = `rl:${key}`;
    const [[err, count]] = await this.redis.multi().incr(k).pexpire(k, windowMs, 'NX').exec();
    if (err) throw err;
    return count;
  }
}

/**
 * SEC-02 / SEC-16. Com `failClosed`, se o Redis cair a rota é bloqueada (503) em vez de
 * ficar sem limite (SEC-52): derrubar o Redis não libera força bruta no login.
 */
export function rateLimit({ store, name, max, windowMs, keyFn, failClosed = false }) {
  return async (req, res, next) => {
    let count;
    try {
      count = await store.hit(`${name}:${keyFn(req)}`, windowMs);
    } catch (err) {
      req.log?.warn({ err, limiter: name }, 'rate limit indisponível');
      if (failClosed) return next(new HttpError(503, 'serviço temporariamente indisponível'));
      return next();
    }
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - count)));
    if (count > max) {
      req.log?.warn({ limiter: name, ip: req.ip }, 'rate limit excedido');
      res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
      return next(new HttpError(429, 'muitas requisições, tente mais tarde'));
    }
    return next();
  };
}
