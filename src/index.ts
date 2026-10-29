import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { isValidAddress, isValidNetwork, SupportedNetwork } from './types.js';
import { analyzeTokenWhales, getSmartMoneyRadar } from './services/smartMoneyEngine.js';
import { detectInsiderClusters } from './services/clusterDetector.js';
import { profileWallet } from './services/walletProfiler.js';
import { getAnalyticsSummary } from './services/analytics.js';
import { DEFAULT_CONFIG, getCreditBalance, paywall402 } from './middleware/paywall402.js';

export const app = new Hono();

app.use('*', cors());

// Define tool schemas for MCP discovery
export const MCP_TOOLS = [
  {
    name: 'get_token_whale_activity',
    description:
      'Analyzes a token across Base, Solana, Ethereum, BSC, or Arbitrum to measure Smart Money net inflow, whale holding dominance, and whale accumulation score (0-100).',
    inputSchema: {
      type: 'object',
      properties: {
        network: {
          type: 'string',
          enum: ['base', 'solana', 'ethereum', 'bsc', 'arbitrum', 'polygon'],
          description: 'Blockchain network (e.g., base, solana, ethereum)',
        },
        tokenAddress: {
          type: 'string',
          description: 'Contract address of the token (0x... or Solana base58)',
        },
        paymentProof: {
          type: 'string',
          description: 'Optional Base USDC txHash (0x...) or x402 payment proof for unlimited calls',
        },
      },
      required: ['network', 'tokenAddress'],
    },
  },
  {
    name: 'get_smart_money_radar',
    description:
      'Scans for top trending tokens currently being aggressively accumulated by verified high-win-rate (>70%) whale wallets.',
    inputSchema: {
      type: 'object',
      properties: {
        network: {
          type: 'string',
          enum: ['base', 'solana', 'ethereum', 'bsc', 'arbitrum', 'polygon'],
          description: 'Optional network filter (leave blank to scan all supported chains)',
        },
        limit: {
          type: 'number',
          description: 'Number of results to return (default: 10, max: 25)',
        },
        paymentProof: {
          type: 'string',
          description: 'Optional Base USDC txHash (0x...) or x402 payment proof for unlimited calls',
        },
      },
    },
  },
  {
    name: 'detect_insider_clusters',
    description:
      'Performs deep Sybil bundling and dev cabal graph analysis on top token holders to detect shared gas funding sources and rug pull risks.',
    inputSchema: {
      type: 'object',
      properties: {
        network: {
          type: 'string',
          enum: ['base', 'solana', 'ethereum', 'bsc', 'arbitrum', 'polygon'],
          description: 'Blockchain network (e.g. base, solana)',
        },
        tokenAddress: {
          type: 'string',
          description: 'Contract address of the token (0x... or Solana base58)',
        },
        paymentProof: {
          type: 'string',
          description: 'Optional Base USDC txHash (0x...) or x402 payment proof for unlimited calls',
        },
      },
      required: ['network', 'tokenAddress'],
    },
  },
  {
    name: 'profile_wallet_smart_money',
    description:
      'Analyzes a trader or whale wallet track record: win rate %, realized PnL, 30-day ROI, hold duration, and assigns a CopyTradeGrade (A+ to F).',
    inputSchema: {
      type: 'object',
      properties: {
        network: {
          type: 'string',
          enum: ['base', 'solana', 'ethereum', 'bsc', 'arbitrum', 'polygon'],
          description: 'Blockchain network (e.g. base, solana)',
        },
        walletAddress: {
          type: 'string',
          description: 'Wallet address to profile (0x... or Solana base58)',
        },
        paymentProof: {
          type: 'string',
          description: 'Optional Base USDC txHash (0x...) or x402 payment proof for unlimited calls',
        },
      },
      required: ['network', 'walletAddress'],
    },
  },
  {
    name: 'get_credits_and_payment_info',
    description:
      'Returns remaining prepaid USDC balance for a txHash, free daily trial status, and deposit instructions.',
    inputSchema: {
      type: 'object',
      properties: {
        txHash: {
          type: 'string',
          description: 'Optional Base USDC transaction hash to check balance for',
        },
      },
    },
  },
];

// Root Landing / API Overview
app.get('/', (c) => {
  return c.json({
    name: 'Whale402 API & MCP Gateway',
    version: '1.0.0',
    description:
      'Real-time Smart Money Whale Radar, Insider Sybil Cluster Audits, and Wallet Copy-Trade Profiler for AI Agents with Base USDC Micropayments.',
    pricing: {
      freeTrial: '3 free calls per day per client / IP',
      tokenWhalesCost: '$0.02 USDC',
      smartMoneyRadarCost: '$0.02 USDC',
      insiderClusterCost: '$0.03 USDC',
      walletProfilerCost: '$0.01 USDC',
      prepaidDepositAddress: DEFAULT_CONFIG.baseRecipientAddress,
      network: 'Base (ERC20 USDC)',
    },
    endpoints: {
      'GET /v1/token-whales': 'Inspect whale accumulation & smart money net inflow for a token',
      'GET /v1/smart-money-radar': 'Live scan of tokens accumulated by high-win-rate wallets',
      'GET /v1/insider-cluster': 'Detect dev cabal bundling and shared funding sources',
      'GET /v1/wallet-profiler': 'Profile wallet win rate, PnL, and copy-trade grade',
      'GET /v1/credits': 'Check prepaid credit balance and deposit instructions',
      'GET /v1/analytics': 'Live conversion funnel and revenue metrics',
      'GET /v1/health': 'Gateway health check',
    },
    mcp: {
      toolsCount: MCP_TOOLS.length,
      tools: MCP_TOOLS.map((t) => t.name),
    },
  });
});

