// Project (deck folder) helpers: config, paths, browser discovery, module loading.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { SKILL_DIR } from './style.mjs';

export const DEFAULT_CONFIG = {
  deck: 'deck.md',
  style: 'editorial',
  scheme: 'default',
  overrides: {},
  out: 'build',
  formats: ['pdf'],
};

/** Read <project>/slides.json (all fields optional). CLI flags override it. */
export async function loadConfig(projectDir, cli = {}) {
  const p = path.join(projectDir, 'slides.json');
  const file = existsSync(p) ? JSON.parse(await readFile(p, 'utf8')) : {};
  const cfg = { ...DEFAULT_CONFIG, ...file };
  for (const k of ['style', 'scheme', 'deck', 'out']) if (cli[k]) cfg[k] = cli[k];
  if (cli.formats) cfg.formats = cli.formats;
  cfg.projectDir = path.resolve(projectDir);
  cfg.outDir = path.resolve(projectDir, cfg.out);
  cfg.deckPath = path.resolve(projectDir, cfg.deck);
  return cfg;
}

/** Tiny argv parser: --key value, --flag, positional. */
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) out[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

/** Import a dependency installed in the skill folder (or anywhere Node can see). */
export async function importDep(name, fallbacks = []) {
  const req = createRequire(path.join(SKILL_DIR, 'package.json'));
  for (const n of [name, ...fallbacks]) {
    try {
      const resolved = req.resolve(n);
      return await import(pathToFileURL(resolved).href);
    } catch { /* try next */ }
    try { return await import(n); } catch { /* try next */ }
  }
  throw new Error(`Missing dependency "${name}". Run: npm install --prefix "${SKILL_DIR}"`);
}

export function resolveDepFile(spec) {
  const req = createRequire(path.join(SKILL_DIR, 'package.json'));
  return req.resolve(spec);
}

/** Folder of an installed package. Unlike resolving "<pkg>/package.json", this works when the
 *  package's "exports" map hides package.json (d2, vega, vega-lite do). Throws if not installed. */
export function packageDir(name) {
  const req = createRequire(path.join(SKILL_DIR, 'package.json'));
  for (const dir of req.resolve.paths(name) || []) {
    if (existsSync(path.join(dir, name, 'package.json'))) return path.join(dir, name);
  }
  throw new Error(`Missing dependency "${name}". Run: npm install --prefix "${SKILL_DIR}"`);
}

/** Find an installed Chromium-family browser (Edge first — it is on every corporate Windows PC). */
export function findBrowser() {
  const env = process.env.SLIDE_BROWSER || process.env.CHROME_PATH;
  if (env && existsSync(env)) return env;
  const pf = process.env['PROGRAMFILES'] || 'C:\\Program Files';
  const pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const candidates = [
    path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ];
  return candidates.find((c) => existsSync(c)) || null;
}

/** Launch headless Chromium via playwright-core using the installed browser. */
export async function launchBrowser() {
  const pw = await importDep('playwright-core', ['playwright']);
  const chromium = pw.chromium || pw.default?.chromium;
  const executablePath = findBrowser();
  if (executablePath) return chromium.launch({ executablePath, headless: true });
  for (const channel of ['msedge', 'chrome']) {
    try { return await chromium.launch({ channel, headless: true }); } catch { /* next */ }
  }
  throw new Error('No Chromium-based browser found. Set SLIDE_BROWSER to the path of msedge.exe or chrome.exe.');
}

export function splitFrontMatter(md) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md);
  if (!m) return { front: '', body: md };
  return { front: m[1], body: md.slice(m[0].length) };
}

/** Split Marp markdown into slides (ignores --- inside code fences). Returns [{index, text, startLine}] */
export function splitSlides(md) {
  const { front, body } = splitFrontMatter(md);
  const offset = front ? front.split('\n').length + 2 : 0;
  const lines = body.split(/\r?\n/);
  const slides = [];
  let cur = [], start = 0, inFence = false;
  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (!inFence && /^\s*---\s*$/.test(line)) {
      slides.push({ text: cur.join('\n'), startLine: start + offset + 1 });
      cur = []; start = i + 1;
    } else cur.push(line);
  });
  slides.push({ text: cur.join('\n'), startLine: start + offset + 1 });
  return slides.map((s, i) => ({ ...s, index: i + 1 }));
}
