"""Make a single self-contained HTML file of one built page, for review outside the site.
Usage: python3 tools/standalone.py /rent-vs-buy/ out.html [extra-js ...]"""
import base64, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); DIST = os.path.join(ROOT, "dist")
page, out, extra = sys.argv[1], sys.argv[2], sys.argv[3:]
html = open(os.path.join(DIST, page.strip("/"), "index.html"), encoding="utf-8").read()
def css(m):
    p = os.path.join(DIST, m.group(1).lstrip("/")); t = open(p, encoding="utf-8").read()
    t = re.sub(r"url\(\.\./fonts/([^)]+)\)", lambda f: "url(data:font/woff;base64," + base64.b64encode(open(os.path.join(DIST, "assets/fonts", f.group(1)), "rb").read()).decode() + ")", t)
    return "<style>" + t + "</style>"
html = re.sub(r'<link rel="stylesheet" href="([^"?]+)\?v=[^"]*">', css, html)
html = re.sub(r'<link rel="preload"[^>]*>', "", html)
def js(m): return "<script>" + open(os.path.join(DIST, m.group(1).lstrip("/")), encoding="utf-8").read() + "</script>"
inline_extra = "".join("<script>" + open(os.path.join(DIST, "assets/js", e), encoding="utf-8").read() + "</script>" for e in extra)
html = re.sub(r'<script src="([^"?]+)\?v=[^"]*" defer></script>', js, html)
html = html.replace("</body>", inline_extra + "</body>")
open(out, "w", encoding="utf-8").write(html); print(out, len(html) // 1024, "KB")
