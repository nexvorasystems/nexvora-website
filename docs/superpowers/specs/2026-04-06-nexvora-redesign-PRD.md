# Nexvora Systems — Complete Website Redesign PRD
**The Nexvora Falcon System**

> **Version:** 2.0 | **Date:** April 6, 2026 | **Author:** Nexvora × Claude (20yr UI/UX Engineer Perspective)
> **Previous version archived as:** `old_april5` references in each file

---

## Executive Summary

Nexvora Systems is rebuilding its website from the ground up as a **high-conversion lead funnel** with a premium brand identity called **The Nexvora Falcon System**. The redesign combines the dark space aesthetic (built April 5, 2026) with a new light cream intelligence palette, 7 switchable color themes, a geometric falcon mascot with animated micro-interactions, and a fully functional assessment-to-lead pipeline.

**Primary Goal:** Every visitor takes the Free Assessment → becomes a qualified lead → books a strategy call.

**Secondary Goal:** The site must feel like it belongs next to McKinsey, Stripe, and Linear — not next to a freelance consultant template.

---

## 1. Brand Identity: The Nexvora Falcon System

### The Falcon Concept
The falcon is Nexvora's visual mascot and animation character:
- **What it represents:** Speed of diagnosis, aerial overview of business operations, precision targeting of problems, automation intelligence
- **Visual style:** Geometric low-poly / polygonal SVG — same visual language as the logo's crystalline "N" facets
- **Color:** Built in teal/navy from the brand palette — adapts to active theme
- **The tagline extension:** "The Nexvora Falcon System — We See What You Can't"

### Falcon Usage Across the Site
| Context | Animation |
|---|---|
| Hero section | Large falcon SVG, slowly rotating/floating above the geometric network |
| Nav logo | Tiny falcon mark beside the wordmark |
| Button click | Falcon icon briefly flaps wings (CSS keyframe, 0.4s) |
| Assessment start | Falcon swoops in from top-right as overlay opens |
| Analysis phase | Falcon circles as "scanning" animation |
| Assessment complete | Falcon lands, folds wings — "scan complete" |
| Page load | Falcon traces path onto screen (SVG path animation) |
| Hover on service cards | Falcon icon appears in corner, tilts head |
| 404 page | Falcon perched, looking confused |

### Geometric Falcon SVG Specification
```
Style: Low-poly, 8-12 polygon facets
Size variants: 16px (favicon) | 32px (nav) | 64px (button/icon) | 200px (hero) | 400px (full-page states)
Colors: Primary teal #0D9488 fill, Navy #0F2B4C stroke, Gold #C9A84C accent feather tips
Animation: CSS keyframes only (no heavy libraries) — performant at 60fps
Format: Inline SVG for animatability, exported PNG for favicon
```

---

## 2. Color System: 7 Themes

### Theme Architecture
- CSS custom properties on `<html data-theme="X">`
- Default loads from `localStorage` preference
- Theme switcher available on all pages (not just homepage)
- Each theme defines: backgrounds, primary, accent, text, borders, gradients, shadows

### Theme 1: Cream Intelligence (NEW DEFAULT — Light)
*The primary brand experience. Inspired by McKinsey, Stripe, premium consulting firms.*
```
--bg-primary:    #FAF8F5   (cream — warm off-white)
--bg-secondary:  #F0EDE8   (warm gray — cards, sections)
--bg-tertiary:   #E8E4DE   (sand — testimonials, proofs)
--bg-dark:       #0F2B4C   (deep navy — hero, footer accents)
--primary:       #0F2B4C   (deep navy — headings, text)
--primary-light: #1E3A5F   (slate blue — secondary elements)
--accent:        #0D9488   (bold teal — CTAs, links, accents)
--accent-hover:  #0A7B71   (dark teal — hover states)
--text-primary:  #1A1A2E   (near-black navy — body text)
--text-secondary:#4A5568   (warm dark gray)
--text-muted:    #718096   (medium gray)
--border:        #E2DDD5   (warm subtle border)
--gradient-hero: linear-gradient(135deg, #0F2B4C, #1E3A5F)
```

