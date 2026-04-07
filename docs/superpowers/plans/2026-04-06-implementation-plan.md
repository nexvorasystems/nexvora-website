# Nexvora V2 — Implementation Plan
**The Nexvora Falcon System**

> For agentic workers: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform nexvorasystems.us into a premium, conversion-optimized lead funnel with 7 color themes, Falcon mascot, real assessment scoring, and GHL lead capture.

**Architecture:** Vanilla HTML/CSS/JS, no framework. Extend existing file structure. Archive old code with `/* OLD_APRIL5 */` comments at top of each changed file.

**Tech Stack:** HTML5, CSS3 custom properties, Vanilla JS, Three.js r128, Inter font (Google Fonts), GHL webhooks

---

## Phase 1: Foundation (CSS System + Theme Engine)

### Task 1.1: Update global.css — New design tokens
**Files:** `css/global.css`

- [ ] Add Inter font import from Google Fonts
- [ ] Update `:root` tokens to Cream Intelligence palette as default
- [ ] Add `--teal`, `--bg-card-hover`, `--border-glow` tokens (already done in April 5)
- [ ] Add new spacing tokens: `--section-gap-lg: 120px`, `--radius-xl: 24px`
- [ ] Update body font-family to include 'Inter'
- [ ] Verify all existing tokens still work

### Task 1.2: Rebuild themes.css — All 7 themes
**Files:** `css/themes.css`

- [ ] Theme 1: `[data-theme="cream"]` — Cream Intelligence (new default)
- [ ] Theme 2: `[data-theme="space"]` — Midnight Space (April 5 dark, was default)
- [ ] Theme 3: `[data-theme="apple-light"]` — Apple Light
- [ ] Theme 4: `[data-theme="apple-dark"]` — Apple Dark
- [ ] Theme 5: `[data-theme="carbon"]` — Falcon Carbon
- [ ] Theme 6: `[data-theme="forest"]` — Forest Sovereign
- [ ] Theme 7: `[data-theme="titanium"]` — Falcon Titanium
- [ ] Each theme: define all 20+ CSS custom properties
- [ ] Test contrast ratios for each theme (WCAG AA minimum)

### Task 1.3: Create theme.js — Universal theme system
**Files:** `js/theme.js` (NEW)

- [ ] Read theme from `localStorage.getItem('nx_theme')` (default: 'cream')
- [ ] Apply theme to `<html data-theme="">` immediately on DOMContentLoaded
- [ ] Export `applyTheme(name)` function
- [ ] Export `getTheme()` function
- [ ] 7 theme button labels: Cream | Space | Apple ☀ | Apple ● | Carbon | Forest | Titanium
- [ ] Persist theme selection across all pages
- [ ] Add `<script src="js/theme.js">` to ALL HTML pages (before other scripts)

### Task 1.4: Update theme switcher UI — All pages
**Files:** All HTML pages

- [ ] Move theme switcher from index.html inline script to `js/theme.js`
- [ ] Add theme switcher HTML component to ALL pages (in a shared pattern)
- [ ] 7 circular buttons instead of 4
- [ ] Position: fixed bottom-right, z-index 9999
- [ ] Each button shows theme color preview + tooltip on hover
- [ ] Active theme button: teal ring highlight

---

## Phase 2: Falcon Mascot System

### Task 2.1: Design geometric falcon SVG
**Files:** `assets/falcon-mark.svg` (NEW), `assets/favicon.svg` (NEW)

- [ ] Create low-poly falcon SVG (10-12 polygon facets)
  - Body: 4 facets in teal/navy
  - Wings: 3 facets each, slightly lighter
  - Head: 2 facets, gold accent beak/eye
  - Tail: 2 facets in deep navy
- [ ] Size: viewBox="0 0 200 200", scalable
- [ ] Export simplified 16×16 version for favicon
- [ ] Test rendering at 32px (nav), 64px (icons), 200px (hero)

### Task 2.2: Create falcon.css — All falcon animations
**Files:** `css/falcon.css` (NEW)

```css
/* Keyframes to implement: */
@keyframes falconFloat { }      /* 6s subtle levitation */
@keyframes falconFlap { }       /* 0.4s wing beat on click */
@keyframes falconSweep { }      /* 0.8s entry from right */
@keyframes falconScan { }       /* continuous rotation during analysis */
@keyframes falconLand { }       /* 0.6s drop + bounce settle */
@keyframes falconPath { }       /* SVG stroke-dashoffset reveal */
@keyframes falconPulse { }      /* glow ring emanating from body */
```

- [ ] `.falcon-float` class for hero
- [ ] `.falcon-icon-sm` 32px inline icon variant
- [ ] `.falcon-btn-icon` 20px button icon that flaps on parent click
- [ ] `.falcon-scan` spinning analysis state
- [ ] `.falcon-landing` assessment completion animation
- [ ] Reduced motion: all disabled, static display

### Task 2.3: Create falcon.js — Animation controller
**Files:** `js/falcon.js` (NEW)

