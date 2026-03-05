// Netlify Function: admin-action
// Privileged operations for the admin panel
// Validates caller is admin via JWT, uses service role for all DB operations
// Uses only built-in fetch — no npm dependencies required

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const PORTAL_BASE_URL = process.env.PORTAL_BASE_URL || 'https://hero-diver-portal.netlify.app';

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  return res.json();
}

async function supabasePatch(table, filter, data) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(data)
  });
}

async function sendEmail(to, subject, html) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Hero Diving & Marine <admin@herodivingandmarine.com>',
      to: [to],
      subject,
      html
    })
  });
}

async function getCallerProfile(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_SERVICE_ROLE_KEY }
  });
  const userData = await userRes.json();
  if (!userData?.id) return null;

  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userData.id}&select=id,role`, {
    headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const profiles = await profileRes.json();
  return profiles?.[0] || null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Validate admin role
  const profile = await getCallerProfile(event.headers.authorization);
  if (!profile || profile.role !== 'admin') {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { action } = body;

  try {
    if (action === 'get_admin_stats') {
      const [pendingApps, activeJobs, approvedDivers, allPaidJobs] = await Promise.all([
        supabaseGet('diver_applications?status=eq.pending&select=id'),
        supabaseGet('jobs?status=in.(accepted,in_progress)&select=id'),
        supabaseGet('profiles?role=eq.diver&approved=eq.true&select=id'),
        supabaseGet('jobs?paid_at=not.is.null&select=price_cents,paid_at')
      ]);

      const now = new Date();
      const mtd = Array.isArray(allPaidJobs)
        ? allPaidJobs.filter(j => {
            const d = new Date(j.paid_at);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          })
        : [];

      return {
        statusCode: 200,
        body: JSON.stringify({
          pendingApplications: Array.isArray(pendingApps) ? pendingApps.length : 0,
          activeJobs: Array.isArray(activeJobs) ? activeJobs.length : 0,
          approvedDivers: Array.isArray(approvedDivers) ? approvedDivers.length : 0,
          revenueMTD: mtd.reduce((sum, j) => sum + (j.price_cents || 0), 0),
          revenueTotal: Array.isArray(allPaidJobs) ? allPaidJobs.reduce((sum, j) => sum + (j.price_cents || 0), 0) : 0
        })
      };
    }

    if (action === 'get_applications') {
      const apps = await supabaseGet('diver_applications?order=created_at.desc&select=*');
      return { statusCode: 200, body: JSON.stringify(apps) };
    }

    if (action === 'get_all_jobs') {
      const jobs = await supabaseGet('jobs?order=created_at.desc&select=*,profiles!jobs_vessel_owner_id_fkey(full_name),profiles!jobs_diver_id_fkey(full_name)');
      return { statusCode: 200, body: JSON.stringify(jobs) };
    }

    if (action === 'approve_diver') {
      const { applicationId, userId, diverEmail, diverName } = body;
      await Promise.all([
        supabasePatch('diver_applications', `id=eq.${applicationId}`, {
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: profile.id
        }),
        supabasePatch('profiles', `id=eq.${userId}`, { approved: true })
      ]);

      if (diverEmail) {
        await sendEmail(diverEmail, 'Welcome to the Hero Diver Network!', `
          <!DOCTYPE html><html><body style="background:#020810;color:#f0f4f8;font-family:Arial;padding:32px;max-width:600px;margin:0 auto;">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="font-family:Georgia,serif;font-size:28px;letter-spacing:6px;text-transform:uppercase;color:#f0f4f8;">HERO</div>
            <div style="font-size:10px;letter-spacing:5px;text-transform:uppercase;color:#8a9bb5;">Diving &amp; Marine Services</div>
          </div>
          <div style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);padding:24px;margin-bottom:24px;">
            <h2 style="color:#00d4ff;font-size:20px;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">You're Approved!</h2>
            <p style="color:#8a9bb5;line-height:1.7;margin:0;">Welcome to the Hero Diver Network, ${diverName || 'Diver'}. Your application has been approved and you can now accept jobs on the job board.</p>
          </div>
          <a href="${PORTAL_BASE_URL}/job-board.html" style="display:inline-block;background:#e8272c;color:#fff;padding:14px 40px;font-family:Georgia,serif;font-size:13px;letter-spacing:3px;text-transform:uppercase;text-decoration:none;font-weight:bold;">View Job Board →</a>
          <p style="color:#8a9bb5;font-size:12px;margin-top:24px;">Hero Diving &amp; Marine Services · herodivingandmarine.com</p>
          </body></html>
        `).catch(err => console.error('Welcome email failed:', err));
      }

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    if (action === 'reject_diver') {
      const { applicationId, diverEmail, diverName } = body;
      await supabasePatch('diver_applications', `id=eq.${applicationId}`, {
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: profile.id
      });

      if (diverEmail) {
        await sendEmail(diverEmail, 'Hero Diver Network — Application Update', `
          <!DOCTYPE html><html><body style="background:#020810;color:#f0f4f8;font-family:Arial;padding:32px;max-width:600px;margin:0 auto;">
          <p>Hi ${diverName || 'there'},</p>
          <p style="color:#8a9bb5;">Thank you for applying to the Hero Diver Network. After review, we're unable to approve your application at this time.</p>
          <p style="color:#8a9bb5;">Please contact us at <a href="mailto:info@herodivingandmarine.com" style="color:#00d4ff;">info@herodivingandmarine.com</a> if you have questions.</p>
          <p style="color:#8a9bb5;font-size:12px;">Hero Diving &amp; Marine Services</p>
          </body></html>
        `).catch(() => {});
      }

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    if (action === 'cancel_job') {
      const { jobId } = body;
      await supabasePatch('jobs', `id=eq.${jobId}`, { status: 'cancelled' });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (err) {
    console.error('Admin action error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
