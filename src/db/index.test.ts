import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getPool, healthCheck, resetPoolForTesting } from "./index.js";

describe("db", () => {
  const origEnv = process.env.DATABASE_URL;

  beforeEach(() => {
    resetPoolForTesting();
  });

  afterEach(() => {
    process.env.DATABASE_URL = origEnv;
  });

  describe("getPool", () => {
    it("throws when DATABASE_URL is not set", () => {
      delete process.env.DATABASE_URL;
      expect(() => getPool()).toThrow("DATABASE_URL is required");
    });

    it("throws when DATABASE_URL is empty", () => {
      process.env.DATABASE_URL = "";
      expect(() => getPool()).toThrow("DATABASE_URL is required");
    });
  });

  describe("healthCheck", () => {
    beforeEach(() => {
      process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    });

    it("returns false when pool.query rejects", async () => {
      const pg = await import("pg");
      vi.spyOn(pg.Pool.prototype, "query").mockRejectedValue(new Error("connection refused"));
      const result = await healthCheck();
      expect(result).toBe(false);
      vi.restoreAllMocks();
    });

    it("returns true when pool.query resolves with rowCount 1", async () => {
      const pg = await import("pg");
      vi.spyOn(pg.Pool.prototype, "query").mockResolvedValue({ rowCount: 1 } as never);
      const result = await healthCheck();
      expect(result).toBe(true);
      vi.restoreAllMocks();
    });

    it("returns false when pool.query resolves with rowCount !== 1", async () => {
      const pg = await import("pg");
      vi.spyOn(pg.Pool.prototype, "query").mockResolvedValue({ rowCount: 0 } as never);
      const result = await healthCheck();
      expect(result).toBe(false);
      vi.restoreAllMocks();
    });
  });
});
