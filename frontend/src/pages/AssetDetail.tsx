import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type Post, type LeaderboardEntry, type TrendingAsset } from "../api";

function Pct({ value }: { value: number | string | null }) {
  if (value == null) return <span className="pct neutral">—</span>;
  const n = Number(value);
  if (Number.isNaN(n)) return <span className="pct neutral">—</span>;
  const c = n > 0 ? "positive" : n < 0 ? "negative" : "neutral";
  return (
    <span className={`pct ${c}`}>
      {n > 0 ? "+" : ""}{n.toFixed(2)}%
    </span>
  );
}

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const assetId = id ? parseInt(id, 10) : NaN;
  const [asset, setAsset] = useState<TrendingAsset | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(assetId)) {
      setError("Invalid asset id");
      setLoading(false);
      return;
    }
    Promise.all([
      api.getTrendingAssets().then((r) =>
        r.trending.find((t) => t.asset_id === assetId) ?? null
      ),
      api.getAssetPosts(assetId),
      api.getAssetLeaderboard(assetId),
    ])
      .then(([a, pRes, lRes]) => {
        setAsset(a ?? null);
        setPosts(pRes.posts);
        setLeaderboard(lRes.leaderboard);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [assetId]);

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="error">Error: {error}</div>;

  const symbol = asset?.symbol ?? `Asset ${assetId}`;

  return (
    <>
      <p style={{ marginBottom: "1rem" }}>
        <Link to="/">← Trending</Link>
      </p>
      <h1 style={{ marginBottom: "0.25rem" }}>${symbol}</h1>
      {asset && (
        <p className="time" style={{ marginBottom: "1.5rem" }}>
          Window: {new Date(asset.window_start).toLocaleString()} –{" "}
          {new Date(asset.window_end).toLocaleString()}
        </p>
      )}

      <section className="section">
        <h2>Leaderboard for this asset</h2>
        <div className="card table-wrap">
          {leaderboard.length === 0 ? (
            <p className="text-muted">No scores yet for this asset.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Handle</th>
                  <th>VuScore</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((e, i) => (
                  <tr key={e.id}>
                    <td>{i + 1}</td>
                    <td>
                      <a
                        href={`https://x.com/${e.handle}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        @{e.handle}
                      </a>
                    </td>
                    <td className="mono">{e.vu_score ?? "—"}</td>
                    <td className="time">
                      {e.score_updated_at
                        ? new Date(e.score_updated_at).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="section">
        <h2>Recent posts & outcomes</h2>
        <div className="card table-wrap">
          {posts.length === 0 ? (
            <p className="text-muted">No posts yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Handle</th>
                  <th>Posted</th>
                  <th>Price T0</th>
                  <th>1h</th>
                  <th>4h</th>
                  <th>12h</th>
                  <th>24h</th>
                  <th>Snippet</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => {
                  const byWindow: Record<string, { pct_delta: number | null }> = {};
                  for (const o of p.outcomes) {
                    byWindow[o.window] = { pct_delta: o.pct_delta };
                  }
                  return (
                    <tr key={p.id}>
                      <td>
                        <a
                          href={`https://x.com/${p.handle}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          @{p.handle}
                        </a>
                      </td>
                      <td className="time">
                        {new Date(p.posted_at).toLocaleString()}
                      </td>
                      <td className="mono">
                        {p.price_t0 != null
                          ? Number(p.price_t0).toFixed(4)
                          : "—"}
                      </td>
                      <td><Pct value={byWindow["1h"]?.pct_delta ?? null} /></td>
                      <td><Pct value={byWindow["4h"]?.pct_delta ?? null} /></td>
                      <td><Pct value={byWindow["12h"]?.pct_delta ?? null} /></td>
                      <td><Pct value={byWindow["24h"]?.pct_delta ?? null} /></td>
                      <td>
                        <span className="post-snippet" title={p.content_snippet ?? ""}>
                          {p.content_snippet || "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
