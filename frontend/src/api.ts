const API_BASE = import.meta.env.VITE_API_URL || "";

export interface TrendingAsset {
  asset_id: number;
  symbol: string;
  coingecko_id: string | null;
  window_start: string;
  window_end: string;
}

export interface Outcome {
  window: string;
  price_at_window: number | null;
  pct_delta: number | null;
}

export interface Post {
  id: string;
  account_id: string;
  handle: string;
  content_snippet: string | null;
  posted_at: string;
  price_t0: number | null;
  outcomes: Outcome[];
}

export interface LeaderboardEntry {
  id: string;
  handle: string;
  vu_score: number | null;
  score_updated_at: string | null;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  getTrendingAssets: () => get<{ trending: TrendingAsset[] }>("/trending-assets"),
  getAssetPosts: (assetId: number, limit = 50) =>
    get<{ posts: Post[] }>(`/trending-assets/${assetId}/posts?limit=${limit}`),
  getAssetLeaderboard: (assetId: number, limit = 20) =>
    get<{ leaderboard: LeaderboardEntry[] }>(`/trending-assets/${assetId}/leaderboard?limit=${limit}`),
  getLeaderboard: (limit = 50) =>
    get<{ leaderboard: LeaderboardEntry[] }>(`/leaderboard?limit=${limit}`),
  runWorker: async (): Promise<{ started: boolean; message?: string }> => {
    const res = await fetch(`${API_BASE}/admin/run-worker`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  },
};
