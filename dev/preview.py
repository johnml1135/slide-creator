#!/usr/bin/env python3
"""
Offline PREVIEW renderer used to produce the sample PDFs in environments where
Marp, D2 and Vega cannot be installed. It is NOT part of the skill.

It approximates the real pipeline:
  - runs scripts/build.mjs to generate theme.css + tokens.json (style generator is real)
  - converts deck.md to Marp-like <section> HTML with python-markdown
  - draws simple stand-ins for D2 diagrams (rows of boxes) and Vega charts (matplotlib)
  - prints to PDF with Playwright and runs the real inspector on the result

Usage: python3 dev/preview.py <projectDir> --style editorial [--scheme default] --pdf out.pdf
"""
import argparse, json, re, subprocess, sys, html, os
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
SKILL = ROOT / "skill" / "slide-creator"

# Fonts available in this sandbox standing in for the Windows/Office fonts named in style.json.
FONT_ALIASES = {
    "Georgia": "Lora", "Cambria": "Lora", "Segoe UI": "Inter", "Segoe UI Semibold": "Inter SemiBold",
    "Aptos": "Inter", "Aptos Display": "Inter", "Calibri": "Carlito", "Bahnschrift": "DejaVu Sans Condensed",
    "Cascadia Mono": "DejaVu Sans Mono", "Consolas": "DejaVu Sans Mono",
}


FONT_FILES = {
    "Bahnschrift": {400: "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed.ttf",
                    600: "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf",
                    700: "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf"},
}


def font_face_aliases():
    out = []
    for name, files in FONT_FILES.items():
        for w, f in files.items():
            if Path(f).exists():
                out.append(f"@font-face {{ font-family: '{name}'; src: url('file://{f}'); font-weight: {w}; }}")
    for name, local in FONT_ALIASES.items():
        if name in FONT_FILES:
            continue
        for w in (400, 600, 700):
            ps = local.replace(' ', '')
            out.append(f"@font-face {{ font-family: '{name}'; src: local('{local}'), local('{ps}'); font-weight: {w}; }}")
    return "\n".join(out)


def split_front(md):
    m = re.match(r"^---\r?\n([\s\S]*?)\r?\n---\r?\n?", md)
    if not m:
        return {}, md
    front = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            front[k.strip()] = v.strip().strip("'\"")
    return front, md[m.end():]


def split_slides(body):
    slides, cur, fence = [], [], False
    for line in body.splitlines():
        if re.match(r"^\s*(```|~~~)", line):
            fence = not fence
        if not fence and re.match(r"^\s*---\s*$", line):
            slides.append("\n".join(cur)); cur = []
        else:
            cur.append(line)
    slides.append("\n".join(cur))
    return slides


# ---------------- stand-in diagram renderer ----------------
def parse_d2(src):
    """Very small subset: top-level containers with children, plain nodes, edges."""
    nodes, groups, edges, order = {}, {}, [], []
    stack = []
    for raw in src.splitlines():
        line = raw.split("#")[0].rstrip()
        if not line.strip():
            continue
        s = line.strip()
        if s == "}":
            if stack:
                stack.pop()
            continue
        if "->" in s:
            a, rest = s.split("->", 1)
            b = rest.split("{")[0].split(":")[0].strip()
            prefix = ".".join(stack)
            fa = (prefix + "." if prefix else "") + a.strip()
            fb = (prefix + "." if prefix else "") + b
            edges.append((fa, fb))
            continue
        m = re.match(r'^([\w-]+)\s*:\s*"?([^"{]*)"?\s*(\{.*)?$', s)
        if m and not m.group(1) in ("direction", "class", "shape"):
            nid, label, rest = m.group(1), m.group(2).strip(), m.group(3) or ""
            cls = re.search(r"class:\s*([\w-]+)", rest)
            full = ".".join(stack + [nid])
            opens = rest.strip().endswith("{") and "}" not in rest
            if opens:
                groups[full] = {"label": label, "children": [], "class": "group"}
                order.append(full) if not stack else None
                stack.append(nid)
            else:
                nodes[full] = {"label": label, "class": cls.group(1) if cls else "box"}
                if stack:
                    groups[".".join(stack)]["children"].append(full)
                else:
                    order.append(full)
            continue
        m = re.match(r"^class:\s*([\w-]+)", s)
        if m and stack:
            groups[".".join(stack)]["class"] = m.group(1)
    return nodes, groups, edges, order


