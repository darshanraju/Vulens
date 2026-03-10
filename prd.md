# Vu — Technical Architecture Document

**Version 1.0 | March 2026 | Confidential**

---

## 1. Goal

X's Smart Cashtags — launching imminently — transforms every `$TOKEN` mention on X into a structured, machine-readable, tradeable financial object. For the first time, social posts are directly linked to specific assets, price data, and trading actions at scale across 700M users.

**Vu's mission:** Be the intelligence layer built on top of Smart Cashtags. The first platform to turn CT (Crypto Twitter) cashtag activity into actionable data — and build the B2C and B2B tooling on top of that data moat.

### Strategic Thesis

> X provides the pipe. Vu provides the brain.

Smart Cashtags tell you _what_ is being discussed. Vu tells you _who_ is discussing it, _how accurate_ they've historically been, _what the crowd sentiment means_, and _when to act_.

### Why Now

- X Smart Cashtags launching March 2026 — structural shift in how financial data flows through social media
- Kaito (closest competitor) had its core Yaps product killed by X's API crackdown in January 2026 — displacing thousands of creators and projects
- The InfoFi / CT intelligence space is wide open for a credibility-first, accuracy-scored platform
- First mover on the data layer wins — the historical accuracy dataset compounds and becomes increasingly hard to replicate

---

## 2. Architecture

### Overview

Vu is built in two layers. Layer 1 is the data moat — ingestion, enrichment, and scoring. Layer 2 is the product suite — B2C and B2B tools built on top of Layer 1.

```mermaid
flowchart TD
    X["X / Twitter\n$CASHTAG Posts"] --> L1["LAYER 1\nData Moat\n(Ingestion + Scoring Engine)"]
    PRICE["Price Feeds\n(CoinGecko / Birdeye / CoinMarketCap)"] --> L1
    CHAIN["On-Chain Data\n(Solana / EVM RPCs)"] --> L1
    L1 --> L2["LAYER 2\nProduct Suite\n(B2C + B2B Tools)"]
    L2 --> USERS["CT Power Users\nCrypto Degens"]
    L2 --> PROJECTS["Token Projects\nMarketing Teams"]
    L2 --> FUNDS["Trading Desks\nHedge Funds"]
```

---

### 2.1 Layer 1 — The Data Moat

Layer 1 is the core competitive advantage. It ingests every cashtag mention from X, enriches it with price data at the time of posting, tracks subsequent price outcomes, and produces an accuracy score per account.

```mermaid
flowchart TD
    subgraph INGEST["INGESTION"]
        A1["X API\nFiltered Stream\n($CASHTAG mentions)"]
        A2["X Scraper\nFallback Layer\n(rate limit protection)"]
    end

    subgraph ENRICH["ENRICHMENT"]
        B1["Asset Resolver\nMap $TICKER → exact asset\n(contract address / CoinGecko ID)"]
        B2["Price Snapshot\nCapture price at T=0\n(post timestamp)"]
        B3["Account Metadata\nFollowers, history,\nverified status"]
    end

    subgraph TRACK["OUTCOME TRACKING"]
        C1["Price Oracle\nPoll price at\nT+1h / T+4h / T+24h / T+7d"]
        C2["Outcome Recorder\nStore % delta\nper call per window"]
    end

    subgraph SCORE["SCORING ENGINE"]
        D1["Accuracy Score\nWeighted by recency,\ncall volume, time horizon"]
        D2["Signal Score\nSentiment velocity\n× caller quality weight"]
        D3["Narrative Clusterer\nGroup related cashtags\ninto macro narratives"]
    end

    subgraph STORE["DATA STORE"]
        E1["Posts DB\nAll cashtag posts\nwith metadata"]
        E2["Accounts DB\nAll scored CT accounts"]
        E3["Assets DB\nPer-asset sentiment\n& signal history"]
        E4["Time-Series DB\nPrice + sentiment\nover time"]
    end

    A1 --> B1
    A2 --> B1
    B1 --> B2
    B1 --> B3
    B2 --> C1
    C1 --> C2
    C2 --> D1
    B2 --> D2
    D1 --> D2
    B1 --> D3
    D1 --> E2
    D2 --> E3
    B2 --> E1
    C2 --> E1
    D2 --> E4
```

#### Key Data Points Captured Per Post

