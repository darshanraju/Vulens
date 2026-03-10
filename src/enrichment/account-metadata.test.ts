import { describe, it, expect } from "vitest";
import { extractAccountMetadata } from "./account-metadata.js";

describe("account-metadata", () => {
  it("returns empty when no includes or users", () => {
    expect(extractAccountMetadata({}, "123")).toEqual({});
    expect(extractAccountMetadata({ includes: {} }, "123")).toEqual({});
    expect(extractAccountMetadata({ includes: { users: [] } }, "123")).toEqual({});
  });

  it("extracts followers_count when present", () => {
    const raw = {
      includes: {
        users: [
          { id: "123", username: "alice", public_metrics: { followers_count: 5000 } },
        ],
      },
    };
    expect(extractAccountMetadata(raw, "123")).toEqual({ followers_count: 5000 });
  });

  it("extracts verified when true or verified_type set", () => {
    expect(
      extractAccountMetadata(
        { includes: { users: [{ id: "1", verified: true }] } },
        "1"
      )
    ).toEqual({ verified: true });

    expect(
      extractAccountMetadata(
        { includes: { users: [{ id: "2", verified_type: "blue" }] } },
        "2"
      )
    ).toEqual({ verified: true });
  });

  it("returns empty for non-matching author_id", () => {
    const raw = {
      includes: {
        users: [{ id: "456", public_metrics: { followers_count: 10 } }],
      },
    };
    expect(extractAccountMetadata(raw, "123")).toEqual({});
  });
});
