#!/usr/bin/env node
/**
 * Nexvora Systems — Daily Blog Cluster Generator v2
 * Claude Sonnet writes → GPT-4o SEO review → Flux 1.1 Pro images → Notion memory → publish
 * Runs via GitHub Actions daily at 6am PST
 *
 * Output: 1 pillar article + 3 support articles, one region per day
 * Regions: Florida (days 1-13) | Southern California (days 14-22) | Washington (days 23-31)
 */

'use strict';
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

// ── ENVIRONMENT ───────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY     = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY        = process.env.OPENAI_API_KEY;
const REPLICATE_API_KEY     = process.env.REPLICATE_API_KEY;
const NOTION_API_KEY        = process.env.NOTION_API_KEY;
const NOTION_PARENT_PAGE_ID = (process.env.NOTION_PARENT_PAGE_ID || '').replace(/-/g, '');

const REQUIRED = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'REPLICATE_API_KEY', 'NOTION_API_KEY', 'NOTION_PARENT_PAGE_ID'];
const missing  = REQUIRED.filter(k => !process.env[k]);
if (missing.length) { console.error('Missing secrets:', missing.join(', ')); process.exit(1); }

// ── DATE ──────────────────────────────────────────────────────────────────────
const now        = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
const dateStr    = now.toISOString().slice(0, 10);
const dayOfMonth = now.getDate();
const dayOfWeek  = now.getDay();

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const NOTION_VERSION    = '2022-06-28';
const DB_TITLE          = 'Nexvora Blog History';
const CITY_COOLDOWN_DAYS = 60;

// ── REGIONS ───────────────────────────────────────────────────────────────────
const REGIONS = {
  florida: {
    name: 'Florida', state: 'FL',
    cities: [
      'Tampa','St. Petersburg','Clearwater','Wesley Chapel','Brandon','Riverview',
      "Land O'Lakes",'Palm Harbor','Naples','Fort Myers','Cape Coral','Bonita Springs',
      'Orlando','Kissimmee','Winter Park','Lake Mary','Sanford','Clermont',
      'Lakeland','Winter Haven','Plant City','Davenport','Haines City',
      'Jacksonville','St. Augustine','Ponte Vedra','Jacksonville Beach',
      'Miami','Fort Lauderdale','Boca Raton','Hollywood','Coral Gables','Pembroke Pines',
      'Sarasota','Bradenton','Port Charlotte','Venice','Gainesville','Ocala',
      'Tallahassee','Pensacola','Panama City','Zephyrhills','New Port Richey',
    ]
  },
  socal: {
    name: 'Southern California', state: 'CA',
    cities: [
      'Los Angeles','San Diego','Anaheim','Santa Ana','Riverside','Chula Vista',
      'Irvine','Glendale','Pasadena','Pomona','Torrance','Garden Grove',
      'Oceanside','Rancho Cucamonga','Ontario','Corona','Murrieta','Temecula',
      'Escondido','El Cajon','Victorville','Simi Valley','Thousand Oaks',
      'Oxnard','Ventura','Long Beach','Santa Monica','Burbank',
      'El Monte','West Covina','Fullerton','Whittier','Orange',
      'Costa Mesa','Santa Clarita','Lancaster','Palmdale','Inglewood','Carson',
    ]
  },
  washington: {
    name: 'Washington State', state: 'WA',
    cities: [
      'Seattle','Spokane','Tacoma','Vancouver','Bellevue','Kent','Everett',
      'Renton','Kirkland','Bellingham','Kennewick','Yakima','Redmond',
      'Marysville','Pasco','Richland','Shoreline','Federal Way','Burien',
      'Lakewood','Sammamish','Bothell','Lynnwood','Edmonds','Auburn',
      'Olympia','Bremerton','Mount Vernon','Walla Walla','Pullman',
      'Wenatchee','Moses Lake','Ellensburg','Issaquah','Covington',
    ]
  }
};

// Days 1-13 = Florida, 14-22 = SoCal, 23-31 = Washington
function getRegion(day) {
  if (day <= 13) return REGIONS.florida;
  if (day <= 22) return REGIONS.socal;
  return REGIONS.washington;
}

// ── TOPIC ROTATION (cycles through 8 topics by day of month) ─────────────────
const TOPICS = [
  'AI & Automation',
  'Operations & Efficiency',
  'Sales Systems',
  'Reporting & Analytics',
  'Marketing & Lead Generation',
  'Financial Efficiency',
  'Customer Experience',
  'Growth & Scaling',
];
function getTopic(day) { return TOPICS[(day - 1) % TOPICS.length]; }

// ── TOPIC VISUALS for Flux prompt ────────────────────────────────────────────
const TOPIC_VISUALS = {
  'AI & Automation':           'AI CRM dashboard on laptop screen, automation workflow diagram visible, data streams',
  'Operations & Efficiency':   'business process workflow on monitor, checklist on desk, organized workspace',
  'Sales Systems':             'sales pipeline dashboard on laptop, CRM interface, lead tracking metrics on screen',
  'Reporting & Analytics':     'business analytics dashboard with KPI charts, performance metrics on multiple screens',
  'Marketing & Lead Generation':'marketing analytics dashboard, lead funnel chart on laptop, social metrics visible',
  'Financial Efficiency':      'financial dashboard with cash flow charts, bookkeeping software on laptop screen',
  'Customer Experience':       'customer service platform on screen, review dashboard, client communication interface',
  'Growth & Scaling':          'business growth chart on screen, strategic planning session, whiteboard with growth plan',
};

// ── RESOLVE ───────────────────────────────────────────────────────────────────
const region = getRegion(dayOfMonth);
const topic  = getTopic(dayOfMonth);
const SALES_TOPICS = new Set(['Sales Systems']);
const pillarFounder = SALES_TOPICS.has(topic) ? 'Alexandr Godovanyuk' : 'Murat Zhandaurov';

