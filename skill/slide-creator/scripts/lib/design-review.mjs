import { existsSync } from 'node:fs';
import path from 'node:path';
import { SKILL_DIR } from './style.mjs';

/** Build a ready-to-paste Impeccable critique prompt from this deck's local artifacts. */
export function buildDesignReview(cfg, tokens, report) {
  const rel = (file) => path.relative(cfg.projectDir, file).replace(/\\/g, '/') || '.';
  const deckName = cfg.name || path.basename(cfg.projectDir);
  const rawAudience = cfg.audience || cfg.targetAudience;
  const audience = rawAudience ? (Array.isArray(rawAudience) ? rawAudience.join(', ') : String(rawAudience)) : 'not specified; infer only from deck content';
  const styleDir = path.join(cfg.projectDir, 'styles', tokens.name);
  const styleSource = existsSync(path.join(styleDir, 'style.json'))
    ? rel(styleDir)
    : rel(path.join(SKILL_DIR, 'styles', tokens.name));
  const out = rel(cfg.outDir);
  const lines = [
    '# Impeccable design review handoff',
    '',
    'Copy the prompt below into your coding agent with Impeccable installed. The review uses this deck’s local render and source files; it does not run automatically during a build.',
    '',
    '```text',
    'Use your installed Impeccable skill to run `/impeccable critique` on this existing slide deck. Review the actual rendered pages and their source. Return prioritized, slide-specific findings with the observed issue, its effect on the audience, and the smallest source edit that would address it. Do not edit files during this critique.',
    '',
    `Deck: ${deckName}`,
    `Audience: ${audience}`,
    `Style and scheme: ${tokens.name} / ${tokens.scheme}`,
    `Page size: ${tokens.page.width} × ${tokens.page.height} CSS px; preserve this fixed page size${report?.partial ? ' (this report covers only selected slides)' : ''}.`,
    '',
    'Start with the contact sheet, then inspect every slide PNG at readable size, any corresponding issue PNG, the exported PDF, and inspect.html. Read report.md for measured and lint findings. Read the source deck, active style pack, and resolved token snapshot before recommending changes.',
    `Rendered HTML: ${out}/inspect.html`,
    `Contact sheet: ${out}/contact-sheet.png`,
    `Slide renders: ${out}/slides/slide-*.png`,
    `Issue renders: ${out}/slides/slide-*.issues.png (where present)`,
    `Exported PDF: ${out}/*.pdf (where PDF output is enabled)`,
    `Inspection report: ${out}/report.md and ${out}/report.json`,
    `Source deck: ${rel(cfg.deckPath)}`,
    `Active style sources: ${styleSource} (style.json and style.css)`,
    `Resolved style tokens: ${out}/tokens.json`,
    `Local source assets: ${rel(path.join(cfg.projectDir, 'images'))}/, ${rel(path.join(cfg.projectDir, 'illustrations'))}/, ${rel(path.join(cfg.projectDir, 'diagrams'))}/, ${rel(path.join(cfg.projectDir, 'charts'))}/`,
    '',
    'Constraints: use only fonts installed on the target Windows PCs and already listed in the active style. Keep assets local; do not introduce remote fonts, images, services, or build-time network access. The renderer must remain compatible with the existing offline JavaScript/WASM pipeline. The corporate style pack and its tokens take precedence over Impeccable defaults; recommend refinements within that system.',
    '',
    'Edit map for recommendations: change story, slide order, titles, and copy in the source deck; change recurring colors, type, spacing, icon/image treatment, and components in the active style JSON/CSS; change a one-off illustration or photo only in its local asset source. Do not prescribe inline styles or literal visual values in deck Markdown.',
    '',
    'Focus the critique on this deck’s specific hierarchy, page composition, image/illustration choices, crop, visual consistency, legibility, and style fidelity. Avoid generic design doctrine and do not claim a finding unless it is visible in the supplied render or supported by the report.',
    '```',
  ];
  if (report) lines.splice(5, 0, `Latest automatic review: ${report.errors ?? 0} errors, ${report.warnings ?? 0} warnings across ${report.slideCount ?? 'unknown'} slides. See the report for details.`, '');
  return lines.join('\n') + '\n';
}
