import fs from 'node:fs';
import pg from 'pg';

export function createPool(config) {
  let ssl = false;
  if (config.dbSsl) {
    ssl = config.dbSslCaFile
      // Caminho vem da configuração do deploy (variável de ambiente), não do usuário.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      ? { rejectUnauthorized: true, ca: fs.readFileSync(config.dbSslCaFile, 'utf8') }
      : { rejectUnauthorized: true };
  }
  return new pg.Pool({ ...config.db, ssl, max: 10, idleTimeoutMillis: 30_000 });
}

/** Aplica o schema. O advisory lock evita duas réplicas migrando ao mesmo tempo. */
export async function migrate(pool) {
  // Caminho fixo, relativo a este arquivo.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const sql = fs.readFileSync(new URL('../sql/schema.sql', import.meta.url), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(7240311)');
    await client.query(sql);
  } finally {
    await client.query('SELECT pg_advisory_unlock(7240311)').catch(() => {});
    client.release();
  }
}

export async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