// ── HTTP HELPER ───────────────────────────────────────────────────────────────
function httpReq(options, body) {
  return new Promise((resolve, reject) => {
    const lib = (options.port === 80) ? http : https;
    const req = lib.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── CLAUDE SONNET ─────────────────────────────────────────────────────────────
async function callClaude(prompt, maxTokens = 8000) {
  console.log('  [Claude] Sending request...');
  const body = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }]
  });
  const { status, body: data } = await httpReq({
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);
  if (status !== 200) throw new Error(`Claude ${status}: ${JSON.stringify(data).slice(0,300)}`);
  const text = data.content?.[0]?.text || '';
  console.log(`  [Claude] Response: ${text.split(/\s+/).length} words`);
  return text;
}

// ── GPT-4o SEO REVIEW ─────────────────────────────────────────────────────────
async function callGPT(prompt, maxTokens = 6000) {
  console.log('  [GPT-4o] Sending SEO review...');
  const body = JSON.stringify({
    model: 'gpt-4o',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3
  });
  const { status, body: data } = await httpReq({
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);
  if (status !== 200) throw new Error(`GPT ${status}: ${JSON.stringify(data).slice(0,300)}`);
  const text = data.choices?.[0]?.message?.content || '';
  console.log(`  [GPT-4o] Reviewed: ${text.split(/\s+/).length} words`);
  return text;
}

// ── FLUX 1.1 PRO via REPLICATE ────────────────────────────────────────────────
async function generateFluxImage(prompt) {
  console.log('  [Flux] Generating image...');
  const body = JSON.stringify({
    input: {
      prompt,
      aspect_ratio: '16:9',
      output_format: 'jpg',
      output_quality: 85,
      safety_tolerance: 2,
      prompt_upsampling: true
    }
  });

  const { status, body: pred } = await httpReq({
    hostname: 'api.replicate.com',
    path: '/v1/models/black-forest-labs/flux-1.1-pro/predictions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REPLICATE_API_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait=60',
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);

  if (status !== 200 && status !== 201) {
    console.warn(`  [Flux] Submit error ${status}:`, JSON.stringify(pred).slice(0, 200));
    return null;
  }

  if (pred.status === 'succeeded') {
    const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    console.log('  [Flux] Image ready (synchronous)');
    return url;
  }

  // Poll if not complete
  const predId = pred.id;
  if (!predId) { console.warn('  [Flux] No prediction ID'); return null; }

  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const { body: poll } = await httpReq({
      hostname: 'api.replicate.com',
      path: `/v1/predictions/${predId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${REPLICATE_API_KEY}` }
    });
    if (poll.status === 'succeeded') {
      const url = Array.isArray(poll.output) ? poll.output[0] : poll.output;
      console.log(`  [Flux] Image ready (poll ${i+1})`);
      return url;
    }
    if (poll.status === 'failed' || poll.status === 'canceled') {
      console.warn('  [Flux] Failed:', poll.error);
      return null;
    }
    console.log(`  [Flux] Polling ${i+1}/25 — ${poll.status}`);
  }

  console.warn('  [Flux] Timed out');
  return null;
}

// ── DOWNLOAD IMAGE ────────────────────────────────────────────────────────────
function downloadImage(url, destPath) {
  return new Promise(resolve => {
    const lib = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    lib.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        return resolve(downloadImage(res.headers.location, destPath));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(true); });
    }).on('error', () => { try { fs.unlinkSync(destPath); } catch(e){} resolve(false); });
  });
}

// ── NOTION API ────────────────────────────────────────────────────────────────
async function notionReq(method, endpoint, body) {
  const bodyStr = body ? JSON.stringify(body) : '';
  const opts = {
    hostname: 'api.notion.com',
    path: '/v1' + endpoint,
    method,
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    }
  };
  if (bodyStr) opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
  const { status, body: data } = await httpReq(opts, bodyStr || undefined);
  if (status >= 400) console.warn(`[Notion] ${method} ${endpoint} → ${status}:`, JSON.stringify(data).slice(0, 200));
  return data;
}

async function getOrCreateDB() {
  // Search for existing DB named DB_TITLE
  const search = await notionReq('POST', '/search', {
    query: DB_TITLE,
    filter: { value: 'database', property: 'object' }
  });

  const existing = (search.results || []).find(r =>
    r.object === 'database' &&
    (r.title?.[0]?.plain_text === DB_TITLE)
  );

  if (existing) {
    console.log('[Notion] Found existing DB:', existing.id);
    return existing.id;
  }

  console.log('[Notion] Creating blog history database...');
  const db = await notionReq('POST', '/databases', {
    parent: { type: 'page_id', page_id: NOTION_PARENT_PAGE_ID },
    title: [{ type: 'text', text: { content: DB_TITLE } }],
    properties: {
      'Title':              { title: {} },
      'Date':               { date: {} },
      'Region':             { select: { options: [
        { name: 'Florida',              color: 'blue'   },
        { name: 'Southern California',  color: 'orange' },
        { name: 'Washington State',     color: 'green'  },
      ]}},
      'City':               { rich_text: {} },
      'Topic Category':     { select: { options: TOPICS.map((t, i) => ({
        name: t,
        color: ['blue','green','orange','red','purple','pink','yellow','gray'][i % 8]
      })) }},
      'Article Type':       { select: { options: [
        { name: 'Pillar',  color: 'red'  },
        { name: 'Support', color: 'blue' },
      ]}},
      'Main Keyword':       { rich_text: {} },
      'Secondary Keywords': { rich_text: {} },
      'URL Slug':           { rich_text: {} },
      'Meta Title':         { rich_text: {} },
      'Meta Description':   { rich_text: {} },
      'Published URL':      { url: {} },
      'Related Pillar':     { rich_text: {} },
      'Status':             { select: { options: [
        { name: 'Draft',     color: 'yellow' },
        { name: 'Final',     color: 'orange' },
        { name: 'Published', color: 'green'  },
      ]}},
      'Image Filename':     { rich_text: {} },
      'Image Alt Text':     { rich_text: {} },
      'Word Count':         { number: {} },
    }
  });

  if (!db.id) throw new Error('Failed to create Notion DB: ' + JSON.stringify(db).slice(0, 300));
  console.log('[Notion] DB created:', db.id);
  return db.id;
}