| Field                                              | Source              | Purpose                           |
| -------------------------------------------------- | ------------------- | --------------------------------- |
| Account ID + handle                                | X API               | Link to account accuracy history  |
| `$CASHTAG` + resolved asset                        | X API + CoinGecko   | Identify exact asset being called |
| Post timestamp                                     | X API               | Anchor price snapshot             |
| Price at T=0                                       | CoinGecko / Birdeye | Baseline for outcome tracking     |
| Price at T+1h, T+4h, T+24h, T+7d                   | Price oracle        | Measure call accuracy             |
| Post engagement (likes, RTs, replies)              | X API               | Weight signal quality             |
| Follower count at time of post                     | X API               | Normalise influence               |
| Sentiment classification (bullish/bearish/neutral) | NLP model           | Directional accuracy tracking     |

#### Accuracy Scoring Model

```mermaid
flowchart LR
    P["Post:\n$SOL bullish\n@ $140\nby @account"] --> O1["T+1h: +5%"]
    P --> O2["T+4h: +12%"]
    P --> O3["T+24h: +18%"]
    P --> O4["T+7d: +31%"]
    O1 & O2 & O3 & O4 --> SCORE["Call Score\n(directionally correct\nacross time windows)"]
    SCORE --> ACC["Account Accuracy\nRolling weighted average\nacross all calls\n(last 90 days weighted 2×)"]
    ACC --> VUSCORE["VuScore\n0–100"]
```

---

### 2.2 Layer 2 — Product Suite

All Layer 2 products consume the Layer 1 data via an internal API. Each product is a different lens on the same dataset.

```mermaid
flowchart TD
    L1DB["Layer 1\nData Store\n(Posts / Accounts / Assets / TimeSeries)"]

    subgraph B2C["B2C PRODUCTS"]
        P1["VuSignal\nCaller Accuracy\nLeaderboard"]
        P2["VuAlpha\nSentiment Spike\nAlerts"]
        P3["VuLens\nChrome Extension\n(X Overlay)"]
        P4["VuScore\nAccount Credibility\nScore + Badge"]
        P5["VuMap\nToken Discovery\nHeatmap"]
        P6["VuBot\nTelegram / Discord\nAlpha Bot"]
    end

    subgraph B2B["B2B PRODUCTS"]
        P7["Vu for Projects\nToken Dashboard\nSaaS"]
        P8["VuStudio\nCreator Campaign\nMarketplace"]
        P9["VuAPI\nData Layer\nAPI Access"]
    end

    L1DB --> P1
    L1DB --> P2
    L1DB --> P3
    L1DB --> P4
    L1DB --> P5
    L1DB --> P6
    L1DB --> P7
    L1DB --> P8
    L1DB --> P9
```

#### Layer 2 Product Details

| Product             | Type            | Model                                                             | Description                                                                                                                             |
| ------------------- | --------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **VuSignal**        | B2C + B2B       | Freemium — free top 100, paid full history + filters              | Public leaderboard ranking CT accounts by call accuracy. Free tier drives virality, pro unlocks deeper stats and historical performance |
| **VuAlpha**         | B2C + B2B       | Subscription $30–100/mo; B2B API pricing                          | Real-time alerts when high-VuScore accounts post. Free = 30min delay, Pro = real-time + Telegram + custom watchlists                    |
| **VuLens**          | B2C             | Freemium — 10 hovers/day free, Pro ~$20/mo                        | Chrome extension overlaid on X. Hover any $CASHTAG → see caller score, sentiment trend, signal strength. Zero context switching         |
| **VuScore**         | B2C             | Free to display, Pro for full breakdown + embed badge             | Embeddable credibility score for any CT account. Accounts embed in bio, driving Vu brand awareness                                      |
| **VuMap**           | B2C             | Freemium, Pro for alerts + deeper filters                         | Live visual heatmap of tokens gaining CT attention relative to market cap. Discover tokens early                                        |
| **VuBot**           | B2C             | Free for small groups, paid for large groups or advanced features | Telegram/Discord bot. `/vu $SOL` returns sentiment score, top callers, recent high-signal posts                                         |
| **Vu for Projects** | B2B SaaS        | $500–3,000/mo per project, tiered by token size                   | Real-time cashtag monitoring dashboard for a project's own token — sentiment, caller quality, competitor comparison, influencer alerts  |
| **VuStudio**        | B2B Marketplace | 15–20% take rate on campaign spend                                | CT campaign marketplace. Projects post briefs, verified high-VuScore creators apply, performance-based payouts                          |
| **VuAPI**           | B2B API         | Usage-based + enterprise contracts                                | Raw data API — quality-weighted sentiment, caller scores, asset signal history. Sold to trading bots, funds, analytics platforms        |

