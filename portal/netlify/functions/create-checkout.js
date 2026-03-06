// Netlify Function: create-checkout
// Creates a Stripe Checkout Session for a job payment
// Uses only built-in fetch — no npm dependencies required

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PORTAL_BASE_URL = process.env.PORTAL_BASE_URL || 'https://hero-diver-portal.netlify.app';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!STRIPE_SECRET_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Stripe not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { jobId, priceInCents, vesselName, jobType, userId } = body;

  if (!jobId || !priceInCents || !userId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  // Verify the job exists, belongs to this user, and is pending_payment
  const jobRes = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${jobId}&vessel_owner_id=eq.${userId}&status=eq.pending_payment`, {
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  const jobs = await jobRes.json();
  if (!jobs || jobs.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Job not found or already paid' }) };
  }

  // Build Stripe Checkout session via form-encoded POST
  const lineItemName = `${jobType || 'Inspection'} — ${vesselName || 'Vessel'}`;
  const params = new URLSearchParams({
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': priceInCents.toString(),
    'line_items[0][price_data][product_data][name]': lineItemName,
    'line_items[0][price_data][product_data][description]': 'HERO Diving & Marine Services — certified underwater inspection',
    'line_items[0][quantity]': '1',
    'mode': 'payment',
    'success_url': `${PORTAL_BASE_URL}/vessel-dashboard.html?payment=success`,
    'cancel_url': `${PORTAL_BASE_URL}/vessel-dashboard.html?payment=cancelled`,
    'metadata[job_id]': jobId,
    'metadata[vessel_name]': vesselName || '',
    'metadata[job_type]': jobType || ''
  });

  try {
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!stripeRes.ok) {
      const stripeError = await stripeRes.json();
      throw new Error(stripeError.error?.message || 'Stripe API error');
    }

    const session = await stripeRes.json();

    // Save the Stripe session ID on the job row
    await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${jobId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ stripe_session_id: session.id })
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    console.error('Create checkout error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
