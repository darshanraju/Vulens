import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Pool } from "pg";
import { resolveAsset } from "./resolve-and-insert.js";

describe("resolve-and-insert", () => {
  let pool: Pool;

  beforeEach(() => {
    pool = {
      query: vi.fn(),
    } as unknown as Pool;
  });

  it("returns existing asset id when symbol exists", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 42 }],
    });
    const id = await resolveAsset(pool, "SOL");
    expect(id).toBe(42);
    expect(pool.query).toHaveBeenCalledWith("SELECT id FROM assets WHERE symbol = $1", ["SOL"]);
  });

  it("inserts new asset and returns id when symbol known", async () => {
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const id = await resolveAsset(pool, "SOL");
    expect(id).toBe(1);
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect((pool.query as ReturnType<typeof vi.fn>).mock.calls[1][0]).toContain("INSERT INTO assets");
  });

  it("returns null when symbol unknown and not in map", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const id = await resolveAsset(pool, "UNKNOWNXYZ");
    expect(id).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});
