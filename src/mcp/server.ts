#!/usr/bin/env node
import app, { MCP_TOOLS } from '../index.js';
import { SUPPORTED_NETWORKS, isValidAddress, isValidNetwork, SupportedNetwork } from '../types.js';
import * as readline from 'readline';

/**
 * Model Context Protocol (MCP) Server for Whale402
 * Provides Claude Desktop, Cursor, Glama, Smithery, Windsurf, and ElizaOS with:
 * - Real-time Smart Money accumulation signals
 * - Insider Sybil cluster & dev cabal audits
 * - Wallet copy-trade profiling
 * - Zero-config free tier (3 free calls/day) + Base USDC prepaid credits
 */

const REMOTE_GATEWAY_URL = (
  process.env.WHALE402_API_URL ||
  process.env.API_BASE ||
  'https://whale402.acter.workers.dev'
).replace(/\/$/, '');

const SESSION_CLIENT_ID = `mcp_whale_${process.pid}_${Date.now().toString(36)}`;

let cachedSessionPaymentProof: string =
  process.env.WHALE402_PAYMENT_PROOF ||
  (process.env.WHALE402_TX_HASH ? `x402 ${process.env.WHALE402_TX_HASH.trim()}` : '') ||
  process.env.WHALE402_X_PAYMENT ||
  '';

function buildPaymentHeaders(rawProof?: string): Record<string, string> {
  const proof = (rawProof || cachedSessionPaymentProof || '').trim();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-MCP-Client-ID': SESSION_CLIENT_ID,
  };

  if (!proof) return headers;

  if (proof.startsWith('x402 ') || proof.startsWith('Bearer ')) {
    headers['Authorization'] = proof;
  } else if (/^0x[a-fA-F0-9]{64}$/.test(proof)) {
    headers['Authorization'] = `x402 ${proof}`;
  } else {
    headers['X-PAYMENT'] = proof;
  }

  return headers;
}

