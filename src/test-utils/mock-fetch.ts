import { vi } from "vitest";

type FetchResponse = {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
};

type Matcher = (input: RequestInfo | URL, init?: RequestInit) => FetchResponse | undefined;

const matchers: Matcher[] = [];

export function resetMockFetch() {
  matchers.length = 0;
}

export function mockCoinGeckoTrending(body: unknown, status = 200) {
  matchers.push((input) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("api.coingecko.com") && url.includes("/search/trending")) {
      return { status, body };
    }
    return undefined;
  });
}

export function mockCoinGeckoPrice(body: unknown, status = 200) {
  matchers.push((input) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("api.coingecko.com") && url.includes("/simple/price")) {
      return { status, body };
    }
    return undefined;
  });
}

export function mockXSearch(responseBySymbol: Record<string, unknown>, status = 200) {
  matchers.push((input, init) => {
    const urlObj = new URL(typeof input === "string" ? input : input.toString());
    if (!urlObj.hostname.includes("api.twitter.com") || !urlObj.pathname.includes("/2/tweets/search/recent")) {
      return undefined;
    }
    const query = urlObj.searchParams.get("query") ?? "";
    const symbolMatch = /\$([A-Z0-9]+)/.exec(query);
    const symbol = symbolMatch ? symbolMatch[1] : "";
    const body = responseBySymbol[symbol] ?? { data: [] };
    return { status, body };
  });
}

export function installMockFetch() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const m = matchers.find((fn) => fn(input, init));
    if (!m) {
      throw new Error(`No mockFetch matcher for request: ${String(input)}`);
    }
    const { status, headers, body } = m(input, init)!;
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": "application/json",
        ...(headers ?? {}),
      },
    });
  });
}

