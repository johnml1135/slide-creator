#!/usr/bin/env node
// Build a deck: style → theme, diagrams (D2) → SVG, charts (Vega-Lite) → SVG, icons, Marp → PDF/HTML,
// then run inspection (screenshots + checks) unless --no-inspect.
//
// Usage: node <skill>/scripts/build.mjs [projectDir] [--style name] [--scheme name] [--density roomy|standard|compact]
//        [--page 16:9|4:3|letter|a4|…] [--pdf] [--html] [--no-inspect] [--out folder]
//        [--slides 3,5-7]   quick check: inspect only those slides and skip the PDF unless --pdf is given
//        [--watch]          live preview in the browser, rebuilt on every save (see preview-server.mjs)
// From code: import { build } from './build.mjs'; await build(projectDir, { style, formats: ['pdf'] })

import { readFile, writeFile, mkdir, readdir, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SKILL_DIR, loadStyle, resolveTokens, buildCss, buildD2Header, buildVegaConfig, resolveTokenRefs } from './lib/style.mjs';
import { loadConfig, parseArgs, importDep, packageDir, findBrowser, splitFrontMatter, splitSlides, readSheet, injectLogos } from './lib/project.mjs';
import { finishPdf } from './pdf.mjs';

/** A mistake the user can fix (unknown style, missing deck): shown as one plain line, no stack trace. */
export class UserError extends Error {}

/**
 * Build one deck project.
 * @param projectDir folder with deck.md (and slides.json, diagrams/, charts/, images/, data/)
 * @param o { style, scheme, out, density, page, formats: ['pdf'|'html'|'pptx'], slides: Set<number>,
 *            inspect = true, changed: Set<path> (rebuild only these sources), preview (HTML only, no inspection) }
 * @returns { cfg, problems: string[], report (inspection report, if run), pdf (path, if made) }
 */
export async function build(projectDir, o = {}) {
  projectDir = path.resolve(projectDir);
  const cfg = await loadConfig(projectDir, { style: o.style, scheme: o.scheme, out: o.out, density: o.density, page: o.page, formats: o.formats?.length ? o.formats : undefined });
  if ((o.slides && !o.formats?.length) || o.preview) cfg.formats = [];
  const changed = o.changed || null;
  const styleChanged = !changed || [...changed].some((f) => f.startsWith('styles/') || f === 'slides.json');
  const shouldBuild = (dir, file, output) => styleChanged || changed.has(`${dir}/${file}`) || !existsSync(output);
  const log = (...m) => console.log('•', ...m);
  const problems = [];
  let pdf;

  await mkdir(cfg.outDir, { recursive: true });

  /* 1. Style → theme.css, d2 header, chart config */
  let style, tokens;
  try {
    style = await loadStyle(cfg.style, projectDir);
    tokens = resolveTokens(style, cfg.scheme, cfg.overrides);
  } catch (e) { throw new UserError(e.message); }
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

  /* 5. Deck: inline icons and logos, normalise front matter */
  if (!existsSync(cfg.deckPath)) throw new UserError(`Deck not found: ${cfg.deckPath} (create one with scripts/new.mjs)`);
  let md = await readFile(cfg.deckPath, 'utf8');
  md = await inlineIcons(md, problems);
  md = await injectLogos(md, cfg);
  const { front, body } = splitFrontMatter(md);
  const author = /^author:\s*["']?(.+?)["']?\s*$/m.exec(front)?.[1] || cfg.author;
  const titles = splitSlides(md).map((s) => /^#{1,2}\s+(.+)$/m.exec(s.text)?.[1]?.replace(/<[^>]*>/g, '').trim());
  // PDF title: slides.json name, else the deck's title: front matter, else its first heading.
  const deckTitle = cfg.name || /^title:\s*["']?(.+?)["']?\s*$/m.exec(front)?.[1] || titles.find(Boolean) || path.basename(projectDir);
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
    const pdfName = `${slug(cfg.name || path.basename(projectDir))}.pdf`;
    const outputs = cfg.formats.map((f) => [`--${f}`, '-o', path.join(cfg.outDir, f === 'pdf' ? pdfName : `deck.${f}`)]);
    outputs.push(['--html', '--template', 'bare', '-o', path.join(cfg.outDir, 'inspect.html')]);
    for (const out of outputs) {
      const code = await run(process.execPath, [marpBin, deckOut, ...base, ...out], browser ? { CHROME_PATH: browser } : {});
      if (code !== 0) { problems.push(`marp ${out[0]} failed (exit ${code})`); continue; }
      if (out[1] !== '-o') continue;
      if (out[0] === '--pdf') { await finishPdf(out[2], deckTitle, author, titles); pdf = out[2]; }
      log(`${out[0].slice(2)}: ${path.relative(projectDir, out[2])}`);
    }
  }

  if (problems.length) console.error('\nBuild problems:\n' + problems.map((p) => '  ✗ ' + p).join('\n'));

  /* 7. Inspect */
  let report;
  if (!o.preview && o.inspect !== false && existsSync(path.join(cfg.outDir, 'inspect.html'))) {
    const { inspect } = await import('./inspect.mjs');
    report = await inspect(cfg, { buildProblems: problems, only: o.slides });
  }
  return { cfg, problems, report, pdf };
}

/* ---------- helpers ---------- */
function slug(value) {
  return String(value).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deck';
}

/** "3,5-7" → Set {3,5,6,7} */
export function parseSlideList(text) {
  const set = new Set();
  for (const part of text.split(',').map((p) => p.trim()).filter(Boolean)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!m) throw new UserError(`--slides: can't read "${part}"; use e.g. 3,5-7`);
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

async function inlineIcons(text, problems) {
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

/* ---------- command line: a thin adapter over build() ---------- */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const projectDir = path.resolve(args._[0] || '.');
  try {
    if (args.watch) {
      const { watch } = await import('./preview-server.mjs');
      await watch(projectDir, argv.filter((a) => a !== '--watch'));
    } else {
      const { problems, report } = await build(projectDir, {
        style: args.style, scheme: args.scheme, out: args.out, density: args.density, page: args.page,
        formats: ['pdf', 'pptx', 'html'].filter((f) => args[f]),
        slides: args.slides ? parseSlideList(String(args.slides)) : undefined,
        inspect: !args['no-inspect'], preview: !!args.preview,
        changed: args.changed ? new Set(String(args.changed).split('|').map((f) => f.replace(/\\/g, '/'))) : undefined,
      });
      if (problems.length || report?.errors) process.exitCode = 1;
    }
  } catch (e) {
    if (!(e instanceof UserError)) throw e;
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
