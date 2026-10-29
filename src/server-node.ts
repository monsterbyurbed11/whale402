import { serve } from '@hono/node-server';
import app from './index.js';

const PORT = parseInt(process.env.PORT || '8788', 10);

console.log(`🐋 Whale402 API & MCP Gateway starting on port ${PORT}...`);
serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`✅ Whale402 live at: http://localhost:${info.port}`);
    console.log(`📊 Analytics: http://localhost:${info.port}/v1/analytics`);
    console.log(`💳 Credits & Deposit: http://localhost:${info.port}/v1/credits`);
  }
);
