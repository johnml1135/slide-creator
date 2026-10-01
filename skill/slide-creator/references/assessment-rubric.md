# Assessment rubric

Use after every build. Two layers:

1. **Automatic** — `build/report.md`. Every ✗ error must be fixed. ! warnings are judgement calls:
   fix them unless there is a reason (state it).
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
