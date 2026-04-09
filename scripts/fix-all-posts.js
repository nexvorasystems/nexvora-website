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

const IMAGE_PROMPTS = {
  'Operations':            'Professional photo of a small business owner reviewing workflow checklists and process charts in a modern Florida office, natural lighting, realistic photography, no text',
  'AI & Automation':       'Business owner at a clean desk reviewing AI automation dashboard on laptop, modern Florida office with natural light, realistic photography, no text overlays',
  'Reporting & Analytics': 'Entrepreneur analyzing business performance charts on multiple screens in a professional Florida office, natural lighting, realistic photography, no text',
  'Sales Systems':         'Small business sales team reviewing customer pipeline on a screen in a modern Florida office, professional photography, natural light, no text',
  'Financial Efficiency':  'Business owner reviewing financial statements and cash flow reports at a clean desk in a professional Florida office, realistic photography, no text',
  'Team & HR':             'Small business team in collaborative meeting in a modern Florida office, diverse professionals, natural light, realistic photography, no text',
};

// Slug → service (for image prompt selection)
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

    // 3. Generate and embed hero image if missing
    const imgFile = 'assets/blog/' + slug + '.jpg';
    const imgDest = path.join(ROOT, imgFile);
    const hasImg  = html.includes('assets/blog/');

    if (!hasImg && SLUG_SERVICE[slug]) {
      const service = SLUG_SERVICE[slug];
      console.log('  Generating DALL-E image (' + service + ')...');
      const imgUrl = await generateImage(IMAGE_PROMPTS[service]);
      if (imgUrl) {
        const ok = await downloadImage(imgUrl, imgDest);
        if (ok) {
          console.log('  ✓ Image saved: ' + imgFile);
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
    } else if (!hasImg) {
      console.log('  SKIP image — no service mapping for this slug');
    } else {
      console.log('  Already has image');
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
