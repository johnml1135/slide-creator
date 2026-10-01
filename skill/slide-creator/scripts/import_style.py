#!/usr/bin/env python3
"""
Import a style from an existing presentation (.pptx or .pdf) as a DRAFT style pack.

    python <skill>/scripts/import_style.py source.pdf --name acme-quarterly [--base boardroom] [--out <dir>]
    python <skill>/scripts/import_style.py source.pptx --pdf source.pdf --name acme-quarterly

What it does
  1. Renders up to 12 pages to styles/<name>/reference/page-NN.png  (needs a PDF; for .pptx pass --pdf,
     or it will try LibreOffice if installed).
  2. Measures: page colours, text colours, fonts and text sizes (PDF), theme colours and theme fonts (PPTX).
  3. Writes styles/<name>/style.json (tokens), style.css (copied from --base), guide.md (to be completed),
     and extraction.json (raw measurements, so you can check the guesses).

The result is a starting point. Follow workflows/new-style.md to finish it: look at the reference images,
correct the tokens, write the personality CSS and guide, then build the showcase deck and compare.

Needs: pip install pdfplumber pypdfium2 pillow python-pptx   (python-pptx only for .pptx)
"""
import argparse, colorsys, json, re, shutil, subprocess, sys, tempfile
from collections import Counter
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent

GENERIC_SANS = ["Segoe UI", "Aptos", "Arial", "sans-serif"]
GENERIC_SERIF = ["Georgia", "Cambria", "Times New Roman", "serif"]
GENERIC_MONO = ["Cascadia Mono", "Consolas", "Menlo", "monospace"]
SERIF_HINTS = re.compile(r"serif|times|georgia|garamond|cambria|book|roman|tiempos|lora|merriweather|caslon|minion|palatino", re.I)


# ---------------- colour helpers ----------------
def hex_of(rgb):
    return "#{:02X}{:02X}{:02X}".format(*[max(0, min(255, int(round(v)))) for v in rgb])


