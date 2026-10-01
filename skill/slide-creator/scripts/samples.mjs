#!/usr/bin/env node
// Rebuild the published samples for every built-in style from examples/showcase:
//   samples/<style>.pdf, samples/<style>.png (contact sheet), samples/<style>-<scheme>.pdf for each extra scheme,
//   styles/<style>/reference/showcase-NN.png (the slides agents compare against).
// Usage: node <skill>/scripts/samples.mjs [style ...]

import { readdir, readFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SKILL_DIR } from './lib/style.mjs';

// Cover, chapter, KPIs, diagram, chart, table: one of each kind of slide a style has to get right.
const REFERENCE_SLIDES = [1, 3, 4, 5, 7, 8];

const wanted = process.argv.slice(2);
const stylesDir = path.join(SKILL_DIR, 'styles');
const styles = wanted.length ? wanted : (await readdir(stylesDir)).filter((s) => existsSync(path.join(stylesDir, s, 'style.json')));
const showcase = path.join(SKILL_DIR, 'examples', 'showcase');
const samplesDir = path.join(SKILL_DIR, 'samples');
await mkdir(samplesDir, { recursive: true });
let failed = 0;

const build = (style, scheme, out) => {
  console.log(`\n=== ${style}${scheme === 'default' ? '' : ` (${scheme})`} ===`);
  spawnSync(process.execPath, [path.join(SKILL_DIR, 'scripts', 'build.mjs'), showcase, '--style', style, '--scheme', scheme, '--out', out], { stdio: 'inherit' });
  const pdf = path.join(showcase, out, 'deck.pdf');
  if (!existsSync(pdf)) { failed++; console.error(`✗ ${style}/${scheme}: no PDF produced`); return null; }
  return path.join(showcase, out);
};

for (const s of styles) {
  const schemes = Object.keys(JSON.parse(await readFile(path.join(stylesDir, s, 'style.json'), 'utf8')).schemes || { default: 1 });
  for (const scheme of schemes) {
    const suffix = scheme === 'default' ? '' : `-${scheme}`;
    const out = build(s, scheme, `build-${s}${suffix}`);
    if (!out) continue;
    await copyFile(path.join(out, 'deck.pdf'), path.join(samplesDir, `${s}${suffix}.pdf`));
    console.log(`→ samples/${s}${suffix}.pdf`);
    if (scheme !== 'default') continue;
    await copyFile(path.join(out, 'contact-sheet.png'), path.join(samplesDir, `${s}.png`));
    const refDir = path.join(stylesDir, s, 'reference');
    await rm(refDir, { recursive: true, force: true });
    await mkdir(refDir, { recursive: true });
    for (const n of REFERENCE_SLIDES.map((i) => String(i).padStart(2, '0'))) {
      await copyFile(path.join(out, 'slides', `slide-${n}.png`), path.join(refDir, `showcase-${n}.png`));
    }
    console.log(`→ styles/${s}/reference/ (${REFERENCE_SLIDES.length} slides)`);
  }
}
if (failed) process.exitCode = 1;
