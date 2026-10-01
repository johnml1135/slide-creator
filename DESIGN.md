# Presentation design contract

The incumbent visual systems are the seven style packs in `skill/slide-creator/styles/`. Each pack has
`style.json`, `style.css` and a guide. Generated `gallery/` examples are visual evidence of those styles.

For Impeccable reviews, preserve the selected corporate identity and presentation facts. Propose changes
through the relevant source: Markdown content/layout, style tokens/CSS, D2, Vega-Lite or local assets.
Use `skill/slide-creator/references/impeccable.md` and a deck's generated `build/design-review.md`.

## Rendering contract

- Shared components live in base.css, the linter allowlist and layouts.md.
- Colours and fonts come from style.json. Authored SVGs inherit approved variables.
- Icons come from Lucide; diagrams from D2; charts from Vega-Lite.
- Reuse reviewed compositions for exact vector geometry; supply detailed artwork as local assets.
- Photo treatments are opt-in. An opaque caption panel offers measurable text contrast.
- Inspect actual slide PNGs and exported PDFs. Automatic checks are technical evidence, not art direction.

PDF pages have fixed geometry. Responsive web/mobile controls, animation and interface states are not
presentation requirements. Generic frontend detector findings must be interpreted against the brief,
installed-font policy and the selected style; do not weaken those constraints to silence a warning.
