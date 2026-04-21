/**
 * One-time fix for report v4tj63ipu1 (24 25 CLEANERS)
 *
 * Problem: Contractors pay was stored as $64,584/person because old code
 * used y1 ($1.55M) as revenue base instead of y0 ($1.15M current year).
 * Result: 25 × $64,584 = $1,614,600/mo — wildly wrong.
 *
 * Fix: Recalculate from correct base.
 *   50% of ($1,150,000 / 12) = $47,917/mo total for all 25 contractors
 *   Per person: $47,917 / 25 = $1,917/mo
 */

const fs = require('fs');
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^#=\s]+)\s*=\s*"?([^"]*?)"?\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/\\n/g, '').trim();
});

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const REPORT_ID = 'v4tj63ipu1';

async function main() {
  console.log('[fix] Fetching current assessment...');
  const r = await fetch(`${SB_URL}/rest/v1/generated_reports?id=eq.${REPORT_ID}&select=assessment,email`, {
    headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
  });
  const [row] = await r.json();
  const a = row.assessment;

  // ── Contractor pay fix ────────────────────────────────────────────────────
  const annRev = a.q4_parsed?.y0 || a.q4_parsed?.y1 || 0;  // $1,150,000
  const moRev  = Math.round(annRev / 12);                    // $95,833
  const ctorPct = a.q19_segments?.contractors?.contractor_pct || 50;
  const ctorCount = a.q19_segments?.contractors?.count || 25;
  const ctorTotalMo = Math.round(moRev * ctorPct / 100);     // $47,917
  const ctorPerPerson = Math.round(ctorTotalMo / ctorCount); // $1,917

  console.log(`[fix] Revenue base: $${annRev.toLocaleString()}/yr = $${moRev.toLocaleString()}/mo`);
  console.log(`[fix] Contractors: ${ctorCount} people × ${ctorPct}% of revenue`);
  console.log(`[fix] Old pay/person: $${a.q19_segments.contractors.pay.toLocaleString()}`);
  console.log(`[fix] New pay/person: $${ctorPerPerson.toLocaleString()} (total: $${ctorTotalMo.toLocaleString()})`);

  // Patch contractors segment
  a.q19_segments.contractors.pay          = ctorPerPerson;
  a.q19_segments.contractors.pay_with_tax = ctorPerPerson;

  // Recalculate q19_total (sum of all staff segments × count)
  const staffTotal = Object.values(a.q19_segments).reduce((sum, seg) => {
    return sum + (Number(seg.count || 0) * Number(seg.pay || 0));
  }, 0);
  console.log(`[fix] Old q19_total: $${a.q19_total.toLocaleString()}`);
  console.log(`[fix] New q19_total: $${staffTotal.toLocaleString()}`);
  a.q19_total = staffTotal;

  // ── Patch assessment in Supabase ─────────────────────────────────────────
  console.log('[fix] Patching Supabase...');
  const patch = await fetch(`${SB_URL}/rest/v1/generated_reports?id=eq.${REPORT_ID}`, {
    method: 'PATCH',
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ assessment: a })
  });

  if (!patch.ok) {
    console.error('[fix] Patch failed:', patch.status, await patch.text());
    process.exit(1);
  }
  console.log('[fix] Assessment patched successfully.');

  // ── Regenerate report ────────────────────────────────────────────────────
  console.log('[fix] Regenerating report... (~60s)');
  const gen = await fetch('https://nexvorasystems.us/api/generate-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'assessment', assessment: a, reportId: REPORT_ID }),
    signal: AbortSignal.timeout ? AbortSignal.timeout(180000) : undefined
  });

  if (!gen.ok) {
    console.error('[fix] Regen failed:', gen.status, await gen.text());
    process.exit(1);
  }
  const result = await gen.json();
  console.log('[fix] Done! Report URL: https://nexvorasystems.us/r/' + REPORT_ID);
  console.log('[fix] Result:', JSON.stringify(result));
}

main().catch(e => { console.error(e.message); process.exit(1); });
