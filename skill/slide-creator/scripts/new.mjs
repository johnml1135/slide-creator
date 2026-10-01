#!/usr/bin/env node
// Create a new deck project.
// Usage: node <skill>/scripts/new.mjs <folder> [--style editorial|boardroom|plant-floor|<custom>] [--scheme default|dark]

import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from './lib/project.mjs';
import { findStyleDir } from './lib/style.mjs';

const args = parseArgs(process.argv.slice(2));
const dir = path.resolve(args._[0] || 'deck');
const style = args.style || 'editorial';
const scheme = args.scheme || 'default';
findStyleDir(style, dir); // throws if unknown

if (existsSync(dir) && (await readdir(dir)).length && !args.force) {
  console.error(`${dir} is not empty (use --force to add the starter files anyway).`);
  process.exit(1);
}
for (const d of ['diagrams', 'charts', 'images']) await mkdir(path.join(dir, d), { recursive: true });

const write = async (rel, text) => {
  const p = path.join(dir, rel);
  if (existsSync(p)) return console.log(`  kept     ${rel}`);
  await writeFile(p, text);
  console.log(`  created  ${rel}`);
};

await write('slides.json', JSON.stringify({ deck: 'deck.md', style, scheme, overrides: {}, out: 'build', formats: ['pdf'] }, null, 2) + '\n');

await write('deck.md', `---
paginate: true
header: 'Project name'
footer: 'Draft'
---

<!-- _class: cover -->
<!-- _paginate: false -->

###### Kicker
# Title that says what this deck is for
One-line subtitle.

---

###### 01 · Context
## A content slide title that states the point

- First supporting point
- Second supporting point
- Third supporting point

<!-- Speaker notes: put the detail here. -->

---

<!-- _class: diagram -->

###### 01 · Context
## How the pieces fit together

![w:1100](diagrams/overview.svg)

---

<!-- _class: closing -->

###### Next step
# What we need from you
`);

await write('diagrams/overview.d2', `direction: right

input: "Input" {class: quiet}
step1: "Step one" {class: box}
step2: "Key step" {class: key}
output: "Output" {class: box}

input -> step1 -> step2 -> output {class: link}
`);

await write('.gitignore', 'build/\n');

console.log(`\nNew ${style} deck in ${dir}\nNext: edit deck.md, then  node "${path.join(path.dirname(new URL(import.meta.url).pathname), 'build.mjs').replace(/^\/([A-Za-z]:)/, '$1')}" "${dir}"`);
