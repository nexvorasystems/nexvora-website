#!/usr/bin/env node
/**
 * One-time fix script: add images to all posts, fix FAQ CSS, remove metadata leaks.
 * Run: OPENAI_API_KEY=... node scripts/fix-all-posts.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) { console.error('Missing OPENAI_API_KEY'); process.exit(1); }

const ROOT     = path.join(__dirname, '..');
const POSTS    = path.join(ROOT, 'posts');
const IMG_DIR  = path.join(ROOT, 'assets', 'blog');
if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

const FAQ_CSS = `.faq-item{border:1px solid var(--border);border-radius:12px;padding:20px 24px;margin-bottom:14px;background:var(--bg-card);}
.faq-q{font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px;}
.faq-a{font-size:15px;color:var(--muted);line-height:1.7;margin:0;}`;

// Per-slug image prompts: diverse person + topic + neutral professional attire.
// Distribution across all 13 posts: 6M/7F, ~3-4 each of white/Asian/Black/Latino.
// No religious symbols, no political symbols, no revealing clothing.
const SLUG_PROMPTS = {
  'operations-consulting-tampa-bay':          'Professional photo of a white male business consultant in neutral business casual attire reviewing workflow charts on a laptop at a modern Florida office desk, natural lighting, realistic photography, no religious symbols, no text on screen',
  'sales-systems-southwest-florida':          'Professional photo of a Black female sales professional in smart business casual reviewing a sales pipeline on a laptop screen in a bright modern Florida office, natural lighting, realistic photography, no religious symbols, no text on screen',
  '** reporting-analytics-southwest-florida': 'Professional photo of an Asian male business analyst in smart casual attire studying analytics charts on a monitor in a modern Florida office, natural lighting, realistic photography, no religious symbols, no text on screen',
  'reporting-analytics-southwest-florida':    'Professional photo of an Asian female data analyst in business casual attire reviewing performance dashboards on dual monitors in a modern Florida office, natural lighting, realistic photography, no religious symbols, no text on screen',
  'reporting-analytics-sw-florida-business':  'Professional photo of a white male entrepreneur in business casual studying reports on a laptop at a clean modern Florida office desk, natural lighting, realistic photography, no religious symbols, no text on screen',
  'ai-business-growth-florida-ai':            'Professional photo of a Black female tech consultant in smart business casual exploring an AI software dashboard on a laptop in a modern Florida office, natural lighting, realistic photography, no religious symbols, no text on screen',
  'ai-business-growth-southwest-florida-ai':  'Professional photo of a white female business owner in professional attire working on a laptop with a modern AI dashboard in a bright Florida office, natural light, realistic photography, no religious symbols, no text on screen',
  'ai-business-southwest-florida-ai':         'Professional photo of a Latino male entrepreneur in business casual attire working on an automation tool on a laptop in a modern sunny Florida office, natural lighting, realistic photography, no religious symbols, no text on screen',
  'ai-southwest-florida-business-ai':         'Professional photo of an Asian male business owner in smart casual attire typing on a laptop in a clean modern Florida office workspace, natural lighting, realistic photography, no religious symbols, no text on screen',
  'revenue-leaks':                            'Professional photo of a Black female business consultant in professional attire reviewing financial reports on a laptop at a tidy modern Florida office desk, natural lighting, realistic photography, no religious symbols, no text on screen',
  'tampa-cash-flow':                          'Professional photo of a Latino male accountant in smart business casual reviewing cash flow spreadsheets on a laptop in a clean modern Florida office, natural lighting, realistic photography, no religious symbols, no text on screen',
  'tampa-revenue-leaks':                      'Professional photo of an Asian female business advisor in business casual attire reviewing revenue charts on a laptop in a professional modern Florida office, natural lighting, realistic photography, no religious symbols, no text on screen',
  'tampa-team-accountability':                'Professional photo of a white female business manager in professional attire leading a meeting discussion at a modern Florida office conference table, natural lighting, realistic photography, no religious symbols, no text on screen',
};

// Slug → service (kept for reference but SLUG_PROMPTS takes priority)
const SLUG_SERVICE = {
  'tampa-cash-flow':                          'Financial Efficiency',
  'tampa-revenue-leaks':                      'Operations',
  'tampa-team-accountability':                'Team & HR',
  'revenue-leaks':                            'Operations',
  'ai-business-growth-southwest-florida-ai':  'AI & Automation',
  'ai-southwest-florida-business-ai':         'AI & Automation',
  'ai-business-growth-florida-ai':            'AI & Automation',
  'ai-business-southwest-florida-ai':         'AI & Automation',
  'reporting-analytics-southwest-florida':    'Reporting & Analytics',
  'reporting-analytics-sw-florida-business':  'Reporting & Analytics',
  '** reporting-analytics-southwest-florida': 'Reporting & Analytics',
};

function generateImage(prompt) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: 'dall-e-3', prompt, n: 1,
      size: '1792x1024', quality: 'standard', response_format: 'url'
    });
    const req = https.request({
      hostname: 'api.openai.com', path: '/v1/images/generations', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENAI_API_KEY, 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d).data[0].url); }
        catch(e) { console.error('DALL-E error:', d.slice(0, 200)); resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write(body); req.end();
  });
}

function downloadImage(url, dest) {
  return new Promise(resolve => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(true); });
    }).on('error', () => { fs.unlink(dest, () => {}); resolve(false); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const files = fs.readdirSync(POSTS).filter(f => f.endsWith('.html'));

  for (const file of files) {
    const slug = file.replace('.html', '');
    const fp   = path.join(POSTS, file);
    let html   = fs.readFileSync(fp, 'utf8');
    let changed = false;
    console.log('\n── ' + file);

    // 1. Remove SEO/metadata junk that leaked into post body
    if (html.includes('10 SEO keywords') || html.includes('<p>---</p>')) {
      // Remove from the <p>---</p> or <p>10 SEO block to the closing post-body div
      html = html
        .replace(/<p>-{3,}<\/p>[\s\S]*?(<\/div>\s*<div class="post-cta">)/, '$1')
        .replace(/<p>10 SEO keywords[\s\S]*?(<\/div>\s*<div class="post-cta">)/, '$1');
      // Fix broken markdown link that may remain in Final Thoughts
      html = html.replace(
        /\[nexvorasystems\.us\/assessment\.html\]\(https?:\/\/nexvorasystems\.us\/assessment\.html\)/g,
        '<a href="../assessment.html">Start Free Assessment</a>'
      );
      console.log('  ✓ Removed metadata leak');
      changed = true;
    }

    // 2. Add FAQ CSS if faq-item divs exist but CSS is missing
    if (html.includes('class="faq-item"') && !html.includes('.faq-item{')) {
      html = html.replace('</style>', FAQ_CSS + '\n</style>');
      console.log('  ✓ Added FAQ CSS');
      changed = true;
    }

    // 3. Generate and embed hero image (force regenerate ALL with new diverse prompts)
    const imgFile = 'assets/blog/' + slug + '.jpg';
    const imgDest = path.join(ROOT, imgFile);
    const prompt  = SLUG_PROMPTS[slug];

    if (prompt) {
      console.log('  Generating DALL-E image...');
      const imgUrl = await generateImage(prompt);
      if (imgUrl) {
        const ok = await downloadImage(imgUrl, imgDest);
        if (ok) {
          console.log('  ✓ Image saved: ' + imgFile);
          // Remove old img tag if present, then add new one
          html = html.replace(/<img src="\.\.\/assets\/blog\/[^"]+\.jpg"[^>]*\/>\n?/g, '');
          const imgTag = '<img src="../' + imgFile + '" alt="" style="width:100%;border-radius:14px;margin-bottom:32px;object-fit:cover;max-height:420px;display:block;"/>';
          html = html.replace('  <div class="post-body">', '  ' + imgTag + '\n  <div class="post-body">');
          changed = true;
        } else {
          console.log('  ✗ Image download failed');
        }
      } else {
        console.log('  ✗ DALL-E generation failed');
      }
      await sleep(800);
    } else {
      console.log('  SKIP — no prompt defined for this slug');
    }

    if (changed) {
      fs.writeFileSync(fp, html);
      console.log('  ✓ Saved: ' + file);
    } else {
      console.log('  No changes needed');
    }
  }

  // 4. Update blog.html card images
  console.log('\n── Updating blog.html card images...');
  const blogPath = path.join(ROOT, 'blog.html');
  let blog = fs.readFileSync(blogPath, 'utf8');
  let blogChanged = false;

  const allSlugs = [
    ...Object.keys(SLUG_SERVICE),
    'operations-consulting-tampa-bay',
    'sales-systems-southwest-florida'
  ];

  for (const slug of allSlugs) {
    const imgFile = 'assets/blog/' + slug + '.jpg';
    if (!fs.existsSync(path.join(ROOT, imgFile))) continue;

    // Match the blog-card for this slug and replace the gradient with the image
    const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cardRe = new RegExp(
      '(href="posts/' + escapedSlug + '\\.html"[\\s\\S]*?blog-card-img" style=")[^"]*(")',
      'g'
    );
    const updated = blog.replace(cardRe, '$1background:url(\'' + imgFile + '\') center/cover no-repeat;$2');
    if (updated !== blog) {
      blog = updated;
      blogChanged = true;
      console.log('  ✓ Updated card: ' + slug);
    }
  }

  if (blogChanged) {
    fs.writeFileSync(blogPath, blog);
    console.log('  ✓ blog.html saved');
  }

  console.log('\n✓ All done!');
})();