async function getRecentArticles(dbId, limit = 100) {
  const data = await notionReq('POST', `/databases/${dbId}/query`, {
    page_size: limit,
    sorts: [{ property: 'Date', direction: 'descending' }]
  });
  const getText   = p => p?.rich_text?.[0]?.plain_text || p?.title?.[0]?.plain_text || '';
  const getSelect = p => p?.select?.name || '';
  return (data.results || []).map(page => {
    const props = page.properties || {};
    return {
      title:   getText(props['Title']),
      region:  getSelect(props['Region']),
      city:    getText(props['City']),
      topic:   getSelect(props['Topic Category']),
      keyword: getText(props['Main Keyword']),
      slug:    getText(props['URL Slug']),
      date:    props['Date']?.date?.start || '',
    };
  });
}

async function saveToNotion(dbId, article, pillarTitle) {
  const rt = s => [{ text: { content: String(s || '').slice(0, 2000) } }];
  const props = {
    'Title':              { title: rt(article.title.slice(0, 100)) },
    'Date':               { date: { start: dateStr } },
    'Region':             { select: { name: article.region } },
    'City':               { rich_text: rt(article.city || '') },
    'Topic Category':     { select: { name: article.topic } },
    'Article Type':       { select: { name: article.articleType } },
    'Main Keyword':       { rich_text: rt(article.primaryKeyword || '') },
    'Secondary Keywords': { rich_text: rt(article.secondaryKeywords || '') },
    'URL Slug':           { rich_text: rt(article.slug || '') },
    'Meta Title':         { rich_text: rt(article.metaTitle || '') },
    'Meta Description':   { rich_text: rt(article.metaDescription || '') },
    'Status':             { select: { name: 'Final' } },
    'Image Filename':     { rich_text: rt(article.imageFile || '') },
    'Image Alt Text':     { rich_text: rt(article.imageAlt || '') },
    'Word Count':         { number: article.wordCount || 0 },
  };
  if (pillarTitle) {
    props['Related Pillar'] = { rich_text: rt(pillarTitle.slice(0, 100)) };
  }
  const page = await notionReq('POST', '/pages', { parent: { database_id: dbId }, properties: props });
  return page.id;
}

async function markPublished(pageId, publishedUrl) {
  await notionReq('PATCH', `/pages/${pageId}`, {
    properties: {
      'Status':        { select: { name: 'Published' } },
      'Published URL': { url: publishedUrl }
    }
  });
}

// ── CITY SELECTION (respects 60-day cooldown per city+topic) ──────────────────
function selectCities(regionCities, recentArticles, count) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CITY_COOLDOWN_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const recentlyUsed = new Set(
    recentArticles
      .filter(a => a.date >= cutoffStr && a.topic === topic)
      .map(a => a.city)
  );

  const available = regionCities.filter(c => !recentlyUsed.has(c));
  const pool = available.length >= count ? available : regionCities;

  // Deterministic shuffle based on date
  const seed = dayOfMonth * 13 + dayOfWeek * 7;
  const shuffled = [...pool].sort((a, b) =>
    ((a.charCodeAt(0) * 31 + seed) % 97) - ((b.charCodeAt(0) * 31 + seed) % 97)
  );
  return shuffled.slice(0, count);
}

// ── USED KEYWORD TRACKING ─────────────────────────────────────────────────────
function getUsedKeywords(recentArticles) {
  return new Set(recentArticles.slice(0, 60).map(a => a.keyword?.toLowerCase()).filter(Boolean));
}

