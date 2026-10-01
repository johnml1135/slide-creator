# Authoring visuals

Choose a visual because it explains the slide's takeaway. Style tokens make a figure consistent with
the deck; they do not make its composition artistically good. Prefer established building blocks:
Lucide icons for recognizable objects, D2 for relationships and processes, and Vega-Lite for data.
Arrange these with the shared layouts before inventing illustration paths. For complex scenes,
characters, or detailed products, use approved assets supplied by the user.

## Reuse a reviewed composition

The bundled `assets/illustrations/layer-stack.svg` is a starting composition for a stack of related
layers. Copy it into the deck's `illustrations/` directory, give it a meaningful filename, and adapt
its labels. Adjust simple geometry only when the message requires it. Build and inspect the rendered
slide after every material change. Preserve its visual structure when you cannot reliably judge a new
composition; do not turn it into an unrelated scene merely because SVG accepts arbitrary paths.

Reuse a reviewed composition when its structure fits the message. When it does not fit, choose icons,
a diagram, or a chart instead. Keep labels short and reserve one accent for the main point.

## Include a local illustration

An SVG in `illustrations/` is validated and inlined so its colors and fonts can inherit the selected
style. Give it meaningful alternative text. A numeric `w:` option controls width:

```markdown
![Three layers connect the operating model w:900](illustrations/operating-model.svg)
```

The equivalent HTML syntax is supported:

```html
<img src="illustrations/operating-model.svg" alt="Three layers connect the operating model" width="900">
```

Keep paths local and inside `illustrations/`. Put ordinary supplied photographs and logos in `images/`.
The build creates the illustration's accessible title from its alternative text, adds
`class="illustration"`, and namespaces local IDs for each occurrence. Do not add these generated
attributes to the source SVG. Invalid illustrations produce build/lint errors rather than silently
falling back to an unstyled figure.

## Supported SVG profile

Use a plain SVG root with `xmlns="http://www.w3.org/2000/svg"` and a four-number `viewBox` whose width
and height are positive. Supported elements are:

`svg`, `g`, `path`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `rect`, `defs`,
`linearGradient`, `radialGradient`, `stop`, `clipPath`, `mask`, `pattern`, `use`, `text`, and `tspan`.

Use SVG presentation attributes for geometry, fills, strokes, transforms, opacity, and text. CSS
`style` attributes, `<style>`, scripts, event handlers, HTML/foreignObject, external resources,
DOCTYPE/entities, source title/desc elements, and source role/ARIA attributes are not accepted.
IDs must start with a letter or underscore and contain only letters, numbers, underscores, dots,
and hyphens. Local `href="#id"` and unquoted `url(#id)` references must match an ID in the same SVG.

Colors accept `none`, `currentColor`, `transparent`, a supported `var(--token)`, or a local
`url(#id)` paint reference. Literal colors are rejected. Font families must use supported
`var(--font-…)` tokens. Font size can use a supported `var(--fs-…)` token or a non-negative numeric
size with optional `px`, `em`, `rem`, or `%`; numeric sizes still need visual review after scaling.
Do not use variable fallbacks or CSS expressions: the accepted token form is exactly `var(--name)`.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 240">
  <rect x="20" y="20" width="860" height="200" rx="12"
        fill="var(--surface)" stroke="var(--rule)" stroke-width="2"/>
  <text x="60" y="130" fill="var(--ink)" font-family="var(--font-body)"
        font-size="var(--fs-body)">An operating layer with a short label</text>
</svg>
```

The accepted CSS token names are listed below. Prefix each with `--` inside `var()`.

| Purpose | Accepted names |
|---|---|
| Colors | `bg`, `surface`, `ink`, `muted`, `rule`, `primary`, `on-primary`, `accent`, `on-accent`, `accent-text`, `accent-soft`, `good`, `warn`, `bad`, `info`, `on-good`, `on-warn`, `on-bad`, `on-info`, `good-text`, `warn-text`, `bad-text`, `info-text`, `cat-1` through `cat-6`, `image-shade`, `image-on-shade` |
| Fonts and weights | `font-heading`, `font-body`, `font-mono`, `font-label`, `weight-heading`, `weight-body`, `weight-label` |
| Type treatment | `tracking-heading`, `tracking-label`, `case-heading`, `case-label`, `lh-tight`, `lh-body`, `measure` |
| Sizes | `fs-display`, `fs-h1`, `fs-h2`, `fs-h3`, `fs-body`, `fs-small`, `fs-caption`, `fs-label` |
| Geometry | `radius`, `radius-lg`, `rule-w`, `rule-w-strong`, `shadow`, `u`, `gutter`, `safe`, `page-w`, `page-h` |

Acceptance does not guarantee that a token makes sense in every SVG attribute. Choose a color token
for paint, a font token for font-family, and a size token for font-size. SVG text does not automatically
wrap like a paragraph: use short labels or explicit `tspan` lines. Check the rendered figure at its
actual slide size. The inspector warns when illustration labels become too small.

## Photos and review

Use the photo components and crop classes documented in [layouts.md](layouts.md#styled-illustrations-and-local-photos).
Their treatment values come from the [image style tokens](style-tokens.md#icons-and-imagery).
An opaque `photo-panel` gives text a predictable background. Tint, duotone, gradients, and translucent
shades require visual review and can obscure evidence.

Follow [visual-quality.md](visual-quality.md) for art direction, contrast coverage, and final PDF review.
Look at the contact sheet and the actual rendered slides; token consistency and a clean automated
report cannot judge whether a visual explains the idea well.
