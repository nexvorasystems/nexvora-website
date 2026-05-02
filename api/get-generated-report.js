/**
 * Nexvora Systems — Unified Report Getter with Email Gate
 *
 * GET  ?id=xxx               → Serve email gate page
 * GET  ?id=xxx&token=xxx     → Verify HMAC token → serve report HTML
 * POST {id, email}           → Verify email → return {token} or {error}
 * GET  ?mode=audit&...       → Audit mode (existing behavior, unchanged)
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const crypto = require('crypto');

function makeToken(id, email) {
  return crypto
    .createHmac('sha256', SUPABASE_SERVICE_KEY || 'nx-report-secret')
    .update(`${id}:${email.toLowerCase().trim()}`)
    .digest('hex')
    .slice(0, 48);
}

function gateHTML(id, errorMsg) {
  const err = errorMsg ? `<div class="error">${errorMsg}</div>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>View Your Business Report — Nexvora Systems</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:linear-gradient(135deg,#0F2B4C 0%,#0D9488 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}
.card{background:#fff;border-radius:20px;padding:48px 40px;max-width:440px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.3);}
.logo{font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#0D9488;margin-bottom:28px;}
.icon{font-size:44px;margin-bottom:18px;}
h1{font-size:22px;font-weight:900;color:#0F2B4C;margin-bottom:10px;letter-spacing:-.5px;}
.sub{font-size:14px;color:#6B7280;line-height:1.65;margin-bottom:28px;}
input{width:100%;padding:14px 16px;border:2px solid #E5E7EB;border-radius:10px;font-size:15px;outline:none;transition:border-color .2s;margin-bottom:14px;}
input:focus{border-color:#0D9488;}
button{width:100%;padding:14px;background:linear-gradient(135deg,#0F2B4C,#0D9488);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;transition:opacity .2s;}
button:hover{opacity:.9;}
button:disabled{opacity:.55;cursor:not-allowed;}
.error{background:#FEE2E2;border:1px solid #EF4444;border-radius:8px;padding:10px 14px;font-size:13px;color:#991B1B;margin-bottom:16px;text-align:left;}
.hint{font-size:12px;color:#9CA3AF;margin-top:18px;}
@media(max-width:480px){.card{padding:32px 24px;}}
</style>
</head>
<body>
<div class="card">
  <div class="logo">Nexvora Systems</div>
  <div class="icon">📊</div>
  <h1>Your Business Report is Ready</h1>
  <p class="sub">Enter the email address you used to complete the assessment to access your private report.</p>
  <div id="err-wrap">${err}</div>
  <form id="f">
    <input type="email" id="em" placeholder="your@email.com" required autocomplete="email" />
    <button type="submit" id="btn">View My Report →</button>
  </form>
  <p class="hint">🔒 Your report is private and protected</p>
</div>
<script>
document.getElementById('f').addEventListener('submit', async function(e) {
  e.preventDefault();
  var btn = document.getElementById('btn');
  var email = document.getElementById('em').value.trim();
  var errWrap = document.getElementById('err-wrap');
  btn.disabled = true;
  btn.textContent = 'Verifying…';
  errWrap.innerHTML = '';
  try {
    var r = await fetch('/api/get-generated-report', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({id:'${id}', email: email})
    });
    var d = await r.json();
    if (d.token) {
      window.location.href = '/r/${id}?token=' + d.token;
    } else {
      errWrap.innerHTML = '<div class="error">That email doesn\\'t match our records. Please use the email you entered when filling out the assessment.</div>';
      btn.disabled = false;
      btn.textContent = 'View My Report →';
    }
  } catch(err) {
    errWrap.innerHTML = '<div class="error">Something went wrong. Please try again.</div>';
    btn.disabled = false;
    btn.textContent = 'View My Report →';
  }
});
</script>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(503).json({ error: 'Database not configured' });

  const sbHeaders = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };

  const { id, mode, email: qEmail, token } = req.query;

  // ── Audit mode (unchanged) ────────────────────────────────────────────────
  if (req.method === 'GET' && mode === 'audit') {
    if (!id || !qEmail) return res.status(400).json({ error: 'id and email required' });
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/reports?id=eq.${encodeURIComponent(id)}&select=id,data`, { headers: sbHeaders });
      if (!r.ok) return res.status(500).json({ error: 'Database error' });
      const rows = await r.json();
      if (!rows?.length) return res.status(404).json({ error: 'Report not found' });
      const row = rows[0];
      const savedEmail = row.data?.contact?.email || '';
      if (savedEmail.toLowerCase().trim() !== qEmail.toLowerCase().trim())
        return res.status(403).json({ error: 'Email does not match this report' });
      return res.json({ success: true, id: row.id, data: row.data });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST: Verify email → return token ────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body || {};
    const { id: postId, email: postEmail } = body;
    if (!postId || !postEmail) return res.status(400).json({ error: 'id and email required' });
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/generated_reports?id=eq.${encodeURIComponent(postId)}&select=email`,
        { headers: sbHeaders }
      );
      const rows = await r.json();
      if (!rows?.length) return res.status(404).json({ error: 'Report not found' });

      const storedEmail = (rows[0].email || '').toLowerCase().trim();
      const inputEmail  = postEmail.toLowerCase().trim();

      // No email stored = legacy report, allow access
      if (!storedEmail) {
        return res.json({ token: makeToken(postId, '') });
      }

      if (storedEmail !== inputEmail) {
        return res.status(403).json({ error: 'Email does not match' });
      }

      // Log access — fire-and-forget
      fetch(`${SUPABASE_URL}/rest/v1/report_access_log`, {
        method: 'POST',
        headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          report_id: postId,
          email: storedEmail,
          accessed_at: new Date().toISOString(),
          ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || null
        })
      }).catch(() => {});

      return res.json({ token: makeToken(postId, storedEmail) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET ───────────────────────────────────────────────────────────────────
  if (req.method === 'GET' && id) {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/generated_reports?id=eq.${encodeURIComponent(id)}&select=html,email`,
        { headers: sbHeaders }
      );
      const rows = await r.json();
      if (!rows?.length) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(404).send('<div style="font-family:sans-serif;padding:48px;text-align:center;"><h2>Report not found</h2><p style="color:#6B7280;margin-top:8px;">This report link may be invalid or expired.</p></div>');
      }

      const storedEmail = (rows[0].email || '').toLowerCase().trim();
      const html = rows[0].html;

      // No email stored = legacy report, serve directly
      if (!storedEmail) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(html);
      }

      // Token provided — verify
      if (token) {
        const expected = makeToken(id, storedEmail);
        if (token === expected) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.status(200).send(html);
        }
        // Invalid token → show gate with message
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(403).send(gateHTML(id, 'Session expired. Please enter your email again.'));
      }

      // No token → show gate
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(gateHTML(id));

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Invalid request' });
};