### Theme 2: Midnight Space (KEEP — Dark, previous default)
*The original space-premium dark aesthetic built April 5.*
```
--bg-primary:    #05080f   (deep space black)
--bg-secondary:  #080d1a   (navy surface)
--primary:       #ffffff   (white headings)
--accent:        #44caa2   (logo teal)
--text-primary:  rgba(255,255,255,0.93)
(Full tokens in global.css :root)
```

### Theme 3: Apple Light
*Apple.com marketing design language — pure clean light.*
```
--bg-primary:    #FBFBFD   (Apple's exact near-white)
--bg-secondary:  #F5F5F7   (Apple secondary gray)
--primary:       #1D1D1F   (Apple near-black text)
--accent:        #007AFF   (Apple system blue)
--accent-hover:  #0066CC   (Apple link blue)
--text-primary:  #1D1D1F
--text-secondary:#6E6E73   (Apple secondary)
--border:        #D2D2D7   (Apple divider)
```

### Theme 4: Apple Dark
*Apple dark mode — maximum contrast, ultra-premium.*
```
--bg-primary:    #000000   (pure black)
--bg-secondary:  #1C1C1E   (Apple dark secondary)
--primary:       #F5F5F7   (near-white)
--accent:        #0A84FF   (Apple dark blue)
--text-primary:  rgba(255,255,255,0.95)
--text-secondary:#98989D   (Apple dark secondary)
--border:        rgba(255,255,255,0.16)
```

### Theme 5: Falcon Carbon
*Dark tech-forward — for the data-driven operator persona.*
```
--bg-primary:    #141920   (dark carbon)
--bg-secondary:  #1E2530   (slightly lighter carbon)
--primary:       #E8F4F8   (ice white)
--accent:        #0D9488   (teal — same as Cream Intelligence)
--text-primary:  rgba(232,244,248,0.92)
--border:        rgba(13,148,136,0.2)   (teal border glow)
```

### Theme 6: Forest Sovereign
*Deep forest green — premium, nature-intelligence aesthetic.*
```
--bg-primary:    #0A1F15   (deep forest)
--bg-secondary:  #0F2B1E   (forest card)
--primary:       #FAF8F5   (cream text)
--accent:        #14B8A6   (bright teal)
--text-primary:  rgba(250,248,245,0.93)
--border:        rgba(20,184,166,0.18)
```

### Theme 7: Falcon Titanium
*Light, warm, amber-accented — premium handcrafted feel.*
```
--bg-primary:    #F8F7F4   (warm titanium white)
--bg-secondary:  #EEEAE4   (titanium card)
--primary:       #1A2332   (dark slate)
--accent:        #D97706   (amber — speed, energy)
--accent-hover:  #B45309   (dark amber)
--text-primary:  #1A2332
--text-secondary:#64748B
--border:        #DDD9D3
```

---

## 3. Page Architecture & Funnel Design

### Funnel Philosophy
Every page is a stage in the funnel. No page is a dead end.

```
AWARENESS → INTEREST → CONSIDERATION → ACTION → CONFIRMATION → NURTURE
  (Any page)   (Homepage)  (Services/About)  (Assessment)  (Report)     (Email/Blog)
```

### Navigation Structure
```
[Falcon Mark + NEXVORA SYSTEMS] ────── About | Services | Insights | Contact ────── [Start Free Assessment →]
```
- CTA button: teal on all themes, slightly larger than current (`padding: 10px 22px`)
- Active page: underline indicator (teal, 2px, animated in)
- Scroll behavior: transparent → glass blur at 30px scroll

