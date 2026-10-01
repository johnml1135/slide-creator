# Diagrams (D2)

D2 turns a text description of boxes and arrows into a laid-out SVG. You decide **what** is connected and
**which class** each thing is; the layout engine places it and the style colours it. You never set colours,
fonts or sizes — the build prepends a generated header (`build/d2-header.d2`) with the style's classes.

Docs: https://d2lang.com (Tour → Shapes, Connections, Containers, Grid diagrams).

## File rules

- One diagram per file: `diagrams/<what-it-shows>.d2` → referenced as `diagrams/<what-it-shows>.svg`.
- Start with a `direction:` line. `right` for processes and flows, `down` for hierarchies and stacks.
- Every node and edge gets a `class`. Never write `style.…`, hex colours or `vars`.
- 3–8 nodes. More than ~9 → group them in containers or split into two diagrams.
- Labels 1–4 words, sentence case. Group labels in CAPITALS if the style guide says so.
- Exactly one `key` node — where the eye should land. Zero is fine for neutral overviews.
- Edge labels optional, ≤2 words.
- Files starting with `_` are ignored (use for drafts).

## Classes

| Class | For | Looks like (varies by style) |
|---|---|---|
| `box` | normal step, component, actor | plain box |
| `key` | the one thing that matters | accent-filled |
| `quiet` | external, optional, future, out of scope | dashed, muted |
| `group` | container holding related nodes | soft panel with a small label |
| `link` | every connection | style's line weight |
| `good` / `warn` / `bad` / `info` | status (RAG) — only when status is the point | filled status colour |
| `note` | free text annotation | muted italic text, no box |

Shapes are allowed (they don't change colours): `shape: cylinder` (database/storage), `shape: person`,
`shape: document`, `shape: queue`, `shape: diamond` (decision), `shape: hexagon`, `shape: cloud`,
`shape: page`, `shape: step`, `shape: circle`, `shape: stored_data`.

## Syntax in 60 seconds

```d2
direction: right

order: "Customer order" {class: quiet}
plan: "Plan" {class: box}
make: "Make" {class: key}
order -> plan {class: link}
plan -> make: "daily" {class: link}

plant: "PLANT 2" {          # a container (group)
  class: group
  press: "Press" {class: box}
  paint: "Paint" {class: box}
  press -> paint {class: link}
}
make -> plant.press {class: link}   # dot = inside a container
```

- `a -> b` arrow, `a <-> b` both ways, `a -- b` plain line.
- Quote labels with spaces: `name: "Label text"`.
- `near: top-center` places a note. `width:` / `height:` only when a box must be bigger.
- Grid layouts: `grid-columns: 3` on a container lays children in a grid (good for matrices, SIPOC).

## Patterns (copy and adapt)

### 1. Pipeline / process flow
```d2
direction: right
a: "Receive" {class: box}
b: "Inspect" {class: box}
c: "Store" {class: key}
d: "Ship" {class: box}
a -> b -> c -> d {class: link}
```

### 2. Before / during / after (phases as groups)
```d2
direction: right
before: "BEFORE" {class: group; kit: "Kit parts" {class: box}}
stop: "LINE STOPPED" {class: group; swap: "Swap die" {class: key}}
after: "AFTER" {class: group; check: "First-off check" {class: box}}
before.kit -> stop.swap -> after.check {class: link}
```

### 3. Layers / architecture stack
```d2
direction: down
ui: "Operator screens" {class: box}
mes: "MES" {class: key}
plc: "PLCs" {class: box}
machines: "Machines" {class: quiet}
ui -> mes -> plc -> machines {class: link}
```

### 4. Hub and spokes
```d2
direction: right
hub: "Data platform" {class: key}
erp: "ERP" {class: box}
mes: "MES" {class: box}
qms: "Quality" {class: box}
crm: "CRM" {class: box}
erp -> hub {class: link}
mes -> hub {class: link}
hub -> qms {class: link}
hub -> crm {class: link}
```

### 5. Decision
```d2
direction: right
start: "Part fails check" {class: box}
q: "Rework possible?" {class: box; shape: diamond}
rework: "Rework" {class: box}
scrap: "Scrap" {class: bad}
start -> q {class: link}
q -> rework: "yes" {class: link}
q -> scrap: "no" {class: link}
```

### 6. Swimlanes (who does what)
```d2
direction: right
ops: "OPERATIONS" {class: group; direction: right; a: "Raise request" {class: box}; d: "Run pilot" {class: box}}
eng: "ENGINEERING" {class: group; direction: right; b: "Design fix" {class: key}}
qa: "QUALITY" {class: group; direction: right; c: "Approve" {class: box}}
ops.a -> eng.b -> qa.c -> ops.d {class: link}
```

### 7. Hierarchy / breakdown (org chart, BOM, goal tree)
```d2
direction: down
goal: "Cut downtime 20%" {class: key}
a: "Faster changeovers" {class: box}
b: "Fewer breakdowns" {class: box}
c: "Better scheduling" {class: box}
goal -> a {class: link}
goal -> b {class: link}
goal -> c {class: link}
```

### 8. Feedback loop / cycle (PDCA)
```d2
direction: right
plan: "Plan" {class: box}
do: "Do" {class: box}
check: "Check" {class: key}
act: "Act" {class: box}
plan -> do -> check -> act -> plan {class: link}
```

### 9. Status map (RAG)
```d2
direction: right
l2: "Line 2" {class: warn}
l3: "Line 3" {class: warn}
l4: "Line 4" {class: good}
l5: "Line 5" {class: bad}
```

### 10. Matrix / SIPOC (grid)
```d2
sipoc: "" {
  class: group
  grid-columns: 5
  s: "Suppliers" {class: box}
  i: "Inputs" {class: box}
  p: "Process" {class: key}
  o: "Outputs" {class: box}
  c: "Customers" {class: box}
}
```

## Things D2 is not good at — use something else

| Need | Use instead |
|---|---|
| Gantt / schedule | a Vega-Lite chart (`references/charts.md`, Gantt pattern) or `ol.timeline` |
| Any chart of numbers | Vega-Lite |
| Fishbone (Ishikawa) | `cols3`/`cols4` with `card`s per cause category, effect in a `callout`; or a `direction: right` tree |
| Annotated photo of equipment | the photo + a numbered list beside it (`cols-wide-left`) |
| Floor/line layout to scale | a drawing from engineering, exported to SVG/PNG, placed as an image |

## Checking a diagram

After `build.mjs`, open `build/diagrams/<name>.svg` (or the slide PNG). Check: reads left→right or top→bottom
without crossing lines; the `key` node stands out; labels are not truncated; it fills the slide width
without tiny text. If lines cross, reorder the node definitions or change `direction`.
