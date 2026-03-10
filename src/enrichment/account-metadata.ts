/**
 * Extract account metadata from X stream raw payload (when user.fields included).
 * MVP: store followers_count, verified when present in includes.users.
 */
export interface AccountMetadata {
  followers_count?: number;
  verified?: boolean;
}

interface UserWithMeta {
  id: string;
  username?: string;
  public_metrics?: { followers_count?: number };
  verified?: boolean;
  verified_type?: string | null;
}

export function extractAccountMetadata(
  raw: unknown,
  authorId: string
): AccountMetadata {
  const payload = raw as { includes?: { users?: UserWithMeta[] } };
  const users = payload?.includes?.users;
  if (!Array.isArray(users)) return {};

  const user = users.find((u) => u.id === authorId);
  if (!user) return {};

  const meta: AccountMetadata = {};
  if (typeof user.public_metrics?.followers_count === "number") {
    meta.followers_count = user.public_metrics.followers_count;
  }
  if (user.verified === true || (user.verified_type && user.verified_type !== "none")) {
    meta.verified = true;
  }
  return meta;
}
