# Editorial — style guide

## The look in one paragraph

A calm, book-like guide. Warm paper background, large serif titles sitting on a hairline, a plain sans-serif
for body text, and lots of empty space. One warm clay accent appears rarely — on the kicker, a step number,
the one key number or diagram node. It should feel like a well-typeset technical guide (in the spirit of
Anthropic's *Complete Guide to Building Skills for Claude*), not a sales deck.

## When to use it

- Explainers, how-tos and training material
- Strategy narratives and pre-reads people will study
- Internal guides, playbooks, onboarding

Not ideal for: dense data reviews (use boardroom) or ops status (use plant-floor).

## Signatures

1. Serif titles (Georgia), regular weight, with a hairline rule under every `##` title.
2. Small uppercase kicker in the accent colour above titles (`###### Chapter 2`).
3. En-dash bullets in muted ink.
4. Chapter dividers on the soft paper panel with a big serif title and nothing else.
5. Agenda styled like a table of contents with dotted leaders and page numbers.
6. Thin rules above KPI tiles and steps instead of boxes.

## Colour

Paper `bg`, slightly darker paper `surface`, near-black `ink`, warm grey `muted`, clay `accent`.
Accent is for: kicker text, one key number, the current step, one diagram `key` node, the highlighted bar.
Never use accent for body text or large fills.

## Type

- Titles: Georgia (fallback Cambria / Times), regular weight — never bold.
- Body: Segoe UI / Aptos; 26px on content slides. Sentence case everywhere.
- Kickers and labels: small caps-style uppercase, letter-spaced.

## Writing

- Titles are short phrases or full sentences — readable as a chapter heading.
- ≤50 words per slide, ≤5 bullets. Prefer a sentence or two over bullets.
- Use `callout` with "Pro tip" / "Note" / "Lesson" for asides, at most one per slide.

## Layouts that suit it best

`cover`, `agenda`, `chapter`, `statement`, `cols3` with plain headings, `do`/`dont` with code or wording
examples, `steps`, `callout`, `diagram`.

## Diagrams

White boxes, thin near-black outlines, 8px corners, groups on the paper panel with an uppercase label.
One clay `key` node. Generous spacing, left-to-right. Looks hand-drawn by a careful technical writer.

## Charts

Quiet: y gridlines only, warm grey context bars, the point in clay. Serif chart title is avoided; the
chart title is the measure in sans, the slide title carries the message.

## Imagery and icons

Rare. If photos are used: calm, full-bleed, muted. Icons only as small outline labels.

## Do / Don't

- Do leave space: a slide with one sentence and a lot of paper is on-style.
- Do use `statement` for the one line people should remember.
- Don't fill cards with colour; don't use bold serif; don't add drop shadows or gradients.
- Don't use more than one accent element per slide (two at most on a KPI row: kicker + key tile).