---

#### User Flow — B2C (CT Power User)

```mermaid
sequenceDiagram
    participant U as CT Degen
    participant X as X / Twitter
    participant VL as VuLens (Extension)
    participant VA as VuAlpha (Alerts)
    participant VS as VuSignal (Leaderboard)

    U->>X: Scrolling feed, sees $SOL post
    X->>VL: Hover over $SOL cashtag
    VL->>U: Popup: VuScore of poster (82/100), Sentiment trend (↑), Signal strength (High)
    VA->>U: Push alert: "@highaccuracycaller just posted $SOL — 4th time this week"
    U->>VS: Checks VuSignal leaderboard
    VS->>U: Shows @highaccuracycaller ranked #7 globally, 71% accuracy on 94 calls
    U->>U: Makes informed trading decision
```

#### User Flow — B2B (Token Project)

```mermaid
sequenceDiagram
    participant PM as Project Marketing Team
    participant VD as Vu for Projects Dashboard
    participant L1 as Layer 1 Data Engine
    participant VS as VuStudio

    PM->>VD: Logs in, monitors $TOKEN dashboard
    L1->>VD: Real-time feed: 3 high-VuScore accounts just posted $TOKEN
    VD->>PM: Alert: Sentiment spike detected — 340% above 7-day avg
    PM->>VD: Checks which callers are posting, their accuracy scores
    PM->>VS: Opens VuStudio, creates campaign brief for $TOKEN
    VS->>PM: Matches with top-10 VuScore creators relevant to $TOKEN category
    PM->>VS: Locks campaign budget in escrow
    VS->>PM: Performance report: reach, sentiment impact, price correlation
```

---

## 3. Infrastructure

### 3.1 Architecture Stack

```mermaid
flowchart TD
    subgraph FRONTEND["FRONTEND"]
        FE1["Next.js\nWeb App"]
        FE2["React Native\nMobile App"]
        FE3["Chrome Extension\n(VuLens)"]
        FE4["Telegram Bot\n(VuBot)"]
    end

    subgraph BACKEND["BACKEND / API LAYER"]
        BE1["Node.js / FastAPI\nREST + WebSocket API"]
        BE2["GraphQL Layer\n(B2B API consumers)"]
        BE3["Webhook Service\n(Alert delivery)"]
    end

    subgraph DATA["DATA PIPELINE"]
        DP1["X API Stream\nFiltered Stream v2"]
        DP2["Scraper Fallback\nPlaywright / Puppeteer"]
        DP3["Price Oracle\nCoinGecko + Birdeye\n+ on-chain RPCs"]
        DP4["NLP Classifier\nSentiment model\n(bullish / bearish / neutral)"]
        DP5["Scoring Engine\nAccuracy calculation\nper account per asset"]
    end

    subgraph INFRA["INFRASTRUCTURE"]
        I1["PostgreSQL\nAccounts + Posts\n+ Scores"]
        I2["TimescaleDB\nPrice + sentiment\ntime series"]
        I3["Redis\nReal-time cache\n+ alert queues"]
        I4["S3\nRaw post archive"]
        I5["Kafka / BullMQ\nEvent streaming\n+ job queues"]
    end

    subgraph HOSTING["HOSTING"]
        H1["AWS / Vercel\nFrontend + API"]
        H2["Railway / Render\nBackground workers"]
        H3["Cloudflare\nCDN + DDoS protection"]
    end

    DP1 --> I5
    DP2 --> I5
    DP3 --> I5
    I5 --> DP4
    I5 --> DP5
    DP4 --> I1
    DP5 --> I1
    DP5 --> I2
    I1 --> BE1
    I2 --> BE1
    I3 --> BE1
    BE1 --> FE1
    BE1 --> FE2
    BE1 --> FE3
    BE1 --> FE4
    BE1 --> BE2
    BE1 --> BE3
```

---

