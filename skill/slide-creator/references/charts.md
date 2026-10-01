# Charts (Vega-Lite)

Charts are Vega-Lite JSON specs in `charts/<name>.vl.json`, referenced as `charts/<name>.svg`.
The build supplies fonts, axis styling, grid lines, palette and default mark colour from the style, so the
spec only says **what data, which mark, which encoding**.

Docs and examples: https://vega.github.io/vega-lite/examples/

## Rules

- **No `config` block and no hex colours.** For colour, use tokens: `"$accent"`, `"$primary"`, `"$muted"`,
  `"$rule"`, `"$ink"`, `"$good"`, `"$warn"`, `"$bad"`, `"$info"`, `"$cat1"` … `"$cat6"`.
- **One highlighted thing.** Grey (`$rule` or `$muted`) for context, `$accent` (or `$primary`) for the point.
- **Title = the takeaway** in the slide title; the chart `title` says what is measured and the unit
  ("Average changeover time, minutes"). Add `subtitle` for scope.
- **Label directly** (text marks on bars/line ends) instead of a legend when there are ≤4 series.
- Width ≤ 1100, height 320–440. Put a `<p class="source">` under every chart.
- Inline data (`"data": {"values": […]}`) or a CSV next to the spec (`"data": {"url": "charts/x.csv"}`).
- Bars start at zero. No 3D, no pies with more than 3 slices (use bars), no dual axes.

## Which chart

| Question | Chart |
|---|---|
| How did X change over time? | line (many points) or columns (≤12 points) |
| Which is biggest? | horizontal bars, sorted |
| What makes up the total? | stacked bar (≤5 parts) or a single 100% bar |
| Actual vs target | bars + a dashed `rule` for the target |
| Before vs after per item | dumbbell (two points + rule) or grouped bars |
| Distribution | histogram |
| Relationship between two measures | scatter |
| Schedule / plan | Gantt (bars with `x` and `x2` dates) |
| Pareto (causes) | sorted bars + cumulative line |

## Patterns

### Highlight one bar
```json
{
  "title": {"text": "Scrap rate by line, %"},
  "width": 1000, "height": 360,
  "data": {"values": [{"line": "L2", "v": 3.1}, {"line": "L3", "v": 2.4}, {"line": "L4", "v": 5.8}, {"line": "L5", "v": 1.9}]},
  "mark": {"type": "bar"},
  "encoding": {
    "y": {"field": "line", "type": "nominal", "sort": "-x", "title": null},
    "x": {"field": "v", "type": "quantitative", "title": null},
    "color": {"condition": {"test": "datum.line === 'L4'", "value": "$accent"}, "value": "$rule"}
  }
}
```

### Line with direct label at the end
```json
{
  "title": {"text": "OEE, %", "subtitle": "Weekly, all lines"},
  "width": 1000, "height": 380,
  "data": {"url": "charts/oee.csv"},
  "layer": [
    {"mark": "line", "encoding": {
      "x": {"field": "week", "type": "temporal", "title": null},
      "y": {"field": "oee", "type": "quantitative", "title": null, "scale": {"zero": false}},
      "color": {"field": "line", "type": "nominal", "legend": null}}},
    {"transform": [{"window": [{"op": "rank", "as": "r"}], "sort": [{"field": "week", "order": "descending"}], "groupby": ["line"]}, {"filter": "datum.r === 1"}],
     "mark": {"type": "text", "align": "left", "dx": 8, "fontWeight": 600},
     "encoding": {"x": {"field": "week", "type": "temporal"}, "y": {"field": "oee", "type": "quantitative"},
                  "text": {"field": "line"}, "color": {"field": "line", "type": "nominal", "legend": null}}}
  ]
}
```

### Actual vs target
Add a layer: `{"data": {"values": [{"t": 45}]}, "mark": {"type": "rule", "strokeDash": [6, 4], "strokeWidth": 2}, "encoding": {"y": {"field": "t", "type": "quantitative"}, "color": {"value": "$muted"}}}`

### Gantt
```json
{
  "title": {"text": "Roll-out plan"},
  "width": 1000, "height": 300,
  "data": {"values": [
    {"task": "Line 4 pilot", "start": "2026-01-05", "end": "2026-03-27", "phase": "done"},
    {"task": "Kit carts L2–3", "start": "2026-04-01", "end": "2026-06-26", "phase": "now"},
    {"task": "Line 5 + training", "start": "2026-07-01", "end": "2026-09-25", "phase": "next"}
  ]},
  "mark": {"type": "bar", "height": 22},
  "encoding": {
    "y": {"field": "task", "type": "ordinal", "sort": null, "title": null},
    "x": {"field": "start", "type": "temporal", "title": null, "axis": {"format": "%b"}},
    "x2": {"field": "end"},
    "color": {"field": "phase", "type": "nominal", "legend": null,
              "scale": {"domain": ["done", "now", "next"], "range": ["$muted", "$accent", "$rule"]}}
  }
}
```

### Pareto
Bars sorted descending + a `line` layer of the cumulative % on a second, independent y scale is a dual
axis — avoid it; instead show sorted bars and mark the "vital few" with `$accent` and a caption
("Top 3 causes = 72% of stops").

## Checking a chart

Open `build/charts/<name>.svg` or the slide PNG: is the highlighted element obvious within 2 seconds,
are labels readable at the back of a room (≥14px), does the y-axis start at zero for bars, is there a source?
