/**
 * Nexvora Systems — Server-side PageSpeed Insights Proxy
 * GET /api/psi?url=https://example.com&strategy=mobile|desktop
 *
 * Why server-side:
 * - Keeps the PSI_API_KEY secret (not exposed in public JS)
 * - With an API key: 25,000 req/day instead of ~1/second free tier
 * - Retries happen server-side — faster & more reliable than client
 * - Caches results for 10 minutes to avoid redundant calls
 *
 * Setup: add PSI_API_KEY to Vercel env vars (optional but recommended)
 * Get a key: https://console.developers.google.com → PageSpeed Insights API
 */

const PSI_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const cache = new Map(); // in-memory, per function instance

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://nexvorasystems.us');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { url, strategy = 'mobile' } = req.query;

  if (!url) return res.status(400).json({ error: 'url param required' });

  // Validate URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: 'URL must use http or https' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const cacheKey = `${strategy}:${parsedUrl.href}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached.data);
  }

  const apiKey = process.env.PSI_API_KEY?.trim();
  const endpoint = `${PSI_BASE}?url=${encodeURIComponent(parsedUrl.href)}&strategy=${strategy}${apiKey ? `&key=${apiKey}` : ''}`;

  let lastError = null;
  const maxRetries = apiKey ? 2 : 3; // with key: fewer retries needed

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const psiRes = await fetch(endpoint);
      const json = await psiRes.json().catch(() => null);

      if (psiRes.status === 429) {
        const delay = apiKey ? 1500 * (i + 1) : 3000 * (i + 1);
        await sleep(delay);
        continue;
      }

      if (!psiRes.ok) {
        lastError = json?.error?.message || json?.error?.errors?.[0]?.message || `PSI returned ${psiRes.status}`;
        await sleep(1500 * (i + 1));
        continue;
      }

      if (json?.lighthouseResult) {
        // Cache the successful result
        cache.set(cacheKey, { data: json, ts: Date.now() });
        // Trim cache if too large
        if (cache.size > 200) {
          const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
          cache.delete(oldest[0]);
        }
        res.setHeader('X-Cache', 'MISS');
        return res.json(json);
      }

      // 200 but no lighthouse result
      lastError = json?.error?.message || 'No Lighthouse data returned';
      await sleep(1500);

    } catch (e) {
      lastError = e.message;
      await sleep(1500 * (i + 1));
    }
  }

  // All retries exhausted
  console.error(`[psi] Failed for ${parsedUrl.href} (${strategy}):`, lastError);
  return res.status(502).json({
    error: 'PSI audit failed',
    detail: lastError,
    url: parsedUrl.href,
    strategy
  });
};
