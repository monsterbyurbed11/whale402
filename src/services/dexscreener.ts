import { SupportedNetwork } from '../types.js';

export interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached<T>(key: string, data: T, ttlMs: number): void {
  // Cap cache size to 1000 items
  if (memoryCache.size > 1000) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function mapNetworkToDexChain(network: SupportedNetwork): string {
  switch (network) {
    case 'base':
      return 'base';
    case 'solana':
      return 'solana';
    case 'ethereum':
      return 'ethereum';
    case 'bsc':
      return 'bsc';
    case 'arbitrum':
      return 'arbitrum';
    case 'polygon':
      return 'polygon';
    default:
      return network;
  }
}

/**
 * Fetch token pairs for a given chain and token address with 30s cache and 5s timeout
 */
export async function fetchTokenPairs(
  network: SupportedNetwork,
  tokenAddress: string
): Promise<DexPair[]> {
  const chain = mapNetworkToDexChain(network);
  const cacheKey = `pairs_${chain}_${tokenAddress.toLowerCase()}`;
  const cached = getCached<DexPair[]>(cacheKey);
  if (cached) return cached;

  const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Whale402-SmartMoneyEngine/1.0',
      },
    });

    if (!res.ok) {
      throw new Error(`DexScreener API error: HTTP ${res.status}`);
    }

    const json = (await res.json()) as { pairs: DexPair[] | null };
    const allPairs = json.pairs || [];
    // Filter to the requested chain
    const filtered = allPairs.filter((p) => p.chainId.toLowerCase() === chain.toLowerCase());
    const result = filtered.length > 0 ? filtered : allPairs;

    setCached(cacheKey, result, 30_000); // 30s TTL
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch top trending/boosted pools for discovering Smart Money accumulation
 */
export async function fetchTrendingProfiles(): Promise<any[]> {
  const cacheKey = 'dex_token_profiles';
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch('https://api.dexscreener.com/token-profiles/latest/v1', {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Whale402-SmartMoneyEngine/1.0',
      },
    });

    if (!res.ok) {
      return [];
    }

    const data = (await res.json()) as any[];
    setCached(cacheKey, data, 60_000); // 1 minute TTL
    return data;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
