#!/usr/bin/env node
// Install (or update) this skill where GitHub Copilot and Claude look for skills, then install its npm
// packages and run doctor.
//
// Usage:
//   node <skill>/scripts/install.mjs --repo <path>            → <path>/.github/skills/slide-creator (one repo, shared via git)
//   node <skill>/scripts/install.mjs --repo <path> --cloud-agent   also add .github/workflows/copilot-setup-steps.yml
//   node <skill>/scripts/install.mjs --personal               → ~/.copilot/skills/slide-creator (all your projects)
//   node <skill>/scripts/install.mjs --to <folder>            → any skills folder, e.g. ~/.claude/skills/slide-creator
// Flags: --no-install (copy only), --force (overwrite an existing copilot-setup-steps.yml)

import { cp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { SKILL_DIR } from './lib/style.mjs';
import { parseArgs } from './lib/project.mjs';

const args = parseArgs(process.argv.slice(2));
const name = path.basename(SKILL_DIR);
let target, repo;
if (args.repo) {
  repo = path.resolve(args.repo === true ? '.' : args.repo);
  if (!existsSync(path.join(repo, '.git'))) console.warn(`! ${repo} has no .git folder; installing anyway.`);
  target = path.join(repo, '.github', 'skills', name);
} else if (args.personal) {
  target = path.join(os.homedir(), '.copilot', 'skills', name);
} else if (args.to && args.to !== true) {
  target = path.resolve(args.to.replace(/^~(?=$|[\\/])/, os.homedir()));
} else {
  console.error('Say where to install: --repo <path>, --personal, or --to <folder>. See the top of this file.');
  process.exit(2);
}
if (path.resolve(target) === path.resolve(SKILL_DIR)) {
  console.error('Target is this skill folder itself; nothing to do.');
  process.exit(2);
}

// Never copy installed packages or build output; they are machine-specific and large.
const SKIP = new Set(['node_modules', '__pycache__', '.DS_Store']);
const skip = (rel) => rel.split(/[\\/]/).some((p) => SKIP.has(p) || p === 'build' || p.startsWith('build-'));

// Replace everything except node_modules, so an update also removes files deleted upstream — but only in an
// empty folder or a previous install of this skill. Never empty a folder of other skills (--to ~/.claude/skills).
if (existsSync(target) && (await readdir(target)).length) {
  const prev = path.join(target, 'SKILL.md');
  const isPrevious = existsSync(prev) && new RegExp(`^name:\\s*${name}\\s*$`, 'm').test(await readFile(prev, 'utf8'));
  if (!isPrevious) {
    console.error(`✗ ${target} is not empty and is not a previous ${name} install; refusing to replace its contents.\n  Point --to at the skill's own folder, e.g. ${path.join(target, name)}`);
    process.exit(2);
  }
}
await mkdir(target, { recursive: true });
for (const e of await readdir(target)) if (e !== 'node_modules') await rm(path.join(target, e), { recursive: true, force: true });
await cp(SKILL_DIR, target, { recursive: true, filter: (src) => !skip(path.relative(SKILL_DIR, src)) });
console.log(`✓ copied skill to ${target}`);

if (repo) {
  const rel = path.relative(repo, target).split(path.sep).join('/');
  const tasks = path.join(repo, '.vscode', 'tasks.json');
  if (!existsSync(tasks)) {
    await mkdir(path.dirname(tasks), { recursive: true });
    await writeFile(tasks, JSON.stringify({ version: '2.0.0', tasks: [
      { label: 'Slides: preview (watch)', type: 'process', command: 'node', args: [`${'${workspaceFolder}'}/${rel}/scripts/build.mjs`, '${input:deckFolder}', '--watch'], isBackground: true, problemMatcher: [] },
      { label: 'Slides: build PDF', type: 'process', command: 'node', args: [`${'${workspaceFolder}'}/${rel}/scripts/build.mjs`, '${input:deckFolder}'], problemMatcher: [] },
    ], inputs: [{ id: 'deckFolder', type: 'promptString', description: 'Deck folder (relative to workspace root)', default: 'decks/my-deck' }] }, null, 2) + '\n');
    console.log('✓ wrote .vscode/tasks.json');
  }
  const prompts = {
    'new-deck.prompt.md': '---\nmode: agent\ndescription: Create a slide deck with the slide-creator skill\n---\n\nUse the slide-creator skill in `.github/skills/slide-creator/SKILL.md`. Ask for audience, message, slide count and source material if missing. Create the deck source in a folder, run a full build, inspect the report and rendered slides, then give the user the named PDF path.\n',
    'new-document.prompt.md': '---\nmode: agent\ndescription: Create a readable document with slide-creator\n---\n\nUse `.github/skills/slide-creator/SKILL.md` with the `editorial-whitepaper` style. Ask for audience, purpose and source material if missing. Create the Markdown source, build, inspect every page, and give the user the named PDF path.\n',
    'review-deck.prompt.md': '---\nmode: agent\ndescription: Review and improve a slide-creator deck\n---\n\nUse `.github/skills/slide-creator/SKILL.md`. Build the deck, read `build/report.md`, open the contact sheet and issue images, and fix clear content or layout problems in the source. Rebuild and report remaining issues and the named PDF path.\n',
  };
  const promptDir = path.join(repo, '.github', 'prompts');
  await mkdir(promptDir, { recursive: true });
  for (const [name, content] of Object.entries(prompts)) {
    const file = path.join(promptDir, name);
    if (!existsSync(file)) { await writeFile(file, content); console.log(`✓ wrote .github/prompts/${name}`); }
  }
  const gi = path.join(repo, '.gitignore');
  const text = existsSync(gi) ? await readFile(gi, 'utf8') : '';
  const line = `${rel}/node_modules/`;
  if (!text.split(/\r?\n/).includes(line)) {
    await writeFile(gi, text + (text && !text.endsWith('\n') ? '\n' : '') + `# slide-creator skill: npm packages are installed per machine\n${line}\n`);
    console.log(`✓ added ${line} to .gitignore`);
  }
  if (args['cloud-agent']) {
    const wf = path.join(repo, '.github', 'workflows', 'copilot-setup-steps.yml');
    if (existsSync(wf) && !args.force) {
      console.log(`! ${path.relative(repo, wf)} already exists; add these steps to its copilot-setup-steps job yourself (or rerun with --force):`);
      console.log(setupSteps(rel).split('\n').slice(1).join('\n'));
    } else {
      await mkdir(path.dirname(wf), { recursive: true });
      await writeFile(wf, setupWorkflow(rel));
      console.log(`✓ wrote ${path.relative(repo, wf)} (commit it to the default branch for Copilot cloud agent to use it)`);
    }
  }
}

if (!args['no-install']) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const cmd = existsSync(path.join(target, 'package-lock.json')) ? 'ci' : 'install';
  console.log(`\n• npm ${cmd} in ${target}`);
  const r = spawnSync(npm, [cmd, '--no-audit', '--no-fund'], { cwd: target, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) { console.error(`✗ npm ${cmd} failed (exit ${r.status})`); process.exit(1); }
  console.log('');
  spawnSync(process.execPath, [path.join(target, 'scripts', 'doctor.mjs')], { stdio: 'inherit' });
}

console.log(`\nDone. In Copilot agent mode (or Claude), ask for a deck, e.g. "Make a 10-slide boardroom deck on …",
or type /${name} in Copilot Chat.`);

function setupSteps(rel) {
  return `    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci --prefix ${rel}
      - run: node ${rel}/scripts/doctor.mjs`;
}

function setupWorkflow(rel) {
  return `# Prepares the environment for GitHub Copilot cloud agent before it starts work.
# Installs the slide-creator skill's npm packages; the runner's Google Chrome renders the slides.
name: Copilot Setup Steps

on:
  workflow_dispatch:
  push:
    paths: [.github/workflows/copilot-setup-steps.yml]
  pull_request:
    paths: [.github/workflows/copilot-setup-steps.yml]

jobs:
  copilot-setup-steps:   # this job name is required by Copilot
    runs-on: ubuntu-latest
    permissions:
      contents: read
${setupSteps(rel)}
`;
}
