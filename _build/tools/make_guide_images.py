"""Render a guide's hero illustration (src/partials/hero-<slug>.svg) into the image sizes the guide needs:
1600x900, 1200x900 and 1200x1200 (JPEG for structured data, WebP for the page) and a 1200x630 share image.
Usage: python3 tools/make_guide_images.py rent-vs-buy "Rent or buy a home in India?" "How to decide, with a worked example"
Needs Playwright with Chrome; run locally, then commit the images in src/assets/img."""
import os, sys, tempfile
from playwright.sync_api import sync_playwright
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
slug, l1, l2 = sys.argv[1], sys.argv[2], sys.argv[3]
svg = open(os.path.join(ROOT, "src/partials", f"hero-{slug}.svg"), encoding="utf-8").read()
logo = open(os.path.join(ROOT, "src/partials/logo-inline.svg"), encoding="utf-8").read()
fonts = os.path.join(ROOT, "src/assets/fonts")
IMG = os.path.join(ROOT, "src/assets/img")
art = svg.replace('<rect width="1600" height="900" fill="url(#bg)"/>', "").replace('<rect width="1600" height="900" fill="url(#glow)"/>', "")  # no background, for layouts with their own
BG = "linear-gradient(135deg,#1F5FE0,#0B2A6B)"
def page(w, h, inner, extra=""):
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:J;src:url(file://{fonts}/jakarta-800.woff);font-weight:800}}
@font-face{{font-family:J;src:url(file://{fonts}/jakarta-600.woff);font-weight:600}}
body{{margin:0;width:{w}px;height:{h}px;overflow:hidden;background:{BG};font-family:J}}{extra}</style></head><body>{inner}</body></html>"""
BRAND = (f'<div style="position:absolute;left:64px;top:52px;z-index:3">{logo.replace("<svg ", '<svg style="height:56px;width:auto;display:block" ', 1)}</div>'
         '<div style="position:absolute;right:64px;bottom:44px;z-index:3;color:rgba(255,255,255,.85);font:600 26px J">salarist.in</div>')
BRAND_CSS = (".ink{fill:#fff}.coin{fill:#FFD27A}.wm .ink,.wm .coin{fill:#fff}"
             "body{background:radial-gradient(ellipse at 50% 35%,rgba(255,255,255,.16),rgba(255,255,255,0) 60%),linear-gradient(135deg,#1F5FE0,#0B2A6B)}")
def wm(w, h):
    """Faint Salarist wordmarks in the open areas of the background (watermark)."""
    spots = [(0.04, 0.72, 96), (0.58, 0.05, 80), (0.70, 0.64, 88), (0.30, 0.30, 64)]
    return "".join(f'<div class="wm" style="position:absolute;left:{x*w:.0f}px;top:{y*h:.0f}px;opacity:.07;transform:rotate(-12deg);z-index:0">'
                   f'{logo.replace("<svg ", f"<svg style=\"height:{sz}px;width:auto;display:block\" ", 1)}</div>' for x, y, sz in spots)
def layered(w, h, svg_tag):
    return wm(w, h) + f'<div style="position:absolute;inset:0;z-index:1">{svg_tag}</div>' + BRAND
jobs = {
    "1600x900": (1600, 900, page(1600, 900, layered(1600, 900, art.replace("<svg ", '<svg width="1600" height="900" ', 1)), BRAND_CSS)),
    "1200x900": (1200, 900, page(1200, 900, layered(1200, 900, art.replace("<svg ", '<svg width="1600" height="900" style="margin-left:-200px" ', 1)), BRAND_CSS)),
    "1200x1200": (1200, 1200, page(1200, 1200, layered(1200, 1200, art.replace("<svg ", '<svg width="1600" height="900" style="margin:150px 0 0 -200px" ', 1)), BRAND_CSS)),
    "og": (1200, 630, page(1200, 630, f"""<div class="t">{logo}<h1>{l1}<br><span>{l2}</span></h1><p>Free guide · salarist.in</p></div>
      <div class="art">{art.replace("<svg ", '<svg width="680" height="383" ', 1)}</div>""",
      ".t{position:absolute;left:64px;top:60px;width:560px;z-index:2}.t svg{height:52px;width:auto}.t .ink{fill:#fff}.t .coin{fill:#FFD27A}"
      "h1{color:#fff;font-weight:800;font-size:50px;line-height:1.1;margin:64px 0 0;letter-spacing:-.01em}h1 span{color:#FFD27A;font-size:34px}"
      "p{color:rgba(255,255,255,.8);font-weight:600;font-size:26px;margin:34px 0 0}.art{position:absolute;right:-70px;bottom:70px}")),
}
with sync_playwright() as p, tempfile.TemporaryDirectory() as tmp:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome")
    for name, (w, h, html) in jobs.items():
        f = os.path.join(tmp, name + ".html"); open(f, "w", encoding="utf-8").write(html)
        pg = b.new_page(viewport={"width": w, "height": h}); pg.goto("file://" + f); pg.wait_for_timeout(300)
        png = os.path.join(tmp, name + ".png"); pg.screenshot(path=png); pg.close()
        im = Image.open(png).convert("RGB")
        if name == "og": im.save(os.path.join(IMG, f"og-guide-{slug}.png"), optimize=True)
        else:
            im.save(os.path.join(IMG, f"guide-{slug}-{name}.jpg"), quality=84, optimize=True, progressive=True)
            if name == "1600x900": im.save(os.path.join(IMG, f"guide-{slug}-{name}.webp"), quality=80, method=6)
    b.close()
print("done")
