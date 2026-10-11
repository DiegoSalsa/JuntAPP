// Legacy Webpay callback retired.
// Payment confirmations must go through the signed Next.js Mercado Pago route,
// which verifies the provider payment before touching tenant data.

const headers = { 'Content-Type': 'application/json' };

Deno.serve((request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  return new Response(JSON.stringify({
    error: 'Este callback legado fue retirado. Usa /api/webhooks/mercadopago.',
  }), { status: 410, headers });
});
