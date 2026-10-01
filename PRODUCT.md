# Product context

slide-creator turns local Markdown and business data into inspected PDF presentations and documents.
Its primary audience is GitHub Copilot users on restricted corporate Windows PCs, with npm/Node and
optional Python available and an installed Edge/Chrome browser.

The user chose a thin presentation production layer beside Impeccable. General art direction and
visual critique should use Impeccable when it is available. This project supplies the presentation
compiler and specific checks, rather than a competing general design assistant.

## Constraints

- Decks may contain proprietary data. Builds stay local and require no external image/font services.
- No admin installs or required system graphics tools. D2 is WASM, charts are npm packages.
- Installed Windows/Office fonts with fallbacks; use the existing browser.
- Editable Markdown source and PDF delivery; PowerPoint authoring is outside the product scope.
- Shared style tokens coordinate slides, diagrams, charts, icons and authored illustrations.

## Evidence and open questions

The pipeline has been exercised with Windows Edge and fixture decks. It still needs real GitHub
Copilot sessions on restricted corporate machines and real presentation briefs. Consistent styling and
mechanical checks do not establish persuasive composition or Claude Design-equivalent artistic quality.
Complex illustrations and photos need approved source artwork or an allowed generation workflow.
