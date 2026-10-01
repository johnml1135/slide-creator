// Style tokens → theme CSS, D2 diagram header, Vega-Lite chart config.
// style.json is the single source of truth; everything visual is generated from it.

import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const COLOR_ROLES = ['bg', 'surface', 'ink', 'muted', 'rule', 'primary', 'accent', 'good', 'warn', 'bad', 'info'];
export const DIAGRAM_CLASSES = ['box', 'key', 'quiet', 'group', 'link', 'good', 'warn', 'bad', 'info', 'note'];

/* ---------------- colour maths ---------------- */
export function hexToRgb(hex) {
  let h = String(hex).trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}
export function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const la = luminance(typeof a === 'string' ? hexToRgb(a) : a);
  const lb = luminance(typeof b === 'string' ? hexToRgb(b) : b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
export function mix(a, b, t) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex(x.map((v, i) => v + (y[i] - v) * t));
}
function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
/** Colour that reads on `bg`: keep `c` if it reaches `min` contrast, else move it toward ink until it does. */
export function readable(c, bg, ink, min = 4.5) {
  if (contrast(c, bg) >= min) return c;
  for (let t = 0.05; t <= 1; t += 0.05) {
    const m = mix(c, ink, t);
    if (contrast(m, bg) >= min) return m;
  }
  return ink;
}
/** Best text colour to place ON a filled colour. */
export function onColor(fill, light = '#FFFFFF', dark = '#111111') {
  return contrast(fill, light) >= contrast(fill, dark) ? light : dark;
}

/* ---------------- loading ---------------- */
export function styleDirs(projectDir) {
  const dirs = [];
  if (projectDir) dirs.push(path.join(projectDir, 'styles'));
  dirs.push(path.join(SKILL_DIR, 'styles'));
  return dirs;
}
export function findStyleDir(name, projectDir) {
  for (const d of styleDirs(projectDir)) {
    const p = path.join(d, name);
    if (existsSync(path.join(p, 'style.json'))) return p;
  }
  const available = styleDirs(projectDir).filter(existsSync).flatMap((d) => readdirSync(d).filter((n) => existsSync(path.join(d, n, 'style.json'))));
  throw new Error(`Style "${name}" not found. Available: ${[...new Set(available)].join(', ')}`);
}
export async function loadStyle(name, projectDir) {
  const dir = findStyleDir(name, projectDir);
  const style = JSON.parse(await readFile(path.join(dir, 'style.json'), 'utf8'));
  const cssPath = path.join(dir, 'style.css');
  style._dir = dir;
  style._css = existsSync(cssPath) ? await readFile(cssPath, 'utf8') : '';
  return style;
}

function deepMerge(a, b) {
  if (Array.isArray(b) || typeof b !== 'object' || b === null) return b === undefined ? a : b;
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b)) out[k] = deepMerge(out[k], v);
  return out;
}

const PAGE_PRESETS = {
  '16:9': { width: 1280, height: 720 },
  '4:3': { width: 1280, height: 960 },
  letter: { width: 1056, height: 816 },
  a4: { width: 1123, height: 794 },
  'letter-portrait': { width: 816, height: 1056 },
  'a4-portrait': { width: 794, height: 1123 },
};
const DENSITIES = {
  roomy: { type: 1.08, space: 1.15, words: 0.9, bullets: 0.8 },
  standard: { type: 1, space: 1, words: 1, bullets: 1 },
  compact: { type: 0.91, space: 0.86, words: 1.2, bullets: 1.2 },
};
function resolvePage(page) {
  const p = typeof page === 'string' ? PAGE_PRESETS[page] : page;
  if (!p || !Number.isFinite(p.width) || !Number.isFinite(p.height) || p.width <= 0 || p.height <= 0) {
    throw new Error(`Invalid page size ${JSON.stringify(page)}. Use 16:9, 4:3, letter, a4, letter-portrait, a4-portrait, or {width,height}.`);
  }
  return { width: Math.round(p.width), height: Math.round(p.height) };
}

