#!/usr/bin/env node
// Maintainer tool (not part of the installed skill): rebuild the repo's gallery/ for every built-in style from
// its example project (examples/showcase, or the one named in style.json "samples.example"):
//   gallery/<style>.pdf, gallery/<style>-<scheme>.pdf for each extra scheme,
//   gallery/<style>.png (contact sheet: every page), gallery/<style>-hero.png (README image).
// Fails (exit 1) if any build reports an error or warning: published samples must be clean.
// Usage (repo root): npm run samples [-- style ...]

import { readdir, readFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SKILL_DIR, loadStyle } from '../skill/slide-creator/scripts/lib/style.mjs';
import { launchBrowser } from '../skill/slide-creator/scripts/lib/project.mjs';

// Pages for the hero image: the cover, then the last three (a diagram, a chart, a table in the showcase).
// A style can name its own list in style.json "samples.reference".
const REFERENCE_SLIDES = [1, 3, 4, 5, 7, 8];

const wanted = process.argv.slice(2);
const stylesDir = path.join(SKILL_DIR, 'styles');
const styles = wanted.length ? wanted : (await readdir(stylesDir)).filter((s) => existsSync(path.join(stylesDir, s, 'style.json')));
const galleryDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'gallery');
await mkdir(galleryDir, { recursive: true });
const failures = [];

/** Build one style/scheme; returns the build folder, or null (and records why) if it isn't clean. */
async function build(style, scheme, out, project) {
  const label = `${style}${scheme === 'default' ? '' : ` (${scheme})`}`;
  console.log(`\n=== ${label} ===`);
  spawnSync(process.execPath, [path.join(SKILL_DIR, 'scripts', 'build.mjs'), project, '--style', style, '--scheme', scheme, '--out', out], { stdio: 'inherit' });
  const dir = path.join(project, out);
  const config = JSON.parse(await readFile(path.join(project, 'slides.json'), 'utf8'));
  const pdfName = `${String(config.name || path.basename(project)).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deck'}.pdf`;
  const reportPath = path.join(dir, 'report.json');
  if (!existsSync(path.join(dir, pdfName)) || !existsSync(reportPath)) { failures.push(`${label}: no PDF or report produced`); return null; }
  const { errors, warnings } = JSON.parse(await readFile(reportPath, 'utf8'));
  if (errors || warnings) { failures.push(`${label}: ${errors} errors, ${warnings} warnings (see ${path.relative(SKILL_DIR, path.join(dir, 'report.md'))})`); return null; }
  return { dir, pdfName };
}

for (const s of styles) {
  const style = await loadStyle(s);
  const example = path.join(SKILL_DIR, 'examples', style.samples?.example || 'showcase');
  const refs = style.samples?.reference || REFERENCE_SLIDES;
  for (const scheme of Object.keys(style.schemes || { default: 1 })) {
    const suffix = scheme === 'default' ? '' : `-${scheme}`;
    const built = await build(s, scheme, `build-${s}${suffix}`, example);
    if (!built) continue;
    const { dir: out, pdfName } = built;
    try {
      await copyFile(path.join(out, pdfName), path.join(galleryDir, `${s}${suffix}.pdf`));
      console.log(`→ gallery/${s}${suffix}.pdf`);
      if (scheme !== 'default') continue;
      await copyFile(path.join(out, 'contact-sheet.png'), path.join(galleryDir, `${s}.png`));
      await hero(style, out, refs, path.join(galleryDir, `${s}-hero.png`));
      console.log(`→ gallery/${s}.png, gallery/${s}-hero.png`);
    } catch (e) {
      failures.push(`${s}${suffix}: ${e.message}`);
    }
  }
}


/** README showcase image: the cover large, three content pages beside it, on the style's own colours. */
async function hero(style, buildDir, refs, file) {
  const t = JSON.parse(await readFile(path.join(buildDir, 'tokens.json'), 'utf8'));
  const c = t.colors;
  const img = async (n) => 'data:image/png;base64,' + (await readFile(path.join(buildDir, 'slides', `slide-${String(n).padStart(2, '0')}.png`))).toString('base64');
  const [W, H, pad, head, gap] = [1600, 1000, 64, 150, 28];
  const ratio = t.page.height / t.page.width;
  const smallH = (H - head - pad - 2 * gap) / 3, smallW = smallH / ratio;
  const bigW = Math.min(W - 2 * pad - gap - smallW, (H - head - pad) / ratio), bigH = bigW * ratio;
  const fam = (f) => (Array.isArray(f) ? f : [f]).map((x) => (/\s/.test(x) ? `'${x}'` : x)).join(', ');
  const shot = (src, w, h) => `<img src="${src}" style="width:${w}px;height:${h}px;display:block;border-radius:6px;box-shadow:0 18px 40px -12px rgba(0,0,0,.35),0 2px 6px rgba(0,0,0,.12)">`;
  const smalls = await Promise.all(refs.slice(-3).map(async (n) => shot(await img(n), smallW, smallH)));
  // Portrait pages: the cover and two content pages side by side at the same size reads better than a tall cover.
  const portrait = ratio > 1;
  const rowW = (W - 2 * pad - 2 * gap) / 3, rowH = Math.min(rowW * ratio, H - head - pad), rowWfit = rowH / ratio;
  const row = portrait ? await Promise.all([refs[0], ...refs.slice(-3, -1)].map(async (n) => shot(await img(n), rowWfit, rowH))) : null;
  const left = portrait ? (W - 3 * rowWfit - 2 * gap) / 2 : (W - bigW - gap - smallW) / 2;
  const html = `<body style="margin:0;width:${W}px;height:${H}px;background:linear-gradient(135deg, ${c.surface}, ${c.bg} 60%);font-family:${fam(t.type.body.family)};color:${c.ink};overflow:hidden">
    <div style="position:absolute;left:${left}px;top:46px;right:${pad}px;display:flex;align-items:baseline;gap:24px">
      <div style="font-family:${fam(t.type.heading.family)};font-weight:${t.type.heading.weight ?? 600};font-size:52px;letter-spacing:-0.01em">${style.label}</div>
      <div style="font-size:20px;color:${c.muted}">${(style.bestFor || []).slice(0, 3).join(' · ')}</div>
    </div>
    <div style="position:absolute;left:${left}px;top:${head}px;height:${H - head - pad}px;display:flex;gap:${gap}px;align-items:center">
      ${portrait ? row.join('') : `${shot(await img(refs[0]), bigW, bigH)}<div style="display:flex;flex-direction:column;gap:${gap}px">${smalls.join('')}</div>`}
    </div></body>`;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: file });
  } finally { await browser.close(); }
}

if (failures.length) {
  console.error(`\n✗ Not clean — samples for these were not updated:\n${failures.map((f) => '  ' + f).join('\n')}`);
  process.exitCode = 1;
} else console.log('\n✓ All samples clean.');