// ── PROMPTS ───────────────────────────────────────────────────────────────────
function buildPillarPrompt(cities, usedKeywords) {
  const cityList  = cities.slice(0, 6).join(', ');
  const avoidList = [...usedKeywords].slice(0, 20).join(', ');

  return `You are the lead content strategist and writer for Nexvora Systems, a business consulting company that helps small and medium business owners in ${region.name} implement AI, automation, CRM, and operational systems to grow revenue and free up time.

Today: ${dateStr} | Region: ${region.name} (${region.state}) | Topic: ${topic}
Author: ${pillarFounder}
${avoidList ? `\nDo NOT target these keyword angles (already published): ${avoidList}\n` : ''}
OUTPUT — write these header lines first, exactly as shown:
Title: [specific, search-intent title: ${topic} for Small Businesses in ${region.name}]
Meta Title: [under 60 chars, primary keyword first]
Meta Description: [under 155 chars, includes primary keyword + clear benefit]
Slug: [kebab-case, keyword-first, no date, no "nexvora"]
Primary Keyword: [one specific phrase, not in avoid list]
Secondary Keywords: [5 comma-separated related phrases]
Article Type: Pillar
Estimated Reading Time: [X min read]

WORD COUNT REQUIREMENT: This article MUST be between 3,200 and 4,000 words. Count carefully. Do not stop writing until you reach 3,200 words minimum. Every section below has a minimum word count — you must hit it.

Write the full article using EXACTLY these sections in this order. Each section must meet its minimum word count:

## Introduction (minimum 200 words)
Open with a direct, specific statement about the problem ${topic} causes for small business owners in ${region.name}. Name 2-3 cities. Explain who this article is for and exactly what they will learn. No fluff. No "in today's world." No "are you struggling."

## The Real Problem: Why ${topic} Breaks Down for ${region.name} Small Businesses (minimum 400 words)
Explain in detail why small businesses in ${region.name} specifically struggle with ${topic}. Name real business types: HVAC companies, cleaning services, plumbing contractors, medical offices, law firms, real estate teams, auto shops. Name cities: ${cityList}. Give 3-4 specific scenarios showing exactly how the problem plays out. Use numbers where possible.

## What This Is Actually Costing You Every Month (minimum 350 words)
Break down the real financial and operational cost of NOT having good ${topic} systems. Give specific dollar estimates. Examples: "A Tampa HVAC company with 8 technicians losing 3 leads per week at an average job value of $800 is losing $115,200 per year." Do the math. Make it real. Include at least 2 blockquotes in this format:
> **The data:** [specific stat or calculation]

## The ${topic} Systems That Actually Work for Small Businesses (minimum 500 words)
List and explain 4-6 specific tools, systems, or processes that fix the problem. For each one: what it is, how it works, what type of business it fits, what result it produces. Be specific — name actual software tools where relevant (HubSpot, GoHighLevel, QuickBooks, Jobber, ServiceTitan, etc.). Do not be vague.

## Step-by-Step: How to Build This in Your Business (minimum 500 words)
Write a detailed numbered implementation plan. At least 6 steps. Each step must explain: what to do, how to do it, how long it takes, what it costs, and what result to expect. This is the most practical section — write it like instructions a business owner can follow starting Monday morning.

## Real Results: What Happens When You Get This Right (minimum 300 words)
Give 3 realistic before/after scenarios for different business types in ${region.name}. Each scenario: business type, city, problem they had, what they implemented, specific result (time saved, revenue gained, leads recovered). Make the numbers believable and specific.

## Common Mistakes ${region.name} Business Owners Make With ${topic} (minimum 250 words)
List 4-5 specific mistakes with explanation of why each one happens and what it costs. Be direct. No softening language.

## How Nexvora Systems Helps ${region.name} Businesses (minimum 200 words)
Explain specifically what Nexvora does, how the process works, what business owners get. Mention ${pillarFounder} once naturally. End with CTA: [Start Your Free Business Assessment](https://nexvorasystems.us/assessment.html)

## Related Articles
Include exactly 3 internal links in this format — these will be replaced with real URLs after publishing:
- [SUPPORT_LINK_1]
- [SUPPORT_LINK_2]
- [SUPPORT_LINK_3]

## Frequently Asked Questions (minimum 300 words total across all answers)
Write 6 FAQ questions that match real Google searches about ${topic} for small businesses. Format EXACTLY like this — one Q then one A, blank line between each pair:

**Q:** Question here?
**A:** Detailed answer here. Minimum 3 sentences per answer.

**Q:** Next question?
**A:** Detailed answer here.

## Final Thoughts (minimum 150 words)
Summarize the key action items. Reinforce urgency without being dramatic. End with: [Start Your Free Business Assessment](https://nexvorasystems.us/assessment.html)

TONE RULES — follow these strictly:
- Write like a successful business operator talking to another operator
- Use "you" and "your business" throughout
- Specific numbers, specific business types, specific cities
- No long dashes or em dashes anywhere in the article
- Never use: "game-changer", "delve", "in today's landscape", "it's worth noting", "seamlessly", "leverage" as a verb, "robust"
- Short paragraphs — 3-4 sentences max per paragraph
- Optimized for Google featured snippets, AI search (ChatGPT, Perplexity, Claude), and voice search`;
}

function buildSupportPrompt(city, pillarTitle, pillarSlug, usedKeywords, index) {
  const avoidList = [...usedKeywords].slice(0, 20).join(', ');
  const author = index === 0 ? pillarFounder : 'Murat Zhandaurov';
  const pillarUrl = `https://nexvorasystems.us/posts/${pillarSlug}.html`;

  const angles = [
    `how ${city} service businesses are losing customers and revenue right now by not having ${topic} systems, with a practical fix`,
    `the specific ${topic} mistakes that keep ${city} small business owners working 60-hour weeks without growing, and how to stop`,
    `a step-by-step ${topic} setup built specifically for ${city} business owners who are ready to stop guessing and start growing`,
  ];
  const angle = angles[index % angles.length];

  return `You are a content writer for Nexvora Systems, a business consulting firm that helps small business owners in ${region.name} implement AI, automation, and operational systems.

Today: ${dateStr} | City: ${city}, ${region.state} | Topic: ${topic}
Article angle: ${angle}
Author: ${author}
${avoidList ? `\nDo NOT target these keyword angles (already published): ${avoidList}\n` : ''}
This is a SUPPORT article that links to the PILLAR article:
Pillar title: "${pillarTitle}"
Pillar URL: ${pillarUrl}

OUTPUT — write these header lines first, exactly as shown:
Title: [specific title: includes "${city}" and "${topic}", search-intent focused]
Meta Title: [under 60 chars, starts with ${city}]
Meta Description: [under 155 chars, mentions ${city}, includes keyword, has benefit hook]
Slug: [kebab-case, starts with city slug, includes topic keyword]
Primary Keyword: [one phrase that includes "${city}" and relates to ${topic}]
Secondary Keywords: [4 comma-separated related phrases including ${city}]
City: ${city}
Article Type: Support
Estimated Reading Time: [X min read]

WORD COUNT REQUIREMENT: This article MUST be between 1,400 and 1,800 words. Do not stop until you reach 1,400 words minimum. Every section has a minimum — hit it.

Write the full article using EXACTLY these sections. Each section must meet its minimum word count:

## Introduction (minimum 150 words)
Open with a specific, direct statement about the ${topic} problem facing small businesses in ${city}, ${region.state}. Name 2-3 specific business types common in ${city}. Explain what this article covers and what the reader will be able to do after reading it. Include this exact link naturally in the last paragraph: For a complete overview of ${topic} systems for ${region.name} businesses, read our full guide: [${pillarTitle}](${pillarUrl})

## Why ${city} Businesses Struggle With ${topic} (minimum 250 words)
Explain the specific reasons ${city} businesses have this problem. What is unique about ${city}'s business environment, industries, or market that makes this worse? Name real local business types. Give 2-3 specific scenarios. Use numbers.

## What It Is Costing ${city} Business Owners (minimum 200 words)
Break down the real cost — financial and operational — with specific numbers for ${city}-sized businesses. At least 1 blockquote:
> **The data:** [specific stat or calculation relevant to ${city} businesses]

## What the Fix Looks Like for a ${city} Business (minimum 250 words)
Describe exactly what a proper ${topic} system looks like for a business the size and type common in ${city}. Name specific tools. Explain what changes, what gets easier, what results appear in the first 30-60-90 days.

## Step-by-Step: Getting Started in ${city} (minimum 300 words)
Write a numbered action plan with at least 5 steps. Each step: what to do, how long it takes, what it costs, what to expect. Written as if talking directly to a ${city} business owner who is ready to act this week.

## How Nexvora Systems Works With ${city} Businesses (minimum 150 words)
Explain what Nexvora does specifically for businesses like those in ${city}. Mention ${author} once naturally. Include this exact link: [Start Your Free Business Assessment](https://nexvorasystems.us/assessment.html)

## Frequently Asked Questions
Write 4 FAQ questions specific to ${city} businesses and ${topic}. Format EXACTLY:

**Q:** Question specific to ${city}?
**A:** Detailed answer, minimum 2-3 sentences.

**Q:** Next question?
**A:** Detailed answer.

## Final Thoughts (minimum 100 words)
Short, direct close. Key takeaway. End with: [Start Your Free Business Assessment](https://nexvorasystems.us/assessment.html)
Also include: For the complete ${region.name} guide, read: [${pillarTitle}](${pillarUrl})

TONE RULES:
- Write directly to a ${city} business owner
- Specific numbers, specific business types, specific to ${city}
- No long dashes or em dashes
- Never use: "game-changer", "delve", "leverage" as verb, "robust", "seamlessly"
- Short paragraphs — 3-4 sentences max
- Optimized for local Google search, AI search tools, and voice search`;
}

