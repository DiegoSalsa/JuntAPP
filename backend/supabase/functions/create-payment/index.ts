// Legacy payment creation retired.
// The current flow creates an authenticated, server-calculated household due at
// /api/dues/checkout or /api/dues/batch-checkout.

const headers = { 'Content-Type': 'application/json' };

Deno.serve((request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  return new Response(JSON.stringify({
    error: 'Este endpoint legado fue retirado. Usa /api/dues/checkout.',
  }), { status: 410, headers });
});
