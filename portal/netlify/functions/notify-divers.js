// Netlify Function: notify-divers
// Sends email notifications for job events
// Uses only built-in fetch — no npm dependencies required

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PORTAL_BASE_URL = process.env.PORTAL_BASE_URL || 'https://hero-diver-portal.netlify.app';

async function sendEmail(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Hero Diving & Marine <jobs@herodivingandmarine.com>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html
    })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Resend API error');
  }
  return res.json();
}

function jobOpenEmailHtml({ jobType, vesselName, jobLocation, scheduledDate, priceFormatted, jobBoardUrl }) {
  const dateStr = scheduledDate
    ? new Date(scheduledDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : 'TBD';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#020810;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#020810;">
    <div style="background:linear-gradient(180deg,#0c2340 0%,#020810 100%);padding:32px;text-align:center;border-bottom:1px solid rgba(0,212,255,0.15);">
      <div style="font-family:Georgia,serif;font-size:24px;font-weight:700;letter-spacing:6px;text-transform:uppercase;color:#f0f4f8;">HERO</div>
      <div style="font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#8a9bb5;">Diving &amp; Marine Services</div>
    </div>
    <div style="padding:32px;">
      <div style="background:#e8272c;display:inline-block;padding:6px 20px;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#fff;font-weight:bold;margin-bottom:24px;">New Job Available</div>
      <h2 style="font-family:Georgia,serif;font-size:22px;color:#f0f4f8;margin:0 0 24px;letter-spacing:1px;">${jobType || 'Inspection'} — ${vesselName || 'Vessel'}</h2>
      <table style="width:100%;border-collapse:collapse;background:#071422;margin-bottom:24px;">
        <tr>
          <td style="padding:12px 16px;color:#8a9bb5;font-size:11px;letter-spacing:2px;text-transform:uppercase;width:40%;">Location</td>
          <td style="padding:12px 16px;color:#f0f4f8;font-size:14px;">${jobLocation || '—'}</td>
        </tr>
        <tr style="background:#0a1a30;">
          <td style="padding:12px 16px;color:#8a9bb5;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Preferred Date</td>
          <td style="padding:12px 16px;color:#f0f4f8;font-size:14px;">${dateStr}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;color:#8a9bb5;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Your Rate</td>
          <td style="padding:12px 16px;color:#00d4ff;font-size:20px;font-weight:bold;">${priceFormatted}</td>
        </tr>
      </table>
      <div style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);padding:16px;margin-bottom:24px;font-size:13px;color:#8a9bb5;line-height:1.6;">
        First to accept gets the job. Log in to the Hero Diver Portal to view details and accept.
      </div>
      <a href="${jobBoardUrl}" style="display:inline-block;background:#e8272c;color:#fff;padding:14px 40px;font-family:Georgia,serif;font-size:13px;letter-spacing:3px;text-transform:uppercase;text-decoration:none;font-weight:bold;">View Job Board →</a>
    </div>
    <div style="padding:24px 32px;text-align:center;border-top:1px solid rgba(0,212,255,0.1);">
      <div style="font-size:11px;color:#8a9bb5;">Hero Diving &amp; Marine Services · <a href="https://herodivingandmarine.com" style="color:#00d4ff;text-decoration:none;">herodivingandmarine.com</a></div>
    </div>
  </div>
</body>
</html>`;
}

function jobAcceptedEmailHtml({ diverName, vesselName, jobType }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#020810;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#020810;">
    <div style="background:linear-gradient(180deg,#0c2340 0%,#020810 100%);padding:32px;text-align:center;border-bottom:1px solid rgba(0,212,255,0.15);">
      <div style="font-family:Georgia,serif;font-size:24px;font-weight:700;letter-spacing:6px;text-transform:uppercase;color:#f0f4f8;">HERO</div>
      <div style="font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#8a9bb5;">Diving &amp; Marine Services</div>
    </div>
    <div style="padding:32px;">
      <div style="background:rgba(26,107,74,0.2);border:1px solid rgba(74,222,128,0.3);padding:6px 20px;display:inline-block;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#4ade80;font-weight:bold;margin-bottom:24px;">Job Accepted</div>
      <h2 style="font-family:Georgia,serif;font-size:22px;color:#f0f4f8;margin:0 0 16px;">${jobType || 'Inspection'} — ${vesselName || 'Your Vessel'}</h2>
      <p style="color:#8a9bb5;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Great news — <strong style="color:#f0f4f8;">${diverName || 'A Hero-certified diver'}</strong> has accepted your inspection job.
        They will be in contact shortly to confirm details. Your full inspection report will be emailed to you once the dive is complete.
      </p>
      <a href="${PORTAL_BASE_URL}/vessel-dashboard.html" style="display:inline-block;background:#e8272c;color:#fff;padding:14px 40px;font-family:Georgia,serif;font-size:13px;letter-spacing:3px;text-transform:uppercase;text-decoration:none;font-weight:bold;">View Your Dashboard →</a>
    </div>
    <div style="padding:24px 32px;text-align:center;border-top:1px solid rgba(0,212,255,0.1);">
      <div style="font-size:11px;color:#8a9bb5;">Hero Diving &amp; Marine Services · <a href="https://herodivingandmarine.com" style="color:#00d4ff;text-decoration:none;">herodivingandmarine.com</a></div>
    </div>
  </div>
</body>
</html>`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { type } = body;

  try {
    if (type === 'job_open') {
      const { jobType, vesselName, jobLocation, scheduledDate, priceFormatted } = body;

      // Fetch all approved divers using service role
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?role=eq.diver&approved=eq.true&select=id,full_name`, {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      });

      // Get diver emails from auth.users via a join — use the admin users endpoint
      const usersRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      });

      const profilesData = await res.json();
      const usersData = await usersRes.json();

      if (!Array.isArray(profilesData) || profilesData.length === 0) {
        console.log('No approved divers to notify');
        return { statusCode: 200, body: JSON.stringify({ sent: 0 }) };
      }

      const profileIds = new Set(profilesData.map(p => p.id));
      const diverEmails = (usersData.users || [])
        .filter(u => profileIds.has(u.id) && u.email)
        .map(u => u.email);

      if (diverEmails.length === 0) {
        return { statusCode: 200, body: JSON.stringify({ sent: 0 }) };
      }

      const html = jobOpenEmailHtml({
        jobType, vesselName, jobLocation, scheduledDate, priceFormatted,
        jobBoardUrl: `${PORTAL_BASE_URL}/job-board.html`
      });

      // Send individually for better deliverability
      let sent = 0;
      for (const email of diverEmails) {
        await sendEmail(email, `New Job Available: ${jobType || 'Inspection'} — ${vesselName || 'Vessel'}`, html)
          .catch(err => console.error(`Failed to notify ${email}:`, err));
        sent++;
      }

      return { statusCode: 200, body: JSON.stringify({ sent }) };
    }

    if (type === 'job_accepted') {
      const { diverName, vesselOwnerEmail, vesselName, jobType } = body;

      if (!vesselOwnerEmail) {
        return { statusCode: 400, body: JSON.stringify({ error: 'vesselOwnerEmail required' }) };
      }

      const html = jobAcceptedEmailHtml({ diverName, vesselName, jobType });
      await sendEmail(vesselOwnerEmail, `Your Inspection Job Has Been Accepted — ${vesselName || 'Your Vessel'}`, html);

      return { statusCode: 200, body: JSON.stringify({ sent: 1 }) };
    }

    // Called from client — looks up vessel owner email server-side (never exposed to client)
    if (type === 'job_accepted_lookup') {
      const { jobId, diverName } = body;
      if (!jobId) return { statusCode: 400, body: JSON.stringify({ error: 'jobId required' }) };

      // Fetch job with vessel owner id
      const jobRes = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${jobId}&select=vessel_name,job_type,vessel_owner_id`, {
        headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
      });
      const jobs = await jobRes.json();
      const job = jobs?.[0];
      if (!job) return { statusCode: 404, body: JSON.stringify({ error: 'Job not found' }) };

      // Get vessel owner email from auth.users
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${job.vessel_owner_id}`, {
        headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
      });
      const userData = await userRes.json();
      const vesselOwnerEmail = userData?.email;
      if (!vesselOwnerEmail) return { statusCode: 200, body: JSON.stringify({ sent: 0, reason: 'no owner email' }) };

      const html = jobAcceptedEmailHtml({ diverName, vesselName: job.vessel_name, jobType: job.job_type });
      await sendEmail(vesselOwnerEmail, `Your Inspection Job Has Been Accepted — ${job.vessel_name || 'Your Vessel'}`, html);

      return { statusCode: 200, body: JSON.stringify({ sent: 1 }) };
    }

    if (type === 'job_complete_payout') {
      // Notify Hero admin for manual payout processing
      const { diverName, diverEmail, jobType, vesselName, jobId, priceFormatted } = body;
      const adminEmail = 'mike@shdw.com';

      const html = `<!DOCTYPE html><html><body style="background:#020810;color:#f0f4f8;font-family:Arial;padding:32px;">
        <h2 style="color:#00d4ff;">Job Complete — Payout Required</h2>
        <p><strong>Job ID:</strong> ${jobId}</p>
        <p><strong>Diver:</strong> ${diverName} (${diverEmail})</p>
        <p><strong>Job:</strong> ${jobType} — ${vesselName}</p>
        <p><strong>Gross:</strong> ${priceFormatted}</p>
        <p><strong>Diver payout (80%):</strong> $${Math.round(parseFloat((priceFormatted || '$0').replace('$', '')) * 0.8)}</p>
        <p>Log in to Stripe Dashboard to process the payout.</p>
      </body></html>`;

      await sendEmail(adminEmail, `Payout Required: ${jobType} — ${vesselName}`, html);
      return { statusCode: 200, body: JSON.stringify({ sent: 1 }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown notification type' }) };
  } catch (err) {
    console.error('Notify divers error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