### Homepage Architecture (Conversion-First)
```
01. HERO ─────────────── Full viewport
    - Geometric Falcon floating above crystalline network canvas
    - Headline: "We see the gaps that cost your business $2.4M a year"
    - Subhead: "The Nexvora Falcon System scans your operations in 10 minutes"
    - Primary CTA: [Start Free Scan →] | Secondary: [See How It Works ↓]
    - Social proof strip below fold (avatars + "500+ businesses scanned")

02. PROBLEM BAND ─────── 100px padding
    - 3-metric counter: $2.4M avg loss | 67% underperforming | 10 min to clarity
    - Trust logos strip below

03. HOW IT WORKS ──────── 104px padding
    - 3 steps: Scan → Report → Strategy
    - Animated falcon icon moves through the 3 steps on scroll

04. SERVICES PREVIEW ──── 104px padding
    - 6 service cards with animated falcon-themed icons
    - Each card: icon animates on hover (tilt, glow)

05. PROOF / TRUST ──────── 104px padding  [NEW SECTION]
    - Placeholder for real testimonials (3 card layout)
    - "What business owners say after their scan"
    - Until real testimonials exist: stat-based proof ("8 operational dimensions analyzed")

06. WHY NEXVORA ──────── 104px padding
    - Left: visual health scan bars (existing)
    - Right: 3 value props with icon boxes

07. ASSESSMENT CTA ────── 104px padding
    - Large gradient card
    - Falcon centered above the CTA card, glowing
    - Checklist of 4 facts
    - [Start Your Free Scan →]

08. FOOTER ────────────── Dark navy band
```

### Assessment Page Architecture (Funnel Core)
```
HERO: "The Falcon Scan — 10 Minutes to Total Clarity"
  - Falcon animation enters hero as overlay opens
  - 5 phases (existing structure, redesigned):

PHASE 1: Identity
  - Name, Company, Email, Phone, City, State
  - "Your report will be personalized to [Company]"

PHASE 2: The Scan (Chat)
  - 15 questions, animated falcon "thinking" during typing delay
  - Progress ring (not just a bar)
  - Questions weighted and stored for real scoring

PHASE 3: Falcon Analysis
  - Falcon "scanning" circle animation  
  - 4 checklist items animate in sequence
  - REAL scoring: calculate from weighted answer keywords

PHASE 4: Reveal
  - "The Falcon has landed. Here's what we found."
  - Critical / Warning / Good counters

PHASE 5: Report Wizard
  - 8 slides + conclusion (existing structure)
  - Scoring based on ACTUAL keywords in answers, not random
  - Lead data sent to GHL webhook on Phase 1 completion
```

---

## 4. Animation System: 2026 Specification

### Philosophy
Animations should feel like they have **weight and intention** — not decorative. Every animation tells the user something.

### Animation Categories

#### 4.1 Entrance Animations (Scroll-Triggered)
```
Fade Up:       opacity 0→1, translateY 24px→0, duration 0.65s, ease-out-expo
Fade Left:     opacity 0→1, translateX -32px→0, duration 0.6s, ease-out-expo  [text blocks]
Fade Right:    opacity 0→1, translateX 32px→0, duration 0.6s, ease-out-expo   [images/visuals]
Stagger Grid:  children animate in sequence, 80ms delay between each
Scale Pop:     scale 0.85→1, opacity 0→1, duration 0.5s, spring easing        [cards, icons]
```

#### 4.2 Micro-Interactions (User-Triggered)
```
Button Press:
  - scale 0.97 on :active (instant)
  - teal glow shadow expands on :hover (0.2s)
  - Falcon icon flaps wings if present (0.4s keyframe)
  
Input Focus:
  - border-color transition to accent (0.2s)
  - subtle glow shadow appears (0.25s)
  - label floats up for floating-label inputs

Card Hover:
  - translateY -4px (0.25s)
  - border-color to accent teal (0.25s)
  - top accent line reveals (0.3s scaleX)
  - box-shadow deepens (0.25s)

Nav Link Hover:
  - color transition white/navy (0.2s)
  - teal underline slides in from left (0.25s scaleX)
```

#### 4.3 Page Transitions (Navigation)
```
Exit: page content fades out + slides 8px left (0.2s)
Enter: new page content fades in + slides from 8px right (0.3s)
Falcon: briefly swoops across screen during transition (optional enhancement)
Implementation: CSS classes toggled on <body> by JS router listener
```

#### 4.4 Falcon-Specific Animations
```
falconFloat:     translateY ±12px, rotate ±2deg, 6s ease-in-out infinite
falconFlap:      wing scale Y 1→0.3→1, 0.15s × 2 repetitions, on button click
falconSweep:     enter from off-screen right, decelerate to position, 0.8s
falconScan:      circular rotation at 8rpm while analysis runs
falconLand:      drop from above + bounce settle, 0.6s spring
falconPath:      SVG stroke-dashoffset animation reveals outline, 1.2s
```

