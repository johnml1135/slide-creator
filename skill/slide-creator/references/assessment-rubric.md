# Assessment rubric

Use after every build. Two layers:

1. **Automatic** — `build/report.md`. Every ✗ error must be fixed. ! warnings are judgement calls:
   fix them unless there is a reason (state it). What the checks mean:

   | Check | Meaning | Usual fix |
   |---|---|---|
   | `overflow` | text runs past the bottom (or, in two-column pages, into a third column) | cut text or split the slide/page |
   | `off-slide` | an element crosses the safe margin | shorten it, or use a layout that fits |
   | `clipped` | text cut off inside a box, table cell or code block | shorter text or wider column |
   | `contrast` | text too faint on its background | style issue — use the right colour role |
   | `small-text` | text below the style's minimum size | less text, not a smaller font |
   | `figure-text` | labels inside a diagram/chart end up too small once scaled to fit | fewer or shorter labels, fewer nodes, or give the figure the full width |
   | `figure-size` | a diagram/chart is narrower than 60% of the content width (one column's width on a two-column page); often a tall diagram shrunk to fit | draw it left-to-right, give it more room, or split it |
   | `orphan` | a heading ends with one word alone on its last line | reword or shorten the heading |
   | `top-heavy` | a slide of visual blocks (KPIs, columns, steps, table) ends above 55% of the height | let the layout centre it (it does by default); remove forced spacing, or add the missing content |
   | `crowded` | too many separate blocks on one slide | one idea per slide |
2. **Visual** — you look at the images. Open `build/contact-sheet.png` first (whole deck at a glance),
   then each `build/slides/slide-NN.issues.png` from the report, then at least 3 other slides at full size
   (the cover, the busiest slide, a diagram or chart slide). Compare with the style's `reference/` images.

Score each criterion 1–5 and write the scores into the table at the end of `report.md`.
**Anything under 4 gets a fix, then rebuild.** Stop after 3 rounds; report what remains.

| # | Criterion | 5 looks like | Typical fixes |
|---|---|---|---|
| 1 | **Matches the style** | Could be mistaken for the reference images; uses the style's signatures (title treatment, bands, labels) | Use the layouts the style guide recommends; remove anything improvised |
| 2 | **Hierarchy** | Within 2 seconds you know the point of each slide: title → main element → detail | Make the title the takeaway; shrink or cut secondary text; one `key`/accent only |
| 3 | **Alignment & grid** | Edges line up; columns are equal; nothing floats | Use `cols*` instead of ad-hoc layout; same component types in a row |
| 4 | **Whitespace & density** | Breathing room around groups; nothing cramped; not half-empty either | Split slides over the word limit; for sparse slides use `statement`, `stat` or a bigger figure |
| 5 | **Consistency** | Same kind of content looks the same on every slide (kickers, KPI rows, sources) | Reuse one pattern; same kicker format throughout |
| 6 | **Diagrams** | Reads in one direction, no crossing lines, one focal node, labels short, fills the width | Reorder nodes, change `direction`, group, split, shorten labels |
| 7 | **Charts** | Highlight obvious; axes quiet; direct labels; source present; bars start at 0 | Grey everything but the point; remove legend; add `source` |
| 8 | **Text** | Titles are complete thoughts; bullets parallel and short; no orphans (single word on last line) | Rewrite titles; cut adjectives; move detail to speaker notes |

## What to look for in the images (common faults)

- Text touching or crossing the slide edge or the header/footer zone.
- A single word alone on the last line of a title (orphan) — reword.
- Two things competing for attention (two accents, two big numbers of equal weight).
- A diagram or chart rendered tiny in the middle of empty space — widen it (`![w:1100]`) or use the
  `diagram`/`chart` layout.
- Colours that don't belong to the style (should be impossible — if seen, find the hard-coded value).
- Uneven card heights in a row where content differs a lot — balance the text.
- A wall of bullets — convert to `steps`, `cols`, a table or a diagram.
- Inconsistent capitalisation in titles, labels or diagram nodes.

## Reporting to the user

After the final round, report in 3–5 lines: style and scheme used, slide count, rubric scores (or "all 4+"),
and anything deliberately left (e.g. "slide 9 table is dense because the appendix needs all lines").