def render_d2_standin(src, t):
    c, d = t["colors"], t["diagram"]
    nodes, groups, edges, order = parse_d2(src)
    fs = d.get("fontSize", 18)
    stroke = d.get("stroke", 1.5)
    r = d.get("radius", 8)
    nf = d.get("nodeFill", "#FFFFFF")
    nf = c.get(nf, nf) if not str(nf).startswith("#") else nf
    nstroke = d.get("nodeStroke")
    nstroke = c.get(nstroke, c["ink"]) if nstroke else c["ink"]
    font = "Inter, sans-serif"
    BW, BH, GAP, PAD, GHEAD = 190, 64, 56, 22, 34
    x = 20
    pos, out = {}, []
    for item in order:
        if item in groups:
            g = groups[item]
            n = max(1, len(g["children"]))
            w = PAD * 2 + n * BW + (n - 1) * GAP
            h = GHEAD + PAD + BH + PAD
            out.append(f'<rect x="{x}" y="20" width="{w}" height="{h}" rx="{t["shape"].get("radiusLarge", r)}" fill="{c["surface"]}" stroke="{c.get(d.get("groupStroke","surface"), c["surface"])}" stroke-width="{stroke}"/>')
            out.append(f'<text x="{x + PAD}" y="{20 + 24}" font-family="{font}" font-size="{max(12, fs - 4)}" font-weight="700" fill="{c["muted"]}" letter-spacing="1">{html.escape(g["label"].upper())}</text>')
            cx = x + PAD
            for ch in g["children"]:
                pos[ch] = (cx, 20 + GHEAD + PAD)
                cx += BW + GAP
            x += w + GAP
        else:
            pos[item] = (x, 20 + GHEAD + PAD)
            x += BW + GAP
    width, height = x - GAP + 20, 20 + GHEAD + PAD * 2 + BH + 20
    for a, b in edges:
        if a in pos and b in pos:
            (ax, ay), (bx, by) = pos[a], pos[b]
            out.append(f'<line x1="{ax + BW}" y1="{ay + BH/2}" x2="{bx - 6}" y2="{by + BH/2}" stroke="{c["ink"]}" stroke-width="{stroke}" marker-end="url(#ah)"/>')
    for nid, (nx, ny) in pos.items():
        n = nodes.get(nid, {"label": nid, "class": "box"})
        cls = n["class"]
        fill, st, fc, dash, bold = nf, nstroke, c["ink"], "", "400"
        if cls == "key":
            fill, st, fc, bold = c["accent"], c["accent"], t["colors"]["onAccent"], "700"
        elif cls == "quiet":
            fill, st, fc, dash = c["bg"], c["muted"], c["muted"], 'stroke-dasharray="4 4"'
        elif cls in ("good", "warn", "bad", "info"):
            fill, st, fc, bold = c[cls], c[cls], t["colors"]["on" + cls.capitalize()], "700"
        out.append(f'<rect x="{nx}" y="{ny}" width="{BW}" height="{BH}" rx="{r}" fill="{fill}" stroke="{st}" stroke-width="{stroke}" {dash}/>')
        out.append(f'<text x="{nx + BW/2}" y="{ny + BH/2 + fs*0.35}" text-anchor="middle" font-family="{font}" font-size="{fs}" font-weight="{bold}" fill="{fc}">{html.escape(n["label"])}</text>')
    marker = f'<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="{c["ink"]}"/></marker></defs>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">{marker}{"".join(out)}</svg>'


