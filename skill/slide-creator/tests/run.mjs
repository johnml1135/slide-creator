#!/usr/bin/env node
// Fixture tests for the checks: every folder in tests/fixtures is a small deck plus expect.json, which lists, per
// slide, exactly which checks must fire ([] = the slide must stay clean) and optionally deck-wide "global" checks.
// The real build runs on each fixture (HTML only, no PDF), so this tests the checks through their real interface.
// Usage: npm test   (or node tests/run.mjs [fixture ...])

import { readdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, 'fixtures');
const build = path.join(here, '..', 'scripts', 'build.mjs');
const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : (await readdir(fixturesDir)).filter((n) => existsSync(path.join(fixturesDir, n, 'expect.json')));
let failed = 0;

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
for (const name of names) {
  const dir = path.join(fixturesDir, name);
  const out = path.join(dir, 'build-test');
  await rm(out, { recursive: true, force: true });
  spawnSync(process.execPath, [build, dir, '--html', '--out', 'build-test'], { stdio: 'ignore' });
  const reportPath = path.join(out, 'report.json');
  if (!existsSync(reportPath)) { failed++; console.log(`✗ ${name}: no report produced`); continue; }
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  const expect = JSON.parse(await readFile(path.join(dir, 'expect.json'), 'utf8'));
  const problems = [];
  for (const [n, want] of Object.entries(expect.slides || {})) {
    const slide = report.slides.find((s) => s.index === +n);
    const got = [...new Set((slide?.issues || []).map((i) => i.check))].sort();
    if (!sameSet(got, [...want].sort())) problems.push(`slide ${n}: expected [${want.join(', ')}], got [${got.join(', ')}]`);
  }
  if (expect.global) {
    const got = [...new Set(report.global.map((i) => i.check))].sort();
    if (!sameSet(got, [...expect.global].sort())) problems.push(`deck-wide: expected [${expect.global.join(', ')}], got [${got.join(', ')}]`);
  }
  if (problems.length) { failed++; console.log(`✗ ${name}\n${problems.map((p) => '    ' + p).join('\n')}`); }
  else console.log(`✓ ${name}`);
}
console.log(failed ? `\n${failed} of ${names.length} fixtures failed.` : `\nAll ${names.length} fixtures pass.`);
process.exitCode = failed ? 1 : 0;
