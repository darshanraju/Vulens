/**
 * Server entrypoint when USE_MOCK_X=true: patches fetch with mock CoinGecko + X, then starts the API.
 * Use with: USE_MOCK_X=true npx tsx watch src/server-mock.ts
 */
import "./dev-mock-fetch.js";
import "./server.js";
