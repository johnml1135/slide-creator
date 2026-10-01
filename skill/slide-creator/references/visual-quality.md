# Visual quality and review

A professional deck has a coherent argument and a deliberate visual hierarchy. A clean automatic
report is necessary, but cannot tell you whether the audience understands the point.

## Author the story before the decoration

Write the takeaway titles first. Read them in order: they should explain the situation, evidence,
recommendation, and decision. Give each slide one communication job. Choose a chart for quantities,
a diagram for relationships, a photo for concrete evidence, and a statement for an important conclusion.
Use illustrations when they clarify an idea that a chart or photo cannot explain as directly.

Choose one dominant visual on each slide. Keep supporting text brief. Repeat the same crop, frame,
caption, and label treatment for similar evidence throughout the deck. Use a restrained sequence of
statement, evidence, comparison, and decision slides rather than repeating the same card grid.

Use approved local assets. Record their source and rights where appropriate. Build steps must not
fetch images, fonts, or other resources. A generated visual can be prepared separately and saved locally;
it is not a prerequisite for building a deck, and proprietary material should not be sent to an external
image service without the user's authorization.

## Photos and image treatments

Keep the subject visible at the actual slide crop. Use crop positioning when a face, product, or important
detail sits near an edge. A photograph should support the takeaway, not merely occupy empty space.
Use frames for evidence and screenshots; preserve screenshot details and avoid aggressive cropping.

Grayscale, tint, and duotone treatments can help photos fit a style, but may hide evidence. Preserve
original colors when color conveys a defect, state, material, or chart category. Inspect the original
and treated image side by side if the photo supports an operational or technical claim.

For text over a photo, prefer an opaque panel. A translucent shade may improve readability but does
not guarantee contrast across every crop. Review the lightest and darkest image areas behind the text.
Never shrink the text to make a photo layout fit.

Raster resolution is measured in source pixels per displayed pixel. A cover crop enlarges the image
until both dimensions fill the box, so its smaller dimension can limit quality even when the file is
very wide. A contain treatment preserves the whole image and uses the dimension that fits inside the
box. The inspector warns below `rules.minImageScale` (default 1). This is a practical quality threshold,
not a guarantee of sharpness on every projector, zoom level, or print size. SVGs do not need this test.

## SVG illustrations and accessibility

Inline SVG can use style variables and `currentColor`; an SVG loaded as an image must carry its own
resolved colors and resources. Keep figures simple, use short labels, and check label size after scaling.
[SVG color](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/color) and
[SVG image restrictions](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image)
explain these mechanisms.

Describe informative images by the information they convey. Decorative images should have empty
alternative text. Give an informative inline SVG an accessible name; the SVG `<title>` provides a naming
mechanism. Complex charts and diagrams also need an adjacent summary of their takeaway and important
values or relationships. See [W3C informative images](https://www.w3.org/WAI/tutorials/images/informative/),
[W3C complex images](https://www.w3.org/WAI/tutorials/images/complex/), and
[SVG title](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/title).

HTML alternative text does not establish that the exported PDF has correct tags or reading order.
Review those separately before describing a PDF as accessible.

## What contrast checking establishes

Normal text needs 4.5:1 contrast, and large text needs 3:1. Meaningful graphical elements need 3:1
against adjacent colors. Decorative shapes and arbitrary photographic pixels are not all subject to
the graphical-object requirement. Thin strokes may appear faint even when their nominal colors pass.
See [W3C text contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum) and
[W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

Automatic checks can compare known solid text and background colors. Text over photographs,
gradients, and translucent layers requires visual review; `contrast-unverified` records this uncertainty.
An image's average brightness cannot establish whether its important details are readable. Screenshot
sampling is also affected by antialiasing and cannot substitute for identifying the meaningful foreground
and its adjacent background. SVG label-size inspection does not imply that every SVG color pair passed.

## Inspect the actual output

Review the contact sheet for the story, consistent treatments, and variety of pacing. Inspect every new
visual pattern at full size, along with the cover, busiest slide, and every warning. Check crops, captions,
figure labels, thin lines, text panels, and competing focal points. Compare light and dark schemes.

Open the exported PDF as well as the inspection PNGs. CSS filters and background treatments are browser
features, and their PDF appearance must be verified in the installed Edge or Chrome. Font fallback and
browser version can change line wrapping and rendering. `print-color-adjust: exact` expresses a preference;
user or browser settings may override it. See [CSS filters](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/filter)
and [print color adjustment](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/print-color-adjust).

Use the assessment rubric after each revision. Record which warnings were visually reviewed and why
any remain. Report unknown checks honestly; a clean report is not a complete accessibility certification.
