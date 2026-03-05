// Netlify Function: stripe-webhook
// Handles Stripe checkout.session.completed events
// Verifies signature using Web Crypto API — no npm dependencies required

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PORTAL_BASE_URL = process.env.PORTAL_BASE_URL || 'https://hero-diver-portal.netlify.app';

// Verify Stripe webhook signature using Web Crypto (no npm needed)
async function verifyStripeSignature(payload, sigHeader, secret) {
  try {
    const parts = sigHeader.split(',');
    const tPart = parts.find(p => p.startsWith('t='));
    const v1Part = parts.find(p => p.startsWith('v1='));
    if (!tPart || !v1Part) return false;

    const timestamp = tPart.split('=')[1];
    const signature = v1Part.split('=')[1];
    const signedPayload = `${timestamp}.${payload}`;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
    const expectedSig = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // Constant-time comparison
    if (expectedSig.length !== signature.length) return false;
    let diff = 0;
    for (let i = 0; i < expectedSig.length; i++) {
      diff |= expectedSig.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return diff === 0;
  } catch (e) {
    console.error('Signature verification error:', e);
    return false;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const sigHeader = event.headers['stripe-signature'];
  if (!sigHeader || !STRIPE_WEBHOOK_SECRET) {
    return { statusCode: 400, body: 'Missing signature or webhook secret' };
  }

  const isValid = await verifyStripeSignature(event.body, sigHeader, STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    console.error('Invalid Stripe signature');
    return { statusCode: 400, body: 'Invalid signature' };
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }

  const session = stripeEvent.data.object;
  const jobId = session.metadata?.job_id;
  const paymentIntentId = session.payment_intent;

  if (!jobId) {
    console.error('No job_id in session metadata');
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }

  try {
    // Mark job as open (paid and ready for diver dispatch)
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${jobId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        status: 'open',
        paid_at: new Date().toISOString(),
        stripe_payment_intent: paymentIntentId
      })
    });

    const updatedJobs = await patchRes.json();
    const job = updatedJobs?.[0];

    if (!job) {
      console.error('Job not found after patch:', jobId);
      return { statusCode: 200, body: JSON.stringify({ received: true }) };
    }

    // Notify all approved divers about the new job
    await fetch(`${PORTAL_BASE_URL}/.netlify/functions/notify-divers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'job_open',
        jobId: job.id,
        jobType: job.job_type,
        vesselName: job.vessel_name,
        jobLocation: job.job_location,
        scheduledDate: job.scheduled_date,
        priceFormatted: '$' + Math.round((job.price_cents || 0) / 100)
      })
    }).catch(err => console.error('Failed to notify divers:', err));

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, jobId })
    };
  } catch (err) {
    console.error('Webhook handler error:', err);
    // Return 200 to prevent Stripe from retrying — log the error instead
    return { statusCode: 200, body: JSON.stringify({ received: true, error: err.message }) };
  }
};
