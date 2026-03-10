```mermaid
flowchart TD
  subgraph externalApis [External APIs]
    cg[CoinGecko\nTrending Endpoint]
    xapi[X API\nRecent Search]
  end

  subgraph workerDaily [Daily Worker]
    fetchTrending[\"Fetch trending assets\n(last 24h)\"]
    upsertAssets[\"Upsert assets\n+ asset_trending\"]
    searchTweets[\"Search verified tweets\n$SYMBOL lang:en -is:retweet is:verified\"]
    ingestPosts[\"Insert posts + accounts\"]
    outcomes[\"Run outcome tracking\n(1h,4h,24h)\"]
    scoring[\"Run scoring\nVuScore_trending\"]
  end

  subgraph db [Postgres]
    accounts[(accounts)]
    assets[(assets)]
    posts[(posts)]
    outcomesTbl[(outcomes)]
    assetTrending[(asset_trending)]
  end

  subgraph apiSvc [API Service]
    api[\"/trending-assets\n/trending-assets/:id/posts\n/trending-assets/:id/leaderboard\n/leaderboard\"]
  end

  cg --> fetchTrending
  fetchTrending --> upsertAssets
  upsertAssets --> assets
  upsertAssets --> assetTrending

  assetTrending --> searchTweets
  searchTweets --> xapi
  xapi --> searchTweets
  searchTweets --> ingestPosts

  ingestPosts --> accounts
  ingestPosts --> posts

  posts --> outcomes
  assets --> outcomes
  outcomes --> outcomesTbl

  outcomesTbl --> scoring
  posts --> scoring
  scoring --> accounts

  api --> accounts
  api --> assets
  api --> posts
  api --> outcomesTbl
  api --> assetTrending
```
