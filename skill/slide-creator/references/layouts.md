# Layouts and components

Every style supports exactly this vocabulary. The style decides how each one looks.
Anything not listed here is a lint error.

Deck basics:

```markdown
---
paginate: true
header: 'Project name · Section'        # shown at the top (a bar in plant-floor)
footer: 'Confidential · Q3 review'
---

<!-- _class: cover -->
<!-- _paginate: false -->

###### Kicker text
# Title
Subtitle line

---

###### 02 · Section name
## Slide title

Body…

<!-- Speaker notes go in a comment at the end of the slide. -->
```

- `---` separates slides. `<!-- _class: name -->` sets the layout of one slide.
- `######` (h6) is the **kicker**: a small label above the title (chapter, section code).
- `#` is for cover / chapter / closing titles; `##` for every content slide.
- HTML components need a **blank line** between the HTML tag and any Markdown inside it.
- `<!-- _header: '' -->` / `<!-- _footer: '' -->` / `<!-- _paginate: false -->` hide them on one slide.

---

## Slide layouts (`<!-- _class: … -->`)

| Class | Use | Content |
|---|---|---|
| *(none)* | normal content slide | kicker, `##` title, body |
| `cover` | first slide | kicker, `#` title, one-line subtitle |
| `agenda` | contents / agenda | `## Agenda` + numbered list; `*3*` at the end of an item = page; **bold** item = current section |
| `chapter` | section divider | kicker (section number), `#` title, optional one sentence |
| `statement` | one big message | `#` sentence; `**words**` are highlighted |
| `diagram` | one diagram fills the slide | kicker, `##` title, `![w:1100](diagrams/x.svg)`, optional `<p class="caption">` |
| `chart` | one chart fills the slide | kicker, `##` title, `![w:1080](charts/x.svg)`, `<p class="source">` |
| `summary` | executive summary (best in boardroom) | `##` title + 3–5 bullets each starting with a **bold lead-in** |
| `dense` | appendix / detail tables | smaller text, higher word limit — use sparingly |
| `paper` | a body page in a **document** style (`editorial-whitepaper`) | `######` chapter pill, `#` page title, then `##`/`###` sections; text flows down the left column, then the right. Set `class: paper` in the front matter so it is the default. A `<div class="figure">` spans both columns. The column flow works in any style, but only document styles size the type for it |
| `section-summary` | short checkpoint in a document | `#` finding title and up to three evidence-led bullets; used in `examples/report` |
| `appendix` | references or supporting detail | `#` title and source list or compact table; used in `examples/report` |
| `comparison` | two alternatives and a recommendation | `##` conclusion, two `card` blocks in `cols`, then a `callout`; used in `examples/exec-summary` |
| `closing` | last slide | kicker, `#` question or next step |

Combine with a space: `<!-- _class: chart dense -->`.

Images: `![w:900](images/photo.jpg)`; Marp backgrounds also work: `![bg right:40%](images/line.jpg)`.

---

## Components (HTML inside Markdown)

### Columns
```html
<div class="cols">          <!-- also: cols3, cols4, cols-wide-left (2:1), cols-wide-right (1:2) -->
<div>

### Left heading
Markdown here.

</div>
<div>

### Right heading
Markdown here.

</div>
</div>
```

### Card — `card`, `card outline`
```html
<div class="cols3">
<div class="card">

### Fast
Text.

</div>
…
</div>
```

### KPI row — `kpis` > `kpi` (add `key` to the one that matters; `good` / `bad` colour the note)
```html
<div class="kpis">
<div class="kpi"><b>94 min</b><span>Average changeover</span><em>Target 45 min</em></div>
<div class="kpi key"><b>17 h</b><span>Capacity lost weekly</span><em>≈ 2 shifts</em></div>
</div>
```

### Single big number — `stat` + `label`
```html
<div class="stat">41%</div>
<div class="label">faster changeovers in eight weeks</div>
```

### Callout — `callout` (+ `good`, `warn`, `bad`, `info`)
```html
<div class="callout"><b>Lesson</b>The biggest gain came from kitting, not tooling.</div>
```

### Do / Don't
```html
<div class="cols">
<div class="do">

<b>Do</b>

Torque clamps to 40 Nm, then verify.

</div>
<div class="dont">

<b>Don't</b>

Tighten the clamps properly.

</div>
</div>
```

### Steps (horizontal process) — `ol.steps`, `li.on` marks the current step
```html
<ol class="steps">
<li><b>Film</b>Record three changeovers.</li>
<li class="on"><b>Shift</b>Move tasks before the stop.</li>
</ol>
```

### Timeline — `ol.timeline`, `li.done` past, `li.on` now
```html
<ol class="timeline">
<li class="done"><b>Q1</b>Pilot</li>
<li class="on"><b>Q2</b>Roll-out</li>
<li><b>Q3</b>Audit</li>
</ol>
```

### Checklist — `ul.check`, `li.done`
```html
<ul class="check">
<li class="done">Pilot reviewed</li>
<li>Approve budget</li>
</ul>
```

### Status tag — `tag` + `good` | `warn` | `bad` | `info` | `accent`
```html
<span class="tag good">On track</span>
```

### Source line (bottom of slide) — `source`
```html
<p class="source">Line 4 MES data, Jan–Mar</p>
```
The style adds the "Source:" prefix.

### Caption — `caption`
```html
<p class="caption">Only the highlighted step needs the line stopped.</p>
```

### Agenda tracker (top right of content slides) — `tracker`, `span.on` = current
```html
<div class="tracker"><span>Context</span><span class="on">Plan</span><span>Ask</span></div>
```

### Icons (Lucide, inlined at build) — `<i data-icon="name"></i>`, add `class="lg"` for large
Names: https://lucide.dev/icons (e.g. `factory`, `truck`, `wrench`, `shield-check`, `gauge`, `users`, `clock`).
Use icons to label, not to decorate: in KPI tiles, card headers, or agenda items — the same size everywhere.

### Tables
Plain Markdown tables. Add a `<span class="num">` around numbers you want right-aligned, or keep columns
of numbers short. Max ~6 rows × 5 columns on a normal slide; use `dense` for more.

### Utility classes
`muted`, `small`, `lede` (larger intro paragraph), `accent` (accent text), `hl` (highlighter),
`center`, `right`, `mt` (extra top space), `grow`, `kicker`.

---

## Picking a layout

| You want to… | Use |
|---|---|
| Open the deck | `cover` |
| Show the structure | `agenda` |
| Start a new part | `chapter` |
| Land one message | `statement` or `stat` |
| Show 2–4 numbers | `kpis` |
| Compare two options | `cols` with `card`s, or a table |
| Show good vs bad practice | `do` / `dont` |
| Explain a process | `steps` (≤5 steps) or a pipeline diagram |
| Show a plan over time | `timeline` (≤6 points) or a Gantt chart |
| Show how parts connect | `diagram` |
| Show a trend or comparison of numbers | `chart` |
| Summarise for executives | `summary` |
| Ask for a decision | `closing` (+ checklist on the slide before) |
# Automatic logo slot

When `slides.json` sets `logo`, the builder adds a `.brand-logo-slot` to cover and closing pages. The style controls its position and height; deck authors do not place or size it by hand. `logoDark` supplies light artwork for dark page backgrounds.