/**
 * Resolve the final token set.
 * @param style    parsed style.json
 * @param scheme   scheme name ("default", "dark", …)
 * @param override optional { colors: {...}, type: {...}, … } from slides.json
 */
export function resolveTokens(style, scheme = 'default', override = {}) {
  const schemes = style.schemes || {};
  if (!schemes[scheme]) throw new Error(`Style "${style.name}" has no colour scheme "${scheme}". Available: ${Object.keys(schemes).join(', ')}`);
  const colors = deepMerge(schemes[scheme], override.colors || {});
  for (const r of COLOR_ROLES) if (!colors[r]) throw new Error(`Colour role "${r}" missing in scheme "${scheme}" of style "${style.name}"`);
  const density = override.density || 'standard';
  if (!DENSITIES[density]) throw new Error(`Unknown density "${density}". Use roomy, standard, or compact.`);
  const t = {
    name: style.name,
    scheme,
    density,
    colors,
    type: deepMerge(style.type, override.type || {}),
    space: deepMerge(style.space, override.space || {}),
    shape: deepMerge(style.shape, override.shape || {}),
    diagram: deepMerge(style.diagram, override.diagram || {}),
    chart: deepMerge(style.chart, override.chart || {}),
    rules: deepMerge(style.rules, override.rules || {}),
    // Page size in CSS px (96 per inch). Slides default to 16:9; a style may set e.g. US Letter landscape.
    page: resolvePage(override.page || style.page || '16:9'),
    logo: deepMerge(style.logo || { position: 'top-right', height: 44 }, override.logo || {}),
    content: override.content || style.content || 'center',
  };
  const d = DENSITIES[density];
  t.type.scale = Object.fromEntries(Object.entries(t.type.scale).map(([k, v]) => [k, Math.round(v * d.type)]));
  t.space.unit = Math.round(t.space.unit * d.space * 10) / 10;
  t.space.gutter = Math.round(t.space.gutter * d.space);
  t.space.margin = t.space.margin.map((v) => Math.round(v * (1 + (d.space - 1) * 0.35)));
  t.rules.maxWords = Math.round(t.rules.maxWords * d.words);
  t.rules.maxBullets = Math.round(t.rules.maxBullets * d.bullets);
  const c = t.colors;
  // Derived colours — never hand-written.
  // In a dark scheme ink is light, so the dark candidate for text on a fill is whichever of ink/bg is darker.
  const deep = contrast(c.ink, '#000000') < contrast(c.bg, '#000000') ? c.ink : c.bg;
  c.onPrimary = c.onPrimary || onColor(c.primary, '#FFFFFF', deep);
  // Diagram box labels: a literal nodeFill can clash with a scheme (e.g. white boxes in dark mode).
  const nodeFill = colorRef(t, t.diagram?.nodeFill) || '#FFFFFF';
  c.onNode = contrast(nodeFill, c.ink) >= 4.5 ? c.ink : onColor(nodeFill, '#FFFFFF', deep);
  c.onAccent = c.onAccent || onColor(c.accent, '#FFFFFF', '#111111');
  for (const s of ['good', 'warn', 'bad', 'info']) c['on' + s[0].toUpperCase() + s.slice(1)] = onColor(c[s], '#FFFFFF', '#111111');
  // Accent/warn used as TEXT must read on both the page and the surface panels.
  const darkerBg = contrast(c.bg, c.ink) < contrast(c.surface, c.ink) ? c.bg : c.surface;
  c.accentText = readable(c.accent, darkerBg, c.ink, 4.5);
  c.warnText = readable(c.warn, darkerBg, c.ink, 4.5);
  c.goodText = readable(c.good, darkerBg, c.ink, 4.5);
  c.badText = readable(c.bad, darkerBg, c.ink, 4.5);
  c.infoText = readable(c.info, darkerBg, c.ink, 4.5);
  c.accentSoft = rgba(c.accent, 0.28);
  c.categorical = c.categorical || [c.primary, c.accent, c.muted, c.info, c.warn, c.good];
  c.sequential = c.sequential || [c.surface, c.primary];
  return t;
}

