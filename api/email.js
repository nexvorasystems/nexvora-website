function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://nexvorasystems.us');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, name, bizName } = req.body;

  const trimmedName = (name || '').trim();
  if (!to || !trimmedName) return res.status(400).json({ error: 'to and name required' });
  if (!emailRe.test(to)) return res.status(400).json({ error: 'Invalid email address' });
  if (trimmedName.length > 200 || (bizName && bizName.length > 200)) {
    return res.status(400).json({ error: 'Input too long' });
  }

  const first = escHtml(trimmedName.split(/\s+/)[0]);
  const safeBizName = escHtml(bizName || trimmedName);
  const reportUrl = 'https://nexvorasystems.us/report.html';

  if (process.env.RESEND_API_KEY?.trim()) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Nexvora Systems <info@nexvorasystems.us>',
          to: [to],
          subject: `Your Nexvora Business Health Report — ${bizName || name}`,
          html: `
            <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;color:#1A1A2E;">
              <img src="https://nexvorasystems.us/assets/Logo no background.png" alt="Nexvora Systems" style="height:44px;margin-bottom:24px;"/>
              <h1 style="font-size:22px;font-weight:800;margin-bottom:8px;">Your Business Health Report is ready, ${first}.</h1>
              <p style="font-size:15px;color:#4A5568;line-height:1.7;margin-bottom:20px;">Thank you for completing the Nexvora assessment. Your personalized report — including industry benchmarks, owner economics, and a full analysis of every area of your business — is ready to view.</p>
              <a href="${reportUrl}" style="display:inline-block;padding:14px 28px;background:#0D9488;color:#fff;font-weight:700;font-size:15px;border-radius:10px;text-decoration:none;">View Your Report</a>
              <p style="font-size:13px;color:#718096;margin-top:24px;line-height:1.6;">Murat and Alexandr personally review every assessment. If you'd like to talk through your results, reply to this email or visit <a href="https://nexvorasystems.us/contact.html" style="color:#0D9488;">nexvorasystems.us/contact</a>.</p>
              <hr style="border:none;border-top:1px solid #E2DDD5;margin:24px 0;"/>
              <p style="font-size:12px;color:#A0ADB8;">© 2025 Nexvora Systems LLC · Tampa Bay, Florida · <a href="https://nexvorasystems.us/legal/privacy.html" style="color:#A0ADB8;">Privacy Policy</a></p>
            </div>
          `
        })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error('Resend error:', response.status, err);
        return res.status(500).json({ error: 'Email failed to send' });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error('Email error:', error.message);
      return res.status(500).json({ error: 'Email failed to send' });
    }
  }

  // No Resend key — silently skip
  console.log(`[EMAIL SKIPPED — no RESEND_API_KEY] To: ${to.substring(0,5)}..., Name: ${trimmedName.substring(0,20)}`);
  return res.json({ success: true, note: 'Email skipped — no API key configured' });
};
