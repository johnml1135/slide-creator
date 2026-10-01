#!/usr/bin/env node
// Build a deck: style → theme, diagrams (D2) → SVG, charts (Vega-Lite) → SVG, icons, Marp → PDF/PPTX/HTML,
// then run inspection (screenshots + checks) unless --no-inspect.
//
// Usage: node <skill>/scripts/build.mjs [projectDir] [--style name] [--scheme name] [--pdf] [--pptx] [--html] [--no-inspect]
//        [--slides 3,5-7]   quick check: inspect only those slides and skip the PDF unless --pdf/--pptx is given

import { readFile, writeFile, mkdir, readdir, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { SKILL_DIR, loadStyle, resolveTokens, buildCss, buildD2Header, buildVegaConfig, resolveTokenRefs } from './lib/style.mjs';
import { loadConfig, parseArgs, importDep, packageDir, findBrowser, splitFrontMatter, splitSlides, readSheet } from './lib/project.mjs';
import { finishPdf } from './pdf.mjs';

const args = parseArgs(process.argv.slice(2));
const projectDir = path.resolve(args._[0] || '.');
if (args.watch) {
  const { watch } = await import('./preview-server.mjs');
  await watch(projectDir, process.argv.slice(2).filter((a) => a !== '--watch'));
  await new Promise(() => {});
}
const formats = ['pdf', 'pptx', 'html'].filter((f) => args[f]);
const only = args.slides ? parseSlideList(String(args.slides)) : null;
const cfg = await loadConfig(projectDir, { style: args.style, scheme: args.scheme, out: args.out, formats: formats.length ? formats : undefined });
if (only && !formats.length) cfg.formats = [];
if (args.preview) cfg.formats = [];
const changed = args.changed ? new Set(String(args.changed).split('|').map((f) => f.replace(/\\/g, '/'))) : null;
const styleChanged = !changed || [...changed].some((f) => f.startsWith('styles/') || f === 'slides.json');
const shouldBuild = (dir, file, output) => styleChanged || changed.has(`${dir}/${file}`) || !existsSync(output);
const pdfName = `${slug(cfg.name || path.basename(projectDir))}.pdf`;

const log = (...m) => console.log('•', ...m);
const problems = [];

await mkdir(cfg.outDir, { recursive: true });

/* 1. Style → theme.css, d2 header, chart config */
let style, tokens;
try {
  style = await loadStyle(cfg.style, projectDir);
  tokens = resolveTokens(style, cfg.scheme, cfg.overrides);
} catch (e) { fail(e.message); }
const baseCss = await readFile(path.join(SKILL_DIR, 'assets', 'base.css'), 'utf8');
const themePath = path.join(cfg.outDir, 'theme.css');
await writeFile(themePath, buildCss(style, tokens, baseCss));
const d2Header = buildD2Header(style, tokens);
await writeFile(path.join(cfg.outDir, 'd2-header.d2'), d2Header);
const vegaConfig = buildVegaConfig(style, tokens);
await writeFile(path.join(cfg.outDir, 'chart-config.json'), JSON.stringify(vegaConfig, null, 2));
await writeFile(path.join(cfg.outDir, 'tokens.json'), JSON.stringify(tokens, null, 2));
log(`style: ${style.name} (${cfg.scheme})`);

/* 2. Diagrams */
const diagramDir = path.join(projectDir, 'diagrams');
if (existsSync(diagramDir)) {
  const files = (await readdir(diagramDir)).filter((f) => f.endsWith('.d2') && !f.startsWith('_'));
  const todo = files.filter((f) => shouldBuild('diagrams', f, path.join(cfg.outDir, 'diagrams', f.replace(/\.d2$/, '.svg'))));
  if (todo.length) {
    await mkdir(path.join(cfg.outDir, 'diagrams'), { recursive: true });
    let D2;
    try { ({ D2 } = await importDep('@terrastruct/d2')); } catch (e) { problems.push(e.message); }
    if (D2) {
      const d2 = new D2();
      const headerLines = d2Header.split('\n').length - 1;
      for (const f of todo) {
        const output = path.join(cfg.outDir, 'diagrams', f.replace(/\.d2$/, '.svg'));
        const src = await readFile(path.join(diagramDir, f), 'utf8');
        try {
          const result = await d2.compile(d2Header + src);
          const svg = await d2.render(result.diagram, result.renderOptions);
          await writeFile(output, svg);
          log(`diagram: ${f}`);
        } catch (e) {
          // D2 reports errors as a JSON array of {range, errmsg}; keep just the messages, with deck line numbers.
          let raw = String(e.message || e);
          try { raw = JSON.parse(raw).map((x) => x.errmsg).join('; '); } catch { /* plain text */ }
          const msg = raw.replace(/index:(\d+):(\d+)/g, (m, l, c) => `line ${+l > headerLines ? +l - headerLines : l}:${c}`);
          problems.push(`diagrams/${f}: ${msg}`);
        }
      }
      // The D2 WASM runs in a worker thread that never exits on its own; stop it so the build can finish.
      await d2.worker?.terminate();
    }
  }
}

/* 3. Charts */
const chartDir = path.join(projectDir, 'charts');
if (existsSync(chartDir)) {
  const files = (await readdir(chartDir)).filter((f) => f.endsWith('.json'));
  // A changed CSV or spreadsheet (next to the charts or in data/) can feed any chart, so redraw them all.
  const dataChanged = changed && [...changed].some((f) => (f.startsWith('charts/') && !f.endsWith('.json')) || f.startsWith('data/'));
  const todo = files.filter((f) => dataChanged || shouldBuild('charts', f, path.join(cfg.outDir, 'charts', f.replace(/(\.vl)?\.json$/, '.svg'))));
  if (todo.length) {
    await mkdir(path.join(cfg.outDir, 'charts'), { recursive: true });
    let vega, vl;
    try { vega = await importDep('vega'); vl = await importDep('vega-lite'); } catch (e) { problems.push(e.message); }
    if (vega && vl) {
      for (const f of todo) {
        const output = path.join(cfg.outDir, 'charts', f.replace(/(\.vl)?\.json$/, '.svg'));
        try {
          const spec = resolveTokenRefs(JSON.parse(await readFile(path.join(chartDir, f), 'utf8')), tokens);
          const inlineExcel = async (node) => {
            if (!node || typeof node !== 'object') return;
            if (node.data?.url && /\.xlsx$/i.test(node.data.url)) {
              const source = path.resolve(projectDir, node.data.url);
              const { headers, records } = await readSheet(source, node.data.sheet);
              if (!headers.length || headers.some((x) => !x)) throw new Error(`Excel file ${node.data.url} needs a header in every column`);
              node.data = { values: records };
            }
            for (const key of ['layer', 'hconcat', 'vconcat', 'concat'])
              for (const child of node[key] || []) await inlineExcel(child);
            if (node.spec) await inlineExcel(node.spec);
          };
          await inlineExcel(spec);
          const compiled = (vl.compile || vl.default.compile)(spec, { config: vegaConfig }).spec;
          const View = vega.View || vega.default.View;
          const parse = vega.parse || vega.default.parse;
          const makeLoader = vega.loader || vega.default.loader;
          const loader = makeLoader({ baseURL: projectDir + path.sep, mode: 'file' });
          const view = new View(parse(compiled), { renderer: 'none', loader });
          const svg = await view.toSVG();
          view.finalize();
          await writeFile(output, svg);
          log(`chart: ${f}`);
        } catch (e) {
          problems.push(`charts/${f}: ${e.message || e}`);
        }
      }
    }
  }
}

/* 4. Images */
const imgDir = path.join(projectDir, 'images');
if (existsSync(imgDir)) {
  if (!changed || !existsSync(path.join(cfg.outDir, 'images'))) await cp(imgDir, path.join(cfg.outDir, 'images'), { recursive: true });
  else for (const file of changed) if (file.startsWith('images/') && existsSync(path.join(imgDir, file.slice(7)))) {
    const output = path.join(cfg.outDir, file);
    await mkdir(path.dirname(output), { recursive: true });
    await cp(path.join(projectDir, file), output);
  }
}

/* 5. Deck: inline icons, normalise front matter */
if (!existsSync(cfg.deckPath)) fail(`Deck not found: ${cfg.deckPath} (create one with scripts/new.mjs)`);
let md = await readFile(cfg.deckPath, 'utf8');
md = await inlineIcons(md);
const { front, body } = splitFrontMatter(md);
const author = /^author:\s*["']?(.+?)["']?\s*$/m.exec(front)?.[1] || cfg.author;
const titles = splitSlides(md).map((s) => /^#{1,2}\s+(.+)$/m.exec(s.text)?.[1]?.replace(/<[^>]*>/g, '').trim());
const frontLines = front.split('\n').filter((l) => l.trim() && !/^\s*(theme|marp)\s*:/.test(l));
md = `---\nmarp: true\ntheme: slide-creator\n${frontLines.join('\n')}\n---\n${body}`;
const deckOut = path.join(cfg.outDir, 'deck.md');
await writeFile(deckOut, md);

/* 6. Marp */
const browser = findBrowser();
const marpBin = await marpCliPath().catch((e) => { problems.push(e.message); return null; });
if (marpBin) {
  const base = ['--theme', themePath, '--html', '--allow-local-files'];
  // A style may set markdown-it options, e.g. { "breaks": false } so wrapped prose reflows (document styles).
  if (style.markdown) {
    const marpConfig = path.join(cfg.outDir, 'marp.config.json');
    await writeFile(marpConfig, JSON.stringify({ options: { markdown: style.markdown } }, null, 2));
    base.push('--config-file', marpConfig);
  }
  const outputs = [];
  for (const f of cfg.formats) outputs.push([`--${f}`, '-o', path.join(cfg.outDir, f === 'pdf' ? pdfName : `deck.${f}`)]);
  outputs.push(['--html', '--template', 'bare', '-o', path.join(cfg.outDir, 'inspect.html')]);
  for (const o of outputs) {
    const code = await run(process.execPath, [marpBin, deckOut, ...base, ...o], browser ? { CHROME_PATH: browser } : {});
    if (code !== 0) problems.push(`marp ${o[0]} failed (exit ${code})`);
    else if (o[1] === '-o') {
      // PDF title: slides.json name, else the deck's title: front matter, else its first heading.
      const deckTitle = cfg.name || /^title:\s*["']?(.+?)["']?\s*$/m.exec(front)?.[1] || titles.find(Boolean) || path.basename(projectDir);
      if (o[0] === '--pdf') await finishPdf(o[2], deckTitle, author, titles);
      log(`${o[0].slice(2)}: ${path.relative(projectDir, o[2])}`);
    }
  }
}

if (problems.length) {
  console.error('\nBuild problems:\n' + problems.map((p) => '  ✗ ' + p).join('\n'));
}

/* 7. Inspect */
if (!args.preview && !args['no-inspect'] && existsSync(path.join(cfg.outDir, 'inspect.html'))) {
  const { inspect } = await import('./inspect.mjs');
  await inspect(cfg, { buildProblems: problems, only });
} else if (problems.length) {
  process.exitCode = 1;
}

/* ---------- helpers ---------- */
/** A mistake the user can fix: one plain line, no stack trace. */
function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function slug(value) {
  return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deck';
}

/** "3,5-7" → Set {3,5,6,7} */
function parseSlideList(text) {
  const set = new Set();
  for (const part of text.split(',').map((p) => p.trim()).filter(Boolean)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!m) throw new Error(`--slides: can't read "${part}"; use e.g. 3,5-7`);
    for (let i = +m[1]; i <= +(m[2] || m[1]); i++) set.add(i);
  }
  return set;
}
async function marpCliPath() {
  let pkgPath;
  try { pkgPath = path.join(packageDir('@marp-team/marp-cli'), 'package.json'); }
  catch { throw new Error(`Missing dependency "@marp-team/marp-cli". Run: npm install --prefix "${SKILL_DIR}"`); }
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.marp;
  return path.join(path.dirname(pkgPath), bin);
}

function run(cmd, argv, env = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => {
      if (code !== 0) console.error(err.trim());
      resolve(code);
    });
  });
}

async function inlineIcons(text) {
  const re = /<i\s+data-icon="([a-z0-9-]+)"(?:\s+class="([^"]*)")?\s*><\/i>/g;
  const names = [...new Set([...text.matchAll(re)].map((m) => m[1]))];
  if (!names.length) return text;
  let iconDir;
  try { iconDir = path.join(packageDir('lucide-static'), 'icons'); }
  catch { problems.push('Icons used but lucide-static is not installed (npm install in the skill folder).'); return text; }
  const svgs = {};
  for (const n of names) {
    const p = path.join(iconDir, `${n}.svg`);
    if (existsSync(p)) svgs[n] = (await readFile(p, 'utf8')).replace(/<!--[\s\S]*?-->/g, '').trim();
    else problems.push(`Unknown icon "${n}" — browse names at lucide.dev/icons`);
  }
  return text.replace(re, (m, n, cls) => svgs[n]
    ? svgs[n].replace(/\s(width|height)="[^"]*"/g, '').replace(/\sclass="[^"]*"/, '').replace('<svg', `<svg class="icon${cls ? ' ' + cls : ''}"`).replace(/\n\s*/g, ' ')
    : m);
}
