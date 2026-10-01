#!/usr/bin/env node
// Rebuild the published samples for every built-in style from its example project (examples/showcase, or the
// one named in style.json "samples.example", e.g. a document style uses examples/whitepaper):
//   samples/<style>.pdf, samples/<style>.png (contact sheet), samples/<style>-<scheme>.pdf for each extra scheme,
//   styles/<style>/reference/<example>-NN.png (the pages agents compare against).
// Fails (exit 1) if any build reports an error or warning: published samples must be clean.
// Usage: node <skill>/scripts/samples.mjs [style ...]

import { readdir, readFile, mkdir, copyFile, rm, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SKILL_DIR, loadStyle } from './lib/style.mjs';

// Cover, chapter, KPIs, diagram, chart, table: one of each kind of slide a style has to get right.
// A style can name its own list in style.json "samples.reference".
const REFERENCE_SLIDES = [1, 3, 4, 5, 7, 8];

const wanted = process.argv.slice(2);
const stylesDir = path.join(SKILL_DIR, 'styles');
const styles = wanted.length ? wanted : (await readdir(stylesDir)).filter((s) => existsSync(path.join(stylesDir, s, 'style.json')));
const samplesDir = path.join(SKILL_DIR, 'samples');
await mkdir(samplesDir, { recursive: true });
const failures = [];

/** Build one style/scheme; returns the build folder, or null (and records why) if it isn't clean. */
async function build(style, scheme, out, project) {
  const label = `${style}${scheme === 'default' ? '' : ` (${scheme})`}`;
  console.log(`\n=== ${label} ===`);
  spawnSync(process.execPath, [path.join(SKILL_DIR, 'scripts', 'build.mjs'), project, '--style', style, '--scheme', scheme, '--out', out], { stdio: 'inherit' });
  const dir = path.join(project, out);
  const reportPath = path.join(dir, 'report.json');
  if (!existsSync(path.join(dir, 'deck.pdf')) || !existsSync(reportPath)) { failures.push(`${label}: no PDF or report produced`); return null; }
  const { errors, warnings } = JSON.parse(await readFile(reportPath, 'utf8'));
  if (errors || warnings) { failures.push(`${label}: ${errors} errors, ${warnings} warnings (see ${path.relative(SKILL_DIR, path.join(dir, 'report.md'))})`); return null; }
  return dir;
}

for (const s of styles) {
  const style = await loadStyle(s);
  const example = path.join(SKILL_DIR, 'examples', style.samples?.example || 'showcase');
  const refs = style.samples?.reference || REFERENCE_SLIDES;
  for (const scheme of Object.keys(style.schemes || { default: 1 })) {
    const suffix = scheme === 'default' ? '' : `-${scheme}`;
    const out = await build(s, scheme, `build-${s}${suffix}`, example);
    if (!out) continue;
    try {
      await copyFile(path.join(out, 'deck.pdf'), path.join(samplesDir, `${s}${suffix}.pdf`));
      console.log(`→ samples/${s}${suffix}.pdf`);
      if (scheme !== 'default') continue;
      await copyFile(path.join(out, 'contact-sheet.png'), path.join(samplesDir, `${s}.png`));
      // Stage the new reference images first, so a missing slide can't leave the style with none.
      const refDir = path.join(stylesDir, s, 'reference');
      const staged = `${refDir}.new`;
      await rm(staged, { recursive: true, force: true });
      await mkdir(staged, { recursive: true });
      for (const n of refs.map((i) => String(i).padStart(2, '0'))) {
        await copyFile(path.join(out, 'slides', `slide-${n}.png`), path.join(staged, `${path.basename(example)}-${n}.png`));
      }
      await rm(refDir, { recursive: true, force: true });
      await rename(staged, refDir);
      console.log(`→ styles/${s}/reference/ (${refs.length} pages)`);
    } catch (e) {
      failures.push(`${s}${suffix}: ${e.message}`);
    }
  }
}

if (failures.length) {
  console.error(`\n✗ Not clean — samples for these were not updated:\n${failures.map((f) => '  ' + f).join('\n')}`);
  process.exitCode = 1;
} else console.log('\n✓ All samples clean.');
