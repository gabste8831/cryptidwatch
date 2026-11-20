/**
 * Cria o moderador inicial (SEC-15: não existe rota para virar moderador) e, se o banco
 * estiver vazio, alguns relatos aprovados para a demonstração.
 *
 *   SEED_MODERATOR_EMAIL=mod@cryptidwatch.local SEED_MODERATOR_PASSWORD=... npm run seed
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
const { rows: [mod] } = await db.query(
  `INSERT INTO users (email, name, password_hash, role) VALUES ($1, 'Moderador', $2, 'moderador')
   ON CONFLICT (email) DO UPDATE SET role = 'moderador', password_hash = EXCLUDED.password_hash
   RETURNING id`,
  [email, hash],
);
console.log(`Moderador pronto: ${email}`);

const { rows: [{ total }] } = await db.query('SELECT COUNT(*)::int AS total FROM sightings');
if (total === 0) {
  const demoHash = await bcrypt.hash(`demo-${Date.now()}-${Math.random()}`, config.bcryptRounds);
  const { rows: [demo] } = await db.query(
    `INSERT INTO users (email, name, password_hash) VALUES ('demo@cryptidwatch.local', 'Testemunha Demo', $1)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [demoHash],
  );
  const relatos = [
    ['et-de-varginha', 'Criatura de olhos vermelhos no Jardim Andere', 'Três jovens viram um ser agachado perto de um muro, pele marrom e oleosa, olhos vermelhos enormes.', 'Varginha', 'MG', -21.5513, -45.4303, '1996-01-20'],
    ['chupa-cabra', 'Cabras atacadas no sítio do vizinho', 'Encontramos quatro cabras com dois furos no pescoço e nenhum sangue. Ouvimos um chiado agudo de madrugada.', 'Campina Grande', 'PB', -7.2307, -35.8817, '2024-08-14'],
    ['mapinguari', 'Rastro gigante perto do igarapé', 'Pegadas redondas de quase meio metro e um cheiro muito forte. Os cachorros não quiseram entrar na mata.', 'Tefé', 'AM', -3.3540, -64.7110, '2025-03-02'],
    ['boitata', 'Luz serpenteando no campo', 'Uma luz azulada comprida se movendo rente ao chão por uns dois minutos, depois sumiu no banhado.', 'Santa Maria', 'RS', -29.6842, -53.8069, '2025-06-21'],
    ['pe-grande', 'Vulto enorme na trilha', 'Durante uma trilha vi um vulto peludo de uns 2,5 m atravessando entre as árvores. Deixou um galho quebrado bem alto.', 'Rio do Sul', 'SC', -27.2142, -49.6431, '2025-09-10'],
  ];
  const comentarios = [
    'Moro perto e meu avô sempre contou essa história. Faz sentido!',
    'Alguém mais ouviu barulho estranho nessa região na mesma semana?',
    'As marcas batem com o que vi em outro relato daqui.',
  ];
  const credibilidade = [5, 3, 4, 2, 3];
  for (const [i, [slug, title, description, city, uf, lat, lng, seenAt]] of relatos.entries()) {
    const { rows: [s] } = await db.query(
      `INSERT INTO sightings (author_id, cryptid_id, title, description, city, uf, latitude, longitude, seen_at,
                              status, moderated_by, moderated_at, credibility)
       SELECT $1, c.id, $3, $4, $5, $6, $7, $8, $9, 'aprovado', $10, now(), $11 FROM cryptids c WHERE c.slug = $2
       RETURNING id`,
      [demo.id, slug, title, description, city, uf, lat, lng, seenAt, mod.id, credibilidade[i]],
    );
    for (const body of comentarios.slice(0, 3 - (i % 3))) {
      await db.query('INSERT INTO comments (sighting_id, author_id, body) VALUES ($1, $2, $3)', [s.id, mod.id, body]);
    }
  }
  console.log(`${relatos.length} relatos de demonstração criados.`);
}

await db.end();
