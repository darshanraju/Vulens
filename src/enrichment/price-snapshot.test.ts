import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPriceAtTimeUsd } from "./price-snapshot.js";

describe("price-snapshot", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  describe("getPriceAtTimeUsd", () => {
    it("returns price from point closest to requested date", async () => {
      const at = new Date("2024-06-15T12:00:00.000Z");
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            prices: [
              [new Date("2024-06-15T11:00:00.000Z").getTime(), 50],
              [new Date("2024-06-15T12:30:00.000Z").getTime(), 100],
              [new Date("2024-06-15T13:00:00.000Z").getTime(), 200],
            ],
          }),
      });
      const price = await getPriceAtTimeUsd("bitcoin", at);
      expect(price).toBe(100);
    });

    it("returns null when API returns non-ok", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });
      const price = await getPriceAtTimeUsd("bitcoin", new Date());
      expect(price).toBeNull();
    });

    it("returns null when prices array is empty", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ prices: [] }),
      });
      const price = await getPriceAtTimeUsd("bitcoin", new Date());
      expect(price).toBeNull();
    });

    it("calls market_chart/range with from/to around at", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ prices: [[Date.now(), 99]] }),
      });
      const at = new Date("2024-01-01T00:00:00.000Z");
      await getPriceAtTimeUsd("ethereum", at);
      const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(url).toContain("/coins/ethereum/market_chart/range");
      expect(url).toContain("vs_currency=usd");
      expect(url).toMatch(/from=\d+/);
      expect(url).toMatch(/to=\d+/);
    });
  });
});
