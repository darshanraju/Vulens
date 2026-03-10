-- Vu Layer 1 — Initial schema (Phase1 §4 Data stores)
-- Run with: psql $DATABASE_URL -f migrations/001_initial.sql
-- Or via: npm run db:migrate

-- Accounts (CT accounts with VuScore)
CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT PRIMARY KEY,
  handle TEXT NOT NULL,
  vu_score NUMERIC(5,2),
  score_updated_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_handle ON accounts(handle);
CREATE INDEX IF NOT EXISTS idx_accounts_vu_score ON accounts(vu_score DESC NULLS LAST);

-- Assets (resolved $TICKER → CoinGecko ID / contract)
CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  coingecko_id TEXT,
  contract_address TEXT,
  chain TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_symbol ON assets(symbol);
CREATE INDEX IF NOT EXISTS idx_assets_coingecko_id ON assets(coingecko_id) WHERE coingecko_id IS NOT NULL;

-- Posts (cashtag mentions with raw payload and enrichment)
CREATE TABLE IF NOT EXISTS posts (
  id BIGINT PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id),
  asset_id INT REFERENCES assets(id),
  content_snippet TEXT,
  posted_at TIMESTAMPTZ NOT NULL,
  price_t0 NUMERIC(20,8),
  sentiment TEXT CHECK (sentiment IN ('bullish', 'bearish', 'neutral')),
  engagement JSONB DEFAULT '{}',
  raw_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_account_id ON posts(account_id);
CREATE INDEX IF NOT EXISTS idx_posts_asset_id ON posts(asset_id);
CREATE INDEX IF NOT EXISTS idx_posts_posted_at ON posts(posted_at);
CREATE INDEX IF NOT EXISTS idx_posts_posted_at_asset ON posts(posted_at, asset_id);

-- Outcomes (price at T+1h, T+4h, T+24h, T+7d per post)
CREATE TABLE IF NOT EXISTS outcomes (
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  window TEXT NOT NULL CHECK (window IN ('1h', '4h', '24h', '7d')),
  price_at_window NUMERIC(20,8),
  pct_delta NUMERIC(10,4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, window)
);

CREATE INDEX IF NOT EXISTS idx_outcomes_post_id ON outcomes(post_id);
