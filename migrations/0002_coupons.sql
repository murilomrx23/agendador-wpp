-- Cupons especiais coletados dos canais oficiais do Telegram ou manuais.
-- Aplique com: wrangler d1 migrations apply ofertas-db

CREATE TABLE IF NOT EXISTS coupons (
  id            TEXT PRIMARY KEY,
  created_at    INTEGER NOT NULL,
  platform      TEXT,                -- shopee | meli | NULL (qualquer)
  code          TEXT,                -- código digitável (opcional)
  off_value     TEXT,                -- "5%" ou "70" (opcional)
  description   TEXT,                -- ex.: "TODAS AS LOJAS"
  is_flash      INTEGER NOT NULL DEFAULT 0,
  valid_until   TEXT,                -- horário para cupom relâmpago (ex.: "18h")
  source        TEXT NOT NULL DEFAULT 'manual', -- telegram | manual
  channel       TEXT,                -- canal/página de origem
  raw           TEXT,                -- texto original
  expires_at    INTEGER,             -- epoch ms (opcional)
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_coupons_platform ON coupons(platform);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(active);
CREATE INDEX IF NOT EXISTS idx_coupons_created ON coupons(created_at);
