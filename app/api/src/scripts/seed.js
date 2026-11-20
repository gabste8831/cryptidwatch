/**
 * Cria o moderador inicial (SEC-15: não existe rota para virar moderador).
 *
 *   SEED_MODERATOR_EMAIL=mod@cryptidwatch.local SEED_MODERATOR_PASSWORD=... npm run seed
 *
 * Os casos de demonstração (com fotos) são publicados pelo próprio site, pelo
 * scripts/seed-demo.mjs, que passa pelo mesmo fluxo de um usuário real.
 */
import bcrypt from 'bcryptjs';
import { loadConfig } from '../config.js';
import { createPool, migrate } from '../db.js';

const config = await loadConfig();
const db = createPool(config);
await migrate(db);

const email = process.env.SEED_MODERATOR_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_MODERATOR_PASSWORD;
if (!email || !password || password.length < 10) {
  console.error('Defina SEED_MODERATOR_EMAIL e SEED_MODERATOR_PASSWORD (mínimo 10 caracteres).');
  process.exit(1);
}

const hash = await bcrypt.hash(password, config.bcryptRounds);
await db.query(
  `INSERT INTO users (email, name, password_hash, role) VALUES ($1, 'Moderador', $2, 'moderador')
   ON CONFLICT (email) DO UPDATE SET role = 'moderador', password_hash = EXCLUDED.password_hash`,
  [email, hash],
);
console.log(`Moderador pronto: ${email}`);

await db.end();