- [ ] `Falcon.flap(element)` — triggers wing flap on element click
- [ ] `Falcon.sweep(container)` — sweeps falcon across container
- [ ] `Falcon.scan(element)` — puts element in scanning rotation
- [ ] `Falcon.land(element)` — plays landing animation
- [ ] `Falcon.initHero()` — sets up hero falcon with float
- [ ] `Falcon.initButtons()` — adds flap to all primary buttons
- [ ] Auto-init on DOMContentLoaded

---

## Phase 3: New CSS Components

### Task 3.1: Update components.css for dual light/dark support
**Files:** `css/components.css`

- [ ] Nav: `background: var(--nav-bg)` instead of hardcoded rgba
  - Light themes: `rgba(250,248,245,0.9)` with blur
  - Dark themes: `rgba(5,8,15,0.85)` with blur (current)
- [ ] Add `--nav-bg`, `--nav-border`, `--mobile-menu-bg` tokens to each theme
- [ ] Buttons: All use CSS variables (already mostly done)
- [ ] Cards: Work on both light and dark (test cream theme cards)
- [ ] Footer: `background: var(--footer-bg)` — dark navy on all themes
- [ ] Form inputs: Light theme variant (dark border on cream bg)
- [ ] Add `.falcon-cta` button variant (large, with inline falcon icon)

### Task 3.2: Update animations.css
**Files:** `css/animations.css`

- [ ] Add `fade-left` and `fade-right` classes (from sides)
- [ ] Update `pulseRing` to use `--accent` variable
- [ ] Add `floatUp` for cards
- [ ] Add `slideInRight` for page transition effect
- [ ] Add `popIn` for modals and success states
- [ ] Theme-aware pulse ring colors

---

## Phase 4: Rebuild Homepage

### Task 4.1: Redesign index.html hero
**Files:** `index.html`

- [ ] Add `/* OLD_APRIL5 */` comment at top
- [ ] Set default theme to 'cream' (check localStorage, fall back to 'cream')
- [ ] Hero headline: "We see the gaps that cost your business $2.4M a year"
- [ ] Hero subhead: "The Nexvora Falcon System diagnoses your operations in 10 minutes"
- [ ] Add falcon SVG to hero (HTML overlay on Three.js canvas)
- [ ] Hero CTA: "Start Free Scan →" (primary) + "See How It Works ↓" (ghost)
- [ ] Hero adapts colors based on active theme (dark vs light)
- [ ] Three.js canvas: nodes reduce opacity on light theme (navy nodes on cream)

### Task 4.2: Redesign homepage sections
**Files:** `index.html`

- [ ] Metrics band: add `$` prefix to 2.4M, `%` suffix to 67, `min` suffix to 10
- [ ] How It Works: Add falcon icon that moves through steps on scroll
- [ ] Services grid: Update service icons, add falcon-themed hover effect
- [ ] Add Proof/Testimonials section (3 placeholder cards pending real data)
- [ ] Why Nexvora: Style for both light and dark themes
- [ ] Assessment CTA: Add falcon SVG centered above card, glowing
- [ ] Update copyright to 2026

### Task 4.3: Theme switcher — 7 themes on homepage
**Files:** `index.html`

- [ ] Replace 4-button switcher with 7-button switcher
- [ ] Use `js/theme.js` instead of inline script
- [ ] Add tooltips: "Cream" | "Space" | "Apple ☀" | "Apple ●" | "Carbon" | "Forest" | "Titanium"

---

## Phase 5: Rebuild All Other Pages

### Task 5.1: Update about.html
**Files:** `about.html`

- [ ] Add theme.js script tag (before other scripts)
- [ ] Add theme switcher HTML component
- [ ] Add falcon.js script tag
- [ ] Link to falcon.css
- [ ] Update page to use CSS variable colors (light theme compatible)
- [ ] Fix team section (add "Meet Our Team" with placeholder professional bios)
- [ ] Update copyright to 2026

### Task 5.2: Update services.html
**Files:** `services.html`

- [ ] Add theme.js, falcon.js, falcon.css
- [ ] Add theme switcher component
- [ ] Update service icons to use falcon-themed SVG icons
- [ ] Ensure light theme displays correctly (navy text on cream bg)
- [ ] Service CTA buttons: "Assess My [Area] →"

### Task 5.3: Update contact.html
**Files:** `contact.html`

- [ ] Add theme.js, falcon.js, falcon.css
- [ ] Add theme switcher
- [ ] Fix phone number placeholder
- [ ] Connect contact form to GHL webhook (with config constant at top of script)
- [ ] Add loading state to form submit (falcon scanning animation)
- [ ] Fix email domain to nexvorasystems.us

### Task 5.4: Update blog.html
**Files:** `blog.html`

- [ ] Add theme.js, falcon.js, falcon.css  
- [ ] Add theme switcher
- [ ] Change all blog post links from `href="#"` to real article URLs
- [ ] Create 3 real blog article HTML files
- [ ] Newsletter subscribe: connect to GHL webhook

