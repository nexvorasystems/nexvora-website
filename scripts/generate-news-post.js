#!/usr/bin/env node
/**
 * Nexvora Systems — AI News Roundup Generator
 * Runs via GitHub Actions every Tuesday and Saturday at 6:30 AM PST.
 * Tuesday:  covers news from Sunday, Monday, Tuesday
 * Saturday: covers news from Wednesday, Thursday, Friday, Saturday
 *
 * Sources: RSS feeds (no extra packages — uses built-in https + xml regex parsing)
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) { console.error('Missing OPENAI_API_KEY'); process.exit(1); }

const ROOT     = path.join(__dirname, '..');
const POSTS    = path.join(ROOT, 'posts');
const IMG_DIR  = path.join(ROOT, 'assets', 'blog');
if (!fs.existsSync(POSTS))   fs.mkdirSync(POSTS,   { recursive: true });
if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

// ── DATE RANGE ────────────────────────────────────────────
const now        = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
const dayOfWeek  = now.getDay(); // 2=Tue, 6=Sat
const dateStr    = now.toISOString().slice(0, 10);

// How many days back to look for news
const LOOKBACK_DAYS = dayOfWeek === 2 ? 3 : 4; // Tue=3, Sat=4
const cutoff = new Date(now);
cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);

// ── RSS FEEDS ─────────────────────────────────────────────
const RSS_FEEDS = [
  { name: 'TechCrunch AI',  url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'The Verge AI',   url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
];

// ── DIVERSITY ROTATION ────────────────────────────────────
const DIVERSITY = [
  'white male', 'Asian female', 'Black male', 'Latina female',
  'white female', 'Asian male', 'Black female', 'Latino male'
];
const dayOfMonth = now.getDate();
const person = DIVERSITY[(dayOfMonth + 2) % DIVERSITY.length];

// ── FETCH URL ─────────────────────────────────────────────
function fetchUrl(url, depth) {
  if ((depth || 0) > 5) return Promise.resolve('');
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NexvoraBot/1.0)' } }, res => {
      // Follow redirect — resolve relative URLs against original
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let loc = res.headers.location;
        if (!loc.startsWith('http')) {
          const base = new URL(url);
          loc = base.origin + (loc.startsWith('/') ? '' : '/') + loc;
        }
        return fetchUrl(loc, (depth || 0) + 1).then(resolve);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

// ── PARSE RSS XML ─────────────────────────────────────────
function parseRSS(xml, sourceName) {
  const items = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];

  for (const block of itemBlocks) {
    const title = (block.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
                   block.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '';
    const desc  = (block.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                   block.match(/<description[^>]*>([\s\S]*?)<\/description>/) ||
                   block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/) || [])[1] || '';
    const link  = (block.match(/<link[^>]*>(https?[^<]+)<\/link>/) ||
                   block.match(/href="(https?[^"]+)"/) || [])[1] || '';
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) ||
                     block.match(/<published>([\s\S]*?)<\/published>/) ||
                     block.match(/<updated>([\s\S]*?)<\/updated>/) || [])[1] || '';

    if (!title.trim()) continue;

    const date = pubDate ? new Date(pubDate.trim()) : null;
    if (date && date < cutoff) continue; // too old

    // Strip HTML tags from description, limit length
    const cleanDesc = desc.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim().slice(0, 300);
    const cleanTitle = title.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim();

    items.push({ title: cleanTitle, desc: cleanDesc, link, source: sourceName, date });
  }

  return items;
}

// ── OPENAI CALL ───────────────────────────────────────────
function callOpenAI(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 3500,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.72
    });
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data).choices[0].message.content); }
        catch(e) { reject(new Error('OpenAI parse error: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// ── DALL-E IMAGE ──────────────────────────────────────────
function generateImage() {
  const prompt = `Professional photo of a ${person} business professional in neutral business casual attire reading news and AI updates on a laptop in a modern bright Florida office, natural lighting, realistic photography, no religious symbols, no political symbols, no text on screen`;
  return new Promise((resolve) => {
    const body = JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1792x1024', quality: 'standard', response_format: 'url' });
    const req = https.request({
      hostname: 'api.openai.com', path: '/v1/images/generations', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d).data[0].url); } catch(e) { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.write(body); req.end();
  });
}

function downloadImage(url, dest) {
  return new Promise(resolve => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => { res.pipe(file); file.on('finish', () => { file.close(); resolve(true); }); })
      .on('error', () => { fs.unlink(dest, () => {}); resolve(false); });
  });
}

// ── SLUG + ESC ────────────────────────────────────────────
function makeSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── BUILD HTML ────────────────────────────────────────────
function buildHTML(meta, bodyMarkdown, imagePath) {
  let cleaned = bodyMarkdown
    .replace(/\n+---+\n[\s\S]*$/m, '')
    .replace(/\n+\*?\*?10 SEO keywords[\s\S]*$/im, '')
    .replace(/\n+\*?\*?Social media excerpt[\s\S]*$/im, '')
    .split('\n').filter(line => !/nexvorasystems\.us\/assessment/i.test(line) || line.includes('[')).join('\n');

  // FAQ card pattern
  cleaned = cleaned.replace(
    /\*\*Q:\*\*\s*([^\n]+)\n\*\*A:\*\*\s*([^\n]+)/g,
    (_, q, a) => `<div class="faq-item"><p class="faq-q">Q: ${q.trim()}</p><p class="faq-a">A: ${a.trim()}</p></div>`
  );

  let html = cleaned
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^\* (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .split('\n\n').map(block => {
      block = block.trim();
      if (!block) return '';
      if (block.startsWith('<')) return block;
      return `<p>${block}</p>`;
    }).join('\n');

  const imgTag = imagePath
    ? `<img src="../${imagePath}" alt="${esc(meta.title)}" style="width:100%;border-radius:14px;margin-bottom:32px;object-fit:cover;max-height:420px;display:block;"/>`
    : '';
  const av = meta.author.split(' ').map(w => w[0]).slice(0, 2).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta name="description" content="${esc(meta.metaDescription)}"/>
<title>${esc(meta.metaTitle)}</title>
<link rel="canonical" href="https://nexvorasystems.us/posts/${meta.slug}.html"/>
<meta property="og:title" content="${esc(meta.metaTitle)}"/>
<meta property="og:description" content="${esc(meta.metaDescription)}"/>
<meta property="og:type" content="article"/>
<meta property="og:url" content="https://nexvorasystems.us/posts/${meta.slug}.html"/>
<meta name="author" content="${esc(meta.author)}"/>
<meta name="article:published_time" content="${meta.date}"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{--bg:#FAF8F5;--bg-surface:#F0EDE8;--bg-card:#FFFFFF;--text:#1A1A2E;--muted:#4A5568;--dim:#718096;--border:#E2DDD5;--teal:#0D9488;--navy:#0F2B4C;--nav-h:76px;}
html,body{font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;background:var(--bg);color:var(--text);}
nav{position:fixed;top:0;left:0;right:0;z-index:200;height:var(--nav-h);display:flex;align-items:center;background:rgba(250,248,245,0.96);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);padding:0 28px;gap:20px;}
.nav-back{font-size:13px;color:var(--muted);text-decoration:none;display:flex;align-items:center;gap:5px;margin-left:auto;transition:color .15s;}
.nav-back:hover{color:var(--teal);}
.post-wrap{max-width:780px;margin:0 auto;padding:calc(var(--nav-h) + 48px) 24px 80px;}
.post-meta{display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:8px;}
.post-tag{font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--teal);}
.post-date{font-size:12px;color:var(--dim);}
.post-read{font-size:12px;color:var(--dim);}
.post-author{display:flex;align-items:center;gap:12px;font-size:13px;color:var(--muted);font-weight:600;margin-bottom:28px;}
.post-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#0D9488,#0F2B4C);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;flex-shrink:0;letter-spacing:0.5px;}
h1{font-size:clamp(24px,4vw,36px);font-weight:800;line-height:1.25;margin-bottom:12px;color:var(--text);}
h2{font-size:20px;font-weight:700;margin:36px 0 14px;color:var(--text);}
h3{font-size:16px;font-weight:700;margin:24px 0 10px;color:var(--text);}
p{font-size:16px;line-height:1.8;color:var(--muted);margin-bottom:18px;}
ul,ol{padding-left:22px;margin-bottom:18px;}
li{font-size:16px;line-height:1.8;color:var(--muted);margin-bottom:6px;}
strong{color:var(--text);}
blockquote{background:var(--bg-surface);border-left:4px solid var(--teal);border-radius:0 10px 10px 0;padding:16px 20px;margin:24px 0;font-size:15px;color:var(--text);line-height:1.7;}
blockquote strong{color:var(--navy);}
.news-item{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:20px 24px;margin-bottom:16px;}
.news-source{font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--teal);margin-bottom:6px;}
.news-title{font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px;line-height:1.4;}
.news-takeaway{font-size:14px;color:var(--muted);line-height:1.7;margin:0;}
.faq-item{border:1px solid var(--border);border-radius:12px;padding:20px 24px;margin-bottom:14px;background:var(--bg-card);}
.faq-q{font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px;}
.faq-a{font-size:15px;color:var(--muted);line-height:1.7;margin:0;}
.post-cta{background:var(--navy);border-radius:16px;padding:36px 32px;text-align:center;color:#fff;margin-top:48px;}
.post-cta h2{color:#fff;margin-top:0;}
.post-cta p{color:rgba(255,255,255,0.65);}
.post-cta a{display:inline-block;margin-top:18px;padding:14px 32px;background:var(--teal);color:#fff;font-weight:700;font-size:15px;border-radius:11px;text-decoration:none;}
@media(max-width:640px){.post-wrap{padding-left:16px;padding-right:16px;}}
</style>
</head>
<body>
<nav>
  <a href="../index.html"><img src="../assets/Logo no background.png" alt="Nexvora Systems" style="height:44px;width:auto;display:block;"/></a>
  <a href="../blog.html" class="nav-back">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    Back to Insights
  </a>
</nav>
<div class="post-wrap">
  <div class="post-meta">
    <span class="post-tag">AI News</span>
    <span class="post-date">${meta.date}</span>
    <span class="post-read">${meta.readTime}</span>
  </div>
  <h1>${esc(meta.title)}</h1>
  <div class="post-author">
    <div class="post-avatar">${av}</div>
    <span>By <strong>${esc(meta.author)}</strong> · Nexvora Systems</span>
  </div>
  ${imgTag}
  <div class="post-body">
    ${html}
  </div>
  <div class="post-cta">
    <h2>Is Your Business Ready for AI?</h2>
    <p>Take the free Nexvora Business Health Assessment and discover exactly where AI can save you time and money.</p>
    <a href="../assessment.html">Start Free Assessment</a>
  </div>
</div>
</body>
</html>`;
}

// ── UPDATE BLOG INDEX ─────────────────────────────────────
function updateBlogIndex(meta, imagePath) {
  const blogPath = path.join(ROOT, 'blog.html');
  if (!fs.existsSync(blogPath)) return;
  let blog = fs.readFileSync(blogPath, 'utf8');
  const mark = '<!-- POSTS_START -->';
  if (!blog.includes(mark)) return;

  const imgStyle = imagePath
    ? `background:url('${imagePath}') center/cover no-repeat;`
    : `background:linear-gradient(135deg,rgba(13,148,136,0.12),rgba(15,43,76,0.08));`;
  const card = `
      <a href="posts/${meta.slug}.html" class="blog-card" data-category="ai-automation">
        <div class="blog-card-img" style="${imgStyle}"></div>
        <div class="blog-card-body">
          <p class="blog-card-cat">AI News</p>
          <p class="blog-card-title">${esc(meta.title)}</p>
          <p class="blog-card-meta">${meta.date} · ${meta.readTime}</p>
        </div>
      </a>`;
  blog = blog.replace(mark, mark + '\n' + card);
  fs.writeFileSync(blogPath, blog);
  console.log('blog.html updated');
}

// ── PARSE META FROM AI OUTPUT ─────────────────────────────
function parseMeta(raw) {
  const get = (key) => { const m = raw.match(new RegExp(key + ':\\s*(.+)')); return m ? m[1].trim() : ''; };
  return {
    title: get('Title'),
    metaTitle: get('Meta Title') || get('Title'),
    metaDescription: get('Meta Description'),
    slug: get('Slug') || makeSlug(get('Title')),
    readTime: (get('Estimated Reading Time') || '5 min read').replace(/\*+/g, '').trim(),
  };
}

// ── RUN ───────────────────────────────────────────────────
(async () => {
  const periodLabel = dayOfWeek === 2 ? 'Sunday–Tuesday' : 'Wednesday–Saturday';
  console.log(`Generating AI news roundup for ${periodLabel}...`);

  // 1. Fetch all RSS feeds in parallel
  console.log('Fetching RSS feeds...');
  const feedResults = await Promise.all(
    RSS_FEEDS.map(f => fetchUrl(f.url).then(xml => parseRSS(xml, f.name)))
  );

  // 2. Flatten, deduplicate by title, sort newest first
  const allItems = feedResults.flat();
  const seen = new Set();
  const unique = allItems.filter(item => {
    const key = item.title.slice(0, 60).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by date descending
  unique.sort((a, b) => (b.date || 0) - (a.date || 0));

  console.log(`Found ${unique.length} articles in date range`);

  if (unique.length === 0) {
    console.warn('No articles found in date range — skipping news post');
    process.exit(0);
  }

  // 3. Take top 10 to send to GPT (it will pick the best 5–7)
  const top = unique.slice(0, 10);
  const newsContext = top.map((item, i) =>
    `${i + 1}. [${item.source}] ${item.title}\n   ${item.desc || '(no description)'}`
  ).join('\n\n');

  // 4. Build GPT prompt
  const prompt = `You are the content strategist and AI editor for Nexvora Systems, a Florida-based business consulting company.

Today: ${dateStr} | Period covered: ${periodLabel}

Here are the latest AI and automation news headlines from the past few days:

${newsContext}

Write a "This Week in AI" news roundup post for nexvorasystems.us aimed at Florida small business owners (not tech people). Focus on what these developments actually mean for their business — practical impact, not hype.

OUTPUT FORMAT — start with these lines exactly:
Title: This Week in AI: [2-4 word summary of the biggest theme] (${dateStr})
Meta Title: [under 60 chars]
Meta Description: [under 155 chars, include "Florida small business"]
Slug: ai-news-roundup-${dateStr}
Estimated Reading Time: [X min read]

Then write the article with this structure:
## What Happened This Week in AI
[2-3 sentence overview of the main themes]

## The Stories That Matter for Your Business
[For each story you select (5–7 total), write a mini-section like this:]
### [Story headline rewritten in plain English]
[2-3 sentences: what happened + what it means for a small business owner in Florida]

## What This Means for Florida Business Owners
[1 paragraph connecting the week's news to practical action]

## Bottom Line
[3-4 bullet points: the most important takeaways for a business owner to act on]

Requirements:
- Write for non-technical business owners — no jargon
- Focus on practical business impact: time saved, costs, competitive edge
- Mention Florida or Tampa Bay naturally once or twice
- Tone: knowledgeable, direct, no hype
- End with: Ready to see how AI can help your specific business? [Start Free Assessment](https://nexvorasystems.us/assessment.html)
- Do NOT use blockquotes in this post type`;

  console.log('Calling GPT-4o-mini...');
  const raw = await callOpenAI(prompt);

  const meta = parseMeta(raw);
  if (!meta.title) {
    console.error('Could not parse meta. Raw output:');
    console.error(raw.slice(0, 500));
    process.exit(1);
  }

  meta.author = 'Murat Zhandaurov';
  meta.date = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // 5. Generate image
  console.log('Generating DALL-E image...');
  const imgUrl = await generateImage();
  let imagePath = null;
  if (imgUrl) {
    const imgFile = `assets/blog/${meta.slug}.jpg`;
    const ok = await downloadImage(imgUrl, path.join(ROOT, imgFile));
    if (ok) { imagePath = imgFile; console.log('Image saved:', imgFile); }
  }

  // 6. Build and write post
  const bodyStart = raw.indexOf('## ');
  const body = bodyStart >= 0 ? raw.slice(bodyStart) : raw;
  const postHtml = buildHTML(meta, body, imagePath);
  const postPath = path.join(POSTS, meta.slug + '.html');
  fs.writeFileSync(postPath, postHtml);
  console.log('Post written:', postPath);

  // 7. Update blog index
  updateBlogIndex(meta, imagePath);

  // 8. Update sitemap
  updateSitemap(meta.slug);

  console.log(`\nDone! News roundup: "${meta.title}"`);
})();

// ── UPDATE SITEMAP ────────────────────────────────────────
function updateSitemap(slug) {
  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) return;
  let sitemap = fs.readFileSync(sitemapPath, 'utf8');
  if (sitemap.includes(`/posts/${slug}.html`)) return; // already in sitemap
  const entry = `
  <url>
    <loc>https://nexvorasystems.us/posts/${slug}.html</loc>
    <lastmod>${dateStr}</lastmod>
    <changefreq>never</changefreq>
    <priority>0.6</priority>
  </url>`;
  sitemap = sitemap.replace('</urlset>', entry + '\n</urlset>');
  fs.writeFileSync(sitemapPath, sitemap);
  console.log('sitemap.xml updated');
}
