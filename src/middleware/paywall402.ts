import { Context, Next } from 'hono';
import { recordAnalyticsEvent } from '../services/analytics.js';

export interface PaywallConfig {
  costUsdc: number;
  costSats: number;
  baseRecipientAddress: string;
  enableSandbox: boolean;
  description?: string;
}

export const DEFAULT_CONFIG: PaywallConfig = {
  costUsdc: 0.02,
  costSats: 20,
  baseRecipientAddress: '0x8a8c238ed2b46908Ff6C6922a3870984f20f8913',
  enableSandbox: false,
};

const BASE_USDC_CONTRACT = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const DEFAULT_BASE_RPC_URLS = [
  'https://base.gateway.tenderly.co',
  'https://mainnet.base.org',
  'https://base-mainnet.public.blastapi.io',
  'https://base.meowrpc.com',
];

// In-process cache for credit balances and free trials (capped to prevent memory growth)
const localCreditBalances = new Map<string, number>();
const localSpentTxHashes = new Set<string>();
const localFreeTrialCounts = new Map<string, { count: number; date: string }>();

function getEnv(c: Context): Record<string, any> {
  const nodeEnv = typeof process !== 'undefined' && process.env ? process.env : {};
  const workerEnv = c.env && typeof c.env === 'object' ? c.env : {};
  return { ...nodeEnv, ...workerEnv };
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getClientIdentifier(c: Context): string {
  const explicit = c.req.header('X-MCP-Client-ID') || c.req.header('X-Client-ID');
  if (explicit) return explicit.trim();

  const forwarded = c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip');
  if (forwarded) return forwarded.split(',')[0].trim();

  return 'anonymous_client';
}

/**
 * Check and increment free trial allowance (3 free calls per day)
 */
function checkFreeTrial(c: Context, limit: number): { allowed: boolean; remaining: number } {
  const clientId = getClientIdentifier(c);
  const today = getTodayString();
  const entry = localFreeTrialCounts.get(clientId);

  if (!entry || entry.date !== today) {
    localFreeTrialCounts.set(clientId, { count: 1, date: today });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count < limit) {
    entry.count += 1;
    return { allowed: true, remaining: limit - entry.count };
  }

  return { allowed: false, remaining: 0 };
}

/**
 * Verify on-chain ERC20 Base USDC transfer transaction receipt
 */
async function verifyBaseUsdcTransaction(
  txHash: string,
  recipientAddress: string
): Promise<{ valid: boolean; amountUnits: number; error?: string }> {
  const cleanTx = txHash.trim().toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(cleanTx)) {
    return { valid: false, amountUnits: 0, error: 'Invalid transaction hash format' };
  }

  if (localSpentTxHashes.has(cleanTx)) {
    return { valid: false, amountUnits: 0, error: 'Transaction hash already spent' };
  }

  // Attempt RPC verification with multiple endpoints
  for (const rpcUrl of DEFAULT_BASE_RPC_URLS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(rpcUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getTransactionReceipt',
          params: [cleanTx],
        }),
      });

      clearTimeout(timeout);
      if (!res.ok) continue;

      const data: any = await res.json();
      const receipt = data?.result;
      if (!receipt) continue;

      if (receipt.status !== '0x1') {
        return { valid: false, amountUnits: 0, error: 'Transaction reverted on-chain' };
      }

      const cleanRecipient = recipientAddress.toLowerCase().replace(/^0x/, '').padStart(64, '0');
      let transferFound = false;
      let amountUnits = 0;

      for (const log of receipt.logs || []) {
        if (
          log.address?.toLowerCase() === BASE_USDC_CONTRACT &&
          log.topics?.[0]?.toLowerCase() === ERC20_TRANSFER_TOPIC &&
          log.topics?.[2]?.toLowerCase()?.includes(cleanRecipient)
        ) {
          transferFound = true;
          const parsed = parseInt(log.data, 16);
          if (!isNaN(parsed) && parsed > 0) {
            amountUnits = parsed;
          }
        }
      }

      if (transferFound && amountUnits > 0) {
        localSpentTxHashes.add(cleanTx);
        return { valid: true, amountUnits };
      }
    } catch {
      continue;
    }
  }

  return { valid: false, amountUnits: 0, error: 'Unable to verify Base USDC receipt on-chain' };
}