async function callGateway(
  path: string,
  paymentProof?: string
): Promise<{ status: number; data: any }> {
  const headers = buildPaymentHeaders(paymentProof);

  // If remote URL is explicitly enabled, try remote first
  if (process.env.WHALE402_USE_REMOTE === 'true') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${REMOTE_GATEWAY_URL}${path}`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      const data = await res.json();
      if (res.ok && paymentProof) {
        cachedSessionPaymentProof = paymentProof.trim();
      }
      return { status: res.status, data };
    } catch {
      // Fall through to in-process app
    } finally {
      clearTimeout(timeout);
    }
  }

  // Fast in-process Hono invocation
  const localRes = await app.request(path, {
    method: 'GET',
    headers,
  });
  const localData = await localRes.json();
  if (localRes.ok && paymentProof) {
    cachedSessionPaymentProof = paymentProof.trim();
  }
  return { status: localRes.status, data: localData };
}

function sendResponse(response: any): void {
  process.stdout.write(JSON.stringify(response) + '\n');
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', async (line) => {
  if (!line.trim()) return;

  let request: any;
  try {
    request = JSON.parse(line);
  } catch (err: any) {
    sendResponse({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: `Parse error: ${err?.message || 'Invalid JSON'}` },
    });
    return;
  }

  const { id, method, params } = request || {};

  try {
    if (method === 'initialize') {
      sendResponse({
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'whale402-smart-money-mcp',
            version: '1.0.0',
          },
        },
      });
      return;
    }

    if (method === 'notifications/initialized') {
      return;
    }

    if (method === 'ping') {
      sendResponse({
        jsonrpc: '2.0',
        id: id ?? null,
        result: {},
      });
      return;
    }

    if (method === 'tools/list') {
      sendResponse({
        jsonrpc: '2.0',
        id: id ?? null,
        result: { tools: MCP_TOOLS },
      });
      return;
    }

    if (method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};
      const paymentProof = typeof args.paymentProof === 'string' ? args.paymentProof : undefined;

      if (toolName === 'get_credits_and_payment_info') {
        const txHash = typeof args.txHash === 'string' ? args.txHash.trim() : '';
        const endpoint = txHash ? `/v1/credits?txHash=${encodeURIComponent(txHash)}` : '/v1/credits';
        const { data } = await callGateway(endpoint, undefined);

        sendResponse({
          jsonrpc: '2.0',
          id: id ?? null,
          result: {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
          },
        });
        return;
      }

      if (toolName === 'get_token_whale_activity') {
        const network = String(args.network || 'base').toLowerCase();
        const tokenAddress = typeof args.tokenAddress === 'string' ? args.tokenAddress.trim() : '';

        if (!isValidNetwork(network)) {
          sendResponse({
            jsonrpc: '2.0',
            id: id ?? null,
            result: {
              content: [{ type: 'text', text: JSON.stringify({ error: `Unsupported network ${network}. Supported: ${SUPPORTED_NETWORKS.join(', ')}` }) }],
              isError: true,
            },
          });
          return;
        }

        if (!isValidAddress(tokenAddress, network as SupportedNetwork)) {
          sendResponse({
            jsonrpc: '2.0',
            id: id ?? null,
            result: {
              content: [{ type: 'text', text: JSON.stringify({ error: `Invalid token address ${tokenAddress} for ${network}` }) }],
              isError: true,
            },
          });
          return;
        }

        const endpoint = `/v1/token-whales?network=${encodeURIComponent(network)}&tokenAddress=${encodeURIComponent(tokenAddress)}`;
        const { status, data } = await callGateway(endpoint, paymentProof);

        sendResponse({
          jsonrpc: '2.0',
          id: id ?? null,
          result: {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
            isError: status >= 400,
          },
        });
        return;
      }

      if (toolName === 'get_smart_money_radar') {
        const network = args.network ? String(args.network).toLowerCase() : '';
        const limit = args.limit ? Number(args.limit) : 10;
        let endpoint = `/v1/smart-money-radar?limit=${limit}`;
        if (network) endpoint += `&network=${encodeURIComponent(network)}`;

        const { status, data } = await callGateway(endpoint, paymentProof);
        sendResponse({
          jsonrpc: '2.0',
          id: id ?? null,
          result: {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
            isError: status >= 400,
          },
        });
        return;
      }

      if (toolName === 'detect_insider_clusters') {
        const network = String(args.network || 'base').toLowerCase();
        const tokenAddress = typeof args.tokenAddress === 'string' ? args.tokenAddress.trim() : '';

        if (!isValidNetwork(network) || !isValidAddress(tokenAddress, network as SupportedNetwork)) {
          sendResponse({
            jsonrpc: '2.0',
            id: id ?? null,
            result: {
              content: [{ type: 'text', text: JSON.stringify({ error: 'Invalid network or token address.' }) }],
              isError: true,
            },
          });
          return;
        }

        const endpoint = `/v1/insider-cluster?network=${encodeURIComponent(network)}&tokenAddress=${encodeURIComponent(tokenAddress)}`;
        const { status, data } = await callGateway(endpoint, paymentProof);

        sendResponse({
          jsonrpc: '2.0',
          id: id ?? null,
          result: {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
            isError: status >= 400,
          },
        });
        return;
      }

      if (toolName === 'profile_wallet_smart_money') {
        const network = String(args.network || 'base').toLowerCase();
        const walletAddress = typeof args.walletAddress === 'string' ? args.walletAddress.trim() : '';

        if (!isValidNetwork(network) || !isValidAddress(walletAddress, network as SupportedNetwork)) {
          sendResponse({
            jsonrpc: '2.0',
            id: id ?? null,
            result: {
              content: [{ type: 'text', text: JSON.stringify({ error: 'Invalid network or wallet address.' }) }],
              isError: true,
            },
          });
          return;
        }

        const endpoint = `/v1/wallet-profiler?network=${encodeURIComponent(network)}&walletAddress=${encodeURIComponent(walletAddress)}`;
        const { status, data } = await callGateway(endpoint, paymentProof);

        sendResponse({
          jsonrpc: '2.0',
          id: id ?? null,
          result: {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
            isError: status >= 400,
          },
        });
        return;
      }

      sendResponse({
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32601, message: `Tool not found: ${toolName}` },
      });
      return;
    }

    sendResponse({
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32601, message: `Method not implemented: ${method}` },
    });
  } catch (e: any) {
    sendResponse({
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32603, message: `Internal server error: ${e?.message || e}` },
    });
  }
});
