import type { Pool } from "pg";
import type { PersistibleTweet } from "./types.js";

export async function persistTweet(pool: Pool, tweet: PersistibleTweet): Promise<void> {
  await pool.query(
    `INSERT INTO accounts (id, handle, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET
       handle = COALESCE(EXCLUDED.handle, accounts.handle),
       updated_at = NOW()`,
    [tweet.author_id, tweet.handle ?? ""]
  );

  await pool.query(
    `INSERT INTO posts (id, account_id, content_snippet, posted_at, raw_json, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [
      tweet.id,
      tweet.author_id,
      tweet.text.slice(0, 500),
      new Date(tweet.created_at),
      JSON.stringify(tweet.raw),
    ]
  );
}