### 3.2 Infrastructure Costs

#### Monthly Cost Estimate — MVP (0–6 months)

| Component              | Service                         | Spec                           | Monthly Cost       |
| ---------------------- | ------------------------------- | ------------------------------ | ------------------ |
| **X API Access**       | X Basic/Pro API                 | Filtered stream, 500K posts/mo | $100–500           |
| **Price Feed**         | CoinGecko Pro                   | Real-time + historical         | $129               |
| **On-chain RPC**       | Helius (Solana) + Alchemy (EVM) | 10M requests/mo                | $100–200           |
| **Database**           | Supabase (PostgreSQL)           | 8GB, 2 CPU                     | $25                |
| **Time-series DB**     | Timescale Cloud                 | 10GB, starter                  | $50                |
| **Cache**              | Redis Cloud                     | 1GB                            | $30                |
| **Backend API**        | Railway                         | 2 services, 2GB RAM            | $40                |
| **Frontend**           | Vercel Pro                      | —                              | $20                |
| **Background Workers** | Railway                         | 2 workers                      | $40                |
| **Object Storage**     | AWS S3                          | 50GB archive                   | $5                 |
| **CDN + Security**     | Cloudflare Pro                  | —                              | $20                |
| **NLP Model**          | OpenAI API / self-hosted        | Sentiment classification       | $50–150            |
| **Monitoring**         | Datadog / Sentry                | —                              | $30                |
| **TOTAL MVP**          |                                 |                                | **~$640–1,140/mo** |

---

#### Monthly Cost Estimate — Growth (6–18 months, 10K+ users)

| Component              | Service                     | Spec                        | Monthly Cost         |
| ---------------------- | --------------------------- | --------------------------- | -------------------- |
| **X API Access**       | X Enterprise API            | Full filtered stream        | $5,000+              |
| **Price Feed**         | CoinGecko Enterprise        | Full historical + real-time | $500                 |
| **On-chain RPC**       | Helius + Alchemy Enterprise | 100M requests/mo            | $500–1,000           |
| **Database**           | Supabase Pro / AWS RDS      | 32GB, 4 CPU                 | $200                 |
| **Time-series DB**     | Timescale Cloud             | 100GB                       | $300                 |
| **Cache**              | Redis Enterprise            | 5GB cluster                 | $150                 |
| **Backend API**        | AWS ECS / EC2               | 4 instances, auto-scale     | $400                 |
| **Frontend**           | Vercel Enterprise           | CDN, analytics              | $150                 |
| **Background Workers** | AWS ECS                     | 4 workers, auto-scale       | $300                 |
| **Object Storage**     | AWS S3                      | 500GB archive               | $50                  |
| **CDN + Security**     | Cloudflare Business         | —                           | $200                 |
| **NLP Model**          | Self-hosted (GPU inference) | AWS g4dn.xlarge             | $400                 |
| **Monitoring**         | Datadog                     | Full observability          | $200                 |
| **TOTAL GROWTH**       |                             |                             | **~$8,350–9,850/mo** |

---

#### Key Cost Drivers & Risks

| Risk                    | Detail                                                                | Mitigation                                                                    |
| ----------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **X API pricing**       | X may restrict or price-hike API access (killed Kaito)                | Build scraper fallback layer from day 1; diversify data sources               |
| **Price oracle costs**  | High-frequency polling across thousands of assets gets expensive fast | Cache aggressively; only poll assets with active CT mentions                  |
| **NLP at scale**        | Classifying millions of posts/day via OpenAI API gets expensive       | Fine-tune and self-host a small open-source model (e.g. DistilBERT) after MVP |
| **Data storage growth** | Historical post archive grows indefinitely                            | Tier storage: hot (Redis/Postgres) → warm (TimescaleDB) → cold (S3)           |

---

## 4. Competitor Analysis

### Landscape Overview

```mermaid
quadrantChart
    title Crypto Social Intelligence — Competitor Map
    x-axis Low Signal Quality --> High Signal Quality
    y-axis B2C Focus --> B2B Focus
    quadrant-1 High Signal, B2B
    quadrant-2 High Signal, B2C
    quadrant-3 Low Signal, B2C
    quadrant-4 Low Signal, B2B
    Nansen: [0.85, 0.80]
    Arkham: [0.80, 0.75]
    LunarCrush: [0.45, 0.35]
    Santiment: [0.60, 0.60]
    Kaito: [0.70, 0.45]
    CoinGecko: [0.30, 0.30]
    Dexscreener: [0.25, 0.20]
    Vu Target: [0.90, 0.55]
```