function buildSEOReviewPrompt(articleText, articleType, minWords) {
  return `You are an expert SEO editor for Nexvora Systems (nexvorasystems.us).

You are reviewing a ${articleType} article about: ${topic} | Region: ${region.name}

CURRENT ARTICLE:
${articleText}

YOUR TASKS — improve and return the COMPLETE article:
1. Fix Meta Title: must be under 60 chars, primary keyword first
2. Fix Meta Description: under 155 chars, keyword + clear benefit hook
3. Remove AI-sounding phrases: game-changer, delve, in today's landscape, it's worth noting, seamlessly, robust, leverage (as verb)
4. Make all H2/H3 headings more specific and search-intent focused
5. Ensure FAQ questions match real searches people type into Google
6. Strengthen any weak paragraphs — add specifics, numbers, examples
7. Make tone more direct throughout — less corporate, more operator-to-operator
8. Verify all internal links are present and formatted correctly

STRICT OUTPUT RULES:
- Return the COMPLETE article — every section, every word
- Keep exact header format (Title:, Meta Title:, Meta Description:, Slug:, Primary Keyword:, Secondary Keywords:, City:, Article Type:, Estimated Reading Time:)
- Keep all ## headings exactly as written
- Keep all blockquotes (> **The data:**)
- Keep all FAQ pairs (**Q:** / **A:**)
- Keep all internal links exactly as written
- Do NOT cut content — the article must stay at or above ${minWords} words
- Do NOT add commentary before or after the article
- Do NOT add new sections`;
}

function buildImagePrompt(articleTitle, city) {
  const visuals = TOPIC_VISUALS[topic] || 'business analytics dashboard on laptop screen';
  const location = city ? `${city}, ${region.state}` : region.name;
  return `Professional corporate photography. Interior of a modern small business office in ${location}. A focused business owner or manager in their 30s-40s wearing business casual clothing, sitting at a clean wooden desk, looking at ${visuals}. Bright natural light from windows. Modern minimalist office decor. No clutter. Sharp focus on the person and screen. The mood is confident and productive. Wide landscape format 16:9. Photorealistic, editorial quality. Absolutely no outdoor scenes, no nature, no streets, no parks. No text overlays. No logos. No watermarks.`;
}

// ── SLUG + ESCAPE ─────────────────────────────────────────────────────────────
function makeSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── PARSE META FROM AI OUTPUT ─────────────────────────────────────────────────
function parseMeta(raw) {
  const get = key => { const m = raw.match(new RegExp(key + ':\\s*(.+)')); return m ? m[1].trim() : ''; };
  return {
    title:             get('Title'),
    metaTitle:         get('Meta Title') || get('Title'),
    metaDescription:   get('Meta Description'),
    slug:              get('Slug') || makeSlug(get('Title')),
    primaryKeyword:    get('Primary Keyword'),
    secondaryKeywords: get('Secondary Keywords'),
    readTime:          (get('Estimated Reading Time') || '8 min read').replace(/\*+/g, '').trim(),
    city:              get('City') || '',
    articleType:       get('Article Type') || 'Support',
  };
}

