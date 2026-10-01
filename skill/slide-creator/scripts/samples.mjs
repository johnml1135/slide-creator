#!/usr/bin/env node
// Rebuild samples/<style>.pdf for every built-in style from examples/showcase.
// Usage: node <skill>/scripts/samples.mjs [style ...]

import { readdir, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SKILL_DIR } from './lib/style.mjs';

const wanted = process.argv.slice(2);
const styles = wanted.length ? wanted : (await readdir(path.join(SKILL_DIR, 'styles'))).filter((s) => existsSync(path.join(SKILL_DIR, 'styles', s, 'style.json')));
const showcase = path.join(SKILL_DIR, 'examples', 'showcase');
await mkdir(path.join(SKILL_DIR, 'samples'), { recursive: true });

for (const s of styles) {
  const out = `build-${s}`;
  console.log(`\n=== ${s} ===`);
  const r = spawnSync(process.execPath, [path.join(SKILL_DIR, 'scripts', 'build.mjs'), showcase, '--style', s, '--out', out], { stdio: 'inherit' });
  const pdf = path.join(showcase, out, 'deck.pdf');
  if (existsSync(pdf)) {
    await copyFile(pdf, path.join(SKILL_DIR, 'samples', `${s}.pdf`));
    await copyFile(path.join(showcase, out, 'contact-sheet.png'), path.join(SKILL_DIR, 'samples', `${s}.png`)).catch(() => {});
    console.log(`→ samples/${s}.pdf`);
  } else console.error(`✗ ${s}: no PDF produced (exit ${r.status})`);
}
