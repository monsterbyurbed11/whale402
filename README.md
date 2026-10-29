# 🐋 Whale402 — Smart Money Whale Radar, Insider Cabal Audits & Copy-Trade Profiler MCP

[![Glama MCP Server](https://glama.ai/mcp/servers/monsterbyurbed11/whale402/badge)](https://glama.ai/mcp/servers/monsterbyurbed11/whale402)
[![npm version](https://img.shields.io/npm/v/whale402-mcp.svg)](https://www.npmjs.com/package/whale402-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

Real-time **Smart Money Whale Radar**, **Insider Sybil Cluster & Cabal Bundling Audits**, and **Wallet Copy-Trading Performance Profiler** for autonomous **AI Agents, Trading Bots, Claude Desktop, and Cursor** across **Base, Solana, Ethereum, Arbitrum, BSC, and Polygon**.

* 🎁 **Zero-Config Free Tier (3 Free Calls / Day)**: Run immediately in Claude Desktop, Cursor, Glama, or Smithery with **no wallet setup required** for your first 3 queries every day.
* ⚡ **Instant Prepaid Base USDC Credits (`$1.00 = 50 Whale Scans / 33 Cabal Audits / 100 Wallet Profiles`)**: Send `$1.00 USDC` once on Base to `0x8a8c238ed2b46908Ff6C6922a3870984f20f8913` and pass your transaction hash (`0x...`) for sub-15ms credit deduction with zero RPC confirmation lag.
* 🪙 **Official Coinbase `x402` Standard (`x402Version: 1`)**: Compatible out-of-the-box with `x402-fetch`, `x402-axios`, and Coinbase CDP AgentKit.
* 🛡️ **Fail-Closed High-Stakes Security**: Never provides false-safe reports on low-liquidity or unverified pools.

🌐 **Production Gateway**: `https://whale402.acter.workers.dev`  
📊 **Live Funnel & Revenue Analytics**: `https://whale402.acter.workers.dev/v1/analytics`

---

## 📦 Quick Start: MCP Server (Claude Desktop, Cursor, Cline, Windsurf, Glama)

Run directly via `npx` (first **3 calls/day are 100% free**; optionally add `WHALE402_TX_HASH` for unlimited prepaid calls):

```json
{
  "mcpServers": {
    "whale402": {
      "command": "npx",
      "args": ["-y", "whale402-mcp"],
      "env": {
        "WHALE402_TX_HASH": "0x_OPTIONAL_PREPAID_BASE_USDC_TX_HASH"
      }
    }
  }
}
```

### Available MCP Tools & REST Endpoints
| Tool / Endpoint | Free Tier | Unlimited Price | Description |
| :--- | :--- | :--- | :--- |
| `get_token_whale_activity` / `GET /v1/token-whales` | **3 Free / Day** | **$0.02 USDC** | Inspects top holders, Smart Money net inflow ($), whale dominance %, and computes `WhaleAccumulationScore` (0-100). |
| `get_smart_money_radar` / `GET /v1/smart-money-radar` | **3 Free / Day** | **$0.02 USDC** | Scans newly active & trending tokens on Base/Solana/ETH currently accumulated by verified high-win-rate (>70%) wallets. |
| `detect_insider_clusters` / `GET /v1/insider-cluster` | **3 Free / Day** | **$0.03 USDC** | Graph analysis on top holders detecting shared gas funding roots, Sybil bundling, and dev cabal distribution. |
| `profile_wallet_smart_money` / `GET /v1/wallet-profiler` | **3 Free / Day** | **$0.01 USDC** | Profiles historical trade history, Win Rate %, realized PnL, 30-day ROI, hold duration, and assigns a `CopyTradeGrade` (`A+` to `F`). |
| `get_credits_and_payment_info` / `GET /v1/credits` | **Always Free** | **$0.00 (Free)** | Check remaining prepaid USDC credit balance for any `0x...` txHash or get deposit instructions. |

---

## ⚡ Instant Multi-Call Prepaid Credits (Built for High-Speed Trading Bots)

Per-request on-chain transfers are too slow for automated trading agents. Whale402 solves this automatically:
1. Send any amount $\ge \$0.01$ USDC on Base to `0x8a8c238ed2b46908Ff6C6922a3870984f20f8913` (e.g., **$1.00 USDC** = `1,000,000` units).
2. Pass `paymentProof: "0x<your_tx_hash>"` in any MCP tool call or `Authorization: x402 0x<your_tx_hash>` on REST requests.
3. **Call #1** verifies the receipt on Base RPC and initializes your credit balance (`$0.98` remaining = 49 more whale scans or 98 wallet profiles).
4. **Subsequent Calls** skip Base RPC completely and deduct credits in **< 15ms**, returning `X-402-Credits-Remaining-USDC` and `X-402-Calls-Remaining` headers on every response!

---

## 💡 Example API Usage

### 1. Check Smart Money Accumulation on a Token
```bash
curl "https://whale402.acter.workers.dev/v1/token-whales?network=base&tokenAddress=0x0578d8a44db98b23bf096a382e016e29a5ce0ffe"
```

Response:
```json
{
  "success": true,
  "data": {
    "tokenAddress": "0x0578d8a44db98b23bf096a382e016e29a5ce0ffe",
    "network": "base",
    "symbol": "HIGHER",
    "whaleAccumulationScore": 84,
    "signal": "STRONG_ACCUMULATION",
    "smartMoneyNetInflow24hUsd": 42180,
    "whaleDominancePct": 38.4,
    "totalWhalesTracking": 8,
    "topHolders": [
      {
        "address": "0x4b2...8f1",
        "tier": "APEX_WHALE",
        "historicalWinRatePct": 82,
        "realizedPnlUsd": 412000,
        "supplyPct": 9.2
      }
    ]
  }
}
```

### 2. Audit Sybil Bundling & Dev Cabal Risk
```bash
curl "https://whale402.acter.workers.dev/v1/insider-cluster?network=base&tokenAddress=0x0578d8a44db98b23bf096a382e016e29a5ce0ffe"
```

Response:
```json
{
  "success": true,
  "data": {
    "clusterRisk": "LOW",
    "bundledSupplyPct": 4.2,
    "totalInsidersDetected": 0,
    "cabalScore": 14,
    "verdict": "PASSED: Organic decentralized distribution. No significant shared funding sources or coordinated Sybil bundling detected among top holders."
  }
}
```

---

## 🤖 ElizaOS / Python Agent Integration

```python
import requests

GATEWAY = "https://whale402.acter.workers.dev"
TX_HASH = "0x<your_prepaid_tx_hash>"

headers = {
    "Authorization": f"x402 {TX_HASH}"
}

# Scan radar for early high-conviction whale accumulation
res = requests.get(f"{GATEWAY}/v1/smart-money-radar?network=base&limit=5", headers=headers)
radar = res.json()

for token in radar["data"]:
    if token["whaleAccumulationScore"] >= 80 and token["signal"] == "STRONG_ACCUMULATION":
        print(f"🚨 Alpha Alert: {token['symbol']} ({token['tokenAddress']}) accumulated by {token['smartMoneyWalletsInvolved']} smart wallets!")
```

---

## 📄 License
MIT © 2026 monsterbyurbed11
