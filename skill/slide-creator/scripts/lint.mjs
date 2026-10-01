#!/usr/bin/env node
// Static checks on the sources (deck.md, diagrams/*.d2, charts/*.json) against the style rules.
// Used by inspect.mjs; can also run alone: node <skill>/scripts/lint.mjs [projectDir]

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIAGRAM_CLASSES, loadStyle, resolveTokens } from './lib/style.mjs';
import { loadConfig, parseArgs, splitSlides, readSheet } from './lib/project.mjs';

export const SLIDE_CLASSES = ['cover', 'agenda', 'chapter', 'statement', 'diagram', 'chart', 'closing', 'dense', 'summary', 'paper'];
export const COMPONENT_CLASSES = [
  'cols', 'cols3', 'cols4', 'cols-wide-left', 'cols-wide-right', 'card', 'outline', 'callout', 'good', 'warn', 'bad', 'info',
  'kpis', 'kpi', 'key', 'stat', 'label', 'do', 'dont', 'check', 'done', 'steps', 'on', 'timeline', 'tag', 'accent',
  'source', 'tracker', 'figure', 'caption', 'icon', 'lg', 'center', 'right', 'grow', 'mt', 'muted', 'lede', 'small',
  'hl', 'num', 'total', 'kicker',
  'brand-logo-slot',
];
const NO_TITLE_OK = ['cover', 'statement', 'chapter', 'closing'];
const HEX = /(?<![\w&/])#(?:[0-9a-fA-F]{3}){1,2}\b(?![\w-])/g;
const D2_KEYWORDS = new Set(['direction', 'vars', 'classes', 'style', 'label', 'shape', 'near', 'width', 'height', 'icon', 'tooltip', 'link', 'class', 'grid-rows', 'grid-columns', 'grid-gap', 'vertical-gap', 'horizontal-gap', 'constraint', 'source-arrowhead', 'target-arrowhead', 'layers', 'scenarios', 'steps', 'd2-config', 'top', 'left']);