### Feature-by-Feature Competitor Coverage

Does each competitor support the equivalent of each Vu Layer 2 product?

| Feature                                    | LunarCrush                               | Kaito                                 | Nansen                | Arkham                | Santiment                | CoinGecko                  |
| ------------------------------------------ | ---------------------------------------- | ------------------------------------- | --------------------- | --------------------- | ------------------------ | -------------------------- |
| **VuSignal** — Caller Accuracy Leaderboard | ❌                                       | ⚠️ Yaps (shutdown Jan 2026)           | ❌                    | ❌                    | ❌                       | ❌                         |
| **VuAlpha** — Sentiment Spike Alerts       | ⚠️ Volume only, no caller quality weight | ❌                                    | ⚠️ Wallet alerts only | ⚠️ Wallet alerts only | ⚠️ Social volume alerts  | ❌                         |
| **VuLens** — Chrome Extension / X Overlay  | ❌                                       | ❌                                    | ❌                    | ❌                    | ❌                       | ❌                         |
| **VuScore** — Account Credibility Score    | ❌                                       | ⚠️ Yaps score (shutdown)              | ❌                    | ❌                    | ❌                       | ❌                         |
| **VuMap** — Token Discovery Heatmap        | ⚠️ Social volume heatmap                 | ⚠️ Mindshare map                      | ❌                    | ❌                    | ⚠️ Social volume trends  | ⚠️ Trending page           |
| **VuBot** — Telegram / Discord Bot         | ⚠️ Basic alerts                          | ❌                                    | ⚠️ Smart money alerts | ❌                    | ⚠️ Basic alerts          | ⚠️ Price alerts only       |
| **Vu for Projects** — Token Dashboard B2B  | ⚠️ Basic sentiment dashboard             | ⚠️ Kaito Connect (limited post-pivot) | ❌                    | ❌                    | ⚠️ On-chain metrics only | ✅ Basic listing analytics |
| **VuStudio** — Creator Campaign Platform   | ❌                                       | ✅ Kaito Studio (new, post-Yaps)      | ❌                    | ❌                    | ❌                       | ❌                         |
| **VuAPI** — Data API                       | ✅ Social data API                       | ⚠️ Limited                            | ✅ On-chain API       | ⚠️ Limited            | ✅ On-chain + social API | ✅ Price + market data API |

**Legend:** ✅ Fully supported | ⚠️ Partial / inferior coverage | ❌ Not supported

### Key Competitive Insight

The only competitor that meaningfully overlaps with Vu's core differentiation — **accuracy-scored caller intelligence** — was Kaito's Yaps system. That product was shut down in January 2026 following X's API policy change. **The window is open.**

LunarCrush is the closest surviving competitor on the B2C social sentiment side, but scores only on _volume_, not _quality_. Nansen and Arkham are purely on-chain. Nobody owns the _social signal quality_ layer that Vu is building.

---

## 5. Build Sequence

```mermaid
gantt
    title Vu Build Roadmap
    dateFormat  YYYY-MM
    section Layer 1 — Data Moat
    X API Integration + Post Ingestion       :2026-03, 4w
    Asset Resolver (ticker → contract)       :2026-03, 3w
    Price Snapshot + Outcome Tracking        :2026-04, 4w
    Accuracy Scoring Engine (v1)             :2026-04, 4w
    NLP Sentiment Classifier                 :2026-05, 3w
    Historical Data Backfill                 :2026-05, 4w
    section Layer 2 — Products
    VuSignal Leaderboard (public beta)       :2026-05, 3w
    VuScore Badge + Embed                    :2026-06, 2w
    VuAlpha Alerts (B2C launch)              :2026-06, 4w
    VuBot (Telegram)                         :2026-07, 2w
    VuLens Chrome Extension                  :2026-07, 4w
    Vu for Projects Dashboard (B2B beta)     :2026-08, 4w
    VuStudio Campaign Marketplace            :2026-09, 6w
    VuAPI (developer access)                 :2026-10, 4w
```

---

_Document prepared by Darshan | Vu | March 2026_
