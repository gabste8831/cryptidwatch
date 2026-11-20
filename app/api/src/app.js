import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { authenticate } from './auth.js';
import { errorHandler, HttpError } from './errors.js';
import { getRanking } from './ranking.js';
import { authRoutes } from './routes/auth.js';
import { sightingRoutes } from './routes/sightings.js';
import { photoRoutes } from './routes/photos.js';
import { moderationRoutes } from './routes/moderation.js';
import { commentRoutes } from './routes/comments.js';

/**
 * Monta a aplicação. As dependências (banco, storage, cache, rate limit) são injetadas,
 * então os testes trocam S3/Redis por versões em memória e usam um PostgreSQL real.
 */
export function createApp(deps) {
  const { db, config, logger } = deps;
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy); // atrás do ALB, req.ip vem do X-Forwarded-For

  app.use(pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = crypto.randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    // Cookies e senhas nunca vão para o log.
    redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
    autoLogging: { ignore: (req) => req.url.startsWith('/api/health') },
  }));

  // SEC-06: cabeçalhos de segurança. A API só devolve JSON, então a CSP bloqueia tudo.
  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    hsts: { maxAge: 31_536_000, includeSubDomains: true },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  }));
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // Requisições que mudam estado só aceitam JSON. Junto com SameSite=Strict, isso
  // impede um formulário de outro site de disparar ações (CSRF).
  app.use((req, _res, next) => {
    const hasBody = Number(req.headers['content-length'] || 0) > 0 || req.headers['transfer-encoding'];
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && hasBody && !req.is('application/json')) {
      return next(new HttpError(415, 'envie application/json'));
    }
    return next();
  });

  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());
  app.use(authenticate(deps));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/health/ready', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  });

  app.get('/api/cryptids', async (_req, res) => {
    const { rows } = await db.query('SELECT id, slug, name, description FROM cryptids ORDER BY name');
    res.json({ items: rows });
  });

  app.get('/api/ranking', async (req, res) => {
    res.json(await getRanking({ ...deps, log: req.log }));
  });

  // Números do painel da home.
  app.get('/api/stats', async (_req, res) => {
    const { rows: [s] } = await db.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'aprovado')::int AS casos,
              COUNT(*) FILTER (WHERE status = 'aprovado' AND created_at > now() - interval '30 days')::int AS casos_30d,
              COUNT(DISTINCT cryptid_id) FILTER (WHERE status = 'aprovado')::int AS criptideos,
              COUNT(DISTINCT uf) FILTER (WHERE status = 'aprovado')::int AS estados
         FROM sightings`,
    );
    res.json({ cases: s.casos, cases30d: s.casos_30d, cryptids: s.criptideos, states: s.estados });
  });

  app.use('/api', commentRoutes(deps));
  app.use('/api/auth', authRoutes(deps));
  app.use('/api/sightings', sightingRoutes(deps));
  app.use('/api', photoRoutes(deps));
  app.use('/api/moderation', moderationRoutes(deps));

  app.use((_req, _res, next) => next(new HttpError(404, 'não encontrado')));
  app.use(errorHandler);
  return app;
}
