import { describe, it, expect } from "vitest";
import { getCoinGeckoId, getKnownSymbols } from "./asset-resolver.js";

describe("asset-resolver", () => {
  describe("getCoinGeckoId", () => {
    it("returns CoinGecko id for known symbol", () => {
      expect(getCoinGeckoId("SOL")).toBe("solana");
      expect(getCoinGeckoId("sol")).toBe("solana");
      expect(getCoinGeckoId("  BTC  ")).toBe("bitcoin");
      expect(getCoinGeckoId("ETH")).toBe("ethereum");
    });

    it("returns null for unknown symbol", () => {
      expect(getCoinGeckoId("UNKNOWN")).toBeNull();
      expect(getCoinGeckoId("")).toBeNull();
    });
  });

  describe("getKnownSymbols", () => {
    it("returns non-empty array of uppercase symbols", () => {
      const syms = getKnownSymbols();
      expect(syms.length).toBeGreaterThan(0);
      expect(syms).toContain("SOL");
      expect(syms).toContain("BTC");
      expect(syms.every((s) => s === s.toUpperCase())).toBe(true);
    });
  });
});
