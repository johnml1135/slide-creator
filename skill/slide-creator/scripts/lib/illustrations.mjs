import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const ELEMENTS = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern', 'use', 'text', 'tspan']);
const ATTRS = new Set(('xmlns xmlns:xlink id viewBox width height x y x1 y1 x2 y2 cx cy r rx ry d points transform fill fill-rule fill-opacity stroke stroke-width stroke-linecap stroke-linejoin stroke-opacity stroke-dasharray stroke-dashoffset opacity color display visibility vector-effect paint-order offset stop-color stop-opacity gradientUnits gradientTransform spreadMethod clipPathUnits maskUnits maskContentUnits patternUnits patternContentUnits patternTransform preserveAspectRatio href xlink:href clip-path mask font-family font-size font-weight font-style text-anchor dominant-baseline letter-spacing dx dy rotate').split(' '));
const COLOR_ATTRS = new Set(['fill', 'stroke', 'color', 'stop-color']);
const CSS_TOKENS = new Set([
  'bg', 'surface', 'ink', 'muted', 'rule', 'primary', 'on-primary', 'accent', 'on-accent', 'accent-text', 'accent-soft',
  'good', 'warn', 'bad', 'info', 'on-good', 'on-warn', 'on-bad', 'on-info', 'good-text', 'warn-text', 'bad-text', 'info-text',
  ...Array.from({ length: 6 }, (_, i) => `cat-${i + 1}`), 'font-heading', 'font-body', 'font-mono', 'font-label',
  'weight-heading', 'weight-body', 'weight-label', 'tracking-heading', 'tracking-label', 'case-heading', 'case-label',
  'lh-tight', 'lh-body', 'measure', 'radius', 'radius-lg', 'rule-w', 'rule-w-strong', 'bar-w', 'shadow', 'u', 'gutter', 'safe',
  'm-top', 'm-right', 'm-bottom', 'm-left', 'page-w', 'page-h', 'fs-display', 'fs-h1', 'fs-h2', 'fs-h3', 'fs-body', 'fs-small', 'fs-caption', 'fs-label',
  'icon-stroke', 'image-radius', 'image-aspect', 'image-fit', 'image-position', 'image-saturation', 'image-brightness',
  'image-overlay', 'image-shade', 'image-on-shade', 'image-duotone', 'logo-height', 'logo-top', 'logo-bottom', 'logo-left', 'logo-right', 'content-gap',
]);
const COLOR_TOKENS = new Set([
  'bg', 'surface', 'ink', 'muted', 'rule', 'primary', 'on-primary', 'accent', 'on-accent', 'accent-text', 'accent-soft',
  'good', 'warn', 'bad', 'info', 'on-good', 'on-warn', 'on-bad', 'on-info', 'good-text', 'warn-text', 'bad-text', 'info-text',
  ...Array.from({ length: 6 }, (_, i) => `cat-${i + 1}`), 'image-shade', 'image-on-shade',
]);

