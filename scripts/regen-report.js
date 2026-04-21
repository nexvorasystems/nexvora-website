/**
 * Regenerate a specific assessment report by ID.
 * Usage: node scripts/regen-report.js <report-id>
 *
 * Fetches assessment JSON from generated_reports table,
 * POSTs to the live generate-report API with the existing ID so it upserts.
 */

// Parse .env.local manually — no dotenv dependency needed
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=\s]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/\\n/g, '');
  });
}

const REPORT_ID = process.argv[2];
if (!REPORT_ID) { console.error('Usage: node scripts/regen-report.js <report-id>'); process.exit(1); }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local');
  process.exit(1);
}

async function main() {
  console.log(`[regen] Fetching report ${REPORT_ID} from Supabase...`);

  // 1. Fetch existing report's assessment data
  const fetchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/generated_reports?id=eq.${REPORT_ID}&select=id,assessment,email`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!fetchRes.ok) {
    const err = await fetchRes.text();
    console.error('[regen] Supabase fetch failed:', fetchRes.status, err);
    process.exit(1);
  }

  const rows = await fetchRes.json();
  if (!rows.length) {
    console.error(`[regen] No report found with id=${REPORT_ID}`);
    process.exit(1);
  }

  const row = rows[0];
  const assessment = row.assessment;
  if (!assessment) {
    console.error('[regen] Report has no assessment data stored');
    process.exit(1);
  }

  console.log(`[regen] Got assessment for: ${assessment.contact?.company || assessment.contact?.name || '(unknown)'}`);
  console.log('[regen] Calling generate-report API... (this takes ~60s for GPT + research)');

  // 2. Call the live API — passes reportId so it upserts instead of inserting new
  const genRes = await fetch('https://nexvorasystems.us/api/generate-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'assessment',
      assessment,
      reportId: REPORT_ID
    }),
    signal: AbortSignal.timeout ? AbortSignal.timeout(180000) : undefined
  });

  if (!genRes.ok) {
    const err = await genRes.text();
    console.error('[regen] generate-report API error:', genRes.status, err);
    process.exit(1);
  }

  const result = await genRes.json();
  if (result.error) {
    console.error('[regen] API returned error:', result.error);
    process.exit(1);
  }

  console.log('[regen] Report regenerated successfully!');
  console.log('[regen] Report URL: https://nexvorasystems.us/r/' + REPORT_ID);
  console.log('[regen] Result:', JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error('[regen] Unexpected error:', err.message);
  process.exit(1);
});
