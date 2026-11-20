const KEY = 'ranking:cryptids';

/**
 * Cache do ranking num sorted set do Redis. O PostgreSQL é a fonte da verdade:
 * se a chave não existe (ou o Redis caiu), o ranking é recalculado do banco (SEC-52).
 */
export function createRedisRankingCache(redis) {
  return {
    async get() {
      if (!(await redis.exists(KEY))) return null;
      const flat = await redis.zrevrange(KEY, 0, -1, 'WITHSCORES');
      const counts = new Map();
      for (let i = 0; i < flat.length; i += 2) counts.set(Number(flat[i]), Number(flat[i + 1]));
      return counts;
    },
    async increment(cryptidId) {
      // Sem a chave, não incrementa: o próximo GET reconstrói tudo a partir do banco.
      if (await redis.exists(KEY)) await redis.zincrby(KEY, 1, String(cryptidId));
    },
    async rebuild(entries) {
      const tx = redis.multi().del(KEY);
      if (entries.length) tx.zadd(KEY, ...entries.flatMap((e) => [e.count, String(e.cryptidId)]));
      await tx.exec();
    },
  };
}

export function createMemoryRankingCache() {
  let counts = null;
  return {
    async get() {
      return counts && new Map(counts);
    },
    async increment(cryptidId) {
      if (counts) counts.set(cryptidId, (counts.get(cryptidId) ?? 0) + 1);
    },
    async rebuild(entries) {
      counts = new Map(entries.map((e) => [e.cryptidId, e.count]));
    },
  };
}

export async function getRanking({ db, rankingCache, log }) {
  const { rows: cryptids } = await db.query('SELECT id, slug, name FROM cryptids');

  let counts = null;
  let source = 'cache';
  if (rankingCache) {
    try {
      counts = await rankingCache.get();
    } catch (err) {
      log?.warn({ err }, 'ranking: cache indisponível, usando o banco');
    }
  }
  if (!counts) {
    source = 'banco';
    const { rows } = await db.query(
      `SELECT cryptid_id, COUNT(*)::int AS total FROM sightings WHERE status = 'aprovado' GROUP BY cryptid_id`,
    );
    counts = new Map(rows.map((r) => [r.cryptid_id, r.total]));
    if (rankingCache) {
      await rankingCache
        .rebuild(cryptids.map((c) => ({ cryptidId: c.id, count: counts.get(c.id) ?? 0 })))
        .catch((err) => log?.warn({ err }, 'ranking: falha ao reconstruir cache'));
    }
  }

  const items = cryptids
    .map((c) => ({ cryptidId: c.id, slug: c.slug, name: c.name, total: counts.get(c.id) ?? 0 }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));
  return { source, items };
}

/** SEC-50: só chamado na aprovação pelo moderador. Falha no cache não derruba a aprovação. */
export async function bumpRanking({ rankingCache, log }, cryptidId) {
  if (!rankingCache) return;
  try {
    await rankingCache.increment(cryptidId);
  } catch (err) {
    log?.warn({ err }, 'ranking: falha ao incrementar cache');
  }
}