#### 4.5 Hero Background (Three.js — Enhanced)
```
Keep: crystalline node network from April 5 build
Add: Falcon SVG overlaid on canvas (not in Three.js, HTML overlay)
Enhance: Gold-colored nodes (logo gold #C9A84C) mixed with teal
Light theme: reduce node opacity to 0.3, use navy nodes on cream background
```

#### 4.6 Number Counters
```
Trigger: IntersectionObserver at 30% viewport
Duration: 1600ms cubic ease-out
Format: handle decimals (2.4), handle integers, handle % suffix
Prefix/suffix: $, M, % added after animation
```

---

## 5. Typography System

### Font Stack (Enhanced)
```css
Primary: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif
Fallback: system stack (current)
Display: 'Inter' or system — loaded via Google Fonts (Inter is free, premium feel)
```

### Type Scale
```
Display XL: 72px / weight 300 / tracking -3px   (hero on desktop)
Display L:  56px / weight 300 / tracking -2px   (hero on tablet)
H1:         48px / weight 300 / tracking -1.5px
H2:         36px / weight 300 / tracking -0.5px
H3:         22px / weight 600 / tracking 0
H4:         16px / weight 600 / tracking 0
Body L:     18px / weight 400 / line-height 1.7  (hero subheads)
Body:       15px / weight 400 / line-height 1.72
Small:      13px / weight 400
Label:      10px / weight 700 / tracking 3px / uppercase
```

### Light Theme Typography Rules
- Headings: `--primary` (navy) NOT white
- Body: `--text-secondary` (warm dark gray) NOT muted white
- Links: `--accent` (teal)
- Max line length: 72 characters (680px max-width for content)

---

## 6. Critical Fixes (Must Ship in V2)

| # | Issue | Fix |
|---|---|---|
| 1 | Assessment scores are random | Implement keyword-weighted scoring from answers |
| 2 | Lead data goes nowhere | Send to GHL webhook on Phase 1 submit |
| 3 | Contact form does nothing | Connect to GHL webhook or email endpoint |
| 4 | Blog posts all 404 | Write 3 real articles, placeholder 6 with full content |
| 5 | Themes only on homepage | Add theme system to ALL pages |
| 6 | Phone is (555) 000-0000 | Replace with real number or remove |
| 7 | No favicon | Create 16px falcon SVG favicon |
| 8 | No analytics | Add GA4 tag + Meta pixel stub (user provides IDs) |
| 9 | Newsletter does nothing | Connect to GHL or Mailchimp |
| 10 | PDF = window.print() | Keep print but label it "Print / Save as PDF" |
| 11 | Copyright 2025 | Update to 2026 |
| 12 | Email domain mismatch | Align email to nexvorasystems.us domain |
| 13 | Mobile menu has no transition | Add slide-down animation (0.3s) |
| 14 | About page is 404 on live site | Ensure about.html exists with real content |

---

## 7. GHL (GoHighLevel) Integration Spec

### Webhook Calls
```javascript
// Phase 1 completion — lead capture
POST https://services.leadconnectorhq.com/hooks/[WEBHOOK_ID]
Body: {
  firstName, lastName, email, phone, company, city, state,
  source: "nexvora-assessment",
  timestamp: ISO8601
}

// Assessment completion — full data
POST https://services.leadconnectorhq.com/hooks/[WEBHOOK_ID]  
Body: {
  lead: { firstName, lastName, email, phone, company, city, state },
  scores: { finance, operations, sales, marketing, ... },
  overallScore: 0-100,
  criticalCount, warningCount, goodCount,
  answers: [ { dimension, question, answer } × 15 ],
  agreedSlides: [], disagreedSlides: [],
  timestamp: ISO8601
}
```

### GHL Pipeline Action
On lead capture webhook:
- Create contact in GHL CRM
- Add to pipeline: "Assessment Leads → New Assessment"
- Send automated email: "Your Nexvora Report is Ready"
- Assign to owner for follow-up task in 24h

*User must provide: GHL webhook URL, GHL API key*

---

## 8. Assessment Scoring Algorithm (Real)