export function parseIllustration(source, { file = 'illustration.svg', alt, instance = 1, width } = {}) {
  const errors = [];
  const fail = (message) => { errors.push(`${file}: ${message}`); };
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(source)) return { errors: [`${file}: DOCTYPE and entity declarations are not allowed`] };
  const parser = new DOMParser({ onError: (level, message) => fail(`${level === 'warning' ? 'XML warning' : 'malformed XML'}: ${message}`) });
  let doc;
  try { doc = parser.parseFromString(source, 'image/svg+xml'); }
  catch (e) { return { errors: [`${file}: malformed XML: ${e.message}`] }; }
  if (errors.length) return { errors };
  const root = doc.documentElement;
  if (!root || root.localName !== 'svg' || root.namespaceURI !== 'http://www.w3.org/2000/svg') return { errors: [`${file}: root must be an SVG element with the SVG namespace`] };
  if (doc.doctype) fail('DOCTYPE is not allowed');
  for (let n = doc.firstChild; n; n = n.nextSibling) if (n !== root && n.nodeType !== 8) fail(`unsupported document-level XML node ${n.nodeName}`);
  const box = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (box.length !== 4 || !box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0) fail('viewBox must contain four finite numbers with positive width and height');
  if (!String(alt || '').trim()) fail('a non-empty alt description is required where the illustration is used');
  const ids = new Set();
  const refs = [];
  const walk = (node) => {
    if (node.nodeType !== 1) {
      if (node.nodeType === 7 || node.nodeType === 10) fail(`unsupported XML node: ${node.nodeName}`);
      return;
    }
    const name = node.localName;
    if (!ELEMENTS.has(name)) fail(`unsupported SVG element <${name}>`);
    if (node.namespaceURI !== 'http://www.w3.org/2000/svg') fail(`foreign namespace on <${name}> is not allowed`);
    for (let i = 0; i < node.attributes.length; i++) {
      const a = node.attributes.item(i), key = a.name, value = a.value.trim();
      if (key === 'xmlns' || key === 'xmlns:xlink') continue;
      if (/^on/i.test(key) || key === 'style' || key.startsWith('aria-') || key === 'role' || !ATTRS.has(key)) { fail(`unsupported or active attribute "${key}"`); continue; }
      if (key === 'id') {
        if (!/^[A-Za-z_][\w.-]*$/.test(value)) fail(`invalid SVG id "${value}"`);
        if (ids.has(value)) fail(`duplicate SVG id "${value}"`);
        ids.add(value);
      }
      if (COLOR_ATTRS.has(key) && !isColor(value)) fail(`literal or unsupported color "${value}" in ${key}; use currentColor or var(--token)`);
      if (key === 'font-family' && !isTokenVar(value, /^font-/)) fail(`font-family must use a style token, for example var(--font-body)`);
      if (key === 'font-size' && !isTokenVar(value, /^fs-/) && !/^\d+(?:\.\d+)?(?:px|em|rem|%)?$/.test(value)) fail(`unsupported font-size "${value}"`);
      if (key === 'href' || key === 'xlink:href') {
        if (!value.startsWith('#')) fail(`external reference "${value}" is not allowed`);
        refs.push(value.slice(1));
      }
      for (const match of value.matchAll(/url\(([^)]+)\)/g)) {
        const ref = match[1].trim().replace(/^['"]|['"]$/g, '');
        if (!/^#[A-Za-z_][\w.-]*$/.test(ref) || !/^url\(#[A-Za-z_][\w.-]*\)$/.test(value)) fail(`only canonical local fragment references are allowed in ${key}`);
        else refs.push(ref.slice(1));
      }
      if (/url\(/i.test(value) && !/^url\(#[A-Za-z_][\w.-]*\)$/.test(value)) fail(`invalid or external URL reference in ${key}`);
      if (/var\(/.test(value) && ![...value.matchAll(/var\(([^)]+)\)/g)].every((m) => isTokenVar(m[0]))) fail(`unknown CSS token in ${key}: ${value}`);
      if (/https?:|data:|javascript:|\\/i.test(value)) fail(`external or active value in ${key}`);
    }
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
  };
  walk(root);
  for (const ref of refs) if (!ids.has(ref)) fail(`reference #${ref} does not match a local id`);
  if (errors.length) return { errors };

  // Root title comes from Markdown's alt text so the same text is spoken consistently.
  const prefix = `ill-${instance}-src-`;
  const replaceIds = (node) => {
    if (node.nodeType === 1) {
      for (let i = 0; i < node.attributes.length; i++) {
        const a = node.attributes.item(i);
        if (a.name === 'id') a.value = prefix + a.value;
        else if (a.name === 'href' || a.name === 'xlink:href') a.value = `#${prefix}${a.value.slice(1)}`;
        else a.value = a.value.replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`);
      }
      for (let c = node.firstChild; c; c = c.nextSibling) replaceIds(c);
    }
  };
  replaceIds(root);
  root.setAttribute('class', 'illustration');
  if (!root.hasAttribute('fill')) root.setAttribute('fill', 'currentColor');
  if (width !== undefined && (!Number.isSafeInteger(Number(width)) || Number(width) <= 0 || Number(width) > 10000)) fail(`width must be an integer from 1 to 10000 pixels`);
  if (errors.length) return { errors };
  if (width && Number.isSafeInteger(Number(width)) && Number(width) > 0 && Number(width) <= 10000)
    root.setAttribute('style', `width:min(100%, ${Number(width)}px); max-width:100%`);
  root.setAttribute('role', 'img');
  const titleId = `ill-${instance}-title`;
  root.setAttribute('aria-labelledby', titleId);
  const title = doc.createElementNS(root.namespaceURI, 'title');
  title.setAttribute('id', titleId);
  title.appendChild(doc.createTextNode(String(alt).trim()));
  root.insertBefore(title, root.firstChild);
  const serialized = new XMLSerializer().serializeToString(root);
  // Marpit treats source newlines as Markdown hard breaks, which inserts <br> inside inline SVG.
  return { svg: serialized.replace(/\r?\n\s*/g, ' '), errors: [] };
}

function isTokenVar(value, prefix = '') {
  const m = /^var\(--([\w-]+)\)$/.exec(value);
  const prefixMatches = !prefix || (typeof prefix === 'string' ? m?.[1].startsWith(prefix) : prefix.test(m?.[1] || ''));
  return !!m && CSS_TOKENS.has(m[1]) && prefixMatches;
}
function isColor(value) {
  const token = /^var\(--([\w-]+)\)$/.exec(value)?.[1];
  return ['none', 'currentColor', 'transparent'].includes(value) || COLOR_TOKENS.has(token) || /^url\(#[A-Za-z_][\w.-]*\)$/.test(value);
}

export async function lintIllustrations(projectDir) {
  const dir = path.join(projectDir, 'illustrations');
  if (!existsSync(dir)) return [];
  const issues = [];
  const files = (await readdir(dir, { withFileTypes: true })).filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.svg'));
  for (const entry of files) {
    const result = parseIllustration(await readFile(path.join(dir, entry.name), 'utf8'), { file: `illustrations/${entry.name}`, alt: 'lint validation' });
    issues.push(...result.errors.map((message) => ({ severity: 'error', check: 'illustration-svg', message, file: `illustrations/${entry.name}` })));
  }
  return issues;
}

export async function inlineIllustrations(markdown, projectDir) {
  let instance = 0;
  const problems = [];
  const transform = async (text) => {
    const matches = [];
    const mdRe = /!\[([^\]]*)\]\((illustrations\/[^)\s]+\.svg)(?:\s+"[^"]*")?\)/gi;
    for (const m of text.matchAll(mdRe)) {
      const width = /(?:^|[,\s])w:(\d+)/.exec(m[1])?.[1];
      let src = m[2];
      try { src = decodeURIComponent(src); } catch { /* path validation reports malformed escaping */ }
      matches.push({ start: m.index, end: m.index + m[0].length, src, alt: m[1].replace(/(?:^|[,\s])w:\d+/g, '').trim(), width });
    }
    const htmlRe = /<img\b[^>]*>/gi;
    for (const m of text.matchAll(htmlRe)) {
      const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[0]);
      let srcValue = src?.[1] ?? src?.[2] ?? src?.[3];
      try { if (srcValue) srcValue = decodeURIComponent(srcValue); } catch { /* preserve it; path validation reports it */ }
      if (!srcValue || !/^illustrations\/[^\s]+\.svg$/i.test(srcValue)) continue;
      const altMatch = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[0]);
      const widthMatch = /\bwidth\s*=\s*(?:"(\d+)"|'(\d+)'|(\d+))/i.exec(m[0]);
      const width = widthMatch?.[1] ?? widthMatch?.[2] ?? widthMatch?.[3];
      const alt = decodeEntities(altMatch?.[1] ?? altMatch?.[2] ?? altMatch?.[3] ?? '');
      matches.push({ start: m.index, end: m.index + m[0].length, src: srcValue, alt, width });
    }
    matches.sort((a, b) => a.start - b.start);
    let output = '', cursor = 0;
    for (const item of matches) {
      if (item.start < cursor) continue;
      output += text.slice(cursor, item.start);
      const file = path.resolve(projectDir, item.src);
      if (!file.startsWith(path.resolve(projectDir, 'illustrations') + path.sep) || !existsSync(file)) {
        const message = `Illustration not found or outside illustrations/: ${item.src}`;
        problems.push(message); output += '<span class="illustration-error" aria-hidden="true"></span>';
      } else {
        const result = parseIllustration(await readFile(file, 'utf8'), { file: item.src, alt: item.alt, instance: ++instance, width: item.width });
        if (result.errors.length) { problems.push(...result.errors); output += '<span class="illustration-error" aria-hidden="true"></span>'; }
        else output += result.svg;
      }
      cursor = item.end;
    }
    return output + text.slice(cursor);
  };
  // Markdown fenced examples are literal content and must remain untouched.
  const chunks = markdown.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g);
  for (let i = 0; i < chunks.length; i += 2) chunks[i] = await transform(chunks[i]);
  return { markdown: chunks.join(''), problems };
}

function decodeEntities(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (whole, entity) => {
    if (entity[0] === '#') {
      const point = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : '\uFFFD';
    }
    return ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' })[entity.toLowerCase()];
  });
}
