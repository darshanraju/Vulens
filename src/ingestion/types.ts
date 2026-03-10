/**
 * Types for X (Twitter) API v2 Filtered Stream payloads.
 * @see https://developer.x.com/en/docs/twitter-api/tweets/filtered-stream
 */
export interface TweetStreamData {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  entities?: { symbols?: Array<{ tag: string }> };
}

export interface TweetStreamUser {
  id: string;
  username: string;
  name?: string;
}

export interface TweetStreamPayload {
  data: TweetStreamData;
  includes?: { users?: TweetStreamUser[] };
}

export interface PersistibleTweet {
  id: string;
  author_id: string;
  handle: string | null;
  text: string;
  created_at: string;
  raw: unknown;
}