export async function runLint(cfg, tokens) {
  const rules = tokens?.rules || {};
  const slideIssues = [];
  const globalIssues = [];
  const style = await loadStyle(cfg.style, cfg.projectDir);
  const allowed = new Set([...SLIDE_CLASSES, ...COMPONENT_CLASSES, ...(style.extraClasses || [])]);
  const maxWords = rules.maxWords ?? 45;
  const maxBullets = rules.maxBullets ?? 5;

  /* ---------- deck ---------- */
  const md = await readFile(cfg.deckPath, 'utf8');
  for (const s of splitSlides(md)) {
    const add = (severity, check, message, src) => slideIssues.push({ slide: s.index, severity, check, message, line: s.startLine, src });
    const prose = s.text.replace(/(```|~~~)[\s\S]*?\1/g, ' ');
    const classes = [...prose.matchAll(/<!--\s*_?class\s*:\s*([^>]*?)\s*-->/g)].flatMap((m) => m[1].split(/\s+/));
    const htmlClasses = [...prose.matchAll(/\bclass="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean);
    for (const c of new Set([...classes, ...htmlClasses])) {
      if (!allowed.has(c)) add('error', 'unknown-class', `Class "${c}" is not part of the design system (see references/layouts.md)`);
    }
    if (/\bstyle\s*=\s*"/.test(prose)) add('error', 'inline-style', 'Inline style="" is not allowed; use a layout or component class');
    if (/<style[\s>]/i.test(prose)) add('error', 'inline-style', '<style> blocks are not allowed in the deck; change the style pack instead');
    const hex = prose.replace(/<!--[\s\S]*?-->/g, '').match(HEX);
    if (hex) add('error', 'raw-colour', `Literal colour ${hex.join(', ')} in the deck; colours come only from the style`);

    const isClass = (c) => classes.includes(c);
    const words = prose
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[#*_>`|\-]+/g, ' ')
      .split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    const limit = isClass('dense') ? Math.round(maxWords * 1.6) : maxWords;
    if (words > limit * 1.5) add('error', 'too-many-words', `${words} words (limit ${limit}); split the slide or move detail to speaker notes`);
    else if (words > limit) add('warning', 'too-many-words', `${words} words (limit ${limit})`);

    const bullets = prose.split('\n').filter((l) => /^[-*+]\s+\S/.test(l) || /^\d+\.\s+\S/.test(l)).length;
    if (bullets > maxBullets && !isClass('agenda') && !isClass('dense')) add('warning', 'too-many-bullets', `${bullets} bullets (limit ${maxBullets})`);

    const title = /^#{1,2}\s+(.+)$/m.exec(prose);
    if (!title && !NO_TITLE_OK.some(isClass) && prose.trim()) add('warning', 'no-title', 'Slide has no # or ## title');
    if (title && rules.titleStyle === 'action' && /^##\s/m.test(prose) && !NO_TITLE_OK.some(isClass) && !isClass('agenda')) {
      const t = /^##\s+(.+)$/m.exec(prose)?.[1] || '';
      if (t.split(/\s+/).length < 5) add('warning', 'action-title', `Title "${t}" is a topic label; this style uses action titles that state the takeaway (≥5 words)`);
    }

    for (const m of prose.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) {
      const src = decodeURIComponent(m[1]); // a file name with spaces is written with %20
      if (/^(https?:|data:)/.test(src)) { add('warning', 'remote-image', `Remote image ${src}; use a local file so the deck builds offline`); continue; }
      const svgSource = /^(diagrams|charts)\/(.+)\.svg$/.exec(src);
      if (svgSource) {
        const [, kind, name] = svgSource;
        const exists = kind === 'diagrams' ? existsSync(path.join(cfg.projectDir, 'diagrams', `${name}.d2`))
          : ['.vl.json', '.json'].some((e) => existsSync(path.join(cfg.projectDir, 'charts', name + e)));
        if (!exists) add('error', 'missing-source', `${src} has no source file in ${kind}/`);
      } else if (!existsSync(path.join(cfg.projectDir, src))) add('error', 'missing-image', `Image not found: ${src}`, src);
    }
  }

  /* ---------- diagrams ---------- */
  const dDir = path.join(cfg.projectDir, 'diagrams');
  if (existsSync(dDir)) {
    for (const f of (await readdir(dDir)).filter((x) => x.endsWith('.d2') && !x.startsWith('_'))) {
      const file = `diagrams/${f}`;
      const add = (severity, check, message) => globalIssues.push({ severity, check, message, file });
      const src = await readFile(path.join(dDir, f), 'utf8');
      const code = src.replace(/#.*$/gm, '');
      if (/(^|[\s{.])style\s*[.:{]/m.test(code)) add('error', 'diagram-style', 'Direct style.* is not allowed; use class: box | key | quiet | group | link | good | warn | bad | info | note');
      const hex = code.match(HEX);
      if (hex) add('error', 'raw-colour', `Literal colour ${hex.join(', ')}; colours come only from the style`);
      const used = [...code.matchAll(/class\s*:\s*(\[[^\]]*\]|[\w-]+)/g)].flatMap((m) => m[1].replace(/[[\]]/g, '').split(/[;,\s]+/)).filter(Boolean);
      for (const c of new Set(used)) if (!DIAGRAM_CLASSES.includes(c)) add('error', 'diagram-class', `Unknown diagram class "${c}"`);
      const keys = used.filter((c) => c === 'key').length;
      if (keys > 1) add('warning', 'diagram-focus', `${keys} "key" nodes; use one so the eye knows where to land`);
      const nodes = new Set();
      for (const line of code.split('\n')) {
        if (/(->|<-|--)/.test(line)) {
          for (const part of line.split(/<->|->|<-|--/)) {
            const id = part.split(':')[0].split('{')[0].trim().replace(/^\(|\)$/g, '').split('.').pop();
            if (id) nodes.add(id);
          }
          continue;
        }
        const m = /^\s*("[^"]+"|[\w.-]+)\s*(:|\{|$)/.exec(line);
        if (m && !D2_KEYWORDS.has(m[1].split('.').pop()) && !/^\s*}/.test(line)) nodes.add(m[1].split('.').pop());
      }
      const n = [...nodes].filter((x) => !D2_KEYWORDS.has(x)).length;
      if (n > 14) add('error', 'diagram-size', `About ${n} nodes; split into two diagrams (aim for 3–8)`);
      else if (n > 9) add('warning', 'diagram-size', `About ${n} nodes; aim for 3–8 or group them`);
      for (const m of code.matchAll(/:\s*"([^"]+)"/g)) {
        if (m[1].split(/\s+/).length > 5) add('warning', 'diagram-label', `Long label "${m[1]}"; keep labels to 1–4 words and put detail on the slide`);
      }
    }
  }

  /* ---------- charts ---------- */
  const cDir = path.join(cfg.projectDir, 'charts');
  if (existsSync(cDir)) {
    for (const f of (await readdir(cDir)).filter((x) => x.endsWith('.json'))) {
      const file = `charts/${f}`;
      const add = (severity, check, message) => globalIssues.push({ severity, check, message, file });
      let spec;
      try { spec = JSON.parse(await readFile(path.join(cDir, f), 'utf8')); } catch (e) { add('error', 'chart-json', `Invalid JSON: ${e.message}`); continue; }
      if (spec.config) add('error', 'chart-config', 'Remove "config"; fonts, colours and axes come from the style');
      const hex = JSON.stringify(spec).match(HEX);
      if (hex) add('error', 'raw-colour', `Literal colour ${hex.join(', ')}; use "$accent", "$muted", "$cat1"… instead`);
      if (!spec.title) add('warning', 'chart-title', 'No title; state the takeaway in the chart title or the slide title');
      const [, mRight, , mLeft] = tokens.space.margin;
      const contentWidth = tokens.page.width - mLeft - mRight;
      if (spec.width && spec.width > contentWidth) add('warning', 'chart-size', `Width over ${contentWidth}px (the content width) will not fit the page`);
      const fieldsFor = async (data) => {
        if (!data) return null;
        if (data.values) return new Set(data.values.flatMap((row) => Object.keys(row)));
        if (!data.url || /^(https?:|data:)/i.test(data.url)) return null;
        const source = path.resolve(cfg.projectDir, data.url);
        if (!existsSync(source)) {
          add('error', 'missing-chart-data', `Data file not found: ${data.url}. Available fields: none (file missing)`);
          return null;
        }
        if (/\.xlsx$/i.test(data.url)) {
          try {
            return new Set((await readSheet(source, data.sheet)).headers.filter(Boolean));
          } catch (e) { add('error', 'chart-data', `Cannot read ${data.url}: ${e.message}`); return null; }
        }
        if (/\.csv$/i.test(data.url)) {
          const csv = await readFile(source, 'utf8');
          const header = csv.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0];
          return new Set([...header.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g)]
            .map((m) => (m[1] ?? m[2]).replace(/""/g, '"').trim()).filter(Boolean));
        }
        return null;
      };
      const checkNode = async (node, inherited) => {
        const fields = node.data ? await fieldsFor(node.data) : inherited;
        const derived = new Set();
        for (const transform of node.transform || []) {
          for (const value of [transform.calculate, transform.aggregate, transform.window, transform.joinaggregate, transform.bin, transform.timeUnit]) {
            if (Array.isArray(value)) for (const item of value) if (item.as) derived.add(item.as);
          }
          if (typeof transform.as === 'string') derived.add(transform.as);
          if (Array.isArray(transform.as)) transform.as.forEach((x) => derived.add(x));
        }
        if (fields) for (const [channel, encoding] of Object.entries(node.encoding || {})) {
          for (const entry of Array.isArray(encoding) ? encoding : [encoding]) {
            const field = entry?.field;
            if (field && !fields.has(field) && !derived.has(field))
              add('error', 'chart-field', `Encoding ${channel} uses missing field "${field}". Available fields: ${[...fields].join(', ') || '(none)'}`);
          }
        }
        for (const key of ['layer', 'hconcat', 'vconcat', 'concat'])
          for (const child of node[key] || []) await checkNode(child, fields);
        if (node.spec) await checkNode(node.spec, fields);
      };
      await checkNode(spec, null);
    }
  }

  return { slideIssues, globalIssues };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const cfg = await loadConfig(path.resolve(args._[0] || '.'), { style: args.style });
  const style = await loadStyle(cfg.style, cfg.projectDir);
  const t = resolveTokens(style, cfg.scheme, cfg.overrides);
  const { slideIssues, globalIssues } = await runLint(cfg, t);
  const all = [...globalIssues, ...slideIssues];
  for (const i of all) console.log(`${i.severity === 'error' ? '✗' : '!'} ${i.slide ? `slide ${i.slide}` : i.file}: [${i.check}] ${i.message}`);
  console.log(`${all.filter((i) => i.severity === 'error').length} errors, ${all.filter((i) => i.severity === 'warning').length} warnings`);
  if (all.some((i) => i.severity === 'error')) process.exitCode = 1;
}