/** Named colour lookup used by "$token" references in charts and diagram configs. */
export function tokenColor(t, name) {
  const c = t.colors;
  if (name in c && typeof c[name] === 'string') return c[name];
  const m = /^cat(\d)$/.exec(name);
  if (m) return c.categorical[(+m[1] - 1) % c.categorical.length];
  if (name === 'white') return '#FFFFFF';
  return undefined;
}
function colorRef(t, v) {
  if (!v) return v;
  if (String(v).startsWith('#')) return v;
  return tokenColor(t, v) ?? v;
}

/* ---------------- CSS ---------------- */
const quoteFont = (f) => (/[\s]/.test(f) && !/^["']/.test(f) ? `'${f}'` : f);
const fontStack = (fam) => (Array.isArray(fam) ? fam : [fam]).map(quoteFont).join(', ');

export function buildCss(style, t, baseCss) {
  const c = t.colors, ty = t.type, sp = t.space, sh = t.shape;
  // label.family wins (e.g. a sans for subheads beside a serif body); else label.font picks mono/heading/body.
  const labelFont = ty.label?.family || (ty.label?.font === 'mono' ? ty.mono.family : ty.label?.font === 'heading' ? ty.heading.family : ty.body.family);
  const [mt, mr, mb, ml] = sp.margin;
  const logoPosition = t.logo.position || 'top-right';
  if (!['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(logoPosition)) throw new Error(`Invalid logo position "${logoPosition}"`);
  const vars = {
    '--bg': c.bg, '--surface': c.surface, '--ink': c.ink, '--muted': c.muted, '--rule': c.rule,
    '--primary': c.primary, '--on-primary': c.onPrimary,
    '--accent': c.accent, '--on-accent': c.onAccent, '--accent-text': c.accentText, '--accent-soft': c.accentSoft,
    '--good': c.good, '--warn': c.warn, '--bad': c.bad, '--info': c.info,
    '--on-good': c.onGood, '--on-warn': c.onWarn, '--on-bad': c.onBad, '--on-info': c.onInfo, '--warn-text': c.warnText, '--good-text': c.goodText, '--bad-text': c.badText, '--info-text': c.infoText,
    ...Object.fromEntries(c.categorical.map((v, i) => [`--cat-${i + 1}`, v])),
    '--font-heading': fontStack(ty.heading.family), '--font-body': fontStack(ty.body.family), '--font-mono': fontStack(ty.mono.family),
    '--font-label': fontStack(labelFont),
    '--weight-heading': ty.heading.weight ?? 600, '--weight-body': ty.body.weight ?? 400, '--weight-label': ty.label?.weight ?? 600,
    '--tracking-heading': ty.heading.tracking ?? '0', '--tracking-label': ty.label?.tracking ?? '0.06em',
    '--case-heading': ty.heading.case === 'upper' || ty.heading.case === 'uppercase' ? 'uppercase' : 'none',
    '--case-label': ty.label?.case === 'uppercase' ? 'uppercase' : 'none',
    ...Object.fromEntries(Object.entries(ty.scale).map(([k, v]) => [`--fs-${k}`, `${v}px`])),
    '--lh-tight': ty.lineHeight.tight, '--lh-body': ty.lineHeight.body, '--measure': ty.measure || '32em',
    '--u': `${sp.unit}px`, '--m-top': `${mt}px`, '--m-right': `${mr}px`, '--m-bottom': `${mb}px`, '--m-left': `${ml}px`,
    '--gutter': `${sp.gutter}px`, '--safe': `${sp.safe ?? 32}px`,
    '--radius': `${sh.radius}px`, '--radius-lg': `${sh.radiusLarge ?? sh.radius}px`,
    '--rule-w': `${sh.rule}px`, '--rule-w-strong': `${sh.ruleStrong}px`, '--bar-w': `${Math.max(sh.ruleStrong, 3)}px`,
    '--shadow': sh.shadow || 'none',
    '--page-w': `${t.page.width}px`, '--page-h': `${t.page.height}px`,
    '--logo-height': `${t.logo.height}px`,
    '--logo-top': logoPosition.startsWith('top') ? 'var(--m-top)' : 'auto',
    '--logo-bottom': logoPosition.startsWith('bottom') ? 'var(--m-bottom)' : 'auto',
    '--logo-left': logoPosition.endsWith('left') ? 'var(--m-left)' : 'auto',
    '--logo-right': logoPosition.endsWith('right') ? 'var(--m-right)' : 'auto',
    '--content-gap': t.content === 'top' ? '0px' : 'auto',
  };
  const varBlock = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n');
  return [
    `/* @theme slide-creator */`,
    `/* GENERATED by slide-creator from styles/${style.name}/style.json (scheme: ${t.scheme}). Do not edit — edit style.json / style.css instead. */`,
    `section {\n${varBlock}\n}`,
    baseCss,
    // Marp reads the slide size from literal width/height on the root section rule, so emit them here.
    `section {
  width: ${t.page.width}px;
  height: ${t.page.height}px;
}`,
    `/* ---- ${style.name} personality ---- */`,
    style._css,
    t.scheme === 'dark' ? 'section:is(.cover, .closing) > .brand-logo-slot img.light { display: none; }\nsection:is(.cover, .closing) > .brand-logo-slot img.dark { display: block; }' : '',
  ].join('\n\n');
}

/* ---------------- D2 ---------------- */
export function buildD2Header(style, t) {
  const c = t.colors, d = t.diagram, ty = t.type;
  const fill = colorRef(t, d.nodeFill) || '#FFFFFF';
  const nodeStroke = colorRef(t, d.nodeStroke) || c.ink;
  const groupStroke = colorRef(t, d.groupStroke) || c.surface;
  const fs = d.fontSize || 18;
  // D2 only accepts whole-number stroke widths (0-15).
  const sw = Math.min(15, Math.max(1, Math.round(d.stroke ?? 1)));
  const mono = d.monoLabels ? '\n      font: mono' : '';
  const status = (k) => `  ${k}: {
    style: {
      fill: "${c[k]}"
      stroke: "${c[k]}"
      stroke-width: ${sw}
      border-radius: ${d.radius}
      font-color: "${c['on' + k[0].toUpperCase() + k.slice(1)]}"
      font-size: ${fs}
      bold: true
    }
  }`;
  const colourVars = Object.entries(c)
    .filter(([, v]) => typeof v === 'string' && v.startsWith('#'))
    .map(([k, v]) => `  ${k}: "${v}"`).join('\n');
  return `# ---- GENERATED by slide-creator (style: ${style.name}, scheme: ${t.scheme}). Your diagram starts below. ----
vars: {
${colourVars}
  d2-config: {
    layout-engine: ${d.layoutEngine || 'elk'}
    pad: ${d.pad ?? 32}
    sketch: ${d.sketch ? 'true' : 'false'}
  }
}
style.fill: transparent

classes: {
  box: {
    style: {
      fill: "${fill}"
      stroke: "${nodeStroke}"
      stroke-width: ${sw}
      border-radius: ${d.radius}
      font-color: "${c.onNode}"
      font-size: ${fs}
    }
  }
  key: {
    style: {
      fill: "${c.accent}"
      stroke: "${c.accent}"
      stroke-width: ${sw}
      border-radius: ${d.radius}
      font-color: "${c.onAccent}"
      font-size: ${fs}
      bold: true
    }
  }
  quiet: {
    style: {
      fill: "${c.bg}"
      stroke: "${c.muted}"
      stroke-width: ${Math.max(1, sw - 1)}
      stroke-dash: 4
      border-radius: ${d.radius}
      font-color: "${c.muted}"
      font-size: ${fs - 2}
    }
  }
  group: {
    style: {
      fill: "${c.surface}"
      stroke: "${groupStroke}"
      stroke-width: ${sw}
      stroke-dash: ${d.groupDash ?? 0}
      border-radius: ${t.shape.radiusLarge ?? d.radius}
      font-color: "${c.muted}"
      font-size: ${Math.max(12, fs - 2)}
      bold: true${mono}
    }
  }
  link: {
    style: {
      stroke: "${c.ink}"
      stroke-width: ${sw}
      font-color: "${c.muted}"
      font-size: ${Math.max(12, fs - 2)}
    }
  }
  note: {
    shape: text
    style: {
      font-color: "${c.muted}"
      font-size: ${Math.max(12, fs - 1)}
      italic: true
    }
  }
${status('good')}
${status('warn')}
${status('bad')}
${status('info')}
}
# ---- end of generated header ----
`;
}

/* ---------------- Vega-Lite ---------------- */
export function buildVegaConfig(style, t) {
  const c = t.colors, ch = t.chart, ty = t.type;
  const font = (Array.isArray(ty.body.family) ? ty.body.family : [ty.body.family]).join(', ');
  // Chart titles follow the subhead font when a style sets one (label.family), else the heading font.
  const titleFam = ty.label?.family || ty.heading.family;
  const titleFont = (Array.isArray(titleFam) ? titleFam : [titleFam]).join(', ');
  const fs = ch.fontSize || 14;
  const gridY = ch.grid === 'y' || ch.grid === 'both';
  const gridX = ch.grid === 'x' || ch.grid === 'both';
  const axis = {
    labelColor: c.muted, titleColor: c.muted, domainColor: c.rule, tickColor: c.rule, gridColor: c.rule,
    labelFont: font, titleFont: font, labelFontSize: fs, titleFontSize: fs, titleFontWeight: 600,
    labelPadding: 6, titlePadding: 10, gridWidth: 1,
  };
  return {
    background: null,
    padding: 8,
    font,
    view: { stroke: null, continuousWidth: ch.width ?? 1000, continuousHeight: ch.height ?? 420, ...(ch.width ? { discreteWidth: ch.width } : {}) },
    title: { color: c.ink, font: titleFont, fontSize: fs + 6, fontWeight: 600, anchor: 'start', offset: 16, subtitleColor: c.muted, subtitleFont: font, subtitleFontSize: fs },
    axis,
    axisX: { grid: gridX, ticks: true, labelAngle: 0 },
    axisY: { grid: gridY, domain: false, ticks: false },
    axisBand: { grid: false },
    legend: { labelColor: c.ink, titleColor: c.muted, labelFont: font, titleFont: font, labelFontSize: fs, titleFontSize: fs, orient: 'top', symbolType: 'square', direction: 'horizontal' },
    header: { labelColor: c.ink, titleColor: c.muted, labelFont: font, titleFont: font, labelFontSize: fs },
    range: { category: c.categorical, ordinal: c.sequential, ramp: c.sequential, heatmap: c.sequential, diverging: [c.bad, c.surface, c.info] },
    mark: { color: colorRef(t, ch.emphasis) || c.primary },
    bar: { cornerRadiusEnd: ch.barRadius ?? 0, color: colorRef(t, ch.emphasis) || c.primary },
    line: { strokeWidth: ch.lineWidth ?? 2.5, color: colorRef(t, ch.emphasis) || c.primary },
    point: { filled: true, size: 70 },
    rule: { color: c.muted },
    text: { color: c.ink, font, fontSize: fs },
    area: { opacity: 0.85 },
  };
}

/** Replace "$token" strings anywhere in a JSON value with resolved colours. */
export function resolveTokenRefs(value, t) {
  if (typeof value === 'string' && value.startsWith('$')) {
    const v = tokenColor(t, value.slice(1));
    if (v === undefined) throw new Error(`Unknown colour token "${value}". Use one of: $${Object.keys(t.colors).filter((k) => typeof t.colors[k] === 'string').join(', $')}, $cat1…$cat6`);
    return v;
  }
  if (Array.isArray(value)) return value.map((v) => resolveTokenRefs(v, t));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveTokenRefs(v, t)]));
  return value;
}
