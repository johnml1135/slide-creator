# Plant Floor — style guide

## The look in one paragraph

Industrial and engineering: light concrete background, a dark graphite header bar with an amber edge,
condensed DIN-style headings (Bahnschrift), monospace section codes and labels, square corners, 2px lines,
and the safety colour language people on a site already know — red stop, amber caution, green OK, blue info.
It should feel like a well-made control-room screen or engineering drawing title block: dense when needed,
but always orderly.

## When to use it

- Operations, production and quality reviews; daily/weekly performance
- Continuous improvement: A3s, kaizen report-outs, root-cause, SIPOC, value streams
- Engineering and process documentation, readiness reviews, project status and schedules
- Shop-floor or control-room screens — use `"scheme": "dark"`

## Signatures

1. Dark header bar across the top with the deck `header:` text in monospace caps, amber edge below it.
2. Cover in graphite with a yellow/black hazard stripe along the bottom.
3. Kickers as section codes: `###### 02.3 · Changeover` with a small amber square.
4. Chapter dividers in graphite with a large amber section number.
5. Small amber square bullets; mono uppercase labels under KPI numbers.
6. Tables with a dark header row; status as square tags.
7. Amber is a **fill** colour (tiles, highlight blocks), never thin text on the light background.

## Colour

Status colours carry meaning — use them only for status:

| Colour | Means |
|---|---|
| `good` green | OK, on track, safe, done |
| `warn` amber | caution, at risk, watch — also the brand accent |
| `bad` red | stop, off track, defect, safety issue |
| `info` blue | information, mandatory action, in progress |

`primary` graphite for structure; `accent` amber for the single highlight (filled).

## Type

- Headings: Bahnschrift (Windows), semibold. Body: Segoe UI 23px.
- Labels, codes, header/footer, page numbers: Cascadia Mono / Consolas, uppercase.
- Equipment tags, part numbers and IDs always in mono: `` `L4-PRESS-02` ``.

## Writing

- Titles are factual and specific ("Line 4 changeover down to 55 min"), sentence case.
- Number sections and keep codes consistent: `01`, `02.1`, `02.2`…
- Up to 60 words; tables and checklists are fine here — this audience reads detail.
- Use units everywhere (min, %, ppm, OEE %).

## Layouts that suit it best

`kpis` (andon-board feel, `key` tile in amber), tables with `tag`s, `steps`, `timeline`, `ul.check`
(readiness checks), `diagram` (process flows, swimlanes, layer stacks), `chart` (trends vs target,
Pareto-style sorted bars, Gantt), `cols` A3-style (problem | cause | countermeasure).

A3 / report-out pattern: `cols3` of `card`s titled *Problem*, *Root cause*, *Countermeasure*,
then a chart slide with target line, then a `timeline` + checklist for follow-up.

## Diagrams

Square corners, 2px graphite outlines, boxes on the page colour, groups as outlined panels with mono
labels. The key step filled amber. Use status classes for RAG process maps. Shapes: `cylinder` for
storage/silos, `queue` for buffers, `step` for process stages, `document` for work instructions.

## Charts

Gridlines both ways (light), square bars, graphite for context, amber for the point, dashed target line in
muted. Always a target or limit line where one exists.

## Imagery and icons

Real photos of equipment, lines and parts — annotated with numbered markers explained beside the photo.
Icons functional only (safety, equipment, status), solid, single colour.

## Do / Don't

- Do use status colours consistently across the whole deck.
- Do put targets and limits on every performance chart.
- Don't use amber for small text on light backgrounds; don't use red/green for decoration.
- Don't round corners or add shadows; don't mix more than one highlight per slide besides status.
