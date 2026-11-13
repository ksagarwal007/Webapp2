#!/usr/bin/env python3
"""Salarist static site build: shared layout, SEO tags, structured data, sitemap. Output: dist/"""
import hashlib, json, os, re, shutil, subprocess, html as H

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC, DIST = os.path.join(ROOT, "src"), os.path.join(ROOT, "dist")
SITE = "https://salarist.in"
VERIFIED = "2026-11-12"; VERIFIED_TXT = "12 Nov 2026"; TAX_YEAR = "2026-27"

def rd(p): return open(os.path.join(SRC, p), encoding="utf-8").read()
def ver(p): return hashlib.sha1(open(os.path.join(SRC, p), "rb").read()).hexdigest()[:8]

LOGO = open(os.path.join(SRC, "partials/logo-inline.svg")).read().replace('role="img" aria-label="Salarist"', 'aria-hidden="true" focusable="false"')
CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'

LOCK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>'
def badges(verified_text):
    return (f'<div class="badges"><span class="badge priv">{LOCK}Private: calculated on your device. Nothing is stored or sent.</span>'
            + (f'<span class="badge ok">{CHECK}{verified_text} · <a href="#sources">Sources</a></span>' if verified_text else "") + '</div>')

LIVE_TOOLS = [("/leave-planner-2027/", "Leave Planner 2027"), ("/prepay-vs-invest/", "Prepay or Invest"), ("/rent-vs-buy/", "Rent or Buy"), ("/budget-planner/", "Budget Planner")]
CAR_LIVE = True   # set False to build without the car lease tool (e.g. to ship guides on their own)
if CAR_LIVE: LIVE_TOOLS.append(("/company-car-lease-vs-loan/", "Car Lease vs Car Loan"))
EMI_LIVE = True   # set False to build without the EMI calculator
if EMI_LIVE: LIVE_TOOLS.append(("/emi-calculator/", "EMI Calculator"))
QUICK_TOOLS = ["/emi-calculator/"]   # simple calculators: shown as chips, not big cards or menu items
MENU_EXTRA = []   # extra phone-menu tools for review builds
NAV = [("/tools/", "Tools"), ("/guides/", "Guides"), ("/methodology/", "How we check")]

def ld(obj): return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "</script>"

def breadcrumbs_ld(crumbs):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + u} for i, (u, n) in enumerate(crumbs)]}

