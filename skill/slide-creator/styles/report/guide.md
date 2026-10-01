# Report style

US Letter portrait pages for a formal report, specification or audit. One column makes tables, numbered sections and figures easy to follow. The running header carries the document title; Marp prints the page number at the lower right.

Use `class: paper` in front matter for body pages. Add `header: 'Document title · section'` and change it with `<!-- _header: '…' -->` at a section boundary. Start with `cover`, then `agenda` for contents. Use `#` for page titles, `## 1 Section` and `### 1.1 Subsection` for numbered headings. Use `section-summary` for a short findings page and `appendix` for sources or reference material. Keep figures on their own line with a `<p class="caption">Figure 2 — …</p>` directly underneath. Use Markdown tables and `<div class="callout"><b>Finding</b>…</div>` for findings.

Keep body pages to roughly 300–450 words, less when they contain a figure or table. Write complete paragraphs, state the source of every number, and keep a recommendation close to its evidence. Use only the colours and fonts in `style.json`; edit the Markdown to change content. The sample report is `examples/report`.