### Task 5.5: Update assessment.html
**Files:** `assessment.html`

- [ ] Add theme.js, falcon.js, falcon.css
- [ ] Add theme switcher (hidden during assessment overlay)
- [ ] Add falcon animation on overlay open (sweep in)
- [ ] Replace assessment hero headline

### Task 5.6: Update all legal pages
**Files:** `legal/terms.html`, `legal/privacy.html`, `legal/disclaimer.html`, `legal/cookies.html`

- [ ] Add theme.js to each
- [ ] Add theme switcher
- [ ] Update copyright to 2026

---

## Phase 6: Fix Assessment — Real Scoring

### Task 6.1: Rewrite assessment scoring in assessment.js
**Files:** `js/assessment.js`

- [ ] Add `/* OLD_APRIL5 */` comment at top noting old random scoring
- [ ] Implement `scoreAnswer(answer, dimension)` keyword function
- [ ] Store each answer in `state.answers` array: `{ dimension, question, answer, score }`
- [ ] Replace `computeReport()` random scores with weighted average of answer scores
- [ ] Ensure score still falls in 15-92 range
- [ ] Keep all existing question flow, typing animations, and chat UI

### Task 6.2: Add GHL webhook to assessment.js
**Files:** `js/assessment.js`

- [ ] Add `const GHL_WEBHOOK_URL = 'REPLACE_WITH_YOUR_GHL_WEBHOOK';` constant at top
- [ ] On Phase 1 complete: POST lead data to webhook (wrapped in try/catch)
- [ ] On assessment complete: POST full data payload to webhook
- [ ] If webhook fails: silently continue (don't block user flow)
- [ ] Log webhook result to console in dev mode

---

## Phase 7: Critical Fixes

### Task 7.1: Add favicon
**Files:** All HTML files, `assets/favicon.svg`

- [ ] Create minimal 16px falcon SVG favicon
- [ ] Add `<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">` to ALL pages
- [ ] Add PNG fallback: `<link rel="icon" href="assets/favicon.png" sizes="32x32">`

### Task 7.2: Fix contact form
**Files:** `contact.html`

- [ ] Add `const GHL_WEBHOOK_URL = 'REPLACE_WITH_YOUR_GHL_WEBHOOK';` at top of script
- [ ] Replace 1200ms fake setTimeout with real fetch() POST
- [ ] Add loading state (falcon scanning) during submission
- [ ] Show real success/error states

### Task 7.3: Fix mobile menu animation
**Files:** `css/components.css`

- [ ] Replace `display: flex` snap with CSS transition
- [ ] Mobile menu: starts `opacity: 0; transform: translateY(-8px)` when closed
- [ ] Transitions to `opacity: 1; transform: translateY(0)` in 0.25s when open
- [ ] Use `visibility: hidden/visible` instead of `display: none/flex` to enable transitions

### Task 7.4: Add analytics stubs
**Files:** All HTML files

- [ ] Add `<!-- GA4: Replace G-XXXXXXXX with your tag -->` comment + GA4 script stub to `<head>` of all pages
- [ ] Add `<!-- Meta Pixel: Replace YOUR_PIXEL_ID -->` comment + pixel stub

### Task 7.5: Fix copyright
**Files:** All HTML files (footer)

- [ ] Replace "© 2025" with "© 2026" across all pages

### Task 7.6: Create 404 page
**Files:** `404.html` (NEW)

- [ ] Falcon perched SVG animation
- [ ] "404 — The Falcon couldn't find this page"
- [ ] Link back to homepage + assessment

---

## Phase 8: Blog Content

### Task 8.1: Write 3 real blog articles
**Files:** `blog/operations-efficiency.html`, `blog/revenue-leaks.html`, `blog/team-alignment.html`

Each article:
- [ ] 800-1200 word real article (no placeholder)
- [ ] Proper HTML with nav/footer matching site
- [ ] Theme system included
- [ ] CTA at bottom → assessment
- [ ] Link from blog.html card

---

## Implementation Order (Priority)

```
WEEK 1 (Foundation):
  Phase 1 (CSS + theme engine) → Phase 2 (Falcon SVG)

WEEK 1-2 (Pages):
  Phase 3 (components) → Phase 4 (homepage) → Phase 5 (all pages)

WEEK 2 (Critical):
  Phase 6 (real scoring) → Phase 7 (fixes) → Phase 8 (blog)
```

---

## Verification Checklist

Before marking complete:
- [ ] All 7 themes work on ALL pages
- [ ] Assessment completes without errors in all themes
- [ ] Lead data posts to GHL webhook (or gracefully fails)
- [ ] Mobile hamburger animates smoothly
- [ ] Falcon animations work at 60fps (check DevTools Performance)
- [ ] Lighthouse score ≥ 85 (run on index.html)
- [ ] No `(555) 000-0000` visible anywhere
- [ ] No `© 2025` visible anywhere
- [ ] No dead blog links (`href="#"` in blog.html cards)
- [ ] Favicon appears in browser tab
- [ ] Contact form shows real loading state
