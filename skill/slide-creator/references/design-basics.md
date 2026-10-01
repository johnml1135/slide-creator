# Design basics for slides

Plain-language definitions of the design terms used in this skill, and the handful of rules that make
slides look professional. Read once; the styles already encode most of it.

## Terms

| Term | Meaning | In this skill |
|---|---|---|
| **Design system** | A fixed set of choices (colours, type, spacing, components) reused everywhere so things look consistent | a style pack |
| **Design tokens** | The named values in a design system: "accent = #D97757", "body text = 26px" | `style.json` |
| **Colour roles** | Colours named by job, not hue: background, text, muted, accent | `bg`, `ink`, `accent`… |
| **Palette / colour scheme** | A full set of values for every role; a style can have several (light, dark, brand B) | `schemes` |
| **Type scale** | A small fixed set of text sizes; nothing in between | `type.scale` |
| **Font stack** | Preferred font, then fallbacks if it isn't installed | `family: [...]` |
| **Hierarchy** | Making the most important thing the most noticeable (size, weight, colour, position) | titles, `key`, accent |
| **Focal point** | The one place the eye goes first | one accent per slide |
| **Grid** | Invisible columns that everything aligns to | `cols`, `cols3`… |
| **Gutter** | Space between columns | `space.gutter` |
| **Margin / safe area** | Empty border around the slide content never crosses | `space.margin`, `space.safe` |
| **Whitespace** | Empty space used on purpose to group and separate | spacing scale |
| **Measure** | Line length; ~45–75 characters reads best | `type.measure` |
| **Kicker / eyebrow** | Small label above a title | `######` |
| **Action title** | A title that states the conclusion ("Scrap fell 18%…") not the topic ("Scrap") | boardroom rule |
| **Callout** | A boxed note that stands apart from body text | `.callout` |
| **KPI tile** | A big number with a label and context | `.kpi` |
| **Chartjunk** | Decoration on a chart that carries no information (3D, heavy grids, shadows) | removed by the chart config |
| **Data-ink** | The part of a chart that shows data; maximise it | quiet axes, direct labels |
| **Contrast ratio** | How readable text is on its background (WCAG: 4.5:1 normal text, 3:1 large) | checked by inspect |
| **Orphan / widow** | A single word stranded on the last line | flagged in review |
| **Full-bleed** | An image that runs to the slide edges | `![bg](…)` |
| **Signature** | A recurring visual feature that makes a style recognisable (a top bar, a hazard stripe) | `style.css` |

## Ten rules that do most of the work

1. **One idea per slide**, stated in the title.
2. **One focal point** — one accent colour use, one big number, one `key` node.
3. **Align everything** to the grid; never nudge.
4. **Few sizes, few colours** — only from the style.
5. **Whitespace is not wasted**; crowding is the most common amateur look.
6. **Consistency beats creativity** — the same content type looks the same on every slide.
7. **Show, don't list** — a 4-step bullet list is better as `steps` or a diagram; numbers as a chart or KPIs.
8. **Label charts directly**; remove legends, borders, and gridlines that don't help.
9. **Write less** — cut adjectives, use fragments in bullets, move detail to speaker notes.
10. **Check it rendered** — always look at the images before calling it done.

## Story structures that work

- **Situation → Complication → Resolution** (exec decks): context, what changed/the problem, what we propose.
- **Problem → Cause → Fix → Result → Ask** (operations/CI): matches A3 thinking.
- **What → Why → How → What next** (explainers and training).

Write the titles alone first; if they read as a coherent paragraph, the deck works.