// ── HTML BUILDER ──────────────────────────────────────────────────────────────
function buildHTML(meta, bodyMarkdown, imagePath) {
  let cleaned = bodyMarkdown
    .replace(/\n+---+\n[\s\S]*$/m, '')
    .replace(/\n+\*?\*?10 SEO keywords[\s\S]*$/im, '')
    .replace(/\n+\*?\*?SEO keywords[\s\S]*$/im, '')
    .replace(/\n+\*?\*?Social media[\s\S]*$/im, '')
    .replace(/\n+\*?\*?LinkedIn post[\s\S]*$/im, '')
    .split('\n').filter(line => !/nexvorasystems\.us\/assessment/i.test(line) || line.includes('[')).join('\n');

  // FAQ formatting
  cleaned = cleaned.replace(
    /\*\*Q:\*\*\s*([^\n]+)\n\*\*A:\*\*\s*([^\n]+)/g,
    (_, q, a) => `<div class="faq-item"><p class="faq-q">Q: ${q.trim()}</p><p class="faq-a">A: ${a.trim()}</p></div>`
  );
  cleaned = cleaned.replace(
    /\*\*Q:\s*([^*\n]+?)\*\*\s*A:\s*([^*]+?)(?=\s*\*\*Q:|\n\n|$)/g,
    (_, q, a) => `<div class="faq-item"><p class="faq-q">Q: ${q.trim()}</p><p class="faq-a">A: ${a.trim()}</p></div>`
  );

  let html = cleaned
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
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

  const articleTypeBadge = meta.articleType === 'Pillar' ? topic + ' — Pillar' : topic;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-TY0PZHVN0L"></script>
<script>
  window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
  gtag('js',new Date());gtag('config','G-TY0PZHVN0L');
</script>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta name="description" content="${esc(meta.metaDescription)}"/>
<title>${esc(meta.metaTitle)}</title>
<link rel="canonical" href="https://nexvorasystems.us/posts/${meta.slug}.html"/>
<meta property="og:title" content="${esc(meta.metaTitle)}"/>
<meta property="og:description" content="${esc(meta.metaDescription)}"/>
<meta property="og:type" content="article"/>
<meta property="og:url" content="https://nexvorasystems.us/posts/${meta.slug}.html"/>
${imagePath ? `<meta property="og:image" content="https://nexvorasystems.us/${imagePath}"/>` : ''}
<meta name="keywords" content="${esc(meta.primaryKeyword)}${meta.secondaryKeywords ? ', '+esc(meta.secondaryKeywords) : ''}"/>
<meta name="author" content="${esc(meta.author)}"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{--bg:#FAF8F5;--bg-surface:#F0EDE8;--bg-card:#FFFFFF;--text:#1A1A2E;--muted:#4A5568;--dim:#718096;--border:#E2DDD5;--teal:#0D9488;--navy:#0F2B4C;--nav-h:76px;}
html,body{font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;background:var(--bg);color:var(--text);}
nav{position:fixed;top:0;left:0;right:0;z-index:200;height:var(--nav-h);display:flex;align-items:center;background:rgba(250,248,245,0.96);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);padding:0 28px;gap:20px;}
.nav-back{font-size:13px;color:var(--muted);text-decoration:none;display:flex;align-items:center;gap:5px;margin-left:auto;transition:color .15s;}
.nav-back:hover{color:var(--teal);}
.post-wrap{max-width:780px;margin:0 auto;padding:calc(var(--nav-h)+48px) 24px 80px;}
.post-meta{display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:8px;}
.post-tag{font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--teal);}
.post-date{font-size:12px;color:var(--dim);}
.post-read{font-size:12px;color:var(--dim);}
.post-author{display:flex;align-items:center;gap:12px;font-size:13px;color:var(--muted);font-weight:600;margin-bottom:28px;}
.post-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#0D9488,#0F2B4C);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;flex-shrink:0;}
h1{font-size:clamp(24px,4vw,36px);font-weight:800;line-height:1.25;margin-bottom:12px;color:var(--text);}
h2{font-size:20px;font-weight:700;margin:36px 0 14px;color:var(--text);}
h3{font-size:16px;font-weight:700;margin:24px 0 10px;color:var(--text);}
p{font-size:16px;line-height:1.8;color:var(--muted);margin-bottom:18px;}
ul,ol{padding-left:22px;margin-bottom:18px;}
li{font-size:16px;line-height:1.8;color:var(--muted);margin-bottom:6px;}
strong{color:var(--text);}
blockquote{background:var(--bg-surface);border-left:4px solid var(--teal);border-radius:0 10px 10px 0;padding:16px 20px;margin:24px 0;font-size:15px;color:var(--text);line-height:1.7;}
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
  <a href="/"><img src="../assets/Logo no background.png" alt="Nexvora Systems" style="height:44px;width:auto;display:block;" onerror="this.style.display='none'"/></a>
  <a href="/blog.html" class="nav-back">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    Back to Insights
  </a>
