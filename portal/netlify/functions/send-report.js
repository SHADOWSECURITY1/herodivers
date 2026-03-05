// Netlify Function: send-report
// Sends a formatted inspection report via Resend and marks it as sent in Supabase
// Uses only built-in fetch — no npm dependencies required

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  const { reportId, reportData, clientEmail, clientName, vesselName, diverName, beforeMedia = [], afterMedia = [] } = body;

  if (!clientEmail) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Client email is required' }) };
  }

  // Build the email HTML
  const d = reportData || {};
  const inspectionDate = d.inspection_date
    ? new Date(d.inspection_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  function row(label, value) {
    if (!value) return '';
    return `
      <tr>
        <td style="padding:8px 12px; color:#8a9bb5; font-size:12px; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; width:40%;">${label}</td>
        <td style="padding:8px 12px; color:#f0f4f8; font-size:14px;">${value}</td>
      </tr>`;
  }

  function sectionBlock(title, rows) {
    const content = rows.filter(Boolean).join('');
    if (!content) return '';
    return `
      <div style="margin-bottom:24px;">
        <div style="background:#0c2340; padding:10px 16px; border-left:3px solid #00d4ff; margin-bottom:0;">
          <span style="font-family:Georgia,serif; font-size:13px; letter-spacing:3px; text-transform:uppercase; color:#00d4ff;">${title}</span>
        </div>
        <table style="width:100%; border-collapse:collapse; background:#071422;">
          ${content}
        </table>
      </div>`;
  }

  const priorityColor = d.action_priority === 'Immediate Action Required' ? '#e8272c'
    : d.action_priority === 'Within 30 Days' ? '#e85c27'
    : d.action_priority === 'No Action Required' ? '#4ade80' : '#f0f4f8';

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Inspection Report — ${vesselName || 'Vessel'}</title>
</head>
<body style="margin:0; padding:0; background:#020810; font-family: Arial, sans-serif;">

  <div style="max-width:680px; margin:0 auto; background:#020810;">

    <!-- Header -->
    <div style="background:linear-gradient(180deg, #0c2340 0%, #020810 100%); padding:40px 32px; text-align:center; border-bottom:1px solid rgba(0,212,255,0.15);">
      <div style="font-family:Georgia,serif; font-size:28px; font-weight:700; letter-spacing:6px; text-transform:uppercase; color:#f0f4f8; margin-bottom:4px;">HERO</div>
      <div style="font-size:10px; letter-spacing:5px; text-transform:uppercase; color:#8a9bb5; margin-bottom:24px;">Diving &amp; Marine Services</div>
      <div style="display:inline-block; background:#e8272c; padding:8px 24px; font-size:11px; letter-spacing:4px; text-transform:uppercase; color:#f0f4f8; font-weight:bold;">
        ${d.report_type || 'Inspection Report'}
      </div>
    </div>

    <!-- Summary bar -->
    <div style="background:#0a1a30; padding:24px 32px; border-bottom:1px solid rgba(0,212,255,0.1);">
      <table style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="vertical-align:top; width:50%;">
            <div style="font-size:10px; letter-spacing:3px; text-transform:uppercase; color:#8a9bb5; margin-bottom:4px;">Vessel</div>
            <div style="font-size:20px; font-weight:bold; color:#f0f4f8; letter-spacing:1px;">${vesselName || '—'}</div>
          </td>
          <td style="vertical-align:top; width:50%;">
            <div style="font-size:10px; letter-spacing:3px; text-transform:uppercase; color:#8a9bb5; margin-bottom:4px;">Date of Inspection</div>
            <div style="font-size:16px; color:#f0f4f8;">${inspectionDate}</div>
          </td>
        </tr>
        <tr>
          <td style="padding-top:16px; vertical-align:top;">
            <div style="font-size:10px; letter-spacing:3px; text-transform:uppercase; color:#8a9bb5; margin-bottom:4px;">Client</div>
            <div style="font-size:16px; color:#f0f4f8;">${clientName || '—'}</div>
          </td>
          <td style="padding-top:16px; vertical-align:top;">
            <div style="font-size:10px; letter-spacing:3px; text-transform:uppercase; color:#8a9bb5; margin-bottom:4px;">Location</div>
            <div style="font-size:16px; color:#f0f4f8;">${d.job_location || '—'}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Report body -->
    <div style="padding:32px;">

      ${sectionBlock('Vessel Details', [
        row('Vessel Type', d.vessel_type),
        row('Hull Material', d.hull_material),
        row('Length', d.vessel_length ? `${d.vessel_length} ${d.length_unit || 'ft'}` : ''),
        row('Year Built', d.year_built)
      ])}

      ${sectionBlock('Hull Condition', [
        row('Overall Rating', d.hull_rating ? `${d.hull_rating} / 5` : ''),
        row('Marine Growth Coverage', d.marine_growth_coverage),
        row('Marine Growth Type', d.marine_growth_type),
        row('Antifouling Paint', d.antifouling_paint),
        row('Hull Damage', d.hull_damage),
        row('Notes', d.hull_notes)
      ])}

      ${sectionBlock('Running Gear', [
        row('Propeller Condition', d.propeller_condition),
        row('Propeller Growth', d.propeller_growth),
        row('Shaft Condition', d.shaft_condition),
        row('Rudder Condition', d.rudder_condition),
        row('Notes', d.running_gear_notes)
      ])}

      ${sectionBlock('Anodes', [
        row('Anode Condition', d.anode_condition),
        row('Anode Count Remaining', d.anode_count),
        row('Notes', d.anode_notes)
      ])}

      ${sectionBlock('Through-Hulls & Seacocks', [
        row('Overall Condition', d.throughhull_condition),
        row('Number of Through-Hulls', d.throughhull_count),
        row('Notes', d.throughhull_notes)
      ])}

      ${sectionBlock('Dive Conditions', [
        row('Underwater Visibility', d.visibility),
        row('Water Depth', d.water_depth ? `${d.water_depth} ${d.depth_unit || 'ft'}` : ''),
        row('Water Temperature', d.water_temp ? `${d.water_temp}${d.temp_unit || '°F'}` : ''),
        row('Diver Notes', d.dive_notes)
      ])}

      <!-- Recommendations (highlighted) -->
      ${d.action_priority || d.recommendations ? `
      <div style="margin-bottom:24px;">
        <div style="background:#0c2340; padding:10px 16px; border-left:3px solid #e8272c; margin-bottom:0;">
          <span style="font-size:13px; letter-spacing:3px; text-transform:uppercase; color:#e8272c;">Recommendations</span>
        </div>
        <div style="background:#071422; padding:20px 16px;">
          ${d.action_priority ? `<div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; color:#8a9bb5; margin-bottom:4px;">Action Priority</div>
          <div style="font-size:18px; font-weight:bold; color:${priorityColor}; margin-bottom:16px;">${d.action_priority}</div>` : ''}
          ${d.recommendations ? `<div style="font-size:11px; letter-spacing:2px; text-transform:uppercase; color:#8a9bb5; margin-bottom:8px;">Details</div>
          <div style="font-size:14px; color:#f0f4f8; line-height:1.6;">${d.recommendations}</div>` : ''}
        </div>
      </div>` : ''}

      ${(beforeMedia.length > 0 || afterMedia.length > 0) ? `
      <div style="margin-bottom:24px;">
        <div style="background:#0c2340; padding:10px 16px; border-left:3px solid #00d4ff; margin-bottom:0;">
          <span style="font-family:Georgia,serif; font-size:13px; letter-spacing:3px; text-transform:uppercase; color:#00d4ff;">Job Photos &amp; Video</span>
        </div>
        <div style="background:#071422; padding:20px 16px;">
          ${beforeMedia.length > 0 ? `
          <div style="margin-bottom:16px;">
            <div style="font-size:10px; letter-spacing:3px; text-transform:uppercase; color:#8a9bb5; margin-bottom:10px;">Before Dive</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${beforeMedia.filter(m => m.type === 'image').map(m =>
                `<img src="${m.url}" width="200" style="height:150px; object-fit:cover; border:1px solid rgba(0,212,255,0.15);" alt="Before">`
              ).join('')}
              ${beforeMedia.filter(m => m.type === 'video').map(m =>
                `<div style="padding:8px 0;"><a href="${m.url}" style="color:#00d4ff; font-size:13px; text-decoration:none;">▶ View Before Video</a></div>`
              ).join('')}
            </div>
          </div>` : ''}
          ${afterMedia.length > 0 ? `
          <div>
            <div style="font-size:10px; letter-spacing:3px; text-transform:uppercase; color:#8a9bb5; margin-bottom:10px;">After Dive</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${afterMedia.filter(m => m.type === 'image').map(m =>
                `<img src="${m.url}" width="200" style="height:150px; object-fit:cover; border:1px solid rgba(0,212,255,0.15);" alt="After">`
              ).join('')}
              ${afterMedia.filter(m => m.type === 'video').map(m =>
                `<div style="padding:8px 0;"><a href="${m.url}" style="color:#00d4ff; font-size:13px; text-decoration:none;">▶ View After Video</a></div>`
              ).join('')}
            </div>
          </div>` : ''}
        </div>
      </div>` : ''}

      ${sectionBlock('Diver Certification', [
        row('Diver', diverName || d.diver_name),
        row('Certification Agency', d.cert_agency),
        row('Certification Number', d.cert_number),
        row('Hero Divers Member ID', d.hero_member_id)
      ])}

    </div>

    <!-- Footer -->
    <div style="background:#0a1a30; padding:24px 32px; text-align:center; border-top:1px solid rgba(0,212,255,0.1);">
      <div style="font-size:11px; letter-spacing:3px; text-transform:uppercase; color:#8a9bb5; margin-bottom:8px;">Hero Diving &amp; Marine Services</div>
      <div style="font-size:12px; color:#8a9bb5;">
        <a href="https://herodivingandmarine.com" style="color:#00d4ff; text-decoration:none;">herodivingandmarine.com</a>
      </div>
      <div style="margin-top:16px; font-size:11px; color:#8a9bb5; opacity:0.6;">
        This report was prepared by a certified Hero Divers network professional. Report ID: ${reportId || 'N/A'}
      </div>
    </div>

  </div>
</body>
</html>`;

  // Send via Resend
  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Hero Diving & Marine <reports@herodivingandmarine.com>',
        to: [clientEmail],
        subject: `${d.report_type || 'Inspection Report'} — ${vesselName || 'Your Vessel'}`,
        html: emailHtml
      })
    });

    if (!resendRes.ok) {
      const resendError = await resendRes.json();
      throw new Error(resendError.message || 'Resend API error');
    }

    // Update report status in Supabase via REST API (no npm package needed)
    if (reportId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      await fetch(`${SUPABASE_URL}/rest/v1/reports?id=eq.${reportId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString() })
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error('Send report error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
