-- Trending assets per 24h window
CREATE TABLE IF NOT EXISTS asset_trending (
  asset_id INT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (asset_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_asset_trending_window ON asset_trending(window_start, window_end);

