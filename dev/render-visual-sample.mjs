// Rebuild the local raster illustration used to demonstrate photo treatments; no external imagery.
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { SKILL_DIR, loadStyle, resolveTokens, buildCss } from '../skill/slide-creator/scripts/lib/style.mjs';
import { launchBrowser } from '../skill/slide-creator/scripts/lib/project.mjs';
const style = await loadStyle('editorial');
const css = buildCss(style, resolveTokens(style), '');
const vars = Object.fromEntries([...css.matchAll(/(--[\w-]+): ([^;]+);/g)].map((m) => [m[1], m[2]]));
const source = await readFile(path.join(SKILL_DIR, 'assets/illustrations/layer-stack.svg'), 'utf8');
const svg = source.replace(/var\((--[\w-]+)\)/g, (_, key) => vars[key]);
const out = path.join(SKILL_DIR, 'examples/visual-story/images');
await mkdir(out, { recursive: true });
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 640 } });
  await page.setContent(`<body style="margin:0;background:${vars['--bg']}"><div style="width:1600px;height:640px">${svg}</div></body>`, { waitUntil: 'load' });
  await page.addStyleTag({ content: 'svg { display:block; width:1600px; height:640px; }' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out, 'stack.png') });
} finally { await browser.close(); }
console.log('Updated examples/visual-story/images/stack.png');
