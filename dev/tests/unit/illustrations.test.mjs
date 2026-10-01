import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { inlineIllustrations, lintIllustrations, parseIllustration } from '../../../skill/slide-creator/scripts/lib/illustrations.mjs';
import { build } from '../../../skill/slide-creator/scripts/build.mjs';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><defs><linearGradient id="paint"><stop stop-color="var(--accent)"/></linearGradient><clipPath id="clip"><circle cx="50" cy="30" r="25"/></clipPath></defs><rect width="100" height="60" rx="6" fill="url(#paint)" clip-path="url(#clip)"/><path id="line" d="M10 30h80" stroke="var(--ink)" stroke-width="2"/><use href="#line"/></svg>`;

test('themed illustration gets an escaped accessible title and namespaced local references', () => {
  const result = parseIllustration(svg, { alt: 'A & <useful> diagram', instance: 4 });
  assert.deepEqual(result.errors, []);
  assert.match(result.svg, /aria-labelledby="ill-4-title"/);
  assert.match(result.svg, /fill="currentColor"/);
  assert.match(result.svg, /<title id="ill-4-title">A &amp; &lt;useful&gt; diagram<\/title>/);
  assert.match(result.svg, /id="ill-4-src-paint"/);
  assert.match(result.svg, /fill="url\(#ill-4-src-paint\)"/);
  assert.match(result.svg, /clip-path="url\(#ill-4-src-clip\)"/);
  assert.match(result.svg, /href="#ill-4-src-line"/);
});

test('illustration parser rejects unsafe markup, external references, hard-coded colors and unknown tokens', () => {
  for (const source of [
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.png"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" onload="alert(1)"/>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><g class="card"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><g style="fill:var(--accent)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect clip-path="url(\'#clip\')"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#ff0000" d="M0 0"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path fill="var(--made-up)" d="M0 0"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path fill="var(--font-body)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><text font-family="Arial">x</text></svg>',
  ]) assert.ok(parseIllustration(source, { alt: 'Test' }).errors.length > 0, source);
  assert.match(parseIllustration('<svg xmlns="http://www.w3.org/2000/svg"><path></svg>', { alt: 'Test' }).errors.join(' '), /malformed XML/);
  assert.match(parseIllustration('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 10"/>', { alt: 'Test' }).errors.join(' '), /viewBox/);
  assert.match(parseIllustration('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 NaN"/>', { alt: 'Test' }).errors.join(' '), /viewBox/);
  const font = parseIllustration('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text font-family="var(--font-heading)" font-size="var(--fs-body)">Text</text></svg>', { alt: 'Font sample' });
  assert.deepEqual(font.errors, []);
  const colors = parseIllustration('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"><stop stop-color="var(--image-on-shade)"/></linearGradient></defs><path fill="var(--cat-1)" stroke="var(--image-shade)"/></svg>', { alt: 'Color sample' });
  assert.deepEqual(colors.errors, []);
});

test('Markdown and HTML images inline, duplicate ids are scoped, and fences stay unchanged', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'slide-illustrations-'));
  try {
    await mkdir(path.join(dir, 'illustrations'));
    await writeFile(path.join(dir, 'illustrations', 'sample.svg'), svg);
    const source = [
      '![w:400 A small & clear map](illustrations/sample.svg)',
      '<img src="illustrations/sample.svg" alt="Second map">',
      '```md',
      '![example](illustrations/sample.svg)',
      '```',
    ].join('\n');
    const result = await inlineIllustrations(source, dir);
    assert.deepEqual(result.problems, []);
    assert.equal((result.markdown.match(/<svg/g) || []).length, 2);
    assert.match(result.markdown, /style="width:min\(100%, 400px\); max-width:100%"/);
    assert.match(result.markdown, /ill-1-src-paint/);
    assert.match(result.markdown, /ill-2-src-paint/);
    assert.match(result.markdown, /```md\n!\[example\]\(illustrations\/sample\.svg\)\n```/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('build rejects an invalid used illustration and lint reports invalid unused SVG assets', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'slide-illustrations-build-'));
  try {
    await mkdir(path.join(dir, 'illustrations'));
    await writeFile(path.join(dir, 'slides.json'), JSON.stringify({ style: 'editorial', out: 'build', formats: [] }));
    await writeFile(path.join(dir, 'deck.md'), '# Illustration check\n\n![Invalid used asset](illustrations/bad.svg)\n\n![w:400 Multiline map](illustrations/multiline.svg)\n');
    const invalid = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#ff0000"/></svg>';
    const multiline = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50">\n  <text x="2" y="20" font-family="var(--font-body)" font-size="var(--fs-body)">\n    A line of text\n  </text>\n</svg>`;
    await writeFile(path.join(dir, 'illustrations', 'bad.svg'), invalid);
    await writeFile(path.join(dir, 'illustrations', 'unused.svg'), invalid);
    await writeFile(path.join(dir, 'illustrations', 'multiline.svg'), multiline);
    const { problems } = await build(dir, { preview: true, inspect: false });
    assert.ok(problems.some((problem) => problem.includes('illustrations/bad.svg') && /literal or unsupported color/.test(problem)));
    const builtDeck = await readFile(path.join(dir, 'build', 'deck.md'), 'utf8');
    assert.match(builtDeck, /<span class="illustration-error"/);
    assert.doesNotMatch(builtDeck, /#ff0000/i);
    assert.doesNotMatch(builtDeck.match(/<svg[^>]*class="illustration"[\s\S]*?<\/svg>/)?.[0] || '', /\n/);
    const html = await readFile(path.join(dir, 'build', 'inspect.html'), 'utf8');
    const renderedIllustration = html.match(/<svg(?=[^>]*class="illustration")[^>]*>[\s\S]*?<\/svg>/)?.[0];
    assert.ok(renderedIllustration, 'Marp should keep the inline SVG illustration in its HTML output');
    assert.doesNotMatch(renderedIllustration, /<br\b/i);
    assert.match(renderedIllustration, /A line of text/);
    const lint = await lintIllustrations(dir);
    assert.deepEqual(lint.map((issue) => issue.file).sort(), ['illustrations/bad.svg', 'illustrations/unused.svg']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('invalid numeric HTML entities become a replacement character without throwing', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'slide-illustrations-entity-'));
  try {
    await mkdir(path.join(dir, 'illustrations'));
    await writeFile(path.join(dir, 'illustrations', 'sample.svg'), svg);
    const result = await inlineIllustrations('<img src="illustrations/sample.svg" alt="&#x110000;">', dir);
    assert.deepEqual(result.problems, []);
    assert.match(result.markdown, /<title[^>]*>�<\/title>/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('lint validates every SVG source in illustrations/', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'slide-illustrations-lint-'));
  try {
    await mkdir(path.join(dir, 'illustrations'));
    await writeFile(path.join(dir, 'illustrations', 'good.svg'), svg);
    await writeFile(path.join(dir, 'illustrations', 'bad.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><path stroke="red"/></svg>');
    const issues = await lintIllustrations(dir);
    assert.ok(issues.length >= 2);
    assert.ok(issues.some((issue) => /literal or unsupported color/.test(issue.message)));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
