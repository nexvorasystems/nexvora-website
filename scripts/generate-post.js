#!/usr/bin/env node
/**
 * Nexvora Systems — Daily Content Generator
 * Runs via GitHub Actions every day at 6am PST.
 * Generates 1 main post + 1 AI post on Mon/Wed/Fri.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) { console.error('Missing OPENAI_API_KEY'); process.exit(1); }

// ── DATE + DAY ──────────────────────────────────────────
const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
const dayOfMonth = now.getDate();
const dayOfWeek = now.getDay(); // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
const isAiDay = [1, 3, 5].includes(dayOfWeek); // Mon, Wed, Fri
const dateStr = now.toISOString().slice(0, 10);

// ── CITY REGIONS ─────────────────────────────────────────
function getRegion(day) {
  if (day <= 5)  return { name: 'Tampa Bay Area',      cities: ['Tampa', 'St. Petersburg', 'Clearwater', 'Wesley Chapel', 'Brandon', 'Riverview', 'Land O\' Lakes', 'Palm Harbor'] };
  if (day <= 10) return { name: 'Southwest Florida',   cities: ['Naples', 'Fort Myers', 'Cape Coral', 'Bonita Springs', 'Estero', 'Punta Gorda'] };
  if (day <= 15) return { name: 'Orlando Metro',       cities: ['Orlando', 'Kissimmee', 'Winter Park', 'Lake Mary', 'Sanford', 'Clermont'] };
  if (day <= 20) return { name: 'Central Florida',     cities: ['Lakeland', 'Winter Haven', 'Plant City', 'Davenport', 'Haines City', 'Bartow'] };
  if (day <= 25) return { name: 'Jacksonville Metro',  cities: ['Jacksonville', 'Orange Park', 'St. Augustine', 'Ponte Vedra', 'Jacksonville Beach'] };
  return          { name: 'Miami Metro',               cities: ['Miami', 'Fort Lauderdale', 'Boca Raton', 'Hollywood', 'Coral Gables', 'Pembroke Pines'] };
}

// ── SERVICE TOPIC ROTATION ────────────────────────────────
const SERVICE_BY_DAY = {
  0: 'Operations',           // Sun
  1: 'AI & Automation',      // Mon
  2: 'Operations',           // Tue
  3: 'Reporting & Analytics',// Wed
  4: 'Sales Systems',        // Thu
  5: 'Marketing',            // Fri
  6: 'Financial Efficiency', // Sat
};
const service = SERVICE_BY_DAY[dayOfWeek];
const region = getRegion(dayOfMonth);
const cityList = region.cities.slice(0, 5).join(', ');

// ── FOUNDER ROTATION ──────────────────────────────────────
const founder = dayOfMonth % 2 === 0 ? 'Murat Zhandaurov' : 'Alexandr Godovanyuk';
const wednesdayFounder = 'Murat Zhandaurov';

// ── OPENAI CALL ───────────────────────────────────────────
function callOpenAI(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.75
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
    req.write(body);
    req.end();
  });
}

// ── DALL-E 3 IMAGE GENERATION ─────────────────────────────
const IMAGE_PROMPTS = {
  'Operations':            'Professional photo of a small business owner reviewing workflow checklists and process charts in a modern Florida office, natural lighting, realistic photography, no text or labels',
  'AI & Automation':       'Business owner at a clean desk reviewing AI dashboard on laptop, modern office with Florida sunshine, realistic photography, no text overlays',
  'Reporting & Analytics': 'Entrepreneur analyzing business performance charts on multiple screens in a professional office, natural lighting, realistic photography, no text',
  'Sales Systems':         'Small business sales team in a modern Florida office reviewing customer pipeline on a screen, professional photography, natural light, no text',
  'Marketing':             'Small business owner working on marketing strategy with sticky notes and laptop in a bright Florida office, realistic photography, no text',
  'Financial Efficiency':  'Business owner reviewing financial statements and cash flow reports at a clean desk, professional Florida office, realistic photography, no text',
  'Customer Experience':   'Friendly business owner greeting a happy customer in a professional Florida service business, realistic photography, natural light, no text',
  'Team & HR':             'Small business team in a collaborative meeting in a modern Florida office, diverse group, professional photography, no text',
  'Growth & Scaling':      'Entrepreneur planning business growth on a whiteboard in a clean modern office, Florida light, realistic photography, no text',
};

function generateImage(service) {
  const prompt = IMAGE_PROMPTS[service] || IMAGE_PROMPTS['Operations'];
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1792x1024',
      quality: 'standard',
      response_format: 'url'
    });
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/images/generations',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.data?.[0]?.url || null);
        } catch(e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write(body);
    req.end();
  });
}

function downloadImage(url, destPath) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, res => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(true); });
    }).on('error', () => { fs.unlink(destPath, () => {}); resolve(false); });
  });
}

// ── SLUG HELPER ───────────────────────────────────────────
function makeSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

// ── HTML BUILDER ──────────────────────────────────────────
function buildHTML(meta, bodyMarkdown, imagePath) {
  // Strip SEO metadata block that appears after article (keywords, social, linkedin, etc.)
  let cleaned = bodyMarkdown
    .replace(/\n+---+\n[\s\S]*$/m, '')                          // strip after ---
    .replace(/\n+\*?\*?10 SEO keywords[\s\S]*$/im, '')          // strip SEO block
    .replace(/\n+\*?\*?SEO keywords[\s\S]*$/im, '')
    .replace(/\n+\*?\*?Social media excerpt[\s\S]*$/im, '')
    .replace(/\n+\*?\*?LinkedIn post[\s\S]*$/im, '')
    .replace(/\n+\*?\*?Suggested social[\s\S]*$/im, '')
    // Remove any paragraph/line with a raw nexvorasystems.us URL — template CTA handles this
    .split('\n').filter(line => !/nexvorasystems\.us\/assessment/i.test(line) || line.includes('[')).join('\n');

  // Clean markdown → HTML
  let html = cleaned
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')           // bold
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>') // links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>') // relative links
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^\* (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .split('\n\n')
    .map(block => {
      block = block.trim();
      if (!block) return '';
      if (block.startsWith('<')) return block;
      return `<p>${block}</p>`;
    })
    .join('\n');

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
${meta.primaryKeyword ? `<meta name="keywords" content="${esc(meta.primaryKeyword)}${meta.secondaryKeywords ? ', ' + esc(meta.secondaryKeywords) : ''}"/>` : ''}
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
    <span class="post-tag">${esc(meta.service)}</span>
    <span class="post-date">${meta.date}</span>
    <span class="post-read">${meta.readTime}</span>
  </div>
  <h1>${esc(meta.title)}</h1>
  <div class="post-author">
    <div class="post-avatar">${meta.author.split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
    <span>By <strong>${esc(meta.author)}</strong> · Nexvora Systems</span>
  </div>
  ${imagePath ? `<img src="../${imagePath}" alt="${esc(meta.title)}" style="width:100%;border-radius:14px;margin-bottom:32px;object-fit:cover;max-height:420px;display:block;"/>` : ''}
  <div class="post-body">
    ${html}
  </div>
  <div class="post-cta">
    <h2>See How Your Business Scores</h2>
    <p>Take the free Nexvora Business Health Assessment and get a personalized report in under 5 minutes.</p>
    <a href="../assessment.html">Start Free Assessment</a>
  </div>
</div>
</body>
</html>`;
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── PARSE META FROM AI OUTPUT ─────────────────────────────
function parseMeta(raw) {
  const get = (key) => { const m = raw.match(new RegExp(key + ':\\s*(.+)')); return m ? m[1].trim() : ''; };
  const getBlock = (key) => { const m = raw.match(new RegExp(key + ':?\\s*([^\\n]+(?:\\n(?![A-Z][a-z])[^\\n]+)*)')); return m ? m[1].trim() : ''; };
  return {
    title: get('Title'),
    metaTitle: get('Meta Title') || get('Title'),
    metaDescription: get('Meta Description'),
    slug: get('Slug') || makeSlug(get('Title')),
    primaryKeyword: get('Primary Keyword'),
    secondaryKeywords: get('Secondary Keywords'),
    readTime: (get('Estimated Reading Time') || '8 min read').replace(/\*+/g, '').trim(),
  };
}

// ── MAIN PROMPT BUILDER ───────────────────────────────────
function buildMainPrompt() {
  return `You are the content strategist and SEO writer for Nexvora Systems, a Florida-based consulting company.

Today: ${dateStr} | Day of month: ${dayOfMonth} | Region: ${region.name} | Cities: ${cityList}
Service topic: ${service}
Founder to mention naturally once: ${founder}

Write one complete long-form article for nexvorasystems.us.

OUTPUT FORMAT — start with these lines exactly:
Title: [your title]
Meta Title: [under 60 chars]
Meta Description: [under 155 chars]
Slug: [kebab-case, keyword-first]
Primary Keyword: [one phrase]
Secondary Keywords: [comma separated]
Cities Mentioned: ${cityList}
Estimated Reading Time: [X min read]

Then write the full article using this structure:
## Introduction
## Why This Problem Happens
## Signs Your Business Has This Problem
## The Cost of Ignoring It
## How Better Systems Fix It
## How Nexvora Systems Helps
## Frequently Asked Questions
## Final Thoughts

After the article add:
10 SEO keywords:
5 long-tail keyword phrases:
3 suggested internal links:
Social media excerpt:
LinkedIn post summary:

Requirements:
- 1,500–2,500 words
- Professional, practical, direct — never generic or AI-sounding
- Specific examples, numbers, step-by-step explanations
- Florida business examples using cities: ${cityList}
- Mention ${founder} naturally once
- End with CTA linking to the assessment: use markdown [Start Free Assessment](https://nexvorasystems.us/assessment.html) — NEVER show raw URLs or .html extensions as plain visible text
- Optimize for Google featured snippets, voice search, AI search tools
- Primary keyword density 0.8%–1.2%
- Service: ${service}
- For key statistics, data points, or important quotes use markdown blockquote format: > **The data:** your stat here
- Use blockquotes 2-3 times per article for maximum visual impact`;
}

function buildAiPrompt() {
  const aiFounder = dayOfWeek === 3 ? wednesdayFounder : founder;
  return `You are the content strategist and SEO writer for Nexvora Systems, a Florida-based consulting company.

Today: ${dateStr} | Region: ${region.name} | Cities: ${cityList}
This is an AI-focused bonus article (published on Mon/Wed/Fri).
Mention ${aiFounder} naturally once${dayOfWeek === 3 ? ' — Wednesday rule: always Murat Zhandaurov' : ''}.

OUTPUT FORMAT — start with these lines exactly:
Title: [your title]
Meta Title: [under 60 chars]
Meta Description: [under 155 chars]
Slug: [kebab-case, keyword-first, add -ai suffix]
Primary Keyword: [one phrase]
Estimated Reading Time: [X min read]

Then write the article using this structure:
## What Business Owners Need to Know
## Why It Matters for Small Business Owners
## How It Helps Save Time and Money
## How It Helps a Business Grow and Scale
## Common Mistakes and Risks
## How Nexvora Systems Helps Implement It
## FAQ
## Final Takeaway

Requirements:
- 1,000–1,800 words
- Focus: AI, automation, software, practical business implementation
- Include measurable examples (save 5–20 hrs/week, reduce missed leads 20–50%, etc.)
- Florida cities: ${cityList}
- Mention ${aiFounder} naturally once
- Optimize for AI search tools, Google, featured snippets
- End with CTA linking to the assessment: use markdown [Start Free Assessment](https://nexvorasystems.us/assessment.html) — NEVER show raw URLs or .html extensions as plain visible text
- For key statistics, data points, or important quotes use markdown blockquote format: > **The data:** your stat here
- Use blockquotes 2-3 times per article for maximum visual impact`;
}

// ── SERVICE → FILTER CATEGORY MAP ────────────────────────
const SERVICE_CATEGORY = {
  'Operations': 'operations',
  'AI & Automation': 'ai-automation',
  'Reporting & Analytics': 'reporting',
  'Sales Systems': 'sales',
  'Marketing': 'marketing',
  'Customer Experience': 'revenue',
  'Team & HR': 'team',
  'Financial Efficiency': 'finance',
  'Growth & Scaling': 'growth',
};

// ── UPDATE BLOG INDEX ─────────────────────────────────────
function updateBlogIndex(entries) {
  const blogPath = path.join(__dirname, '..', 'blog.html');
  if (!fs.existsSync(blogPath)) return;
  let blog = fs.readFileSync(blogPath, 'utf8');
  const insertMark = '<!-- POSTS_START -->';
  if (!blog.includes(insertMark)) return;

  const newCards = entries.map(e => {
    const category = SERVICE_CATEGORY[e.service] || 'operations';
    const imgStyle = e.imagePath
      ? `background:url('../${e.imagePath}') center/cover no-repeat;`
      : `background:linear-gradient(135deg,rgba(13,148,136,0.12),rgba(15,43,76,0.08));`;
    return `
      <a href="posts/${e.slug}.html" class="blog-card" data-category="${category}">
        <div class="blog-card-img" style="${imgStyle}"></div>
        <div class="blog-card-body">
          <p class="blog-card-cat">${esc(e.service)}</p>
          <p class="blog-card-title">${esc(e.title)}</p>
          <p class="blog-card-meta">${e.date} · ${e.readTime}</p>
        </div>
      </a>`;
  }).join('\n');

  blog = blog.replace(insertMark, insertMark + '\n' + newCards);
  fs.writeFileSync(blogPath, blog);
  console.log('blog.html updated');
}

// ── WRITE POST FILE ───────────────────────────────────────
async function writePost(meta, rawContent, serviceLabel, authorName) {
  // Extract body (everything after the last metadata line)
  const bodyStart = rawContent.indexOf('## ');
  const body = bodyStart >= 0 ? rawContent.slice(bodyStart) : rawContent;
  meta.service = serviceLabel;
  meta.author = authorName || founder;
  meta.date = new Date(dateStr).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

  // Generate image with DALL-E 3
  let imagePath = null;
  console.log(`Generating image for: ${serviceLabel}`);
  const imgDir = path.join(__dirname, '..', 'assets', 'blog');
  if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
  const imgUrl = await generateImage(serviceLabel);
  if (imgUrl) {
    const imgFile = `assets/blog/${meta.slug}.jpg`;
    const imgFilePath = path.join(__dirname, '..', imgFile);
    const ok = await downloadImage(imgUrl, imgFilePath);
    if (ok) {
      imagePath = imgFile;
      console.log('Image saved:', imgFile);
    }
  }
  meta.imagePath = imagePath;

  const html = buildHTML(meta, body, imagePath);
  const filename = meta.slug + '.html';
  const filepath = path.join(__dirname, '..', 'posts', filename);
  fs.writeFileSync(filepath, html);
  console.log('Written:', filepath);
  return filename;
}

// ── RUN ───────────────────────────────────────────────────
(async () => {
  const written = [];

  // Ensure posts dir exists
  const postsDir = path.join(__dirname, '..', 'posts');
  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });

  // Main post
  console.log(`Generating main post: ${service} | ${region.name}`);
  const mainRaw = await callOpenAI(buildMainPrompt());
  const mainMeta = parseMeta(mainRaw);
  if (mainMeta.title) {
    await writePost(mainMeta, mainRaw, service, founder);
    written.push(mainMeta);
  } else {
    console.error('Could not parse main post meta. Raw output saved for debug.');
    fs.writeFileSync('debug-main.txt', mainRaw);
  }

  // AI bonus post on Mon/Wed/Fri
  if (isAiDay) {
    console.log('Generating AI bonus post...');
    const aiFounder = dayOfWeek === 3 ? wednesdayFounder : founder;
    const aiRaw = await callOpenAI(buildAiPrompt());
    const aiMeta = parseMeta(aiRaw);
    if (aiMeta.title) {
      await writePost(aiMeta, aiRaw, 'AI & Automation', aiFounder);
      written.push(aiMeta);
    } else {
      console.error('Could not parse AI post meta.');
      fs.writeFileSync('debug-ai.txt', aiRaw);
    }
  }

  updateBlogIndex(written);
  console.log(`Done. ${written.length} post(s) generated.`);
})();