### Keyword Scoring
Replace `Math.random()` with actual analysis:

```javascript
function scoreAnswer(answer, dimension) {
  const text = answer.toLowerCase();
  
  // Score signals (each word/phrase adds or subtracts from base 50)
  const criticalSignals = ['no', 'none', 'never', 'don\'t', 'manual', 'spreadsheet', 
    'not sure', 'no idea', 'not really', 'haven\'t', 'rarely', 'almost never'];
  const warningSignals = ['sometimes', 'kind of', 'trying to', 'working on', 
    'not consistently', 'could be better', 'some'];
  const goodSignals = ['yes', 'definitely', 'always', 'automated', 'system',
    'process', 'track', 'measure', 'dashboard', 'team knows', 'documented'];
  
  let score = 50; // neutral baseline
  criticalSignals.forEach(s => { if (text.includes(s)) score -= 15; });
  warningSignals.forEach(s => { if (text.includes(s)) score -= 7; });
  goodSignals.forEach(s => { if (text.includes(s)) score += 12; });
  
  return Math.max(15, Math.min(92, score)); // clamp 15-92
}
```

### Score Thresholds
```
0-39:  Critical (red) — "Immediate attention required"
40-64: Warning (amber) — "Room for significant improvement"  
65-100: Good (green) — "Above industry average"
```

---

## 9. Technical Architecture

### File Structure (V2)
```
nexvora-website/
├── index.html                    (homepage — cream theme default)
├── about.html
├── services.html
├── contact.html
├── assessment.html
├── blog.html
├── blog/                         [NEW] individual blog articles
│   ├── operations-efficiency.html
│   ├── revenue-leaks.html
│   └── team-alignment.html
├── 404.html                      [NEW] falcon perched error page
├── css/
│   ├── global.css                (design tokens + reset)
│   ├── themes.css                (7 themes)
│   ├── components.css            (nav, footer, buttons, cards)
│   ├── animations.css            (all keyframes + scroll reveal)
│   ├── assessment.css            (assessment overlay styles)
│   └── falcon.css                [NEW] falcon SVG + animations
├── js/
│   ├── main.js                   (nav, mobile menu, utilities)
│   ├── animations.js             (Three.js + scroll reveal)
│   ├── assessment.js             (chat engine — real scoring)
│   ├── report.js                 (wizard — connected to real scores)
│   ├── falcon.js                 [NEW] falcon animation controller
│   └── theme.js                  [NEW] theme system (all pages)
├── assets/
│   ├── nexvora-logo.png
│   ├── falcon-mark.svg           [NEW] geometric falcon SVG
│   └── favicon.svg               [NEW] 16px falcon favicon
├── legal/
│   └── (existing — update theme + copyright)
└── docs/
    └── superpowers/
        ├── specs/this-file.md
        └── plans/implementation-plan.md
```

### Performance Targets
```
Lighthouse Performance: ≥ 90
First Contentful Paint: < 1.5s
Largest Contentful Paint: < 2.5s
Total Blocking Time: < 200ms
Cumulative Layout Shift: < 0.1
```

### Technology Stack
```
HTML5 / CSS3 / Vanilla JavaScript (no framework)
Three.js r128 (CDN) — hero animation only
Inter font — Google Fonts (2 weights: 300, 600)
No jQuery, no heavy libraries
GHL webhooks for lead capture
```

---

## 10. Success Metrics

| Metric | Current | Target V2 |
|---|---|---|
| Assessment completion rate | Unknown (no tracking) | > 60% |
| Lead capture rate (visitors → GHL contacts) | 0% (broken) | > 15% |
| Assessment → strategy call conversion | Unknown | > 25% |
| Time on site | Unknown | > 3 minutes |
| Mobile bounce rate | Unknown | < 55% |
| Page load time | Unknown | < 2s |
| Lighthouse score | ~75 (estimate) | ≥ 90 |

---

## 11. Out of Scope (Phase 2)

- Real AI/LLM scoring of assessment answers (Phase 2 — use API)
- Client portal / login system
- Blog CMS / headless WordPress
- A/B testing infrastructure
- Video testimonials / case study pages
- Pricing page
- Real PDF generation (Puppeteer / wkhtmltopdf)