def faq_ld(faqs):
    return {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": re.sub("<[^>]+>", "", a)}} for q, a in faqs]}

def faq_html(faqs):
    return '<div class="faq">' + "".join(f"<details><summary>{H.escape(q)}</summary><p>{a}</p></details>" for q, a in faqs) + "</div>"

def layout(path, title, desc, body, crumbs=None, graph=None, css=(), js=(), og="og-home.png", og_title=None, noindex=False, head_extra="", og_type="website"):
    graph = list(graph or [])
    if crumbs: graph.append(breadcrumbs_ld(crumbs))
    canon = SITE + path
    main_cls = ' class="home"' if path == "/" else ""
    nav = "".join(f'<a href="{u}" class="hide-sm"{" aria-current=\"page\"" if u == path else ""}>{n}</a>' for u, n in NAV)
    crumb_html = ""
    if crumbs:
        items = "".join((f'<li><a href="{u}">{H.escape(n)}</a></li>' if i < len(crumbs) - 1 else f'<li aria-current="page">{H.escape(n)}</li>') for i, (u, n) in enumerate(crumbs))
        crumb_html = f'<div class="wrap"><nav class="crumbs" aria-label="Breadcrumb"><ol>{items}</ol></nav></div>'
    css_links = "".join(f'<link rel="stylesheet" href="/assets/css/{c}?v={ver("assets/css/" + c)}">\n' for c in ("site.css",) + tuple(css))
    js_tags = "".join(f'<script src="/assets/js/{j}?v={ver("assets/js/" + j)}" defer></script>\n' for j in ("site.js",) + tuple(js))
    tools = "".join(f'<li><a href="{u}">{n}</a></li>' for u, n in LIVE_TOOLS)
    menu_tools = "".join(f'<li><a href="{u}"{" aria-current=\"page\"" if u == path else ""}>{n}</a></li>' for u, n in LIVE_TOOLS + MENU_EXTRA if u not in QUICK_TOOLS)
    return f'''<!DOCTYPE html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{H.escape(title)}</title>
<meta name="description" content="{H.escape(desc)}">
<link rel="canonical" href="{canon}">
<meta name="robots" content="{"noindex, follow" if noindex else "index, follow, max-image-preview:large"}">
<meta name="theme-color" content="#F5F7FB" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#07090D" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/img/icon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/assets/img/icon-180.png">
<link rel="manifest" href="/site.webmanifest">
{css_links}<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="Salarist">
<meta property="og:locale" content="en_IN">
<meta property="og:title" content="{H.escape(og_title or title)}">
<meta property="og:description" content="{H.escape(desc)}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{SITE}/assets/img/{og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<script>(function(){{try{{var t=sessionStorage.getItem("salarist-theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t);}}catch(e){{}}}})();</script>
{ld({"@context": "https://schema.org", "@graph": graph}) if graph else ""}
{head_extra}</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <div class="wrap">
    <a class="brand" href="/">{LOGO}<span class="visually-hidden">Salarist home</span></a>
    <nav class="nav" aria-label="Main">{nav}
      <button class="icon-btn" id="themeBtn" type="button" aria-label="Switch between light and dark theme">
        <svg class="moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
        <svg class="sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      </button>
      <button class="icon-btn menu-btn" id="menuBtn" type="button" aria-label="Menu" aria-expanded="false" aria-controls="menuPanel">
        <svg class="open" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        <svg class="close" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </nav>
  </div>
  <div class="menu-panel" id="menuPanel" hidden>
    <div class="wrap">
      <p class="menu-h">Tools</p>
      <ul>{menu_tools}<li><a href="/tools/"><b>See all tools →</b></a></li></ul>
      <p class="menu-h">Salarist</p>
      <ul><li><a href="/guides/">Guides</a></li><li><a href="/methodology/">How we check our numbers</a></li><li><a href="/about/">About</a></li><li><a href="/contact/">Contact</a></li></ul>
    </div>
  </div>
</header>
<main id="main"{main_cls}>
{crumb_html}
{body}
</main>
<footer>
  <div class="wrap">
    <div class="foot">
      <div>
        <a class="brand" href="/">{LOGO}<span class="visually-hidden">Salarist home</span></a>
        <p style="margin:12px 0 0;max-width:340px">Money and leave decision tools for salaried India. Free, private and checked against official sources.</p>
      </div>
      <div><h4>Tools</h4><ul><li><a href="/tools/">All tools</a></li><li><a href="/tools/#soon">What's coming</a></li></ul></div>
      <div><h4>Salarist</h4><ul>
        <li><a href="/guides/">Guides</a></li><li><a href="/about/">About</a></li><li><a href="/methodology/">How we check our numbers</a></li><li><a href="/contact/">Contact</a></li>
        <li><a href="/privacy/">Privacy policy</a></li><li><a href="/terms/">Terms of use</a></li><li><a href="/disclaimer/">Disclaimer</a></li></ul></div>
    </div>
    <p class="disc">Salarist provides estimates for information only. It is not tax, legal or financial advice. Check important decisions with a qualified adviser. © 2026 Salarist.</p>
  </div>
</footer>
{js_tags}</body>
</html>
'''

# ---------------- Home ----------------
def home():
    tpl = open(os.path.join(SRC, "partials/home.tpl.html"), encoding="utf-8").read()
    body = tpl[tpl.index('<section class="hero">'):tpl.index("</main>")]
    order = ["/guides/long-weekends-2027/", "/guides/monthly-budget/", "/guides/rent-vs-buy/"]
    gs = sorted(GUIDES, key=lambda g: order.index(g[0]) if g[0] in order else 99)[:3]
    cards = "".join(f'<a class="g-card" href="{p}">{_pic(im, "")}<span class="k">{sec}</span><b>{t}</b><span>{ds}</span></a>' for p, t, ds, d, im, sec in gs)
    guides_sec = (f'<section id="guides" aria-labelledby="guides-h" style="padding-top:0"><div class="wrap">'
                  f'<p class="eyebrow">Guides</p><h2 id="guides-h">Understand the decision before you make it</h2>'
                  f'<p class="lead">Plain-English guides that walk through each decision with a worked example and explain every number the tools show.</p>'
                  f'<div class="g-cards" style="margin-top:24px">{cards}</div>'
                  f'<p style="margin:20px 0 0"><a class="more" href="/guides/">See all guides →</a></p></div></section>\n')
    i = body.index('<section id="tools"'); j = body.index("</section>", i); k = body.rindex("</div>", i, j)
    body = body[:k] + ('<div class="quick"><h3 class="list-h" style="margin:34px 0 14px">Quick calculators</h3>' + quick_chips() +
                       '<p style="margin:18px 0 0"><a class="more" href="/tools/">See all tools →</a></p></div>') + body[k:]
    body = body.replace('<section id="rates"', guides_sec + '<section id="rates"', 1)
    body = body.replace('<a class="ask primary" href="/leave-planner-2027/">Plan my 2027 leave <span class="soon">Launching soon</span></a>',
                        '<a class="ask primary" href="/leave-planner-2027/">Plan my 2027 leave <span class="soon">New</span></a>')
    body = body.replace('<a class="ask" href="/prepay-vs-invest/">Prepay or invest? <span class="soon">Jan 2027</span></a>', '<a class="ask" href="/prepay-vs-invest/">Prepay or invest? <span class="soon">New</span></a>')
    body = body.replace('<a class="ask" href="/rent-vs-buy/">Rent or buy? <span class="soon">Jan 2027</span></a>', '<a class="ask" href="/rent-vs-buy/">Rent or buy? <span class="soon">New</span></a>')
    body = body.replace('<span class="st"><b>Coming January 2027</b></span>\n      </a>\n      <a class="tool" href="/ctc-to-in-hand/">', f'<span class="st"><b class="live">Live</b> · tax year {TAX_YEAR}</span>\n      </a>\n      <a class="tool" href="/ctc-to-in-hand/">', 1)
    body = body.replace('<span class="st"><b>Coming soon</b></span>\n      </a>\n      <a class="tool" href="/company-car-lease-vs-loan/">', '<span class="st"><b class="live">Live</b> · new</span>\n      </a>\n      <a class="tool" href="/company-car-lease-vs-loan/">', 1)
    for u in ("/ctc-to-in-hand/",):
        body = body.replace(f'<a class="ask" href="{u}">', '<a class="ask" href="#tools">')
    body = body.replace('<span class="st"><b>Launching soon</b> · next up</span>', f'<span class="st"><b class="live">Live</b> · verified {VERIFIED_TXT}</span>')
    body = body.replace('<span class="st"><b>Coming January 2027</b></span>\n      </a>\n      <a class="tool" href="/rent-vs-buy/">', f'<span class="st"><b class="live">Live</b> · tax year {TAX_YEAR}</span>\n      </a>\n      <a class="tool" href="/rent-vs-buy/">', 1)
    if CAR_LIVE:
        body = body.replace('<h3>Company car lease or bank loan?</h3>', '<h3>Car lease or car loan?</h3>', 1)
        body = body.replace('Compare a salary-linked car lease with a regular car loan, including tax and the resale value.</p>\n        <span class="st"><b>Coming soon</b></span>',
                            f'Compare a salary-linked car lease with a regular car loan, including tax and the resale value.</p>\n        <span class="st"><b class="live">Live</b> · tax year {TAX_YEAR}</span>', 1)
    # Tools that aren't built yet are not links (no dead links for Google or visitors)
    def unlink(m):
        return '<div class="tool off">' + m.group(2) + "</div>"
    body = re.sub((r'<a class="tool" href="(/(?:ctc-to-in-hand)/)">(.*?)</a>' if CAR_LIVE else r'<a class="tool" href="(/(?:ctc-to-in-hand|company-car-lease-vs-loan)/)">(.*?)</a>'), unlink, body, flags=re.S)
    icons = json.load(open(os.path.join(SRC, "partials/icons.json")))
    for k, v in icons.items(): body = body.replace("{{" + k + "}}", v)
    body = body.replace("{{CHECK}}", CHECK)
    body = body.replace('<div class="wrap ad-slot" aria-label="Advertisement"></div>', '<div class="wrap ad-slot" aria-label="Advertisement"></div>')
    script = tpl[tpl.index("/* Central government gazetted holidays"):tpl.index('document.getElementById("yr")')]
    body += "<script>(function(){\n" + script + "})();</script>"
    faqs = re.findall(r"<details><summary>(.*?)</summary><p>(.*?)</p></details>", body)
    graph = [{"@type": "WebSite", "@id": SITE + "/#website", "name": "Salarist", "url": SITE + "/", "inLanguage": "en-IN"},
             {"@type": "Organization", "@id": SITE + "/#org", "name": "Salarist", "url": SITE + "/", "logo": SITE + "/assets/img/icon-512.png", "email": "contact@salarist.in"},
             faq_ld([(H.unescape(q), H.unescape(a)) for q, a in faqs])]
    return layout("/", "Salarist — Money and leave decision tools for salaried India",
                  "Free money and leave tools for salaried Indians: plan 2027 leave, prepay your loan or invest, and rent or buy a home. No sign-up, official rates.",
                  body, graph=graph, og_title="Salarist — Make the big money calls with confidence")

# ---------------- Leave planner ----------------
def leave_planner():
    data = json.load(open(os.path.join(SRC, "data/holidays-2027.json")))
    calc = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools/static_lists.js")], text=True))
    import datetime as dt
    def fdate(s, wd=True):
        d = dt.date.fromisoformat(s); return (d.strftime("%a ") if wd else "") + f"{d.day} {d.strftime('%b')}"
    def rows(lst):
        return "".join(f'<tr><td class="d">{dt.date.fromisoformat(d).strftime("%a")} {dt.date.fromisoformat(d).day} {dt.date.fromisoformat(d).strftime("%b")}</td><td>{H.escape(n)}</td></tr>' for d, n in lst)
    def blist(items):
        return "".join(f'<li><strong>{fdate(b["from"])} – {fdate(b["to"])}</strong>: {b["len"]} days off' + (f' with {b["leave"]} day{"s" if b["leave"] > 1 else ""} of leave ({", ".join(fdate(x) for x in b["leaveDays"])})' if b["leave"] else "") + f' · {H.escape(", ".join(b["holidays"]))}</li>' for b in items)
    faqs = [
        ("How many central government holidays are there in 2027?",
         "The DoPT order dated 16 July 2026 lists 17 gazetted holidays for central government offices in Delhi and New Delhi, and employees there can also pick any two of 32 restricted holidays. Independence Day and Milad-un-Nabi both fall on Sunday 15 August, so only 16 dates are distinct."),
        ("How long a break can I get in 2027?",
         "It depends on how much leave you can take. For example, with Saturdays and Sundays off, three days of leave on 22, 24 and 25 March, around Holi (23 March) and Good Friday (26 March), give nine days off in a row from 20 to 28 March. Choose “Plan a break” and set any length up to 21 days to see the dates that need the fewest leave days."),
        ("How do I get a long break with the fewest leave days?",
         "Choose “Plan a break”, set how many days off in a row you want, and pick a month if you have one in mind. The planner shows the dates that need the fewest leave days first. For example, a 9-day break from 20 to 28 March 2027 needs only 3 days of leave with Saturdays and Sundays off."),
        ("My company has a different holiday list. Does this still work?",
         "Yes. Open “Match your company's holidays” to untick holidays your employer doesn't give, add restricted holidays it does give, and add any extra company holidays. The plan updates straight away."),
        ("What does the “2nd and 4th Saturdays” option mean?",
         "Some workplaces give every Sunday off plus the second and fourth Saturday of each month. Pick that option and the planner treats the other Saturdays as working days."),
        ("Are the festival dates final?",
         "They are the dates in the official order. Dates of some festivals, such as Id, depend on the sighting of the moon and can shift. If that happens, your employer will announce the change, and we update the planner."),
        ("Is my leave plan saved anywhere?",
         "No. The planner runs in your browser and nothing is sent to us or stored. A share link carries only your settings, such as weekly off and leave days, and not any holiday names you type."),
        ("Can I add my plan to Google Calendar or Outlook?",
         "Yes. “Add to calendar” downloads an .ics file with each break as an all-day event. Open it on your phone or computer to add it to Google Calendar, Outlook or Apple Calendar."),
    ]
    body = f'''<section class="tool-hero"><div class="wrap">
  <p class="eyebrow">Leave planner</p>
  <h1>Leave Planner 2027: turn your leave into the longest breaks</h1>
  <p class="lead">Two ways to plan: tell us how long a break you want and we'll find the dates that need the fewest leave days, or tell us how many leave days you have and we'll spread them for the most days off. Both work with your own company's holidays.</p>
  {badges("Holidays verified on " + VERIFIED_TXT + " against the DoPT order of 16 July 2026")}
</div></section>

<section style="padding-top:0"><div class="wrap lp">
  <div class="card lp-setup" aria-label="Your settings">
    <div class="modes" role="tablist" aria-label="What do you want to plan?">
      <button type="button" role="tab" data-mode="break" aria-selected="true"><b>Plan a break</b><span>I want a trip of a set length</span></button>
      <button type="button" role="tab" data-mode="most" aria-selected="false"><b>Make the most of my leave</b><span>I have a number of leave days</span></button>
    </div>
    <div data-for="break">
      <span class="lbl" id="lenLbl">How many days off in a row?</span>
      <div class="stepper" role="group" aria-labelledby="lenLbl">
        <button type="button" id="lpLenMinus" aria-label="One day shorter">−</button>
        <span class="val" id="lpLenVal" aria-live="polite">5</span>
        <button type="button" id="lpLenPlus" aria-label="One day longer">+</button>
      </div>
      <input type="range" id="lpLen" min="3" max="21" value="5" aria-labelledby="lenLbl">
      <label class="lbl" for="lpMonth" style="margin-top:18px">When?</label>
      <select id="lpMonth" class="sel"><option value="-1">Any time in 2027</option><option value="0">January</option><option value="1">February</option><option value="2">March</option><option value="3">April</option><option value="4">May</option><option value="5">June</option><option value="6">July</option><option value="7">August</option><option value="8">September</option><option value="9">October</option><option value="10">November</option><option value="11">December</option></select>
      <p class="hint">We'll show the dates that need the fewest leave days.</p>
    </div>
    <div data-for="most" hidden>
      <span class="lbl" id="budgetLbl">Leave days you want to use</span>
      <div class="stepper" role="group" aria-labelledby="budgetLbl">
        <button type="button" id="lpMinus" aria-label="One day less">−</button>
        <span class="val" id="lpBudgetVal" aria-live="polite">8</span>
        <button type="button" id="lpPlus" aria-label="One day more">+</button>
      </div>
      <input type="range" id="lpBudget" min="1" max="30" value="8" aria-labelledby="budgetLbl">
      <p class="hint">We'll spread them across the year to give you the most days off in total.</p>
    </div>
    <div>
      <span class="lbl" id="weekLbl">Your weekly off</span>
      <div class="seg" role="group" aria-labelledby="weekLbl">
        <button type="button" data-pattern="ss" aria-pressed="true">Saturday and Sunday</button>
        <button type="button" data-pattern="s24" aria-pressed="false">Sunday, plus 2nd and 4th Saturday</button>
        <button type="button" data-pattern="s" aria-pressed="false">Sunday only</button>
      </div>
    </div>
    <details class="edit" id="lpEdit">
      <summary>Match your company's holidays</summary>
      <p class="hint" style="margin-top:0">Starting list: central government, Delhi · <b id="lpHolCount">16</b> holiday dates in use</p>
      <h3>Central government holidays</h3>
      <div class="sub" id="lpGaz"></div>
      <h3>Restricted holidays your employer gives</h3>
      <div class="sub" id="lpRh"></div>
      <h3>Other company holidays</h3>
      <form class="custom-form" id="lpCustomForm">
        <label class="visually-hidden" for="lpCustomDate">Date</label>
        <input type="date" id="lpCustomDate" min="2027-01-01" max="2027-12-31" required>
        <label class="visually-hidden" for="lpCustomName">Holiday name</label>
        <input type="text" id="lpCustomName" placeholder="Name (optional)" maxlength="60">
        <button type="submit" class="btn-sm">Add holiday</button>
      </form>
      <ul class="custom-list" id="lpCustomList"></ul>
      <p style="margin:12px 0 18px"><button type="button" class="btn-sm btn-ghost" id="lpReset">Reset to central list</button></p>
    </details>
  </div>

  <div>
    <div class="verdict" id="lpVerdict" aria-live="polite"></div>
    <div class="actions">
      <button type="button" class="btn-sm pri" id="lpImgBtn">Share as image</button>
      <button type="button" class="btn-sm" id="lpIcs">Add to calendar</button>
      <button type="button" class="btn-sm" id="lpCopy">Copy leave dates</button>
      <button type="button" class="btn-sm btn-ghost" id="lpShare">Copy share link</button>
    </div>
    <p class="status" id="lpStatus" role="status"></p>
    <h2 class="list-h" id="lpListH">Your options</h2>
    <div class="legend2"><span><i class="sw-hol"></i>Holiday</span><span><i class="sw-lv"></i>Your leave</span><span><i class="sw-wk"></i>Weekly off</span></div>
    <ol class="brks" id="lpPlan"></ol>
  </div>
</div></section>

<section style="padding-top:0"><div class="wrap">
  <h2>Your {data["year"]} at a glance</h2>
  <p class="lead" style="font-size:15px">Your best option, or your whole plan, marked on the calendar.</p>
  <div class="legend2"><span><i class="sw-hol"></i>Holiday</span><span><i class="sw-lv"></i>Your leave</span><span><i class="sw-wk"></i>Weekly off</span><span><i class="sw-in"></i>Days of your break</span></div>
  <div class="cal" id="lpCal"></div>
</div></section>

<section style="padding-top:0"><div class="wrap two">
  <div><h2>Best value: 1 to 3 days of leave</h2><p class="lead" style="font-size:15px">The most days off for each day of leave, based on your settings.</p><ul class="brks" id="lpValue"></ul></div>
  <div><h2>Long weekends with no leave</h2><p class="lead" style="font-size:15px">Holidays that already touch a weekend.</p><ul class="brks" id="lpLong"></ul></div>
</div></section>
{related("/leave-planner-2027/")}
<div class="wrap aff-slot" aria-label="Sponsored"></div>

<section style="padding-top:0"><div class="wrap prose">
  <p class="g-callout"><b>Want the full picture?</b> Read our guide, <a href="/guides/long-weekends-2027/">Long weekends 2027 in India</a>: every holiday, every long weekend and two ready-made leave plans. Also read: <a href="/guides/restricted-holidays-2027/">Restricted holidays 2027: which two to pick</a>, <a href="/guides/best-months-for-a-week-long-break-2027/">the best months for a week-long break</a> and <a href="/guides/long-weekends-2027-six-day-week/">long weekends for six-day weeks</a>.</p>
  <h2>How the leave planner works</h2>
  <p>The planner marks every day of {data["year"]} as a weekly off, a holiday or a working day, using your weekly off and your company's holidays.</p>
  <ul><li><strong>Plan a break:</strong> choose how many days off in a row you want, and optionally a month. The planner checks every possible start date and shows the dates that need the fewest leave days.</li>
  <li><strong>Make the most of my leave:</strong> choose how many leave days you want to use. The planner looks at every stretch that starts and ends on a day off and picks the set of breaks that gives you the most days off in total, without going over your leave.</li></ul>
  <p>Days off always include the weekends and holidays inside each break.</p>
  <p>It starts from the central government list for offices in Delhi and New Delhi, because many employers use it as a reference. Central government offices outside Delhi, state government offices, banks and private companies often follow a different list, so use “Match your company's holidays” to make it yours.</p>

  <h2>Central government holidays 2027</h2>
  <p>The 17 gazetted holidays for central government administrative offices in Delhi and New Delhi, from the DoPT order dated 16 July 2026.</p>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Holiday</th></tr></thead><tbody>{rows(data["gazetted"])}</tbody></table></div>

  <h2>Long weekends in 2027</h2>
  <p>With Saturday and Sunday off, these holidays give you three or more days off without taking any leave:</p>
  <ul>{blist(calc["long"])}</ul>

  <h2>Best days to take leave in 2027</h2>
  <p>With Saturday and Sunday off, these short bridges give the most days off for each day of leave:</p>
  <ul>{blist(calc["value"])}</ul>

  <h2>Restricted holidays 2027</h2>
  <p>Central government employees in Delhi and New Delhi can choose any two of these 32 restricted holidays. Many private employers offer a similar set of optional or floating holidays.</p>
  <details class="card" style="padding:0 22px"><summary>Show all 32 restricted holidays</summary><div class="tbl-wrap"><table class="tbl" style="margin-bottom:16px"><thead><tr><th>Date</th><th>Holiday</th></tr></thead><tbody>{rows(data["restricted"])}</tbody></table></div></details>

  <h2>Tips for planning your leave</h2>
  <ul>
    <li><strong>Apply early for the big ones.</strong> Breaks around Holi and Good Friday in March, and Diwali at the end of October, are the ones colleagues will want too.</li>
    <li><strong>Check your company's list first.</strong> Your HR policy decides which holidays you actually get. Add them in the planner before you apply.</li>
    <li><strong>Use your restricted holidays well.</strong> If your employer lets you pick Holika Dahan (Monday 22 March) as a restricted holiday, the nine-day Holi break from 20 to 28 March needs only two days of leave. Tick your restricted holidays in the planner to see the effect.</li>
    <li><strong>Mind the moon-dependent dates.</strong> Id-ul-Fitr, Bakrid, Muharram and Milad-un-Nabi can move by a day.</li>
  </ul>

  <h2 id="sources">Sources</h2>
  <p>Gazetted and restricted holidays: <a href="https://dopt.gov.in/" rel="noopener">Department of Personnel and Training</a>, O.M. F.No.12/2/2023-JCA dated 16 July 2026, Annexures I and II, for central government administrative offices in Delhi and New Delhi. Verified on {VERIFIED_TXT}. Read <a href="/methodology/">how we check our numbers</a>.</p>

  <h2>Frequently asked questions</h2>
  {faq_html(faqs)}
</div></section>
<dialog class="dlg" id="lpShareDlg" aria-labelledby="dlgH">
  <h2 id="dlgH">Share your plan</h2>
  <p class="hint" style="margin:4px 0 14px">Made on your phone. Nothing is uploaded.</p>
  <img id="lpImg" alt="Your leave plan as a shareable image" width="1080" height="1350">
  <div class="dlg-opts">
    <div class="pal" role="radiogroup" aria-label="Image colour"><button type="button" role="radio" data-pal="blue" aria-checked="true"><i style="background:#1F5FE0"></i>Blue</button><button type="button" role="radio" data-pal="dark" aria-checked="false"><i style="background:#07090D;border:1px solid #2A3850"></i>Dark</button></div>
    <label class="lbl" for="lpImgTitle" style="margin:14px 0 6px">Title on the image</label>
    <div class="title-row"><input type="text" id="lpImgTitle" maxlength="70" autocomplete="off"><button type="button" class="link-btn" id="lpImgTitleReset" style="color:var(--brand)">Reset</button></div>
  </div>
  <div class="actions"><button type="button" class="btn-sm pri" id="lpImgShare">Share on WhatsApp &amp; more</button><button type="button" class="btn-sm" id="lpImgDl">Save image</button><button type="button" class="btn-sm btn-ghost" id="lpImgClose">Close</button></div>
  <p class="status" id="lpImgStatus" role="status"></p>
</dialog>
<script type="application/json" id="lp-data">{json.dumps(data, ensure_ascii=False)}</script>
'''
    graph = [{"@type": "WebApplication", "name": "Leave Planner 2027", "url": SITE + "/leave-planner-2027/", "applicationCategory": "LifestyleApplication",
              "operatingSystem": "Any", "browserRequirements": "Requires JavaScript", "isAccessibleForFree": True, "inLanguage": "en-IN",
              "offers": {"@type": "Offer", "price": "0", "priceCurrency": "INR"}, "dateModified": VERIFIED,
              "description": "Plan 2027 leave around India's central government holidays: find long weekends, the best days to take leave and the longest breaks for your leave balance.",
              "publisher": {"@id": SITE + "/#org"}},
             faq_ld(faqs)]
    body = add_tips(body, "lp", LP_TIPS)
    return layout("/leave-planner-2027/", "Leave Planner 2027: Long Weekends & Leave Days | Salarist",
                  "Find every 2027 long weekend and the best days to take leave around India's holidays. Get the most days off for your leave. Free, no sign-up.",
                  body, crumbs=[("/", "Home"), ("/leave-planner-2027/", "Leave Planner 2027")], graph=graph,
                  css=("tool.css",), js=("leave-planner.js",), og="og-leave-planner-2027.png",
                  og_title="Leave Planner 2027: turn your leave into the longest breaks")


# ---------------- Prepay vs invest ----------------
def prepay_page():
    faqs = [
        ("Is it better to prepay a home loan or invest?",
         "It depends mainly on three things: your loan's interest rate, the return you expect after tax, and whether you get a tax deduction on the interest. If your investments can beat the loan's effective interest rate after tax, investing usually wins over the long run. If not, prepaying wins, and it's guaranteed."),
        ("Does prepaying make sense under the new tax regime?",
         "Under the new regime you get no deduction for interest on a self-occupied home, so every rupee of interest you avoid by prepaying is a real saving. That makes prepaying relatively more attractive than under the old regime."),
        ("How does the old regime change the answer?",
         "Under the old regime you can deduct up to ₹2,00,000 of home loan interest a year on a self-occupied home (section 22 of the Income-tax Act, 2025, earlier section 24(b)). Prepaying reduces your interest, so it also reduces this tax saving. The calculator includes that lost saving."),
        ("Should I reduce my EMI or my tenure when I prepay?",
         "This calculator assumes you keep the same EMI and shorten the tenure, which saves the most interest. Once the loan closes, it assumes you invest your EMI and the extra amount every month until the original end date, so both choices are compared over the same period."),
        ("How are investment returns taxed in the calculator?",
         "Equity mutual fund gains are taxed at 12.5% above ₹1,25,000, plus 4% cess, when you sell at the end. Debt fund gains are taxed at your slab rate when you sell (for units bought on or after 1 April 2023). FD interest is taxed every year at your slab rate, so FD money grows at the after-tax rate."),
        ("Is the result guaranteed?",
         "No. Prepaying gives a certain saving, while market returns are not guaranteed and can be lower than you expect, especially over short periods. Use the breakeven return to judge how much risk you're taking: if you need a high return for investing to win, prepaying is the safer choice."),
    ]
    num = lambda k, label, unit, mn, mx, st, prefix=True: f"""<div class="fld"><div class="row1"><label for="pv-{k}">{label}</label><span class="w" id="pv-{k}-w"></span></div>
      <div class="numin">{'<span>₹</span>' if prefix else ''}<input id="pv-{k}" {'type="text" inputmode="numeric" autocomplete="off"' if prefix else f'type="number" inputmode="decimal" min="{mn}" max="{mx}" step="{st}"'}>{'' if prefix else f'<span>{unit}</span>'}</div>
      <input type="range" id="pv-{k}-r" min="{mn}" max="{mx}" step="{st}" aria-label="{label}"></div>"""
    body = f"""<section class="tool-hero"><div class="wrap">
  <p class="eyebrow">Loans</p>
  <h1>Prepay your home loan or invest the extra?</h1>
  <p class="lead">Every extra rupee can close your loan sooner or grow in the market. We run both choices month by month, with the same money going in either way, include the tax rules for your regime, and show which one leaves you richer.</p>
  {badges("Tax rules for tax year " + TAX_YEAR)}
</div></section>

<section style="padding-top:0"><div class="wrap lp">
  <div class="card lp-setup" aria-label="Your numbers">
    {num("P", "Loan outstanding", "", 100000, 50000000, 50000)}
    <div class="two-col">{num("rate", "Interest rate", "%", 5, 15, 0.05, False)}{num("years", "Years left", "yrs", 1, 30, 1, False)}</div>
    {num("extra", "Extra you can pay each month", "", 0, 500000, 1000)}
    <div>{num("lump", "One-time amount today (optional)", "", 0, 20000000, 50000)}<p class="hint">Prepay: it goes into the loan today. Invest: it's invested today.</p></div>
    {num("ret", "Return you expect from investing", "% a year", 3, 18, 0.5, False)}
    <div><span class="lbl" id="kindLbl">Where you'd invest</span>
      <div class="seg row" role="group" aria-labelledby="kindLbl"><button type="button" data-kind="equity">Equity funds</button><button type="button" data-kind="debt">Debt fund</button><button type="button" data-kind="fd">Fixed deposit</button></div></div>
    <div><span class="lbl" id="regLbl">Your tax regime</span>
      <div class="seg row" role="group" aria-labelledby="regLbl"><button type="button" data-regime="new">New regime</button><button type="button" data-regime="old">Old regime</button></div></div>
    <div class="fld"><label class="lbl" for="pv-slab" style="margin:0">Your income tax slab</label>
      <select id="pv-slab" class="sel"><option value="0">0%</option><option value="5">5%</option><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option><option value="25">25%</option><option value="30">30%</option></select></div>
    <label class="chk" id="pv-claim-row" for="pv-claim" style="border:0;grid-template-columns:22px 1fr"><input type="checkbox" id="pv-claim"><span>I claim the home loan interest deduction (self-occupied home, up to ₹2,00,000 a year)</span></label>
  </div>

  <div>
    <div class="verdict" id="pvVerdict" aria-live="polite"></div>
    <div class="actions">
      <button type="button" class="btn-sm pri" id="pvPdf">Download PDF report</button>
      <button type="button" class="btn-sm" id="pvXlsx">Download Excel</button>
      <button type="button" class="btn-sm btn-ghost" id="pvImgBtn">Share as image</button>
      <button type="button" class="btn-sm btn-ghost" id="pvShare">Copy share link</button>
    </div>
    <p class="status" id="pvStatus" role="status"></p>
    <div class="stats">
      <div class="stat"><div class="l">Interest saved by prepaying</div><div class="n" id="pvSaved">—</div></div>
      <div class="stat"><div class="l">Loan closes</div><div class="n" id="pvEarly">—</div></div>
      <div class="stat"><div class="l">Investing wins above</div><div class="n" id="pvBe">—</div><div class="h">The yearly return your investments need to come out ahead</div></div>
      <div class="stat"><div class="l">Your EMI</div><div class="n" id="pvEmi">—</div></div>
    </div>
    <h2 class="list-h">What if returns are different?</h2>
    <div class="sens" id="pvSens"></div>
    <div class="chartbox">
      <h2 class="list-h" style="margin:0 0 4px">Net worth over time</h2>
      <p class="hint" style="margin:0 0 10px">Your investments minus what you still owe on the loan, after tax at the end.</p>
      <div id="pvChart"></div>
      <div class="legend2"><span><i style="background:var(--brand)"></i>Invest the extra</span><span><i style="background:var(--leave)"></i>Prepay, then invest</span></div>
      <p class="hint" id="pvCross"></p>
    </div>
    <h2 class="list-h">Where your money went</h2>
    <div class="money" id="pvMoney"></div>
    <p class="hint" id="pvMoneyNote"></p>
    <a class="next" id="pvNext" href="/rent-vs-buy/"><span class="k">Your next decision</span><b>Haven't bought yet? Check whether renting and investing leaves you richer</b><span class="h">Opens Rent or Buy with your rate, tenure and tax details filled in.</span></a>
    <h2 class="list-h">Assumptions</h2>
    <ul class="notes" id="pvNotes"></ul>
  </div>
</div></section>

<section style="padding-top:0"><div class="wrap">
  <h2>The full calculation</h2>
  <p class="lead" style="font-size:15px">Year by year for each choice. Tap a year to see its 12 months.</p>
  <div class="modes tabs2" role="tablist" aria-label="Choose which calculation to show"><button type="button" role="tab" data-tab="prepay" aria-selected="true"><b>Prepay, then invest</b></button><button type="button" role="tab" data-tab="invest" aria-selected="false"><b>Invest the extra</b></button></div>
  <div class="tbl-wrap calc-wrap" id="pvTable"></div>
</div></section>
{related("/prepay-vs-invest/")}
<div class="wrap aff-slot" aria-label="Sponsored"></div>

<section style="padding-top:0"><div class="wrap prose">
  <p class="g-callout"><b>Not sure how to read the result?</b> Read our guide, <a href="/guides/prepay-home-loan-or-invest/">Prepay your home loan or invest?</a>, worked through one borrower's numbers.</p>
  <h2>How the calculator works</h2>
  <p>Both choices start with the same loan and the same extra money, and run month by month until your loan's original end date.</p>
  <ul><li><strong>Prepay:</strong> the extra goes into the loan every month. Your EMI stays the same, so the loan closes sooner. From then on, your EMI and the extra are invested every month until the original end date.</li>
  <li><strong>Invest:</strong> the loan runs its normal course, and the extra is invested every month from day one.</li></ul>
  <p>At the end, the loan is fully repaid either way, so the choice with the bigger investment pot after tax is the one that leaves you richer. The breakeven return is the yearly return at which both choices come out equal.</p>

  <h2>Tax rules used, tax year 2026-27</h2>
  <ul>
    <li><strong>Home loan interest, old regime:</strong> up to ₹2,00,000 a year for a self-occupied home, under section 22 of the Income-tax Act, 2025 (section 24(b) of the 1961 Act). The tax saved each year is assumed to be invested.</li>
    <li><strong>Home loan interest, new regime:</strong> no deduction for a self-occupied home.</li>
    <li><strong>Equity mutual funds:</strong> long-term gains taxed at 12.5% above ₹1,25,000 a year, plus 4% cess. Budget 2026 left these rates unchanged.</li>
    <li><strong>Debt funds:</strong> gains taxed at your income tax slab rate, plus 4% cess, for units bought on or after 1 April 2023.</li>
    <li><strong>FDs:</strong> interest taxed every year at your slab rate, plus 4% cess.</li>
  </ul>
  <p>We leave out surcharge, prepayment charges (banks can't charge them on floating-rate home loans taken by individuals; on a fixed-rate loan, check your loan terms) and the old-regime deduction for principal repayment, which most people already use up through PF and other savings.</p>

  <h2>When prepaying makes more sense</h2>
  <ul>
    <li>You're on the new tax regime, so interest gives you no tax benefit.</li>
    <li>Your loan rate is high, or you'd invest in FDs or debt funds rather than equity.</li>
    <li>You have less than about five years left, too short to ride out market ups and downs.</li>
    <li>Being debt-free sooner matters to you, for peace of mind or a planned career break.</li>
  </ul>
  <h2>When investing makes more sense</h2>
  <ul>
    <li>You have many years left and invest in equity funds steadily.</li>
    <li>You're on the old regime and still claim the full ₹2,00,000 interest deduction.</li>
    <li>You already have an emergency fund and adequate insurance.</li>
  </ul>

  <h2 id="sources">Sources</h2>
  <p><a href="https://www.incometax.gov.in/" rel="noopener">Income Tax Department</a>: Income-tax Act, 2025 (section 22 on interest on borrowed capital for house property) and the Finance (No. 2) Act, 2024 rates for capital gains, unchanged by Budget 2026. Checked for tax year {TAX_YEAR}; we re-check after every Union Budget. Read <a href="/methodology/">how we check our numbers</a>.</p>

  <h2>Frequently asked questions</h2>
  {faq_html(faqs)}
</div></section>
<dialog class="dlg" id="pvDlg" aria-labelledby="pvDlgH">
  <h2 id="pvDlgH">Share your result</h2>
  <p class="hint" style="margin:4px 0 14px">Made on your device. Nothing is uploaded.</p>
  <img id="pvImg" alt="Your prepay or invest result as a shareable image" width="1080" height="1350">
  <div class="dlg-opts">
    <div class="pal" role="radiogroup" aria-label="Image colour"><button type="button" role="radio" data-pal="blue" aria-checked="true"><i style="background:#1F5FE0"></i>Blue</button><button type="button" role="radio" data-pal="dark" aria-checked="false"><i style="background:#07090D;border:1px solid #2A3850"></i>Dark</button></div>
    <label class="lbl" for="pvImgTitle" style="margin:14px 0 6px">Title on the image</label>
    <div class="title-row"><input type="text" id="pvImgTitle" maxlength="70" autocomplete="off"><button type="button" class="link-btn" id="pvImgTitleReset" style="color:var(--brand)">Reset</button></div>
  </div>
  <div class="actions"><button type="button" class="btn-sm pri" id="pvImgShare">Share on WhatsApp &amp; more</button><button type="button" class="btn-sm" id="pvImgDl">Save image</button><button type="button" class="btn-sm btn-ghost" id="pvImgClose">Close</button></div>
  <p class="status" id="pvImgStatus" role="status"></p>
</dialog>
"""
    graph = [{"@type": "WebApplication", "name": "Prepay Home Loan or Invest Calculator", "url": SITE + "/prepay-vs-invest/", "applicationCategory": "FinanceApplication",
              "operatingSystem": "Any", "browserRequirements": "Requires JavaScript", "isAccessibleForFree": True, "inLanguage": "en-IN",
              "offers": {"@type": "Offer", "price": "0", "priceCurrency": "INR"}, "dateModified": VERIFIED,
              "description": "Compare prepaying your home loan with investing the extra money, after tax, under the old or new regime.", "publisher": {"@id": SITE + "/#org"}},
             faq_ld(faqs)]
    body = add_tips(body, "pv", PV_TIPS)
    return layout("/prepay-vs-invest/", "Prepay Home Loan or Invest? Calculator for India | Salarist",
                  "Should you prepay your home loan or invest the extra? Compare both after tax, old or new regime, and see your breakeven return. Free, no sign-up.",
                  body, crumbs=[("/", "Home"), ("/prepay-vs-invest/", "Prepay or Invest Calculator")], graph=graph,
                  css=("tool.css",), js=("prepay.js",), og="og-prepay-vs-invest.png", og_title="Prepay your home loan or invest the extra?")

STAMP_PORTALS = [  # official state stamps and registration portals with duty calculators
    ("Andhra Pradesh", "https://registration.ap.gov.in/"), ("Delhi", "https://revenue.delhi.gov.in/"),
    ("Karnataka", "https://kaveri.karnataka.gov.in/"), ("Maharashtra", "https://igrmaharashtra.gov.in/"),
    ("Tamil Nadu", "https://tnreginet.gov.in/"), ("Telangana", "https://registration.telangana.gov.in/"),
    ("Uttar Pradesh", "https://igrsup.gov.in/")]
STATE_OPTS = "".join(f'<option value="{u}">{n}</option>' for n, u in STAMP_PORTALS)

TOOL_CARDS = {
    "/leave-planner-2027/": ("Leave Planner 2027", "Turn your leave into the longest breaks of 2027, around official holidays."),
    "/prepay-vs-invest/": ("Prepay or Invest", "Should extra money go into your home loan or into investments? After tax."),
    "/rent-vs-buy/": ("Rent or Buy", "Owning against renting and investing the difference, after stamp duty and tax."),
    "/budget-planner/": ("Budget Planner", "See what's really left each month, with yearly costs turned into monthly set-asides."),
}
if EMI_LIVE: TOOL_CARDS["/emi-calculator/"] = ("EMI Calculator", "Your EMI, with part-payments at any time and rate changes. Save your plan and carry on later.")
if CAR_LIVE: TOOL_CARDS["/company-car-lease-vs-loan/"] = ("Car Lease vs Car Loan", "Lease a car through your company or buy it on a loan? After tax, running costs and resale.")
def related(path):
    cards = "".join(f'<a class="rel" href="{u}"><b>{n}</b><span>{d}</span></a>' for u, (n, d) in TOOL_CARDS.items() if u != path)
    return f'<section style="padding-top:0"><div class="wrap"><h2 class="list-h">More decisions you can check</h2><div class="rels">{cards}</div></div></section>'

def rentbuy_page():
    faqs = [
        ("Is it better to rent or buy a home in India?",
         "It depends mostly on three numbers: how fast home prices grow where you're buying, how long you'll stay, and the return you'd earn by investing the money you don't put into the home. In big Indian cities, a year's rent is usually a small share of the home's price, which often makes renting and investing cheaper unless prices grow fast or you stay a long time. The calculator shows the home price growth you need for buying to win."),
        ("How does the calculator compare renting and buying fairly?",
         "Both choices use the same money. At the start, the buyer pays the down payment, stamp duty, registration and other costs, and the renter invests that money instead. Every month after that, whichever choice costs less invests the difference. At the end we assume you sell the home, pay selling costs, tax and any loan left, and compare what each choice leaves you with."),
        ("What if I plan to keep the home and never sell?",
         "Choose \"I keep it\" under \"At the end of your stay\". We then count the home at its market value at that point, with no selling costs or tax, and subtract any loan still owed. Choosing \"I sell it\" shows what the home is worth to you in cash, after selling costs and tax."),
        ("How does the calculator handle an under-construction home?",
         "Choose \"Under construction\" and enter the years until possession. Until then you pay interest only on the loan (pre-EMI) and keep paying rent, which is often the biggest hidden cost. The regular EMI starts at possession. Under the old regime, interest paid before the year of possession is claimed in five equal parts from that year, within the ₹2,00,000 limit, and the limit drops to ₹30,000 if possession comes more than five years after the loan year."),
        ("Is there tax if I sell and buy another home?",
         "If you've held the home for more than 24 months and put the gain into another home in India within the time allowed, the gain is exempt under section 82 of the Income-tax Act, 2025 (section 54 of the 1961 Act), up to ₹10 crore. Tick \"I'll put the gain into another home\" to include this."),
        ("Why do I enter stamp duty and registration in rupees?",
         "Most buyers know the exact amounts from the builder's cost sheet or the state's stamp duty calculator, and the rates differ by state, city, the buyer's gender and the property's value. Entering the rupee amount avoids getting the rate wrong."),
        ("Does the old tax regime change the answer?",
         "Yes, in both directions. A buyer can deduct up to ₹2,00,000 of home loan interest a year (section 22 of the Income-tax Act, 2025) and count principal, stamp duty and registration within the ₹1,50,000 limit of section 123. A renter can claim the HRA exemption. Turn on the old regime to include both. The new regime gives neither."),
        ("How is HRA exemption calculated?",
         "It's the lowest of three amounts: the HRA you actually receive, the rent you pay minus 10% of your basic salary, and 50% of basic salary if you live in Delhi, Mumbai, Kolkata, Chennai, Bengaluru, Hyderabad, Pune or Ahmedabad (40% anywhere else). It's available only under the old regime."),
        ("How is the gain on selling a home taxed?",
         "If you've held the home for more than 24 months, the gain is long-term and taxed at 12.5% plus 4% cess, without indexation. If you sell within 24 months, the gain is added to your income and taxed at your slab rate. The cost includes the price, stamp duty, registration and other buying costs."),
    ]
    def num(k, label, unit="", mn=0, mx=0, st=1, money=True, rng=True, hint="", cls=""):
        inp = f'<input id="rb-{k}" type="text" inputmode="numeric" autocomplete="off">' if money else f'<input id="rb-{k}" type="number" inputmode="decimal" min="{mn}" max="{mx}" step="{st}">'
        return (f'<div class="fld{(" " + cls) if cls else ""}"><div class="row1"><label for="rb-{k}">{label}</label><span class="w" id="rb-{k}-w"></span></div>'
                f'<div class="numin">{"<span>₹</span>" if money else ""}{inp}{"" if money else f"<span>{unit}</span>"}</div>'
                + (f'<input type="range" id="rb-{k}-r" min="{mn}" max="{mx}" step="{st}" aria-label="{label}">' if rng else "")
                + (f'<p class="hint">{hint}</p>' if hint else "") + "</div>")
    body = f"""<section class="tool-hero"><div class="wrap">
  <p class="eyebrow">Home</p>
  <h1>Rent or buy a home: which leaves you richer?</h1>
  <p class="lead">Buying feels like building an asset, and renting feels like money gone. We put both on the same footing: same money in, month by month, with stamp duty, EMIs, upkeep, rent, tax and the sale at the end, and show which one leaves you with more.</p>
  {badges("Tax rules for tax year " + TAX_YEAR)}
</div></section>

<section style="padding-top:0"><div class="wrap lp rb">
  <div class="card lp-setup" aria-label="Your numbers">
    {num("stay", "How long you'll live there", "years", 1, 30, 1, money=False, hint="Set to 10 years to start. Change it: it's the number that matters most.", cls="key")}
    <p class="grp-h">The home</p>
    {num("price", "Home price", mn=500000, mx=50000000, st=100000)}
    <div>{num("down", "Down payment", mn=0, mx=20000000, st=50000)}<p class="hint" id="rb-loanTxt"></p></div>
    <div>{num("stamp", "Stamp duty", rng=False, hint="The exact amount in rupees, from your cost sheet or your state's stamp duty calculator.")}
      <details class="helper"><summary>Don't know the amount? Find your state's calculator</summary>
        <p class="hint" style="margin-top:6px">Stamp duty depends on your state, city, the buyer's gender and the higher of the price and the government's rate for the area, so we don't guess it. Your state's official calculator shows the exact stamp duty and registration charges.</p>
        <label class="lbl" for="rb-state" style="margin:12px 0 6px">Your state</label>
        <select id="rb-state" class="sel" data-state><option value="">Choose your state</option>{STATE_OPTS}</select>
        <p style="margin:10px 0 0"><a id="rb-stateLink" href="#" target="_blank" rel="noopener" hidden></a></p>
        <p class="hint">Not listed? Search for your state's stamps and registration department.</p>
      </details></div>
    {num("reg", "Registration charges", rng=False, hint="The exact amount in rupees.")}
    {num("other", "Other buying costs", rng=False, hint="Brokerage, legal fees, interiors, GST on an under-construction home: anything you pay that isn't the price.")}
    <div><span class="lbl" id="ucLbl">When do you get the home?</span>
      <div class="seg row" role="group" aria-labelledby="ucLbl"><button type="button" data-uc="0">Ready to move in</button><button type="button" data-uc="1">Under construction</button></div></div>
    <div class="adv" id="rb-uc-box" hidden>
      {num("possess", "Years until possession", "years", 0.5, 7, 0.5, money=False, hint="You pay interest only (pre-EMI) and keep renting until then. Builders often run late: try a year or two more.")}
    </div>
    {num("own", "Owner's costs each year", rng=False, hint="Maintenance, property tax and repairs together, from the day you move in.")}
    {num("ownUp", "Owner's costs rise", "% a year", 0, 15, 0.5, money=False)}
    {num("grow", "Home price growth", "% a year", -5, 15, 0.5, money=False)}
    <p class="grp-h">The loan</p>
    <div class="two-col">{num("rate", "Interest rate", "%", 5, 15, 0.05, money=False)}{num("tenure", "Tenure", "yrs", 1, 30, 1, money=False)}</div>
    <p class="grp-h">Renting</p>
    {num("rent", "Rent for a similar home, per month", mn=0, mx=300000, st=500)}
    {num("rentUp", "Rent increase", "% a year", 0, 15, 0.5, money=False)}
    {num("deposit", "Security deposit", rng=False, hint="Comes back in full when you move out.")}
    <label class="chk" for="rb-depUp" style="border:0;grid-template-columns:22px 1fr;margin-top:-12px"><input type="checkbox" id="rb-depUp"><span>The deposit rises with the rent each year</span></label>
    <p class="grp-h">Investing</p>
    {num("ret", "Return you expect from investing", "% a year", 3, 18, 0.5, money=False)}
    <div><span class="lbl" id="kindLbl">Where you'd invest</span>
      <div class="seg row" role="group" aria-labelledby="kindLbl"><button type="button" data-kind="equity">Equity funds</button><button type="button" data-kind="debt">Debt fund</button><button type="button" data-kind="fd">Fixed deposit</button></div></div>
    <p class="grp-h">At the end of your stay</p>
    <div><span class="lbl" id="endLbl">What happens to the home?</span>
      <div class="seg row" role="group" aria-labelledby="endLbl"><button type="button" data-end="sell">I sell it</button><button type="button" data-end="keep">I keep it</button></div>
      <p class="hint">Keep it: we count the home at its market value, with no selling costs or tax, minus any loan still owed.</p></div>
    <div id="rb-sell-box" style="display:flex;flex-direction:column;gap:18px">
      {num("sell", "Selling costs", "% of price", 0, 5, 0.25, money=False)}
      <label class="chk" for="rb-reinvest" style="border:0;grid-template-columns:22px 1fr"><input type="checkbox" id="rb-reinvest"><span>I'll put the gain into another home (no tax on up to ₹10 crore of gain under section 82, earlier section 54)</span></label>
    </div>
    <p class="grp-h">Tax</p>
    <div><span class="lbl" id="regLbl">Your tax regime</span>
      <div class="seg row" role="group" aria-labelledby="regLbl"><button type="button" data-regime="new">New regime</button><button type="button" data-regime="old">Old regime</button></div></div>
    <div class="fld"><label class="lbl" for="rb-slab" style="margin:0">Your income tax slab</label>
      <select id="rb-slab" class="sel"><option value="0">0%</option><option value="5">5%</option><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option><option value="25">25%</option><option value="30">30%</option></select></div>
    <div class="adv" id="rb-old" hidden>
      <h3>Old regime: if you buy</h3>
      <label class="chk" for="rb-claimInt" style="border:0;grid-template-columns:22px 1fr"><input type="checkbox" id="rb-claimInt"><span>Claim home loan interest (up to ₹2,00,000 a year)</span></label>
      {num("room", "Room left in your ₹1,50,000 limit", rng=False, hint="Your PF, PPF, ELSS and insurance premiums already use this limit. Enter only what's left for principal, stamp duty and registration.")}
      <h3>Old regime: if you rent</h3>
      <label class="chk" for="rb-claimHra" style="border:0;grid-template-columns:22px 1fr"><input type="checkbox" id="rb-claimHra"><span>Claim HRA exemption</span></label>
      <div id="rb-hra-box" style="display:flex;flex-direction:column;gap:18px">
        {num("basic", "Basic salary per month", rng=False)}
        {num("hra", "HRA you get per month", rng=False)}
        <div><span class="lbl" id="metroLbl">Where you live</span>
          <div class="seg row" role="group" aria-labelledby="metroLbl"><button type="button" data-metro="1">Delhi, Mumbai, Kolkata, Chennai, Bengaluru, Hyderabad, Pune or Ahmedabad</button><button type="button" data-metro="0">Anywhere else</button></div></div>
      </div>
    </div>
  </div>

  <div>
    <div class="verdict" id="rbVerdict" aria-live="polite"></div>
    <div class="actions">
      <button type="button" class="btn-sm pri" id="rbPdf">Download PDF report</button>
      <button type="button" class="btn-sm" id="rbXlsx">Download Excel</button>
      <button type="button" class="btn-sm btn-ghost" id="rbImgBtn">Share as image</button>
      <button type="button" class="btn-sm btn-ghost" id="rbShare">Copy share link</button>
    </div>
    <p class="status" id="rbStatus" role="status"></p>
    <div class="stats">
      <div class="stat"><div class="l">Buying wins if prices grow above</div><div class="n" id="rbBe">—</div><div class="h">The yearly home price growth where both choices end equal</div></div>
      <div class="stat"><div class="l">Buying pays off</div><div class="n" id="rbPay">—</div><div class="h">How long you need to stay for buying to come out ahead</div></div>
      <div class="stat"><div class="l">Cash needed to buy</div><div class="n" id="rbUp">—</div></div>
      <div class="stat"><div class="l">Your EMI</div><div class="n" id="rbEmi">—</div></div>
    </div>
    <h2 class="list-h">What if home prices grow differently?</h2>
    <div class="sens" id="rbSens"></div>
    <div class="chartbox">
      <h2 class="list-h" style="margin:0 0 4px">Net worth over time</h2>
      <p class="hint" style="margin:0 0 10px">What you'd have if you sold everything that month, after selling costs, tax and the loan.</p>
      <div id="rbChart"></div>
      <div class="legend2"><span><i style="background:var(--brand)"></i>Rent and invest</span><span><i style="background:var(--leave)"></i>Buy</span></div>
      <p class="hint" id="rbCross"></p>
    </div>
    <h2 class="list-h">Where your money went</h2>
    <div class="money" id="rbMoney"></div>
    <p class="hint" id="rbMoneyNote"></p>
    <a class="next" id="rbNext" href="/prepay-vs-invest/"><span class="k">Your next decision</span><b>Buying with a loan? See whether to prepay it or invest the extra</b><span class="h">Opens Prepay or Invest with your loan, rate and tax details filled in.</span></a>
    <h2 class="list-h">Assumptions</h2>
    <ul class="notes" id="rbNotes"></ul>
  </div>
</div></section>

<section style="padding-top:0"><div class="wrap">
  <h2>The full calculation</h2>
  <p class="lead" style="font-size:15px">Year by year for each choice, over your stay. Tap a year to see its 12 months.</p>
  <div class="modes tabs2" role="tablist" aria-label="Choose which calculation to show"><button type="button" role="tab" data-tab="buy" aria-selected="true"><b>Buy</b></button><button type="button" role="tab" data-tab="rent" aria-selected="false"><b>Rent and invest</b></button></div>
  <div class="tbl-wrap calc-wrap" id="rbTable"></div>
</div></section>
{related("/rent-vs-buy/")}
<div class="wrap aff-slot" aria-label="Sponsored"></div>

<section style="padding-top:0"><div class="wrap prose">
  <p class="g-callout"><b>New to this decision?</b> Read our guide, <a href="/guides/rent-vs-buy/">Rent or buy a home in India? How to decide</a>. It walks through every number on this page with a worked example. Also read: <a href="/guides/under-construction-vs-ready-to-move/">Under construction or ready to move?</a> and <a href="/guides/hra-vs-home-loan-tax-benefits/">HRA or home loan tax benefits?</a></p>
  <h2>How the calculator works</h2>
  <p>Both choices start with the same money and run month by month for as long as you plan to stay.</p>
  <ul><li><strong>Buy:</strong> you pay the down payment, stamp duty, registration and other costs at the start. Every month you pay the EMI and the owner's costs. At the end you sell, pay selling costs and tax on the gain, and repay any loan left.</li>
  <li><strong>Rent:</strong> you pay the security deposit at the start and invest what the buyer spent on buying. Every month you pay rent. At the end you get the deposit back and sell your investments.</li></ul>
  <p>Each month, whichever choice costs less invests the difference, so both use exactly the same money. Usually the renter invests early on, while rent is lower than the EMI. Later, as rent rises and the loan closes, the buyer may invest too.</p>

  <h2>Money isn't everything</h2>
  <div class="factors">
    <div><h3>Reasons to buy anyway</h3><ul><li>No landlord: no forced moves, no rent hikes, freedom to change the home.</li><li>Stability for children's schooling and ageing parents.</li><li>A home you own is a fallback in retirement.</li></ul></div>
    <div><h3>Reasons to keep renting</h3><ul><li>Freedom to move for a better job or a different city.</li><li>Your money stays liquid for emergencies and opportunities.</li><li>No risk from a delayed project or a slow resale market.</li></ul></div>
  </div>

  <h2>Tax rules used, tax year 2026-27</h2>
  <ul>
    <li><strong>Selling the home:</strong> held over 24 months, the gain is long-term and taxed at 12.5% plus 4% cess, without indexation. Held 24 months or less, it's taxed at your slab rate plus cess. Budget 2026 left these rates unchanged.</li>
    <li><strong>Buying another home with the gain:</strong> a long-term gain put into another home in India within the time allowed is exempt under section 82 of the Income-tax Act, 2025 (section 54 of the 1961 Act), up to ₹10 crore.</li>
    <li><strong>Home loan interest, old regime:</strong> up to ₹2,00,000 a year for a home you live in, under section 22 of the Income-tax Act, 2025 (section 24(b) of the 1961 Act). For an under-construction home, interest paid before the year of possession is claimed in five equal yearly parts from that year, within the same limit (Budget 2026 confirmed this), and the limit is ₹30,000 if possession comes more than five years after the loan year. New regime: no deduction.</li>
    <li><strong>Principal, stamp duty and registration, old regime:</strong> within the ₹1,50,000 limit of section 123 (section 80C of the 1961 Act). Stamp duty and registration count only in the year you pay them.</li>
    <li><strong>HRA exemption, old regime only:</strong> the lowest of the HRA you receive, rent minus 10% of basic, and 50% of basic in Delhi, Mumbai, Kolkata, Chennai, Bengaluru, Hyderabad, Pune and Ahmedabad (40% elsewhere), as listed in the Income-tax Rules, 2026.</li>
    <li><strong>Investments:</strong> equity fund gains taxed at 12.5% above ₹1,25,000 a year plus cess; debt fund gains and FD interest at your slab rate plus cess.</li>
  </ul>
  <p>We leave out surcharge, construction delays (add them to the years until possession), GST on an under-construction home unless you include it in other buying costs, and the cost of furnishing a rented home.</p>

  <h2 id="sources">Sources</h2>
  <p><a href="https://www.incometax.gov.in/" rel="noopener">Income Tax Department</a>: Income-tax Act, 2025 (sections 22, 82 and 123), the Income-tax Rules, 2026 (HRA), and the Finance (No. 2) Act, 2024 rates for capital gains, unchanged by Budget 2026. Checked for tax year {TAX_YEAR}; we re-check after every Union Budget. Read <a href="/methodology/">how we check our numbers</a>.</p>

  <h2>Frequently asked questions</h2>
  {faq_html(faqs)}
</div></section>
<div class="rb-bar" id="rbBar" hidden><span id="rbBarT"></span><button type="button" class="btn-sm pri" id="rbBarBtn">See the result</button></div>
<dialog class="dlg" id="rbDlg" aria-labelledby="rbDlgH">
  <h2 id="rbDlgH">Share your result</h2>
  <p class="hint" style="margin:4px 0 14px">Made on your device. Nothing is uploaded.</p>
  <img id="rbImg" alt="Your rent or buy result as a shareable image" width="1080" height="1350">
  <div class="dlg-opts">
    <div class="pal" role="radiogroup" aria-label="Image colour"><button type="button" role="radio" data-pal="blue" aria-checked="true"><i style="background:#1F5FE0"></i>Blue</button><button type="button" role="radio" data-pal="dark" aria-checked="false"><i style="background:#07090D;border:1px solid #2A3850"></i>Dark</button></div>
    <label class="lbl" for="rbImgTitle" style="margin:14px 0 6px">Title on the image</label>
    <div class="title-row"><input type="text" id="rbImgTitle" maxlength="70" autocomplete="off"><button type="button" class="link-btn" id="rbImgTitleReset" style="color:var(--brand)">Reset</button></div>
  </div>
  <div class="actions"><button type="button" class="btn-sm pri" id="rbImgShare">Share on WhatsApp &amp; more</button><button type="button" class="btn-sm" id="rbImgDl">Save image</button><button type="button" class="btn-sm btn-ghost" id="rbImgClose">Close</button></div>
  <p class="status" id="rbImgStatus" role="status"></p>
</dialog>
"""
    graph = [{"@type": "WebApplication", "name": "Rent vs Buy Calculator", "url": SITE + "/rent-vs-buy/", "applicationCategory": "FinanceApplication",
              "operatingSystem": "Any", "browserRequirements": "Requires JavaScript", "isAccessibleForFree": True, "inLanguage": "en-IN",
              "offers": {"@type": "Offer", "price": "0", "priceCurrency": "INR"}, "dateModified": VERIFIED,
              "description": "Compare renting and buying a home in India after stamp duty, EMIs, tax, HRA and the sale, and see the home price growth you need for buying to win.", "publisher": {"@id": SITE + "/#org"}},
             faq_ld(faqs)]
    body = add_tips(body, "rb", RB_TIPS)
    return layout("/rent-vs-buy/", "Rent vs Buy Calculator for India: Which Leaves You Richer? | Salarist",
                  "Should you rent or buy a home? Compare both after stamp duty, EMIs, HRA, tax and the sale, under the old or new regime. Free, private, no sign-up.",
                  body, crumbs=[("/", "Home"), ("/rent-vs-buy/", "Rent vs Buy Calculator")], graph=graph,
                  css=("tool.css",), js=("rent-buy.js",), og="og-rent-vs-buy.png", og_title="Rent or buy a home: which leaves you richer?")

# ---------------- Info tips ----------------
TIP_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.5v.01"/></svg>'
def add_tips(body, prefix, tips):
    """tips: list of (exact closing-tag anchor, label for the button, tip text). The tip is placed right after the anchor."""
    for i, (anchor, name, text) in enumerate(tips):
        assert body.count(anchor) == 1, ("tip anchor", anchor)
        tid = f"{prefix}-tip{i}"
        w = (f'<span class="tipw"><button type="button" class="tip" aria-expanded="false" aria-controls="{tid}" aria-label="What is {H.escape(name)}?">{TIP_ICON}</button>'
             f'<span class="tipb" id="{tid}" role="note" hidden>{text}</span></span>')
        if anchor.startswith('<div class="l">'):   # stat labels: inside, next to the words
            cut = anchor.rindex("</"); body = body.replace(anchor, anchor[:cut] + w + anchor[cut:])
        else:                                        # labels and headings: right after, so names and headings stay clean
            body = body.replace(anchor, anchor + w)
    return body

RB_TIPS = [
    ("""<label for="rb-stay">How long you'll live there</label>""", "how long you'll live there",
     "Buying has big one-time costs: stamp duty, registration and, later, selling costs. The longer you stay, the more years those costs are spread over, which is why this number often decides the answer."),
    ("""<label for="rb-down">Down payment</label>""", "the down payment",
     "The part of the price you pay from your savings. Banks lend only part of a home's value, so you pay the rest. The renter invests this money instead."),
    ("""<label for="rb-grow">Home price growth</label>""", "home price growth",
     "How much the home's value rises each year, on average, over your stay. Price growth in your own area over the last 10 years is a better guide than city or national averages."),
    ("""<label for="rb-rentUp">Rent increase</label>""", "rent increase",
     "How much your rent goes up each year. Check the renewal clause in your current lease for a realistic figure."),
    ("""<label for="rb-ret">Return you expect from investing</label>""", "the expected return",
     "The average yearly return on the money the renter invests, and on anything the buyer invests once the loan is paid. Returns go up and down and aren't guaranteed, so use a cautious figure."),
    ("""<label for="rb-sell">Selling costs</label>""", "selling costs",
     "Brokerage and other charges you pay when you sell, as a share of the sale price."),
    ("""<span class="lbl" id="regLbl">Your tax regime</span>""", "the tax regime",
     "New regime: lower tax rates, but no HRA exemption and no home loan deductions for a home you live in. Old regime: higher rates, but you can claim both. Pick the one you file under."),
    ("""<label for="rb-room">Room left in your ₹1,50,000 limit</label>""", "the ₹1,50,000 limit",
     "Section 123 of the Income-tax Act, 2025 (section 80C earlier) lets you deduct up to ₹1,50,000 a year in total for PF, PPF, ELSS, life insurance, home loan principal, stamp duty, registration and more. Most salaried people use much of it through PF."),
    ("""<label for="rb-possess">Years until possession</label>""", "possession",
     "Until you get the keys, you pay only interest on the loan (often called pre-EMI) and you still pay rent. The full EMI starts at possession."),
    ("""<div class="l">Cash needed to buy</div>""", "cash needed to buy",
     "Down payment plus stamp duty, registration and other buying costs, and your rent deposit if the home isn't ready yet. The renter invests this amount on day one."),
    ("""<h2 class="list-h" style="margin:0 0 4px">Net worth over time</h2>""", "net worth",
     "Everything you'd have if you cashed out that month: your investments after tax, plus the home after selling costs and tax, minus the loan still owed."),
]
PV_TIPS = [
    ("""<label for="pv-P">Loan outstanding</label>""", "the loan outstanding",
     "What you still owe on the home loan today. Your bank's latest statement or app shows it as the principal outstanding."),
    ("""<label for="pv-extra">Extra you can pay each month</label>""", "the extra amount",
     "Money you have left each month after your EMI and expenses. The calculator compares putting it into the loan against investing it."),
    ("""<label for="pv-ret">Return you expect from investing</label>""", "the expected return",
     "The average yearly return on the money you'd invest. Returns go up and down and aren't guaranteed, so use a cautious figure."),
    ("""<span class="lbl" id="kindLbl">Where you'd invest</span>""", "where you'd invest",
     "This changes the tax on your gains. Equity funds: 12.5% above ₹1,25,000 of gains, when you sell. Debt funds: your slab rate when you sell. FDs: your slab rate every year."),
    ("""<span class="lbl" id="regLbl">Your tax regime</span>""", "the tax regime",
     "Old regime only: home loan interest on a home you live in cuts your tax, up to ₹2,00,000 of interest a year. Prepaying reduces that saving. New regime: no such deduction."),
    ("""<div class="l">Interest saved by prepaying</div>""", "interest saved",
     "How much less interest you pay the bank in total if you put the extra into the loan. It's a guaranteed saving, but it's not the whole answer: the verdict also counts what investing would have earned."),
    ("""<h2 class="list-h" style="margin:0 0 4px">Net worth over time</h2>""", "net worth",
     "Your investments minus what you still owe on the loan, each month. Tax on investments is taken off at the end."),
]
LP_TIPS = [
    ("""<span class="lbl" id="weekLbl">Your weekly off</span>""", "the weekly off",
     "The days you never work. The planner counts these as free days, so a long weekend needs fewer leave days."),
    ("""<h3>Restricted holidays your employer gives</h3>""", "restricted holidays",
     "Optional holidays you pick from a list. Central government staff can take two a year; many private employers offer a similar choice. Tick the ones you'll take."),
]

def budget_page():
    faqs = [
        ("How should a salaried person in India plan a monthly budget?",
         "Start from your in-hand salary, not your CTC. List every regular cost, then the yearly ones like school fees, insurance premiums, festivals and holidays, and turn each yearly cost into a monthly amount to put aside. Decide your savings first, as SIPs or recurring deposits, and treat what's left as your spending money. The planner does all of this as you type."),
        ("What is the 50/30/20 rule?",
         "It's a simple starting split: about 50% of take-home pay for needs (housing, groceries, bills, EMIs), 30% for wants (eating out, shopping, holidays) and 20% for savings. It's a guide, not a rule. In big cities rent alone can take much of the 50%, so the planner lets you set your own target and compares your plan with it."),
        ("Why does the planner turn yearly costs into monthly amounts?",
         "Because yearly costs are what usually break a budget. A ₹1,50,000 school fee or a ₹25,000 insurance premium doesn't show up in a normal month, so it's easy to spend that money elsewhere. Putting aside one-twelfth of each yearly cost every month means the money is there when the bill arrives."),
        ("What is EMI load, and why does it matter?",
         "EMI load is the share of your in-hand salary that goes to loan EMIs: home, car, personal loans and card EMIs together. Lenders look at it before approving a new loan, and a high share leaves little room if your income drops. The planner shows it so you can see how much of your pay is already committed."),
        ("How big should my emergency fund be?",
         "A common guide is enough to cover six months of essential expenses, including EMIs. The planner compares what you've saved with your monthly needs and shows how many months it covers. Build this before investing for growth, and keep it somewhere you can reach quickly, like a savings account or a liquid fund."),
        ("Is my budget saved anywhere?",
         "No. Everything stays in your browser and is gone when you close the page. To keep your budget, choose Save budget: it downloads a CSV file to your device that opens in Excel or Google Sheets. Next month, choose Load budget and pick that file to carry on where you left off."),
        ("Can I edit the saved file in Excel or Google Sheets?",
         "Yes. Change amounts or add rows in the table, save it as CSV again, and load it back into the planner. Keep the Section, Item, Frequency and Amount columns. The two lines at the top only say where the file came from; the planner skips them."),
    ]
    body = f"""<section class="tool-hero"><div class="wrap">
  <p class="eyebrow">Monthly money</p>
  <h1>Budget planner for salaried India</h1>
  <p class="lead">Start from your in-hand salary, add what you spend, and see what's really left each month. Yearly costs like school fees, insurance and festivals become a monthly amount to put aside, so they never catch you out.</p>
  {badges(None)}
</div></section>

<section style="padding-top:0"><div class="wrap bp">
  <div>
    <div class="actions bp-file">
      <button type="button" class="btn-sm" id="bpLoadBtn">Load budget</button>
      <button type="button" class="btn-sm" id="bpSaveBtn">Save budget</button>
      <button type="button" class="btn-sm btn-ghost" id="bpClear">Clear amounts</button>
      <button type="button" class="btn-sm btn-ghost" id="bpReset">Start over</button>
      <input type="file" id="bpFile" accept=".csv,text/csv" hidden>
    </div>
    <p class="hint" style="margin:4px 0 14px">Nothing is saved on this site. <b>Save budget</b> downloads a CSV file you can open in Excel or Sheets and load here next month.</p>
    <p class="status" id="bpStatus" role="status"></p>
    <div class="bp-legend hint">Open a section to fill it in. On expenses, tap <span class="bl-t t-need">Need</span> or <span class="bl-t t-want">Want</span> to change what a line counts as.</div>
    <div id="bpEdit" class="bp-edit" aria-label="Your income and expenses"></div>
    <div class="card bp-more">
      <div class="fld"><div class="row1"><label for="bp-ef">Emergency fund saved so far</label></div><div class="numin"><span>₹</span><input id="bp-ef" type="text" inputmode="numeric" autocomplete="off" placeholder="e.g. 2,00,000"></div></div>
      <div><span class="lbl" id="tLbl">Your target split</span>
        <div class="bp-t" role="group" aria-labelledby="tLbl">
          <label>Needs<span class="numin"><input id="bp-tNeed" type="number" min="0" max="100" inputmode="numeric"><span>%</span></span></label>
          <label>Wants<span class="numin"><input id="bp-tWant" type="number" min="0" max="100" inputmode="numeric"><span>%</span></span></label>
          <label>Savings<span class="numin"><input id="bp-tSave" type="number" min="0" max="100" inputmode="numeric"><span>%</span></span></label>
        </div><p class="hint">Starts at 50/30/20. Change it to suit your city and family.</p></div>
    </div>
  </div>

  <div class="bp-res">
    <div class="verdict" id="bpVerdict" aria-live="polite"></div>
    <div class="actions">
      <button type="button" class="btn-sm pri" id="bpPdf">Download PDF report</button>
      <button type="button" class="btn-sm" id="bpXlsx">Download Excel</button>
    </div>
    <div class="stats">
      <div class="stat"><div class="l">Income a month</div><div class="n" id="bpInc">—</div><div class="h">Yearly extras like bonus spread over 12 months</div></div>
      <div class="stat"><div class="l">Savings rate</div><div class="n" id="bpSave">—</div><div class="h">Planned savings plus what's left, as a share of income</div></div>
      <div class="stat"><div class="l">EMI load</div><div class="n" id="bpEmi">—</div><div class="h">Share of your in-hand salary going to EMIs</div></div>
      <div class="stat"><div class="l">Emergency fund covers</div><div class="n" id="bpEf">—</div><div class="h">Months of needs, including EMIs. Aim for 6.</div></div>
    </div>
    <h2 class="list-h">Needs, wants and savings</h2>
    <div class="card bp-split" id="bpSplit"></div>
    <ul class="notes bp-tips" id="bpTips" hidden></ul>
    <h2 class="list-h">Yearly costs to plan for</h2>
    <div class="card bp-yearly" id="bpYearly"></div>
    <h2 class="list-h">Where your money goes each month</h2>
    <ul class="card bp-cats" id="bpCats"></ul>
    <div id="bpNext"></div>
  </div>
</div></section>
{related("/budget-planner/")}
<div class="wrap aff-slot" aria-label="Sponsored"></div>

<section style="padding-top:0"><div class="wrap prose">
  <p class="g-callout"><b>New to budgeting?</b> Read our guide, <a href="/guides/monthly-budget/">How to make a monthly budget on a salary in India</a>, worked through one family's numbers. Also read: <a href="/guides/budget-on-50000-1-lakh-2-lakh-salary/">Budgeting on ₹50,000, ₹1 lakh or ₹2 lakh a month</a>.</p>
  <h2>How the planner works</h2>
  <ul>
    <li><strong>Everything becomes monthly.</strong> Monthly amounts stay as they are, yearly amounts are divided by 12, and daily amounts are multiplied by 365 and divided by 12.</li>
    <li><strong>Income, expenses and savings are kept apart.</strong> Each expense is a need (what you must pay, including EMIs and insurance) or a want (what you choose); tap the label to change it. Savings are SIPs, deposits, PPF and other money you put away on purpose.</li>
    <li><strong>What's left</strong> is your income minus needs, wants and planned savings. Your savings rate counts planned savings plus anything left over.</li>
    <li><strong>Yearly costs</strong> are listed with the monthly amount to put aside for each, so the money is ready when the bill comes.</li>
  </ul>
  <h2>Make the budget work for you</h2>
  <ul>
    <li><strong>Pay yourself first.</strong> Set SIPs to go out the day after salary day, then spend what's left.</li>
    <li><strong>Give yearly costs their own account.</strong> Move the set-aside amount to a separate savings account or recurring deposit every month.</li>
    <li><strong>Build the emergency fund before investing for growth.</strong> Six months of needs is a common target.</li>
    <li><strong>Check it once a month.</strong> Save your budget, load it next month and update the amounts that changed.</li>
  </ul>
  <h2>Frequently asked questions</h2>
  {faq_html(faqs)}
</div></section>
<div class="rb-bar" id="bpBar" hidden><span id="bpBarT"></span><button type="button" class="btn-sm pri" id="bpBarBtn">See the result</button></div>
"""
    body = add_tips(body, "bp", BP_TIPS)
    graph = [{"@type": "WebApplication", "name": "Budget Planner", "url": SITE + "/budget-planner/", "applicationCategory": "FinanceApplication",
              "operatingSystem": "Any", "browserRequirements": "Requires JavaScript", "isAccessibleForFree": True, "inLanguage": "en-IN",
              "offers": {"@type": "Offer", "price": "0", "priceCurrency": "INR"}, "dateModified": VERIFIED,
              "description": "Plan a monthly budget from your in-hand salary, with yearly costs turned into monthly set-asides, a needs-wants-savings split, EMI load and emergency fund check.",
              "publisher": {"@id": SITE + "/#org"}},
             faq_ld(faqs)]
    return layout("/budget-planner/", "Budget Planner for Salaried Indians: Monthly Budget Calculator | Salarist",
                  "Plan your monthly budget from your in-hand salary. Yearly costs become monthly set-asides, with 50/30/20 split, EMI load and emergency fund check. Free, private.",
                  body, crumbs=[("/", "Home"), ("/budget-planner/", "Budget Planner")], graph=graph,
                  css=("tool.css",), js=("budget.js",), og="og-budget-planner.png", og_title="Budget planner for salaried India")

BP_TIPS = [
    ("""<span class="lbl" id="tLbl">Your target split</span>""", "the target split",
     "How you'd like your income divided between needs, wants and savings. 50/30/20 is a common starting point; in big cities, needs often take more because of rent."),
    ("""<div class="l">Savings rate</div>""", "the savings rate",
     "Planned savings (SIPs, RDs, PPF) plus anything left over at the end of the month, as a share of your total income. The higher it is, the faster you build wealth."),
    ("""<div class="l">EMI load</div>""", "EMI load",
     "All your EMIs together as a share of your in-hand salary. Lenders check this before giving you a new loan, and a high share leaves little room if your income drops."),
    ("""<label for="bp-ef">Emergency fund saved so far</label>""", "the emergency fund",
     "Money kept aside only for emergencies like a job loss or medical bill, in a savings account or liquid fund you can reach quickly. Don't count long-term investments."),
]

# ---------------- Guides ----------------

def emi_page():
    faqs = [
        ("How is EMI calculated?",
         "EMI = P × r × (1 + r)^n ÷ ((1 + r)^n − 1), where P is the loan amount, r is the yearly interest rate divided by 12 (as a decimal) and n is the number of months. Each month, interest is charged on the loan still left, and the rest of the EMI repays the loan. That's why early EMIs are mostly interest and later ones mostly principal."),
        ("Is it better to cut the tenure or the EMI after a part-payment?",
         "Cutting the tenure saves more interest, because your EMI stays the same and more of it goes to the principal each month. Cutting the EMI lowers your monthly outgo and keeps the same end date. Choose tenure if you can afford the EMI, and EMI if you want breathing room. You can set it for each part-payment."),
        ("Can I add part-payments at different times and amounts?",
         "Yes. Add as many part-payments as you like, each with its own month and amount, such as ₹1 lakh now and ₹2 lakh from your bonus in April. Tick \"Repeat every year\" for one you plan to make every year. You can also add a fixed extra amount every month."),
        ("What happens when my floating interest rate changes?",
         "Add a rate change with the month it applies from. Banks usually keep your EMI the same and change the tenure when a floating rate moves; you can choose to keep the end date and change the EMI instead. If a higher rate means the EMI no longer covers the interest, the tool raises the EMI so the loan still gets repaid."),
        ("Why save and load a loan plan?",
         "So you can come back later and carry on. The file has your loan details, part-payments and rate changes. Next time, load it, update what you owe from your latest loan statement, and see what your next part-payment would do. It's saved only on your device; we don't store anything."),
        ("Is there a charge for prepaying a loan?",
         "RBI rules don't allow banks to charge a prepayment penalty on floating-rate loans taken by individuals for non-business purposes. Fixed-rate loans and some other loans may have a charge, so check your loan terms. The tool doesn't include prepayment charges."),
        ("Does the EMI depend on my tax regime?",
         "No. Under the old regime, you can deduct home loan interest up to ₹2,00,000 a year for a home you live in and count principal within the ₹1,50,000 limit, which lowers your tax but not your EMI. The new regime allows neither. Car and personal loans for personal use get no deduction."),
    ]
    def num(k, label, unit="", mn=0, mx=0, st=1, money=True, rng=True, hint="", cls=""):
        inp = f'<input id="em-{k}" type="text" inputmode="numeric" autocomplete="off">' if money else f'<input id="em-{k}" type="number" inputmode="decimal" min="{mn}" max="{mx}" step="{st}">'
        return (f'<div class="fld{(" " + cls) if cls else ""}"><div class="row1"><label for="em-{k}">{label}</label><span class="w" id="em-{k}-w"></span></div>'
                f'<div class="numin">{"<span>₹</span>" if money else ""}{inp}{"" if money else f"<span>{unit}</span>"}</div>'
                + (f'<input type="range" id="em-{k}-r" min="{mn}" max="{mx}" step="{st}" aria-label="{label}">' if rng else "")
                + (f'<p class="hint">{hint}</p>' if hint else "") + "</div>")
    body = f"""<section class="tool-hero"><div class="wrap">
  <p class="eyebrow">Your loans</p>
  <h1>EMI calculator, with part-payments and rate changes</h1>
  <p class="lead">Work out the EMI on a home, car or personal loan. Then plan part-payments of any amount, whenever you expect the money, add interest rate changes, and see the interest you save and when the loan closes. Save your plan and pick it up later.</p>
  {badges("Reducing-balance method, as banks use")}
</div></section>

<section style="padding-top:0"><div class="wrap lp rb em">
  <div class="card lp-setup" aria-label="Your loan">
    <div><span class="lbl" id="typeLbl">Loan type</span>
      <div class="seg row" role="group" aria-labelledby="typeLbl"><button type="button" data-type="home">Home</button><button type="button" data-type="car">Car</button><button type="button" data-type="personal">Personal</button></div>
      <p class="hint">Fills in typical starting values. Use the figures from your lender's offer or loan statement.</p></div>
    <div><span class="lbl" id="modeLbl">Which loan?</span>
      <div class="seg row" role="group" aria-labelledby="modeLbl"><button type="button" data-mode="new">A new loan</button><button type="button" data-mode="existing">A loan I already have</button></div></div>
    <div id="em-new-box" style="display:flex;flex-direction:column;gap:18px">
      {num("amount", "Loan amount", mn=50000, mx=20000000, st=50000)}
      {num("years", "Tenure", "years", 1, 30, 1, money=False)}
    </div>
    <div class="adv" id="em-old-box" hidden>
      {num("owe", "Amount you owe today", rng=False, hint="The principal outstanding on your latest loan statement or bank app.")}
      <div><span class="lbl" id="knowLbl">You know</span>
        <div class="seg row" role="group" aria-labelledby="knowLbl"><button type="button" data-know="emi">My EMI</button><button type="button" data-know="left">The months left</button></div></div>
      <div id="em-curEmi-box">{num("curEmi", "Your current EMI", rng=False)}</div>
      <div id="em-left-box" hidden>{num("left", "Months left", "months", 1, 480, 1, money=False, rng=False)}</div>
    </div>
    {num("rate", "Interest rate", "% a year", 5, 20, 0.05, money=False)}
    <div class="fld"><label class="lbl" for="em-start" id="em-startLbl" style="margin:0">Month of your first EMI</label><input class="sel" type="month" id="em-start"></div>
    <p class="grp-h">Part-payments and rate changes</p>
    <div><span class="lbl" id="effLbl">Part-payments cut</span>
      <div class="seg row" role="group" aria-labelledby="effLbl"><button type="button" data-effect="tenure">The tenure (EMI stays)</button><button type="button" data-effect="emi">The EMI (end date stays)</button></div>
      <p class="hint">Cutting the tenure saves more interest. You can change this for any single part-payment below.</p></div>
    {num("extra", "Extra every month", mn=0, mx=100000, st=500, hint="Optional. A fixed amount on top of the EMI, every month.")}
    <div id="emEvents" class="em-evs"></div>
    <div class="actions" style="margin:0"><button type="button" class="btn-sm" id="emAddPay">Add a part-payment</button><button type="button" class="btn-sm btn-ghost" id="emAddRate">Add a rate change</button></div>
    <p class="hint" style="margin-top:-8px">Add each part-payment you expect, with its month: a bonus, a maturity, a gift. Tick "Repeat every year" for one you'll make every year. Add a rate change if your floating rate moves.</p>
    <p class="grp-h">Your loan plan</p>
    <div class="actions" style="margin:0"><button type="button" class="btn-sm" id="emSaveBtn">Save my loan plan</button><button type="button" class="btn-sm" id="emLoadBtn">Load my loan plan</button><input type="file" id="emFile" accept=".csv,text/csv" hidden></div>
    <p class="hint" style="margin-top:-8px" id="emSaveHint">Saves your loan, part-payments and rate changes as a small file on your device. Load it here next time, update what you owe from your latest statement, and carry on planning. Nothing is stored on our side.</p>
  </div>

  <div>
    <div class="verdict" id="emVerdict" aria-live="polite"></div>
    <div class="actions">
      <button type="button" class="btn-sm pri" id="emPdf">Download PDF report</button>
      <button type="button" class="btn-sm" id="emXlsx">Download Excel</button>
      <button type="button" class="btn-sm btn-ghost" id="emShare">Copy share link</button>
    </div>
    <p class="status" id="emStatus" role="status"></p>
    <div class="stats">
      <div class="stat"><div class="l">Your EMI</div><div class="n" id="emEmi">—</div><div class="h">A month, to start with</div></div>
      <div class="stat"><div class="l">Total interest</div><div class="n" id="emInt">—</div><div class="h">Over the whole loan</div></div>
      <div class="stat"><div class="l">Interest saved</div><div class="n" id="emSaved">—</div><div class="h">By your part-payments</div></div>
      <div class="stat"><div class="l">Loan closes</div><div class="n" id="emEnd">—</div><div class="h">Month of the last EMI</div></div>
    </div>
    <h2 class="list-h">Principal and interest</h2>
    <div id="emSplit"></div>
    <div class="chartbox">
      <h2 class="list-h" style="margin:0 0 4px">Loan left over time</h2>
      <p class="hint" style="margin:0 0 10px">Dots mark your part-payments.</p>
      <div id="emChart"></div>
      <div class="legend2"><span><i style="background:var(--brand)"></i>With your part-payments</span><span id="emLegendNo"><i style="background:var(--leave)"></i>Without part-payments</span></div>
    </div>
    <div id="emEachBox" hidden><h2 class="list-h">What each part-payment does</h2><ul class="notes" id="emEach"></ul><p class="hint">Compared with your plan without that part-payment. Earlier part-payments save more, because they cut interest for longer.</p></div>
    <h2 class="list-h">What if the rate is different?</h2>
    <div class="sens" id="emSens"></div>
    <p class="hint">EMI · total interest, with your part-payments.</p>
    <div class="card" style="padding:16px 18px;margin:18px 0"><h2 class="list-h" style="margin:0 0 8px">How much loan can an EMI buy?</h2>
      {num("afford", "An EMI you can manage", rng=False)}<p style="margin:10px 0 0;font-weight:700" id="emAffRes"></p></div>
    <a class="next" id="emNext" href="/prepay-vs-invest/"><span class="k">Your next decision</span><b></b><span class="h"></span></a>
    <h2 class="list-h">Assumptions</h2>
    <ul class="notes" id="emNotes"></ul>
  </div>
</div></section>

<section style="padding-top:0"><div class="wrap">
  <h2>Repayment schedule</h2>
  <p class="lead" style="font-size:15px">Year by year. Tap a year to see each month.</p>
  <div class="tbl-wrap calc-wrap" id="emTable"></div>
</div></section>
{related("/emi-calculator/")}
<div class="wrap aff-slot" aria-label="Sponsored"></div>

<section style="padding-top:0"><div class="wrap prose">
  <h2>How the calculator works</h2>
  <p>Each month, interest is charged on the loan still left, at the rate for that month. Your EMI pays that interest first, and the rest reduces the loan. This is the reducing-balance method banks use for home, car and personal loans.</p>
  <ul>
    <li><strong>Part-payments</strong> are made right after that month's EMI and reduce the loan straight away. Cutting the tenure keeps your EMI; cutting the EMI keeps the end date.</li>
    <li><strong>Rate changes</strong> apply from the month you enter. By default your EMI stays the same and the tenure changes, as most banks do.</li>
    <li><strong>"What each part-payment does"</strong> compares your plan with and without that one part-payment.</li>
  </ul>
  <h2>Saving and loading your plan</h2>
  <p>A loan runs for years, and plans change. Save your plan to keep a copy of everything you entered. Next time, load it, update the amount you owe from your latest statement, and see what your next part-payment would do. The file is a CSV that opens in Excel too. It stays on your device.</p>
  <h2>Tax</h2>
  <p>Your EMI is the same under both tax regimes. Under the old regime, home loan interest for a home you live in can be deducted up to ₹2,00,000 a year (section 22 of the Income-tax Act, 2025) and principal within the ₹1,50,000 limit of section 123. To see how that changes renting against buying, use <a href="/rent-vs-buy/">Rent or Buy</a>; to weigh a part-payment against investing, use <a href="/prepay-vs-invest/">Prepay or Invest</a>.</p>
  <h2 id="sources">Sources</h2>
  <p>The standard reducing-balance EMI formula. Prepayment charges: Reserve Bank of India rules on floating-rate loans to individuals. Tax: <a href="https://www.incometax.gov.in/" rel="noopener">Income Tax Department</a>, Income-tax Act, 2025 (sections 22 and 123), tax year {TAX_YEAR}. Read <a href="/methodology/">how we check our numbers</a>.</p>
  <h2>Frequently asked questions</h2>
  {faq_html(faqs)}
</div></section>
<div class="rb-bar" id="emBar" hidden><span id="emBarT"></span><button type="button" class="btn-sm pri" id="emBarBtn">See the result</button></div>
"""
    graph = [{"@type": "WebApplication", "name": "EMI Calculator", "url": SITE + "/emi-calculator/", "applicationCategory": "FinanceApplication",
              "operatingSystem": "Any", "browserRequirements": "Requires JavaScript", "isAccessibleForFree": True, "inLanguage": "en-IN",
              "offers": {"@type": "Offer", "price": "0", "priceCurrency": "INR"}, "dateModified": VERIFIED,
              "description": "EMI calculator for home, car and personal loans, with part-payments at any time, rate changes, a full schedule, and a loan plan you can save and load.", "publisher": {"@id": SITE + "/#org"}},
             faq_ld(faqs)]
    body = add_tips(body, "em", EM_TIPS)
    return layout("/emi-calculator/", "EMI Calculator with Part-Payments and Rate Changes (Home, Car, Personal) | Salarist",
                  "Calculate your loan EMI, then plan part-payments of any amount at any time and rate changes. See interest saved, when the loan closes, and save your plan. Free, private.",
                  body, crumbs=[("/", "Home"), ("/emi-calculator/", "EMI Calculator")], graph=graph,
                  css=("tool.css",), js=("emi.js",), og="og-emi-calculator.png", og_title="EMI calculator with part-payments and rate changes")

EM_TIPS = [
    ("""<span class="lbl" id="modeLbl">Which loan?</span>""", "which loan",
     "A new loan starts from the full amount. For a loan you already have, enter what you owe today and your current EMI or months left, so the plan starts from where your loan really is."),
    ("""<label for="em-rate">Interest rate</label>""", "the interest rate",
     "The yearly rate on your loan. For a floating-rate loan, use today's rate and add rate changes below if you want to see what a move would do."),
    ("""<span class="lbl" id="effLbl">Part-payments cut</span>""", "tenure or EMI",
     "After a part-payment, your bank either keeps your EMI and shortens the loan (tenure), or keeps the end date and lowers your EMI. Shortening the loan saves more interest."),
    ("""<button type="button" class="btn-sm" id="emSaveBtn">Save my loan plan</button>""", "saving your plan",
     "Downloads a small CSV file with everything you entered. Use Load my loan plan to bring it back later and update it. The PDF and Excel reports are for reading; the plan file is for loading back here."),
    ("""<div class="l">Interest saved</div>""", "interest saved",
     "Total interest without your part-payments, minus total interest with them. Rate changes you add count in both."),
]

def car_page():
    faqs = [
        ("How does a company car lease save tax?",
         "Your company leases the car and pays the rental, and usually fuel, servicing and a driver, out of your CTC. That part of your pay is no longer salary in your hand, so you don't pay income tax on it. Instead, you're taxed on a fixed value for the use of the car, set by Rule 15 of the Income-tax Rules, 2026: ₹5,000 a month for an engine up to 1.6 litres or an electric car, or ₹7,000 a month above 1.6 litres. If the lease costs much more than that, the difference escapes tax."),
        ("What is the taxable value of a company car from April 2026?",
         "For a car owned or hired by the employer and used for both official and personal purposes: ₹5,000 a month (up to 1.6 litres, or electric) or ₹7,000 a month (above 1.6 litres) if the employer meets the running costs; ₹2,000 or ₹3,000 a month if you meet the running costs for personal use yourself; plus ₹3,000 a month if the employer provides a driver. These values apply from 1 April 2026 under the Income-tax Rules, 2026, and replace the older ₹1,800 and ₹2,400."),
        ("Does a car lease work under the new tax regime?",
         "Yes. The car's value is worked out the same way under both regimes, and the lease rental paid by the company was never part of your taxable salary. That's why a car lease is one of the few ways to cut tax under the new regime."),
        ("Do I still pay for insurance and servicing if I lease?",
         "Yes, the car needs them either way. With a lease they're usually built into the rental, or paid by the company from your CTC, so they come out of pre-tax pay. With a loan you pay them yourself from take-home pay. Tick the boxes if your lease quote already includes them, so they aren't counted twice."),
        ("What happens if I leave my job before the lease ends?",
         "Most schemes ask you to close the lease early, buy the car or pay early termination charges, and the terms vary a lot. Read your company's car policy before you sign. A loan has no such link to your job. Tick \"Show what happens if I leave my job before the lease ends\" to compare both options at that date, with your closure charge."),
        ("Is an electric car treated differently?",
         "An electric car is valued like a car with an engine up to 1.6 litres: ₹5,000 a month if the company meets the running costs, or ₹2,000 if you do."),
        ("Can I claim a tax deduction on a car loan?",
         "Not as a salaried employee buying a car for personal use. The EMI, insurance, fuel and servicing all come out of your take-home pay."),
    ]
    def num(k, label, unit="", mn=0, mx=0, st=1, money=True, rng=True, hint="", cls=""):
        inp = f'<input id="cl-{k}" type="text" inputmode="numeric" autocomplete="off">' if money else f'<input id="cl-{k}" type="number" inputmode="decimal" min="{mn}" max="{mx}" step="{st}">'
        return (f'<div class="fld{(" " + cls) if cls else ""}"><div class="row1"><label for="cl-{k}">{label}</label><span class="w" id="cl-{k}-w"></span></div>'
                f'<div class="numin">{"<span>₹</span>" if money else ""}{inp}{"" if money else f"<span>{unit}</span>"}</div>'
                + (f'<input type="range" id="cl-{k}-r" min="{mn}" max="{mx}" step="{st}" aria-label="{label}">' if rng else "")
                + (f'<p class="hint">{hint}</p>' if hint else "") + "</div>")
    def chk(k, text): return f'<label class="chk" for="cl-{k}" style="border:0;grid-template-columns:22px 1fr"><input type="checkbox" id="cl-{k}"><span>{text}</span></label>'
    body = f"""<section class="tool-hero"><div class="wrap">
  <p class="eyebrow">Your car</p>
  <h1>Company car lease or car loan: which costs you less?</h1>
  <p class="lead">A car leased through your company is paid from pre-tax salary, and you're taxed only on a fixed value for using it. A loan is paid from take-home pay. We put both side by side, with insurance, fuel, upkeep and the car's value at the end, and show which leaves you better off.</p>
  {badges("Tax rules for tax year " + TAX_YEAR)}
</div></section>

<section style="padding-top:0"><div class="wrap lp rb cl">
  <div class="card lp-setup" aria-label="Your numbers">
    <p class="grp-h">The car</p>
    {num("price", "Car price on the road, without insurance", mn=300000, mx=5000000, st=10000, hint="Ex-showroom price plus registration and road tax. Insurance is entered below.")}
    <div><span class="lbl" id="engLbl">Engine</span>
      <div class="seg row" role="group" aria-labelledby="engLbl"><button type="button" data-engine="small">Up to 1.6 litres, or electric</button><button type="button" data-engine="big">Above 1.6 litres</button></div></div>
    {num("years", "Lease period", "years", 1, 7, 1, money=False, hint="We compare both options over this period, usually 3 to 5 years.", cls="key")}
    <p class="grp-h">Running costs, the same car either way</p>
    {num("ins", "Insurance, per year", rng=False)}
    {num("maint", "Servicing and repairs, per year", rng=False)}
    {num("fuel", "Fuel or charging, per month", mn=0, mx=30000, st=500)}
    {chk("driver", "I'll have a driver")}
    <div class="adv" id="cl-driver-box" hidden>{num("driverCost", "Driver's salary, per month", rng=False)}</div>
    {num("dep", "Car loses value", "% a year", 5, 30, 1, money=False, hint="Cars often lose 10% to 20% of their value a year. We use this for what the car is worth at the end.")}
    <p class="grp-h">Company lease</p>
    {num("rental", "Lease rental, per month", mn=5000, mx=150000, st=500, hint="From your company's quote, including GST.")}
    {chk("insInc", "Insurance is included in the rental")}
    {chk("maintInc", "Servicing and repairs are included in the rental")}
    <div><span class="lbl" id="runLbl">Fuel and other running costs</span>
      <div class="seg row" role="group" aria-labelledby="runLbl"><button type="button" data-runco="1">Paid through the company</button><button type="button" data-runco="0">I pay them myself</button></div>
      <p class="hint" id="clPerk"></p></div>
    <div><span class="lbl" id="endLbl">At the end of the lease</span>
      <div class="seg row" role="group" aria-labelledby="endLbl"><button type="button" data-end="buy">I buy the car</button><button type="button" data-end="return">I return it</button></div></div>
    <div class="adv" id="cl-buy-box">{num("buyback", "Price to buy it at the end", rng=False, hint="The buy-back or residual price in your lease terms.")}</div>
    {chk("early", "Show what happens if I leave my job before the lease ends")}
    <div class="adv" id="cl-early-box" hidden>
      {num("exitYrs", "I leave after", "years", 0.5, 6.5, 0.5, money=False)}
      {num("exitCharge", "Early closure charge", rng=False, hint="What your lease terms charge to close the lease early. Ask HR or the leasing company.")}
      <div><span class="lbl" id="exitLbl">When I leave</span>
        <div class="seg row" role="group" aria-labelledby="exitLbl"><button type="button" data-exitend="buy">I buy the car</button><button type="button" data-exitend="return">I hand it back</button></div></div>
      <div id="cl-exitPrice-box">{num("exitPrice", "Price to buy the car then", rng=False, hint="The early buy-out price in your lease terms for that date.")}</div>
    </div>
    <p class="grp-h">Car loan</p>
    <div>{num("down", "Down payment", mn=0, mx=2000000, st=10000)}<p class="hint" id="cl-loanTxt"></p></div>
    <div class="two-col">{num("rate", "Interest rate", "%", 6, 15, 0.05, money=False)}{num("loanYrs", "Tenure", "yrs", 1, 8, 1, money=False)}</div>
    <p class="grp-h">You</p>
    <div class="fld"><label class="lbl" for="cl-slab" style="margin:0">Your income tax slab</label>
      <select id="cl-slab" class="sel"><option value="0">0%</option><option value="5">5%</option><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option><option value="25">25%</option><option value="30">30%</option></select>
      <p class="hint">The rate on your top rupee of salary, under the regime you file in. The lease works under both.</p></div>
    {num("ret", "What your savings earn", "% a year", 0, 12, 0.5, money=False, hint="After tax. Money one option saves you each month is counted as earning this.")}
  </div>

  <div>
    <div class="verdict" id="clVerdict" aria-live="polite"></div>
    <div class="actions">
      <button type="button" class="btn-sm pri" id="clPdf">Download PDF report</button>
      <button type="button" class="btn-sm" id="clXlsx">Download Excel</button>
      <button type="button" class="btn-sm btn-ghost" id="clShare">Copy share link</button>
    </div>
    <p class="status" id="clStatus" role="status"></p>
    <div class="stats">
      <div class="stat"><div class="l">Lease: out of take-home</div><div class="n" id="clOutL">—</div><div class="h">A month, after the tax saved</div></div>
      <div class="stat"><div class="l">Loan: out of take-home</div><div class="n" id="clOutB">—</div><div class="h">A month: EMI and running costs</div></div>
      <div class="stat"><div class="l">Tax saved with the lease</div><div class="n" id="clTax">—</div><div class="h">Over the lease, after tax on the car's value</div></div>
      <div class="stat"><div class="l">Both equal at a rental of</div><div class="n" id="clBe">—</div><div class="h">A lower rental favours the lease</div></div>
    </div>
    <div class="card" id="clExit" style="padding:18px 20px;margin:0 0 22px" hidden><h2 class="list-h" style="margin:0 0 6px" id="clExitH"></h2><p style="margin:0 0 6px;font-size:18px" id="clExitV"></p><p class="hint" style="margin:0" id="clExitT"></p></div>
    <h2 class="list-h">What if your tax slab is different?</h2>
    <div class="sens" id="clSens"></div>
    <div class="chartbox">
      <h2 class="list-h" style="margin:0 0 4px">Money paid out of take-home pay</h2>
      <p class="hint" style="margin:0 0 10px">Running total for each option, including the down payment and the buy-back price.</p>
      <div id="clChart"></div>
      <div class="legend2"><span><i style="background:var(--brand)"></i>Company lease</span><span><i style="background:var(--leave)"></i>Car loan</span></div>
    </div>
    <h2 class="list-h">Where your money went</h2>
    <div class="money" id="clMoney"></div>
    <p class="hint" id="clMoneyNote"></p>
    <a class="next" href="/budget-planner/"><span class="k">Your next decision</span><b>Fit the car into your monthly budget</b><span class="h">Add the EMI or lease and running costs to see what's left each month.</span></a>
    <h2 class="list-h">Assumptions</h2>
    <ul class="notes" id="clNotes"></ul>
  </div>
</div></section>

<section style="padding-top:0"><div class="wrap">
  <h2>The full calculation</h2>
  <p class="lead" style="font-size:15px">Year by year for each option. Tap a year to see its 12 months.</p>
  <div class="modes tabs2" role="tablist" aria-label="Choose which calculation to show"><button type="button" role="tab" data-tab="lease" aria-selected="true"><b>Company lease</b></button><button type="button" role="tab" data-tab="loan" aria-selected="false"><b>Car loan</b></button></div>
  <div class="tbl-wrap calc-wrap" id="clTable"></div>
</div></section>
{related("/company-car-lease-vs-loan/")}
<div class="wrap aff-slot" aria-label="Sponsored"></div>

<section style="padding-top:0"><div class="wrap prose">
  <p class="g-callout"><b>New to this decision?</b> Read our guide, <a href="/guides/company-car-lease-vs-car-loan/">Company car lease or car loan? How to decide</a>, worked through one employee's numbers. Also read: <a href="/guides/company-car-perquisite-value-2026/">Company car perquisite value from April 2026</a>.</p>
  <h2>How the calculator works</h2>
  <ul><li><strong>Company lease:</strong> the rental, and the running costs that go through the company, come out of your salary before tax. You pay tax only on the car's fixed value under Rule 15. At the end you buy the car at the agreed price or hand it back.</li>
  <li><strong>Car loan:</strong> you pay the down payment, then the EMI, insurance, servicing, fuel and any driver from take-home pay. At the end you own the car, minus any loan still owed.</li></ul>
  <p>Both options count the car's value at the end if you own it. Whichever option costs less each month is assumed to keep the difference as savings, earning the return you choose, so the comparison is fair.</p>

  <h2>Money isn't everything</h2>
  <div class="factors">
    <div><h3>Reasons to lease anyway</h3><ul><li>No down payment, and servicing and insurance handled for you.</li><li>A new car every few years, if you return it.</li><li>One fixed monthly amount.</li></ul></div>
    <div><h3>Reasons to take a loan</h3><ul><li>The car is yours from day one and isn't tied to your job.</li><li>No early termination charges if you change jobs.</li><li>Freedom to sell, modify or drive it as much as you like.</li></ul></div>
  </div>

  <h2>Tax rules used, tax year {TAX_YEAR}</h2>
  <ul>
    <li><strong>Car owned or hired by your employer, used partly for personal purposes:</strong> taxed at ₹5,000 a month for an engine up to 1.6 litres or an electric car, and ₹7,000 a month above 1.6 litres, if the employer meets the running costs. If you meet the running costs for personal use, ₹2,000 or ₹3,000 a month. If the employer provides a driver, ₹3,000 a month more. From Rule 15 of the Income-tax Rules, 2026, in force from 1 April 2026.</li>
    <li><strong>Lease rental and running costs paid by the company</strong> come out of your CTC before tax, under both regimes.</li>
    <li><strong>Car loan:</strong> no deduction for a salaried employee's personal car.</li>
  </ul>
  <p>We leave out surcharge, early termination charges, and any tax on the transfer of the car at the end, which depends on how your company's scheme is set up.</p>

  <h2 id="sources">Sources</h2>
  <p><a href="https://www.incometax.gov.in/" rel="noopener">Income Tax Department</a>: Income-tax Rules, 2026 (Rule 15, valuation of perquisites), notified on 20 March 2026 under the Income-tax Act, 2025. Checked for tax year {TAX_YEAR}; we re-check after every Union Budget. Read <a href="/methodology/">how we check our numbers</a>.</p>

  <h2>Frequently asked questions</h2>
  {faq_html(faqs)}
</div></section>
<div class="rb-bar" id="clBar" hidden><span id="clBarT"></span><button type="button" class="btn-sm pri" id="clBarBtn">See the result</button></div>
"""
    graph = [{"@type": "WebApplication", "name": "Car Lease vs Car Loan Calculator", "url": SITE + "/company-car-lease-vs-loan/", "applicationCategory": "FinanceApplication",
              "operatingSystem": "Any", "browserRequirements": "Requires JavaScript", "isAccessibleForFree": True, "inLanguage": "en-IN",
              "offers": {"@type": "Offer", "price": "0", "priceCurrency": "INR"}, "dateModified": VERIFIED,
              "description": "Compare leasing a car through your company with buying it on a loan, after tax on the car's perquisite value, insurance, fuel, upkeep and resale.", "publisher": {"@id": SITE + "/#org"}},
             faq_ld(faqs)]
    body = add_tips(body, "cl", CL_TIPS)
    return layout("/company-car-lease-vs-loan/", "Car Lease vs Car Loan Calculator for India (2026-27) | Salarist",
                  "Lease a car through your company or buy it on a loan? Compare both after tax, insurance, fuel and resale, with the new ₹5,000/₹7,000 perquisite values. Free, private.",
                  body, crumbs=[("/", "Home"), ("/company-car-lease-vs-loan/", "Car Lease vs Car Loan Calculator")], graph=graph,
                  css=("tool.css",), js=("car-lease.js",), og="og-car-lease-vs-loan.png", og_title="Company car lease or car loan: which costs you less?")

CL_TIPS = [
    ("""<label for="cl-price">Car price on the road, without insurance</label>""", "the on-road price",
     "What you'd pay to drive the car away, apart from insurance: the ex-showroom price, registration and road tax. A loan is taken on this amount, less your down payment."),
    ("""<label for="cl-rental">Lease rental, per month</label>""", "the lease rental",
     "The monthly amount the leasing company charges, usually including GST. Your company deducts it from your CTC before tax. Ask HR for the quote for your car and lease period."),
    ("""<span class="lbl" id="runLbl">Fuel and other running costs</span>""", "running costs",
     "If fuel, servicing and a driver are paid or reimbursed by the company from your CTC, they come out of pre-tax pay and the car is valued at ₹5,000 or ₹7,000 a month. If you pay them yourself, the value drops to ₹2,000 or ₹3,000, but those costs come from take-home pay."),
    ("""<label for="cl-buyback">Price to buy it at the end</label>""", "the buy-back price",
     "Most leases let you buy the car at the end for an agreed amount, often called the residual value. You pay it from your own money."),
    ("""<label for="cl-dep">Car loses value</label>""", "depreciation",
     "How much of its value the car loses each year. Used-car prices for your model, a few years old, are a good guide."),
    ("""<div class="l">Tax saved with the lease</div>""", "the tax saved",
     "Tax you don't pay on the rental and running costs that go through the company, minus the tax on the car's fixed value under Rule 15, over the whole lease."),
]

GUIDES = [  # (path, title, short description, published, image base name, section)
    ("/guides/rent-vs-buy/", "Rent or buy a home in India? How to decide, with a worked example",
     "How to compare renting and buying properly, what each number in the Rent or Buy calculator means, and what changes the answer, worked through one salaried buyer's numbers.",
     "2026-11-13", "guide-rent-vs-buy", "Your home"),
    ("/guides/long-weekends-2027/", "Long weekends 2027 in India: plan your leave for the longest breaks",
     "Every 2027 central government holiday, the long weekends that need no leave, and the leave days that turn into week-long breaks, worked out with the Salarist leave planner.",
     "2026-11-13", "guide-leave-planner-2027", "Your time off"),
    ("/guides/monthly-budget/", "How to make a monthly budget on a salary in India, with a worked example",
     "A simple way to budget on a salary: start from in-hand pay, turn yearly costs into monthly set-asides, save first and build an emergency fund, worked through one family's numbers.",
     "2026-11-13", "guide-budget-planner", "Your money"),
    ("/guides/prepay-home-loan-or-invest/", "Prepay your home loan or invest? How to decide, with a worked example",
     "How to compare prepaying a home loan with investing the money, after tax, what each number in the Prepay or Invest calculator means, and what changes the answer.",
     "2026-11-13", "guide-prepay-vs-invest", "Your loan"),
    ("/guides/under-construction-vs-ready-to-move/", "Under construction or ready to move? The real cost of waiting for your flat",
     "What rent plus pre-EMI interest really costs while your flat is being built, what each year of delay adds, and how much cheaper an under-construction flat needs to be.",
     "2026-11-13", "guide-under-construction", "Your home"),
    ("/guides/hra-vs-home-loan-tax-benefits/", "HRA or home loan tax benefits: which saves more under the old regime?",
     "How HRA exemption and home loan deductions work under the old regime, which saves more in a worked example, and whether tax should decide if you rent or buy.",
     "2026-11-13", "guide-hra-vs-home-loan", "Your home"),
    ("/guides/restricted-holidays-2027/", "Restricted holidays 2027: which two to pick for the longest breaks",
     "Which of the 32 restricted holidays in the 2027 central government list are wasted on a weekend, and the pairs that turn a few leave days into week-long breaks.",
     "2026-11-13", "guide-restricted-holidays-2027", "Your time off"),
    ("/guides/budget-on-50000-1-lakh-2-lakh-salary/", "Budgeting on ₹50,000, ₹1 lakh or ₹2 lakh a month: three example budgets",
     "Three example monthly budgets for in-hand pay of ₹50,000, ₹1 lakh and ₹2 lakh: where the money goes, how much each saves, and what to fix first.",
     "2026-11-13", "guide-budget-by-income", "Your money"),
    ("/guides/company-car-lease-vs-car-loan/", "Company car lease or car loan? How to decide, with a worked example",
     "How a salary-linked car lease works, the values you're taxed on from April 2026, and how it compares with a car loan, worked through one employee's numbers.",
     "2026-11-13", "guide-car-lease", "Your car"),
    ("/guides/company-car-perquisite-value-2026/", "Company car perquisite value from April 2026: the new ₹5,000 and ₹7,000 rules",
     "The new taxable values for a company car under Rule 15 of the Income-tax Rules, 2026, what they cost you in tax, and whether a car lease is still worth it.",
     "2026-11-13", "guide-car-perquisite", "Your car"),
    ("/guides/best-months-for-a-week-long-break-2027/", "Best months for a week-long break in 2027",
     "The cheapest 9-day break in every month of 2027, with the leave days to take, worked out with the Salarist leave planner on the central government list.",
     "2026-11-13", "guide-best-months-2027", "Your time off"),
    ("/guides/long-weekends-2027-six-day-week/", "Long weekends 2027 for six-day-week workers",
     "The best 2027 breaks if you work Saturdays, or get only the 2nd and 4th Saturdays off, with the leave each one needs.",
     "2026-11-13", "guide-six-day-week-2027", "Your time off"),
]
def _L(v):
    a = abs(v); s = "−" if v < 0 else ""
    if a >= 1e7: return f"{s}₹{a/1e7:.2f} Cr".replace(".00 Cr", " Cr")
    if a >= 1e5: return f"{s}₹{a/1e5:.1f} L".replace(".0 L", " L")
    return f"{s}₹{a:,.0f}"
def _inr(v):
    v = round(v); n = str(abs(v)); h = n[-3:]; r = n[:-3]
    while len(r) > 2: h = r[-2:] + "," + h; r = r[:-2]
    if r: h = r + "," + h
    return ("−" if v < 0 else "") + "₹" + h
def _date(iso):
    y, m, d = iso.split("-")
    return f"{int(d)} {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][int(m)-1]} {y}"
def _pic(img, alt, eager=False):
    at = 'fetchpriority="high"' if eager else 'loading="lazy"'
    return (f'<picture><source type="image/webp" srcset="/assets/img/{img}-1600x900.webp">'
            f'<img src="/assets/img/{img}-1600x900.jpg" width="1600" height="900" alt="{alt}" {at}></picture>')

def guide_rentbuy():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_numbers.js")]))
    A, R = G["arjun"], G["results"]
    b = R["base"]
    def verdict(r): return ("Renting wins by " if r["diff"] > 0 else "Buying wins by ") + _L(abs(r["diff"]))
    skip = ("possess", "room", "basic", "hra", "metro", "claimInt", "claimHra")
    q = "&".join(f"{k}={'1' if v is True else '0' if v is False else v}" for k, v in A.items() if k not in skip)
    tool_link = "/rent-vs-buy/?" + q
    path, title, desc, pub, img, section = GUIDES[0]
    flips = [("He stays 5 years instead of 12", R["stay5"]), ("He stays 20 years", R["stay20"]),
             ("Prices grow 8% a year instead of 6%", R["grow8"]), ("Prices grow 4% a year", R["grow4"]),
             ("He buys under construction, possession in 3 years", R["uc3"]), ("He keeps the home instead of selling", R["keep"]),
             ("He sells and puts the gain into another home", R["reinvest"]), ("He'd invest in FDs, not equity funds", R["fd"]),
             ("He files under the old regime (HRA and home loan deductions)", R["old"])]
    flip_rows = "".join(f"<tr><td>{t}</td><td>{verdict(r)}</td><td>{r['be']:.1f}%</td></tr>" for t, r in flips)
    bw = R["buyWins"]
    toc = [("short-answer", "The short answer"), ("rent-wasted", "Is rent really wasted money?"), ("arjun", "Meet Arjun: the example"),
           ("result", "Arjun's result, line by line"), ("flips", "What changes the answer"), ("buying-wins", "When buying wins"),
           ("invest-trap", "The catch with renting and investing"), ("tax", "Old regime, HRA and home loan tax benefits"),
           ("not-money", "What the numbers can't capture"), ("checklist", "A checklist before you decide"), ("method", "How these numbers were worked out")]
    toc_html = "".join(f'<li><a href="#{i}">{t}</a></li>' for i, t in toc)
    hero_alt = "A balance weighing a rented apartment building and growing investments against an owned house"
    body = f"""<article class="guide">
<header class="wrap g-head">
  <p class="eyebrow">Guide · {section}</p>
  <h1>{title}</h1>
  <p class="lead">Buying feels like building an asset and renting feels like money gone. Both feelings are only half right. This guide shows how to compare the two honestly, using one salaried buyer's numbers, and what it takes for buying to come out ahead.</p>
  <div class="g-by"><img src="/assets/img/icon-192.png" width="44" height="44" alt=""><div><p class="g-by-n">By <a href="/about/">Salarist</a></p><p class="g-meta"><span>Published <time datetime="{pub}">{_date(pub)}</time></span><span>Written for tax year {TAX_YEAR}</span><span>READ_MIN min read</span></p></div></div>
</header>
<figure class="wrap g-hero">{_pic(img, hero_alt, eager=True)}</figure>
<div class="wrap g-body prose">
<nav class="g-toc" aria-label="In this guide"><p>In this guide</p><ol>{toc_html}</ol></nav>

<h2 id="short-answer">The short answer</h2>
<p>Whether renting or buying leaves you richer comes down to three numbers: <strong>how long you'll live in the home</strong>, <strong>how fast home prices grow where you're buying</strong>, and <strong>what your money would earn if you invested it instead</strong>. Tax rules, stamp duty and EMIs matter too, but less than people expect.</p>
<p>With the kind of numbers common in big Indian cities today, renting and investing the difference often comes out ahead on money alone. Buying wins when you stay a long time, prices in your area rise strongly, and you'd otherwise invest cautiously. The rest of this guide shows why, step by step.</p>
<p class="g-cta"><a class="btn" href="/rent-vs-buy/">Check your own numbers</a></p>

<h2 id="rent-wasted">Is rent really wasted money?</h2>
<p>Rent is money you never get back. But owners also pay money they never get back, and it's easy to forget how much:</p>
<ul>
  <li><strong>Interest on the loan.</strong> In the example below, {_L(b['interest'])} of the {_L(b['emiPaid'])} paid in EMIs over 12 years is interest. Only the rest reduces the loan.</li>
  <li><strong>Stamp duty and registration</strong>, paid once and gone: {_L(A['stamp'] + A['reg'])} on a {_L(A['price'])} flat in the example.</li>
  <li><strong>Maintenance, property tax and repairs</strong> every year.</li>
  <li><strong>Selling costs and tax on the gain</strong> when you sell.</li>
  <li><strong>What the down payment could have earned</strong> if it had been invested instead.</li>
</ul>
<p>So the fair question isn't "rent or EMI?" but "after all these costs, which choice leaves me with more?" That's what the calculator answers.</p>

<h2 id="arjun">Meet Arjun: the example</h2>
<p>Arjun is 31, works in IT in Pune and earns ₹18 lakh a year. He files under the new tax regime, where his top slab is 20%. He's choosing between buying a 2BHK and renting a similar flat. Arjun is an example: his numbers are realistic, but use your own when you try the calculator.</p>
<div class="g-scroll"><table class="g-tbl"><tbody>
  <tr><th scope="row">Flat price</th><td>{_inr(A['price'])}</td></tr>
  <tr><th scope="row">Down payment</th><td>{_inr(A['down'])} (20%)</td></tr>
  <tr><th scope="row">Stamp duty</th><td>{_inr(A['stamp'])} (7% of the price, from his cost sheet)</td></tr>
  <tr><th scope="row">Registration and other costs</th><td>{_inr(A['reg'])} and {_inr(A['other'])}</td></tr>
  <tr><th scope="row">Home loan</th><td>{_inr(b['loan'])} at {A['rate']}% for {A['tenure']} years: EMI {_inr(b['emi'])}</td></tr>
  <tr><th scope="row">Owner's costs</th><td>{_inr(A['own'])} a year, rising {A['ownUp']}% a year</td></tr>
  <tr><th scope="row">Rent for a similar flat</th><td>{_inr(A['rent'])} a month, rising {A['rentUp']}% a year, with a {_inr(A['deposit'])} deposit</td></tr>
  <tr><th scope="row">How long he'll stay</th><td>{A['stay']} years, then sell</td></tr>
  <tr><th scope="row">Home price growth</th><td>{A['grow']}% a year</td></tr>
  <tr><th scope="row">If he invests instead</th><td>Equity mutual funds at {A['ret']}% a year</td></tr>
</tbody></table></div>
<p class="g-cta"><a class="btn btn-ghost" href="{tool_link}">Open the calculator with Arjun's numbers</a></p>

<h2 id="result">Arjun's result, line by line</h2>
<h3>The verdict: {verdict(b)}</h3>
<p>After 12 years, renting and investing leaves Arjun with <strong>{_L(b['rent'])}</strong> after tax. Buying leaves him with <strong>{_L(b['buy'])}</strong> once he sells the flat, pays {A['sell']}% in selling costs and {_L(b['propTax'])} of tax on the gain, and repays the {_L(b['loanLeft'])} still owed on the loan.</p>
<p>How can that be, when the flat itself grows to {_L(b['home'])}? Because the renter starts with a {_L(b['upfront'])} head start (the down payment and buying costs, invested on day one) and keeps investing the gap between his rent and the buyer's EMI and upkeep. Arjun's rent starts at less than half his EMI, so that gap is large for years.</p>
<h3>"Buying wins if prices grow above {b['be']:.1f}% a year"</h3>
<p>This is the breakeven: the yearly home price growth at which both choices end level. It's the most useful number on the page. Ask yourself honestly whether homes in your area are likely to rise faster than that, every year, for your whole stay. If the breakeven is well above what you expect, renting is the safer bet. If it's below, buying looks good.</p>
<h3>"Buying pays off: not within 30 years"</h3>
<p>This tells you how long you'd need to stay for buying to come out ahead. For Arjun, buying never catches up at these numbers, even over 30 years. When buying does win, this number tells you the minimum stay that makes it worth it.</p>
<h3>Cash needed to buy: {_L(b['upfront'])}</h3>
<p>Down payment plus stamp duty, registration and other costs. This is real money that leaves your savings on day one, and it's exactly what the renter invests instead.</p>
<h3>The chart and "Where your money went"</h3>
<p>The chart shows what each choice would be worth if you cashed out in any given month. The buyer's line starts lower, because stamp duty and buying costs are gone the moment you buy. The table below it lists every rupee: what each choice paid, what it invested and what it ends with. Both choices use exactly the same money, so the comparison is fair.</p>

<h2 id="flips">What changes the answer</h2>
<p>Here's what happens to Arjun's result when one thing changes and everything else stays the same:</p>
<div class="g-scroll"><table class="g-tbl g-flip"><thead><tr><th scope="col">If…</th><th scope="col">Result</th><th scope="col">Buying wins if prices grow above</th></tr></thead><tbody>
<tr class="base"><td>Arjun's numbers as above</td><td>{verdict(b)}</td><td>{b['be']:.1f}%</td></tr>{flip_rows}
</tbody></table></div>
<p>Two things stand out. Home price growth moves the result more than anything else, and the breakeven barely moves when tax or the investment type changes. Stay length matters too: here a longer stay widens the gap, because Arjun's equity investments compound faster than a flat growing at 6%.</p>

<h2 id="buying-wins">When buying wins</h2>
<p>Change three things: prices in Arjun's area grow <strong>8% a year</strong>, he'd only expect <strong>10% a year</strong> from investing, and he stays <strong>15 years and keeps the flat</strong>. Now <strong>{verdict(bw)}</strong>, and buying pays off after about <strong>{bw['payoff']:.1f} years</strong>.</p>
<p>That's the pattern: buying wins when you stay long, local prices rise strongly and steadily, and your alternative investments would grow slowly. If those describe you, buying can make sense on money alone.</p>

<h2 id="invest-trap">The catch with renting and investing</h2>
<p>Renting only wins if you actually invest the difference, every month, for years, and leave it alone when markets fall. Many people don't. If the money saved by renting would drift into spending, the EMI works as forced saving and buying may leave you better off in practice.</p>
<p>A practical test: set up a monthly SIP for the gap between your EMI and rent for six months before deciding. If it feels easy, the renting numbers are realistic for you.</p>

<h2 id="tax">Old regime, HRA and home loan tax benefits</h2>
<p>Under the old regime, a buyer can deduct up to ₹2,00,000 of home loan interest a year on a home they live in (section 22 of the Income-tax Act, 2025), and count principal, stamp duty and registration within the ₹1,50,000 limit of section 123. A renter can claim the HRA exemption instead. The new regime allows neither.</p>
<p>These benefits help both sides, so they move the answer less than people think. For Arjun on the old regime, with a basic salary of ₹60,000 a month and HRA of ₹30,000, the result is: {verdict(R['old'])}, close to his new-regime result. Choose the old regime in the calculator to see your own figures.</p>

<h2 id="not-money">What the numbers can't capture</h2>
<p>A calculator compares money. Your decision is about more than that:</p>
<ul>
  <li><strong>Reasons to buy anyway:</strong> no landlord and no forced moves, stability for children's schooling or ageing parents, freedom to change the home, and a home that's yours in retirement.</li>
  <li><strong>Reasons to keep renting:</strong> freedom to move for a better job, money that stays liquid for emergencies and opportunities, and no risk from a delayed project or a slow resale market.</li>
</ul>
<p>It's fine to buy even when renting wins on paper. Just know what the peace of mind is costing you, and decide with that number in front of you.</p>

<h2 id="checklist">A checklist before you decide</h2>
<ol class="g-check">
  <li>How long will you realistically live in this home? Be honest about job moves.</li>
  <li>How have home prices in this specific area moved over the last 10 years?</li>
  <li>After the down payment and costs, will you still have an emergency fund of 6 months' expenses?</li>
  <li>Could you keep paying the EMI if your income dropped for a few months?</li>
  <li>If you rent, will you really invest the difference every month?</li>
  <li>Under construction? Add a year or two to the builder's possession date and check again.</li>
</ol>
<p class="g-cta"><a class="btn" href="/rent-vs-buy/">Run your numbers in the calculator</a></p>

<h2 id="method">How these numbers were worked out</h2>
<p>Every figure in this guide comes from the same calculation as the <a href="/rent-vs-buy/">Rent or Buy calculator</a>, run on Arjun's inputs, so the guide and the tool always agree. The calculation runs month by month, with the same money going into both choices. It includes stamp duty, registration, EMIs, owner's costs, rent, the security deposit, investment tax at the end and tax on the home sale. The tax rules are for tax year {TAX_YEAR}: gains on a home held over 24 months are taxed at 12.5% plus cess without indexation, and equity fund gains above ₹1,25,000 at 12.5% plus cess. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This guide is for information and education. It isn't financial, tax or legal advice, and returns aren't guaranteed. For a big decision, consider speaking to a qualified adviser.</p>
</div>
</article>
{related(path)}
"""
    words = len(re.sub(r"<[^>]+>", " ", body).split())
    body = body.replace("READ_MIN", str(max(1, round(words / 220))))
    images = [f"{SITE}/assets/img/{img}-1600x900.jpg", f"{SITE}/assets/img/{img}-1200x900.jpg", f"{SITE}/assets/img/{img}-1200x1200.jpg"]
    graph = [{"@type": "Article", "@id": SITE + path + "#article", "headline": title, "description": desc, "image": images,
              "datePublished": pub + "T09:00:00+05:30", "dateModified": pub + "T09:00:00+05:30",
              "author": {"@type": "Organization", "name": "Salarist", "url": SITE + "/"}, "publisher": {"@id": SITE + "/#org"},
              "mainEntityOfPage": SITE + path, "inLanguage": "en-IN", "articleSection": "Guides", "wordCount": words,
              "about": [{"@type": "Thing", "name": "Renting vs buying a home"}, {"@type": "Thing", "name": "Home loans in India"}],
              "isAccessibleForFree": True},
             {"@type": "Organization", "@id": SITE + "/#org", "name": "Salarist", "url": SITE + "/", "logo": SITE + "/assets/img/icon-512.png"}]
    extra = (f'<meta property="article:published_time" content="{pub}T09:00:00+05:30">\n<meta property="article:section" content="Guides">\n'
             f'<meta property="og:image:alt" content="Rent or buy a home in India: a Salarist guide">\n'
             f'<link rel="preload" as="image" href="/assets/img/{img}-1600x900.webp" type="image/webp" fetchpriority="high">\n')
    return layout(path, "Rent or Buy a Home in India? How to Decide (Worked Example) | Salarist", desc, body,
                  crumbs=[("/", "Home"), ("/guides/", "Guides"), (path, "Rent or buy a home")], graph=graph,
                  css=("tool.css", "guide.css"), og=f"og-{img}.png", og_title="Rent or buy a home in India? How to decide",
                  head_extra=extra, og_type="article")

def _dow(iso):
    import datetime
    y, m, d = map(int, iso.split("-")); return datetime.date(y, m, d).strftime("%a")
def _d(iso, dow=True):
    y, m, d = iso.split("-"); s = f"{int(d)} {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][int(m)-1]}"
    return (_dow(iso) + " " + s) if dow else s
def _span(a, b): return _d(a) + " – " + _d(b)

def article(path, seo_title, og_title, body, crumb, words_note=True):
    g = [x for x in GUIDES if x[0] == path][0]
    _, title, desc, pub, img, section = g
    words = len(re.sub(r"<[^>]+>", " ", body).split())
    body = body.replace("READ_MIN", str(max(1, round(words / 220))))
    images = [f"{SITE}/assets/img/{img}-1600x900.jpg", f"{SITE}/assets/img/{img}-1200x900.jpg", f"{SITE}/assets/img/{img}-1200x1200.jpg"]
    graph = [{"@type": "Article", "@id": SITE + path + "#article", "headline": title, "description": desc, "image": images,
              "datePublished": pub + "T09:00:00+05:30", "dateModified": pub + "T09:00:00+05:30",
              "author": {"@type": "Organization", "name": "Salarist", "url": SITE + "/"}, "publisher": {"@id": SITE + "/#org"},
              "mainEntityOfPage": SITE + path, "inLanguage": "en-IN", "articleSection": "Guides", "wordCount": words, "isAccessibleForFree": True},
             {"@type": "Organization", "@id": SITE + "/#org", "name": "Salarist", "url": SITE + "/", "logo": SITE + "/assets/img/icon-512.png"}]
    extra = (f'<meta property="article:published_time" content="{pub}T09:00:00+05:30">\n<meta property="article:section" content="Guides">\n'
             f'<meta property="og:image:alt" content="{H.escape(og_title)}: a Salarist guide">\n'
             f'<link rel="preload" as="image" href="/assets/img/{img}-1600x900.webp" type="image/webp" fetchpriority="high">\n')
    return layout(path, seo_title, desc, body, crumbs=[("/", "Home"), ("/guides/", "Guides"), (path, crumb)], graph=graph,
                  css=("tool.css", "guide.css"), og=f"og-{img}.png", og_title=og_title, head_extra=extra, og_type="article")

def guide_head(path, lead, hero_alt):
    g = [x for x in GUIDES if x[0] == path][0]
    _, title, desc, pub, img, section = g
    return f"""<article class="guide">
<header class="wrap g-head">
  <p class="eyebrow">Guide · {section}</p>
  <h1>{title}</h1>
  <p class="lead">{lead}</p>
  <div class="g-by"><img src="/assets/img/icon-192.png" width="44" height="44" alt=""><div><p class="g-by-n">By <a href="/about/">Salarist</a></p><p class="g-meta"><span>Published <time datetime="{pub}">{_date(pub)}</time></span>TYPE_LINE<span>READ_MIN min read</span></p></div></div>
</header>
<figure class="wrap g-hero">{_pic(img, hero_alt, eager=True)}</figure>"""

def toc_html(toc): return '<nav class="g-toc" aria-label="In this guide"><p>In this guide</p><ol>' + "".join(f'<li><a href="#{i}">{t}</a></li>' for i, t in toc) + "</ol></nav>"

def guide_leave():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_leave_numbers.js")]))
    path = "/guides/long-weekends-2027/"
    hol_rows = "".join(f"<tr><td>{_d(d)}</td><td>{H.escape(n)}</td><td>{'Weekday' if _dow(d) not in ('Sat','Sun') else 'Weekend'}</td></tr>" for d, n in G["holidays"])
    long_rows = "".join(f"<li><strong>{_span(b['from'], b['to'])}</strong>: {b['len']} days off around {' and '.join(b['holidays'])}, no leave needed.</li>" for b in G["long"])
    val_rows = "".join(f"<tr><td>{_span(b['from'], b['to'])}</td><td>{', '.join(_d(x) for x in b['leaveDays'])}</td><td>{b['len']} days off</td><td>{' and '.join(b['holidays'])}</td></tr>" for b in G["value"])
    lb = G["longestBy"]
    lb_rows = "".join(f"<tr><td>{k} day{'s' if k != '1' else ''}</td><td>{_span(v['from'], v['to'])}</td><td>{v['len']} days off</td><td>{', '.join(_d(x, False) for x in v['leaveDays'])}</td></tr>" for k, v in lb.items())
    def plan_list(p): return "".join(f"<li>{_span(b['from'], b['to'])}: {b['len']} days off for {b['leave']} day{'s' if b['leave'] != 1 else ''} of leave</li>" for b in p["breaks"])
    p8, p12 = G["plan8"], G["plan12"]
    toc = [("short-answer", "The short answer"), ("holidays", "All central government holidays in 2027"), ("free", "Long weekends with no leave"),
           ("best-value", "The best value breaks: 1 to 3 days of leave"), ("longest", "The longest break for each number of leave days"),
           ("plans", "Two ready-made plans for the year"), ("restricted", "Use your restricted holidays well"), ("your-list", "If your company's list is different"),
           ("tips", "Before you apply"), ("method", "How these dates were worked out")]
    body = guide_head(path, "Eleven of India's 2027 central government holidays fall on a weekday, and several sit right next to a weekend. With a little planning, a handful of leave days turns into breaks of a week or more. Here's every holiday, every long weekend, and the smartest ways to use your leave.",
                      "A calendar with a nine-day break highlighted, a sun and an aeroplane").replace("TYPE_LINE", "<span>DoPT holiday list of 16 Jul 2026</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>The central government's 2027 list has <strong>{G['distinct']} holiday dates</strong> (17 holidays, with Independence Day and Milad-un-Nabi both on 15 August), and <strong>{G['weekday']} of them fall on a weekday</strong>. That gives <strong>{len(G['long'])} long weekends with no leave at all</strong>, and the best deal of the year: <strong>{lb['3']['len']} days off for {3} days of leave</strong> around Holi and Good Friday, {_span(lb['3']['from'], lb['3']['to'])}.</p>
<p>With 8 days of leave used well, you can have <strong>{p8['daysOff']} days off</strong> in breaks across the year; with 12, <strong>{p12['daysOff']}</strong>. These figures are for a Monday-to-Friday week and the central list. Your company's list may differ, so check yours in the planner.</p>
<p class="g-cta"><a class="btn" href="/leave-planner-2027/">Plan my 2027 leave</a></p>

<h2 id="holidays">All central government holidays in 2027</h2>
<p>These are the gazetted holidays for central government administrative offices in Delhi and New Delhi, from the Department of Personnel and Training (DoPT) order dated 16 July 2026. Many private companies base their lists on it.</p>
<div class="g-scroll"><table class="g-tbl"><thead><tr><th scope="col">Date</th><th scope="col">Holiday</th><th scope="col">Falls on</th></tr></thead><tbody>{hol_rows}</tbody></table></div>

<h2 id="free">Long weekends with no leave</h2>
<p>These holidays fall on a Friday or Monday, so you get three days off without using any leave:</p>
<ul>{long_rows}</ul>
<p>Diwali on Friday 29 October is the pick of these: a festival weekend with no leave needed.</p>

<h2 id="best-value">The best value breaks: 1 to 3 days of leave</h2>
<p>These are the breaks that give the most days off for each day of leave you use. Take the leave on the days shown, and the weekend and holidays do the rest.</p>
<div class="g-scroll"><table class="g-tbl g-flip"><thead><tr><th scope="col">Break</th><th scope="col">Take leave on</th><th scope="col">Days off</th><th scope="col">Around</th></tr></thead><tbody>{val_rows}</tbody></table></div>

<h2 id="longest">The longest break for each number of leave days</h2>
<p>If you'd rather take one proper holiday, here's the longest break you can get for each number of leave days:</p>
<div class="g-scroll"><table class="g-tbl g-flip"><thead><tr><th scope="col">Leave used</th><th scope="col">Break</th><th scope="col">Days off</th><th scope="col">Take leave on</th></tr></thead><tbody>{lb_rows}</tbody></table></div>
<p>March and April are the sweet spot in 2027: Holi and Good Friday fall in the same week, and Ram Navami and Mahavir Jayanti fall either side of a weekend.</p>

<h2 id="plans">Two ready-made plans for the year</h2>
<h3>8 days of leave: {p8['daysOff']} days off</h3>
<ul>{plan_list(p8)}</ul>
<h3>12 days of leave: {p12['daysOff']} days off</h3>
<ul>{plan_list(p12)}</ul>
<p>Both plans leave the rest of your leave for the second half of the year, school holidays or emergencies. The planner can build a plan for any number of leave days.</p>

<h2 id="restricted">Use your restricted holidays well</h2>
<p>Alongside the gazetted holidays, the DoPT order lists {G['restricted']} restricted (optional) holidays. Central government staff can pick two of them; many private employers offer a similar choice of optional holidays.</p>
<p>Pick them to join up breaks rather than for single days. For example, <strong>Holika Dahan on Monday 22 March</strong> is a restricted holiday. Take it, and the {lb['3']['len']}-day Holi and Good Friday break ({_span(lb['3']['from'], lb['3']['to'])}) needs only 2 days of leave instead of 3. Tick your restricted holidays in the planner and it uses them automatically. For the best pairs, read <a href="/guides/restricted-holidays-2027/">Restricted holidays 2027: which two to pick</a>.</p>

<h2 id="your-list">If your company's list is different</h2>
<ul>
  <li><strong>Different holidays:</strong> private companies and state government offices follow their own lists. In the planner, untick the holidays you don't get and add your company's own.</li>
  <li><strong>Saturdays:</strong> if you work Saturdays, or alternate ones, there are no free long weekends and every break costs more leave. The planner handles a Sunday-only week and second-and-fourth Saturdays off. See <a href="/guides/long-weekends-2027-six-day-week/">long weekends 2027 for six-day weeks</a>.</li>
  <li><strong>Leave rules:</strong> some employers count weekends or holidays that fall between leave days as leave too (often called a sandwich rule). Check your leave policy before you apply.</li>
</ul>

<h2 id="tips">Before you apply</h2>
<ol class="g-check">
  <li>Check your company's 2027 holiday list as soon as it's published, and update the planner.</li>
  <li>Apply early for the popular breaks: Holi week, the April long weekends and Diwali fill up fast in most teams.</li>
  <li>Book travel early for the same reason. Fares for long weekends rise as they approach.</li>
  <li>Keep a few days in reserve for emergencies and the second half of the year.</li>
  <li>Budget for the trip: add travel to your monthly plan in the <a href="/budget-planner/">budget planner</a>.</li>
</ol>
<p class="g-cta"><a class="btn" href="/leave-planner-2027/">Find your best breaks</a></p>

<h2 id="method">How these dates were worked out</h2>
<p>Every break in this guide comes from the same calculation as the <a href="/leave-planner-2027/">2027 leave planner</a>, run on the central government list with a Monday-to-Friday week. The holidays are from the DoPT office memorandum dated 16 July 2026 (gazetted holidays for central government administrative offices in Delhi and New Delhi). Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">Holiday dates for some festivals depend on the moon and may be changed by official notification. Always check your own employer's list before booking.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "Long Weekends 2027 in India: Holiday List and Best Leave Plan | Salarist", "Long weekends 2027 in India", body, "Long weekends 2027")

def guide_budget():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_budget_numbers.js")]))
    r, t = G["r"], G["trim"]
    path = "/guides/monthly-budget/"
    FREQ = {"m": "a month", "y": "a year", "d": "a day"}
    sec_rows = ""
    for sec in ["Income", "Home", "Family", "Getting around", "EMIs and insurance", "Lifestyle", "Occasions", "Savings"]:
        ls = [l for l in G["lines"] if l["sec"] == sec]
        if not ls: continue
        tot = sum(l["monthly"] for l in ls)
        low = lambda n: n[0].lower() + n[1:] if n[1:2].islower() else n
        items = "; ".join(f"{H.escape(low(l['name']))} {_inr(l['amt'])} {FREQ[l['freq']]}" for l in ls)
        sec_rows += f"<tr><th scope=\"row\">{sec}</th><td>{_inr(tot)}</td><td>{items[0].upper() + items[1:]}</td></tr>"
    pct = lambda x: f"{round(x * 100)}%"
    noBonus = r["left"] - (r["inc"] - r["incRegular"])
    # sample CSV for readers to load
    rows = [["Salarist Budget Planner · salarist.in/budget-planner · Example: Meera's budget from the Salarist guide"],
            ["To try it, open salarist.in/budget-planner and choose Load budget."], [],
            ["Section", "Item", "Frequency", "Amount", "Type", "Tag"]]
    T = {"need": "Need", "want": "Want", "save": "Saving"}; F = {"m": "Monthly", "y": "Yearly", "d": "Daily"}
    for l in G["lines"]:
        tag = "Salary" if l["name"] == "In-hand salary" else "EMI" if "EMI" in l["name"] else ""
        rows.append([l["sec"], l["name"], F[l["freq"]], str(l["amt"]), "" if l["sec"] == "Income" else T[l["type"]], tag])
    rows.append(["Settings", "Emergency fund saved so far", "", str(G["ef"]), "", ""])
    import csv, io
    buf = io.StringIO(); csv.writer(buf, lineterminator="\r\n").writerows(rows)
    os.makedirs(os.path.join(DIST, "assets", "files"), exist_ok=True)
    open(os.path.join(DIST, "assets", "files", "salarist-budget-example-meera.csv"), "w", encoding="utf-8-sig").write(buf.getvalue())
    toc = [("short-answer", "The short answer"), ("meera", "Meera's budget: the example"), ("result", "Her result, line by line"),
           ("bonus", "The bonus trap"), ("split", "Needs, wants and savings"), ("yearly", "Yearly costs: the budget breakers"),
           ("fix", "Small changes, real difference"), ("emergency", "Building the emergency fund"), ("habits", "Habits that make a budget stick"),
           ("method", "How these numbers were worked out")]
    body = guide_head(path, "A budget isn't about tracking every rupee. It's about knowing, before the month starts, what's coming in, what has to go out, and what you'll keep. Here's a simple way to do it on a salary, worked through one family's real-looking numbers.",
                      "A salary split into three jars for needs, wants and savings").replace("TYPE_LINE", "")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<ol>
  <li><strong>Start from your in-hand salary,</strong> not your CTC. That's the money you actually have.</li>
  <li><strong>List every cost, including the yearly ones,</strong> and turn each yearly cost into a monthly amount to put aside.</li>
  <li><strong>Decide your savings first</strong> and set them to leave your account right after salary day.</li>
  <li><strong>Spend what's left,</strong> and check the plan once a month.</li>
</ol>
<p>The <a href="/budget-planner/">budget planner</a> does the arithmetic as you type. The rest of this guide shows what the numbers mean, using one family's budget.</p>

<h2 id="meera">Meera's budget: the example</h2>
<p>Meera is 34 and lives in Pune with her husband and their 7-year-old. Her in-hand salary is {_inr(110000)} a month, plus a yearly bonus of {_inr(120000)}. Her husband's income covers other family goals, so this budget runs on her pay. She has {_inr(G['ef'])} set aside for emergencies. Meera is an example; use your own numbers in the planner.</p>
<div class="g-scroll"><table class="g-tbl g-budget"><thead><tr><th scope="col">Section</th><th scope="col">A month</th><th scope="col">What's in it</th></tr></thead><tbody>{sec_rows}</tbody></table></div>
<p class="g-cta"><a class="btn btn-ghost" href="/assets/files/salarist-budget-example-meera.csv" download>Download Meera's budget to load in the planner</a></p>

<h2 id="result">Her result, line by line</h2>
<h3>Money left each month: {_inr(r['left'])}</h3>
<p>Her income averages {_inr(r['inc'])} a month once the bonus is spread over 12 months. Needs come to {_inr(r['need'])}, wants to {_inr(r['want'])}, and she puts {_inr(r['save'])} into SIPs. That leaves {_inr(r['left'])}.</p>
<h3>Savings rate: {pct(r['saveRate'])}</h3>
<p>Her SIPs plus what's left over, as a share of her income. It's the single best measure of whether a budget builds wealth. Many planners suggest aiming for 20% or more; Meera is just short.</p>
<h3>EMI load: {pct(r['emiLoad'])}</h3>
<p>Her car EMI of {_inr(12000)} is {pct(r['emiLoad'])} of her in-hand salary. Lenders look at this share before giving a new loan, and a low figure leaves room if her income dips.</p>
<h3>Emergency fund: {r['efMonths']:.1f} months</h3>
<p>Her {_inr(G['ef'])} would cover {r['efMonths']:.1f} months of needs, including the EMI. The usual target is 6 months, so this is her weakest spot.</p>
<h3>Set aside for yearly costs: {_inr(r['setAside'])} a month</h3>
<p>School fees, the health insurance premium, festivals and the family holiday add up to {_inr(r['setAside'] * 12)} a year. Spread evenly, that's {_inr(r['setAside'])} a month she needs to put aside, even in months when nothing is due.</p>

<h2 id="bonus">The bonus trap</h2>
<p>Meera's budget only works because of her bonus. Spread over the year, it adds {_inr(r['inc'] - r['incRegular'])} a month. Without it, she'd be <strong>short by {_inr(-noBonus)} a month</strong>.</p>
<p>That's common, and risky: bonuses and variable pay can shrink in a bad year. A safer plan covers needs and regular savings from the fixed salary, and uses the bonus for yearly costs, the emergency fund or extra investing. In the planner, compare your regular income with your total to see how much your plan leans on the bonus.</p>

<h2 id="split">Needs, wants and savings</h2>
<p>The 50/30/20 rule suggests about half of take-home pay for needs, 30% for wants and 20% for savings. Meera's split is {pct(r['need'] / r['inc'])} needs, {pct(r['want'] / r['inc'])} wants and {pct(r['saveRate'])} savings.</p>
<p>Her needs are well above 50%, mostly rent and school fees, and that's normal for a family in a big Indian city. The rule is a starting point, not a test you pass or fail. The planner lets you set a target that fits your life and shows where you are against it.</p>

<h2 id="yearly">Yearly costs: the budget breakers</h2>
<p>Most budgets don't fail on groceries. They fail in June when school fees are due, or in October when Diwali spending arrives on top of a normal month. The fix is simple:</p>
<ul>
  <li>List every yearly cost: school fees, insurance premiums, vehicle insurance and servicing, festivals, weddings, holidays, gadgets.</li>
  <li>Divide each by 12. The planner does this and shows the monthly total.</li>
  <li>Move that amount every month to a separate savings account or recurring deposit, and pay the bills from there when they come.</li>
</ul>

<h2 id="fix">Small changes, real difference</h2>
<p>If Meera trims eating out from {_inr(6000)} to {_inr(4000)} and shopping from {_inr(4000)} to {_inr(3000)}, she keeps <strong>{_inr(t['left'])} a month instead of {_inr(r['left'])}</strong>, and her savings rate rises to <strong>{pct(t['saveRate'])}</strong>. That's {_inr((t['left'] - r['left']) * 12)} more a year, from two lines.</p>
<p>Wants are the easiest place to start because they're choices. Needs take longer to change: a cheaper home or school is a big decision, not a monthly tweak.</p>

<h2 id="emergency">Building the emergency fund</h2>
<p>Six months of Meera's needs is about {_inr(G['efTarget'])}. She has {_inr(G['ef'])}, so she's {_inr(G['efGap'])} short. Putting all of her monthly surplus towards it would take about <strong>{round(G['efMonthsAtLeft'])} months</strong>, or about <strong>{round(G['efMonthsAtTrim'])} months</strong> with the trims above. Using part of her next bonus would close the gap much faster.</p>
<p>Keep the emergency fund where you can reach it within a day or two, like a savings account or a liquid fund, and don't count long-term investments towards it.</p>

<h2 id="habits">Habits that make a budget stick</h2>
<ol class="g-check">
  <li>Pay yourself first: set SIPs to go out the day after salary day.</li>
  <li>Give yearly costs their own account, topped up every month.</li>
  <li>Build the emergency fund before investing for growth.</li>
  <li>Plan bigger spends ahead, like holidays around <a href="/guides/long-weekends-2027/">2027's long weekends</a>.</li>
  <li>Review once a month: save your budget from the planner, load it next month and update what changed.</li>
</ol>
<p class="g-cta"><a class="btn" href="/budget-planner/">Make your budget</a></p>

<h2 id="method">How these numbers were worked out</h2>
<p>Every figure in this guide comes from the same calculation as the <a href="/budget-planner/">budget planner</a>, run on Meera's numbers. Yearly amounts are divided by 12, and daily amounts are multiplied by 365 and divided by 12. The savings rate counts planned savings plus what's left over, as a share of total income with the bonus spread monthly. The planner works with in-hand pay, after tax, so no tax rules apply. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This guide is for information and education. It isn't financial advice. For a big decision, consider speaking to a qualified adviser.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "How to Make a Monthly Budget on a Salary in India (Worked Example) | Salarist", "Make a monthly budget on a salary", body, "Monthly budget")

def guide_prepay():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_prepay_numbers.js")]))
    A, R = G["rohan"], G["results"]
    b = R["base"]
    path = "/guides/prepay-home-loan-or-invest/"
    def verdict(r): return ("Investing wins by " if r["diff"] > 0 else "Prepaying wins by ") + _L(abs(r["diff"]))
    yrs = lambda m: f"{m / 12:.1f}".rstrip("0").rstrip(".")
    tool_link = "/prepay-vs-invest/?" + "&".join(f"{k}={v}" for k, v in A.items() if k != "claim")
    flips = [("Return of 10% a year instead of 12%", R["ret10"]), ("Return of 8% a year", R["ret8"]),
             ("He'd use a fixed deposit at 7%", R["fd"]), ("He'd use a debt fund at 7.5%", R["debt"]),
             ("His loan rate is 9.5%, not 8.5%", R["rate95"]), ("He files under the old regime and claims interest", R["old"]),
             ("He has ₹30,000 a month spare, not ₹15,000", R["extra30"]), ("A one-time ₹5 lakh instead of ₹15,000 a month", R["lump"]),
             ("Only ₹15 lakh and 5 years left on the loan", R["short"])]
    be = lambda r: "—" if r["be"] is None else f"{r['be']:.1f}%"
    flip_rows = "".join(f"<tr><td>{t}</td><td>{verdict(r)}</td><td>{be(r)}</td></tr>" for t, r in flips)
    toc = [("short-answer", "The short answer"), ("rohan", "Meet Rohan: the example"), ("result", "Rohan's result, line by line"),
           ("guaranteed", "Why prepaying is a guaranteed return"), ("flips", "What changes the answer"), ("old-regime", "The old regime changes the maths"),
           ("not-money", "What the numbers can't capture"), ("split", "You don't have to choose just one"), ("checklist", "A checklist before you decide"),
           ("method", "How these numbers were worked out")]
    body = guide_head(path, "Got some spare money each month and a home loan? You can pay the loan off faster, or invest the money and let the loan run. Both feel right. This guide shows how to compare them properly, after tax, using one borrower's numbers.",
                      "A shrinking home loan on one side and growing investments on the other").replace("TYPE_LINE", f"<span>Written for tax year {TAX_YEAR}</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>Prepaying your home loan earns you a <strong>guaranteed return equal to your loan rate</strong>, with no tax on it. Investing can earn more, but it isn't guaranteed, and the gains are taxed. So the question is simple: <strong>after tax, will your investments beat your loan rate, reliably, for years?</strong></p>
<p>If you'd invest in equity funds for the long run, investing usually wins at today's loan rates. If you'd only use fixed deposits or debt funds, prepaying usually wins. If you're on the old tax regime and claim home loan interest, investing gets a further edge.</p>
<p class="g-cta"><a class="btn" href="/prepay-vs-invest/">Check your own numbers</a></p>

<h2 id="rohan">Meet Rohan: the example</h2>
<p>Rohan is 36 and lives in Bengaluru. He owes <strong>{_inr(A['P'])}</strong> on his home loan at <strong>{A['rate']}%</strong>, with <strong>{A['years']} years</strong> left, so his EMI is {_inr(b['emi'])}. After a raise, he has <strong>{_inr(A['extra'])} a month</strong> spare. He's on the new tax regime with a 30% top slab, and if he invests, it'll be equity mutual funds, where he expects about 12% a year over the long run. Rohan is an example; use your own numbers in the calculator.</p>
<p class="g-cta"><a class="btn btn-ghost" href="{tool_link}">Open the calculator with Rohan's numbers</a></p>

<h2 id="result">Rohan's result, line by line</h2>
<h3>The verdict: {verdict(b)}</h3>
<p>Both choices put the same money to work every month for {A['years']} years. If Rohan prepays, his loan closes in <strong>{yrs(b['payoffMonths'])} years</strong> instead of {A['years']}; after that, his EMI and the spare {_inr(A['extra'])} both go into equity funds. If he invests from the start, the loan runs its full course while his SIP grows.</p>
<p>After {A['years']} years and after tax, investing leaves him with <strong>{_L(b['investFinal'])}</strong>, and prepaying with <strong>{_L(b['prepayFinal'])}</strong>.</p>
<h3>Interest saved by prepaying: {_L(b['saved'])}</h3>
<p>Prepaying cuts his total interest from {_L(b['investInterest'])} to {_L(b['prepayInterest'])}. That's a real, guaranteed saving, and it's why prepaying feels so good. But it isn't the whole answer: the verdict also counts what the same money would have earned if invested.</p>
<h3>"Investing wins if your return beats {b['be']:.1f}% a year"</h3>
<p>This is the breakeven: the yearly investment return at which both choices end level. For Rohan it's {b['be']:.1f}%, a little above his {A['rate']}% loan rate, because investment gains are taxed and loan savings aren't. Ask yourself honestly whether your investments will beat that, year after year.</p>

<h2 id="guaranteed">Why prepaying is a guaranteed return</h2>
<p>Every rupee you prepay stops costing you {A['rate']}% a year in interest. That's the same as earning {A['rate']}% on it, with no market risk and no tax. Few safe investments match that today, which is why prepaying beats fixed deposits for most borrowers.</p>
<p>Equity funds have historically done better over long periods, but they go up and down, and some years they fall. The calculator assumes a steady return, so treat its answer as what happens if your expectation comes true.</p>

<h2 id="flips">What changes the answer</h2>
<p>Here's what happens to Rohan's result when one thing changes and everything else stays the same:</p>
<div class="g-scroll"><table class="g-tbl g-flip"><thead><tr><th scope="col">If…</th><th scope="col">Result after 15 years</th><th scope="col">Investing wins above</th></tr></thead><tbody>
<tr class="base"><td>Rohan's numbers as above</td><td>{verdict(b)}</td><td>{b['be']:.1f}%</td></tr>{flip_rows}
</tbody></table></div>
<p>The investment return decides most of it. Safe options like FDs and debt funds lose clearly to prepaying, because their returns are close to the loan rate and fully taxed. A higher loan rate helps prepaying, and a shorter remaining loan shrinks the difference to almost nothing.</p>

<h2 id="old-regime">The old regime changes the maths</h2>
<p>Under the old regime, you can deduct up to ₹2,00,000 a year of interest on a home you live in (section 22 of the Income-tax Act, 2025). Prepaying cuts your interest, so it also cuts this tax saving. For Rohan, switching to the old regime and claiming interest moves the result to <strong>{verdict(R['old'])}</strong>, and the breakeven return drops to <strong>{R['old']['be']:.1f}%</strong>.</p>
<p>In the first years of a big loan the interest is well above ₹2,00,000 a year, so small prepayments barely touch the deduction at first. The calculator works this out year by year.</p>

<h2 id="not-money">What the numbers can't capture</h2>
<ul>
  <li><strong>Reasons to prepay anyway:</strong> being debt-free sooner, a lower EMI burden if your income drops, and peace of mind that no market can take away.</li>
  <li><strong>Reasons to invest:</strong> money you can reach in an emergency (prepaid money is locked in the house), and a bigger pot if markets do well.</li>
</ul>
<p>Check your emergency fund first. Money prepaid into a home loan is hard to get back when you need it.</p>

<h2 id="split">You don't have to choose just one</h2>
<p>Many people split the money: some into the loan, some into a SIP. It's a sensible hedge when you're unsure about returns. Run the calculator with your full spare amount, then with half, and compare. Also check your loan's terms: most floating-rate home loans for individuals have no prepayment charges, but fixed-rate loans can, so ask your lender.</p>

<h2 id="checklist">A checklist before you decide</h2>
<ol class="g-check">
  <li>Is your emergency fund in place (about 6 months of expenses)?</li>
  <li>What's your loan rate today, and is it fixed or floating?</li>
  <li>Where would you really invest the money, and what return is realistic after tax?</li>
  <li>Are you on the old or new tax regime, and do you claim home loan interest?</li>
  <li>Would you actually keep investing every month, even when markets fall?</li>
  <li>Does your lender charge for prepayment?</li>
</ol>
<p class="g-cta"><a class="btn" href="/prepay-vs-invest/">Run your numbers in the calculator</a></p>

<h2 id="method">How these numbers were worked out</h2>
<p>Every figure in this guide comes from the same calculation as the <a href="/prepay-vs-invest/">Prepay or Invest calculator</a>, run on Rohan's inputs. Both choices use the same money each month; when the prepaid loan closes, the EMI and spare money are invested too. Equity fund gains above ₹1,25,000 are taxed at 12.5% plus cess at the end; debt fund gains and FD interest at the slab rate plus cess. The tax rules are for tax year {TAX_YEAR}. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This guide is for information and education. It isn't financial, tax or legal advice, and returns aren't guaranteed. For a big decision, consider speaking to a qualified adviser.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "Prepay Home Loan or Invest? How to Decide (Worked Example) | Salarist", "Prepay your home loan or invest?", body, "Prepay or invest")

def guide_uc():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_rvb_articles_numbers.js")]))
    A, U, rd = G["arjun"], G["uc"], G["ready"]
    path = "/guides/under-construction-vs-ready-to-move/"
    u3 = U["3"]
    rows = "".join(f"<tr><td>{y} years</td><td>{_L(u['rentDuring'])}</td><td>{_L(u['interestDuring'])}</td><td>{_L(u['gap'])} less</td></tr>" for y, u in U.items())
    disc = (1 - G["evenPrice"] / A["price"]) * 100
    body = guide_head(path, "An under-construction flat is often cheaper on paper. But until you get the keys, you pay interest on the loan and rent on the home you live in, at the same time. Here's how much that really costs, and how much cheaper the flat needs to be to make up for it.",
                      "A crane over a half-built tower next to a finished home").replace("TYPE_LINE", f"<span>Written for tax year {TAX_YEAR}</span>")
    body += f"""
<div class="wrap g-body prose">
<h2 id="short-answer">The short answer</h2>
<p>While the home is being built, you pay <strong>pre-EMI interest on the loan and rent</strong> together. For a {_L(A['price'])} flat with possession in 3 years, that's about <strong>{_L(u3['interestDuring'])} of interest and {_L(u3['rentDuring'])} of rent</strong>. To come out level with a ready-to-move flat, the under-construction one needs to be about <strong>{disc:.0f}% cheaper</strong> in this example, and every year of delay makes it worse.</p>
<p class="g-cta"><a class="btn" href="/rent-vs-buy/">Compare your options</a></p>

<h2 id="example">The example</h2>
<p>We use the same buyer as our <a href="/guides/rent-vs-buy/">main rent or buy guide</a>: Arjun in Pune, looking at a {_L(A['price'])} flat with 20% down and a loan at {A['rate']}% for {A['tenure']} years. He pays {_inr(A['rent'])} a month in rent today and plans to stay {A['stay']} years. We compare buying the flat ready to move in with buying it under construction at the same price.</p>

<h2 id="cost">What the wait costs</h2>
<p>With the full loan paid out at the start, here's what Arjun pays before possession, and how much less he ends up with after {A['stay']} years than if he'd bought ready to move in:</p>
<div class="g-scroll"><table class="g-tbl g-flip"><thead><tr><th scope="col">Possession in</th><th scope="col">Rent while it's built</th><th scope="col">Pre-EMI interest</th><th scope="col">Ends up with</th></tr></thead><tbody>{rows}</tbody></table></div>
<p>Each extra year of waiting costs him roughly another {_L((U['5']['gap'] - U['2']['gap']) / 3)} by the end. That's why a builder's delay hurts so much: you keep paying rent and interest, and the EMI that actually reduces the loan starts later.</p>

<h2 id="discount">How much cheaper should it be?</h2>
<p>For Arjun's numbers, an under-construction flat with possession in 3 years needs to cost about <strong>{_L(G['evenPrice'])}</strong>, roughly {disc:.0f}% less than the ready flat, for buying it to come out as well as buying ready. If the discount is smaller, the ready flat is the better buy on money alone.</p>
<p>Your figure will differ with your rent, loan rate and the years to possession. Choose "Under construction" in the calculator and try different prices.</p>

<h2 id="also">Other things to weigh</h2>
<ul>
  <li><strong>Delays.</strong> Add a year or two to the builder's date when you run the numbers. Check the project's registration and progress on your state's RERA website.</li>
  <li><strong>GST.</strong> Under-construction homes attract GST, which a ready home with a completion certificate doesn't. Ask the builder for the full cost sheet and put the GST in "Other buying costs".</li>
  <li><strong>Loan paid out in stages.</strong> Many loans are paid out as construction progresses, so early interest is lower than our full-payout assumption. Ask your lender for the schedule.</li>
  <li><strong>Tax, old regime only.</strong> Interest paid before the year of possession can be claimed in five equal parts from that year, within the ₹2,00,000 yearly limit. If possession comes more than five years after the loan year, the limit drops to ₹30,000.</li>
  <li><strong>The upside.</strong> A new flat, a better choice of units, and sometimes faster price growth in a new area.</li>
</ul>

<h2 id="method">How these numbers were worked out</h2>
<p>All figures come from the <a href="/rent-vs-buy/">Rent or Buy calculator</a>, run on Arjun's inputs: prices grow 6% a year, he'd invest the difference in equity funds at 12%, the full loan is paid out at the start with interest-only payments until possession, and he rents until he moves in. The "how much cheaper" figure keeps the down payment at 20% and stamp duty at 7% of the lower price. Tax rules are for tax year {TAX_YEAR}. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information and education. It isn't financial, tax or legal advice. For a big decision, consider speaking to a qualified adviser.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "Under Construction vs Ready to Move: The Real Cost of Waiting | Salarist", "Under construction or ready to move?", body, "Under construction vs ready")

def guide_hra():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_rvb_articles_numbers.js")]))
    A, h = G["arjun"], G["hra"]
    path = "/guides/hra-vs-home-loan-tax-benefits/"
    r0, r1, s30 = h["room0"], h["room150"], h["slab30"]
    body = guide_head(path, "Renters can claim HRA. Home buyers can claim home loan interest and principal. Both only work under the old tax regime, and both shrink your tax bill. So which saves more, and should tax decide whether you rent or buy?",
                      "Two tax forms compared: one for rent and one for a home").replace("TYPE_LINE", f"<span>Written for tax year {TAX_YEAR}</span>")
    body += f"""
<div class="wrap g-body prose">
<h2 id="short-answer">The short answer</h2>
<p>For a typical salaried buyer, the two benefits are <strong>close in size</strong>. In our example, HRA saves the renter <strong>{_inr(r0['rentRefund1'])}</strong> in the first year, and home loan interest saves the buyer <strong>{_inr(r0['buyRefund1'])}</strong>. Over 12 years the gap hardly changes the rent or buy answer. So <strong>don't let tax decide</strong>: price growth, your stay and what you'd invest matter far more.</p>
<p>Both benefits exist only under the old regime. Under the new regime, neither renters nor buyers of a home they live in get them.</p>
<p class="g-cta"><a class="btn" href="/rent-vs-buy/">Compare with your numbers</a></p>

<h2 id="hra">How HRA exemption works</h2>
<p>If your salary includes HRA and you pay rent, part of the HRA is tax-free. The exempt amount is the <strong>lowest</strong> of three:</p>
<ol>
  <li>The HRA you actually receive.</li>
  <li>Rent paid minus 10% of your basic salary.</li>
  <li>50% of basic salary in Delhi, Mumbai, Kolkata, Chennai, Bengaluru, Hyderabad, Pune or Ahmedabad, or 40% anywhere else.</li>
</ol>
<p>Arjun earns a basic salary of ₹60,000 a month with ₹30,000 HRA and pays {_inr(A['rent'])} rent in Pune. Rent minus 10% of basic is ₹18,000, the lowest of the three, so <strong>{_inr(G['hraExempt1'])} a year</strong> is tax-free. At his 20% slab plus cess, that saves {_inr(r0['rentRefund1'])} in tax.</p>

<h2 id="loan">How home loan tax benefits work</h2>
<ul>
  <li><strong>Interest:</strong> up to ₹2,00,000 a year on a home you live in (section 22 of the Income-tax Act, 2025, earlier section 24(b)).</li>
  <li><strong>Principal, stamp duty and registration:</strong> within the ₹1,50,000 yearly limit of section 123 (earlier section 80C), shared with PF, PPF, ELSS, life insurance and more.</li>
</ul>
<p>In Arjun's first year, he pays {_inr(r0['int1'])} of interest, so he claims the full ₹2,00,000 and saves {_inr(r0['buyRefund1'])}. The ₹1,50,000 limit is usually already used up by PF; if it is, principal adds nothing. If he had the whole ₹1,50,000 free, his first-year saving would rise to {_inr(r1['buyRefund1'])}.</p>

<h2 id="compare">Side by side</h2>
<div class="g-scroll"><table class="g-tbl g-flip"><thead><tr><th scope="col">Arjun, old regime</th><th scope="col">Renting (HRA)</th><th scope="col">Buying (home loan)</th></tr></thead><tbody>
<tr><td>Tax saved, year 1 (20% slab)</td><td>{_inr(r0['rentRefund1'])}</td><td>{_inr(r0['buyRefund1'])}</td></tr>
<tr><td>Tax saved, year 1, with ₹1.5 lakh limit free</td><td>{_inr(r1['rentRefund1'])}</td><td>{_inr(r1['buyRefund1'])}</td></tr>
<tr><td>Tax saved, year 1, at the 30% slab</td><td>{_inr(s30['rentRefund1'])}</td><td>{_inr(s30['buyRefund1'])}</td></tr>
<tr><td>Tax saved over 12 years (20% slab)</td><td>{_L(r0['rentRefunds'])}</td><td>{_L(r0['buyRefunds'])}</td></tr>
</tbody></table></div>
<p>HRA grows over time because rent and salary rise, while the home loan benefit stays capped at ₹2,00,000 of interest. That's why, over 12 years, HRA saves Arjun more in total.</p>

<h2 id="answer">Does tax change the rent or buy answer?</h2>
<p>Barely. For Arjun, renting wins by {_L(h['newRegime'])} under the new regime and by {_L(h['oldRegime'])} under the old one. The benefits help both sides, so they mostly cancel out. The things that do move the answer are home price growth, how long you'll stay and the return on what you'd invest. Our <a href="/guides/rent-vs-buy/">rent or buy guide</a> walks through those.</p>
<p>One more thing: the old regime only pays off if your deductions are large enough to beat the new regime's lower rates. Check both before you assume HRA or home loan benefits help you at all.</p>

<h2 id="method">How these numbers were worked out</h2>
<p>All figures come from the <a href="/rent-vs-buy/">Rent or Buy calculator</a> on Arjun's inputs, under the old regime. HRA uses the three-way rule above, with basic salary and HRA rising in line with rent. Home loan interest is capped at ₹2,00,000 a year; principal, stamp duty and registration count only within the room left in the ₹1,50,000 limit. Tax is at the slab rate plus 4% cess. HRA cities and limits are as listed in the Income-tax Rules, 2026, for tax year {TAX_YEAR}. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information and education. It isn't tax, financial or legal advice. For your own return, consider speaking to a qualified adviser.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "HRA vs Home Loan Tax Benefits: Which Saves More? (Old Regime) | Salarist", "HRA or home loan tax benefits?", body, "HRA vs home loan")

def _budget_csv(lines, ef, fname, label):
    """Write an example budget as a CSV the Budget Planner can load."""
    import csv, io
    T = {"need": "Need", "want": "Want", "save": "Saving"}; F = {"m": "Monthly", "y": "Yearly", "d": "Daily"}
    rows = [[f"Salarist Budget Planner · salarist.in/budget-planner · Example: {label}"],
            ["To try it, open salarist.in/budget-planner and choose Load budget."], [],
            ["Section", "Item", "Frequency", "Amount", "Type", "Tag"]]
    for l in lines:
        tag = "Salary" if l["name"] == "In-hand salary" else "EMI" if "EMI" in l["name"] else ""
        rows.append([l["sec"], l["name"], F[l["freq"]], str(l["amt"]), "" if l["sec"] == "Income" else T[l["type"]], tag])
    rows.append(["Settings", "Emergency fund saved so far", "", str(ef), "", ""])
    buf = io.StringIO(); csv.writer(buf, lineterminator="\r\n").writerows(rows)
    os.makedirs(os.path.join(DIST, "assets", "files"), exist_ok=True)
    open(os.path.join(DIST, "assets", "files", fname), "w", encoding="utf-8-sig").write(buf.getvalue())

def _sec_rows(lines):
    FREQ = {"m": "a month", "y": "a year", "d": "a day"}
    low = lambda n: n[0].lower() + n[1:] if n[1:2].islower() else n
    out = ""
    for sec in ["Home", "Family", "Getting around", "EMIs and insurance", "Lifestyle", "Occasions", "Savings"]:
        ls = [l for l in lines if l["sec"] == sec]
        if not ls: continue
        items = "; ".join(f"{H.escape(low(l['name']))} {_inr(l['amt'])} {FREQ[l['freq']]}" for l in ls)
        out += f"<tr><th scope=\"row\">{sec}</th><td>{_inr(sum(l['monthly'] for l in ls))}</td><td>{items[0].upper() + items[1:]}</td></tr>"
    return out

def guide_budget_tiers():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_budget_tiers_numbers.js")]))
    path = "/guides/budget-on-50000-1-lakh-2-lakh-salary/"
    pct = lambda x: f"{round(x * 100)}%"
    a, b, c = G["50k"], G["1L"], G["2L"]
    files = {"50k": "salarist-budget-example-50000.csv", "1L": "salarist-budget-example-1-lakh.csv", "2L": "salarist-budget-example-2-lakh.csv"}
    labels = {"50k": "Rohan, ₹50,000 a month", "1L": "Ananya and Vikram, ₹1 lakh a month", "2L": "the Iyers, ₹2 lakh a month"}
    for k in files: _budget_csv(G[k]["lines"], G[k]["ef"], files[k], labels[k] + ", from the Salarist guide")
    def summ(k, who):
        r = G[k]["r"]; i = r["inc"]
        return (f"<tr><th scope=\"row\">{who}</th><td>{_inr(i)}</td><td>{pct(r['need'] / i)}</td><td>{pct(r['want'] / i)}</td>"
                f"<td>{pct(r['save'] / i)}</td><td>{_inr(r['left'])}</td><td><strong>{pct(r['saveRate'])}</strong></td></tr>")
    ra, rb, rc = a["r"], b["r"], c["r"]
    def ef_months(t, extra):  # months to reach 6 months of needs if the surplus plus planned top-up goes to the fund
        gap = max(0, t["efTarget"] - t["ef"]); return round(gap / extra) if extra > 0 else None
    toc = [("short-answer", "The short answer"), ("fifty", "₹50,000 a month: Rohan"), ("one-lakh", "₹1 lakh a month: Ananya and Vikram"),
           ("two-lakh", "₹2 lakh a month: the Iyers"), ("lessons", "What the three budgets have in common"), ("method", "How these numbers were worked out")]
    body = guide_head(path, "There's no single right budget for a salary. What changes as income grows is where the pressure sits: rent at ₹50,000, a child's costs at ₹1 lakh, and the home loan and school fees at ₹2 lakh. Here are three example budgets, worked out with the Salarist budget planner, and what each household should fix first.",
                      "Three salary bars of rising height, each split into needs, wants and savings").replace("TYPE_LINE", "")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>All three households below keep their needs, wants and savings in check, but the share they save doesn't rise with income. <strong>Rohan saves {pct(ra['saveRate'])} of ₹50,000; the Iyers save {pct(rc['saveRate'])} of ₹2 lakh.</strong> As pay grows, so do the fixed commitments: a bigger home, a loan, school fees. A higher salary only builds wealth if savings grow with it.</p>
<div class="g-scroll"><table class="g-tbl g-flip"><thead><tr><th scope="col">Household</th><th scope="col">In hand</th><th scope="col">Needs</th><th scope="col">Wants</th><th scope="col">Planned savings</th><th scope="col">Left over</th><th scope="col">Saves in all</th></tr></thead><tbody>
{summ('50k', 'Rohan')}{summ('1L', 'Ananya and Vikram')}{summ('2L', 'The Iyers')}
</tbody></table></div>
<p>"Saves in all" counts planned savings plus what's left over. These are examples: use your own numbers in the <a href="/budget-planner/">budget planner</a>, or download any of the three budgets below and load it to start from there.</p>

<h2 id="fifty">₹50,000 a month: Rohan</h2>
<p>Rohan is 26, single, and shares a 2BHK in Pune. He sends {_inr(4000)} a month home to his parents and rides a bike to work. He has {_inr(a['ef'])} saved for emergencies.</p>
<div class="g-scroll"><table class="g-tbl g-budget"><thead><tr><th scope="col">Section</th><th scope="col">A month</th><th scope="col">What's in it</th></tr></thead><tbody>{_sec_rows(a['lines'])}</tbody></table></div>
<ul>
  <li><strong>What works:</strong> sharing a flat keeps rent at {pct(11000 / ra['inc'])} of his pay, so he can save {_inr(ra['save'])} a month and still have {_inr(ra['left'])} left.</li>
  <li><strong>Fix first:</strong> his emergency fund covers {ra['efMonths']:.1f} months of needs. Six months is about {_inr(round(a['efTarget'], -3))}. Sending the {_inr(ra['left'])} left over to the fund along with his {_inr(4000)} top-up gets him there in about <strong>{ef_months(a, ra['left'] + 4000)} months</strong>.</li>
  <li><strong>Watch:</strong> at this salary, one new EMI changes everything. A {_inr(10000)} bike or phone EMI would take all of his surplus and more.</li>
</ul>
<p class="g-cta"><a class="btn btn-ghost" href="/assets/files/{files['50k']}" download>Download Rohan's budget</a></p>

<h2 id="one-lakh">₹1 lakh a month: Ananya and Vikram</h2>
<p>Ananya and Vikram live in Bengaluru with their 3-year-old and bring home {_inr(b['r']['inc'])} a month between them. They rent a 2BHK and run one car. They have {_inr(b['ef'])} saved for emergencies.</p>
<div class="g-scroll"><table class="g-tbl g-budget"><thead><tr><th scope="col">Section</th><th scope="col">A month</th><th scope="col">What's in it</th></tr></thead><tbody>{_sec_rows(b['lines'])}</tbody></table></div>
<ul>
  <li><strong>What works:</strong> they have health and term life insurance in place, and save {_inr(rb['save'])} a month in SIPs, PPF and their emergency fund.</li>
  <li><strong>Fix first:</strong> yearly costs. Playschool fees, insurance premiums, festivals and a holiday add up to {_inr(rb['setAside'] * 12)} a year, or <strong>{_inr(rb['setAside'])} a month</strong> to put aside. Without a separate account for this, those bills land on one month's salary.</li>
  <li><strong>Then:</strong> their emergency fund covers {rb['efMonths']:.1f} months. Six months is about {_inr(round(b['efTarget'], -3))}; adding the {_inr(rb['left'])} left over to their {_inr(3000)} top-up gets them there in about {ef_months(b, rb['left'] + 3000)} months.</li>
</ul>
<p class="g-cta"><a class="btn btn-ghost" href="/assets/files/{files['1L']}" download>Download Ananya and Vikram's budget</a></p>

<h2 id="two-lakh">₹2 lakh a month: the Iyers</h2>
<p>The Iyers have two school-age children and a home loan EMI of {_inr(50000)}. Their combined in-hand pay is {_inr(c['r']['inc'])} a month, and they have {_inr(c['ef'])} saved for emergencies.</p>
<div class="g-scroll"><table class="g-tbl g-budget"><thead><tr><th scope="col">Section</th><th scope="col">A month</th><th scope="col">What's in it</th></tr></thead><tbody>{_sec_rows(c['lines'])}</tbody></table></div>
<ul>
  <li><strong>What works:</strong> the EMI is {pct(rc['emiLoad'])} of their pay, which leaves room if one income dips, and they invest {_inr(rc['save'])} a month.</li>
  <li><strong>The catch:</strong> needs take {pct(rc['need'] / rc['inc'])} of their pay. The EMI and school fees alone come to {_inr(50000 + 15000)} a month. Their savings rate of {pct(rc['saveRate'])} is lower than Rohan's on a quarter of the income.</li>
  <li><strong>Fix first:</strong> their emergency fund covers {rc['efMonths']:.1f} months. With a loan and two children, six months (about {_inr(round(c['efTarget'], -3))}) matters more, not less. A bonus is the quickest way to close the gap.</li>
  <li><strong>Before the next big step,</strong> like a bigger home or a second car, run it through the planner first. Fixed costs are easy to add and hard to cut.</li>
</ul>
<p class="g-cta"><a class="btn btn-ghost" href="/assets/files/{files['2L']}" download>Download the Iyers' budget</a></p>

<h2 id="lessons">What the three budgets have in common</h2>
<ol class="g-check">
  <li><strong>Needs above 50% are normal</strong> in a big Indian city. The 50/30/20 rule is a starting point; a better test is whether you save 20% or more in all.</li>
  <li><strong>Every one of them is short on the emergency fund.</strong> It's the first thing to build, at any salary.</li>
  <li><strong>Yearly costs need a monthly set-aside,</strong> from {_inr(ra['setAside'])} a month for Rohan to {_inr(rc['setAside'])} for the Iyers.</li>
  <li><strong>Raise savings with every raise.</strong> Increase your SIP when your pay goes up, before the extra money finds somewhere else to go.</li>
</ol>
<p>For a step-by-step method, read <a href="/guides/monthly-budget/">How to make a monthly budget on a salary</a>.</p>
<p class="g-cta"><a class="btn" href="/budget-planner/">Make your budget</a></p>

<h2 id="method">How these numbers were worked out</h2>
<p>Every figure comes from the same calculation as the <a href="/budget-planner/">budget planner</a>, run on each household's numbers. Yearly amounts are divided by 12, and daily amounts are multiplied by 365 and divided by 12. The emergency fund target is six months of needs, including EMIs. The households are examples, not averages or survey data; costs vary a lot by city and family. The planner works with in-hand pay, after tax, so no tax rules apply. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information and education. It isn't financial advice. For a big decision, consider speaking to a qualified adviser.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "Budget on ₹50,000, ₹1 Lakh or ₹2 Lakh Salary: 3 Example Budgets | Salarist", "Budgeting on ₹50,000, ₹1 lakh or ₹2 lakh a month", body, "Budget by income")

def guide_rh():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_rh_numbers.js")]))
    path = "/guides/restricted-holidays-2027/"
    P = G["picks"]; hn, hv, du = P["holiNaraka"], P["holiVaisakhi"], P["dussehra"]
    L = {x["date"]: x for x in G["list"]}
    def lv(n): return f"{n} day{'s' if n != 1 else ''} of leave"
    def brk(x): return f"{x['len']} days, {_span(x['from'], x['to'])}"
    def leave_on(x): return ", ".join(_d(d, False) for d in x["leaveDays"])
    hol = L["2027-03-22"]["best"]
    rows = ""
    for x in G["list"]:
        if x["kind"] in ("weekend", "clash"): continue
        f = x["free"]; free = f"{f['len']} days, {_span(f['from'], f['to'])}" if f["len"] >= 2 else "Just the day"
        best = x.get("best")
        bt = f"{brk(best)}, {lv(best['leave'])} ({best['leaveWithout']} without it)" if best else "No longer break within 3 days of leave"
        rows += f"<tr><td class=\"nw\">{_d(x['date'])}</td><td><b>{H.escape(x['name'])}</b></td><td data-l=\"With no leave\">{free}</td><td data-l=\"Longest break, up to 3 days of leave\">{bt}</td></tr>"
    wk = [x for x in G["list"] if x["kind"] == "weekend"]
    wk_list = "; ".join(f"{H.escape(x['name'])} ({_d(x['date'])})" for x in wk)
    cl = [x for x in G["list"] if x["kind"] == "clash"][0]
    def pair_row(name, p, leave):
        free = " and ".join(f"{f['len']} days, {_span(f['from'], f['to'])}" for f in p["free"])
        brks = " and ".join(brk(x) for x in p["breaks"])
        used = sum(x["leave"] for x in p["breaks"]); without = sum(x["leaveWithout"] for x in p["breaks"])
        return f"<tr><th scope=\"row\">{name}</th><td data-l=\"With no leave\">{free}</td><td data-l=\"With a little leave\">{brks}, for {lv(used)}</td><td data-l=\"Leave saved\">{without - used} days</td></tr>"
    toc = [("short-answer", "The short answer"), ("rules", "How restricted holidays work"), ("pairs", "Three pairs worth picking"),
           ("skip", "Don't pick these"), ("all", "Every restricted holiday on a weekday"), ("choose", "How to choose yours"), ("method", "How these dates were worked out")]
    body = guide_head(path, f"Central government staff can take any two of the {G['count']} restricted holidays on the 2027 list, and many private companies offer a similar pair of optional holidays. Picked well, two optional days turn into a four-day Holi weekend and a nine-day break. Here's which two to choose.",
                      "A calendar with two optional holidays ticked and joined to the weekend").replace("TYPE_LINE", "<span>DoPT holiday list of 16 Jul 2026</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>Of the {G['count']} restricted holidays in 2027, <strong>{G['weekend']} fall on a Saturday or Sunday</strong> and one falls on the same day as a gazetted holiday, so only <strong>{G['usable']} are worth picking</strong>.</p>
<p><strong>The best single pick is Holika Dahan, Monday 22 March.</strong> It joins the weekend to Holi on Tuesday for a 4-day break with no leave. Take {lv(hol['leave'])} ({leave_on(hol)}) and Good Friday finishes the week: <strong>{brk(hol)}</strong>.</p>
<p>For the second pick, choose the season you want a break in: Diwali (Naraka Chaturdasi), April (Vaisakhi), or Durga Puja, where it pays to use both picks together. Every weekday restricted holiday gives you one extra day off; the good ones join up with weekends and other holidays.</p>
<p class="g-cta"><a class="btn" href="/leave-planner-2027/?r=0322,1028">Try Holi and Diwali in the planner</a></p>

<h2 id="rules">How restricted holidays work</h2>
<p>The Department of Personnel and Training (DoPT) office memorandum of 16 July 2026 lists 17 gazetted holidays and {G['count']} restricted holidays for central government offices in Delhi and New Delhi. Gazetted holidays close the office for everyone. Restricted holidays don't: the office stays open, and each employee may take <strong>any two</strong> of them in the year.</p>
<p>Offices in other states follow lists set by their state's coordination committee, so check your own office's list. Private companies set their own rules: many offer two or three optional or floating holidays, sometimes from a list like this one, sometimes on any festival you choose.</p>

<h2 id="pairs">Three pairs worth picking</h2>
<p>Each pair below, worked out with the leave planner for a Monday-to-Friday week:</p>
<div class="g-scroll"><table class="g-tbl g-pairs g-stack"><thead><tr><th scope="col">Pick</th><th scope="col">With no leave</th><th scope="col">With a little leave</th><th scope="col">Leave saved</th></tr></thead><tbody>
{pair_row("Holi and Diwali: Holika Dahan (22 Mar) and Naraka Chaturdasi (28 Oct)", hn, 0)}
{pair_row("Holi and April: Holika Dahan (22 Mar) and Vaisakhi (14 Apr)", hv, 0)}
{pair_row("Durga Puja: Mahashtami (7 Oct) and Mahanavmi (8 Oct)", du, 0)}
</tbody></table></div>
<ul>
  <li><strong>Holi and Diwali</strong> gives you two 4-day festival weekends without any leave, and two 9-day breaks if you add leave. Take leave on {leave_on(hn['breaks'][1])} for the Diwali week.</li>
  <li><strong>Holi and April</strong> gives the most days off for the leave: Vaisakhi on Wednesday 14 April sits next to Ram Navami on Thursday, and Mahavir Jayanti follows on Monday 19 April. Take leave on {leave_on(hv['breaks'][1])} for {brk(hv['breaks'][1])}.</li>
  <li><strong>Durga Puja</strong> uses both picks on one festival. Dussehra falls on Saturday 9 October, so Mahashtami and Mahanavmi make it a 4-day weekend. With leave on {leave_on(du['breaks'][0])}, Gandhi Jayanti on Saturday 2 October starts a {du['breaks'][0]['len']}-day break.</li>
</ul>

<h2 id="skip">Don't pick these</h2>
<p>These {G['weekend']} restricted holidays fall on a weekend in 2027, so choosing one gives you nothing extra on a Monday-to-Friday week: {wk_list}.</p>
<p>{H.escape(cl['name'])} on {_d(cl['date'])} is the same day as {H.escape(cl['with'])}, already a holiday for everyone.</p>
<p>If you work Saturdays, the Saturday ones do give you a day off. Choose your week in the <a href="/leave-planner-2027/">leave planner</a> to see your own options.</p>

<h2 id="all">Every restricted holiday on a weekday</h2>
<p>For each of the {G['usable']} that fall on a weekday: the break it makes with no leave, and the longest break it's part of with up to 3 days of leave. The figure in brackets is the leave the same break would take without the restricted holiday.</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Date</th><th scope="col">Restricted holiday</th><th scope="col">With no leave</th><th scope="col">Longest break, up to 3 days of leave</th></tr></thead><tbody>{rows}</tbody></table></div>

<h2 id="choose">How to choose yours</h2>
<ol class="g-check">
  <li><strong>Festival first.</strong> If you celebrate a festival on the list, that's your pick. Use the second one for a longer break.</li>
  <li><strong>Prefer Mondays and Fridays,</strong> or a Thursday before a Friday holiday. They join up with the weekend.</li>
  <li><strong>Check your own list.</strong> Your office or company may have a different set. Tick your holidays in the <a href="/leave-planner-2027/">leave planner</a> and it builds your breaks around them.</li>
  <li><strong>Apply early.</strong> Restricted holidays still need approval like leave, and popular dates fill up.</li>
  <li><strong>Watch for date changes.</strong> Festivals that follow the moon can move by notification. Check before booking travel.</li>
</ol>
<p>For the full year, including long weekends and ready-made leave plans, read <a href="/guides/long-weekends-2027/">Long weekends 2027 in India</a>.</p>
<p class="g-cta"><a class="btn" href="/leave-planner-2027/">Plan my 2027 leave</a></p>

<h2 id="method">How these dates were worked out</h2>
<p>Every break comes from the same calculation as the <a href="/leave-planner-2027/">2027 leave planner</a>, run on the central government list with a Monday-to-Friday week and the chosen restricted holidays added. The holidays are from the DoPT office memorandum dated 16 July 2026 (Annexure I, gazetted, and Annexure II, restricted, for central government administrative offices in Delhi and New Delhi). Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">Holiday dates for some festivals depend on the moon and may be changed by official notification. Always check your own employer's list before booking.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "Restricted Holidays 2027: Which Two to Pick for Longer Breaks | Salarist", "Restricted holidays 2027: which two to pick", body, "Restricted holidays 2027")

def guide_car():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_car_numbers.js")]))
    S, B, sl = G["S"], G["base"], G["slabs"]
    path = "/guides/company-car-lease-vs-car-loan/"
    sl_rows = "".join(f"<tr><td>{k}%</td><td>{('Lease saves ' + _L(v['diff'])) if v['diff'] > 0 else ('Loan saves ' + _L(-v['diff']))}</td></tr>" for k, v in sl.items())
    toc = [("short-answer", "The short answer"), ("how", "How a company car lease works"), ("values", "The values you're taxed on"), ("example", "The example: Neha's car"),
           ("result", "Her result, number by number"), ("changes", "What changes the answer"), ("ask", "Questions to ask before you sign"), ("method", "How these numbers were worked out")]
    body = guide_head(path, "Many companies let you lease a car through your salary. The rental comes out of your pay before tax, and you're taxed only on a small fixed value for the car. Here's how that compares with buying the same car on a loan, worked through one employee's numbers.",
                      "A car between a lease document and a loan document, with a rupee coin").replace("TYPE_LINE", f"<span>Written for tax year {TAX_YEAR}</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>A company car lease usually wins for people in the higher tax slabs, because the rental and running costs come out of pre-tax pay while you're taxed only on <strong>₹5,000 or ₹7,000 a month</strong>. In our example, a {_L(S['price'])} car over {S['years']} years, the lease comes out <strong>{_L(B['diff'])} ahead</strong> in the 30% slab and {_L(sl['20']['diff'])} ahead in the 20% slab, but loses in the 0% slab.</p>
<p>The answer turns on four things: your tax slab, the rental your company is quoted, what you pay to keep the car at the end, and whether you might leave the job before the lease ends.</p>
<p class="g-cta"><a class="btn" href="/company-car-lease-vs-loan/">Compare your own numbers</a></p>

<h2 id="how">How a company car lease works</h2>
<ul>
  <li><strong>The leasing company owns the car</strong> and leases it to your employer, usually for 3 to 5 years. The car is registered in its name.</li>
  <li><strong>Your CTC is restructured:</strong> the monthly rental, and often fuel, servicing, insurance and a driver, are paid by the company out of your CTC. That part of your pay is no longer taxable salary.</li>
  <li><strong>You're taxed on a fixed value for using the car,</strong> set by Rule 15 of the Income-tax Rules, 2026, not on what it really costs.</li>
  <li><strong>At the end,</strong> you usually buy the car at an agreed price or hand it back.</li>
</ul>
<p>With a loan, you own the car from day one, but the EMI, insurance, fuel and servicing all come out of take-home pay, after tax.</p>

<h2 id="values">The values you're taxed on</h2>
<p>For a car owned or hired by your employer and used for both work and personal trips, from 1 April 2026:</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Who pays the running costs</th><th scope="col">Up to 1.6 litres, or electric</th><th scope="col">Above 1.6 litres</th></tr></thead><tbody>
<tr><th scope="row">The company</th><td data-l="Up to 1.6 litres, or electric">₹5,000 a month</td><td data-l="Above 1.6 litres">₹7,000 a month</td></tr>
<tr><th scope="row">You, for personal use</th><td data-l="Up to 1.6 litres, or electric">₹2,000 a month</td><td data-l="Above 1.6 litres">₹3,000 a month</td></tr>
</tbody></table></div>
<p>Add ₹3,000 a month if the company also provides a driver. These values replaced the old ₹1,800 and ₹2,400 this year. Read more in <a href="/guides/company-car-perquisite-value-2026/">Company car perquisite value from April 2026</a>.</p>

<h2 id="example">The example: Neha's car</h2>
<p>Neha is 34, works in Bengaluru and is in the 30% tax slab. Her company offers a car lease, and she's looking at a car costing {_inr(S['price'])} on the road, with an engine under 1.6 litres. She compares:</p>
<ul>
  <li><strong>The lease:</strong> {_inr(S['rental'])} a month for {S['years']} years, including GST, insurance and servicing. Fuel of {_inr(S['fuel'])} a month goes through the company. At the end she buys the car for {_inr(S['buyback'])}.</li>
  <li><strong>The loan:</strong> {_inr(S['down'])} down and a loan of {_inr(S['price'] - S['down'])} at {S['rate']}% for {S['loanYrs']} years. She pays insurance ({_inr(S['ins'])} a year), servicing ({_inr(S['maint'])} a year) and fuel herself.</li>
</ul>
<p>Either way, she expects the car to lose {S['dep']}% of its value a year, and money she doesn't spend earns {S['ret']}% a year. Neha is an example; use your own numbers in the calculator.</p>

<h2 id="result">Her result, number by number</h2>
<h3>Leasing saves her {_L(B['diff'])} over {S['years']} years</h3>
<p>That counts everything: what she pays each month, the down payment, the buy-back price, the car's value at the end (about {_L(B['car'])} under both options), and what the money she doesn't spend would earn.</p>
<h3>Out of take-home pay: {_inr(B['outL'])} a month with the lease, {_inr(B['outB'])} with the loan</h3>
<p>The lease rental and fuel come to {_inr(S['rental'] + S['fuel'])} a month, but because they come out of pre-tax pay, her take-home drops by much less. With the loan, the EMI of {_inr(B['emi'])} plus insurance, servicing and fuel all come from take-home, and she also pays {_L(S['down'])} up front.</p>
<h3>Tax saved: {_L(B['taxNet'])}</h3>
<p>She saves {_L(B['taxSaved'])} in tax on the rental and fuel over {S['years']} years, and pays {_inr(B['perkTax'])} in tax on the car's ₹5,000-a-month value. That net saving is most of the lease's advantage.</p>
<h3>The lease stops winning at a rental of about {_inr(round(G['be'] / 100) * 100)} a month</h3>
<p>If her company's quote were higher than that, the loan would cost less. It's the most useful number to check against the quote you get.</p>

<h2 id="changes">What changes the answer</h2>
<h3>Your tax slab</h3>
<p>The lease's advantage comes almost entirely from tax, so it shrinks fast in lower slabs. Neha's numbers at each slab:</p>
<div class="g-scroll"><table class="g-tbl"><thead><tr><th scope="col">Tax slab</th><th scope="col">Over {S['years']} years</th></tr></thead><tbody>{sl_rows}</tbody></table></div>
<p>The car rules are the same under the old and new regimes, but the slab rates differ, so check which slab your top rupee of salary falls in under the regime you file in.</p>
<h3>Buying the car at the end, or handing it back</h3>
<p>If Neha hands the car back, the lease is only {_L(G['ret']['diff'])} ahead: with the loan she'd own a car worth about {_L(B['car'])}. A lease you hand back is closer to renting a car than buying one.</p>
<h3>Paying fuel yourself</h3>
<p>If fuel doesn't go through the company, the car's taxable value drops to ₹2,000 a month, but fuel comes out of take-home pay. For Neha, the lease is still {_L(G['self']['diff'])} ahead, a little less than before.</p>
<h3>A bigger engine</h3>
<p>Above 1.6 litres, the value is ₹7,000 a month. With the same rental, the lease is {_L(G['big']['diff'])} ahead.</p>
<h3>Leaving the job early</h3>
<p>Most schemes charge to close the lease early. If Neha left after 2 years, paid a {_inr(S['exitCharge'])} closure charge and bought the car for {_inr(S['exitPrice'])}, the lease would still be {_L(G['exit']['diff'])} ahead. If she had to hand it back instead, that falls to {_L(G['exitReturn']['diff'])}. Try your own exit terms in the calculator.</p>

<h2 id="ask">Questions to ask before you sign</h2>
<ol class="g-check">
  <li>What does the rental include: GST, insurance, servicing, tyres, roadside help?</li>
  <li>Can fuel and a driver go through the company too, and what bills do you need to give?</li>
  <li>What's the buy-back price at the end, and does the transfer cost extra?</li>
  <li>What happens if you leave the company, and what are the early closure charges?</li>
  <li>Is there a limit on how far you can drive, and who pays for accident repairs?</li>
</ol>
<p class="g-cta"><a class="btn" href="/company-car-lease-vs-loan/">Compare lease and loan</a></p>

<h2 id="method">How these numbers were worked out</h2>
<p>Every figure comes from the same calculation as the <a href="/company-car-lease-vs-loan/">Car Lease vs Car Loan Calculator</a>, run on Neha's numbers. Tax is at her slab plus 4% cess, without surcharge. Insurance and servicing are spread evenly over the months. The car's taxable values are from Rule 15 of the Income-tax Rules, 2026, which apply from 1 April 2026 under both regimes. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This guide is for information and education. It isn't financial or tax advice. Check your company's car policy and, for a big decision, consider speaking to a qualified adviser.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "Company Car Lease vs Car Loan in India: How to Decide (2026-27) | Salarist", "Company car lease or car loan?", body, "Car lease vs car loan")

def guide_perk():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_car_numbers.js")]))
    S, B, O, N = G["S"], G["base"], G["OLD"], G["PERK"]
    path = "/guides/company-car-perquisite-value-2026/"
    def yr_tax(v, slab): return v * 12 * slab / 100 * 1.04
    rows = "".join(f"<tr><th scope=\"row\">{s}% slab</th><td data-l=\"Up to 1.6 litres, or electric\">{_inr(yr_tax(5000, s))} (was {_inr(yr_tax(1800, s))})</td><td data-l=\"Above 1.6 litres\">{_inr(yr_tax(7000, s))} (was {_inr(yr_tax(2400, s))})</td></tr>" for s in (5, 20, 30))
    extra = (5000 - 1800) * 12 * S["years"] * 0.30 * 1.04
    toc = [("short-answer", "The short answer"), ("table", "Old and new values"), ("tax", "What it means for your tax"), ("lease", "Is a car lease still worth it?"),
           ("ev", "Electric cars"), ("check", "What to check on your payslip"), ("method", "Sources")]
    body = guide_head(path, "From 1 April 2026, the taxable value of a company car used for personal trips went up for the first time in years: from ₹1,800 to ₹5,000 a month for smaller cars, and from ₹2,400 to ₹7,000 for bigger ones. Here's what changed, what it costs you in tax, and whether a car lease still makes sense.",
                      "A car with a price tag showing a rising value").replace("TYPE_LINE", f"<span>Written for tax year {TAX_YEAR}</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>Under Rule 15 of the Income-tax Rules, 2026, a car owned or hired by your employer and used for both work and personal trips is valued at <strong>₹5,000 a month</strong> (engine up to 1.6 litres, or electric) or <strong>₹7,000 a month</strong> (above 1.6 litres) when the company pays the running costs. That's added to your taxable salary.</p>
<p>In the 30% slab, that's about <strong>{_inr(yr_tax(5000, 30))} of tax a year</strong> for a smaller car, up from {_inr(yr_tax(1800, 30))}. It's more, but for most people a car lease still saves far more than it costs.</p>
<p class="g-cta"><a class="btn" href="/company-car-lease-vs-loan/">Check your car lease</a></p>

<h2 id="table">Old and new values</h2>
<p>For a car owned or hired by the employer and used partly for personal purposes, a month:</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Situation</th><th scope="col">Up to 1.6 litres, or electric</th><th scope="col">Above 1.6 litres</th></tr></thead><tbody>
<tr><th scope="row">Company pays the running costs</th><td data-l="Up to 1.6 litres, or electric"><strong>₹5,000</strong> (was ₹1,800)</td><td data-l="Above 1.6 litres"><strong>₹7,000</strong> (was ₹2,400)</td></tr>
<tr><th scope="row">You pay the running costs for personal use</th><td data-l="Up to 1.6 litres, or electric"><strong>₹2,000</strong> (was ₹600)</td><td data-l="Above 1.6 litres"><strong>₹3,000</strong> (was ₹900)</td></tr>
<tr><th scope="row">Driver provided by the company</th><td data-l="Up to 1.6 litres, or electric"><strong>+₹3,000</strong> (was ₹900)</td><td data-l="Above 1.6 litres"><strong>+₹3,000</strong> (was ₹900)</td></tr>
</tbody></table></div>
<p>The new values come from Rule 15 of the Income-tax Rules, 2026, notified on 20 March 2026 under the Income-tax Act, 2025. The old ones were in Rule 3 of the Income-tax Rules, 1962, and hadn't changed in years.</p>

<h2 id="tax">What it means for your tax</h2>
<p>The value is added to your salary, so you pay tax on it at your slab rate plus 4% cess. Tax a year when the company pays the running costs:</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Your slab</th><th scope="col">Up to 1.6 litres, or electric</th><th scope="col">Above 1.6 litres</th></tr></thead><tbody>{rows}</tbody></table></div>
<p>This applies under both the old and new regimes. Surcharge, for very high incomes, isn't included.</p>

<h2 id="lease">Is a car lease still worth it?</h2>
<p>For most people in the higher slabs, yes. The rental and running costs you pay through the company still come out of pre-tax pay, and those are usually many times larger than the ₹5,000 or ₹7,000 you're taxed on.</p>
<p>In our worked example, a {_L(S['price'])} car leased for {S['years']} years at {_inr(S['rental'])} a month in the 30% slab, the new values add about <strong>{_L(extra)} of tax over the lease</strong> compared with the old ones. The lease still comes out <strong>{_L(B['diff'])} ahead</strong> of buying on a loan. See the full example in <a href="/guides/company-car-lease-vs-car-loan/">Company car lease or car loan?</a></p>
<p>The higher values matter most for cheaper cars and lower slabs, where the tax saved was small to begin with. Run your own quote through the calculator before you sign.</p>

<h2 id="ev">Electric cars</h2>
<p>The new rules put electric cars in the lower band, with cars up to 1.6 litres: ₹5,000 a month if the company pays the running costs, or ₹2,000 if you do. Charging at home can usually go through the company like fuel; check your car policy.</p>

<h2 id="check">What to check on your payslip</h2>
<ol class="g-check">
  <li>The car's value should appear as a perquisite in your salary, at ₹5,000, ₹7,000, ₹2,000 or ₹3,000 a month, plus ₹3,000 with a driver.</li>
  <li>If it still shows ₹1,800 or ₹2,400 for months from April 2026, ask payroll: you may owe more tax at year end.</li>
  <li>The lease rental and running costs should be shown as deductions from your CTC, not as taxable pay.</li>
  <li>Your Form 130 (the new name for Form 16) at the end of the tax year should show the same value.</li>
</ol>
<p class="g-cta"><a class="btn" href="/company-car-lease-vs-loan/">Compare lease and loan</a></p>

<h2 id="method">Sources</h2>
<p>Rule 15 of the Income-tax Rules, 2026, notified on 20 March 2026 and in force from 1 April 2026, from the <a href="https://www.incometax.gov.in/" rel="noopener">Income Tax Department</a>; earlier values from Rule 3 of the Income-tax Rules, 1962. Tax worked out at the slab rate plus 4% cess. Figures for the lease come from the <a href="/company-car-lease-vs-loan/">Car Lease vs Car Loan Calculator</a>. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article covers cars owned or hired by your employer, the usual car lease setup. If you own the car and your employer only pays its running costs, different rules apply. This isn't tax advice; check with your payroll team or a tax adviser.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "Company Car Perquisite Value 2026: New ₹5,000/₹7,000 Rules Explained | Salarist", "Company car perquisite value from April 2026", body, "Car perquisite value 2026")

def guide_months():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_leave_more_numbers.js")]))
    M = G["months"]
    path = "/guides/best-months-for-a-week-long-break-2027/"
    rows = "".join(f"<tr><td class=\"nw\"><b>{m['month']}</b></td><td data-l=\"Break\">{m['len']} days, {_span(m['from'], m['to'])}</td><td data-l=\"Leave needed\"><b>{m['leave']} day{'s' if m['leave'] != 1 else ''}</b></td><td data-l=\"Holidays in it\">{' and '.join(m['holidays']) if m['holidays'] else 'None'}</td></tr>" for m in M)
    best = sorted(M, key=lambda m: (m["leave"], -m["len"]))
    three = [m for m in M if m["leave"] == 3]
    def leave_on(m): return ", ".join(_d(d, False) for d in m["leaveDays"])
    toc = [("short-answer", "The short answer"), ("months", "Month by month"), ("picks", "The best months, explained"), ("hard", "The hardest months"),
           ("tips", "Before you book"), ("method", "How these dates were worked out")]
    body = guide_head(path, "A week-long break usually costs five days of leave. In some months of 2027, holidays cut that to three. Here's the cheapest week-long break in every month of the year, so you can plan around the months that give you the most time off for your leave.",
                      "Twelve month cards with three spring months highlighted for a week-long break").replace("TYPE_LINE", "<span>DoPT holiday list of 16 Jul 2026</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>For a 9-day break (two weekends and the week between), the best months in 2027 are <strong>{' and '.join(m['month'] for m in three)}</strong>, which need only <strong>3 days of leave</strong>. <strong>April</strong> gives the longest: {M[3]['len']} days for {M[3]['leave']} days of leave. {', '.join(m['month'] for m in M if m['leave'] == 5)} have no weekday holidays to help, so a week off costs the full 5 days.</p>
<p>These are for a Monday-to-Friday week and the central government list. Your company's list may differ, so check yours in the planner.</p>
<p class="g-cta"><a class="btn" href="/leave-planner-2027/">Plan my 2027 leave</a></p>

<h2 id="months">Month by month</h2>
<p>The 9-day break in each month that needs the fewest leave days:</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Month</th><th scope="col">Break</th><th scope="col">Leave needed</th><th scope="col">Holidays in it</th></tr></thead><tbody>{rows}</tbody></table></div>

<h2 id="picks">The best months, explained</h2>
<h3>March: Holi and Good Friday</h3>
<p>Holi falls on Tuesday 23 March and Good Friday on 26 March. Take leave on {leave_on(M[2])} for {_span(M[2]['from'], M[2]['to'])}. If you get restricted holidays, Holika Dahan on Monday 22 March cuts it to 2 days: see <a href="/guides/restricted-holidays-2027/">which restricted holidays to pick</a>.</p>
<h3>April: Ram Navami and Mahavir Jayanti</h3>
<p>Ram Navami is on Thursday 15 April and Mahavir Jayanti on Monday 19 April. Take leave on {leave_on(M[3])} for {M[3]['len']} days off, {_span(M[3]['from'], M[3]['to'])}.</p>
<h3>May: Bakrid and Buddha Purnima</h3>
<p>Id-ul-Zuha falls on Monday 17 May and Buddha Purnima on Thursday 20 May. Take leave on {leave_on(M[4])} for {_span(M[4]['from'], M[4]['to'])}, a good time for the hills before the summer rush peaks.</p>
<h3>Also good: January, June, August and October</h3>
<p>Each needs 4 days of leave for 9 days off, around Republic Day, Muharram, Janmashtami and Diwali. The Diwali week ({_span(M[9]['from'], M[9]['to'])}) is the most popular, so apply early.</p>

<h2 id="hard">The hardest months</h2>
<p>{', '.join(m['month'] for m in M if m['leave'] == 5)} need the full 5 days for a week off. Holidays in these months, like Guru Nanak's Birthday and Christmas, fall on a weekend in 2027. If you want a break then, a long weekend with one or two days of leave may be better value. The <a href="/guides/long-weekends-2027/">long weekends guide</a> lists them all.</p>

<h2 id="tips">Before you book</h2>
<ol class="g-check">
  <li>Check your company's 2027 holiday list and update the planner.</li>
  <li>Apply early for March, April and Diwali: everyone wants the same weeks.</li>
  <li>Book travel early too. Fares around these breaks rise as they approach.</li>
  <li>Some employers count weekends and holidays between leave days as leave (a sandwich rule). Check your policy.</li>
  <li>Plan the cost in your <a href="/budget-planner/">budget planner</a> as a yearly travel line.</li>
</ol>
<p class="g-cta"><a class="btn" href="/leave-planner-2027/">Find your best breaks</a></p>

<h2 id="method">How these dates were worked out</h2>
<p>Every break comes from the same calculation as the <a href="/leave-planner-2027/">2027 leave planner</a>: for each month, every 9-day window starting in that month is checked, and the one needing the fewest leave days wins; days off on either side are added. It uses the central government list with a Monday-to-Friday week, from the DoPT office memorandum dated 16 July 2026. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">Holiday dates for some festivals depend on the moon and may be changed by official notification. Always check your own employer's list before booking.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "Best Months for a Week-Long Break in 2027 (India Holiday Planner) | Salarist", "Best months for a week-long break in 2027", body, "Best months for a break 2027")

def guide_sixday():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_leave_more_numbers.js")]))
    F, S1, A = G["five"], G["sunOnly"], G["alt"]
    path = "/guides/long-weekends-2027-six-day-week/"
    def brk(b): return f"{b['len']} days, {_span(b['from'], b['to'])}"
    def lv(n): return f"{n} day{'s' if n != 1 else ''} of leave"
    def leave_on(b): return ", ".join(_d(d, False) for d in b["leaveDays"])
    def vrows(p): return "".join(f"<tr><td data-l=\"Break\">{brk(b)}</td><td data-l=\"Take leave on\">{leave_on(b)}</td><td data-l=\"Around\">{' and '.join(b['holidays'])}</td></tr>" for b in p["value"])
    def plan(p): return "".join(f"<li>{brk(b)}: {lv(b['leave'])}</li>" for b in p["breaks"])
    toc = [("short-answer", "The short answer"), ("sunday", "If only Sunday is off"), ("alternate", "If the 2nd and 4th Saturdays are off"),
           ("compare", "How it compares with a five-day week"), ("tips", "Making the most of it"), ("method", "How these dates were worked out")]
    body = guide_head(path, "Most long-weekend lists assume Saturdays off. If you work six days a week, or every other Saturday, the picture is very different. Here are the 2027 breaks that work for you, with the leave each one needs.",
                      "Two weeks of day tiles with only Sunday, or Sunday and a Saturday, off").replace("TYPE_LINE", "<span>DoPT holiday list of 16 Jul 2026</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<ul>
  <li><strong>Sunday only off:</strong> there are no free long weekends in 2027. The best deals need 1 day of leave for a 3-day weekend, such as Good Friday ({brk(S1['value'][2])}, leave on {leave_on(S1['value'][2])}). With 8 days of leave you can have <strong>{S1['plan8']['daysOff']} days off</strong> in breaks.</li>
  <li><strong>2nd and 4th Saturdays off:</strong> one free long weekend, Good Friday, {brk(A['long'][0])}. With 8 days of leave, <strong>{A['plan8']['daysOff']} days off</strong>.</li>
  <li>For comparison, a Monday-to-Friday week gets {len(F['long'])} free long weekends and {F['plan8']['daysOff']} days off for the same 8 days of leave.</li>
</ul>
<p class="g-cta"><a class="btn" href="/leave-planner-2027/">Plan with my week</a></p>

<h2 id="sunday">If only Sunday is off</h2>
<p>Every Saturday is a working day, so a holiday on a Friday or Monday gives a 2-day break, not 3. These breaks give the most days off for the leave:</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Break</th><th scope="col">Take leave on</th><th scope="col">Around</th></tr></thead><tbody>{vrows(S1)}</tbody></table></div>
<h3>8 days of leave: {S1['plan8']['daysOff']} days off</h3>
<ul>{plan(S1['plan8'])}</ul>

<h2 id="alternate">If the 2nd and 4th Saturdays are off</h2>
<p>Many banks and some offices give the second and fourth Saturdays off. That helps in the months where a holiday lands next to one of them:</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Break</th><th scope="col">Take leave on</th><th scope="col">Around</th></tr></thead><tbody>{vrows(A)}</tbody></table></div>
<h3>8 days of leave: {A['plan8']['daysOff']} days off</h3>
<ul>{plan(A['plan8'])}</ul>

<h2 id="compare">How it compares with a five-day week</h2>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Your week</th><th scope="col">Free long weekends</th><th scope="col">Days off with 8 days of leave</th><th scope="col">With 12 days of leave</th></tr></thead><tbody>
<tr><th scope="row">Monday to Friday</th><td data-l="Free long weekends">{len(F['long'])}</td><td data-l="Days off with 8 days of leave">{F['plan8']['daysOff']}</td><td data-l="With 12 days of leave">{F['plan12']['daysOff']}</td></tr>
<tr><th scope="row">2nd and 4th Saturdays off</th><td data-l="Free long weekends">{len(A['long'])}</td><td data-l="Days off with 8 days of leave">{A['plan8']['daysOff']}</td><td data-l="With 12 days of leave">{A['plan12']['daysOff']}</td></tr>
<tr><th scope="row">Sunday only</th><td data-l="Free long weekends">{len(S1['long'])}</td><td data-l="Days off with 8 days of leave">{S1['plan8']['daysOff']}</td><td data-l="With 12 days of leave">{S1['plan12']['daysOff']}</td></tr>
</tbody></table></div>
<p>Every working Saturday inside a break costs a day of leave, so short breaks of 3 to 5 days around a holiday are your best value. A 9-day break costs at least {S1['week'][0]['leave']} days of leave with only Sunday off, against 3 on a five-day week.</p>

<h2 id="tips">Making the most of it</h2>
<ol class="g-check">
  <li>Aim for breaks around weekday holidays near Sunday: Republic Day, Holi, Good Friday, Ram Navami and Mahavir Jayanti, Bakrid and Buddha Purnima, and Diwali.</li>
  <li>Check whether your restricted or optional holidays can join up with a Sunday. See <a href="/guides/restricted-holidays-2027/">which restricted holidays to pick</a>.</li>
  <li>If your company follows a state holiday list, update the planner with your own holidays.</li>
  <li>Ask whether weekends and holidays between leave days are counted as leave (a sandwich rule).</li>
</ol>
<p>For the five-day-week view, read <a href="/guides/long-weekends-2027/">Long weekends 2027 in India</a> and <a href="/guides/best-months-for-a-week-long-break-2027/">the best months for a week-long break</a>.</p>
<p class="g-cta"><a class="btn" href="/leave-planner-2027/">Find your best breaks</a></p>

<h2 id="method">How these dates were worked out</h2>
<p>Every break comes from the same calculation as the <a href="/leave-planner-2027/">2027 leave planner</a>, which lets you choose a Monday-to-Friday week, Sunday only, or the 2nd and 4th Saturdays off. It uses the central government list from the DoPT office memorandum dated 16 July 2026. The plans pick the set of breaks that gives the most days off for the leave. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">Holiday dates for some festivals depend on the moon and may be changed by official notification. Always check your own employer's list before booking.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "Long Weekends 2027 for Six-Day Week Workers (Sunday Only, Alternate Saturdays) | Salarist", "Long weekends 2027 for six-day weeks", body, "Six-day week 2027")

# ---------------- All tools ----------------
# (group, [(path, name, description, live, status text, [guide paths])])
def catalog():
    L = lambda p: any(u == p for u, _ in LIVE_TOOLS)
    return [
        ("Your time off", [("/leave-planner-2027/", "Leave Planner 2027", "Turn your leave into the longest breaks of 2027, around central, state or your company's holidays.", True, "",
                            ["/guides/long-weekends-2027/", "/guides/restricted-holidays-2027/", "/guides/best-months-for-a-week-long-break-2027/", "/guides/long-weekends-2027-six-day-week/"])]),
        ("Your pay", [("/ctc-to-in-hand/", "CTC to in-hand, and your hike", "What actually reaches your account each month, under the old and new regimes.", False, "After the 1 Feb 2027 Budget", [])]),
        ("Your loans", [("/prepay-vs-invest/", "Prepay or Invest", "Should extra money go into your home loan or into investments? After tax.", True, "", ["/guides/prepay-home-loan-or-invest/"]),
                        ("/emi-calculator/", "EMI Calculator", "Your EMI, with part-payments at any time and rate changes. Save your plan and carry on later.", L("/emi-calculator/"), "Coming soon", [])]),
        ("Your home", [("/rent-vs-buy/", "Rent or Buy", "Owning against renting and investing the difference, after stamp duty and tax.", True, "",
                        ["/guides/rent-vs-buy/", "/guides/under-construction-vs-ready-to-move/", "/guides/hra-vs-home-loan-tax-benefits/"])]),
        ("Your money", [("/budget-planner/", "Budget Planner", "See what's really left each month, with yearly costs turned into monthly set-asides.", True, "",
                         ["/guides/monthly-budget/", "/guides/budget-on-50000-1-lakh-2-lakh-salary/"])]),
        ("Your car", [("/company-car-lease-vs-loan/", "Car Lease vs Car Loan", "Lease a car through your company or buy it on a loan? After tax, running costs and resale.", L("/company-car-lease-vs-loan/"), "Coming soon",
                       ["/guides/company-car-lease-vs-car-loan/", "/guides/company-car-perquisite-value-2026/"])]),
    ]
QUICK_SOON = ["SIP calculator", "FD, PPF and RD", "Gratuity", "Old vs new regime", "HRA exemption", "Vehicle ownership cost", "Old-to-new section finder"]

def quick_chips():
    live = "".join(f'<a class="qchip" href="{u}">{n}</a>' for u, n in LIVE_TOOLS if u == "/emi-calculator/")
    soon = "".join(f'<span class="qchip off">{n}<small>Soon</small></span>' for n in QUICK_SOON[:5])
    return f'<div class="qchips">{live}{soon}</div>'

def _gshort(t):
    """Short guide title for lists: the part before ': ' or the first '? '."""
    t = t.replace(", with a worked example", "")
    for sep in ("? ", ": "):
        if sep in t: return t.split(sep)[0] + ("?" if sep == "? " else "")
    return t
def _gslug(path): return path.strip("/").split("/")[-1]

def tools_index():
    gtitle = {g[0]: g[1] for g in GUIDES}
    icons = json.load(open(os.path.join(SRC, "partials/icons.json")))
    IC = {"Your time off": "I_CAL", "Your pay": "I_PAY", "Your loans": "I_LOAN", "Your home": "I_HOME", "Your money": "I_WALLET", "Your car": "I_CAR"}
    cards = ""
    for grp, items in sorted(catalog(), key=lambda g: not all(x[3] for x in g[1])):
        for p, n, d, live, st, gl in items:
            guides = [g for g in gl if g in gtitle]
            gl_html = ""
            if guides and live:
                gl_html = ('<div class="tl-g"><b>Guides</b><ul>' + "".join(f'<li><a href="{g}">{H.escape(_gshort(gtitle[g]))}</a></li>' for g in guides[:3]) + "</ul>"
                           + f'<a class="more" href="/guides/#{_gslug(p)}">{"See all " + str(len(guides)) + " guides" if len(guides) > 1 else "See it with all our guides"} →</a></div>')
            head = f'<h3><a href="{p}">{n}</a></h3>' if live else f"<h3>{n}</h3>"
            badge = '<span class="st"><b class="live">Live</b></span>' if live else f'<span class="st"><b>{st}</b></span>'
            cards += f'<div class="tool tl{"" if live else " off"}"><span class="grp"><span class="ic">{icons[IC[grp]]}</span>{grp}</span>{head}<p>{d}</p>{gl_html}{badge}</div>'
    secs = f'<div class="groups" style="margin-top:8px">{cards}</div>'
    soon = "".join(f'<span class="qchip off">{n}<small>Soon</small></span>' for n in QUICK_SOON)
    body = (f'<section class="tool-hero"><div class="wrap"><p class="eyebrow">All tools</p><h1>Every Salarist tool, in one place</h1>'
            f'<p class="lead">Decision tools and calculators for salaried India, grouped by what they help with, with the guides that explain them. All free, all private: everything is calculated on your device.</p></div></section>'
            f'<section style="padding-top:0"><div class="wrap">{secs}'
            f'<h2 class="list-h" id="soon" style="margin:40px 0 14px">Quick calculators on the way</h2><div class="qchips">{soon}</div>'
            f'<p class="hint" style="margin-top:12px">Tax-based calculators follow the 1 February 2027 Union Budget, so their rates are right from day one.</p></div></section>')
    live = [(p, n) for grp, items in catalog() for p, n, d, lv, st, gl in items if lv]
    graph = [{"@type": "CollectionPage", "name": "All Salarist tools", "url": SITE + "/tools/", "inLanguage": "en-IN",
              "mainEntity": {"@type": "ItemList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": SITE + p, "name": n} for i, (p, n) in enumerate(live)]}}]
    return layout("/tools/", "All Tools: Salary, Loan, Home, Car and Leave Calculators for India | Salarist",
                  "Every Salarist tool in one place: leave planner, EMI, prepay or invest, rent or buy, budget planner and car lease vs loan, with the guides that explain them.",
                  body, crumbs=[("/", "Home"), ("/tools/", "All tools")], graph=graph, css=("tool.css",), og="og-home.png")

def guides_index():
    gmap = {g[0]: g for g in GUIDES}
    def card(g):
        p, t, ds, d, im, sec = g
        return f'<a class="g-card" href="{p}">{_pic(im, "")}<span class="k">{sec} · {_date(d)}</span><b>{t}</b><span>{ds}</span></a>'
    secs, used = "", set()
    for grp, items in catalog():
        for tp, n, d, live, st, gl in items:
            gs = [gmap[x] for x in gl if x in gmap]
            if not gs or not live: continue
            used.update(x[0] for x in gs)
            secs += (f'<h2 class="list-h" id="{_gslug(tp)}" style="margin:36px 0 6px;scroll-margin-top:90px">{n}</h2>'
                     f'<p class="hint" style="margin:0 0 14px">{len(gs)} guide{"s" if len(gs) != 1 else ""} · <a href="{tp}">Open the {n} tool</a></p><div class="g-cards">' + "".join(card(g) for g in gs) + "</div>")
    rest = [g for g in GUIDES if g[0] not in used]
    if rest: secs += '<h2 class="list-h" style="margin:36px 0 14px">More guides</h2><div class="g-cards">' + "".join(card(g) for g in rest) + "</div>"
    body = (f'<section class="tool-hero"><div class="wrap"><p class="eyebrow">Guides</p><h1>Guides to the big money decisions</h1>'
            f'<p class="lead">Each guide walks through one decision with a worked example and explains every number the matching tool shows, grouped here by tool. Written for tax year {TAX_YEAR}.</p></div></section>'
            f'<section style="padding-top:0"><div class="wrap">{secs}</div></section>')
    graph = [{"@type": "CollectionPage", "name": "Salarist guides", "url": SITE + "/guides/", "inLanguage": "en-IN",
              "mainEntity": {"@type": "ItemList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": SITE + g[0], "name": g[1]} for i, g in enumerate(GUIDES)]}}]
    return layout("/guides/", "Guides to Salaried Money Decisions in India | Salarist",
                  "Plain-English guides with worked examples for the money and leave decisions salaried Indians face: leave, loans, home, budget and car.",
                  body, crumbs=[("/", "Home"), ("/guides/", "Guides")], graph=graph, css=("tool.css", "guide.css"), og="og-home.png")

# ---------------- Text pages ----------------
def text_page(path, name, title, desc, h1, html_body, updated=True, eyebrow="Salarist"):
    body = f'<div class="wrap page"><p class="eyebrow">{eyebrow}</p><h1>{h1}</h1>' + (f'<p class="updated">Last updated {VERIFIED_TXT}</p>' if updated else "") + f'<div class="prose">{html_body}</div></div>'
    return layout(path, title, desc, body, crumbs=[("/", "Home"), (path, name)])

PAGES = {
"/about/": ("About", "About Salarist — free money and leave tools for salaried India", "Who we are, what Salarist does, how the site is funded, and our promises on privacy and accuracy.", "About Salarist", '''
<p>Salarist builds free decision tools for salaried people in India: when to take leave, whether to prepay a loan or invest, whether to rent or buy, and what your salary really becomes after tax.</p>
<h2>What we promise</h2>
<ul><li><strong>Plain answers.</strong> Each tool ends in a clear verdict, with the working shown.</li>
<li><strong>Official numbers.</strong> Tax slabs, interest rates and holidays come from official sources, labelled with the tax year or date they apply to. <a href="/methodology/">How we check our numbers</a>.</li>
<li><strong>Privacy.</strong> Calculations run in your browser. We don't ask you to sign up and we don't store what you enter.</li></ul>
<h2>How Salarist is funded</h2>
<p>The tools are free. We plan to show a small number of ads and some clearly labelled sponsored links, for example to travel or investment platforms. Sponsors never change what a tool calculates or recommends.</p>
<h2>Not advice</h2>
<p>Salarist gives estimates and comparisons to help you decide. It isn't tax, legal or financial advice. See our <a href="/disclaimer/">disclaimer</a>.</p>
<p>Questions or corrections: <a href="/contact/">contact us</a>.</p>'''),
"/methodology/": ("How we check our numbers", "How we check our numbers — Salarist methodology", "The official sources behind Salarist's tax slabs, interest rates and holiday lists, how often we verify them, and how to report an error.", "How we check our numbers", '''
<p>Money decisions are only as good as the figures behind them. Every rate, slab and date on Salarist comes from an official source, says which tax year or official order it follows, and links to where it came from.</p>
<h2>Our sources</h2>
<ul><li><strong>Income tax:</strong> the Income-tax Act, 2025, the annual Finance Act and Union Budget documents, and the Income Tax Department.</li>
<li><strong>Small savings rates:</strong> quarterly office memoranda from the Ministry of Finance (Department of Economic Affairs).</li>
<li><strong>Holidays:</strong> Department of Personnel and Training (DoPT) orders for central government offices, and state government notifications when we add a state.</li></ul>
<h2>How we verify</h2>
<ul><li>We check each figure against the source document before it goes on the site, never from memory or old articles.</li>
<li>All tools read from one shared set of figures, so a correction reaches every page at once.</li>
<li>Tax tools say which tax year their rules are for, and other tools say which official order or date their figures come from. We re-check everything after each Union Budget and whenever a source changes, and update the label with the figures.</li></ul>
<h2>When we recheck</h2>
<ul><li>Tax: after every Union Budget and Finance Act.</li><li>Small savings rates: every quarter, when the Ministry of Finance announces them.</li><li>Holidays: when the yearly DoPT order is issued, and if any date is changed.</li></ul>
<h2>Terms we use</h2>
<p>From 1 April 2026 the Income-tax Act, 2025 replaced the 1961 Act and uses “tax year” in place of “assessment year” and “previous year”. We use tax year 2026-27 for income earned from 1 April 2026 to 31 March 2027, and we quote section numbers from the 2025 Act.</p>
<h2>Found a mistake?</h2>
<p>Please tell us through our <a href="/contact/">contact page</a>. We check every report and correct confirmed errors quickly.</p>'''),
"/contact/": ("Contact", "Contact Salarist", "How to reach Salarist with questions, corrections or partnership enquiries.", "Contact us", '''
<p>Spotted a wrong figure, have an idea for a tool, or want to work with us? Email us at <strong>contact@salarist.in</strong>.</p>
<p>For corrections, please include the page and the figure you think is wrong, with a link to the official source if you have one.</p>
<p>We can't give personal tax or investment advice by email.</p>'''),
"/privacy/": ("Privacy policy", "Privacy policy — Salarist", "What Salarist collects (very little), what stays on your device, and how ads and hosting affect your privacy.", "Privacy policy", '''
<h2>The short version</h2>
<p>Our tools run in your browser. The numbers you enter, such as your salary, loan or leave, are not sent to us and are not stored. We have no accounts and no sign-up.</p>
<h2>What stays on your device</h2>
<ul><li><strong>Your inputs</strong> are processed in your browser and disappear when you close the page.</li>
<li><strong>Your theme choice</strong> (light or dark) is kept in your browser's session storage for the current tab only, and is cleared when you close it.</li>
<li><strong>Share links</strong> you create contain only the settings you chose. Anyone with the link can see those settings.</li></ul>
<h2>Hosting</h2>
<p>Like every website, our hosting provider automatically records basic technical information when pages are requested, such as IP address, browser type and the page visited, to keep the site running and secure. We don't use this to identify you.</p>
<h2>Analytics</h2>
<p>We don't run analytics at present. If we add them, we'll use a privacy-friendly service that doesn't use cookies or record what you type into our tools, and we'll update this page first.</p>
<h2>Advertising and sponsored links</h2>
<p>We plan to show ads, for example through Google AdSense. Before ads appear, we'll update this page to explain the cookies that ad partners use and how you can control them. Sponsored links take you to other websites, whose own privacy policies apply.</p>
<h2>Contact</h2>
<p>Questions about privacy: <strong>contact@salarist.in</strong>.</p>'''),
"/terms/": ("Terms of use", "Terms of use — Salarist", "The terms that apply when you use Salarist's tools and content.", "Terms of use", '''
<p>By using salarist.in you agree to these terms.</p>
<h2>Using the tools</h2>
<p>You may use our tools and content for personal, non-commercial purposes. Please don't copy the site or its tools in bulk, or try to disrupt how it works.</p>
<h2>Accuracy</h2>
<p>We work hard to keep every figure correct and dated, but rules and rates change and mistakes can happen. Results are estimates. You're responsible for decisions you make, so check important ones with the official source or a qualified adviser. See our <a href="/disclaimer/">disclaimer</a>.</p>
<h2>Links to other sites</h2>
<p>We link to official sources and, in places, to sponsors. We aren't responsible for the content or policies of other websites.</p>
<h2>Our content</h2>
<p>The Salarist name, logo, design and text belong to Salarist. Official data we quote, such as holiday orders and rate notifications, belongs to its publishers.</p>
<h2>Changes</h2>
<p>We may update these terms. The date at the top shows the latest version. These terms are governed by the laws of India.</p>'''),
"/disclaimer/": ("Disclaimer", "Disclaimer — Salarist", "Salarist's tools give estimates for information only and are not tax, legal or financial advice.", "Disclaimer", '''
<p>Salarist provides calculators and decision tools for general information. They are <strong>not tax, legal, investment or financial advice</strong>, and Salarist is not a registered adviser.</p>
<ul><li>Results are estimates based on the figures you enter and the official rates we show, for the tax year or date stated. Your actual outcome can differ.</li>
<li>Holiday lists follow official orders. Your employer's holiday policy decides the leave you can actually take, and some festival dates depend on the moon and can shift.</li>
<li>Tax results simplify some rules. For your own return, use the Income Tax Department's tools or consult a chartered accountant.</li>
<li>Investment returns are never guaranteed. Past or assumed returns don't predict future ones.</li></ul>
<h2>Ads and sponsored links</h2>
<p>We may earn money from ads and from sponsored links, which are always labelled. This never changes what our tools calculate.</p>'''),
}

def page_404():
    body = '''<div class="wrap page"><p class="eyebrow">Error 404</p><h1>We couldn't find that page</h1><div class="prose">
<p>The link may be old, or the tool may not be live yet.</p>
<p><a class="btn" href="/leave-planner-2027/">Plan your 2027 leave</a></p><p><a href="/">Go to the home page</a></p></div></div>'''
    return layout("/404.html", "Page not found — Salarist", "This page doesn't exist on Salarist.", body, noindex=True)

# ---------------- Write ----------------
def write(path, content):
    out = os.path.join(DIST, path.strip("/"), "index.html") if path.endswith("/") else os.path.join(DIST, path.strip("/"))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8").write(content)

def main():
    if os.path.exists(DIST): shutil.rmtree(DIST)
    shutil.copytree(os.path.join(SRC, "assets"), os.path.join(DIST, "assets"), ignore=shutil.ignore_patterns("*.map"))
    shutil.copy(os.path.join(SRC, "favicon.svg"), DIST)
    for f in (".htaccess", "robots.txt", "site.webmanifest"): shutil.copy(os.path.join(SRC, f), DIST)
    write("/", home())
    write("/leave-planner-2027/", leave_planner())
    write("/prepay-vs-invest/", prepay_page())
    write("/rent-vs-buy/", rentbuy_page())
    write("/budget-planner/", budget_page())
    if CAR_LIVE: write("/company-car-lease-vs-loan/", car_page())
    if EMI_LIVE: write("/emi-calculator/", emi_page())
    write("/guides/", guides_index())
    write("/tools/", tools_index())
    write("/guides/rent-vs-buy/", guide_rentbuy())
    write("/guides/long-weekends-2027/", guide_leave())
    write("/guides/monthly-budget/", guide_budget())
    write("/guides/prepay-home-loan-or-invest/", guide_prepay())
    write("/guides/under-construction-vs-ready-to-move/", guide_uc())
    write("/guides/hra-vs-home-loan-tax-benefits/", guide_hra())
    write("/guides/restricted-holidays-2027/", guide_rh())
    write("/guides/budget-on-50000-1-lakh-2-lakh-salary/", guide_budget_tiers())
    write("/guides/company-car-lease-vs-car-loan/", guide_car())
    write("/guides/company-car-perquisite-value-2026/", guide_perk())
    write("/guides/best-months-for-a-week-long-break-2027/", guide_months())
    write("/guides/long-weekends-2027-six-day-week/", guide_sixday())
    for p, (name, title, desc, h1, b) in PAGES.items(): write(p, text_page(p, name, title, desc, h1, b))
    write("/404.html", page_404())
    urls = [("/", "1.0"), ("/tools/", "0.6"), ("/leave-planner-2027/", "0.9"), ("/prepay-vs-invest/", "0.9"), ("/rent-vs-buy/", "0.9"), ("/guides/", "0.6"), ("/guides/rent-vs-buy/", "0.8"), ("/guides/long-weekends-2027/", "0.8"), ("/guides/monthly-budget/", "0.8"), ("/budget-planner/", "0.9"), ("/guides/prepay-home-loan-or-invest/", "0.8"), ("/guides/under-construction-vs-ready-to-move/", "0.7"), ("/guides/hra-vs-home-loan-tax-benefits/", "0.7"), ("/guides/restricted-holidays-2027/", "0.7"), ("/guides/budget-on-50000-1-lakh-2-lakh-salary/", "0.7"), ("/guides/company-car-lease-vs-car-loan/", "0.8"), ("/guides/company-car-perquisite-value-2026/", "0.7"), ("/guides/best-months-for-a-week-long-break-2027/", "0.7"), ("/guides/long-weekends-2027-six-day-week/", "0.7")] + ([("/company-car-lease-vs-loan/", "0.9")] if CAR_LIVE else []) + ([("/emi-calculator/", "0.9")] if EMI_LIVE else []) + [(p, "0.3") for p in PAGES]
    # lastmod: the date each page's content last changed. A page's date moves only when its HTML changes
    # (ignoring the ?v= cache-busting hashes), tracked in src/data/lastmod.json.
    import hashlib, datetime
    lm_file = os.path.join(SRC, "data", "lastmod.json")
    lm = json.load(open(lm_file)) if os.path.exists(lm_file) else {}
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5, minutes=30))).date().isoformat()
    for u, _ in urls:
        html = open(os.path.join(DIST, u.strip("/"), "index.html") if u != "/" else os.path.join(DIST, "index.html"), encoding="utf-8").read()
        h = hashlib.sha256(re.sub(r"\?v=[0-9a-f]+", "", html).encode()).hexdigest()[:16]
        if lm.get(u, {}).get("hash") != h: lm[u] = {"hash": h, "date": today}
    json.dump(lm, open(lm_file, "w"), indent=1, sort_keys=True)
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(
        f"  <url><loc>{SITE}{u}</loc><lastmod>{lm[u]['date']}</lastmod><priority>{pr}</priority></url>\n" for u, pr in urls) + "</urlset>\n"
    open(os.path.join(DIST, "sitemap.xml"), "w").write(sm)
    print("built", sum(len(fs) for _, _, fs in os.walk(DIST)), "files")

if __name__ == "__main__":
    main()
