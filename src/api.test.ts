import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "./api.js";

vi.mock("./db/index.js", () => ({
  healthCheck: vi.fn(),
  getPool: vi.fn(),
}));

const { healthCheck, getPool } = await import("./db/index.js");

function mockPool(rows: unknown[] = []) {
  return { query: vi.fn().mockResolvedValue({ rows }) };
}

describe("API", () => {
  beforeEach(() => {
    vi.mocked(healthCheck).mockReset();
    vi.mocked(getPool).mockReturnValue(mockPool() as never);
  });

  describe("GET /health", () => {
    it("returns 200 and status ok when healthCheck is true", async () => {
      vi.mocked(healthCheck).mockResolvedValue(true);
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok", db: true });
    });

    it("returns 503 and status unhealthy when healthCheck is false", async () => {
      vi.mocked(healthCheck).mockResolvedValue(false);
      const res = await request(app).get("/health");
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ status: "unhealthy", db: false });
    });
  });

  describe("GET /ready", () => {
    it("returns 200 and ready true when healthCheck is true", async () => {
      vi.mocked(healthCheck).mockResolvedValue(true);
      const res = await request(app).get("/ready");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ready: true });
    });

    it("returns 503 and ready false when healthCheck is false", async () => {
      vi.mocked(healthCheck).mockResolvedValue(false);
      const res = await request(app).get("/ready");
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ ready: false });
    });
  });

  describe("GET /posts", () => {
    it("returns posts from db", async () => {
      const pool = mockPool([{ id: "1", account_id: "100", content_snippet: "test" }]);
      vi.mocked(getPool).mockReturnValue(pool as never);
      const res = await request(app).get("/posts");
      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(1);
      expect(res.body.posts[0].id).toBe("1");
    });
  });

  describe("GET /posts/:id", () => {
    it("returns 404 when post not found", async () => {
      vi.mocked(getPool).mockReturnValue(mockPool() as never);
      const res = await request(app).get("/posts/999");
      expect(res.status).toBe(404);
    });
    it("returns post with outcomes when found", async () => {
      const pool = mockPool([{ id: "1", account_id: "100" }]);
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ id: "1", account_id: "100" }] }).mockResolvedValueOnce({ rows: [{ window: "1h", pct_delta: 5 }] });
      vi.mocked(getPool).mockReturnValue(pool as never);
      const res = await request(app).get("/posts/1");
      expect(res.status).toBe(200);
      expect(res.body.outcomes).toEqual([{ window: "1h", pct_delta: 5 }]);
    });
  });

  describe("GET /leaderboard", () => {
    it("returns leaderboard array", async () => {
      const pool = mockPool([{ id: "1", handle: "x", vu_score: 90 }]);
      vi.mocked(getPool).mockReturnValue(pool as never);
      const res = await request(app).get("/leaderboard");
      expect(res.status).toBe(200);
      expect(res.body.leaderboard).toHaveLength(1);
    });
  });
});
