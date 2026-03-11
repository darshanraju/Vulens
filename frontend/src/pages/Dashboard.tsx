import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type TrendingAsset, type LeaderboardEntry } from "../api";

function formatWindow(window_start: string, window_end: string) {
  const s = new Date(window_start);
  const e = new Date(window_end);
  return `${s.toLocaleDateString()} – ${e.toLocaleDateString()}`;
}

export default function Dashboard() {
  const [trending, setTrending] = useState<TrendingAsset[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workerStatus, setWorkerStatus] = useState<string | null>(null);

  const load = () => {
    setError(null);
    Promise.all([api.getTrendingAssets(), api.getLeaderboard()])
      .then(([tRes, lRes]) => {
        setTrending(tRes.trending);
        setLeaderboard(lRes.leaderboard);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const runWorker = async () => {
    setWorkerStatus("Starting worker…");
    try {
      const result = await api.runWorker();
      setWorkerStatus(result.message ?? "Worker started. Refresh in a minute to see data.");
    } catch (e) {
      setWorkerStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="error">Error: {error}</div>;

  const uniqueTrending = trending.filter(
    (t, i, a) => a.findIndex((x) => x.asset_id === t.asset_id) === i
  );

  return (
    <>
      <section className="section">
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <h1 style={{ margin: 0 }}>Trending assets</h1>
          <button
            type="button"
            onClick={runWorker}
            className="card"
            style={{
              cursor: "pointer",
              border: "1px solid var(--accent-dim)",
              color: "var(--accent)",
              fontWeight: 600,
            }}
          >
            Run worker (populate DB)
          </button>
          <button
            type="button"
            onClick={() => { setLoading(true); load(); }}
            className="card"
            style={{
              cursor: "pointer",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          >
            Refresh data
          </button>
        </div>
        {workerStatus && (
          <p className="text-muted" style={{ marginBottom: "1rem" }}>{workerStatus}</p>
        )}
        <div className="trending-grid">
          {uniqueTrending.length === 0 ? (
            <p className="text-muted">No trending assets yet.</p>
          ) : (
            <>
              <p className="text-muted" style={{ marginBottom: "0.5rem" }}>
                Click an asset to see posts (tweets) and outcomes.
              </p>
              {uniqueTrending.map((a) => (
              <Link
                key={a.asset_id}
                to={`/asset/${a.asset_id}`}
                className="trending-card"
              >
                <span className="symbol">${a.symbol}</span>
                <div className="window">{formatWindow(a.window_start, a.window_end)}</div>
              </Link>
            ))}
            </>
          )}
        </div>
      </section>

      <section className="section">
        <h2>Global leaderboard (VuScore)</h2>
        <div className="card table-wrap">
          {leaderboard.length === 0 ? (
            <p className="text-muted">No scores yet.</p>
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
    </>
  );
}