def rgb_of(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lum(rgb):
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def sat(rgb):
    h, l, s = colorsys.rgb_to_hls(*[v / 255 for v in rgb])
    return s if 0.08 < l < 0.92 else 0


def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def near(a, b, tol=28):
    return sum(abs(a[i] - b[i]) for i in range(3)) <= tol


def pdf_color(c):
    """pdfplumber colour → rgb tuple 0–255 (handles gray, rgb, cmyk)."""
    if c is None:
        return None
    if isinstance(c, (int, float)):
        c = (c,)
    c = [float(v) for v in c if isinstance(v, (int, float))]
    if len(c) == 1:
        return (c[0] * 255,) * 3
    if len(c) == 3:
        return tuple(v * 255 for v in c)
    if len(c) == 4:
        k = c[3]
        return tuple(255 * (1 - v) * (1 - k) for v in c[:3])
    return None


# ---------------- rendering ----------------
def pptx_to_pdf(pptx, tmp):
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if not soffice:
        return None
    subprocess.run([soffice, "--headless", "--convert-to", "pdf", "--outdir", str(tmp), str(pptx)], capture_output=True, timeout=240)
    out = Path(tmp) / (Path(pptx).stem + ".pdf")
    return out if out.exists() else None


def render_pages(pdf, out_dir, max_pages=12):
    import pypdfium2 as pdfium
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = pdfium.PdfDocument(str(pdf))
    n = len(doc)
    picks = list(range(n)) if n <= max_pages else sorted({round(i * (n - 1) / (max_pages - 1)) for i in range(max_pages)})
    paths = []
    for i in picks:
        page = doc[i]
        w = page.get_width()
        img = page.render(scale=1280 / w).to_pil().convert("RGB")
        p = out_dir / f"page-{i + 1:02d}.png"
        img.save(p)
        paths.append(p)
    doc.close()
    return paths


def image_colours(paths):
    """Dominant colours across rendered pages: background (edges) and a palette of the rest."""
    from PIL import Image
    edge, body = Counter(), Counter()
    for p in paths:
        im = Image.open(p).convert("RGB")
        small = im.resize((160, 90))
        # Page background = the single most common pixel colour on each page, voted across pages.
        page_mode = Counter(small.getdata()).most_common(1)[0][0]
        edge[page_mode] += 1
        q = small.quantize(colors=12, method=Image.Quantize.MEDIANCUT).convert("RGB")
        for count, c in q.getcolors(160 * 90):
            body[c] += count
    return edge, body


# ---------------- PDF text analysis ----------------
def analyse_pdf_text(pdf):
    import pdfplumber
    sizes, fonts, colours, font_by_size = Counter(), Counter(), Counter(), {}
    width_pt = None
    with pdfplumber.open(str(pdf)) as doc:
        for page in doc.pages[:40]:
            width_pt = width_pt or float(page.width)
            for ch in page.chars:
                if not ch.get("text", "").strip():
                    continue
                size = round(float(ch["size"]) * 2) / 2
                name = re.sub(r"^[A-Z]{6}\+", "", ch.get("fontname", ""))
                sizes[size] += 1
                fonts[name] += 1
                font_by_size.setdefault(size, Counter())[name] += 1
                col = pdf_color(ch.get("non_stroking_color"))
                if col:
                    colours[hex_of(col)] += 1
    return {"widthPt": width_pt, "sizes": sizes, "fonts": fonts, "colours": colours, "fontBySize": font_by_size}


def family_of(fontname):
    base = re.split(r"[-,]", fontname)[0]
    base = re.sub(r"(MT|PS|Std|Pro)$", "", base)
    base = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", base).strip()
    return base or fontname


# ---------------- PPTX analysis ----------------
def analyse_pptx(pptx):
    from pptx import Presentation
    from pptx.util import Emu
    prs = Presentation(str(pptx))
    out = {"slideWidthIn": Emu(prs.slide_width).inches, "slideHeightIn": Emu(prs.slide_height).inches, "theme": {}, "fonts": {}, "sizes": Counter()}
    ns = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
    master = prs.slide_masters[0]
    for rel in master.part.rels.values():
        if rel.reltype.endswith("/theme"):
            from lxml import etree
            root = etree.fromstring(rel.target_part.blob)
            scheme_el = root.find(".//a:clrScheme", ns)
            for el in (scheme_el if scheme_el is not None else []):
                tag = etree.QName(el).localname
                srgb = el.find("a:srgbClr", ns)
                sysc = el.find("a:sysClr", ns)
                val = srgb.get("val") if srgb is not None else (sysc.get("lastClr") if sysc is not None else None)
                if val:
                    out["theme"][tag] = "#" + val.upper()
            major = root.find(".//a:majorFont/a:latin", ns)
            minor = root.find(".//a:minorFont/a:latin", ns)
            out["fonts"] = {"major": major.get("typeface") if major is not None else None,
                            "minor": minor.get("typeface") if minor is not None else None}
    for slide in prs.slides:
        for shape in slide.shapes:
            if not shape.has_text_frame:
                continue
            for para in shape.text_frame.paragraphs:
                for run in para.runs:
                    if run.font.size and run.text.strip():
                        out["sizes"][run.font.size.pt] += len(run.text)
    return out


# ---------------- token synthesis ----------------
def pick_scale(sizes_px):
    """Map measured sizes (px at 1280 wide, weighted by count) onto the type scale."""
    if not sizes_px:
        return None
    plausible = {s: n for s, n in sizes_px.items() if 18 <= s <= 32}
    body = max(plausible or sizes_px, key=lambda s: (plausible or sizes_px)[s])
    body = min(max(body, 20), 30)
    larger = sorted([s for s in sizes_px if s > body * 1.15], reverse=True)
    smaller = sorted([s for s in sizes_px if s < body * 0.92 and sizes_px[s] > 0], reverse=True)
    big = larger[:3] + [body * 2.6, body * 2.0, body * 1.5][len(larger[:3]):]
    big = sorted(big, reverse=True)
    scale = {
        "display": round(max(big[0], body * 2.2)),
        "h1": round(big[1] if len(big) > 1 else body * 2.0),
        "h2": round(big[2] if len(big) > 2 else body * 1.5),
        "h3": round(body * 1.08),
        "body": round(body),
        "small": round(smaller[0] if smaller else body * 0.82),
        "caption": round(smaller[1] if len(smaller) > 1 else body * 0.66),
    }
    caps = {"display": 96, "h1": 72, "h2": 48, "h3": 32}
    for k, v in caps.items():
        scale[k] = min(scale[k], v)
    scale["h1"] = min(scale["h1"], scale["display"] - 8)
    scale["h2"] = min(scale["h2"], scale["h1"] - 8)
    scale["h3"] = max(min(scale["h3"], scale["h2"] - 6), scale["body"])
    scale["small"] = max(min(scale["small"], scale["body"] - 3), 16)
    scale["caption"] = max(min(scale["caption"], scale["small"] - 2), 13)
    scale["label"] = scale["caption"]
    return scale


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source", help=".pdf or .pptx")
    ap.add_argument("--pdf", help="PDF export of the .pptx (for reference images and text measurements)")
    ap.add_argument("--name", required=True, help="new style name, kebab-case")
    ap.add_argument("--base", default="boardroom", help="existing style to copy structure and CSS from")
    ap.add_argument("--out", help="folder that will contain styles/<name> (default: current directory)")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", a.name):
        sys.exit("--name must be kebab-case, e.g. acme-quarterly")
    src = Path(a.source).resolve()
    base_dir = SKILL / "styles" / a.base
    if not (base_dir / "style.json").exists():
        sys.exit(f"Unknown --base style {a.base}")
    dest = Path(a.out or ".").resolve() / "styles" / a.name
    if dest.exists() and not a.force:
        sys.exit(f"{dest} exists (use --force to overwrite)")
    dest.mkdir(parents=True, exist_ok=True)

    extraction = {"source": src.name}
    pptx_info = None
    pdf = Path(a.pdf).resolve() if a.pdf else (src if src.suffix.lower() == ".pdf" else None)
    with tempfile.TemporaryDirectory() as tmp:
        if src.suffix.lower() == ".pptx":
            pptx_info = analyse_pptx(src)
            extraction["pptx"] = {k: (dict(v) if isinstance(v, Counter) else v) for k, v in pptx_info.items()}
            if not pdf:
                pdf = pptx_to_pdf(src, tmp)
                if not pdf:
                    print("! No PDF available. Export the deck to PDF from PowerPoint (File → Save As → PDF) and pass --pdf for reference images and measurements.")
        refs, text = [], None
        if pdf:
            refs = render_pages(pdf, dest / "reference")
            text = analyse_pdf_text(pdf)

    base = json.loads((base_dir / "style.json").read_text())
    scheme = dict(base["schemes"]["default"])
    notes = []

    # Colours from rendered pages
    if refs:
        edge, body = image_colours(refs)
        bg = edge.most_common(1)[0][0]
        scheme["bg"] = hex_of(bg)
        palette = [c for c, _ in body.most_common() if not near(c, bg, 40)]
        extraction["imagePalette"] = [hex_of(c) for c in palette[:12]]
        saturated = sorted([c for c in palette if sat(c) > 0.25], key=lambda c: -body[c])
        if saturated:
            scheme["primary"] = hex_of(saturated[0])
        if len(saturated) > 1:
            accent = next((c for c in saturated[1:] if not near(c, saturated[0], 90)), saturated[1])
            scheme["accent"] = hex_of(accent)
        notes.append("bg/primary/accent guessed from rendered pages — check against reference/*.png")

    # Text colours
    if text and text["colours"]:
        bgc = rgb_of(scheme["bg"])
        readable = [(rgb_of(h), n) for h, n in text["colours"].most_common() if contrast(rgb_of(h), bgc) >= 4.5]
        if readable:
            top = readable[0][1]
            common = [c for c, n in readable if n >= top * 0.1 and sat(c) < 0.3]
            ink_c = max(common or [readable[0][0]], key=lambda c: contrast(c, bgc))
            scheme["ink"] = hex_of(ink_c)
            greys = [c for c in common if not near(c, ink_c, 40) and contrast(c, bgc) >= 4.5]
            if greys:
                scheme["muted"] = hex_of(greys[0])
        extraction["textColours"] = dict(text["colours"].most_common(12))

    # PPTX theme colours win where present
    if pptx_info and pptx_info["theme"]:
        th = pptx_info["theme"]
        if th.get("dk2"):
            scheme["primary"] = th["dk2"]
        if th.get("accent1"):
            scheme["accent"] = th["accent1"] if th["accent1"] != scheme.get("primary") else th.get("accent2", th["accent1"])
        accents = [th[k] for k in ("accent1", "accent2", "accent3", "accent4", "accent5", "accent6") if th.get(k)]
        if accents:
            scheme["categorical"] = accents[:6]
        notes.append("primary/accent/categorical taken from the PowerPoint theme colours")

    ink, bgc = rgb_of(scheme["ink"]), rgb_of(scheme["bg"])
    scheme["surface"] = hex_of(mix(bgc, ink, 0.05))
    scheme["rule"] = hex_of(mix(bgc, ink, 0.16))
    if contrast(rgb_of(scheme["muted"]), bgc) < 4.5:
        scheme["muted"] = hex_of(mix(bgc, ink, 0.62))
    scheme["sequential"] = [scheme["surface"], scheme["primary"]]
    if "categorical" not in scheme or scheme["categorical"] == base["schemes"]["default"].get("categorical"):
        scheme["categorical"] = [scheme["primary"], scheme["accent"], scheme["muted"], scheme["info"], scheme["warn"], scheme["rule"]]

    style = json.loads(json.dumps(base))
    style["name"] = a.name
    style["label"] = a.name.replace("-", " ").title()
    style["summary"] = f"Imported from {src.name}. TODO: describe the look in one or two sentences."
    style["bestFor"] = ["TODO"]
    style["schemes"] = {"default": scheme}

    # Fonts
    heading_font = body_font = None
    if text and text["fonts"]:
        body_font = family_of(text["fonts"].most_common(1)[0][0])
        top_size = max(text["fontBySize"])
        heading_font = family_of(text["fontBySize"][top_size].most_common(1)[0][0])
    if pptx_info and pptx_info["fonts"]:
        heading_font = pptx_info["fonts"].get("major") or heading_font
        body_font = pptx_info["fonts"].get("minor") or body_font
    if heading_font:
        style["type"]["heading"]["family"] = [heading_font] + (GENERIC_SERIF if SERIF_HINTS.search(heading_font) else GENERIC_SANS)
    if body_font:
        style["type"]["body"]["family"] = [body_font] + (GENERIC_SERIF if SERIF_HINTS.search(body_font) else GENERIC_SANS)

    # Type scale (convert to px on a 1280-wide slide)
    sizes_px = Counter()
    if text and text["sizes"] and text["widthPt"]:
        k = 1280 / text["widthPt"]
        for s, n in text["sizes"].items():
            sizes_px[round(s * k)] += n
    elif pptx_info and pptx_info["sizes"]:
        k = 1280 / (pptx_info["slideWidthIn"] * 72)
        for s, n in pptx_info["sizes"].items():
            sizes_px[round(s * k)] += n
    scale = pick_scale(sizes_px)
    if scale:
        style["type"]["scale"] = scale
        extraction["sizesPx"] = dict(sorted(sizes_px.items()))
    style["rules"]["minFontPx"] = max(12, min(style["type"]["scale"]["caption"], 16))

    (dest / "style.json").write_text(json.dumps(style, indent=2) + "\n")
    shutil.copy(base_dir / "style.css", dest / "style.css")
    extraction["notes"] = notes
    extraction["fonts"] = {"heading": heading_font, "body": body_font}
    (dest / "extraction.json").write_text(json.dumps(extraction, indent=2, default=str) + "\n")
    guide = (SKILL / "workflows" / "guide-template.md").read_text().replace("{{name}}", style["label"]).replace("{{source}}", src.name).replace("{{base}}", a.base)
    (dest / "guide.md").write_text(guide)

    print(f"Draft style written to {dest}")
    print(f"  colours: bg {scheme['bg']}  ink {scheme['ink']}  primary {scheme['primary']}  accent {scheme['accent']}")
    print(f"  fonts:   heading {heading_font}  body {body_font}")
    if scale:
        print(f"  scale:   {scale}")
    print(f"  {len(refs)} reference images in reference/")
    print("Next: follow workflows/new-style.md (step 3 onward).")


if __name__ == "__main__":
    main()