# ---------------- stand-in chart renderer ----------------
def render_chart_standin(spec_path, t, out_path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager
    c, ch = t["colors"], t["chart"]
    spec = json.loads(Path(spec_path).read_text())
    vals = spec["layer"][0] if "layer" in spec else spec
    data = (spec.get("data") or vals.get("data"))["values"]
    enc = vals["encoding"]
    xs = [d[enc["x"]["field"]] for d in data]
    ys = [d[enc["y"]["field"]] for d in data]
    hi = c.get(ch.get("emphasis", "accent"), c["accent"])
    lo = c.get(ch.get("deemphasis", "muted"), c["muted"])
    if "accent" in json.dumps(enc.get("color", {})):
        hi = c["accent"]
    colors = [lo] * len(ys)
    colors[-1] = hi
    plt.rcParams.update({"font.family": "Inter", "font.size": ch.get("fontSize", 14) + 2, "svg.fonttype": "none"})
    fig, ax = plt.subplots(figsize=(10.5, 4.2), dpi=100)
    fig.patch.set_alpha(0); ax.set_facecolor("none")
    ax.bar(xs, ys, color=colors, width=0.62)
    for i, y in enumerate(ys):
        ax.text(i, y + 2, str(y), ha="center", va="bottom", color=c["ink"], fontweight="bold")
    ax.axhline(45, color=c["muted"], linestyle=(0, (6, 4)), linewidth=2)
    for s in ("top", "right", "left"):
        ax.spines[s].set_visible(False)
    ax.spines["bottom"].set_color(c["rule"])
    ax.tick_params(colors=c["muted"], length=0)
    ax.set_ylim(0, 105)
    if ch.get("grid") in ("y", "both"):
        ax.yaxis.grid(True, color=c["rule"]); ax.set_axisbelow(True)
    title = spec.get("title", {})
    ax.set_title(title.get("text", ""), loc="left", color=c["ink"], fontsize=ch.get("fontSize", 14) + 6, fontweight="semibold", pad=18)
    fig.tight_layout()
    fig.savefig(out_path, format="svg", transparent=True)
    plt.close(fig)


# ---------------- deck → HTML ----------------
def slide_html(text, idx, total, front, t):
    directives = dict(re.findall(r"<!--\s*(_?\w+)\s*:\s*(.*?)\s*-->", text))
    cls = directives.get("_class", directives.get("class", ""))
    paginate = front.get("paginate") == "true" and directives.get("_paginate") != "false"
    header = directives.get("_header", front.get("header", ""))
    footer = directives.get("_footer", front.get("footer", ""))
    body = re.sub(r"<!--[\s\S]*?-->", "", text)
    body = re.sub(r"!\[w:(\d+)\]\(([^)]+)\)", r'<img src="\2" style="width:\1px">', body)
    # markdown-it (Marp) treats an HTML line as a raw block until the next blank line; markdown resumes after it.
    lines = body.split("\n")
    for i, line in enumerate(lines):
        m = re.match(r"^\s*<(div|ol|ul)(\s[^>]*)?>\s*$", line)
        if m and i + 1 < len(lines) and not lines[i + 1].strip():
            lines[i] = f"<{m.group(1)}{m.group(2) or ''} markdown=\"1\">"
    body = "\n".join(lines)
    inner = markdown.markdown(body, extensions=["tables", "fenced_code", "md_in_html"])
    attrs = f' class="{cls}"' if cls else ""
    if paginate:
        attrs += f' data-marpit-pagination="{idx}"'
    parts = [f"<section{attrs}>"]
    if header:
        parts.append(f"<header>{html.escape(header)}</header>")
    parts.append(inner)
    if footer:
        parts.append(f"<footer>{html.escape(footer)}</footer>")
    parts.append("</section>")
    return "\n".join(parts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--style", required=True)
    ap.add_argument("--scheme", default="default")
    ap.add_argument("--pdf", required=True)
    a = ap.parse_args()
    proj = Path(a.project).resolve()
    out = proj / "build"
    subprocess.run(["node", str(SKILL / "scripts" / "build.mjs"), str(proj), "--style", a.style, "--scheme", a.scheme, "--no-inspect"],
                   capture_output=True, text=True)
    t = json.loads((out / "tokens.json").read_text())
    theme = (out / "theme.css").read_text()

    (out / "diagrams").mkdir(exist_ok=True)
    (out / "charts").mkdir(exist_ok=True)
    for f in (proj / "diagrams").glob("*.d2"):
        (out / "diagrams" / (f.stem + ".svg")).write_text(render_d2_standin(f.read_text(), t))
    for f in (proj / "charts").glob("*.json"):
        name = re.sub(r"(\.vl)?\.json$", "", f.name)
        render_chart_standin(f, t, out / "charts" / (name + ".svg"))

    front, body = split_front((proj / "deck.md").read_text())
    slides = split_slides(body)
    sections = "\n".join(slide_html(s, i + 1, len(slides), front, t) for i, s in enumerate(slides))
    page = f"""<!doctype html><html><head><meta charset="utf-8"><style>
{font_face_aliases()}
@page {{ size: 1280px 720px; margin: 0; }}
html, body {{ margin: 0; padding: 0; }}
section {{ page-break-after: always; break-after: page; }}
{theme}
</style></head><body>{sections}</body></html>"""
    html_path = out / "inspect.html"
    html_path.write_text(page)

    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=os.environ.get("SLIDE_BROWSER"))
        pg = b.new_page(viewport={"width": 1280, "height": 720})
        pg.goto(html_path.as_uri())
        pg.wait_for_timeout(400)
        Path(a.pdf).parent.mkdir(parents=True, exist_ok=True)
        pg.pdf(path=a.pdf, width="1280px", height="720px", print_background=True, prefer_css_page_size=True)
        b.close()
    print(f"preview pdf: {a.pdf}")


if __name__ == "__main__":
    main()
