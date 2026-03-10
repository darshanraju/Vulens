/**
 * Scraper fallback for when X API is unavailable or rate-limited.
 * Same process as ingestion; trigger on stream error.
 * MVP: log and optionally retry. Expand with Playwright later.
 */
export function onStreamError(error: unknown): void {
  console.error("[scraper fallback] Stream error (scraper stub):", error);
  // TODO: trigger Playwright/Puppeteer scrape when API fails or rate-limited
}
