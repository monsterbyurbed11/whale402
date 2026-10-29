export interface AnalyticsSummary {
  totalRequests: number;
  freeTrialRequests: number;
  paidCalls: number;
  paymentRequired402s: number;
  totalRevenueUsdc: number;
  endpointBreakdown: Record<string, number>;
  paymentMethodBreakdown: {
    freeTrial: number;
    baseUsdcTx: number;
    x402Header: number;
    l402Lightning: number;
  };
  uptimeSeconds: number;
}

const startTime = Date.now();
const state: {
  totalRequests: number;
  freeTrialRequests: number;
  paidCalls: number;
  paymentRequired402s: number;
  totalRevenueUsdc: number;
  endpointBreakdown: Map<string, number>;
  paymentMethodBreakdown: {
    freeTrial: number;
    baseUsdcTx: number;
    x402Header: number;
    l402Lightning: number;
  };
} = {
  totalRequests: 0,
  freeTrialRequests: 0,
  paidCalls: 0,
  paymentRequired402s: 0,
  totalRevenueUsdc: 0,
  endpointBreakdown: new Map(),
  paymentMethodBreakdown: {
    freeTrial: 0,
    baseUsdcTx: 0,
    x402Header: 0,
    l402Lightning: 0,
  },
};

export function recordAnalyticsEvent(event: {
  endpoint: string;
  type: 'free' | 'paid_tx' | 'paid_x402' | 'paid_l402' | '402_challenge';
  costUsdc?: number;
}): void {
  state.totalRequests++;

  const currentCount = state.endpointBreakdown.get(event.endpoint) || 0;
  state.endpointBreakdown.set(event.endpoint, currentCount + 1);

  if (event.type === 'free') {
    state.freeTrialRequests++;
    state.paymentMethodBreakdown.freeTrial++;
  } else if (event.type === '402_challenge') {
    state.paymentRequired402s++;
  } else {
    state.paidCalls++;
    state.totalRevenueUsdc += event.costUsdc || 0.02;
    if (event.type === 'paid_tx') state.paymentMethodBreakdown.baseUsdcTx++;
    else if (event.type === 'paid_x402') state.paymentMethodBreakdown.x402Header++;
    else if (event.type === 'paid_l402') state.paymentMethodBreakdown.l402Lightning++;
  }
}

export function getAnalyticsSummary(): AnalyticsSummary {
  const endpoints: Record<string, number> = {};
  for (const [k, v] of state.endpointBreakdown.entries()) {
    endpoints[k] = v;
  }

  return {
    totalRequests: state.totalRequests,
    freeTrialRequests: state.freeTrialRequests,
    paidCalls: state.paidCalls,
    paymentRequired402s: state.paymentRequired402s,
    totalRevenueUsdc: Math.round(state.totalRevenueUsdc * 1000) / 1000,
    endpointBreakdown: endpoints,
    paymentMethodBreakdown: { ...state.paymentMethodBreakdown },
    uptimeSeconds: Math.round((Date.now() - startTime) / 1000),
  };
}
