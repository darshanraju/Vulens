/**
 * Phase 1e — Sentiment classifier: bullish / bearish / neutral.
 * MVP: keyword-based; can swap for OpenAI or self-hosted later.
 */
export type SentimentLabel = "bullish" | "bearish" | "neutral";

const BULLISH = [
  "moon", "pump", "bull", "bullish", "buy", "long", "ath", "rocket", "gem", "mooning",
  "accumulate", "dip buy", "to the moon", "lfg", "wagmi", "green", "breakout", "rally",
];
const BEARISH = [
  "dump", "bear", "bearish", "sell", "short", "crash", "rug", "scam", "fud", "red",
  "correction", "bottom", "cap", "dyor", "correction", "dumpster",
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

/**
 * Classify post text as bullish, bearish, or neutral.
 */
export function classifySentiment(text: string): SentimentLabel {
  if (!text || typeof text !== "string") return "neutral";
  const normalized = normalize(text);
  let bull = 0;
  let bear = 0;
  for (const w of BULLISH) {
    if (normalized.includes(w)) bull++;
  }
  for (const w of BEARISH) {
    if (normalized.includes(w)) bear++;
  }
  if (bull > bear) return "bullish";
  if (bear > bull) return "bearish";
  return "neutral";
}
