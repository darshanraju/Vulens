import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCurrentPriceUsd } from "./price-snapshot.js";

describe("price-snapshot", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns price when API returns usd", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ solana: { usd: 142.5 } }),
    });
    const price = await getCurrentPriceUsd("solana");
    expect(price).toBe(142.5);
  });

  it("returns null when API returns non-ok", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });
    const price = await getCurrentPriceUsd("solana");
    expect(price).toBeNull();
  });

  it("returns null when usd missing", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ solana: {} }),
    });
    const price = await getCurrentPriceUsd("solana");
    expect(price).toBeNull();
  });
});
