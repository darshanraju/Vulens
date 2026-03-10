/**
 * Map $TICKER symbol (from X entities) to CoinGecko API id.
 * MVP: static map; extend with API lookup (CoinGecko search) later.
 */
const SYMBOL_TO_COINGECKO: Record<string, string> = {
  SOL: "solana",
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
  USDC: "usd-coin",
  BNB: "binancecoin",
  XRP: "ripple",
  DOGE: "dogecoin",
  ADA: "cardano",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  DOT: "polkadot",
  MATIC: "matic-network",
  UNI: "uniswap",
  ATOM: "cosmos",
  LTC: "litecoin",
  PEPE: "pepe",
  SHIB: "shiba-inu",
  APT: "aptos",
  SUI: "sui",
  ARB: "arbitrum",
  OP: "optimism",
  INJ: "injective-protocol",
  TIA: "celestia",
  SEI: "sei-network",
  WIF: "dogwifcoin",
  BONK: "bonk",
  FLOKI: "floki",
  RENDER: "render-token",
  NEAR: "near",
  FIL: "filecoin",
  IMX: "immutable-x",
  RUNE: "thorchain",
  STX: "blockstack",
  FET: "fetch-ai",
  JUP: "jupiter-exchange-solana",
  PENDLE: "pendle",
  ENA: "ethena",
  W: "wormhole",
  STRK: "starknet",
  PYTH: "pyth-network",
  JTO: "jito-governance-token",
  TNSR: "tensor",
  WLD: "worldcoin-wld",
  RONIN: "ronin",
  SAND: "the-sandbox",
  MANA: "decentraland",
  AXS: "axie-infinity",
  GALA: "gala",
  GRT: "the-graph",
};

export function getCoinGeckoId(symbol: string): string | null {
  const normalized = symbol.toUpperCase().trim();
  return SYMBOL_TO_COINGECKO[normalized] ?? null;
}

export function getKnownSymbols(): string[] {
  return Object.keys(SYMBOL_TO_COINGECKO);
}
