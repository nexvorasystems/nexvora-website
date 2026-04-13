#!/usr/bin/env node
/**
 * One-time setup: creates Nexvora Blog History database in Notion.
 * Run once locally: NOTION_API_KEY=secret_xxx NOTION_PARENT_PAGE_ID=xxx node scripts/setup-notion.js
 */

const https = require('https');

const NOTION_API_KEY        = process.env.NOTION_API_KEY;
const NOTION_PARENT_PAGE_ID = (process.env.NOTION_PARENT_PAGE_ID || '').replace(/-/g, '');

if (!NOTION_API_KEY || !NOTION_PARENT_PAGE_ID) {
  console.error('Usage: NOTION_API_KEY=secret_xxx NOTION_PARENT_PAGE_ID=xxx node scripts/setup-notion.js');
  process.exit(1);
}

const TOPICS = [
  'AI & Automation','Operations & Efficiency','Sales Systems',
  'Reporting & Analytics','Marketing & Lead Generation',
  'Financial Efficiency','Customer Experience','Growth & Scaling',
];

function notionReq(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const req = https.request({
      hostname: 'api.notion.com',
      path: '/v1' + endpoint,
      method,
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

(async () => {
  console.log('Checking Notion connection...');

  // Test connection
  const test = await notionReq('GET', `/pages/${NOTION_PARENT_PAGE_ID}`);
  if (test.status !== 200) {
    console.error('Cannot access Notion page. Error:', JSON.stringify(test.body).slice(0, 300));
    console.error('\nMake sure your Notion integration is connected to the page:');
    console.error('Page → ... → Connections → Connect to → your integration');
    process.exit(1);
  }
  console.log('Notion connection OK');

  // Check if DB already exists
  const search = await notionReq('POST', '/search', {
    query: 'Nexvora Blog History',
    filter: { value: 'database', property: 'object' }
  });
  const existing = (search.body.results || []).find(r =>
    r.object === 'database' && r.title?.[0]?.plain_text === 'Nexvora Blog History'
  );
  if (existing) {
    console.log('Database already exists:', existing.id);
    console.log('URL:', `https://notion.so/${existing.id.replace(/-/g,'')}`);
    return;
  }

  console.log('Creating Nexvora Blog History database...');
  const db = await notionReq('POST', '/databases', {
    parent: { type: 'page_id', page_id: NOTION_PARENT_PAGE_ID },
    title: [{ type: 'text', text: { content: 'Nexvora Blog History' } }],
    properties: {
      'Title':              { title: {} },
      'Date':               { date: {} },
      'Region':             { select: { options: [
        { name: 'Florida',             color: 'blue'   },
        { name: 'Southern California', color: 'orange' },
        { name: 'Washington State',    color: 'green'  },
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

  if (db.status !== 200 || !db.body.id) {
    console.error('Failed to create database:', JSON.stringify(db.body).slice(0, 400));
    process.exit(1);
  }

  console.log('\nDatabase created successfully!');
  console.log('Database ID:', db.body.id);
  console.log('URL:', `https://notion.so/${db.body.id.replace(/-/g,'')}`);
  console.log('\nYou can now trigger the GitHub Actions workflow to generate posts.');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
