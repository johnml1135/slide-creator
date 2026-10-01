#!/usr/bin/env node
// Inspection: render every slide to PNG, measure the layout, lint the sources, and write
//   build/slides/slide-NN.png          clean screenshot of each slide
//   build/slides/slide-NN.issues.png   same slide with problem areas outlined (only when issues)
//   build/contact-sheet.png            all slides as thumbnails, problem slides outlined
//   build/report.json / report.md      every finding, per slide, plus the visual-review checklist
//
// Usage: node <skill>/scripts/inspect.mjs [projectDir]   (build.mjs runs this automatically)

import { writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { launchBrowser, loadConfig, parseArgs } from './lib/project.mjs';
import { runLint } from './lint.mjs';

export async function inspect(cfg, { buildProblems = [], htmlPath } = {}) {
  const html = htmlPath || path.join(cfg.outDir, 'inspect.html');
  const tokens = JSON.parse(await readFile(path.join(cfg.outDir, 'tokens.json'), 'utf8'));
  const slidesDir = path.join(cfg.outDir, 'slides');
  await rm(slidesDir, { recursive: true, force: true });
  await mkdir(slidesDir, { recursive: true });

  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
  await page.addStyleTag({ content: 'html,body{margin:0;padding:0;background:#777;height:auto!important;overflow:visible!important} svg[data-marpit-svg]{display:block;width:1280px!important;height:720px!important;margin:0 0 24px} .marpit > svg + svg{margin-top:0}' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(300);

  const domFindings = await page.evaluate(measureSlides, { minFont: tokens.rules?.minFontPx ?? 14 });
  const lint = await runLint(cfg, tokens);

  // Merge findings per slide
  const slides = domFindings.map((s) => ({ index: s.index, rect: s.rect, issues: s.issues, classes: s.classes, title: s.title }));
  for (const f of lint.slideIssues) {
    const s = slides[f.slide - 1];
    if (s) s.issues.push(f); else lint.globalIssues.push(f);
  }

  // Screenshots
  for (const s of slides) {
    const n = String(s.index).padStart(2, '0');
    const clip = { x: s.rect.x, y: s.rect.y, width: s.rect.width, height: s.rect.height };
    await page.screenshot({ path: path.join(slidesDir, `slide-${n}.png`), clip, fullPage: true });
    const boxed = s.issues.filter((i) => i.box);
    if (s.issues.length) {
      await page.evaluate(({ boxes, origin }) => {
        for (const b of boxes) {
          const d = document.createElement('div');
          d.className = '__sc_overlay';
          const color = b.severity === 'error' ? '#E00000' : '#FF8A00';
          Object.assign(d.style, { position: 'absolute', left: origin.x + b.box.x - 3 + 'px', top: origin.y + b.box.y - 3 + 'px', width: b.box.w + 6 + 'px', height: b.box.h + 6 + 'px', border: `3px solid ${color}`, zIndex: 99999, pointerEvents: 'none' });
          const tag = document.createElement('span');
          tag.textContent = b.check;
          Object.assign(tag.style, { position: 'absolute', left: '-3px', top: '-22px', background: color, color: '#fff', font: '600 12px/18px sans-serif', padding: '0 6px', whiteSpace: 'nowrap' });
          d.appendChild(tag);
          document.body.appendChild(d);
        }
      }, { boxes: boxed, origin: { x: s.rect.x, y: s.rect.y } });
      await page.screenshot({ path: path.join(slidesDir, `slide-${n}.issues.png`), clip, fullPage: true });
      await page.evaluate(() => document.querySelectorAll('.__sc_overlay').forEach((e) => e.remove()));
    }
  }

  // Contact sheet
  const thumbs = slides.map((s) => {
    const n = String(s.index).padStart(2, '0');
    const errors = s.issues.filter((i) => i.severity === 'error').length;
    const warns = s.issues.filter((i) => i.severity === 'warning').length;
    const border = errors ? '#E00000' : warns ? '#FF8A00' : '#ccc';
    const file = 'data:image/png;base64,' + readFileSync(path.join(slidesDir, `slide-${n}.png`)).toString('base64');
    return `<figure style="margin:0"><img src="${file}" style="width:100%;display:block;outline:4px solid ${border}"><figcaption style="font:600 15px/1.6 sans-serif;color:#222">${s.index}${errors ? ` · <span style="color:#E00000">${errors} error${errors > 1 ? 's' : ''}</span>` : ''}${warns ? ` · <span style="color:#C06000">${warns} warning${warns > 1 ? 's' : ''}</span>` : ''}</figcaption></figure>`;
  }).join('');
  const sheet = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await sheet.setContent(`<body style="margin:0;padding:24px;background:#f4f4f4"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:28px 20px">${thumbs}</div></body>`, { waitUntil: 'load' });
  await sheet.screenshot({ path: path.join(cfg.outDir, 'contact-sheet.png'), fullPage: true });
  await browser.close();

  // Report
  const all = [...buildProblems.map((m) => ({ severity: 'error', check: 'build', message: m })), ...lint.globalIssues, ...slides.flatMap((s) => s.issues.map((i) => ({ ...i, slide: s.index })))];
  const errors = all.filter((i) => i.severity === 'error').length;
  const warnings = all.filter((i) => i.severity === 'warning').length;
  const report = { style: tokens.name, scheme: tokens.scheme, slideCount: slides.length, errors, warnings, global: [...buildProblems.map((m) => ({ severity: 'error', check: 'build', message: m })), ...lint.globalIssues], slides };
  await writeFile(path.join(cfg.outDir, 'report.json'), JSON.stringify(report, null, 2));
  await writeFile(path.join(cfg.outDir, 'report.md'), toMarkdown(report, cfg));
  console.log(`\nInspection: ${slides.length} slides · ${errors} errors · ${warnings} warnings`);
  console.log(`  report:        ${path.relative(cfg.projectDir, path.join(cfg.outDir, 'report.md'))}`);
  console.log(`  contact sheet: ${path.relative(cfg.projectDir, path.join(cfg.outDir, 'contact-sheet.png'))}`);
  if (errors) process.exitCode = 1;
  return report;
}

/* Runs inside the page. Must be self-contained. */
function measureSlides({ minFont }) {
  const W = 1280, H = 720;
  const sections = [...document.querySelectorAll('section')].filter((s) => !s.parentElement.closest('section'));
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || '');
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // Section ::before / ::after bands (e.g. a header bar) also count as background where they cover the text.
  const pseudoBg = (section, el) => {
    const er = el.getBoundingClientRect(), sr = section.getBoundingClientRect();
    const cx = er.left + er.width / 2 - sr.left, cy = er.top + er.height / 2 - sr.top;
    for (const which of ['::before', '::after']) {
      const ps = getComputedStyle(section, which);
      if (!ps.content || ps.content === 'none' || ps.position !== 'absolute') continue;
      const c = parse(ps.backgroundColor);
      if (!c || c.a < 0.9) continue;
      const top = parseFloat(ps.top), left = parseFloat(ps.left), h = parseFloat(ps.height), w = parseFloat(ps.width);
      const bottom = parseFloat(ps.bottom);
      const y0 = isNaN(top) ? sr.height - bottom - h : top;
      if (cx >= (isNaN(left) ? 0 : left) && cx <= (isNaN(left) ? 0 : left) + (isNaN(w) ? sr.width : w) && cy >= y0 && cy <= y0 + h) return c;
    }
    return null;
  };
  const bgOf = (el) => {
    const sec = el.closest('section');
    const pb = sec && pseudoBg(sec, el);
    if (pb) return pb;
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; // gradient/image: can't judge
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0.9) return c;
      if (e.tagName === 'SECTION') break;
    }
    return null;
  };
  const describe = (el) => {
    const cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '';
    const txt = (el.innerText || el.getAttribute('alt') || el.getAttribute('src') || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    return `${el.tagName.toLowerCase()}${cls}${txt ? ` "${txt}"` : ''}`;
  };

  return sections.map((section, i) => {
    const S = section.getBoundingClientRect();
    const k = S.width / W;
    const safe = parseFloat(getComputedStyle(section).getPropertyValue('--safe')) || 32;
    const rel = (r) => ({ x: (r.left - S.left) / k, y: (r.top - S.top) / k, w: r.width / k, h: r.height / k });
    const issues = [];
    const add = (severity, check, message, el) => {
      const r = el ? rel(el.getBoundingClientRect()) : null;
      issues.push({ severity, check, message: el ? `${message} — ${describe(el)}` : message, box: r && r.w > 0 && r.h > 0 ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) } : null });
    };
    const inChrome = (el) => !!el.closest('header, footer, .tracker');

    // 1. Content taller than the slide
    if (section.scrollHeight > section.clientHeight + 2) add('error', 'overflow', `Content is ${section.scrollHeight - section.clientHeight}px taller than the slide; shorten or split it`);

    // 2. Elements leaving the safe area (report outermost only)
    const flagged = new Set();
    const blocks = section.querySelectorAll('h1,h2,h3,h4,h6,p,ul,ol,li,img,svg,table,pre,.card,.kpi,.kpis,.callout,.cols,.cols3,.cols4,.do,.dont,.stat');
    for (const el of blocks) {
      if (inChrome(el) || el.closest('svg.icon') && el.tagName.toLowerCase() !== 'svg') continue;
      if ([...flagged].some((f) => f.contains(el))) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = rel(el.getBoundingClientRect());
      if (r.w === 0 || r.h === 0) continue;
      const out = r.x < safe - 1 || r.y < safe - 1 || r.x + r.w > W - safe + 1 || r.y + r.h > H - safe + 1;
      if (out) { flagged.add(el); add('error', 'off-slide', 'Element crosses the safe margin or slide edge', el); }
    }

    // 3. Clipped content inside boxes (code, tables, cards)
    for (const el of section.querySelectorAll('pre, td, th, .card, .kpi, .callout, .tag, h1, h2')) {
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'visible') add('error', 'clipped', 'Text is cut off horizontally', el);
      else if (el.tagName === 'PRE' && el.scrollWidth > el.clientWidth + 2) add('error', 'clipped', 'Code line too long', el);
    }

    // 4. Text: minimum size and contrast
    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const seen = new Set();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || seen.has(el) || section.contains(el.closest('svg'))) continue; // skip text in inline SVGs; every slide itself sits inside Marp's <svg>
      seen.add(el);
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const size = parseFloat(cs.fontSize);
      if (size < minFont - 0.5) add('warning', 'small-text', `Text is ${Math.round(size)}px (minimum ${minFont}px)`, el);
      const fg = parse(cs.color), bg = bgOf(el);
      if (fg && bg) {
        const large = size >= 24 || (size >= 18.6 && +cs.fontWeight >= 700);
        const need = large ? 3 : 4.5;
        const r = ratio(fg, bg);
        if (r < need) add(r < need - 1 ? 'error' : 'warning', 'contrast', `Contrast ${r.toFixed(1)}:1 (needs ${need}:1)`, el);
      }
    }

    // 5. Images that failed to load
    for (const img of section.querySelectorAll('img')) {
      if (img.complete && img.naturalWidth === 0) add('error', 'missing-image', `Image did not load: ${img.getAttribute('src')}`, img);
    }

    // 6. Empty slide
    const text = (section.innerText || '').replace(/\d+\s*$/, '').trim();
    if (!text && !section.querySelector('img, svg')) add('warning', 'empty', 'Slide has no content');

    // 7. Crowding: too many distinct blocks
    const blocksTop = section.querySelectorAll(':scope > *:not(header):not(footer)').length;
    if (blocksTop > 7) add('warning', 'crowded', `${blocksTop} top-level blocks; aim for one idea per slide`);

    const title = (section.querySelector('h1, h2') || {}).innerText || '';
    return { index: i + 1, title: title.trim(), classes: section.className, rect: { x: S.left + window.scrollX, y: S.top + window.scrollY, width: S.width, height: S.height }, issues };
  });
}

