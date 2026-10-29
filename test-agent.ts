import app from './src/index.js';

async function runTests() {
  console.log('🧪 Starting Whale402 End-to-End Test Suite...\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name} ->`, err.message || err);
      failed++;
    }
  }

  // 1. Root landing endpoint
  await test('GET / returns API overview & tools', async () => {
    const res = await app.request('/');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (!json.name?.includes('Whale402')) throw new Error('Invalid name');
    if (!json.mcp?.tools || json.mcp.tools.length < 4) throw new Error('Missing MCP tools');
  });

  // 2. Health check
  await test('GET /v1/health returns ok', async () => {
    const res = await app.request('/v1/health');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (json.status !== 'ok') throw new Error('Health status not ok');
  });

  // 3. Credits & deposit info
  await test('GET /v1/credits returns deposit address & guides', async () => {
    const res = await app.request('/v1/credits');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (!json.depositAddress?.startsWith('0x')) throw new Error('Missing deposit address');
  });

  // 4. Token Whale Activity (HIGHER on Base)
  await test('GET /v1/token-whales analyzes token accumulation & smart inflow', async () => {
    // HIGHER token on Base
    const res = await app.request('/v1/token-whales?network=base&tokenAddress=0x0578d8a44db98b23bf096a382e016e29a5ce0ffe', {
      headers: { 'X-MCP-Client-ID': 'test_agent_1' },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data) throw new Error('No success data');
    if (typeof json.data.whaleAccumulationScore !== 'number') throw new Error('Missing whaleAccumulationScore');
    if (!json.data.topHolders || json.data.topHolders.length === 0) throw new Error('Missing topHolders');
    console.log(`   -> HIGHER WhaleScore: ${json.data.whaleAccumulationScore}/100, Signal: ${json.data.signal}, Net Inflow: $${json.data.smartMoneyNetInflow24hUsd}`);
  });

  // 5. Smart Money Radar
  await test('GET /v1/smart-money-radar scans emerging tokens', async () => {
    const res = await app.request('/v1/smart-money-radar?network=base&limit=3', {
      headers: { 'X-MCP-Client-ID': 'test_agent_2' },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) throw new Error('Invalid radar data');
    console.log(`   -> Radar returned ${json.data.length} tokens; Top: ${json.data[0]?.symbol} (Score: ${json.data[0]?.whaleAccumulationScore})`);
  });

  // 6. Insider Cabal & Sybil Cluster Detection
  await test('GET /v1/insider-cluster audits cabal bundling and shared gas funders', async () => {
    const res = await app.request('/v1/insider-cluster?network=base&tokenAddress=0x0578d8a44db98b23bf096a382e016e29a5ce0ffe', {
      headers: { 'X-MCP-Client-ID': 'test_agent_3' },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data) throw new Error('Invalid audit data');
    if (!json.data.clusterRisk) throw new Error('Missing clusterRisk');
    console.log(`   -> Cabal Audit: Risk=${json.data.clusterRisk}, BundledSupply=${json.data.bundledSupplyPct}%, CabalScore=${json.data.cabalScore}`);
  });

  // 7. Wallet Profiler & Copy-Trading Grade
  await test('GET /v1/wallet-profiler calculates win rate %, PnL, and CopyTradeGrade', async () => {
    const res = await app.request('/v1/wallet-profiler?network=base&walletAddress=0x8a8c238ed2b46908Ff6C6922a3870984f20f8913', {
      headers: { 'X-MCP-Client-ID': 'test_agent_4' },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data) throw new Error('Invalid wallet data');
    if (!json.data.copyTradeGrade) throw new Error('Missing copyTradeGrade');
    console.log(`   -> Wallet Profile: WinRate=${json.data.winRatePct}%, Grade=${json.data.copyTradeGrade}, Tier=${json.data.traderTier}, PnL=$${json.data.realizedPnlUsd}`);
  });

  // 8. 402 Paywall Challenge after 3 Free Calls
  await test('paywall402 returns HTTP 402 challenge with payment instructions after trial', async () => {
    const clientId = 'trial_exhaust_test_agent';
    // Consume 3 calls
    for (let i = 0; i < 3; i++) {
      await app.request('/v1/wallet-profiler?network=base&walletAddress=0x8a8c238ed2b46908Ff6C6922a3870984f20f8913', {
        headers: { 'X-MCP-Client-ID': clientId },
      });
    }

    // Call 4 must be 402 Payment Required
    const res = await app.request('/v1/wallet-profiler?network=base&walletAddress=0x8a8c238ed2b46908Ff6C6922a3870984f20f8913', {
      headers: { 'X-MCP-Client-ID': clientId },
    });
    if (res.status !== 402) throw new Error(`Expected 402, got ${res.status}`);
    const authHeader = res.headers.get('WWW-Authenticate');
    if (!authHeader?.includes('x402')) throw new Error('Missing WWW-Authenticate x402 header');
    const json = await res.json();
    if (json.status !== 402) throw new Error('Invalid 402 payload');
    console.log(`   -> HTTP 402 returned correctly: "${json.message}"`);
  });

  // 9. Analytics Funnel
  await test('GET /v1/analytics captures conversion funnel & request metrics', async () => {
    const res = await app.request('/v1/analytics');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (json.totalRequests < 5) throw new Error(`Expected at least 5 recorded requests, got ${json.totalRequests}`);
    if (json.paymentRequired402s < 1) throw new Error('Expected at least 1 402 challenge recorded');
    console.log(`   -> Funnel stats: ${json.totalRequests} total requests, ${json.freeTrialRequests} free trial, ${json.paymentRequired402s} 402 challenges`);
  });

  console.log(`\n========================================`);
  console.log(`Test Suite Complete: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
