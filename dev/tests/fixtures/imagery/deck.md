---
marp: true
---

## Small photo needs more pixels

<img src="images/small.png" width="600" height="300" class="test-cover">

---

## Large photo remains clean when cropped

<img src="images/large.png" width="600" height="300" class="test-cover">

---

## Cropping needs enough source height

<img src="images/wide.png" width="600" height="300" class="test-cover">

---

## Contain preserves the original source resolution

<img src="images/wide.png" width="600" height="300" class="test-contain">

---

## Photo behind text needs review

<div class="test-layer"><img src="images/large.png" class="test-image"><p class="test-copy">Photo overlay needs a visual check.</p></div>

---

## Solid panel provides known contrast

<div class="test-layer"><img src="images/large.png" class="test-image"><p class="test-copy test-panel">Opaque panel remains measurable.</p></div>

---

## Gradient behind text needs review

<p class="test-gradient">Gradient contrast needs a visual check.</p>

---

## Translucent panel needs a visual review

<div class="test-layer"><img src="images/large.png" class="test-image"><p class="test-copy test-translucent">Translucent panel needs a visual check.</p></div>

---

## Full background photo needs review

![bg](images/large.png)

Text over the full background photo.

---

## Hidden images have no quality warning

<img src="images/small.png" width="600" height="300" class="test-hidden">

Visible text stays readable.

---

## Vector labels must remain readable

<svg class="illustration" viewBox="0 0 1200 400" width="600" height="200"><text x="20" y="80" font-size="12">Too small after scaling</text></svg>

---

## Ancestor opacity makes panel contrast uncertain

<div class="test-layer test-faded"><p class="test-copy test-panel">Opaque panel inside faded content needs review.</p></div>

---

## Direct text opacity remains measurable here

<p class="test-faded test-large">Half opacity still clears the large-text threshold.</p>

---

## Faint direct text fails measured contrast

<p class="test-faint">Low opacity makes this text unreadable.</p>

---

## Invisible photo leaves text contrast measurable

<div class="test-layer"><img class="test-image test-invisible" src="images/large.png"><p class="test-copy">This text has no visible photo behind it.</p></div>

---

## Photo placeholder cannot establish text contrast

<div class="photo"><img src="images/large.png" alt="Local photo"><div class="photo-copy"><p>Text sits over actual image pixels.</p></div></div>

---

## Photo panel supplies a measurable background

<div class="photo"><img src="images/large.png" alt="Local photo"><div class="photo-copy photo-panel"><p>Opaque panel remains measurable.</p></div></div>

---

## Photo overlay still needs visual verification

<div class="photo photo-overlay"><img src="images/large.png" alt="Local photo"><div class="photo-copy"><p>A translucent shade needs visual review.</p></div></div>