function toMarkdown(r, cfg) {
  const lines = [];
  lines.push(`# Inspection report`, '');
  lines.push(`Style **${r.style}** (${r.scheme}) · ${r.slideCount} slides · **${r.errors} errors** · ${r.warnings} warnings`, '');
  lines.push('Open `contact-sheet.png` first, then any `slides/slide-NN.issues.png` listed below.', '');
  if (r.global.length) {
    lines.push('## Deck-wide', '');
    for (const i of r.global) lines.push(`- ${i.severity === 'error' ? '✗' : '!'} **${i.check}** ${i.file ? `\`${i.file}\` ` : ''}${i.message}`);
    lines.push('');
  }
  lines.push('## Slides', '');
  for (const s of r.slides) {
    const n = String(s.index).padStart(2, '0');
    const head = `### ${s.index}. ${s.title || '(no title)'}${s.classes ? ` · \`${s.classes}\`` : ''}`;
    if (!s.issues.length) { lines.push(`${head} — ✓`, ''); continue; }
    lines.push(head, '', `![slide ${s.index}](slides/slide-${n}.issues.png)`, '');
    for (const i of s.issues) lines.push(`- ${i.severity === 'error' ? '✗' : '!'} **${i.check}** ${i.message}`);
    lines.push('');
  }
  lines.push('## Visual review (fill in after looking at the images)', '');
  lines.push('Score each 1–5 using `references/assessment-rubric.md`. Anything below 4 needs a fix.', '');
  lines.push('| Criterion | Score | Notes |', '|---|---|---|');
  for (const c of ['Matches the style guide', 'Hierarchy (one obvious focal point per slide)', 'Alignment and grid', 'Whitespace and density', 'Consistency across slides', 'Diagrams: clear and on-style', 'Charts: clear and on-style', 'Text: concise, titles do their job']) lines.push(`| ${c} |  |  |`);
  lines.push('');
  return lines.join('\n');
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const cfg = await loadConfig(path.resolve(args._[0] || '.'), { out: args.out });
  if (!existsSync(path.join(cfg.outDir, 'inspect.html'))) {
    console.error('No build/inspect.html yet — run build.mjs first.');
    process.exit(1);
  }
  await inspect(cfg, { htmlPath: args.html });
}
