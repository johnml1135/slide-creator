#!/usr/bin/env node
// Environment check: Node version, npm packages, browser, Python packages (optional).
// Usage: node <skill>/scripts/doctor.mjs

import { execFileSync } from 'node:child_process';
import { SKILL_DIR } from './lib/style.mjs';
import { findBrowser, resolveDepFile, launchBrowser } from './lib/project.mjs';

let bad = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m, fix) => { bad++; console.log(`  ✗ ${m}${fix ? `\n      → ${fix}` : ''}`); };
const warn = (m, fix) => console.log(`  ! ${m}${fix ? `\n      → ${fix}` : ''}`);

console.log('slide-creator doctor\n');

const [major] = process.versions.node.split('.').map(Number);
major >= 18 ? ok(`Node ${process.versions.node}`) : fail(`Node ${process.versions.node} is too old`, 'Install Node 18 or newer');

const deps = { '@marp-team/marp-cli': 'slides', '@terrastruct/d2': 'diagrams', vega: 'charts', 'vega-lite': 'charts', 'lucide-static': 'icons', 'playwright-core': 'inspection' };
for (const [d, what] of Object.entries(deps)) {
  try { resolveDepFile(`${d}/package.json`); ok(`${d} (${what})`); }
  catch { fail(`${d} missing (${what})`, `npm install --prefix "${SKILL_DIR}"`); }
}

const browser = findBrowser();
if (browser) ok(`browser: ${browser}`);
else warn('No Edge/Chrome found in the usual places', 'Set SLIDE_BROWSER to the full path of msedge.exe or chrome.exe');
try {
  const b = await launchBrowser();
  await b.close();
  ok('headless browser starts');
} catch (e) {
  fail(`headless browser failed: ${e.message.split('\n')[0]}`, 'Set SLIDE_BROWSER to msedge.exe/chrome.exe; some locked-down PCs block headless mode — ask IT or try Chrome');
}

for (const py of ['python', 'python3', 'py']) {
  try {
    const out = execFileSync(py, ['-c', 'import pdfplumber, pypdfium2, PIL; import importlib.util as u; print("pptx" if u.find_spec("pptx") else "no-pptx")'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    ok(`${py}: style import packages present${out === 'no-pptx' ? ' (python-pptx missing: .pptx theme reading disabled)' : ''}`);
    break;
  } catch {
    if (py === 'py') warn('Python packages for style import not found (optional)', `pip install -r "${SKILL_DIR}/requirements.txt"`);
  }
}

console.log(bad ? `\n${bad} problem(s) to fix.` : '\nAll good.');
process.exitCode = bad ? 1 : 0;
