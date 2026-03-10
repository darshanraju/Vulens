import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Pool } from "pg";
import { persistTweet } from "./store.js";
import type { PersistibleTweet } from "./types.js";

describe("ingestion/store", () => {
  let pool: Pool;
  const tweet: PersistibleTweet = {
    id: "100",
    author_id: "200",
    handle: "bob",
    text: "Hello $SOL",
    created_at: "2026-03-09T12:00:00.000Z",
    raw: { data: {} },
  };

  beforeEach(() => {
    pool = {
      query: vi.fn().mockResolvedValue({ rowCount: 1 }),
    } as unknown as Pool;
  });

  it("upserts account and inserts post", async () => {
    await persistTweet(pool, tweet);
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("INSERT INTO accounts"),
      ["200", "bob"]
    );
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO posts"),
      ["100", "200", "Hello $SOL", expect.any(Date), expect.any(String)]
    );
  });

  it("truncates content_snippet to 500 chars", async () => {
    const long = "x".repeat(600);
    await persistTweet(pool, { ...tweet, text: long });
    expect(pool.query).toHaveBeenCalledTimes(2);
    const insertPostCall = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1];
    const params = insertPostCall[1] as unknown[];
    expect(params[2]).toHaveLength(500);
  });
});
