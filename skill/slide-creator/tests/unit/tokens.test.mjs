import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadConfig, injectLogos } from '../../scripts/lib/project.mjs';
import { loadStyle, resolveTokens } from '../../scripts/lib/style.mjs';

const showcase = path.resolve('examples/showcase');

test('density changes type, spacing and writing limits together', async () => {
  const style = await loadStyle('editorial');
  const standard = resolveTokens(style);
  const roomy = resolveTokens(style, 'default', { density: 'roomy' });
  const compact = resolveTokens(style, 'default', { density: 'compact' });
  assert.ok(roomy.type.scale.body > standard.type.scale.body);
  assert.ok(compact.type.scale.body < standard.type.scale.body);
  assert.ok(roomy.space.gutter > standard.space.gutter);
  assert.ok(compact.space.unit < standard.space.unit);
  assert.ok(roomy.rules.maxWords < standard.rules.maxWords);
  assert.ok(compact.rules.maxBullets > standard.rules.maxBullets);
  assert.equal(standard.density, 'standard');
});

test('page presets and a custom page become pixel dimensions', async () => {
  const cfg = await loadConfig(showcase);
  const style = await loadStyle(cfg.style);
  assert.deepEqual(resolveTokens(style, 'default', { page: '4:3' }).page, { width: 1280, height: 960 });
  assert.deepEqual(resolveTokens(style, 'default', { page: 'a4' }).page, { width: 1123, height: 794 });
  assert.deepEqual(resolveTokens(style, 'default', { page: 'letter-portrait' }).page, { width: 816, height: 1056 });
  assert.deepEqual(resolveTokens(style, 'default', { page: { width: 900, height: 600 } }).page, { width: 900, height: 600 });
  assert.throws(() => resolveTokens(style, 'default', { page: 'square' }), /page/i);
});

test('loadConfig passes deck knobs into token overrides', async () => {
  const cfg = await loadConfig(showcase, { density: 'compact', page: '4:3' });
  assert.equal(cfg.density, 'compact');
  assert.equal(cfg.overrides.density, 'compact');
  assert.equal(cfg.overrides.page, '4:3');
});

test('dark scheme displays the light logo artwork', async () => {
  const style = await loadStyle('editorial');
  const css = (await import('../../scripts/lib/style.mjs')).buildCss(style, resolveTokens(style, 'dark'), '');
  assert.match(css, /brand-logo-slot img\.dark \{ display: block; \}/);
});

test('logo is embedded on cover and closing with a dark variant', async () => {
  const cfg = { projectDir: showcase, logo: 'images/logo.svg', logoDark: 'images/logo-dark.svg' };
  const md = '<!-- _class: cover -->\n# Hello\n\n---\n\n<!-- _class: closing -->\n# Bye';
  const result = await injectLogos(md, cfg);
  assert.equal((result.match(/brand-logo-slot/g) || []).length, 2);
  assert.equal((result.match(/class="dark"/g) || []).length, 2);
  assert.match(result, /data:image\/svg\+xml;base64,/);
});