</nav>
<div class="post-wrap">
  <div class="post-meta">
    <span class="post-tag">${esc(articleTypeBadge)}</span>
    <span class="post-date">${meta.date}</span>
    <span class="post-read">${meta.readTime}</span>
  </div>
  <h1>${esc(meta.title)}</h1>
  <div class="post-author">
    <div class="post-avatar">${meta.author.split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
    <span>By <strong>${esc(meta.author)}</strong> · Nexvora Systems</span>
  </div>
  ${imagePath ? `<img src="../${imagePath}" alt="${esc(meta.imageAlt || meta.title)}" style="width:100%;border-radius:14px;margin-bottom:32px;object-fit:cover;max-height:420px;display:block;"/>` : ''}
  <div class="post-body">
    ${html}
  </div>
  <div class="post-cta">
    <h2>See How Your Business Scores</h2>
    <p>Take the free Nexvora Business Health Assessment and get a personalized report in under 5 minutes.</p>
    <a href="/assessment.html">Start Free Assessment</a>
  </div>
</div>
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"Article",
  "headline":"${esc(meta.title)}",
  "description":"${esc(meta.metaDescription)}",
  "author":{"@type":"Person","name":"${esc(meta.author)}","url":"https://nexvorasystems.us"},
  "publisher":{"@type":"Organization","name":"Nexvora Systems","logo":{"@type":"ImageObject","url":"https://nexvorasystems.us/assets/nexvora-logo.png"}},
  "datePublished":"${dateStr}",
  "dateModified":"${dateStr}",
  "url":"https://nexvorasystems.us/posts/${meta.slug}.html",
  "mainEntityOfPage":"https://nexvorasystems.us/posts/${meta.slug}.html"${imagePath ? `,"image":{"@type":"ImageObject","url":"https://nexvorasystems.us/${imagePath}"}` : ''}
}
</script>
<style>
#floatAssess{position:fixed;bottom:28px;right:28px;z-index:9000;display:flex;flex-direction:column;align-items:flex-end;gap:10px;}
#floatLabel{background:#0F2B4C;color:#fff;font-size:13px;font-weight:700;padding:9px 16px;border-radius:10px;white-space:nowrap;box-shadow:0 4px 18px rgba(0,0,0,0.18);opacity:0;transform:translateY(6px);transition:opacity .3s,transform .3s;pointer-events:none;}
#floatLabel.show{opacity:1;transform:translateY(0);}
#floatLink{display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:#0D9488;box-shadow:0 4px 20px rgba(13,148,136,0.45);text-decoration:none;animation:floatPulse 2.8s ease-in-out infinite;}
#floatLink:hover{background:#0b7a71;}
#floatLink img{width:30px;height:30px;object-fit:contain;filter:brightness(0) invert(1);}
@keyframes floatPulse{0%,100%{box-shadow:0 4px 20px rgba(13,148,136,0.45);background:#0D9488;}50%{box-shadow:0 4px 32px rgba(13,148,136,0.75),0 0 0 8px rgba(13,148,136,0.12);background:#0fb8a9;}}
</style>
<div id="floatAssess">
  <div id="floatLabel">Free Assessment</div>
  <a href="/assessment.html" id="floatLink" title="Free Assessment">
    <img src="../assets/Logo no background.png" alt="Nexvora"/>
  </a>
</div>
<script>
(function(){var l=document.getElementById('floatLabel');var s=false;function show(){if(!s){s=true;l.classList.add('show');setTimeout(function(){l.classList.remove('show');setTimeout(function(){s=false;},400);},3500);}}setTimeout(show,3000);setInterval(show,12000);})();
</script>
</body>
</html>`;
}

// ── BLOG INDEX UPDATE ─────────────────────────────────────────────────────────
const SERVICE_CATEGORY = {
  'AI & Automation':           'ai-automation',
  'Operations & Efficiency':   'operations',
  'Sales Systems':             'sales',
  'Reporting & Analytics':     'reporting',
  'Marketing & Lead Generation':'marketing',
  'Financial Efficiency':      'finance',
  'Customer Experience':       'revenue',
  'Growth & Scaling':          'growth',
};

function updateBlogIndex(entries) {
  const blogPath = path.join(__dirname, '..', 'blog.html');
  if (!fs.existsSync(blogPath)) return;
  let blog = fs.readFileSync(blogPath, 'utf8');
  const mark = '<!-- POSTS_START -->';
  if (!blog.includes(mark)) return;

  const newCards = entries.map(e => {
    const category = SERVICE_CATEGORY[e.service] || 'operations';
    const imgStyle = e.imagePath
      ? `background:url('../${e.imagePath}') center/cover no-repeat;`
      : `background:linear-gradient(135deg,rgba(13,148,136,0.12),rgba(15,43,76,0.08));`;
    const badge = e.articleType === 'Pillar' ? (e.service + ' — Pillar') : e.service;
    return `
      <a href="posts/${e.slug}.html" class="blog-card" data-category="${category}">
        <div class="blog-card-img" style="${imgStyle}"></div>
        <div class="blog-card-body">
          <p class="blog-card-cat">${esc(badge)}</p>
          <p class="blog-card-title">${esc(e.title)}</p>
          <p class="blog-card-meta">${e.date} · ${e.readTime}</p>
        </div>
      </a>`;
  }).join('\n');

  blog = blog.replace(mark, mark + '\n' + newCards);
  fs.writeFileSync(blogPath, blog);
  console.log('blog.html updated');
}

// ── SITEMAP UPDATE ────────────────────────────────────────────────────────────
function updateSitemap(entries) {
  const sitemapPath = path.join(__dirname, '..', 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) return;
  let sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const mark = '</urlset>';
  const newEntries = entries.map(e => `
  <url>
    <loc>https://nexvorasystems.us/posts/${e.slug}.html</loc>
    <lastmod>${dateStr}</lastmod>
    <changefreq>never</changefreq>
    <priority>${e.articleType === 'Pillar' ? '0.8' : '0.6'}</priority>
  </url>`).join('\n');
  sitemap = sitemap.replace(mark, newEntries + '\n' + mark);
  fs.writeFileSync(sitemapPath, sitemap);
  console.log('sitemap.xml updated');
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n=== Nexvora Blog Generator v2 ===');
  console.log(`Date: ${dateStr} | Region: ${region.name} | Topic: ${topic}`);
  console.log(`Pillar author: ${pillarFounder}\n`);

  // 1. Notion setup
  console.log('[Step 1] Setting up Notion database...');
  const dbId = await getOrCreateDB();

  // 2. Check history
  console.log('[Step 2] Loading article history from Notion...');
  const recentArticles = await getRecentArticles(dbId);
  console.log(`  Found ${recentArticles.length} past articles`);
  const usedKeywords = getUsedKeywords(recentArticles);

  // 3. Select cities
  console.log('[Step 3] Selecting cities (avoiding recent repeats)...');
  const [pillarCity, city1] = selectCities(region.cities, recentArticles, 2);
  const supportCities = [city1]; // TEST MODE: 1 support article only
  console.log(`  Pillar region: ${region.name}`);
  console.log(`  Support cities: ${supportCities.join(', ')}`);

  // Dirs
  const postsDir  = path.join(__dirname, '..', 'posts');
  const assetsDir = path.join(__dirname, '..', 'assets', 'blog');
  if (!fs.existsSync(postsDir))  fs.mkdirSync(postsDir,  { recursive: true });
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  const written      = [];
  const notionPages  = [];

  // ── PILLAR ────────────────────────────────────────────────────────────────
  console.log('\n[Step 4] Writing pillar article with Claude Sonnet...');
  let pillarRaw;
  try {
    pillarRaw = await callClaude(buildPillarPrompt(region.cities, usedKeywords), 12000);
  } catch(err) {
    console.error('Claude pillar error:', err.message);
    process.exit(1);
  }
  console.log(`  Pillar word count: ${pillarRaw.split(/\s+/).length}`);

  console.log('[Step 5] GPT-4o SEO review of pillar...');
  try {
    pillarRaw = await callGPT(buildSEOReviewPrompt(pillarRaw, 'pillar', 3200), 8000);
  } catch(err) {
    console.warn('GPT review failed, using Claude output:', err.message);
  }

  const pillarMeta = parseMeta(pillarRaw);
  if (!pillarMeta.title) {
    console.error('Could not parse pillar meta. Saving debug file.');
    fs.writeFileSync('debug-pillar.txt', pillarRaw);
    process.exit(1);
  }

  console.log('[Step 6] Generating Flux 1.1 Pro image for pillar...');
  let pillarImgPath = null;
  const pillarImgUrl = await generateFluxImage(buildImagePrompt(pillarMeta.title, ''));
  if (pillarImgUrl) {
    const f = `assets/blog/${pillarMeta.slug}.jpg`;
    const ok = await downloadImage(pillarImgUrl, path.join(__dirname, '..', f));
    if (ok) { pillarImgPath = f; console.log('  Saved:', f); }
  }

  pillarMeta.service     = topic;
  pillarMeta.author      = pillarFounder;
  pillarMeta.date        = new Date(dateStr).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  pillarMeta.region      = region.name;
  pillarMeta.city        = region.name;
  pillarMeta.topic       = topic;
  pillarMeta.articleType = 'Pillar';
  pillarMeta.imagePath   = pillarImgPath;
  pillarMeta.imageFile   = pillarImgPath ? path.basename(pillarImgPath) : '';
  pillarMeta.imageAlt    = `${topic} systems for ${region.name} small businesses`;
  pillarMeta.wordCount   = pillarRaw.split(/\s+/).length;

  const pillarBodyStart = pillarRaw.indexOf('## ');
  const pillarBody = pillarBodyStart >= 0 ? pillarRaw.slice(pillarBodyStart) : pillarRaw;
  fs.writeFileSync(path.join(postsDir, pillarMeta.slug + '.html'), buildHTML(pillarMeta, pillarBody, pillarImgPath));
  console.log(`  Pillar published: ${pillarMeta.slug}.html`);

  const pillarNotionId = await saveToNotion(dbId, pillarMeta);
  notionPages.push({ id: pillarNotionId, slug: pillarMeta.slug });
  written.push(pillarMeta);
  usedKeywords.add(pillarMeta.primaryKeyword?.toLowerCase());

  // ── SUPPORT ARTICLES ──────────────────────────────────────────────────────
  for (let i = 0; i < supportCities.length; i++) {
    const city = supportCities[i];
    console.log(`\n[Step 7.${i+1}] Writing support article for ${city}...`);

    let suppRaw;
    try {
      suppRaw = await callClaude(buildSupportPrompt(city, pillarMeta.title, pillarMeta.slug, usedKeywords, i), 6000);
    } catch(err) {
      console.error(`Claude support ${i+1} error:`, err.message);
      continue;
    }
    console.log(`  Support word count: ${suppRaw.split(/\s+/).length}`);

    console.log(`  GPT-4o SEO review for ${city}...`);
    try {
      suppRaw = await callGPT(buildSEOReviewPrompt(suppRaw, 'support', 1400), 4000);
    } catch(err) {
      console.warn('GPT review failed, using Claude output:', err.message);
    }

    const suppMeta = parseMeta(suppRaw);
    if (!suppMeta.title) {
      console.warn(`  Could not parse support ${i+1} meta. Skipping.`);
      fs.writeFileSync(`debug-support-${i}.txt`, suppRaw);
      continue;
    }

    console.log(`  Generating Flux image for ${city}...`);
    let suppImgPath = null;
    const suppImgUrl = await generateFluxImage(buildImagePrompt(suppMeta.title, city));
    if (suppImgUrl) {
      const f = `assets/blog/${suppMeta.slug}.jpg`;
      const ok = await downloadImage(suppImgUrl, path.join(__dirname, '..', f));
      if (ok) { suppImgPath = f; console.log('  Saved:', f); }
    }

    suppMeta.service     = topic;
    suppMeta.author      = i === 0 ? pillarFounder : 'Murat Zhandaurov';
    suppMeta.date        = new Date(dateStr).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
    suppMeta.region      = region.name;
    suppMeta.city        = city;
    suppMeta.topic       = topic;
    suppMeta.articleType = 'Support';
    suppMeta.imagePath   = suppImgPath;
    suppMeta.imageFile   = suppImgPath ? path.basename(suppImgPath) : '';
    suppMeta.imageAlt    = `${topic} for small businesses in ${city}, ${region.state}`;
    suppMeta.wordCount   = suppRaw.split(/\s+/).length;

    const suppBodyStart = suppRaw.indexOf('## ');
    const suppBody = suppBodyStart >= 0 ? suppRaw.slice(suppBodyStart) : suppRaw;
    fs.writeFileSync(path.join(postsDir, suppMeta.slug + '.html'), buildHTML(suppMeta, suppBody, suppImgPath));
    console.log(`  Support published: ${suppMeta.slug}.html`);

    const suppNotionId = await saveToNotion(dbId, suppMeta, pillarMeta.title);
    notionPages.push({ id: suppNotionId, slug: suppMeta.slug });
    written.push(suppMeta);
    usedKeywords.add(suppMeta.primaryKeyword?.toLowerCase());
  }

  // ── REPLACE SUPPORT LINK PLACEHOLDERS IN PILLAR ───────────────────────────
  const supportArticles = written.filter(a => a.articleType === 'Support');
  if (supportArticles.length > 0) {
    console.log('\n[Step 7.4] Updating pillar with real support article links...');
    const pillarFilePath = path.join(postsDir, pillarMeta.slug + '.html');
    let pillarHtml = fs.readFileSync(pillarFilePath, 'utf8');
    supportArticles.forEach((supp, i) => {
      const placeholder = `[SUPPORT_LINK_${i + 1}]`;
      const realLink = `<a href="/posts/${supp.slug}.html">${esc(supp.title)}</a>`;
      pillarHtml = pillarHtml.split(placeholder).join(realLink);
    });
    // Clear any unused placeholders
    pillarHtml = pillarHtml.replace(/\[SUPPORT_LINK_\d+\]/g, '');
    fs.writeFileSync(pillarFilePath, pillarHtml);
    console.log(`  Pillar links updated: ${supportArticles.length} support articles linked`);
  }

  // ── FINALIZE ──────────────────────────────────────────────────────────────
  console.log('\n[Step 8] Updating blog.html and sitemap.xml...');
  updateBlogIndex(written);
  updateSitemap(written);

  console.log('[Step 9] Marking all articles as Published in Notion...');
  for (const { id, slug } of notionPages) {
    await markPublished(id, `https://nexvorasystems.us/posts/${slug}.html`);
    console.log(`  Marked: ${slug}`);
  }

  console.log(`\n=== Done: ${written.length} article(s) published ===`);
  written.forEach(a => console.log(`  [${a.articleType}] ${a.title}`));
})().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