app.get('/v1/health', (c) => {
  return c.json({ status: 'ok', uptime: process.uptime?.() || 0, timestamp: new Date().toISOString() });
});

app.get('/v1/credits', (c) => {
  const txHash = c.req.query('txHash');
  let balanceUsdc = 0;
  if (txHash) {
    balanceUsdc = getCreditBalance(txHash);
  }

  return c.json({
    txHash: txHash || null,
    creditBalanceUsdc: balanceUsdc,
    depositAddress: DEFAULT_CONFIG.baseRecipientAddress,
    network: 'Base',
    currency: 'USDC',
    freeDailyAllowance: 3,
    depositGuide: `Send $1.00 USDC on Base to ${DEFAULT_CONFIG.baseRecipientAddress} and pass your txHash as 'paymentProof' or 'Authorization: x402 0x<txHash>' for 50 instant calls.`,
  });
});

app.get('/v1/analytics', (c) => {
  return c.json(getAnalyticsSummary());
});

// 1. Token Whale Activity & Smart Money Inflow ($0.02 USDC)
app.get('/v1/token-whales', paywall402({ costUsdc: 0.02, costSats: 20 }), async (c) => {
  const network = (c.req.query('network') || 'base').toLowerCase();
  const address = c.req.query('tokenAddress') || c.req.query('address');

  if (!isValidNetwork(network)) {
    return c.json({ error: `Unsupported network: ${network}. Supported: base, solana, ethereum, bsc, arbitrum, polygon` }, 400);
  }
  if (!address || !isValidAddress(address, network as SupportedNetwork)) {
    return c.json({ error: `Invalid token address format for ${network}: ${address}` }, 400);
  }

  try {
    const data = await analyzeTokenWhales(network as SupportedNetwork, address);
    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Failed to analyze token whales' }, 502);
  }
});

// 2. Smart Money Radar ($0.02 USDC)
app.get('/v1/smart-money-radar', paywall402({ costUsdc: 0.02, costSats: 20 }), async (c) => {
  const networkQuery = c.req.query('network');
  const limitQuery = parseInt(c.req.query('limit') || '10', 10);
  const limit = Math.min(25, Math.max(1, isNaN(limitQuery) ? 10 : limitQuery));

  let network: SupportedNetwork | undefined;
  if (networkQuery) {
    const cleanNet = networkQuery.toLowerCase();
    if (!isValidNetwork(cleanNet)) {
      return c.json({ error: `Unsupported network: ${networkQuery}` }, 400);
    }
    network = cleanNet as SupportedNetwork;
  }

  try {
    const items = await getSmartMoneyRadar(network, limit);
    return c.json({ success: true, count: items.length, data: items });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Failed to scan smart money radar' }, 502);
  }
});

// 3. Insider & Cabal Cluster Detection ($0.03 USDC)
app.get('/v1/insider-cluster', paywall402({ costUsdc: 0.03, costSats: 30 }), async (c) => {
  const network = (c.req.query('network') || 'base').toLowerCase();
  const address = c.req.query('tokenAddress') || c.req.query('address');

  if (!isValidNetwork(network)) {
    return c.json({ error: `Unsupported network: ${network}` }, 400);
  }
  if (!address || !isValidAddress(address, network as SupportedNetwork)) {
    return c.json({ error: `Invalid token address format for ${network}: ${address}` }, 400);
  }

  try {
    const audit = await detectInsiderClusters(network as SupportedNetwork, address);
    return c.json({ success: true, data: audit });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Failed to audit insider clusters' }, 502);
  }
});

// 4. Wallet Profiler & Copy-Trade Grade ($0.01 USDC)
app.get('/v1/wallet-profiler', paywall402({ costUsdc: 0.01, costSats: 10 }), async (c) => {
  const network = (c.req.query('network') || 'base').toLowerCase();
  const address = c.req.query('walletAddress') || c.req.query('address');

  if (!isValidNetwork(network)) {
    return c.json({ error: `Unsupported network: ${network}` }, 400);
  }
  if (!address || !isValidAddress(address, network as SupportedNetwork)) {
    return c.json({ error: `Invalid wallet address format for ${network}: ${address}` }, 400);
  }

  try {
    const profile = await profileWallet(network as SupportedNetwork, address);
    return c.json({ success: true, data: profile });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Failed to profile wallet' }, 502);
  }
});

export default app;
