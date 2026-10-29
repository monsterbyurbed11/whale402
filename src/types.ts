export type SupportedNetwork =
  | 'base'
  | 'solana'
  | 'ethereum'
  | 'bsc'
  | 'arbitrum'
  | 'polygon';

export const SUPPORTED_NETWORKS: readonly SupportedNetwork[] = [
  'base',
  'solana',
  'ethereum',
  'bsc',
  'arbitrum',
  'polygon',
] as const;

export type TraderTier =
  | 'APEX_WHALE'
  | 'SMART_SNIPER'
  | 'PROFESSIONAL_SWING'
  | 'RETAIL_DEGEN'
  | 'SYBIL_BOT'
  | 'DEV_CABAL';

export type ClusterRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';

export type AccumulationSignal =
  | 'STRONG_ACCUMULATION'
  | 'MODERATE_ACCUMULATION'
  | 'NEUTRAL'
  | 'SMART_MONEY_DISTRIBUTING'
  | 'DUMP_ALERT';

export interface WhaleHolder {
  address: string;
  balanceUsd: number;
  supplyPct: number;
  historicalWinRatePct: number;
  realizedPnlUsd: number;
  tier: TraderTier;
  isInsider: boolean;
  sharedFundingClusterId?: string;
}

export interface TokenWhaleActivity {
  tokenAddress: string;
  network: SupportedNetwork;
  symbol: string;
  name: string;
  priceUsd: number;
  marketCap: number;
  liquidityUsd: number;
  whaleAccumulationScore: number; // 0 - 100
  smartMoneyNetInflow24hUsd: number;
  whaleDominancePct: number;
  totalWhalesTracking: number;
  smartMoneyBuys24h: number;
  smartMoneySells24h: number;
  signal: AccumulationSignal;
  topHolders: WhaleHolder[];
  timestamp: string;
}

export interface SmartMoneyRadarItem {
  tokenAddress: string;
  network: SupportedNetwork;
  symbol: string;
  name: string;
  priceUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  whaleAccumulationScore: number;
  smartMoneyWalletsInvolved: number;
  netSmartMoneyFlowUsd: number;
  signal: AccumulationSignal;
}

export interface SharedFunderGroup {
  funderAddress: string;
  fundedWalletsCount: number;
  totalFundingAmountEthOrSol: number;
  timeWindowMinutes: number;
  wallets: string[];
}

export interface InsiderClusterAudit {
  tokenAddress: string;
  network: SupportedNetwork;
  clusterRisk: ClusterRiskLevel;
  bundledSupplyPct: number;
  totalInsidersDetected: number;
  cabalScore: number; // 0 - 100, 100 = completely bundled dev cabal
  sharedFundingSources: SharedFunderGroup[];
  verdict: string;
  isFailClosedSafe: boolean;
  timestamp: string;
}

export interface WalletProfile {
  walletAddress: string;
  network: SupportedNetwork;
  traderTier: TraderTier;
  winRatePct: number;
  totalTrades: number;
  profitableTrades: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  roi30dPct: number;
  avgHoldDurationHours: number;
  copyTradeGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  copyTradeScore: number; // 0 - 100
  flags: string[];
  topProfitableTokens: {
    symbol: string;
    tokenAddress: string;
    pnlUsd: number;
    roiMultiple: number;
  }[];
  timestamp: string;
}

export function isValidNetwork(net: string): net is SupportedNetwork {
  return SUPPORTED_NETWORKS.includes(net.toLowerCase().trim() as SupportedNetwork);
}

export function isValidAddress(address: string, network?: SupportedNetwork): boolean {
  if (!address || typeof address !== 'string') return false;
  const clean = address.trim();
  
  if (network === 'solana') {
    // Solana base58: 32-44 alphanumeric chars, excluding 0, O, I, l
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clean);
  }
  
  // EVM address (Base, Ethereum, Arbitrum, BSC, Polygon)
  if (/^0x[a-fA-F0-9]{40}$/.test(clean)) return true;
  
  // If no network specified, accept either EVM or Solana
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clean);
}
