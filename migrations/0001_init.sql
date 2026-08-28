-- Esquema inicial: ofertas coletadas/geradas e seu agendamento.
-- Aplique com: wrangler d1 migrations apply ofertas-db

CREATE TABLE IF NOT EXISTS offers (
  id               TEXT PRIMARY KEY,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  -- draft | scheduled | ready | sent | canceled
  status           TEXT NOT NULL DEFAULT 'draft',
  -- epoch em ms para o disparo agendado (NULL enquanto rascunho)
  scheduled_at     INTEGER,
  sent_at          INTEGER,

  -- Dados da oferta (entrada do gerador)
  product_name     TEXT NOT NULL,
  price            REAL NOT NULL,
  old_price        REAL,
  link             TEXT NOT NULL,
  platform         TEXT NOT NULL,       -- shopee | meli
  offer_type       TEXT NOT NULL,       -- padrao | relampago | cupom
  category         TEXT,
  free_shipping    INTEGER NOT NULL DEFAULT 0,
  coupon_json      TEXT,                -- JSON de Coupon

  -- Mensagens geradas
  variations_json  TEXT NOT NULL,       -- JSON: string[3]
  selected_index   INTEGER NOT NULL DEFAULT 0,

  -- Destino e origem
  groups_json      TEXT NOT NULL DEFAULT '[]', -- JSON: string[] (grupos de WhatsApp)
  source           TEXT NOT NULL DEFAULT 'manual' -- manual | shopee_affiliate | meli_affiliate
);

CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_scheduled_at ON offers(scheduled_at);
