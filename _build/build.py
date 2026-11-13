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
            f'<span class="badge ok">{CHECK}{verified_text} · <a href="#sources">Sources</a></span></div>')

LIVE_TOOLS = [("/leave-planner-2027/", "Leave Planner 2027"), ("/prepay-vs-invest/", "Prepay or Invest"), ("/rent-vs-buy/", "Rent or Buy")]
MENU_EXTRA = []   # extra phone-menu tools for review builds
NAV = [("/#tools", "Tools"), ("/leave-planner-2027/", "Leave planner"), ("/methodology/", "How we check")]

def ld(obj): return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "</script>"

def breadcrumbs_ld(crumbs):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + u} for i, (u, n) in enumerate(crumbs)]}

def faq_ld(faqs):
    return {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": re.sub("<[^>]+>", "", a)}} for q, a in faqs]}

def faq_html(faqs):
    return '<div class="faq">' + "".join(f"<details><summary>{H.escape(q)}</summary><p>{a}</p></details>" for q, a in faqs) + "</div>"

def layout(path, title, desc, body, crumbs=None, graph=None, css=(), js=(), og="og-home.png", og_title=None, noindex=False, head_extra=""):
    graph = list(graph or [])
    if crumbs: graph.append(breadcrumbs_ld(crumbs))
    canon = SITE + path
    nav = "".join(f'<a href="{u}" class="hide-sm"{" aria-current=\"page\"" if u == path else ""}>{n}</a>' for u, n in NAV)
    crumb_html = ""
    if crumbs:
        items = "".join((f'<li><a href="{u}">{H.escape(n)}</a></li>' if i < len(crumbs) - 1 else f'<li aria-current="page">{H.escape(n)}</li>') for i, (u, n) in enumerate(crumbs))
        crumb_html = f'<div class="wrap"><nav class="crumbs" aria-label="Breadcrumb"><ol>{items}</ol></nav></div>'
    css_links = "".join(f'<link rel="stylesheet" href="/assets/css/{c}?v={ver("assets/css/" + c)}">\n' for c in ("site.css",) + tuple(css))
    js_tags = "".join(f'<script src="/assets/js/{j}?v={ver("assets/js/" + j)}" defer></script>\n' for j in ("site.js",) + tuple(js))
    tools = "".join(f'<li><a href="{u}">{n}</a></li>' for u, n in LIVE_TOOLS)
    menu_tools = "".join(f'<li><a href="{u}"{" aria-current=\"page\"" if u == path else ""}>{n}</a></li>' for u, n in LIVE_TOOLS + MENU_EXTRA)
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
{css_links}<meta property="og:type" content="website">
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
      <ul>{menu_tools}<li><a href="/#tools">All tools and what's coming</a></li></ul>
      <p class="menu-h">Salarist</p>
      <ul><li><a href="/methodology/">How we check our numbers</a></li><li><a href="/about/">About</a></li><li><a href="/contact/">Contact</a></li></ul>
    </div>
  </div>
</header>
<main id="main">
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
      <div><h4>Tools</h4><ul>{tools}<li><span>More tools coming soon</span></li></ul></div>
      <div><h4>Salarist</h4><ul>
        <li><a href="/about/">About</a></li><li><a href="/methodology/">How we check our numbers</a></li><li><a href="/contact/">Contact</a></li>
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
    body = body.replace('<a class="ask primary" href="/leave-planner-2027/">Plan my 2027 leave <span class="soon">Launching soon</span></a>',
                        '<a class="ask primary" href="/leave-planner-2027/">Plan my 2027 leave <span class="soon">New</span></a>')
    body = body.replace('<a class="ask" href="/prepay-vs-invest/">Prepay or invest? <span class="soon">Jan 2027</span></a>', '<a class="ask" href="/prepay-vs-invest/">Prepay or invest? <span class="soon">New</span></a>')
    body = body.replace('<a class="ask" href="/rent-vs-buy/">Rent or buy? <span class="soon">Jan 2027</span></a>', '<a class="ask" href="/rent-vs-buy/">Rent or buy? <span class="soon">New</span></a>')
    body = body.replace('<span class="st"><b>Coming January 2027</b></span>\n      </a>\n      <a class="tool" href="/ctc-to-in-hand/">', f'<span class="st"><b class="live">Live</b> · tax year {TAX_YEAR}</span>\n      </a>\n      <a class="tool" href="/ctc-to-in-hand/">', 1)
    for u in ("/ctc-to-in-hand/",):
        body = body.replace(f'<a class="ask" href="{u}">', '<a class="ask" href="#tools">')
    body = body.replace('<span class="st"><b>Launching soon</b> · next up</span>', f'<span class="st"><b class="live">Live</b> · verified {VERIFIED_TXT}</span>')
    body = body.replace('<span class="st"><b>Coming January 2027</b></span>\n      </a>\n      <a class="tool" href="/rent-vs-buy/">', f'<span class="st"><b class="live">Live</b> · tax year {TAX_YEAR}</span>\n      </a>\n      <a class="tool" href="/rent-vs-buy/">', 1)
    # Tools that aren't built yet are not links (no dead links for Google or visitors)
    def unlink(m):
        return '<div class="tool off">' + m.group(2) + "</div>"
    body = re.sub(r'<a class="tool" href="(/(?:ctc-to-in-hand|budget-planner|company-car-lease-vs-loan)/)">(.*?)</a>', unlink, body, flags=re.S)
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
}
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
    return layout("/rent-vs-buy/", "Rent vs Buy Calculator for India: Which Leaves You Richer? | Salarist",
                  "Should you rent or buy a home? Compare both after stamp duty, EMIs, HRA, tax and the sale, under the old or new regime. Free, private, no sign-up.",
                  body, crumbs=[("/", "Home"), ("/rent-vs-buy/", "Rent vs Buy Calculator")], graph=graph,
                  css=("tool.css",), js=("rent-buy.js",), og="og-rent-vs-buy.png", og_title="Rent or buy a home: which leaves you richer?")

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
    for p, (name, title, desc, h1, b) in PAGES.items(): write(p, text_page(p, name, title, desc, h1, b))
    write("/404.html", page_404())
    urls = [("/", "1.0"), ("/leave-planner-2027/", "0.9"), ("/prepay-vs-invest/", "0.9"), ("/rent-vs-buy/", "0.9")] + [(p, "0.3") for p in PAGES]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(
        f"  <url><loc>{SITE}{u}</loc><lastmod>{VERIFIED}</lastmod><priority>{pr}</priority></url>\n" for u, pr in urls) + "</urlset>\n"
    open(os.path.join(DIST, "sitemap.xml"), "w").write(sm)
    print("built", sum(len(fs) for _, _, fs in os.walk(DIST)), "files")

if __name__ == "__main__":
    main()
