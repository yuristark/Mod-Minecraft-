-- WC Edificações — schema inicial
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS admins (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  email           CITEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  last_login_at   TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- O token da sessão nunca é salvo em texto puro: guardamos apenas o SHA-256.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash   CHAR(64) PRIMARY KEY,
  admin_id     INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  csrf_token   CHAR(64) NOT NULL,
  ip_hash      CHAR(64),
  user_agent   VARCHAR(300),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_admin_idx ON sessions(admin_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS projects (
  id          SERIAL PRIMARY KEY,
  slug        VARCHAR(140) NOT NULL UNIQUE,
  title       VARCHAR(140) NOT NULL,
  category    VARCHAR(20) NOT NULL CHECK (category IN ('residencial','comercial','industrial','reforma')),
  status      VARCHAR(20) NOT NULL CHECK (status IN ('concluida','em_andamento','lancamento')),
  city        VARCHAR(100) NOT NULL,
  area_m2     NUMERIC(10,2) CHECK (area_m2 IS NULL OR area_m2 > 0),
  year        SMALLINT CHECK (year IS NULL OR year BETWEEN 1950 AND 2100),
  duration_months SMALLINT CHECK (duration_months IS NULL OR duration_months BETWEEN 1 AND 240),
  summary     VARCHAR(280) NOT NULL,
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 8000),
  featured    BOOLEAN NOT NULL DEFAULT false,
  published   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_public_idx ON projects(published, category, status);

CREATE TABLE IF NOT EXISTS project_images (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename    VARCHAR(80) NOT NULL UNIQUE,
  width       INTEGER NOT NULL,
  height      INTEGER NOT NULL,
  alt         VARCHAR(200) NOT NULL DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_images_project_idx ON project_images(project_id, position);

CREATE TABLE IF NOT EXISTS quotes (
  id            SERIAL PRIMARY KEY,
  protocol      VARCHAR(16) NOT NULL UNIQUE,
  name          VARCHAR(120) NOT NULL,
  email         CITEXT NOT NULL,
  phone         VARCHAR(20) NOT NULL,
  city          VARCHAR(100) NOT NULL,
  project_type  VARCHAR(20) NOT NULL CHECK (project_type IN ('residencial','comercial','industrial','reforma')),
  standard      VARCHAR(10) CHECK (standard IN ('economico','medio','alto')),
  area_m2       NUMERIC(10,2) CHECK (area_m2 IS NULL OR area_m2 > 0),
  has_land      BOOLEAN,
  has_project   BOOLEAN,
  start_window  VARCHAR(20) CHECK (start_window IN ('imediato','3_meses','6_meses','sem_data')),
  estimate_min  NUMERIC(14,2),
  estimate_max  NUMERIC(14,2),
  message       TEXT NOT NULL DEFAULT '' CHECK (char_length(message) <= 3000),
  consent_at    TIMESTAMPTZ NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','em_contato','proposta','fechado','descartado')),
  notes         TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 4000),
  ip_hash       CHAR(64),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quotes_status_idx ON quotes(status, created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key        VARCHAR(60) PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL PRIMARY KEY,
  admin_id   INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  action     VARCHAR(60) NOT NULL,
  entity     VARCHAR(40),
  entity_id  VARCHAR(40),
  ip_hash    CHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log(created_at DESC);

-- Valores de referência do simulador (editáveis no painel).
INSERT INTO settings (key, value) VALUES (
  'simulator',
  '{
    "pricePerM2": {
      "residencial": { "economico": 2100, "medio": 2800, "alto": 3900 },
      "comercial":   { "economico": 2300, "medio": 3100, "alto": 4300 },
      "industrial":  { "economico": 1700, "medio": 2300, "alto": 3200 },
      "reforma":     { "economico": 900,  "medio": 1500, "alto": 2400 }
    },
    "variationPercent": 12,
    "extras": {
      "projetoArquitetonico": { "label": "Projeto arquitetônico e complementares", "percent": 6 },
      "terraplenagem": { "label": "Terraplenagem e fundação especial", "percent": 5 },
      "areaExterna": { "label": "Área externa / paisagismo", "percent": 4 }
    },
    "referenceNote": "Valores de referência por m², sem terreno. A proposta final depende de projeto, solo e especificações."
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;
