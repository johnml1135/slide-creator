# Optional Impeccable review

After a build with inspection enabled, `build/design-review.md` contains a prompt you can paste into an agent session with Impeccable installed. It points the reviewer to the rendered HTML, contact sheet, per-slide PNGs, PDF, report, source deck, style pack, and resolved tokens. The build only writes this handoff; it does not install Impeccable, call an agent, or claim a critique was performed.

Impeccable is an optional external skill. To install it for Codex and GitHub Copilot in the current project, run this from the deck project root when npm registry and engine download access are allowed:

```sh
npx impeccable install --providers=codex,github --scope=project --no-hooks -y
```

The `--no-hooks` flag keeps the install manual; use `/impeccable critique` when you want a review. Impeccable's npm installer requires Node 22.18 or newer. The slide-creator build itself does not depend on Impeccable or require that Node version. The Impeccable launcher may fetch its engine binary on first use, so an offline corporate environment needs the package and binary already available through an approved cache or mirror. See the [official Impeccable install and usage guide](https://github.com/pbakaus/impeccable#installation) and [npm package requirements](https://github.com/pbakaus/impeccable/blob/main/README.npm.md).

Keep the active corporate style pack in control of colors, type, spacing, components, and recurring visual treatment. Use Impeccable to critique the actual rendered pages and suggest specific improvements that fit those constraints. Apply any accepted recommendation in the Markdown deck, style JSON/CSS, or local assets, then rebuild and inspect the result with slide-creator's normal checks.


The boundary is deliberately small: Impeccable directs and critiques; slide-creator compiles the resulting
Markdown, style tokens and local assets. It does not vendor Impeccable, recreate its commands, or run
image-generation services. Impeccable's image workflows can produce assets on an approved machine;
transfer approved results into `images/` and keep the corporate build offline.

For a new direction, use Impeccable against the local HTML preview and presentation brief. Record the
agreed direction in the style pack, then compile it through the same pipeline. For an existing corporate
identity, start with critique of the generated handoff and preserve that identity. If the agent can only
read source and cannot view the rendered pages, mark the visual review as incomplete.
