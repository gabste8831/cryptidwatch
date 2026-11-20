-- Schema do CryptidWatch. Idempotente: roda a cada start da API (com advisory lock).

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  name          text NOT NULL,
  password_hash text NOT NULL,                       -- SEC-10: bcrypt
  role          text NOT NULL DEFAULT 'usuario' CHECK (role IN ('usuario', 'moderador')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cryptids (
  id          serial PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text NOT NULL
);

CREATE TABLE IF NOT EXISTS sightings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cryptid_id    int  NOT NULL REFERENCES cryptids(id),
  title         text NOT NULL,
  description   text NOT NULL,
  city          text NOT NULL,
  uf            char(2) NOT NULL,
  latitude      numeric(9, 6),
  longitude     numeric(9, 6),
  seen_at       date NOT NULL,
  status        text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')), -- SEC-22
  reject_reason text,
  moderated_by  uuid REFERENCES users(id),
  moderated_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sightings_status_seen_idx ON sightings (status, seen_at DESC);
CREATE INDEX IF NOT EXISTS sightings_author_idx ON sightings (author_id);

-- Nível de credibilidade dado pelo moderador na aprovação (1 a 5 estrelas, inspirado nas classes do BFRO).
ALTER TABLE sightings ADD COLUMN IF NOT EXISTS credibility smallint CHECK (credibility BETWEEN 1 AND 5);

-- SEC-90..95: comentários com pós-moderação por denúncia.
CREATE TABLE IF NOT EXISTS comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sighting_id uuid NOT NULL REFERENCES sightings(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        text NOT NULL,
  status      text NOT NULL DEFAULT 'visivel' CHECK (status IN ('visivel', 'oculto', 'removido')),
  removed_by  uuid REFERENCES users(id),
  removed_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_sighting_idx ON comments (sighting_id, created_at);

CREATE TABLE IF NOT EXISTS comment_reports (
  comment_id  uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, reporter_id)  -- SEC-94: uma denúncia por pessoa
);

-- SEC-36: o banco guarda só metadados; o arquivo fica no S3.
CREATE TABLE IF NOT EXISTS photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sighting_id   uuid NOT NULL REFERENCES sightings(id) ON DELETE CASCADE,
  owner_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'aguardando_upload'
                CHECK (status IN ('aguardando_upload', 'pendente', 'aprovado', 'rejeitado')),
  object_key    text,
  thumb_key     text,
  sha256        char(64),
  mime          text,
  size_bytes    int,
  width         int,
  height        int,
  reject_reason text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS photos_sighting_idx ON photos (sighting_id);

-- SEC-40: log de auditoria das decisões de moderação.
CREATE TABLE IF NOT EXISTS audit_log (
  id          bigserial PRIMARY KEY,
  actor_id    uuid NOT NULL REFERENCES users(id),
  action      text NOT NULL,
  target_type text NOT NULL,
  target_id   uuid NOT NULL,
  reason      text,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- SEC-40: imutável. Nem a própria aplicação consegue alterar ou apagar uma linha.
CREATE OR REPLACE FUNCTION audit_log_imutavel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log é somente inserção (SEC-40)';
END
$$;
DROP TRIGGER IF EXISTS audit_log_sem_alteracao ON audit_log;
CREATE TRIGGER audit_log_sem_alteracao
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_imutavel();

INSERT INTO cryptids (slug, name, description) VALUES
  ('pe-grande',        'Pé-Grande',         'Primata bípede gigante das florestas da América do Norte.'),
  ('chupa-cabra',      'Chupa-cabra',       'Criatura que ataca rebanhos e drena o sangue dos animais.'),
  ('et-de-varginha',   'ET de Varginha',    'Ser de pele marrom e olhos vermelhos avistado em Varginha (MG), 1996.'),
  ('mapinguari',       'Mapinguari',        'Gigante peludo da Amazônia com uma boca na barriga.'),
  ('boitata',          'Boitatá',           'Serpente de fogo que protege os campos contra queimadas.'),
  ('curupira',         'Curupira',          'Guardião da mata com os pés virados para trás.'),
  ('lobisomem',        'Lobisomem',         'Homem que vira lobo nas noites de lua cheia.'),
  ('mula-sem-cabeca',  'Mula sem cabeça',   'Mula que solta fogo pelo pescoço e galopa pelas noites.'),
  ('mothman',          'Mothman',           'Homem-mariposa de olhos vermelhos de Point Pleasant (EUA).'),
  ('nessie',           'Monstro do Lago Ness', 'Réptil aquático de pescoço longo do lago Ness (Escócia).'),
  ('ovni',             'Disco voador',      'Objeto voador não identificado: luzes, discos e desenhos em plantações.'),
  ('alienigena',       'Alienígena',        'Ser cinzento de cabeça grande e olhos pretos, visto perto de OVNIs.')
ON CONFLICT (slug) DO NOTHING;
