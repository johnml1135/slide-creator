# Boardroom — style guide

## The look in one paragraph

Executive and consulting-style: white canvas, a thin navy brand bar across the top, strong sans-serif
type, a strict grid and very disciplined colour — navy for structure and the main data series, teal for
the single highlight. Every content title is an **action title** that states the conclusion, every number
has a source, and the deck reads as a complete argument even without a presenter.

## When to use it

- Steering committees, leadership updates, board pre-reads
- Business cases and investment asks
- Quarterly and monthly business reviews
- Anything that will be emailed and read rather than presented

## Signatures

1. Thin primary bar across the top of every slide.
2. Action titles in primary colour, semibold, up to two lines.
3. Cover with a navy block on the left third, title on white to the right.
4. Chapter dividers in full navy with white type.
5. Small square bullets in navy.
6. KPI numbers large in navy; the one that matters in the accent.
7. Source line with a hairline above it on every number or chart slide.

## Colour

White `bg`, cool light-grey `surface`, near-black `ink`, slate `muted`, navy `primary`, teal `accent`.
Charts: navy for the series that matters, light grey (`rule`) for context; teal only for a single callout
value. Status colours only in tags and RAG tables.

## Type

- Headings: Aptos Display / Segoe UI Semibold (600). Body: Aptos / Segoe UI 22px.
- Labels (table headers, kickers): bold uppercase, slightly tracked.
- Numbers use tabular figures; right-align number columns.

## Writing

- **Action titles**: a full sentence with the takeaway, ≤ 2 lines. "Changeover time fell 41% in eight
  weeks", not "Changeover results". The linter warns on titles under 5 words.
- Read the titles alone: they should form the executive summary.
- Start the deck with a `summary` slide after the cover: 3–5 bullets, each with a **bold lead-in**.
- ≤60 words per slide; detail goes to the appendix (`dense`) or speaker notes.
- Every number: unit, period and source.

## Layouts that suit it best

`cover`, `summary`, `agenda` (repeat it with the current section bold at each chapter), `kpis`,
`chart`, tables with a highlighted row (`tr.hl` via HTML) or tags, `cols` options comparison with
`card`s, `tracker` on content slides for long decks, `closing` with the decision needed.

## Diagrams

Flat light-grey boxes with a fine outline, 4px corners, navy arrows; the key node in teal.
Prefer simple structures: pipeline, hub, hierarchy (options tree), swimlanes for who-does-what.

## Charts

Y-gridlines in light grey, no chart borders, square bar ends, direct labels. One emphasised series in
navy or one bar in teal; everything else light grey. Always a `source` line.

## Imagery and icons

Real photos of the company's sites/products only, with a purpose. Icons allowed on KPI tiles and agenda,
single colour, same size.

## Do / Don't

- Do put the answer first (summary slide), then the evidence.
- Do keep the same chart style and units across the whole deck.
- Don't use topic titles; don't use more than one highlight colour in a chart.
- Don't decorate: no photos as wallpaper, no clip art, no gradients beyond the cover block.