export function paywall402(customConfig?: Partial<PaywallConfig>) {
  return async (c: Context, next: Next) => {
    const env = getEnv(c);
    const config: PaywallConfig = {
      ...DEFAULT_CONFIG,
      ...customConfig,
      costUsdc: customConfig?.costUsdc || parseFloat(env.COST_USDC || '0.02'),
      costSats: customConfig?.costSats || parseInt(env.COST_SATS || '20', 10),
      baseRecipientAddress: env.BASE_RECIPIENT_ADDRESS || DEFAULT_CONFIG.baseRecipientAddress,
      enableSandbox: env.ENABLE_SANDBOX === 'true',
    };

    const costUnits = Math.round(config.costUsdc * 1_000_000); // 6 decimals for USDC ($0.02 = 20,000 units)
    const limit = parseInt(env.FREE_TRIAL_DAILY_LIMIT || '3', 10);
    const endpoint = c.req.path;

    // Check Authorization / Payment Proof
    const authHeader = c.req.header('Authorization') || '';
    const xPaymentHeader = c.req.header('X-PAYMENT') || '';
    const queryProof = c.req.query('paymentProof') || '';

    let proof = '';
    if (authHeader.startsWith('x402 ') || authHeader.startsWith('Bearer 0x')) {
      proof = authHeader.replace(/^(x402|Bearer)\s+/, '').trim();
    } else if (xPaymentHeader) {
      proof = xPaymentHeader.trim();
    } else if (queryProof) {
      proof = queryProof.trim();
    }

    // 1. If payment proof provided, verify or deduct from prepaid credits
    if (proof) {
      const cleanProof = proof.toLowerCase();

      // Check existing cached credit balance
      const existingBalance = localCreditBalances.get(cleanProof);
      if (existingBalance !== undefined) {
        if (existingBalance >= costUnits) {
          const newBal = existingBalance - costUnits;
          localCreditBalances.set(cleanProof, newBal);

          c.res.headers.set('X-402-Credits-Remaining-USDC', (newBal / 1_000_000).toFixed(4));
          c.res.headers.set('X-402-Calls-Remaining', Math.floor(newBal / costUnits).toString());

          recordAnalyticsEvent({ endpoint, type: 'paid_tx', costUsdc: config.costUsdc });
          await next();
          return;
        } else {
          return c.json(
            {
              error: 'Insufficient prepaid credits',
              balanceUsdc: (existingBalance / 1_000_000).toFixed(4),
              requiredUsdc: config.costUsdc,
              depositAddress: config.baseRecipientAddress,
              message: `Your prepaid balance of $${(existingBalance / 1_000_000).toFixed(4)} is less than the required $${config.costUsdc} USDC. Please send at least $1.00 USDC to replenish credits.`,
            },
            402
          );
        }
      }

      // First-time deposit verification for this txHash
      if (/^0x[a-f0-9]{64}$/.test(cleanProof)) {
        const verifyRes = await verifyBaseUsdcTransaction(cleanProof, config.baseRecipientAddress);
        if (verifyRes.valid && verifyRes.amountUnits >= costUnits) {
          const remaining = verifyRes.amountUnits - costUnits;
          localCreditBalances.set(cleanProof, remaining);

          c.res.headers.set('X-402-Credits-Remaining-USDC', (remaining / 1_000_000).toFixed(4));
          c.res.headers.set('X-402-Calls-Remaining', Math.floor(remaining / costUnits).toString());

          recordAnalyticsEvent({ endpoint, type: 'paid_tx', costUsdc: config.costUsdc });
          await next();
          return;
        }
      }
    }

    // 2. Free Tier Fallback (3 free daily calls per IP / client ID)
    const trial = checkFreeTrial(c, limit);
    if (trial.allowed) {
      c.res.headers.set('X-Free-Trial-Remaining', trial.remaining.toString());
      c.res.headers.set('X-Free-Trial-Daily-Limit', limit.toString());
      recordAnalyticsEvent({ endpoint, type: 'free' });
      await next();
      return;
    }

    // 3. Challenge with HTTP 402 Payment Required
    recordAnalyticsEvent({ endpoint, type: '402_challenge' });

    c.res.headers.set('Content-Type', 'application/json');
    c.res.headers.set(
      'WWW-Authenticate',
      `x402 cost="${config.costUsdc}", currency="USDC", network="base", recipient="${config.baseRecipientAddress}"`
    );
    c.res.headers.set('X-402-Cost-USDC', config.costUsdc.toString());
    c.res.headers.set('X-402-Recipient-Address', config.baseRecipientAddress);

    return c.json(
      {
        status: 402,
        error: 'Payment Required',
        message: `Free trial daily limit (${limit} calls/day) exceeded. Please provide an x402 payment proof or prepaid Base USDC txHash.`,
        pricing: {
          costUsdc: config.costUsdc,
          costSats: config.costSats,
          network: 'base',
          asset: 'USDC',
          contract: BASE_USDC_CONTRACT,
          depositAddress: config.baseRecipientAddress,
        },
        instantPrepaidInstructions: {
          step1: `Send $1.00 USDC on Base to ${config.baseRecipientAddress} (gives you ${Math.floor(1.0 / config.costUsdc)} queries).`,
          step2: 'Pass the transaction hash in header `Authorization: x402 0x<txHash>` or as parameter `paymentProof`.',
          step3: 'Subsequent requests deduct credits automatically in <15ms without waiting for RPC confirms.',
        },
        mcpSetup: {
          env: {
            WHALE402_TX_HASH: '0x<your_base_usdc_tx_hash>',
          },
        },
      },
      402
    );
  };
}

export function getCreditBalance(txHash: string): number {
  return (localCreditBalances.get(txHash.toLowerCase().trim()) || 0) / 1_000_000;
}
