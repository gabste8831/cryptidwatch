import pino from 'pino';
import { Redis } from 'ioredis';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool, migrate } from './db.js';
import { createS3Storage } from './storage.js';
import { MemoryRateStore, RedisRateStore } from './ratelimit.js';
import { createRedisRankingCache } from './ranking.js';

const config = await loadConfig();
const logger = pino({ level: config.logLevel });

const db = createPool(config);
await migrate(db);

let redis = null;
if (config.redis) {
  redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    tls: config.redis.tls ? {} : undefined, // SEC-51: TLS em trânsito no ElastiCache
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false, // Redis fora do ar = erro imediato, sem fila (SEC-52)
  });
  redis.on('error', (err) => logger.warn({ err: err.message }, 'redis: erro de conexão'));
} else {
  logger.warn('REDIS_HOST não definido: rate limit em memória e ranking sem cache');
}

const app = createApp({
  db,
  config,
  logger,
  storage: createS3Storage(config.s3),
  rateStore: redis ? new RedisRateStore(redis) : new MemoryRateStore(),
  rankingCache: redis ? createRedisRankingCache(redis) : null,
});

const server = app.listen(config.port, () => logger.info({ port: config.port }, 'API no ar'));

// Kubernetes manda SIGTERM antes de matar o pod: termina as requisições em andamento.
const shutdown = () => {
  logger.info('encerrando');
  server.close(async () => {
    await db.end().catch(() => {});
    redis?.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
