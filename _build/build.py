#!/usr/bin/env python3
"""Salarist static site build: shared layout, SEO tags, structured data, sitemap. Output: dist/"""
import math, hashlib, json, os, re, shutil, subprocess, html as H

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
SIP_LIVE = True   # set False to build without the SIP calculator
if SIP_LIVE: LIVE_TOOLS.append(("/sip-calculator/", "SIP Calculator"))
GRATUITY_LIVE = True   # set False to build without the gratuity calculator
if GRATUITY_LIVE: LIVE_TOOLS.append(("/gratuity-calculator/", "Gratuity Calculator"))
SECTIONS_LIVE = True   # set False to build without the section finder
if SECTIONS_LIVE: LIVE_TOOLS.append(("/income-tax-section-finder/", "Section Finder"))
DEPOSITS_LIVE = True   # set False to build without the FD, PPF and RD calculator
if DEPOSITS_LIVE: LIVE_TOOLS.append(("/fd-ppf-rd-calculator/", "FD, PPF and RD Calculator"))
CAROWN_LIVE = True   # set False to build without the car ownership cost calculator
if CAROWN_LIVE: LIVE_TOOLS.append(("/car-ownership-cost/", "Car Ownership Cost"))
NPS_LIVE = True   # set False to build without the NPS calculator
if NPS_LIVE: LIVE_TOOLS.append(("/nps-calculator/", "NPS Calculator"))
EPF_LIVE = True   # set False to build without the EPF calculator (in review)
if EPF_LIVE: LIVE_TOOLS.append(("/epf-calculator/", "EPF Calculator"))
RETIRE_LIVE = True   # set False to build without the retirement planner (in review)
if RETIRE_LIVE: LIVE_TOOLS.append(("/retirement-planner/", "Retirement Planner"))
EPS_LIVE = True   # set False to build without the EPS pension calculator (in review)
if EPS_LIVE: LIVE_TOOLS.append(("/eps-pension-calculator/", "EPS Pension Calculator"))
QUICK_TOOLS = ["/emi-calculator/", "/sip-calculator/", "/fd-ppf-rd-calculator/", "/gratuity-calculator/", "/income-tax-section-finder/", "/car-ownership-cost/", "/nps-calculator/", "/epf-calculator/", "/eps-pension-calculator/", "/retirement-planner/"]   # simple calculators: shown as chips, not big cards or menu items
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

# ---------------- Search titles and descriptions ----------------
# Rule (agreed 14 Nov): tool and guide pages have no " | Salarist" in the title (Google shows the site name separately);
# titles ≤ 60 characters with the main search phrase first; descriptions ≤ 160 characters. The build stops if a page breaks this.
SEO = {
    "/": ("Salarist: Money and Leave Tools for Salaried India", None),
    "/about/": ("About Salarist: Free Money and Leave Tools", None),
    "/tools/": ("All Salary, Loan, SIP and Leave Calculators for India", "Every Salarist tool in one place: leave planner, EMI, SIP, prepay or invest, rent or buy, budget planner and car lease vs loan, with their guides."),
    "/guides/": ("Money and Leave Guides for Salaried Indians", "Plain-English guides with worked examples for the money and leave decisions salaried Indians face: leave, loans, home, budget, car and investing."),
    "/leave-planner-2027/": ("Leave Planner 2027: Long Weekends and Best Leave Days", None),
    "/prepay-vs-invest/": ("Prepay Home Loan or Invest? Calculator for India", None),
    "/rent-vs-buy/": ("Rent vs Buy Calculator for India: Which Leaves You Richer?", None),
    "/budget-planner/": ("Monthly Budget Planner for Salaried Indians", "See what's really left each month on your salary: yearly costs as monthly set-asides, savings rate, EMI load and emergency fund. Free and private."),
    "/company-car-lease-vs-loan/": ("Car Lease vs Car Loan Calculator for India (2026-27)", "Lease a car through your company or buy it on a loan? Compare both after tax, insurance, fuel and resale, with the 2026 perquisite values. Free."),
    "/emi-calculator/": ("EMI Calculator with Part-Payments and Rate Changes", "Work out your EMI, then plan part-payments of any amount at any time and rate changes. See the interest saved and when the loan closes. Free."),
    "/fd-ppf-rd-calculator/": ("FD, PPF and RD Calculator: Maturity After Tax and TDS", "Work out FD, RD and PPF maturity, the tax on your interest and whether your bank will deduct TDS. Compare all three for the same saving. Free."),
    "/income-tax-section-finder/": ("Income Tax Section Finder: 1961 Act to 2025 Act", "Find the new section number for 80C, 80D, HRA, 24(b), 87A, Form 16 and more under the Income-tax Act, 2025. Checked against the official text."),
    "/gratuity-calculator/": ("Gratuity Calculator under the New Labour Codes", "Work out your gratuity under the new labour codes: the amount, when you become eligible, how much is tax-free and what staying longer adds. Free."),
    "/sip-calculator/": ("SIP Calculator with Step-Up, Goals and Existing Portfolio", "See what your SIP could grow to, or the SIP you need for a goal, with a yearly step-up and your existing portfolio. After tax and inflation. Free."),
    "/guides/rent-vs-buy/": ("Rent or Buy a Home in India? How to Decide, With Example", "How to compare renting and buying a home in India, what each number in the calculator means and what changes the answer, with a worked example."),
    "/guides/long-weekends-2027/": ("Long Weekends 2027 in India: Holiday List and Leave Plan", "Every 2027 central government holiday, the long weekends that need no leave, and the leave days that turn into week-long breaks."),
    "/guides/monthly-budget/": ("How to Make a Monthly Budget on a Salary in India", "A simple way to budget on a salary: start from in-hand pay, plan yearly costs monthly, save first and build an emergency fund. With a worked example."),
    "/guides/prepay-home-loan-or-invest/": ("Prepay Home Loan or Invest? How to Decide, With Example", "How to compare prepaying a home loan with investing the money, after tax, what each number in the calculator means and what changes the answer."),
    "/guides/under-construction-vs-ready-to-move/": ("Under Construction vs Ready to Move: The Real Cost", "What rent plus pre-EMI interest really costs while your flat is built, what each year of delay adds, and how much cheaper it needs to be."),
    "/guides/hra-vs-home-loan-tax-benefits/": ("HRA vs Home Loan Tax Benefits: Which Saves More?", None),
    "/guides/restricted-holidays-2027/": ("Restricted Holidays 2027: Which Two to Pick", None),
    "/guides/budget-on-50000-1-lakh-2-lakh-salary/": ("Budget on ₹50,000, ₹1 Lakh or ₹2 Lakh Salary: 3 Examples", None),
    "/guides/company-car-lease-vs-car-loan/": ("Company Car Lease vs Car Loan in India: How to Decide", None),
    "/guides/company-car-perquisite-value-2026/": ("Company Car Perquisite Value 2026: New ₹5,000/₹7,000 Rules", None),
    "/guides/best-months-for-a-week-long-break-2027/": ("Best Months for a Week-Long Break in 2027 (India)", None),
    "/guides/long-weekends-2027-six-day-week/": ("Long Weekends 2027 for Six-Day and Alternate-Saturday Weeks", None),
    "/guides/how-part-payments-cut-your-home-loan/": ("Home Loan Part-Payment: How Much It Saves You (Example)", "How much a home loan part-payment saves, cutting tenure vs EMI, why earlier is better and what a rate rise does, worked through one ₹50 lakh loan."),
    "/guides/car-lease-new-tax-regime/": ("Car Lease Under the New Tax Regime: Still Worth It?", None),
    "/guides/plan-for-school-fees-and-yearly-costs/": ("How to Plan for School Fees and Other Yearly Costs", None),
    "/guides/how-much-sip-do-you-need/": ("How Much SIP Do You Need? Plan a Goal With Step-Up", None),
    "/guides/step-up-sip/": ("Step-Up SIP: How a 10% Yearly Increase Adds Up", None),
    "/guides/how-mutual-fund-gains-are-taxed/": ("Mutual Fund Tax on Selling: Equity and Debt (2026-27)", None),
    "/guides/how-much-do-you-need-to-retire/": ("How Much Do You Need to Retire? A Worked Example", "How much you need to retire in India, worked through one person's EPF, SIPs and spending: the gap and the extra SIP that closes it."),
    "/guides/25x-rule-retirement-india/": ("25x Rule for Retirement: Does It Work in India?", "The 25 times rule assumes low inflation. With 6% inflation in India, here's the multiple of yearly spending you need to retire."),
    "/guides/transfer-pf-dont-withdraw/": ("PF Transfer on Job Change: Don't Withdraw Your PF", "What withdrawing your PF at a job change costs, how to transfer it with your UAN and Form 13, and what happens to your EPS."),
    "/guides/eps-pension-explained/": ("EPS Pension Explained: Job Changes, Transfer and Claims", "What EPS is, how the pension is worked out under EPS 2026, what happens when you change jobs, and how to claim it with Form 10C or 10D."),
    "/guides/how-much-epf-at-58/": ("How Much Will Your EPF Be at 58? A Worked Example", "What EPF could grow to by 58 at 8.25% interest, where it comes from, and what VPF, capped wages and the rate change. Plus the EPS pension."),
    "/guides/epf-wage-ceiling-25000/": ("EPF Wage Ceiling ₹25,000: What Changes for You", "The EPF wage ceiling rose to ₹25,000 from 17 Sep 2026. What it does to your PF deduction, take-home pay, EPF balance and EPS pension."),
    "/guides/nps-new-exit-rules/": ("NPS Withdrawal Rules 2026: What You Get at 60", "NPS after PFRDA's December 2025 changes: up to 80% lump sum, only 60% tax-free, and what one salaried saver gets at 60."),
    "/guides/employer-nps-14-percent-new-regime/": ("Employer NPS 14% in the New Regime: Is It Worth It?", "How much employer NPS saves at 10%, 20% and 30% slabs under the new regime, the old-regime 10% limit and the ₹7.5 lakh cap."),
    "/guides/nps-80-percent-withdrawal-tax/": ("NPS 80% Lump Sum: Is It Tax-Free? The 60% Rule", "PFRDA allows 80% as a lump sum, but only 60% is tax-free. The tax on the extra 20% for ₹50 lakh to ₹2 crore corpuses."),
    "/guides/nps-vs-ppf-vs-epf/": ("NPS vs PPF vs EPF: Which Is Better for Retirement?", "EPF, PPF and NPS compared on return, risk, lock-in and tax, with ₹1.5 lakh a year for 25 years in each."),
    "/guides/petrol-cng-or-ev-cost-per-km/": ("Petrol vs CNG vs EV: Real Cost per km in India", "What a petrol, CNG and electric car really cost per km with loan, insurance, service and resale, and the distance at which each one wins."),
    "/guides/sip-or-lump-sum-bonus/": ("SIP or Lump Sum: How to Invest Your Bonus", "Invest your Diwali or year-end bonus at once or over 6 to 12 months? What each gives after 10 years, after a fall and after a rise."),
    "/guides/is-gratuity-taxable-20-lakh-limit/": ("Is Gratuity Taxable? The ₹20 Lakh Lifetime Limit", "Gratuity is tax-free up to ₹20 lakh across your career, not per job. How earlier gratuity uses it up, with a job-hopper's numbers."),
    "/guides/fd-rd-or-ppf/": ("FD vs RD vs PPF: Which Is Better After Tax?", "How FDs, RDs and PPF compare after tax at 0%, 20% and 30% slabs, with ₹1.5 lakh a year for 15 years, and which to use for which goal."),
    "/guides/fd-interest-tax-below-50000/": ("Is FD Interest Taxable Below ₹50,000? TDS vs Tax", "FD interest is taxable from the first rupee; ₹50,000 is only the TDS limit. How TDS works, Form 121 and what to do when you file."),
    "/guides/ppf-deposit-by-5-april/": ("PPF Deposit Before 5 April: How Much More You Earn", "PPF pays interest on the lowest balance after the 5th. What depositing by 5 April is worth over 15 years against monthly or late deposits."),
    "/guides/new-income-tax-section-numbers/": ("New Income Tax Section Numbers: 80C, HRA, 24(b) Now", "80C is now section 123, 24(b) is 22, HRA is in Schedule III. The sections salaried people use most under the Income-tax Act, 2025, with regime."),
    "/guides/gratuity-six-month-rule-when-to-resign/": ("When to Resign: The Six-Month Gratuity Rule", "A part-year of more than six months counts as a full year for gratuity. How one day can add a year's gratuity, and how to time your exit."),
    "/guides/are-your-sips-on-track/": ("Are Your SIPs on Track? A Yearly Check in 5 Steps", "How to check once a year if your SIPs will reach your goal, and what to do if you're behind or ahead, with one investor's numbers."),
    "/guides/gratuity-new-labour-codes/": ("Gratuity Calculation Under the New Labour Codes (Example)", "How gratuity works under the labour codes: the formula, the new wage rule, how years are counted, when you qualify and the ₹20 lakh tax-free limit."),
    "/guides/is-rent-really-dead-money/": ("Is Rent Really Dead Money? What Buying Costs You", "Rent isn't the only money you don't get back. Interest, stamp duty, upkeep and selling costs, compared with rent over 12 years."),
    "/guides/prepay-home-loan-early-or-later/": ("Prepay Home Loan Early or Later? What Timing Saves", "What ₹2 lakh prepaid in year 1, 5, 8, 12 or 16 of a home loan saves, why earlier always saves more, and the real reasons to wait."),
}
TITLE_MAX, DESC_MAX = 60, 160
def check_seo():
    """Stop the build if any page's search title or description breaks the rule."""
    bad = []
    for root, _, files in os.walk(DIST):
        if "index.html" not in files: continue
        html = open(os.path.join(root, "index.html"), encoding="utf-8").read()
        t = H.unescape(re.search(r"<title>(.*?)</title>", html, re.S).group(1).strip())
        m = re.search(r'<meta name="description" content="([^"]*)"', html); d = H.unescape(m.group(1)) if m else ""
        page = "/" + os.path.relpath(root, DIST).replace(".", "").strip("/") + "/"
        page = "/" if page == "//" else page
        brand_ok = page == "/" or not page.startswith(("/guides/", "/tools/")) and page not in [u for u, _ in LIVE_TOOLS] or "| Salarist" not in t
        if len(t) > TITLE_MAX: bad.append(f"{page}: title {len(t)} chars: {t}")
        if len(d) > DESC_MAX: bad.append(f"{page}: description {len(d)} chars")
        if not d: bad.append(f"{page}: no description")
        if not brand_ok: bad.append(f"{page}: title has ' | Salarist'")
    if bad: raise SystemExit("SEO check failed:\n  " + "\n  ".join(bad))

def layout(path, title, desc, body, crumbs=None, graph=None, css=(), js=(), og="og-home.png", og_title=None, noindex=False, head_extra="", og_type="website"):
    if path in SEO:
        title = SEO[path][0]
        if SEO[path][1]: desc = SEO[path][1]
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
  <p class="g-callout"><b>Not sure how to read the result?</b> Read our guide, <a href="/guides/prepay-home-loan-or-invest/">Prepay your home loan or invest?</a>, worked through one borrower's numbers. Also read: <a href="/guides/prepay-home-loan-early-or-later/">Prepay now or later? Why the timing matters</a>.</p>
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
if SIP_LIVE: TOOL_CARDS["/sip-calculator/"] = ("SIP Calculator", "What your SIP could grow to, or the SIP you need for a goal. With step-up and your existing portfolio.")
if EMI_LIVE: TOOL_CARDS["/emi-calculator/"] = ("EMI Calculator", "Your EMI, with part-payments at any time and rate changes. Save your plan and carry on later.")
if CAR_LIVE: TOOL_CARDS["/company-car-lease-vs-loan/"] = ("Car Lease vs Car Loan", "Lease a car through your company or buy it on a loan? After tax, running costs and resale.")
# Related tools shown on each tool page (and on its guides): the closest next steps first. Only live tools are shown.
RELATED = {
    "/leave-planner-2027/": ["/budget-planner/", "/sip-calculator/", "/fd-ppf-rd-calculator/"],
    "/prepay-vs-invest/": ["/emi-calculator/", "/rent-vs-buy/", "/sip-calculator/", "/retirement-planner/"],
    "/rent-vs-buy/": ["/emi-calculator/", "/prepay-vs-invest/", "/budget-planner/", "/sip-calculator/"],
    "/budget-planner/": ["/sip-calculator/", "/emi-calculator/", "/retirement-planner/", "/leave-planner-2027/"],
    "/company-car-lease-vs-loan/": ["/car-ownership-cost/", "/emi-calculator/", "/income-tax-section-finder/", "/budget-planner/"],
    "/sip-calculator/": ["/retirement-planner/", "/fd-ppf-rd-calculator/", "/nps-calculator/", "/prepay-vs-invest/"],
    "/emi-calculator/": ["/prepay-vs-invest/", "/rent-vs-buy/", "/car-ownership-cost/", "/budget-planner/"],
    "/fd-ppf-rd-calculator/": ["/sip-calculator/", "/nps-calculator/", "/epf-calculator/", "/retirement-planner/"],
    "/gratuity-calculator/": ["/epf-calculator/", "/eps-pension-calculator/", "/retirement-planner/", "/income-tax-section-finder/"],
    "/income-tax-section-finder/": ["/nps-calculator/", "/gratuity-calculator/", "/fd-ppf-rd-calculator/", "/company-car-lease-vs-loan/"],
    "/car-ownership-cost/": ["/company-car-lease-vs-loan/", "/emi-calculator/", "/budget-planner/"],
    "/nps-calculator/": ["/epf-calculator/", "/retirement-planner/", "/sip-calculator/", "/fd-ppf-rd-calculator/"],
    "/epf-calculator/": ["/eps-pension-calculator/", "/retirement-planner/", "/nps-calculator/", "/gratuity-calculator/"],
    "/eps-pension-calculator/": ["/epf-calculator/", "/retirement-planner/", "/gratuity-calculator/", "/nps-calculator/"],
    "/retirement-planner/": ["/epf-calculator/", "/nps-calculator/", "/sip-calculator/", "/eps-pension-calculator/"],
}
def _tool_index():
    """name, description and guides of every live tool, from catalog()"""
    idx = {}
    for grp, items in catalog():
        for p, n, d, lv, st, gl in items:
            if lv: idx[p] = (n, d, gl)
    return idx
def related(path):
    idx = _tool_index()
    if path in idx: picks = RELATED.get(path, [])
    else:   # a guide: its own tool first, then that tool's related tools
        own = next((p for p, (n, d, gl) in idx.items() if path in gl), None)
        picks = ([own] + RELATED.get(own, [])) if own else list(TOOL_CARDS)
    picks = [p for p in picks if p in idx and p != path][:4]
    cards = "".join(f'<a class="rel" href="{u}"><b>{idx[u][0]}</b><span>{idx[u][1]}</span></a>' for u in picks)
    pop = [p for p in POPULAR if p in idx and p != path and p not in picks]
    chips = "".join(f'<a class="pop" href="{u}">{idx[u][0]}</a>' for u in pop)
    return (f'<section style="padding-top:0"><div class="wrap"><h2 class="list-h">Related tools</h2><div class="rels">{cards}</div>'
            + (f'<h2 class="list-h" style="margin-top:24px">Popular tools</h2><div class="pop-tools">{chips}</div>' if chips else "")
            + f'<p style="margin:12px 0 0"><a href="/tools/">See all tools →</a></p></div></section>')
# Popular tools row under "Related tools" (the main decision tools and most-used calculators).
POPULAR = ["/leave-planner-2027/", "/rent-vs-buy/", "/prepay-vs-invest/", "/budget-planner/", "/sip-calculator/", "/emi-calculator/", "/retirement-planner/", "/company-car-lease-vs-loan/"]

def check_links():
    """Interlinking rules (agreed 14 Nov): every live tool has its own RELATED list, is listed in at least one other tool's list,
    and every guide belongs to a tool in catalog() so its page shows that tool and its related tools. Stops the build otherwise."""
    idx = _tool_index(); bad = []
    for p in idx:
        if p not in RELATED: bad.append(f"{p}: no RELATED list")
        elif not [q for q in RELATED[p] if q in idx]: bad.append(f"{p}: RELATED lists no live tool")
        if not any(p in v for k, v in RELATED.items() if k != p and k in idx): bad.append(f"{p}: no other tool links to it in RELATED")
    for g in GUIDES:
        if not any(g[0] in gl for n, d, gl in idx.values()): bad.append(f"{g[0]}: guide not listed under any tool in catalog()")
    if bad: raise SystemExit("Interlinking check failed:\n  " + "\n  ".join(bad))

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
  <p class="g-callout"><b>New to this decision?</b> Read our guide, <a href="/guides/rent-vs-buy/">Rent or buy a home in India? How to decide</a>. It walks through every number on this page with a worked example. Also read: <a href="/guides/is-rent-really-dead-money/">Is rent really dead money?</a>, <a href="/guides/under-construction-vs-ready-to-move/">Under construction or ready to move?</a> and <a href="/guides/hra-vs-home-loan-tax-benefits/">HRA or home loan tax benefits?</a></p>
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
  <p class="g-callout"><b>New to budgeting?</b> Read our guide, <a href="/guides/monthly-budget/">How to make a monthly budget on a salary in India</a>, worked through one family's numbers. Also read: <a href="/guides/budget-on-50000-1-lakh-2-lakh-salary/">Budgeting on ₹50,000, ₹1 lakh or ₹2 lakh a month</a> and <a href="/guides/plan-for-school-fees-and-yearly-costs/">How to plan for school fees and other yearly costs</a>.</p>
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

def sip_page():
    faqs = [
        ("How is SIP return calculated?",
         "Each monthly instalment grows from the month you invest it until the end. We compound returns monthly so that a full year gives exactly the yearly rate you enter. Some calculators divide the yearly rate by 12 instead, which shows slightly higher numbers for the same rate."),
        ("What is a step-up SIP?",
         "A step-up (or top-up) SIP raises your monthly amount by a fixed percentage every year, usually in line with your pay rise. Even a 10% yearly step-up can make a large difference over 15 to 20 years, because the bigger amounts have time to grow."),
        ("I already have a portfolio. How do I use this?",
         "Choose \"I already invest\" and enter your portfolio's value today and the amount you've put in so far, both shown in your fund app or statement, plus the SIP you'll continue. The calculator grows your existing money and your future SIPs together, and uses what you've put in to work out the tax on your gains."),
        ("How are SIP gains taxed?",
         "For equity mutual funds, gains on units held over 12 months are long-term: gains above ₹1,25,000 in a year are taxed at 12.5% plus cess. Units held 12 months or less are taxed at 20% plus cess. For debt funds bought from 1 April 2023, gains are taxed at your slab rate, however long you hold them."),
        ("What return should I assume?",
         "Use a cautious figure. Equity funds have returned more than fixed deposits over long periods, but returns vary a lot from year to year and aren't guaranteed. The \"what if returns are different\" boxes show how much the answer changes if returns are 2% lower or higher."),
        ("Why save and load a SIP plan?",
         "So you can check every year whether you're on track. Save your plan, and next year load it, update your portfolio value and invested amount from your latest statement, and see what your SIP is now set to reach. The file stays on your device."),
        ("Should I invest or prepay my home loan?",
         "It depends on your loan rate, the return you expect after tax, and how much risk you can take. Our Prepay or Invest calculator compares both, month by month, after tax."),
    ]
    def num(k, label, unit="", mn=0, mx=0, st=1, money=True, rng=True, hint="", cls="", lid=None, hid=None):
        inp = f'<input id="sp-{k}" type="text" inputmode="numeric" autocomplete="off">' if money else f'<input id="sp-{k}" type="number" inputmode="decimal" min="{mn}" max="{mx}" step="{st}">'
        return (f'<div class="fld{(" " + cls) if cls else ""}"><div class="row1"><label for="sp-{k}"{f" id={chr(34)}{lid}{chr(34)}" if lid else ""}>{label}</label><span class="w" id="sp-{k}-w"></span></div>'
                f'<div class="numin">{"<span>₹</span>" if money else ""}{inp}{"" if money else f"<span>{unit}</span>"}</div>'
                + (f'<input type="range" id="sp-{k}-r" min="{mn}" max="{mx}" step="{st}" aria-label="{label}">' if rng else "")
                + (f'<p class="hint"{f" id={chr(34)}{hid}{chr(34)}" if hid else ""}>{hint}</p>' if hint or hid else "") + "</div>")
    body = f"""<section class="tool-hero"><div class="wrap">
  <p class="eyebrow">Your investments</p>
  <h1>SIP calculator, with step-up and your existing investments</h1>
  <p class="lead">See what a monthly SIP could grow to, or how much you need to invest each month for a goal. Add a yearly step-up, start from the portfolio you already have, and see the value after tax and in today's money.</p>
  {badges("Tax rules for tax year " + TAX_YEAR)}
</div></section>

<section style="padding-top:0"><div class="wrap lp rb sp">
  <div class="card lp-setup" aria-label="Your SIP">
    <div><span class="lbl" id="modeLbl">Where are you starting?</span>
      <div class="seg row" role="group" aria-labelledby="modeLbl"><button type="button" data-mode="fresh">Starting fresh</button><button type="button" data-mode="existing">I already invest</button></div></div>
    <div class="adv" id="sp-ex-box" hidden>
      {num("cur", "Portfolio value today", rng=False, hint="The current value of the funds this SIP goes into, from your fund app or statement.")}
      {num("cost", "Invested so far", rng=False, hid="sp-costHint")}
    </div>
    <div><span class="lbl" id="goalLbl">What do you want to know?</span>
      <div class="seg row" role="group" aria-labelledby="goalLbl"><button type="button" data-goal="grow">What my SIP grows to</button><button type="button" data-goal="target">SIP needed for a goal</button></div></div>
    <div id="sp-sip-box">{num("sip", "Monthly SIP", mn=500, mx=200000, st=500, lid="sp-sipLbl")}</div>
    <div class="adv" id="sp-goal-box" hidden>
      {num("target", "Your goal", rng=False, hint="The amount you want at the end, such as ₹1 crore for a child's education.")}
      <label class="chk" for="sp-today" style="border:0;grid-template-columns:22px 1fr"><input type="checkbox" id="sp-today"><span>This amount is in today's money (we'll add inflation)</span></label>
    </div>
    {num("step", "Step-up every year", "%", 0, 25, 1, money=False, hint="Raise your SIP by this much each year, for example with your pay rise. 0 keeps it the same.")}
    {num("lump", "Lump sum at the start", rng=False, lid="sp-lumpLbl", hid="sp-lumpHint")}
    {num("years", "How long", "years", 1, 40, 1, money=False, cls="key")}
    {num("ret", "Expected return", "% a year", 1, 18, 0.5, money=False, hint="Use a cautious figure. Returns aren't guaranteed.")}
    <div><span class="lbl" id="kindLbl">Fund type</span>
      <div class="seg row" role="group" aria-labelledby="kindLbl"><button type="button" data-kind="equity">Equity fund</button><button type="button" data-kind="debt">Debt fund</button></div></div>
    <div class="fld" id="sp-slab-box"><label class="lbl" for="sp-slab" style="margin:0">Your income tax slab</label>
      <select id="sp-slab" class="sel"><option value="0">0%</option><option value="5">5%</option><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option><option value="25">25%</option><option value="30">30%</option></select></div>
    {num("infl", "Inflation", "% a year", 0, 10, 0.5, money=False, hint="To show what your money will be worth in today's rupees.")}
    <p class="grp-h">Your SIP plan</p>
    <div class="actions" style="margin:0"><button type="button" class="btn-sm" id="spSaveBtn">Save my SIP plan</button><button type="button" class="btn-sm" id="spLoadBtn">Load my SIP plan</button><input type="file" id="spFile" accept=".csv,text/csv" hidden></div>
    <p class="hint" style="margin-top:-8px">Saves everything you entered as a small file on your device. Next year, load it, update your portfolio value from your statement, and check you're on track. Nothing is stored on our side.</p>
  </div>

  <div>
    <div class="verdict" id="spVerdict" aria-live="polite"></div>
    <div class="actions">
      <button type="button" class="btn-sm pri" id="spPdf">Download PDF report</button>
      <button type="button" class="btn-sm" id="spXlsx">Download Excel</button>
      <button type="button" class="btn-sm btn-ghost" id="spShare">Copy share link</button>
    </div>
    <p class="status" id="spStatus" role="status"></p>
    <div class="stats">
      <div class="stat"><div class="l">Value at the end</div><div class="n" id="spVal">—</div><div class="h">Before tax</div></div>
      <div class="stat"><div class="l">Total put in</div><div class="n" id="spInv">—</div><div class="h">Including what you already have</div></div>
      <div class="stat"><div class="l">Value after tax</div><div class="n" id="spAfter">—</div><div class="h">If you sell it all at the end</div></div>
      <div class="stat"><div class="l">In today's money</div><div class="n" id="spReal">—</div><div class="h">After tax and inflation</div></div>
    </div>
    <h2 class="list-h">What you put in and what it earns</h2>
    <div id="spSplit"></div>
    <p class="hint">Gains: <b id="spGain">—</b></p>
    <div class="chartbox">
      <h2 class="list-h" style="margin:0 0 4px">Your money over time</h2>
      <p class="hint" style="margin:0 0 10px">The dotted line is what you put in; the gap above it is what your money earns.</p>
      <div id="spChart"></div>
      <div class="legend2"><span><i style="background:var(--brand)"></i>Your plan</span><span id="spLegFlat"><i style="background:var(--leave)"></i>Without step-up</span><span><i style="background:var(--muted)"></i>Put in</span></div>
    </div>
    <h2 class="list-h" id="spSensH">What if returns are different?</h2>
    <div class="sens" id="spSens"></div>
    <a class="next" href="/prepay-vs-invest/"><span class="k">Your next decision</span><b>Have a home loan? See whether to invest this money or prepay the loan</b><span class="h">Prepay or Invest compares both, after tax.</span></a>
    <a class="next" href="/budget-planner/" style="margin-top:12px"><span class="k">Also useful</span><b>Fit the SIP into your monthly budget</b><span class="h">See what's left each month after your savings.</span></a>
    <h2 class="list-h">Assumptions</h2>
    <ul class="notes" id="spNotes"></ul>
  </div>
</div></section>

<section style="padding-top:0"><div class="wrap">
  <h2>Year by year</h2>
  <div class="tbl-wrap calc-wrap" id="spTable"></div>
</div></section>
{related("/sip-calculator/")}
<div class="wrap aff-slot" aria-label="Sponsored"></div>

<section style="padding-top:0"><div class="wrap prose">
  <p class="g-callout"><b>Planning a goal?</b> Read our guide, <a href="/guides/how-much-sip-do-you-need/">How much SIP do you need?</a>, worked through one parent's numbers. Also read: <a href="/guides/step-up-sip/">Step-up SIP</a>, <a href="/guides/how-mutual-fund-gains-are-taxed/">How mutual fund gains are taxed</a>, <a href="/guides/are-your-sips-on-track/">Are your SIPs on track?</a> and <a href="/guides/sip-or-lump-sum-bonus/">SIP or lump sum: what to do with your bonus</a>.</p>
  <h2>How the calculator works</h2>
  <ul>
    <li><strong>Each SIP</strong> goes in at the start of the month and grows at the return you choose until the end. Returns compound monthly so that a year gives exactly that rate.</li>
    <li><strong>Step-up</strong> raises the monthly SIP by your percentage every 12 months.</li>
    <li><strong>If you already invest,</strong> your portfolio grows alongside your new SIPs. What you've put in so far is used as its cost for tax.</li>
    <li><strong>Goal mode</strong> works backwards: it finds the starting SIP that reaches your goal, counting what you already have.</li>
    <li><strong>After tax</strong> assumes you sell everything at the end. <strong>In today's money</strong> takes off inflation.</li>
  </ul>
  <h2>Tax rules used, tax year {TAX_YEAR}</h2>
  <ul>
    <li><strong>Equity mutual funds:</strong> units held over 12 months: gains above ₹1,25,000 a year taxed at 12.5% plus 4% cess. Held 12 months or less: 20% plus cess.</li>
    <li><strong>Debt mutual funds</strong> bought from 1 April 2023: gains taxed at your slab rate plus cess, whatever the holding period.</li>
  </ul>
  <p>We leave out surcharge, exit loads and stamp duty on purchases. Returns aren't guaranteed; mutual fund investments are subject to market risks.</p>
  <h2 id="sources">Sources</h2>
  <p><a href="https://www.incometax.gov.in/" rel="noopener">Income Tax Department</a>: capital gains rates from the Finance (No. 2) Act, 2024, unchanged by Budget 2026, and the treatment of debt fund gains from the Finance Act, 2023. Checked for tax year {TAX_YEAR}; we re-check after every Union Budget. Read <a href="/methodology/">how we check our numbers</a>.</p>
  <h2>Frequently asked questions</h2>
  {faq_html(faqs)}
</div></section>
<div class="rb-bar" id="spBar" hidden><span id="spBarT"></span><button type="button" class="btn-sm pri" id="spBarBtn">See the result</button></div>
"""
    graph = [{"@type": "WebApplication", "name": "SIP Calculator", "url": SITE + "/sip-calculator/", "applicationCategory": "FinanceApplication",
              "operatingSystem": "Any", "browserRequirements": "Requires JavaScript", "isAccessibleForFree": True, "inLanguage": "en-IN",
              "offers": {"@type": "Offer", "price": "0", "priceCurrency": "INR"}, "dateModified": VERIFIED,
              "description": "SIP calculator with yearly step-up, your existing portfolio, a goal mode, value after tax and in today's money, and a plan you can save.", "publisher": {"@id": SITE + "/#org"}},
             faq_ld(faqs)]
    body = add_tips(body, "sp", SP_TIPS)
    return layout("/sip-calculator/", "SIP Calculator with Step-Up, Existing Portfolio and Goal Planner | Salarist",
                  "See what your SIP could grow to, or the SIP you need for a goal. Add a yearly step-up and your existing portfolio, and see the value after tax and inflation. Free, private.",
                  body, crumbs=[("/", "Home"), ("/sip-calculator/", "SIP Calculator")], graph=graph,
                  css=("tool.css",), js=("sip.js",), og="og-sip-calculator.png", og_title="SIP calculator with step-up and your existing investments")

SP_TIPS = [
    ("""<span class="lbl" id="modeLbl">Where are you starting?</span>""", "where you're starting",
     "Starting fresh begins from zero, or from a lump sum. If you already invest, enter your portfolio's value today and what you've put in, and the calculator carries on from there."),
    ("""<label for="sp-cost">Invested so far</label>""", "invested so far",
     "The total you've put in, shown as “invested” or “cost” in your fund app or statement. Tax is on the gain over this amount, so it matters for the after-tax result."),
    ("""<label for="sp-step">Step-up every year</label>""", "step-up",
     "Raises your SIP by this percentage every 12 months. If your SIP is ₹10,000 with a 10% step-up, it becomes ₹11,000 in year 2 and ₹12,100 in year 3."),
    ("""<label for="sp-ret">Expected return</label>""", "the expected return",
     "The average yearly return you expect over the whole period. Equity funds swing a lot from year to year; use a cautious long-term figure and check the what-if boxes."),
    ("""<label for="sp-infl">Inflation</label>""", "inflation",
     "Prices rise over time, so ₹1 crore in 20 years buys much less than ₹1 crore today. We divide by inflation to show the value in today's rupees."),
    ("""<button type="button" class="btn-sm" id="spSaveBtn">Save my SIP plan</button>""", "saving your plan",
     "Downloads a small CSV file with everything you entered. Use Load my SIP plan to bring it back later and update it. The PDF and Excel reports are for reading; the plan file is for loading back here."),
]

def deposits_page():
    faqs = [
        ("Is FD interest tax-free up to ₹50,000?",
         "No. FD and RD interest is taxable from the first rupee, at your slab rate. ₹50,000 (₹1 lakh for senior citizens) is only the limit above which your bank deducts TDS, under section 393(1) of the Income-tax Act, 2025 (old section 194A). If your interest is below it, the bank doesn't deduct anything, but you still add the interest to your income and pay tax on it when you file your return."),
        ("How does TDS on FD interest work?",
         "Each bank adds up the interest on all your FDs and RDs with it for the year. If the total is more than ₹50,000 (₹1 lakh for senior citizens), it deducts 10% of the whole interest, not just the part above the limit. TDS isn't an extra tax: it's credited against the tax you owe. If your slab is higher than 10%, you pay the rest when you file; if your total income is below the taxable limit, you get it back as a refund, or you can give the bank Form 121 (old Form 15G or 15H) so it doesn't deduct TDS at all."),
        ("Does savings account interest count towards the ₹50,000?",
         "No. Banks don't deduct TDS on savings account interest, and it doesn't count towards the ₹50,000 limit, which covers only fixed and recurring deposits. But savings account interest is still taxable income. Under the old regime you can deduct up to ₹10,000 of it a year under section 153(2)(a) (old 80TTA); senior citizens get up to ₹50,000 of all bank and post office interest under section 153(2)(b) (old 80TTB). The new regime has neither deduction."),
        ("Do I pay tax on a cumulative FD every year or at maturity?",
         "Interest on a cumulative (reinvested) FD builds up every year, and banks report and deduct TDS on it year by year. The calculator shows the interest and tax for each year of the deposit, so you can add each year's interest to your return."),
        ("Is PPF better than an FD?",
         "For long-term saving, often yes, because PPF interest is tax-free while FD interest is taxed at your slab. At a 30% slab, a 7% FD earns about 4.8% after tax, against PPF's tax-free 7.1%. But PPF locks your money for 15 years (with limited withdrawals and loans), takes at most ₹1.5 lakh a year, and its rate is reset every quarter. Use the comparison to see the same yearly saving in all three."),
        ("When should I deposit in PPF?",
         "By the 5th of the month. PPF interest is worked out on the lowest balance between the 5th and the end of each month, so money deposited after the 5th earns nothing that month. Depositing your full yearly amount by 5 April earns the most: on ₹1.5 lakh a year for 15 years, about ₹1.2 lakh more than spreading it monthly."),
        ("What is the PPF interest rate now?",
         "7.1% a year for October to December 2026. The Ministry of Finance sets small savings rates every quarter; it kept them unchanged on 30 September 2026. We'll update the calculator when the rate changes."),
        ("Does a tax-saver FD save tax under the new regime?",
         "No. A 5-year tax-saver FD with a scheduled bank counts under section 123 (old 80C), up to ₹1.5 lakh a year, but only under the old regime. Its interest is taxed like any FD's, and you can't break it before 5 years."),
    ]
    def num(k, label, hint="", money=True, pre="₹", lid=None):
        idattr = f' id="{lid}"' if lid else ""
        box = f'<div class="numin"><span>{pre}</span><input id="dp-{k}" type="text" inputmode="{"numeric" if money else "decimal"}" autocomplete="off"></div>'
        return (f'<div class="fld"><div class="row1"><label for="dp-{k}"{idattr}>{label}</label><span class="w" id="dp-{k}-w"></span></div>{box}'
                + (f'<p class="hint">{hint}</p>' if hint else "") + "</div>")
    def small(k, label, unit):
        return f'<div class="fld"><label for="dp-{k}" class="lbl" style="margin:0 0 6px">{label}</label><div class="numin"><input id="dp-{k}" type="text" inputmode="decimal" autocomplete="off"><span>{unit}</span></div></div>'
    body = f"""<section class="tool-hero"><div class="wrap">
  <p class="eyebrow">Your investments</p>
  <h1>FD, PPF and RD calculator, after tax</h1>
  <p class="lead">See what your fixed deposit, recurring deposit or PPF grows to, how much tax you'll pay on the interest, and whether your bank will deduct TDS. Then compare all three for the same saving.</p>
  {badges("PPF rate for Oct–Dec 2026 · Tax rules for tax year " + TAX_YEAR)}
</div></section>

<section style="padding-top:0"><div class="wrap lp rb dp">
  <div class="card lp-setup" aria-label="Your deposit">
    <div><span class="lbl" id="modeLbl">Calculate</span>
      <div class="seg row" role="group" aria-labelledby="modeLbl"><button type="button" data-mode="fd">Fixed deposit</button><button type="button" data-mode="rd">Recurring deposit</button><button type="button" data-mode="ppf">PPF</button></div></div>

    <div id="dp-fd">
      {num("amt", "Amount you deposit")}
      <div class="two">{small("fdRate", "Interest rate", "% a year")}<div></div></div>
      <p class="hint">Your bank's rate for this tenure. Senior citizens usually get about 0.5% more.</p>
      <div class="two">{small("fdY", "Tenure", "years")}{small("fdM", "and", "months")}</div>
      <div><span class="lbl" id="payLbl">Interest</span>
        <div class="seg row" role="group" aria-labelledby="payLbl"><button type="button" data-payout="reinvest">Reinvested</button><button type="button" data-payout="quarterly">Paid quarterly</button><button type="button" data-payout="monthly">Paid monthly</button></div>
        <p class="hint">Reinvested (cumulative) FDs compound every quarter. Monthly payouts are a little lower than a third of the quarterly interest, because you get the money sooner.</p></div>
      <label class="chk" for="dp-taxSaver" style="border:0;grid-template-columns:22px 1fr"><input type="checkbox" id="dp-taxSaver"><span>It's a 5-year tax-saver FD</span></label>
    </div>

    <div id="dp-rd" hidden>
      {num("inst", "Monthly instalment")}
      <div class="two">{small("rdRate", "Interest rate", "% a year")}<div></div></div>
      <p class="hint">Your bank's RD rate. The post office 5-year RD pays 6.7% (Oct–Dec 2026).</p>
      <div class="two">{small("rdY", "Tenure", "years")}{small("rdM", "and", "months")}</div>
    </div>

    <div id="dp-ppf" hidden>
      {num("yearly", "Yearly deposit", "Between ₹500 and ₹1,50,000 a year.")}
      <div class="two">{small("ppfRate", "Interest rate", "% a year")}<div></div></div>
      <p class="hint">7.1% for October to December 2026. The government resets it every quarter.</p>
      <div><span class="lbl" id="whenLbl">When you deposit</span>
        <div class="seg row" role="group" aria-labelledby="whenLbl"><button type="button" data-when="april">All by 5 April</button><button type="button" data-when="monthly">Monthly, by the 5th</button></div></div>
      <div><span class="lbl" id="extLbl">Keep it going after 15 years?</span>
        <div class="seg row" role="group" aria-labelledby="extLbl"><button type="button" data-ext="0">No, close at 15</button><button type="button" data-ext="5">5 more years</button><button type="button" data-ext="10">10 more years</button></div></div>
      <label class="chk" id="dp-stopBox" for="dp-stopAfter15" style="border:0;grid-template-columns:22px 1fr" hidden><input type="checkbox" id="dp-stopAfter15"><span>Stop depositing after 15 years (the balance keeps earning)</span></label>
    </div>

    <h3 class="sub">Your tax</h3>
    <div><span class="lbl" id="regLbl">Tax regime</span>
      <div class="seg row" role="group" aria-labelledby="regLbl"><button type="button" data-regime="new">New (default)</button><button type="button" data-regime="old">Old</button></div></div>
    <div class="two">{small("slab", "Your tax slab", "%")}{small("infl", "Inflation", "% a year")}</div>
    <p class="hint">Your highest slab rate: 0, 5, 10, 15, 20, 25 or 30% under the new regime. Interest is added to your income and taxed at this rate.</p>
    <label class="chk" id="dp-seniorBox" for="dp-senior" style="border:0;grid-template-columns:22px 1fr"><input type="checkbox" id="dp-senior"><span>I'm a senior citizen (60 or older)</span></label>
    <div id="dp-otherBox">{num("other", "Other FD and RD interest at the same bank, a year", "Optional. The ₹50,000 TDS limit counts all your FDs and RDs at one bank together, so add the yearly interest from your other deposits there. Leave out savings account interest: it doesn't count.", lid="dp-otherLbl")}</div>
  </div>

  <div>
    <div class="verdict" id="dpVerdict" aria-live="polite"></div>
    <div class="actions">
      <button type="button" class="btn-sm pri" id="dpPdf">Download PDF report</button>
      <button type="button" class="btn-sm" id="dpXlsx">Download Excel</button>
      <button type="button" class="btn-sm btn-ghost" id="dpShare">Copy share link</button>
    </div>
    <p class="status" id="dpStatus" role="status"></p>
    <div class="stats">
      <div class="stat"><div class="l">You put in</div><div class="n" id="dpPut">—</div><div class="h">Your deposits</div></div>
      <div class="stat"><div class="l">Interest</div><div class="n" id="dpInt">—</div><div class="h">Before tax</div></div>
      <div class="stat"><div class="l">Tax on interest</div><div class="n" id="dpTax">—</div><div class="h" id="dpTaxH"></div></div>
      <div class="stat"><div class="l">In today's money</div><div class="n" id="dpReal">—</div><div class="h">After tax and inflation</div></div>
    </div>
    <p class="g-callout dp-tds" id="dpTds"></p>
    <div class="g-note" id="dpExtra" hidden></div>
    <div class="chartbox">
      <h2 class="list-h" style="margin:0 0 4px">Value by year</h2>
      <p class="hint" style="margin:0 0 10px">Before tax.</p>
      <div id="dpChart"></div>
      <div class="legend2"><span><i style="background:var(--brand)"></i>With interest</span><span><i style="background:var(--leave)"></i>You put in</span></div>
    </div>
    <h2 class="list-h" id="dpCmpLbl">The same saving in FD, RD and PPF</h2>
    <div class="two">{num("cYearly", "Yearly saving", money=True)}{small("cYears", "For", "years")}</div>
    <div class="sens" id="dpCmp"></div>
    <p class="hint" id="dpCmpNote"></p>
    <a class="next" href="/sip-calculator/"><span class="k">Saving for 10 years or more?</span><b>See what the same money could do in a SIP</b><span class="h">Equity funds can earn more than deposits over long periods, with more ups and downs.</span></a>
  </div>
</div></section>

<section style="padding-top:0"><div class="wrap">
  <h2>Year by year</h2>
  <div class="tbl-wrap calc-wrap" id="dpTable"></div>
</div></section>
{related("/fd-ppf-rd-calculator/")}
<div class="wrap aff-slot" aria-label="Sponsored"></div>

<section style="padding-top:0"><div class="wrap prose">
  <p class="g-callout"><b>Choosing between them?</b> Read <a href="/guides/fd-rd-or-ppf/">FD, RD or PPF: where should your safe money go?</a> Also read: <a href="/guides/fd-interest-tax-below-50000/">Is FD interest taxable below ₹50,000?</a> and <a href="/guides/ppf-deposit-by-5-april/">PPF: deposit by 5 April</a>.</p>
  <h2>How the calculator works</h2>
  <ul>
    <li><strong>FD:</strong> interest compounds every quarter if it's reinvested, as banks do; a part-quarter at the end earns simple interest. Monthly payouts are the quarterly interest, discounted.</li>
    <li><strong>RD:</strong> each instalment earns interest compounded quarterly for the months it stays in.</li>
    <li><strong>PPF:</strong> interest on the lowest balance between the 5th and the end of each month, credited every March.</li>
    <li><strong>Tax:</strong> FD and RD interest is added to your income each year and taxed at your slab, plus 4% cess. PPF interest is tax-free.</li>
    <li><strong>TDS:</strong> shown separately. It isn't extra tax; it's credited against what you owe.</li>
  </ul>
  <h2 id="sources">Sources</h2>
  <p>PPF and post office RD rates: Ministry of Finance memorandum of 30 September 2026, rates for October to December 2026. TDS: section 393(1), Table S. No. 5(ii), and section 393(4) of the Income-tax Act, 2025. Deductions: section 123 with Schedule XV, and section 153, checked on the <a href="https://www.incometaxindia.gov.in/" rel="noopener">Income Tax Department's website</a> for tax year {TAX_YEAR}. Read <a href="/methodology/">how we check our numbers</a>.</p>
  <h2>Frequently asked questions</h2>
  {faq_html(faqs)}
</div></section>
<div class="rb-bar" id="dpBar" hidden><span id="dpBarT"></span><button type="button" class="btn-sm pri" id="dpBarBtn">See the result</button></div>
"""
    graph = [{"@type": "WebApplication", "name": "FD, PPF and RD Calculator", "url": SITE + "/fd-ppf-rd-calculator/", "applicationCategory": "FinanceApplication",
              "operatingSystem": "Any", "browserRequirements": "Requires JavaScript", "isAccessibleForFree": True, "inLanguage": "en-IN",
              "offers": {"@type": "Offer", "price": "0", "priceCurrency": "INR"}, "dateModified": VERIFIED,
              "description": "FD, RD and PPF maturity after tax, with TDS explained and a side-by-side comparison of the same saving in all three.", "publisher": {"@id": SITE + "/#org"}},
             faq_ld(faqs)]
    body = add_tips(body, "dp", DP_TIPS)
    return layout("/fd-ppf-rd-calculator/", "FD, PPF and RD Calculator: Maturity After Tax and TDS",
                  "Work out FD, RD and PPF maturity, the tax on your interest and whether your bank will deduct TDS. Compare all three for the same saving. Free.",
                  body, crumbs=[("/", "Home"), ("/fd-ppf-rd-calculator/", "FD, PPF and RD Calculator")], graph=graph,
                  css=("tool.css",), js=("deposits.js",), og="og-fd-ppf-rd-calculator.png", og_title="FD, PPF and RD calculator, after tax")

DP_TIPS = [
    ("""<label for="dp-other" id="dp-otherLbl">Other FD and RD interest at the same bank, a year</label>""", "other interest at the same bank",
     "Banks check the ₹50,000 TDS limit (₹1 lakh for senior citizens) against all your fixed and recurring deposits with them, across branches. Interest from other banks and from your savings account doesn't count towards it."),
    ("""<span class="lbl" id="regLbl">Tax regime</span>""", "tax regime",
     "Interest is taxed at your slab in both regimes. The old regime adds two things: PPF and 5-year tax-saver FD deposits count under section 123 (old 80C), and senior citizens can deduct up to ₹50,000 of interest a year (section 153(2)(b), old 80TTB)."),
    ("""<div class="l">Tax on interest</div>""", "tax on interest",
     "Interest is taxable from the first rupee at your slab, whether or not the bank deducts TDS. ₹50,000 is only the TDS limit, not a tax-free limit."),
    ("""<span class="lbl" id="whenLbl">When you deposit</span>""", "PPF deposit timing",
     "PPF pays interest on the lowest balance between the 5th and the end of each month. Money deposited after the 5th earns nothing for that month, so depositing by 5 April earns the most."),
    ("""<h2 class="list-h" id="dpCmpLbl">The same saving in FD, RD and PPF</h2>""", "the comparison",
     "Puts the same yearly amount into each, for the same years, using your FD, RD and PPF rates. FD and RD interest is taxed each year at your slab; PPF is tax-free. A new FD each year, an RD of a twelfth each month."),
]

def epf_page():
    faqs = [
        ("How much goes into my EPF each month?",
         "You put in 12% of your PF wages (basic + DA). Your employer also puts in 12%, but if you're in the pension scheme (EPS), 8.33% of your wages up to ₹25,000 (up to ₹2,083 a month) goes to EPS instead of your EPF. The rest of your employer's share goes to your EPF. You can put in more yourself as voluntary PF (VPF); your employer doesn't have to match it."),
        ("What is the EPF interest rate?",
         "8.25% a year for 2025-26, approved by the government in June 2026 and credited from July. The rate is set every year by EPFO's Central Board of Trustees and approved by the government, so future rates can differ. Interest is worked out on your monthly balance and credited once a year."),
        ("What is EPS, and how is the pension worked out?",
         "EPS is the Employees' Pension Scheme. Part of your employer's contribution goes into it, and after at least 10 years of service you get a monthly pension for life from 58. The pension is (pensionable wages × years of service) ÷ 70, where pensionable wages are your average wages over the last 60 months, capped by the wage ceiling of each period: ₹15,000 for service up to 16 September 2026 and ₹25,000 after. With 20 years or more, 2 years are added. The minimum is ₹1,000 a month."),
        ("What changed on 17 September 2026?",
         "The wage ceiling for EPF, EPS and EDLI went up from ₹15,000 to ₹25,000 a month. Employees earning up to ₹25,000 are now covered compulsorily, and if your PF is worked out on capped wages, both your and your employer's contributions go up. For EPS, service from that date counts at up to ₹25,000, which raises future pensions."),
        ("What happens to my EPF and EPS when I change jobs?",
         "Keep the same UAN. Your new employer opens a new member ID under it, and your old EPF balance is transferred to it, often automatically after the first contribution; otherwise through a transfer request (Form 13) on the EPFO portal. For EPS, the money stays in the pension fund; what moves is your service record, so your years keep adding up towards the 10 years needed for a pension."),
        ("Can I withdraw my EPS money?",
         "Only if you leave with less than 10 years of service. Under the Employees' Pension Scheme, 2026, you then get a withdrawal benefit worked out on your months of service and wages, payable after 36 months from your last contribution (or at 58, if earlier), if you haven't joined another covered employer. You can instead take a scheme certificate, which keeps your service for a future pension. After 10 years, you can't withdraw it; you get a pension."),
        ("Is EPF interest taxable?",
         "Mostly not. Interest on your own contributions (including VPF) above ₹2.5 lakh a year is taxable; the calculator shows it if it applies. Your employer's PF, NPS and superannuation contributions together above ₹7.5 lakh a year are taxed as a perquisite. Withdrawals after 5 years of continuous service are generally tax-free."),
        ("Should I put more into VPF?",
         "VPF earns the same rate as EPF, currently 8.25%, which is high for a safe investment, and stays tax-free as long as your own contributions stay under ₹2.5 lakh a year. The catch is that it's harder to withdraw than a fixed deposit. If you want safe, long-term savings and have an emergency fund, it's worth considering."),
    ]
    def num(k, label, hint="", lid=None):
        idattr = f' id="{lid}"' if lid else ""
        return (f'<div class="fld"><div class="row1"><label for="ep-{k}"{idattr}>{label}</label><span class="w" id="ep-{k}-w"></span></div><div class="numin"><span>₹</span><input id="ep-{k}" type="text" inputmode="numeric" autocomplete="off"></div>'
                + (f'<p class="hint">{hint}</p>' if hint else "") + "</div>")
    def small(k, label, unit, lid=None):
        if lid: return f'<div class="fld"><div class="row1"><label for="ep-{k}" id="{lid}">{label}</label></div><div class="numin"><input id="ep-{k}" type="text" inputmode="decimal" autocomplete="off"><span>{unit}</span></div></div>'
        return f'<div class="fld"><label for="ep-{k}" class="lbl" style="margin:0 0 6px">{label}</label><div class="numin"><input id="ep-{k}" type="text" inputmode="decimal" autocomplete="off"><span>{unit}</span></div></div>'
    slabs = "".join(f'<option value="{s}">{s}%</option>' for s in (0, 5, 10, 15, 20, 25, 30))
    body = f"""<section class="tool-hero"><div class="wrap">
  <p class="eyebrow">Your retirement</p>
  <h1>EPF calculator</h1>
  <p class="lead">What your PF could grow to by retirement, how much you and your employer put in, the interest it earns, and an estimate of your EPS pension. Updated for the ₹25,000 wage ceiling and the 2026 schemes.</p>
  {badges("EPF interest 8.25% for 2025-26 · Wage ceiling ₹25,000 from 17 Sep 2026")}
</div></section>

<section style="padding-top:0"><div class="wrap lp rb epx">
  <div class="card lp-setup" aria-label="Your EPF">
    <div class="two">{small("age", "Your age now", "years")}{small("retireAge", "Retire at", "years", lid="ep-retLbl")}</div>
    {num("balance", "EPF balance now", "Your total from the EPFO passbook (employee + employer shares). 0 if you're starting.")}
    {num("wage", "PF wages a month (basic + DA)", "From your payslip. Under the labour codes, PF wages are at least half your total pay: if your basic + DA is less than half, enter half your total pay.", lid="ep-wageLbl")}
    <div><span class="lbl" id="basisLbl">Your PF is worked out on</span>
      <div class="seg row" role="group" aria-labelledby="basisLbl"><button type="button" data-basis="full">Full wages</button><button type="button" data-basis="capped">Wages up to ₹25,000</button></div>
      <p class="hint">Your payslip shows it: if your PF deduction is ₹3,000 a month while your basic is higher, it's capped.</p></div>
    <div class="two">{small("hike", "Pay rise each year", "%")}{small("vpf", "Voluntary PF (VPF)", "% of wages", lid="ep-vpfLbl")}</div>
    <div class="two">{small("rate", "EPF interest rate", "% a year", lid="ep-rateLbl")}{small("infl", "Inflation", "% a year")}</div>
    <h3 class="sub">Pension scheme (EPS)</h3>
    <div><span class="lbl" id="epsLbl">Are you in EPS?</span>
      <div class="seg row" role="group" aria-labelledby="epsLbl"><button type="button" data-eps="1">Yes</button><button type="button" data-eps="0">No</button></div>
      <p class="hint">Your EPFO passbook shows a "pension contribution" column if you are.</p></div>
    <div id="ep-epsWrap">{small("epsYears", "EPS service so far", "years", lid="ep-epsLbl")}</div>
    <div class="fld"><div class="row1"><label for="ep-slab" id="ep-slabLbl">Your tax slab</label></div><select id="ep-slab" class="sel">{slabs}</select>
      <p class="hint">Used only if interest on your own contributions above ₹2.5 lakh a year becomes taxable.</p></div>
  </div>

  <div>
    <div class="verdict" id="epVerdict" aria-live="polite"></div>
    <div class="actions">
      <button type="button" class="btn-sm pri" id="epPdf">Download PDF report</button>
      <button type="button" class="btn-sm" id="epXlsx">Download Excel</button>
      <button type="button" class="btn-sm btn-ghost" id="epShare">Copy share link</button>
    </div>
    <p class="status" id="epStatus" role="status"></p>
    <div class="stats">
      <div class="stat"><div class="l">EPF at retirement</div><div class="n" id="epS1">—</div><div class="h" id="epS1h"></div></div>
      <div class="stat"><div class="l">EPS pension</div><div class="n" id="epS2">—</div><div class="h" id="epS2h"></div></div>
      <div class="stat"><div class="l">You and employer put in</div><div class="n" id="epS3">—</div><div class="h" id="epS3h"></div></div>
      <div class="stat"><div class="l">Interest earned</div><div class="n" id="epS4">—</div><div class="h" id="epS4h"></div></div>
    </div>
    <p class="g-callout" id="epRule"></p>
    <div class="chartbox">
      <h2 class="list-h" style="margin:0 0 4px">Your EPF by age</h2>
      <div id="epChart"></div>
      <div class="legend2"><span><i style="background:var(--brand)"></i>Balance</span><span><i style="background:var(--leave)"></i>What you and your employer put in</span></div>
    </div>
    <h2 class="list-h">At other interest rates</h2>
    <div class="sens" id="epSens"></div>
    <a class="next" href="/nps-calculator/"><span class="k">Also saving in NPS?</span><b>See what your NPS adds at 60</b><span class="h">Employer NPS saves tax even under the new regime.</span></a>
    <a class="next" href="/eps-pension-calculator/" style="margin-top:12px"><span class="k">In EPS?</span><b>Work out your EPS pension exactly</b><span class="h">Service split by wage ceiling, early or later start, or the withdrawal amount under 10 years.</span></a>
  </div>
</div></section>

<section style="padding-top:0"><div class="wrap">
  <h2>Where your EPF comes from</h2>
  <div class="tbl-wrap calc-wrap" id="epSplit"></div>
  <h2>Year by year</h2>
  <div class="tbl-wrap calc-wrap" id="epTable"></div>
</div></section>
{related("/epf-calculator/")}
<div class="wrap aff-slot" aria-label="Sponsored"></div>

<section style="padding-top:0"><div class="wrap prose">
  <p class="g-callout"><b>New to EPF and EPS?</b> Read our guide, <a href="/guides/how-much-epf-at-58/">How much will your EPF be at 58?</a> Also read: <a href="/guides/eps-pension-explained/">EPS explained: job changes and claims</a> , <a href="/guides/epf-wage-ceiling-25000/">The ₹25,000 wage ceiling</a> and <a href="/guides/transfer-pf-dont-withdraw/">Changed jobs? Transfer your PF</a>.</p>
  <h2>How the calculator works</h2>
  <ul>
    <li><strong>Contributions:</strong> you put in 12% of PF wages plus any VPF. Your employer puts in 12%; if you're in EPS, 8.33% of wages up to ₹25,000 goes to EPS and the rest to your EPF. With PF on capped wages, both are worked out on wages up to ₹25,000.</li>
    <li><strong>Interest:</strong> worked out each month on the running balance at the rate ÷ 12, and credited once a year.</li>
    <li><strong>Pay:</strong> rises once a year by the rate you set.</li>
    <li><strong>EPS pension:</strong> an estimate of (pensionable wages × service) ÷ 70, worked out separately for service up to 16 September 2026 (at the ₹15,000 ceiling) and after (at up to ₹25,000), with 2 years added for 20 years or more, a minimum of ₹1,000, and 4% less for each year if taken early from 50. It doesn't include higher pension on actual wages.</li>
    <li><strong>Tax:</strong> interest on your own contributions above ₹2.5 lakh a year is taxable at your slab plus 4% cess.</li>
  </ul>
  <h2 id="sources">Sources</h2>
  <p>Interest rate: 8.25% for 2025-26, approved by the Ministry of Labour and Employment under para 60(1) and credited from July 2026. Wage ceiling: ₹25,000 a month from 17 September 2026 (Cabinet decision of 16 September 2026, notified under the Code on Social Security, 2020). Schemes: Employees' Provident Funds Scheme, 2026 and Employees' Pension Scheme, 2026 (notified 29 June 2026). Tax: Income-tax Act, 2025, checked on the <a href="https://www.incometaxindia.gov.in/" rel="noopener">Income Tax Department's website</a>. Read <a href="/methodology/">how we check our numbers</a>.</p>
  <h2>Frequently asked questions</h2>
  {faq_html(faqs)}
</div></section>
<div class="rb-bar" id="epBar" hidden><span id="epBarT"></span><button type="button" class="btn-sm pri" id="epBarBtn">See the result</button></div>
"""
    graph = [{"@type": "WebApplication", "name": "EPF Calculator", "url": SITE + "/epf-calculator/", "applicationCategory": "FinanceApplication",
              "operatingSystem": "Any", "browserRequirements": "Requires JavaScript", "isAccessibleForFree": True, "inLanguage": "en-IN",
              "offers": {"@type": "Offer", "price": "0", "priceCurrency": "INR"}, "dateModified": VERIFIED,
              "description": "EPF balance at retirement with 8.25% interest, employee and employer shares, VPF, the ₹25,000 wage ceiling and an EPS pension estimate.", "publisher": {"@id": SITE + "/#org"}},
             faq_ld(faqs)]
    body = add_tips(body, "ep", EP_TIPS)
    return layout("/epf-calculator/", "EPF Calculator 2026: PF Balance, Interest and EPS Pension",
                  "Your EPF at retirement at 8.25% interest, what you and your employer put in, VPF, the new ₹25,000 wage ceiling and your EPS pension estimate.",
                  body, crumbs=[("/", "Home"), ("/epf-calculator/", "EPF Calculator")], graph=graph,
                  css=("tool.css",), js=("epf.js",), og="og-epf-calculator.png", og_title="EPF at retirement, and your EPS pension")

EP_TIPS = [
    ("""<label for="ep-retireAge" id="ep-retLbl">Retire at</label>""", "retirement age",
     "When contributions stop. EPS (pension) contributions stop at 58 even if you keep working; EPF can continue. The EPS pension starts at 58, or from 50 at a reduced rate."),
    ("""<label for="ep-wage" id="ep-wageLbl">PF wages a month (basic + DA)</label>""", "PF wages",
     "The pay your PF is worked out on: basic pay plus dearness allowance. Under the Code on Social Security, if allowances are more than half your total pay, the excess is added back, so PF wages are at least half your total pay."),
    ("""<label for="ep-vpf" id="ep-vpfLbl">Voluntary PF (VPF)</label>""", "VPF",
     "Extra contribution you choose to make, as a share of your wages. It earns the EPF rate. Your employer doesn't add to it. Your own PF + VPF above ₹2.5 lakh a year earns taxable interest."),
    ("""<label for="ep-rate" id="ep-rateLbl">EPF interest rate</label>""", "EPF interest rate",
     "8.25% for 2025-26. It's declared every year, so try 7.5% and 9% to see the range."),
    ("""<label for="ep-epsYears" id="ep-epsLbl">EPS service so far</label>""", "EPS service",
     "Years you've been in the pension scheme across all jobs, if your old PF accounts were transferred under the same UAN. Check the service history in your EPFO passbook."),
    ("""<label for="ep-slab" id="ep-slabLbl">Your tax slab</label>""", "tax slab",
     "The rate on the top part of your income. Used only for the tax on interest from your own contributions above ₹2.5 lakh a year."),
]

def retirement_page():
    faqs = [
        ("How much money do I need to retire in India?",
         "It depends on what you'll spend each month, how long you plan for, inflation and the return your savings earn after you retire. A common rough figure is 25 to 30 times your yearly spending at retirement, but with 6% inflation and a 7% return after retiring, money barely grows in real terms, so you may need more. The planner works it out year by year: it adds up your spending, rising with inflation, until the age you plan for, takes away pensions and other income, and works out what you need at retirement."),
        ("What spending should I enter?",
         "What you'd spend a month in retirement, in today's money. Start from your current spending, then take out what stops (home loan EMI once it's paid off, children's education, work travel) and add what goes up (health insurance and medical costs, travel). If you're not sure, use your current spending."),
        ("What return should I expect after retiring?",
         "Lower than while you're saving, because most retirees move money into safer options. 7% is a reasonable middle: a mix of FDs, debt funds, Senior Citizens' Savings Scheme and some equity. If you keep more in equity funds, you can try 8%; if all of it is in FDs, try 6.5% and remember FD interest is taxable."),
        ("How are EPF and the EPS pension counted?",
         "With the EPF calculator's own code: 12% from you and 12% from your employer on PF wages, at the EPF rate you set, until you retire. If you're in EPS, the pension estimate is counted from 58 (or when you retire, if later), and stays the same each year; EPS pensions aren't raised for inflation."),
        ("How is NPS counted?",
         "With the NPS calculator's code: contributions until you retire, and if you retire before 60, the money stays invested until 60. At exit, the most allowed is taken as a lump sum (80% for non-government subscribers under PFRDA's December 2025 rules) and the rest buys an annuity, assumed at 6.5% a year. The lump sum adds to your savings; the pension reduces what you need to withdraw."),
        ("What is the extra SIP?",
         "If you're short, the extra monthly SIP that would close the gap by the time you retire, at your mutual fund return. It rises each year by the same step-up as your SIP, so it starts smaller. Retiring two years later, or spending a little less, often closes a gap faster; the what-if boxes show the effect."),
        ("Does the planner include tax?",
         "No, the figures are before tax. EPF withdrawals and most of the NPS lump sum are tax-free, but pensions, FD interest and part of mutual fund gains are taxed. With the new regime's higher rebate, many retirees pay little tax, but keep a margin if your income in retirement will be high."),
        ("How often should I check my plan?",
         "Once a year, and whenever something big changes: a job change, a big pay rise, a new loan, or a change in what you expect to spend. Update your balances from your EPFO passbook, NPS statement and mutual fund statements."),
    ]
    def num(k, label, hint="", lid=None):
        idattr = f' id="{lid}"' if lid else ""
        return (f'<div class="fld"><div class="row1"><label for="rp-{k}"{idattr}>{label}</label><span class="w" id="rp-{k}-w"></span></div><div class="numin"><span>₹</span><input id="rp-{k}" type="text" inputmode="numeric" autocomplete="off"></div>'
                + (f'<p class="hint">{hint}</p>' if hint else "") + "</div>")
    def small(k, label, unit, lid=None):
        if lid: return f'<div class="fld"><div class="row1"><label for="rp-{k}" id="{lid}">{label}</label></div><div class="numin"><input id="rp-{k}" type="text" inputmode="decimal" autocomplete="off"><span>{unit}</span></div></div>'
        return f'<div class="fld"><label for="rp-{k}" class="lbl" style="margin:0 0 6px">{label}</label><div class="numin"><input id="rp-{k}" type="text" inputmode="decimal" autocomplete="off"><span>{unit}</span></div></div>'
    body = f"""<section class="tool-hero"><div class="wrap">
  <p class="eyebrow">Your retirement</p>
  <h1>Retirement planner: how much do you need?</h1>
  <p class="lead">How much you'll need to retire, how much your EPF, NPS, SIPs and FDs could add up to, the gap, and the extra SIP that would close it. With how long your money lasts.</p>
  {badges("EPF 8.25% for 2025-26 · NPS exit rules of Dec 2025 · Before tax")}
</div></section>

<section style="padding-top:0"><div class="wrap lp rb rpx">
  <div class="card lp-setup" aria-label="Your retirement plan">
    <div class="two">{small("age", "Your age now", "years")}{small("retireAge", "Retire at", "years")}</div>
    <div class="two">{small("lifeTo", "Plan until age", "years", lid="rp-lifeLbl")}{small("infl", "Inflation", "% a year")}</div>
    {num("spend", "Spending a month in retirement", "In today's money. Leave out costs that will stop (like a home loan EMI) and add what will go up (like health costs).", lid="rp-spendLbl")}
    <div class="two">{small("retRet", "Return after retiring", "% a year", lid="rp-retLbl")}<div></div></div>
    <h3 class="sub">EPF</h3>
    {num("epfBal", "EPF balance now", "From your EPFO passbook. 0 if you don't have EPF.")}
    {num("wage", "PF wages a month (basic + DA)", "0 if you don't contribute to EPF.")}
    <div class="two">{small("hike", "Pay rise each year", "%")}{small("epfRate", "EPF interest rate", "% a year")}</div>
    <div><span class="lbl" id="epsLbl">In the pension scheme (EPS)?</span>
      <div class="seg row" role="group" aria-labelledby="epsLbl"><button type="button" data-eps="1">Yes</button><button type="button" data-eps="0">No</button></div></div>
    <div id="rp-epsWrap">{small("epsYears", "EPS service so far", "years")}</div>
    <h3 class="sub">NPS</h3>
    {num("npsBal", "NPS balance now", "0 if you don't have NPS.")}
    {num("npsMonthly", "NPS a month (you + employer)")}
    <div class="two">{small("npsRet", "NPS return", "% a year")}<div></div></div>
    <h3 class="sub">Mutual funds and SIPs</h3>
    {num("mfBal", "Mutual funds now")}
    {num("sip", "SIP a month")}
    <div class="two">{small("step", "SIP and NPS step-up", "% a year", lid="rp-stepLbl")}{small("mfRet", "Mutual fund return", "% a year")}</div>
    <h3 class="sub">FD, PPF and other savings</h3>
    {num("fdBal", "FD, PPF and other savings now", "Money kept for retirement, not your emergency fund.")}
    <div class="two">{small("fdRet", "Their return", "% a year")}<div></div></div>
    <h3 class="sub">Other income in retirement</h3>
    {num("other", "Rent or other income a month", "In today's money, rising with inflation. 0 if none.", lid="rp-otherLbl")}
  </div>

  <div>
    <div class="verdict" id="rpVerdict" aria-live="polite"></div>
    <div class="actions">
      <button type="button" class="btn-sm pri" id="rpPdf">Download PDF report</button>
      <button type="button" class="btn-sm" id="rpXlsx">Download Excel</button>
      <button type="button" class="btn-sm btn-ghost" id="rpShare">Copy share link</button>
    </div>
    <p class="status" id="rpStatus" role="status"></p>
    <div class="stats">
      <div class="stat"><div class="l">You need at retirement</div><div class="n" id="rpS1">—</div><div class="h" id="rpS1h"></div></div>
      <div class="stat"><div class="l">You'll have</div><div class="n" id="rpS2">—</div><div class="h" id="rpS2h"></div></div>
      <div class="stat"><div class="l">Extra SIP needed</div><div class="n" id="rpS3">—</div><div class="h" id="rpS3h"></div></div>
      <div class="stat"><div class="l">Money lasts until</div><div class="n" id="rpS4">—</div><div class="h" id="rpS4h"></div></div>
    </div>
    <p class="g-callout" id="rpRule"></p>
    <div class="chartbox">
      <h2 class="list-h" style="margin:0 0 4px">Your savings by age</h2>
      <div id="rpChart"></div>
      <div class="legend2"><span><i style="background:var(--brand)"></i>As you are</span><span id="rpLegX"><i style="background:var(--leave)"></i>With the extra SIP</span></div>
    </div>
    <h2 class="list-h">What if</h2>
    <div class="sens" id="rpSens"></div>
    <a class="next" href="/sip-calculator/"><span class="k">Short?</span><b>Plan the extra SIP</b><span class="h">See what a step-up SIP grows to by your retirement.</span></a>
  </div>
</div></section>

<section style="padding-top:0"><div class="wrap">
  <h2>What you'll have at retirement</h2>
  <div class="tbl-wrap calc-wrap" id="rpHave"></div>
  <h2>Year by year</h2>
  <div class="tbl-wrap calc-wrap" id="rpTable"></div>
</div></section>
{related("/retirement-planner/")}
<div class="wrap aff-slot" aria-label="Sponsored"></div>

<section style="padding-top:0"><div class="wrap prose">
  <p class="g-callout"><b>Not sure where to start?</b> Read our guide, <a href="/guides/how-much-do-you-need-to-retire/">How much do you need to retire? One person's numbers</a>. Also read: <a href="/guides/25x-rule-retirement-india/">The 25× rule: does it work in India?</a></p>
  <h2>How the planner works</h2>
  <ul>
    <li><strong>What you need:</strong> your spending, rising with inflation each year, from retirement until the age you plan for, minus pensions and other income. The planner works out how much you need at retirement so that, earning the return after retiring, it lasts exactly that long. Money is taken out at the start of each year.</li>
    <li><strong>EPF and EPS:</strong> worked out with the <a href="/epf-calculator/">EPF calculator</a>'s code. The EPS pension starts at 58, or when you retire if later, and stays the same each year.</li>
    <li><strong>NPS:</strong> worked out with the <a href="/nps-calculator/">NPS calculator</a>'s code. Contributions stop when you retire; if that's before 60, the money stays invested until 60. Then the most allowed is taken as a lump sum (80% for non-government subscribers) and the rest buys an annuity at 6.5% a year.</li>
    <li><strong>SIPs and NPS contributions</strong> rise once a year by the step-up you set. FDs, PPF and other savings grow at their return.</li>
    <li><strong>Extra SIP:</strong> the monthly SIP, rising by the same step-up, that grows to the gap by your retirement at the mutual fund return.</li>
    <li><strong>Before tax:</strong> pensions, FD interest and part of mutual fund gains are taxed, so keep a margin.</li>
  </ul>
  <h2 id="sources">Sources</h2>
  <p>EPF interest 8.25% for 2025-26 and the ₹25,000 wage ceiling from 17 September 2026, as in the <a href="/epf-calculator/">EPF calculator</a>. NPS exit rules: PFRDA (Exits and Withdrawals under the National Pension System) (Amendment) Regulations, 2025, as in the <a href="/nps-calculator/">NPS calculator</a>. Tax on the NPS lump sum: Income-tax Act, 2025, Schedule II, S. No. 6. Returns, inflation and the annuity rate are your assumptions; change them to see the effect. Read <a href="/methodology/">how we check our numbers</a>.</p>
  <h2>Frequently asked questions</h2>
  {faq_html(faqs)}
</div></section>
<div class="rb-bar" id="rpBar" hidden><span id="rpBarT"></span><button type="button" class="btn-sm pri" id="rpBarBtn">See the result</button></div>
"""
    graph = [{"@type": "WebApplication", "name": "Retirement Planner", "url": SITE + "/retirement-planner/", "applicationCategory": "FinanceApplication",
              "operatingSystem": "Any", "browserRequirements": "Requires JavaScript", "isAccessibleForFree": True, "inLanguage": "en-IN",
              "offers": {"@type": "Offer", "price": "0", "priceCurrency": "INR"}, "dateModified": VERIFIED,
              "description": "How much you need to retire, what your EPF, NPS, SIPs and FDs add up to, the gap and the extra SIP to close it.", "publisher": {"@id": SITE + "/#org"}},
             faq_ld(faqs)]
    body = add_tips(body, "rp", RP_TIPS)
    return layout("/retirement-planner/", "Retirement Planner: How Much Do You Need to Retire?",
                  "How much you need to retire in India, what your EPF, NPS, SIPs and FDs could add up to, the gap, and the extra SIP to close it.",
                  body, crumbs=[("/", "Home"), ("/retirement-planner/", "Retirement Planner")], graph=graph,
                  css=("tool.css",), js=("epf.js", "nps.js", "retirement.js"), og="og-retirement-planner.png", og_title="How much do you need to retire?")

RP_TIPS = [
    ("""<label for="rp-lifeTo" id="rp-lifeLbl">Plan until age</label>""", "plan until age",
     "How long your money needs to last. Plan for longer than you expect to live: 85 to 90 is common, since running out is worse than leaving some behind."),
    ("""<label for="rp-spend" id="rp-spendLbl">Spending a month in retirement</label>""", "spending",
     "What you'd spend a month if you retired today. The planner raises it by inflation every year until and through retirement."),
    ("""<label for="rp-retRet" id="rp-retLbl">Return after retiring</label>""", "return after retiring",
     "What your savings earn once you start withdrawing. Usually lower than while saving, as most people move to safer options. 7% is a middle estimate."),
    ("""<label for="rp-step" id="rp-stepLbl">SIP and NPS step-up</label>""", "step-up",
     "How much you raise your SIP and NPS contributions each year. Raising them with your pay rise is the easiest way to close a gap."),
    ("""<label for="rp-other" id="rp-otherLbl">Rent or other income a month</label>""", "other income",
     "Income you'll have in retirement apart from EPS and NPS pensions, like rent from a property. Enter it in today's money."),
]

def eps_page():
    faqs = [
        ("How is the EPS pension calculated?",
         "Monthly pension = pensionable wages × pensionable service ÷ 70. Under the Employees' Pension Scheme, 2026, it's worked out separately for each wage-ceiling period and added up: service before 1 September 2014 at wages up to ₹6,500, service to 16 September 2026 at up to ₹15,000, and service from 17 September 2026 at up to ₹25,000. Pensionable wages are your average wages (basic + DA) over the last 60 months."),
        ("How many years of service do I need for an EPS pension?",
         "At least 10 years in total, across all your jobs, as long as your service was carried forward each time you changed jobs (same UAN, PF transferred, no EPS withdrawal). With less than 10 years, you get a withdrawal benefit or a scheme certificate instead."),
        ("What is the maximum EPS pension?",
         "On wages capped at the ceiling, it depends on how your service is split across the ceiling periods. Someone who works 35 years entirely after 17 September 2026 at ₹25,000 or more would get (₹25,000 × 37) ÷ 70, about ₹13,214 a month, including the 2 added years. Most people today will get less, because their earlier service counts at ₹15,000 or ₹6,500."),
        ("Should I take the EPS pension early at 50?",
         "Early pension is 4% less for each year before 58, so at 50 it's 32% less, for life. If you have 20 years or more of service, you also lose the 2 extra years added at 58. Starting early pays more in total only if you don't live long past your mid-70s; the calculator shows the age after which waiting pays more."),
        ("Can I defer my EPS pension beyond 58?",
         "Yes, up to 60. The pension goes up by 4% for each year you defer, so 8% more at 60. You must stop EPS contributions at 58 for this."),
        ("What is the EPS withdrawal benefit under Table-IV?",
         "If you leave with less than 10 years of service, you can take a lump sum: a multiple of your pensionable wages based on your months of service, from Table-IV of EPS 2026. For example, 12 months gives 1.02 times your wages and 60 months gives 5.02 times. Under EPS 2026 it's paid only after 36 months from your last contribution (or at 58, if earlier), and only if you haven't joined another covered employer."),
        ("Withdrawal benefit or scheme certificate: which is better?",
         "If you might work again in a job covered by EPF, the scheme certificate is usually better: your service carries forward and, once it reaches 10 years, you get a pension for life. The withdrawal benefit is a one-time payment, and your service resets to zero."),
        ("What is the higher pension option?",
         "Members who were in service on 1 September 2014 and jointly opted with their employer (after the Supreme Court's November 2022 judgment) contribute 8.33% on actual wages above the ceiling, so their pension is worked out on actual wages. Choose \"Yes\" under \"Pension on actual wages\" only if EPFO has accepted your option."),
    ]
    def num(k, label, hint="", lid=None):
        idattr = f' id="{lid}"' if lid else ""
        return (f'<div class="fld"><div class="row1"><label for="es-{k}"{idattr}>{label}</label><span class="w" id="es-{k}-w"></span></div><div class="numin"><span>₹</span><input id="es-{k}" type="text" inputmode="numeric" autocomplete="off"></div>'
                + (f'<p class="hint">{hint}</p>' if hint else "") + "</div>")
    def small(k, label, unit, lid=None, hint=""):
        lab = f'<div class="row1"><label for="es-{k}" id="{lid}">{label}</label></div>' if lid else f'<label for="es-{k}" class="lbl" style="margin:0 0 6px">{label}</label>'
        return f'<div class="fld">{lab}<div class="numin"><input id="es-{k}" type="text" inputmode="decimal" autocomplete="off"><span>{unit}</span></div>' + (f'<p class="hint">{hint}</p>' if hint else "") + "</div>"
    body = f"""<section class="tool-hero"><div class="wrap">
  <p class="eyebrow">Your retirement</p>
  <h1>EPS pension calculator</h1>
  <p class="lead">Your monthly EPS pension under the Employees' Pension Scheme, 2026, worked out for each wage-ceiling period, at any age from 50 to 60. With less than 10 years of service, your withdrawal benefit under Table-IV.</p>
  {badges("EPS 2026 · Wage ceiling ₹25,000 from 17 Sep 2026 · Table-IV withdrawal factors")}
</div></section>

<section style="padding-top:0"><div class="wrap lp rb esx">
  <div class="card lp-setup" aria-label="Your EPS service">
    <h3 class="sub" style="border:0;padding-top:0;margin-top:0">Your EPS service</h3>
    <p class="hint" style="margin:-12px 0 0">Add up your service across all jobs in each period, including the years still to come until your pension starts. Your EPFO passbook's service history shows the past. Use decimals for months (6 months = 0.5).</p>
    {small("p1", "Before 1 September 2014", "years", lid="es-p1Lbl")}
    {small("p2", "1 September 2014 to 16 September 2026", "years")}
    {small("p3", "From 17 September 2026", "years", hint="Years so far plus years until you leave or turn 58.")}
    {num("wage", "Average wages a month (basic + DA)", "Your average over the last 60 months before you leave. Wages above each period's ceiling only count with the higher pension option.", lid="es-wageLbl")}
    <div><span class="lbl" id="es-higherLbl">Pension on actual wages (higher pension)?</span>
      <div class="seg row" role="group" aria-labelledby="es-higherLbl"><button type="button" data-higher="0">No</button><button type="button" data-higher="1">Yes, EPFO accepted it</button></div></div>
    {small("start", "Pension starts at", "age", lid="es-startLbl", hint="50 to 57: early, 4% less a year. 58: normal. 59 or 60: deferred, 4% more a year.")}
  </div>

  <div>
    <div class="verdict" id="esVerdict" aria-live="polite"></div>
    <div class="actions">
      <button type="button" class="btn-sm pri" id="esPdf">Download PDF report</button>
      <button type="button" class="btn-sm" id="esXlsx">Download Excel</button>
      <button type="button" class="btn-sm btn-ghost" id="esShare">Copy share link</button>
    </div>
    <p class="status" id="esStatus" role="status"></p>
    <div class="stats">
      <div class="stat"><div class="l" id="esS1l">Pension a month</div><div class="n" id="esS1">—</div><div class="h" id="esS1h"></div></div>
      <div class="stat"><div class="l">Pensionable service</div><div class="n" id="esS2">—</div><div class="h" id="esS2h"></div></div>
      <div class="stat"><div class="l">Pension a year</div><div class="n" id="esS3">—</div><div class="h" id="esS3h"></div></div>
      <div class="stat"><div class="l">Waiting pays more after</div><div class="n" id="esS4">—</div><div class="h" id="esS4h"></div></div>
    </div>
    <p class="g-callout" id="esRule"></p>
    <div id="esElig">
      <div class="chartbox">
        <h2 class="list-h" style="margin:0 0 4px">Total pension received by age</h2>
        <div id="esChart"></div>
        <div class="legend2"><span><i style="background:var(--brand)"></i><span id="esLegA"></span></span><span><i style="background:var(--leave)"></i><span id="esLegB"></span></span></div>
      </div>
      <h2 class="list-h">Your pension by starting age</h2>
      <div class="sens" id="esSens"></div>
    </div>
    <div id="esWb" hidden></div>
    <a class="next" href="/epf-calculator/"><span class="k">Your PF too</span><b>See what your EPF grows to</b><span class="h">Your EPF balance at retirement, with the EPS split.</span></a>
    <a class="next" href="/retirement-planner/" style="margin-top:12px"><span class="k">The full picture</span><b>Will your pension, EPF and SIPs be enough?</b><span class="h">The retirement planner adds them up against what you'll spend.</span></a>
  </div>
</div></section>

<section style="padding-top:0"><div class="wrap">
  <h2>Your pension by service period</h2>
  <div class="tbl-wrap calc-wrap" id="esPeriods"></div>
</div></section>
{related("/eps-pension-calculator/")}
<div class="wrap aff-slot" aria-label="Sponsored"></div>

<section style="padding-top:0"><div class="wrap prose">
  <p class="g-callout"><b>New to EPS?</b> Read <a href="/guides/eps-pension-explained/">EPS explained: your EPF pension, job changes and how to claim it</a>. Also read: <a href="/guides/transfer-pf-dont-withdraw/">Changed jobs? Transfer your PF, don't withdraw it</a>.</p>
  <h2>How the calculator works</h2>
  <ul>
    <li><strong>Pension:</strong> (wages counted × years of service) ÷ 70, worked out for each wage-ceiling period and added up, as paragraph 12(2) of EPS 2026 requires. Wages counted are your 60-month average, capped at ₹6,500, ₹15,000 or ₹25,000 for each period, or not capped with the higher pension option.</li>
    <li><strong>Added years:</strong> 2 years are added for 20 years or more of service, for a pension at 58 or later, in the latest period.</li>
    <li><strong>Starting age:</strong> 4% less for each year before 58 (from 50), 4% more for each year after 58 (up to 60). Minimum ₹1,000 a month.</li>
    <li><strong>Under 10 years:</strong> withdrawal benefit = Table-IV factor for your completed months of service × pensionable wages (your service-weighted capped wages).</li>
    <li><strong>Service:</strong> counted in years and months as you enter it. EPFO's own count of your service, and its sanctioned amount, decide.</li>
  </ul>
  <h2 id="sources">Sources</h2>
  <p>Employees' Pension Scheme, 2026 (G.S.R. 527(E), notified 29 June 2026): paragraph 12(2) (formula, pro rata for each wage-ceiling period), paragraphs 10–13 (service, added years, early and deferred pension, minimum pension, withdrawal benefit and Table-IV, scheme certificate). Wage ceiling of ₹25,000 from 17 September 2026 (Ministry of Labour and Employment, 16 September 2026); ₹15,000 from 1 September 2014 and ₹6,500 before. Read <a href="/methodology/">how we check our numbers</a>.</p>
  <h2>Frequently asked questions</h2>
  {faq_html(faqs)}
</div></section>
<div class="rb-bar" id="esBar" hidden><span id="esBarT"></span><button type="button" class="btn-sm pri" id="esBarBtn">See the result</button></div>
"""
    graph = [{"@type": "WebApplication", "name": "EPS Pension Calculator", "url": SITE + "/eps-pension-calculator/", "applicationCategory": "FinanceApplication",
              "operatingSystem": "Any", "browserRequirements": "Requires JavaScript", "isAccessibleForFree": True, "inLanguage": "en-IN",
              "offers": {"@type": "Offer", "price": "0", "priceCurrency": "INR"}, "dateModified": VERIFIED,
              "description": "EPS pension under the Employees' Pension Scheme, 2026, pro rata for each wage-ceiling period, early or deferred, and the Table-IV withdrawal benefit.", "publisher": {"@id": SITE + "/#org"}},
             faq_ld(faqs)]
    body = add_tips(body, "es", ES_TIPS)
    return layout("/eps-pension-calculator/", "EPS Pension Calculator 2026: Monthly Pension and Withdrawal",
                  "Your EPS pension under EPS 2026, worked out for each wage ceiling (₹6,500, ₹15,000, ₹25,000), from 50 to 60, or your Table-IV withdrawal benefit.",
                  body, crumbs=[("/", "Home"), ("/eps-pension-calculator/", "EPS Pension Calculator")], graph=graph,
                  css=("tool.css",), js=("eps.js",), og="og-eps-pension-calculator.png", og_title="Your EPS pension, worked out properly")

ES_TIPS = [
    ("""<label for="es-p1" id="es-p1Lbl">Before 1 September 2014</label>""", "service periods",
     "EPS 2026 works out the pension separately for each wage-ceiling period. Only people who were in EPS before September 2014 have service here."),
    ("""<label for="es-wage" id="es-wageLbl">Average wages a month (basic + DA)</label>""", "average wages",
     "Your pensionable wages: the average of your wages (basic + DA) over the 60 months before you leave the scheme. A pay rise in your last five years counts the most."),
    ("""<label for="es-start" id="es-startLbl">Pension starts at</label>""", "starting age",
     "You can start from 50 if you've left service, at a lower pension for life. Starting at 59 or 60 gives more, but you must stop EPS contributions at 58."),
]

def nps_page():
    faqs = [
        ("How much can I withdraw from NPS at 60?",
         "Under PFRDA's December 2025 rules, non-government subscribers (All Citizen and Corporate NPS) can take up to 80% of the corpus as a lump sum and must put at least 20% into an annuity. Government subscribers can take up to 60%, with at least 40% in an annuity. If the corpus is ₹8 lakh or less, you can take all of it. Between ₹8 lakh and ₹12 lakh, there are extra options, including ₹6 lakh as a lump sum with the rest paid out over at least 6 years."),
        ("Is the whole NPS lump sum tax-free?",
         "No. The Income-tax Act, 2025 (Schedule II, S. No. 6) exempts the payment on closure only up to 60% of the total corpus. So if you take 80%, the extra 20% is added to your income that year and taxed at your slab. The pension from the annuity is also taxable each year. The calculator shows the taxable part and an estimate of the tax."),
        ("Should I take 80% or only 60% as a lump sum?",
         "Taking 60% keeps the whole lump sum tax-free and puts more into the annuity, which pays a taxable pension for life. Taking 80% gives you more money in hand to invest as you like, but the extra 20% is taxed in one go. If you'd invest the extra in something better than an annuity and can absorb the tax, 80% can still make sense. Switch between the two in the calculator to compare."),
        ("Does NPS save tax under the new regime?",
         "Only your employer's contribution does. Under section 124 of the Income-tax Act, 2025, your employer's contribution is deductible up to 14% of basic pay + DA under the new regime. Your own contribution gets no deduction under the new regime. Under the old regime you can claim up to ₹50,000 extra for your own contribution (section 124(3), old 80CCD(1B)), and your own contribution also counts within the ₹1.5 lakh limit."),
        ("Should I ask my employer to put part of my pay into NPS?",
         "If you pay tax at 10% or more and won't need the money before 60, usually yes. Your CTC stays the same, but the part moved into NPS isn't taxed (up to the limit), so you save tax at your slab rate. The trade-off: take-home pay falls, and the money is locked in until 60, with limited withdrawals. Use the Employer NPS check in the calculator to see the exact numbers."),
        ("What is the ₹7.5 lakh limit?",
         "Your employer's contributions to PF, NPS and superannuation together are tax-free only up to ₹7.5 lakh a year. Anything above it is taxed as a perquisite under section 17 of the Income-tax Act, 2025. This matters for high earners with a large basic pay; the calculator warns you if you cross it."),
        ("What return should I expect from NPS?",
         "It depends on how much is in equity. Equity-heavy choices have historically earned more than debt-heavy ones, with bigger ups and downs. The calculator uses 10% a year by default as an example, not a promise. Try 8% and 12% to see the range."),
        ("Can I exit NPS before 60?",
         "Yes, but the rules are stricter: usually up to 20% as a lump sum and at least 80% into an annuity. If the corpus is ₹5 lakh or less, you can take all of it. This calculator assumes you exit at 60 or later."),
    ]
    def num(k, label, hint="", lid=None):
        idattr = f' id="{lid}"' if lid else ""
        return (f'<div class="fld"><div class="row1"><label for="np-{k}"{idattr}>{label}</label><span class="w" id="np-{k}-w"></span></div><div class="numin"><span>₹</span><input id="np-{k}" type="text" inputmode="numeric" autocomplete="off"></div>'
                + (f'<p class="hint">{hint}</p>' if hint else "") + "</div>")
    def small(k, label, unit, lid=None):
        if lid: return f'<div class="fld"><div class="row1"><label for="np-{k}" id="{lid}">{label}</label></div><div class="numin"><input id="np-{k}" type="text" inputmode="decimal" autocomplete="off"><span>{unit}</span></div></div>'
        return f'<div class="fld"><label for="np-{k}" class="lbl" style="margin:0 0 6px">{label}</label><div class="numin"><input id="np-{k}" type="text" inputmode="decimal" autocomplete="off"><span>{unit}</span></div></div>'
    slabs = "".join(f'<option value="{s}">{s}%</option>' for s in (0, 5, 10, 15, 20, 25, 30))
    body = f"""<section class="tool-hero"><div class="wrap">
  <p class="eyebrow">Your retirement</p>
  <h1>NPS calculator</h1>
  <p class="lead">What your NPS could be worth at 60, how much you can take out under the new exit rules, how much of it is taxed, and the pension from the rest. Plus a check on moving part of your pay into employer NPS.</p>
  {badges("PFRDA exit rules of December 2025 · Tax rules for tax year " + TAX_YEAR)}
</div></section>

<section style="padding-top:0"><div class="wrap lp rb np">
  <div class="card lp-setup" aria-label="Your NPS">
    <div><span class="lbl" id="modeLbl">Check</span>
      <div class="seg row" role="group" aria-labelledby="modeLbl"><button type="button" data-mode="plan">My NPS at retirement</button><button type="button" data-mode="emp">Employer NPS: tax saving</button></div></div>
    <div><span class="lbl" id="secLbl">You are</span>
      <div class="seg row" role="group" aria-labelledby="secLbl"><button type="button" data-sector="private">Private sector or self-employed</button><button type="button" data-sector="govt">Government employee</button></div></div>
    <div class="two">{small("age", "Your age now", "years")}<div class="np-plan">{small("exitAge", "Exit at age", "years", lid="np-exitLbl")}</div></div>
    <div><span class="lbl" id="regLbl">Tax regime</span>
      <div class="seg row" role="group" aria-labelledby="regLbl"><button type="button" data-regime="new">New regime</button><button type="button" data-regime="old">Old regime</button></div></div>
    <div class="fld" id="np-slabWrap"><div class="row1"><label for="np-slab" id="np-slabLbl">Your tax slab</label></div><select id="np-slab" class="sel">{slabs}</select>
      <p class="hint">The rate on the top part of your income. Under the new regime, if your taxable income is ₹12 lakh or less (after the ₹75,000 standard deduction for salary), the rebate makes your tax nil, so pick 0%.</p></div>

    <div class="np-plan">
    <h3 class="sub">Your NPS</h3>
    {num("balance", "NPS balance now", "From your NPS statement or the CRA app. 0 if you're starting.")}
    <div class="two">{num("own", "You put in a month")}{num("emp", "Employer puts in a month", lid="np-empLbl")}</div>
    <div class="two">{small("step", "Increase each year", "%")}{small("ret", "Expected return", "% a year", lid="np-retLbl")}</div>
    <h3 class="sub">At exit</h3>
    <div><span class="lbl" id="chLbl">Lump sum you'll take</span>
      <div class="seg row" role="group" aria-labelledby="chLbl"><button type="button" data-choice="max">Most allowed</button><button type="button" data-choice="free">Only the tax-free 60%</button></div></div>
    <div class="two">{small("annuity", "Annuity rate", "% a year", lid="np-annLbl")}{small("infl", "Inflation", "% a year")}</div>
    </div>

    <div class="np-emp" hidden>
    <h3 class="sub">Your pay</h3>
    {num("basic", "Basic pay + DA a month", "From your payslip. The employer NPS limit is a share of this.")}
    <div class="two">{small("nowPct", "Employer NPS now", "% of basic")}{small("newPct", "Employer NPS after", "% of basic", lid="np-newLbl")}</div>
    {num("pf", "Employer PF a year", "Usually 12% of basic, or less if your company caps it. Needed for the ₹7.5 lakh check.", lid="np-pfLbl")}
    <div class="two">{small("ret", "Expected return", "% a year").replace('id="np-ret"', 'id="np-ret2"').replace('for="np-ret"', 'for="np-ret2"')}<div></div></div>
    </div>
  </div>

  <div>
    <div class="verdict" id="npVerdict" aria-live="polite"></div>
    <div class="actions">
      <button type="button" class="btn-sm pri" id="npPdf">Download PDF report</button>
      <button type="button" class="btn-sm" id="npXlsx">Download Excel</button>
      <button type="button" class="btn-sm btn-ghost" id="npShare">Copy share link</button>
    </div>
    <p class="status" id="npStatus" role="status"></p>
    <div class="stats np-plan">
      <div class="stat"><div class="l">Corpus at exit</div><div class="n" id="npS1">—</div><div class="h" id="npS1h"></div></div>
      <div class="stat"><div class="l">Lump sum</div><div class="n" id="npS2">—</div><div class="h" id="npS2h"></div></div>
      <div class="stat"><div class="l">Pension a month</div><div class="n" id="npS3">—</div><div class="h" id="npS3h"></div></div>
      <div class="stat"><div class="l">You and employer put in</div><div class="n" id="npS4">—</div><div class="h" id="npS4h"></div></div>
    </div>
    <div class="stats np-emp" hidden>
      <div class="stat"><div class="l">Tax saved a year</div><div class="n" id="npE1">—</div><div class="h">At your slab, with 4% cess</div></div>
      <div class="stat"><div class="l">Take-home change</div><div class="n" id="npE2">—</div><div class="h">A month</div></div>
      <div class="stat"><div class="l">Extra into NPS</div><div class="n" id="npE3">—</div><div class="h">A year</div></div>
      <div class="stat"><div class="l">Extra NPS by 60</div><div class="n" id="npE4">—</div><div class="h" id="npE4h"></div></div>
    </div>
    <p class="g-callout" id="npRule"></p>
    <div class="np-plan">
    <div class="chartbox">
      <h2 class="list-h" style="margin:0 0 4px">Your NPS by age</h2>
      <div id="npChart"></div>
      <div class="legend2"><span><i style="background:var(--brand)"></i>Balance</span><span><i style="background:var(--leave)"></i>What you and your employer put in</span></div>
    </div>
    <h2 class="list-h">At other returns</h2>
    <div class="sens" id="npSens"></div>
    </div>
    <a class="next" href="/sip-calculator/"><span class="k">Want more than NPS?</span><b>Plan a SIP alongside it</b><span class="h">Mutual funds aren't locked in until 60, so they suit goals before retirement.</span></a>
    <a class="next" href="/retirement-planner/" style="margin-top:12px"><span class="k">The full picture</span><b>Will NPS, EPF and your SIPs be enough to retire?</b><span class="h">The retirement planner counts your NPS lump sum and pension.</span></a>
  </div>
</div></section>

<section style="padding-top:0" class="np-plan"><div class="wrap">
  <h2>What happens at exit</h2>
  <div class="tbl-wrap calc-wrap" id="npSplit"></div>
  <h2>Year by year</h2>
  <div class="tbl-wrap calc-wrap" id="npTable"></div>
</div></section>
{related("/nps-calculator/")}
<div class="wrap aff-slot" aria-label="Sponsored"></div>

<section style="padding-top:0"><div class="wrap prose">
  <p class="g-callout"><b>New to NPS?</b> Read our guide, <a href="/guides/nps-new-exit-rules/">NPS under the new exit rules</a>, worked through one saver's numbers. Also read: <a href="/guides/employer-nps-14-percent-new-regime/">Employer NPS at 14%</a>, <a href="/guides/nps-80-percent-withdrawal-tax/">The 80% withdrawal tax gap</a> and <a href="/guides/nps-vs-ppf-vs-epf/">NPS vs PPF vs EPF</a>.</p>
  <h2>How the calculator works</h2>
  <ul>
    <li><strong>Growth:</strong> your balance now, plus monthly contributions from you and your employer, grows at the return you set, compounded monthly. Contributions rise each year by the increase you set.</li>
    <li><strong>Exit (at 60 or later):</strong> non-government subscribers can take up to 80% as a lump sum and must put at least 20% into an annuity; government subscribers 60% and 40%. All of it can come out if the corpus is ₹8 lakh or less; between ₹8 lakh and ₹12 lakh there are extra options.</li>
    <li><strong>Tax at exit:</strong> up to 60% of the corpus is tax-free. Any lump sum above that is added to your income in the year you exit and taxed at the new regime's rates for tax year 2026-27, with the rebate, surcharge and 4% cess, assuming the pension is your only other income. The pension is taxed as income each year.</li>
    <li><strong>Pension:</strong> the annuity amount × the annuity rate you set ÷ 12. Actual rates depend on the insurer and plan.</li>
    <li><strong>Employer NPS check:</strong> part of your pay moves into employer NPS with your CTC unchanged. The amount within the limit (14% of basic + DA under the new regime or for government employers, 10% for private employers under the old regime) isn't taxed, so you save tax at your slab rate. Employer PF + NPS + superannuation above ₹7.5 lakh a year is taxed.</li>
  </ul>
  <h2 id="sources">Sources</h2>
  <p>Exit rules: PFRDA (Exits and Withdrawals under the National Pension System) (Amendment) Regulations, 2025, notified in December 2025. Tax: section 124, section 17, section 156 and Schedule II (S. No. 6) of the Income-tax Act, 2025, checked on the <a href="https://www.incometaxindia.gov.in/" rel="noopener">Income Tax Department's website</a>. Read <a href="/methodology/">how we check our numbers</a>.</p>
  <h2>Frequently asked questions</h2>
  {faq_html(faqs)}
</div></section>
<div class="rb-bar" id="npBar" hidden><span id="npBarT"></span><button type="button" class="btn-sm pri" id="npBarBtn">See the result</button></div>
"""
    graph = [{"@type": "WebApplication", "name": "NPS Calculator", "url": SITE + "/nps-calculator/", "applicationCategory": "FinanceApplication",
              "operatingSystem": "Any", "browserRequirements": "Requires JavaScript", "isAccessibleForFree": True, "inLanguage": "en-IN",
              "offers": {"@type": "Offer", "price": "0", "priceCurrency": "INR"}, "dateModified": VERIFIED,
              "description": "NPS corpus at 60, lump sum and pension under PFRDA's December 2025 exit rules, the taxable part of the lump sum, and the tax saved by employer NPS.", "publisher": {"@id": SITE + "/#org"}},
             faq_ld(faqs)]
    body = add_tips(body, "np", NP_TIPS)
    return layout("/nps-calculator/", "NPS Calculator 2026: Lump Sum, Pension and Tax at 60",
                  "Your NPS at 60 under the new exit rules: up to 80% lump sum, the taxable part above 60%, and your pension. Plus the tax saved by employer NPS.",
                  body, crumbs=[("/", "Home"), ("/nps-calculator/", "NPS Calculator")], graph=graph,
                  css=("tool.css",), js=("nps.js",), og="og-nps-calculator.png", og_title="NPS at 60: lump sum, tax and pension")

NP_TIPS = [
    ("""<label for="np-exitAge" id="np-exitLbl">Exit at age</label>""", "exit age",
     "Normal exit is at 60 (or retirement). You can stay invested and defer withdrawal up to 85. Exiting before 60 has stricter rules, which this calculator doesn't cover."),
    ("""<label for="np-slab" id="np-slabLbl">Your tax slab</label>""", "tax slab",
     "Your rate today, used for the tax saved by employer NPS and, under the old regime, by your own contribution. Tax at exit is worked out separately, with the new regime's rates."),
    ("""<label for="np-emp" id="np-empLbl">Employer puts in a month</label>""", "employer contribution",
     "Corporate NPS paid by your employer, shown on your payslip or CTC letter. 0 if your employer doesn't contribute."),
    ("""<label for="np-ret" id="np-retLbl">Expected return</label>""", "expected return",
     "Your estimate. Equity-heavy NPS choices have historically earned more than debt-heavy ones, with bigger ups and downs. 10% is an example, not a promise."),
    ("""<label for="np-annuity" id="np-annLbl">Annuity rate</label>""", "annuity rate",
     "The yearly pension an insurer pays per rupee of annuity. It depends on your age, the insurer and the plan (for life, with or without return of purchase price). Check current quotes before you exit."),
    ("""<label for="np-newPct" id="np-newLbl">Employer NPS after</label>""", "employer NPS limit",
     "Up to 14% of basic + DA is deductible under the new regime (and for government employers); 10% for private employers under the old regime. Your CTC stays the same: the amount comes out of your taxable pay."),
    ("""<label for="np-pf" id="np-pfLbl">Employer PF a year</label>""", "₹7.5 lakh limit",
     "Employer PF, NPS and superannuation together are tax-free up to ₹7.5 lakh a year. Above that, the excess is taxed as a perquisite."),
]

def car_own_page():
    faqs = [
        ("What does it really cost to own a car in India?",
         "Much more than the EMI. Add up fuel or charging, insurance, service and repairs, and the loan interest, then subtract what you'll get when you sell. The biggest single cost is usually the value the car loses. A ₹10 lakh petrol car driven 1,200 km a month and sold after 7 years costs about ₹17.9 lakh to own, or about ₹21,300 a month, with the example numbers in this calculator."),
        ("Is an electric car cheaper than a petrol car?",
         "Over enough kilometres, usually yes. An EV costs more to buy and its insurance is higher, but charging at home costs a fraction of petrol per km and servicing is cheaper. With the example numbers here (a ₹14 lakh EV against a ₹10 lakh petrol car), the EV is cheaper above about 800 km a month over 7 years. Below that, the petrol car's lower price wins. The break-even line in the calculator shows where it falls for your two cars."),
        ("How is the break-even distance worked out?",
         "Fuel or charging is the only cost that grows with distance; price, insurance, service, loan interest and the value lost are roughly fixed. So total cost rises in a straight line with kilometres. The break-even distance is where the two lines cross: drive more than that each month and the car with the cheaper running cost comes out ahead."),
        ("Can I claim tax benefits on my car loan?",
         "Not as a salaried person using the car privately. There's no deduction for personal car loan interest under either tax regime. The one exception is section 132 of the Income-tax Act, 2025 (old 80EEB): up to ₹1.5 lakh a year of interest on an electric vehicle loan sanctioned between 1 April 2019 and 31 March 2023, under the old regime only. A loan taken now doesn't qualify. If your employer offers a car lease, check our Car Lease vs Car Loan calculator: that's where the tax saving is."),
        ("Why does the calculator ask for resale value?",
         "Because the value a car loses is usually its biggest cost. If you sell a ₹10 lakh car for ₹4 lakh, you've spent ₹6 lakh on it before a drop of fuel. Look up used-car listings for the same model at the age you'll sell to estimate it. EVs' resale values are less settled than petrol cars', so try a lower figure to see how much it matters."),
        ("Should I buy a car on loan or pay cash?",
         "A loan adds interest, which the calculator counts. Paying cash avoids it, but the money could have earned a return elsewhere. If your investments reliably earn more after tax than the loan rate, a loan can make sense; for most people at 9% or more, paying more upfront saves money. Try the loan amount at zero to see the difference in interest."),
        ("Why are fuel prices pre-filled for Delhi?",
         "They're a starting point: petrol ₹102.12 and diesel ₹95.20 a litre, and CNG ₹86.98 a kg, in Delhi on 14 November 2026. Prices differ by state because of VAT, so put in your own city's price from your fuel station or the oil company's app. For an EV, use your home electricity rate per unit; public fast chargers cost more."),
        ("What isn't included?",
         "Parking, tolls and FASTag, cleaning, accessories, extended warranty and tyres beyond normal service. Add them to service and repairs a year if you want them counted. For an EV, add a home charger to the price if it isn't included, and keep in mind the battery warranty when you plan how long to keep it."),
    ]
    def num(k, label, hint="", money=True, lid=None):
        idattr = f' id="{lid}"' if lid else ""
        box = f'<div class="numin"><span>₹</span><input id="co-{k}" type="text" inputmode="numeric" autocomplete="off"></div>'
        return (f'<div class="fld"><div class="row1"><label for="co-{k}"{idattr}>{label}</label><span class="w" id="co-{k}-w"></span></div>{box}'
                + (f'<p class="hint">{hint}</p>' if hint else "") + "</div>")
    def small(k, label, unit, lid=None):
        if lid: return f'<div class="fld"><div class="row1"><label for="co-{k}" id="{lid}">{label}</label></div><div class="numin"><input id="co-{k}" type="text" inputmode="decimal" autocomplete="off"><span>{unit}</span></div></div>'
        return f'<div class="fld"><label for="co-{k}" class="lbl" style="margin:0 0 6px">{label}</label><div class="numin"><input id="co-{k}" type="text" inputmode="decimal" autocomplete="off"><span>{unit}</span></div></div>'
    body = f"""<section class="tool-hero"><div class="wrap">
  <p class="eyebrow">Your car</p>
  <h1>Car ownership cost calculator</h1>
  <p class="lead">What a car really costs you each month and each km: price, loan, fuel or charging, insurance and service, minus what you sell it for. Compare petrol, diesel, CNG and electric, and find the distance at which one beats the other.</p>
  {badges("Fuel prices for 14 Nov 2026 · Tax rules for tax year " + TAX_YEAR)}
</div></section>

<section style="padding-top:0"><div class="wrap lp rb co">
  <div class="card lp-setup" aria-label="Your cars">
    <div><span class="lbl" id="cmpLbl">Check</span>
      <div class="seg row" role="group" aria-labelledby="cmpLbl"><button type="button" data-compare="0">One car</button><button type="button" data-compare="1">Compare two cars</button></div></div>
    <h3 class="sub">How you'll use it</h3>
    <div class="two">{small("kmMonth", "Distance", "km a month")}{small("years", "You'll keep it for", "years")}</div>
    <p class="hint">Your odometer or fuel bills give a good idea. 1,000 km a month is about 33 km a day.</p>
    <div class="two">{small("rise", "Fuel and service costs rise", "% a year", lid="co-riseLbl")}<div></div></div>

    <div id="co-cars"><span class="lbl" id="carLbl">Enter details for</span>
      <div class="seg row" role="group" aria-labelledby="carLbl"><button type="button" data-car="a">Car 1</button><button type="button" data-car="b">Car 2</button></div></div>
    <h3 class="sub">The car</h3>
    <div class="fld"><label for="co-name" class="lbl" style="margin:0 0 6px">Name</label><div class="numin"><input id="co-name" type="text" maxlength="40" autocomplete="off" style="font-family:inherit;font-weight:600"></div></div>
    <div><span class="lbl" id="fuelLbl">Runs on</span>
      <div class="seg row" role="group" aria-labelledby="fuelLbl"><button type="button" data-fuel="petrol">Petrol</button><button type="button" data-fuel="diesel">Diesel</button><button type="button" data-fuel="cng">CNG</button><button type="button" data-fuel="ev">Electric</button></div></div>
    {num("price", "On-road price", "Ex-showroom price plus registration, road tax and first-year insurance, from the dealer's quote.", lid="co-priceLbl")}
    <div class="two"><div class="fld"><label for="co-mileage" class="lbl" style="margin:0 0 6px" id="co-mileageLbl">Mileage</label><div class="numin"><input id="co-mileage" type="text" inputmode="decimal" autocomplete="off"></div></div>
      <div class="fld"><label for="co-fuelPrice" class="lbl" style="margin:0 0 6px" id="co-fuelPriceLbl">Fuel price</label><div class="numin"><span>₹</span><input id="co-fuelPrice" type="text" inputmode="decimal" autocomplete="off"></div></div></div>
    <p class="hint" id="co-mileageHint"></p>
    <p class="hint" id="co-fuelHint"></p>
    <div class="two">{num("insFirst", "Insurance, first year")}{num("insLater", "Insurance, later years", lid="co-insLbl")}</div>
    <p class="hint">The first-year premium is on the dealer's quote. Renewals are usually lower, because the car's insured value (IDV) falls each year.</p>
    {num("service", "Service and repairs a year", "Scheduled service, wear parts and tyres, spread over the years. EVs usually cost less to service.")}
    <div class="two">{small("resalePct", "Resale value at the end", "% of price", lid="co-resaleLbl")}<div></div></div>
    <p class="hint" id="co-resaleHint"></p>
    <h3 class="sub">Loan</h3>
    {num("loan", "Loan amount", "Enter 0 if you'll pay in full.")}
    <div class="two">{small("rate", "Interest rate", "% a year")}{small("tenure", "Tenure", "years")}</div>
    <p class="hint" id="co-emi"></p>
  </div>

  <div>
    <div class="verdict" id="coVerdict" aria-live="polite"></div>
    <div class="actions">
      <button type="button" class="btn-sm pri" id="coPdf">Download PDF report</button>
      <button type="button" class="btn-sm" id="coXlsx">Download Excel</button>
      <button type="button" class="btn-sm btn-ghost" id="coShare">Copy share link</button>
    </div>
    <p class="status" id="coStatus" role="status"></p>
    <div class="stats">
      <div class="stat"><div class="l">Total cost</div><div class="n" id="coTot">—</div><div class="h" id="coTotH"></div></div>
      <div class="stat"><div class="l">Per month</div><div class="n" id="coMonth">—</div><div class="h">Over the years you keep it</div></div>
      <div class="stat"><div class="l">Per km</div><div class="n" id="coKm">—</div><div class="h">Everything included</div></div>
      <div class="stat"><div class="l">Running cost per km</div><div class="n" id="coRun">—</div><div class="h">Fuel or charging, and service</div></div>
    </div>
    <p class="g-callout" id="coBreak"></p>
    <div class="chartbox">
      <h2 class="list-h" style="margin:0 0 4px">Cost of owning, if sold that year</h2>
      <p class="hint" style="margin:0 0 10px">Everything paid so far, plus any loan left, minus the resale value.</p>
      <div id="coChart"></div>
      <div class="legend2"><span><i style="background:var(--brand)"></i><span id="coLegA"></span></span><span id="coLegB"><i style="background:var(--leave)"></i><span id="coLegBt"></span></span></div>
    </div>
    <h2 class="list-h" id="coDistLbl">At other distances, over the same years</h2>
    <div class="sens" id="coDist"></div>
    <a class="next" href="/company-car-lease-vs-loan/"><span class="k">Does your employer offer a car lease?</span><b>See if leasing through your company costs less</b><span class="h">A company lease is paid from your pre-tax salary, which can beat a car loan.</span></a>
  </div>
</div></section>

<section style="padding-top:0"><div class="wrap">
  <h2>Where the money goes</h2>
  <div class="tbl-wrap calc-wrap" id="coParts"></div>
  <h2>Year by year</h2>
  <div class="tbl-wrap calc-wrap" id="coTable"></div>
</div></section>
{related("/car-ownership-cost/")}
<div class="wrap aff-slot" aria-label="Sponsored"></div>

<section style="padding-top:0"><div class="wrap prose">
  <p class="g-callout"><b>Petrol, CNG or electric?</b> Read our guide, <a href="/guides/petrol-cng-or-ev-cost-per-km/">Petrol, CNG or EV: what a car really costs per km</a>, with the break-even distances for each.</p>
  <h2>How the calculator works</h2>
  <ul>
    <li><strong>Total cost</strong> is everything you pay (down payment, EMIs, fuel or charging, insurance, service) plus any loan still owed, minus what you sell the car for.</li>
    <li><strong>Fuel or charging:</strong> your km a month ÷ mileage × price, rising each year by the rate you set. Service rises at the same rate.</li>
    <li><strong>Loan:</strong> the standard reducing-balance EMI, the same as our <a href="/emi-calculator/">EMI calculator</a>. If the loan outlasts the car, the balance is paid off when you sell.</li>
    <li><strong>Resale:</strong> the value falls by the same share each year, reaching your estimate at the end. Real cars lose more in the first year or two, so "cost if sold" in early years is a little low.</li>
    <li><strong>Break-even distance:</strong> only fuel or charging grows with distance, so total cost rises in a straight line with km. Where two lines cross is the break-even.</li>
  </ul>
  <h2 id="sources">Sources</h2>
  <p>Fuel prices: Delhi retail prices on 14 November 2026, petrol ₹102.12 and diesel ₹95.20 a litre (oil marketing companies' daily rates), CNG ₹86.98 a kg (Indraprastha Gas, from 29 August 2026). Tax: section 132 of the Income-tax Act, 2025, checked on the <a href="https://www.incometaxindia.gov.in/" rel="noopener">Income Tax Department's website</a>. Read <a href="/methodology/">how we check our numbers</a>.</p>
  <h2>Frequently asked questions</h2>
  {faq_html(faqs)}
</div></section>
<div class="rb-bar" id="coBar" hidden><span id="coBarT"></span><button type="button" class="btn-sm pri" id="coBarBtn">See the result</button></div>
"""
    graph = [{"@type": "WebApplication", "name": "Car Ownership Cost Calculator", "url": SITE + "/car-ownership-cost/", "applicationCategory": "FinanceApplication",
              "operatingSystem": "Any", "browserRequirements": "Requires JavaScript", "isAccessibleForFree": True, "inLanguage": "en-IN",
              "offers": {"@type": "Offer", "price": "0", "priceCurrency": "INR"}, "dateModified": VERIFIED,
              "description": "The full cost of owning a petrol, diesel, CNG or electric car in India, per month and per km, with a two-car comparison and break-even distance.", "publisher": {"@id": SITE + "/#org"}},
             faq_ld(faqs)]
    body = add_tips(body, "co", CO_TIPS)
    return layout("/car-ownership-cost/", "Car Ownership Cost Calculator: Petrol, Diesel, CNG or EV",
                  "The real cost of owning a car in India, per month and per km: loan, fuel, insurance, service and resale. Compare petrol, diesel, CNG and EV. Free.",
                  body, crumbs=[("/", "Home"), ("/car-ownership-cost/", "Car Ownership Cost Calculator")], graph=graph,
                  css=("tool.css",), js=("car-own.js",), og="og-car-ownership-cost.png", og_title="Car ownership cost: petrol, diesel, CNG or EV?")

CO_TIPS = [
    ("""<label for="co-price" id="co-priceLbl">On-road price</label>""", "on-road price",
     "What you pay to drive it away: ex-showroom price, registration, road tax and first-year insurance. Many states charge lower or no road tax on EVs, so EV on-road prices can be closer to the ex-showroom price."),
    ("""<label for="co-rise" id="co-riseLbl">Fuel and service costs rise</label>""", "cost rise",
     "How fast fuel, electricity and service bills grow each year. 3% is a middle estimate; fuel prices in India can stay flat for long periods and then jump."),
    ("""<label for="co-insLater" id="co-insLbl">Insurance, later years</label>""", "insurance renewals",
     "An average renewal premium. The own-damage part falls as the insured value (IDV) drops with the car's age; the third-party part is set by the regulator and can change."),
    ("""<label for="co-resalePct" id="co-resaleLbl">Resale value at the end</label>""", "resale value",
     "The share of the on-road price you expect to get when you sell. The value a car loses is usually its biggest cost, so it's worth checking used-car listings for the same model at that age."),
    ("""<div class="l">Running cost per km</div>""", "running cost per km",
     "Fuel or charging plus service, averaged over the years you keep the car. Price, insurance, loan interest and the value lost are left out, which is why it's much lower than the full cost per km."),
]

def sections_page():
    faqs = [
        ("Which Act applies to my income: the 1961 Act or the 2025 Act?",
         "It depends on when you earned the income. Income earned up to 31 March 2026 (financial year 2025-26) is still taxed under the Income-tax Act, 1961, and you file that return in 2026 using the old section numbers. Income earned from 1 April 2026 falls under the Income-tax Act, 2025, as \"tax year 2026-27\"."),
        ("Did the tax rates or deduction limits change with the new Act?",
         "No. The Income-tax Act, 2025 rewrote and renumbered the law but didn't change tax rates. Limits like ₹1.5 lakh for 80C (now section 123), ₹25,000 for health insurance (now 126) and ₹2 lakh for home loan interest (now 22) are the same. The Income Tax Department says the new Act imposes no new tax."),
        ("What happened to section 80C?",
         "It's now section 123. The list of what qualifies (PPF, EPF, ELSS, life insurance, home loan principal, tuition fees and so on) moved to Schedule XV. The ₹1.5 lakh limit is unchanged, and it's still available only under the old tax regime."),
        ("Where did HRA and LTA go?",
         "House rent allowance (old section 10(13A)) is now Schedule III, Table S. No. 11, with the calculation in rule 279 of the Income-tax Rules, 2026. LTA (old 10(5)) is Schedule III, Table S. No. 8. Both are still available only under the old regime. One change: the 50% \"metro\" HRA rate now also applies to Hyderabad, Pune, Ahmedabad and Bengaluru."),
        ("Why are gratuity and leave encashment now in section 19?",
         "The new Act moved most salary-related exemptions into one table in section 19, \"Deductions from salaries\". Gratuity (old 10(10)) is at S. Nos. 3 to 6, leave encashment (old 10(10AA)) at S. Nos. 13 and 14, and the standard deduction (old 16(ia)) at S. No. 2. The tax treatment works the same way as before."),
        ("What is \"tax year\"?",
         "The new Act replaces \"previous year\" and \"assessment year\" with a single term, \"tax year\": the financial year in which you earn the income. Income earned from 1 April 2026 to 31 March 2027 is tax year 2026-27, and it's assessed after that year ends, as before."),
        ("Which of these can I use under the new tax regime?",
         "Under the new regime (section 202, earlier 115BAC), you can't claim most deductions in sections 122 to 154 (old 80C to 80U), HRA, LTA, professional tax or interest on a home you live in. You can still claim the standard deduction (₹75,000), your employer's NPS contribution (section 124, old 80CCD(2)), gratuity and leave encashment exemptions, and the rebate up to ₹12 lakh. Use the \"Works in the new regime\" filter to see them."),
    ("Is this list complete?",
         "No. We list about 60 sections that matter to salaried people, each checked against the section text on the Income Tax Department's website. The new Act has 536 sections. For anything else, use the department's own mapping utility on incometaxindia.gov.in."),
    ]
    tries = ["80C", "HRA", "24(b)", "80D", "87A", "Form 16", "gratuity", "115BAC"]
    body = f"""<section class="tool-hero"><div class="wrap">
  <p class="eyebrow">Your tax</p>
  <h1>Income tax section finder: old sections to the new Act</h1>
  <p class="lead">From 1 April 2026, almost every income tax section has a new number. Type an old section like 80C or a word like HRA, and see where it is in the Income-tax Act, 2025.</p>
  {badges("Checked against incometaxindia.gov.in")}
</div></section>

<section style="padding-top:0"><div class="wrap sf">
  <div class="card sf-box">
    <label class="lbl" for="sfQ" id="sfQLbl">Old section number or what you're looking for</label>
    <div class="sf-in"><input id="sfQ" type="search" autocomplete="off" spellcheck="false" placeholder="e.g. 80C, HRA, home loan, Form 16"><button type="button" class="btn-sm btn-ghost" id="sfClear" hidden>Clear</button></div>
    <p class="hint">Try: {" ".join(f'<a href="#" data-try="{t}">{t}</a>' for t in tries)}. You can also type a new section number, like 123.</p>
    <div class="sf-chips" id="sfChips" role="group" aria-label="Show sections about"></div>
    <div class="sf-regs" role="group" aria-labelledby="sfRegLbl"><span class="lbl" id="sfRegLbl">Tax regime</span><div class="seg row"><button type="button" data-f="any">Any</button><button type="button" data-f="new">Works in the new regime</button><button type="button" data-f="old">Old regime only</button></div></div>
  </div>
  <div class="sf-when">
    <div><b>Income up to 31 March 2026</b><span>Income-tax Act, 1961: the old numbers. Your return for 2025-26, filed in 2026, still uses them.</span></div>
    <div><b>Income from 1 April 2026</b><span>Income-tax Act, 2025: the new numbers, for tax year 2026-27 onwards.</span></div>
  </div>
  <p class="hint" id="sfCount" aria-live="polite"></p>
  <div class="sf-list" id="sfList"></div>
  <div class="actions sf-tools">
    <button type="button" class="btn-sm" id="sfShare">Copy link to this search</button>
  </div>
  <p class="status" id="sfStatus" role="status"></p>
</div></section>
{related("/income-tax-section-finder/")}
<div class="wrap aff-slot" aria-label="Sponsored"></div>

<section style="padding-top:0"><div class="wrap prose">
  <p class="g-callout"><b>Want the main ones in one place?</b> Read <a href="/guides/new-income-tax-section-numbers/">New income tax section numbers</a>: 80C, HRA, 24(b), Form 16 and more, with regime.</p>
  <h2>How to read the new section numbers</h2>
  <ul>
    <li><strong>Plain numbers.</strong> The new Act has no lettered sections like 80C or 80CCD(1B). Deductions are sections 122 to 154.</li>
    <li><strong>Tables and schedules.</strong> Many rules now sit in a table inside a section, or in a schedule at the end of the Act. \"19(1), Table S. No. 2\" means serial number 2 of the table in section 19(1).</li>
    <li><strong>Same benefits.</strong> Limits and conditions carried over. What changed is where they're written.</li>
    <li><strong>Forms renumbered too.</strong> Form 16 is now Form 130 and Form 12BB is Form 124.</li>
    <li><strong>Old or new regime.</strong> Each section shows whether you can use it under both tax regimes or only the old one. Tap the label for what it means. Under the new regime (section 202), most deductions, HRA, LTA, professional tax and interest on a home you live in aren't allowed; the standard deduction and your employer's NPS contribution are.</li>
  </ul>
  <h2 id="sources">Sources</h2>
  <p>Every mapping, and which regime each one applies under (section 202(2)), was checked against the section text of the Income-tax Act, 2025 (as amended by the Finance Act, 2026) on the <a href="https://www.incometaxindia.gov.in/" rel="noopener">Income Tax Department's website</a>, on 14 November 2026, along with the department's FAQs on the transition and on Forms 124 and 130. Read <a href="/methodology/">how we check our numbers</a>.</p>
  <h2>Frequently asked questions</h2>
  {faq_html(faqs)}
</div></section>
"""
    graph = [{"@type": "WebApplication", "name": "Income Tax Section Finder", "url": SITE + "/income-tax-section-finder/", "applicationCategory": "FinanceApplication",
              "operatingSystem": "Any", "browserRequirements": "Requires JavaScript", "isAccessibleForFree": True, "inLanguage": "en-IN",
              "offers": {"@type": "Offer", "price": "0", "priceCurrency": "INR"}, "dateModified": VERIFIED,
              "description": "Find the Income-tax Act, 2025 section for any common Income-tax Act, 1961 section, such as 80C, 80D, HRA and 24(b).", "publisher": {"@id": SITE + "/#org"}},
             faq_ld(faqs)]
    body = add_tips(body, "sf", SF_TIPS)
    return layout("/income-tax-section-finder/", "Income Tax Section Finder: 1961 Act to 2025 Act",
                  "Find the new section number for 80C, 80D, HRA, 24(b), 87A, Form 16 and more under the Income-tax Act, 2025. Checked against the official text.",
                  body, crumbs=[("/", "Home"), ("/income-tax-section-finder/", "Section Finder")], graph=graph,
                  css=("tool.css",), js=("sections.js",), og="og-income-tax-section-finder.png", og_title="Income tax section finder: old sections to the new Act")

SF_TIPS = [
    ("""<label class="lbl" for="sfQ" id="sfQLbl">Old section number or what you're looking for</label>""", "searching",
     "Type an old section (80C, 10(13A), 24(b)), a new one (123), a form (Form 16) or plain words (health insurance, home loan). Brackets and spaces don't matter."),
]

def gratuity_page():
    faqs = [
        ("How is gratuity calculated?",
         "Gratuity = last drawn monthly wages × 15 ÷ 26 × years of service. That's 15 days' wages for every year, counting a month as 26 working days. Under the Code on Social Security, 2020, a part-year of more than six months counts as a full year, so 7 years and 7 months counts as 8 years. The most your employer has to pay is ₹20 lakh."),
        ("What does \"Gratuity already received earlier\" mean, and why do you ask for it?",
         "It's the total gratuity you've received over your whole career so far, from every past employer added together. If this is your first job, or you've never received gratuity before, enter 0. We ask because of tax: only ₹20 lakh of gratuity is tax-free over your lifetime, not ₹20 lakh per job. Whatever was tax-free earlier uses up part of that limit, so it decides how much of this payout is tax-free and how much is added to your taxable salary. For example, if you got ₹6 lakh tax-free from a past employer, only ₹14 lakh of the limit is left. If part of an earlier payout was taxed, enter only the tax-free part."),
        ("How many years do I need to work to get gratuity?",
         "Permanent employees need 5 years of continuous service. Fixed-term (contract) employees qualify after 1 year and get gratuity in proportion to their service. If an employee dies or is disabled, gratuity is paid whatever the length of service."),
        ("What changed with the new labour codes?",
         "From 21 November 2025, gratuity is under section 53 of the Code on Social Security, 2020. Two changes matter most. Fixed-term employees now qualify after 1 year. And \"wages\" has a new definition: if your allowances (everything other than basic, DA and retaining allowance) are more than half your total pay, the excess counts as wages. So wages are at least half your total pay, which raises gratuity for anyone whose basic is a small part of their pay."),
        ("Is my gratuity taxed?",
         "Gratuity up to ₹20 lakh over your whole career is tax-free for private-sector employees, under section 19 of the Income-tax Act, 2025 (earlier section 10(10) of the 1961 Act). This applies under both the old and new tax regimes. Anything above the limit is added to your salary for the year and taxed at your slab rate. Gratuity for central and state government employees is fully tax-free. One open point: for employees covered by gratuity law, the tax rule still refers to the old Payment of Gratuity Act, 1972, so it hasn't been clarified whether the extra gratuity from the new wage rule is fully tax-free. We show it as tax-free, up to the limit."),
        ("Does service before 21 November 2025 count under the new wage rule?",
         "This hasn't been settled clearly yet. Your service before that date still counts towards your years. What's unclear is whether the wider definition of wages applies to gratuity for those earlier years. We show your gratuity under both the old rule (basic + DA) and the labour codes, so you can see the range. Check with your employer how they're paying it."),
        ("What if my employer isn't covered by the Code?",
         "The Code applies to establishments with 10 or more employees. If yours isn't covered, gratuity depends on your employer's policy or contract. For tax, the tax-free part is the least of: the gratuity you receive, ₹20 lakh less what you've had tax-free before, and half your average monthly salary over the last 10 months × completed years of service."),
    ]
    def num(k, label, hint="", lid=None):
        return (f'<div class="fld"><div class="row1"><label for="gr-{k}"{f" id={chr(34)}{lid}{chr(34)}" if lid else ""}>{label}</label><span class="w" id="gr-{k}-w"></span></div>'
                f'<div class="numin"><span>₹</span><input id="gr-{k}" type="text" inputmode="numeric" autocomplete="off"></div>'
                + (f'<p class="hint">{hint}</p>' if hint else "") + "</div>")
    body = f"""<section class="tool-hero"><div class="wrap">
  <p class="eyebrow">Your job</p>
  <h1>Gratuity calculator, under the new labour codes</h1>
  <p class="lead">See how much gratuity you'll get when you leave, under the wage rule that took effect on 21 November 2025. Find out how much of it is tax-free, when you become eligible, and what staying a little longer would add.</p>
  {badges("Tax rules for tax year " + TAX_YEAR)}
</div></section>

<section style="padding-top:0"><div class="wrap lp rb gr">
  <div class="card lp-setup" aria-label="Your job">
    <div><span class="lbl" id="typeLbl">Your employment</span>
      <div class="seg row" role="group" aria-labelledby="typeLbl"><button type="button" data-type="permanent">Permanent</button><button type="button" data-type="fixed">Fixed-term</button></div></div>
    <div><span class="lbl" id="reasonLbl">Why are you leaving?</span>
      <div class="seg row" role="group" aria-labelledby="reasonLbl"><button type="button" data-reason="leave">Resigning, retiring or contract ending</button><button type="button" data-reason="death">Death or disablement</button></div></div>
    <div><span class="lbl" id="employerLbl">Your employer</span>
      <div class="seg row" role="group" aria-labelledby="employerLbl"><button type="button" data-employer="covered">Private, 10+ employees</button><button type="button" data-employer="notcovered">Private, under 10</button><button type="button" data-employer="govt">Government</button></div></div>
    <div class="fld"><label class="lbl" for="gr-join" style="margin:0">Date you joined</label><input class="sel" type="date" id="gr-join" min="1960-01-01"></div>
    <div class="fld"><label class="lbl" for="gr-leave" style="margin:0">Date you leave</label><input class="sel" type="date" id="gr-leave" min="1960-01-01"><p class="hint">Use today's date to see what you'd get if you left now.</p></div>
    <p class="hint" id="gr-svc"></p>
    {num("basic", "Basic + DA a month", "From your payslip: basic pay plus dearness allowance, if you get it.")}
    {num("total", "Total pay a month", "Your full monthly pay before deductions: basic, DA, HRA and all other allowances. Leave out bonus, overtime and your employer's PF.")}
    <p class="hint" id="gr-wageTxt"></p>
    <div id="gr-avg-box" hidden>{num("avg10", "Average salary, last 10 months", "Average monthly basic + DA over the 10 months before you leave. Used only for the tax-free limit.")}</div>
    <div id="gr-earlier-box">{num("earlier", "Gratuity already received earlier", "The <b>total</b> gratuity you've received over your whole career so far, from all past employers added together. Enter 0 if you've never received gratuity. We ask because only ₹20 lakh of gratuity is tax-free in your lifetime, so what you've had tax-free before reduces the tax-free part of this payout.", lid="gr-earlierLbl")}</div>
  </div>

  <div>
    <div class="verdict" id="grVerdict" aria-live="polite"></div>
    <div class="actions">
      <button type="button" class="btn-sm pri" id="grPdf">Download PDF report</button>
      <button type="button" class="btn-sm" id="grXlsx">Download Excel</button>
      <button type="button" class="btn-sm btn-ghost" id="grShare">Copy share link</button>
    </div>
    <p class="status" id="grStatus" role="status"></p>
    <div class="stats">
      <div class="stat"><div class="l">Gratuity</div><div class="n" id="grGrat">—</div><div class="h">Before tax</div></div>
      <div class="stat"><div class="l">Tax-free</div><div class="n" id="grFree">—</div><div class="h">Not taxed</div></div>
      <div class="stat"><div class="l">Taxable</div><div class="n" id="grTax">—</div><div class="h">Added to your salary</div></div>
      <div class="stat"><div class="l">Tax-free limit available</div><div class="n" id="grRoom">—</div><div class="h" id="grRoomH">Of your ₹20 lakh lifetime limit</div></div>
    </div>
    <p class="g-callout" id="grStay" hidden></p>
    <div id="grCmpBox"><h2 class="list-h">Old rule vs labour codes</h2>
    <div class="sens" id="grCmp" style="grid-template-columns:repeat(2,minmax(0,1fr))"></div></div>
    <div class="chartbox" id="grChartBox">
      <h2 class="list-h" style="margin:0 0 4px">Your gratuity by years of service</h2>
      <p class="hint" style="margin:0 0 10px">At your current pay, up to the ₹20 lakh maximum. The dot is where you are.</p>
      <div id="grChart"></div>
      <div class="legend2"><span><i style="background:var(--brand)"></i>Labour codes</span><span><i style="background:var(--leave)"></i>Old rule: basic + DA</span></div>
    </div>
    <a class="next" href="/budget-planner/"><span class="k">Your next decision</span><b>Changing jobs? Plan your budget for the gap</b><span class="h">See what's left each month, with yearly costs set aside.</span></a>
    <a class="next" href="/sip-calculator/" style="margin-top:12px"><span class="k">Also useful</span><b>Investing your gratuity? See what it could grow to</b><span class="h">Add it as a lump sum in the SIP calculator.</span></a>
    <h2 class="list-h">Assumptions</h2>
    <ul class="notes" id="grNotes"></ul>
  </div>
</div></section>
{related("/gratuity-calculator/")}
<div class="wrap aff-slot" aria-label="Sponsored"></div>

<section style="padding-top:0"><div class="wrap prose">
  <p class="g-callout"><b>New to gratuity?</b> Read our guide, <a href="/guides/gratuity-new-labour-codes/">Gratuity under the new labour codes</a>, worked through one employee's numbers. Planning to resign? Read <a href="/guides/gratuity-six-month-rule-when-to-resign/">When to resign: the six-month rule</a>. Had gratuity before? Read <a href="/guides/is-gratuity-taxable-20-lakh-limit/">Is gratuity taxable? The ₹20 lakh lifetime limit</a>.</p>
  <h2>How the calculator works</h2>
  <ul>
    <li><strong>Years counted:</strong> your completed years, plus one more if the part-year is over six months.</li>
    <li><strong>Wages:</strong> basic + DA, or half your total pay if that's higher, as the labour codes require.</li>
    <li><strong>Gratuity:</strong> wages × 15 ÷ 26 × years counted, up to ₹20 lakh.</li>
    <li><strong>Tax-free limit available:</strong> ₹20 lakh, less the gratuity you received earlier. This payout is tax-free up to that amount.</li>
    <li><strong>Stay longer:</strong> the next date your counted years go up, and what that adds.</li>
  </ul>
  <h2 id="sources">Sources</h2>
  <p>Gratuity: section 53 of the <a href="https://labour.gov.in/" rel="noopener">Code on Social Security, 2020</a>, in force from 21 November 2025. Tax: section 19 of the <a href="https://www.incometaxindia.gov.in/" rel="noopener">Income-tax Act, 2025</a> (Table: S. No. 3 for government employees, S. No. 5 for employees covered by gratuity law, S. No. 6 for others), which replaces section 10(10) of the 1961 Act. Checked for tax year {TAX_YEAR}. Read <a href="/methodology/">how we check our numbers</a>.</p>
  <h2>Frequently asked questions</h2>
  {faq_html(faqs)}
</div></section>
<div class="rb-bar" id="grBar" hidden><span id="grBarT"></span><button type="button" class="btn-sm pri" id="grBarBtn">See the result</button></div>
"""
    graph = [{"@type": "WebApplication", "name": "Gratuity Calculator", "url": SITE + "/gratuity-calculator/", "applicationCategory": "FinanceApplication",
              "operatingSystem": "Any", "browserRequirements": "Requires JavaScript", "isAccessibleForFree": True, "inLanguage": "en-IN",
              "offers": {"@type": "Offer", "price": "0", "priceCurrency": "INR"}, "dateModified": VERIFIED,
              "description": "Gratuity calculator under the new labour codes: amount, eligibility, the tax-free part after earlier gratuity, and what staying longer adds.", "publisher": {"@id": SITE + "/#org"}},
             faq_ld(faqs)]
    body = add_tips(body, "gr", GR_TIPS)
    return layout("/gratuity-calculator/", "Gratuity Calculator under the New Labour Codes",
                  "Work out your gratuity under the new labour codes: the amount, when you become eligible, how much is tax-free and what staying longer adds. Free.",
                  body, crumbs=[("/", "Home"), ("/gratuity-calculator/", "Gratuity Calculator")], graph=graph,
                  css=("tool.css",), js=("gratuity.js",), og="og-gratuity-calculator.png", og_title="Gratuity calculator under the new labour codes")

GR_TIPS = [
    ("""<span class="lbl" id="typeLbl">Your employment</span>""", "employment type",
     "Fixed-term means a contract for a set period. Fixed-term employees qualify for gratuity after 1 year; permanent employees after 5 years."),
    ("""<span class="lbl" id="employerLbl">Your employer</span>""", "employer type",
     "The Code covers establishments with 10 or more employees. Government means central or state government service, where gratuity follows separate rules and is fully tax-free."),
    ("""<label for="gr-total">Total pay a month</label>""", "total pay",
     "Needed for the new wage rule: if your allowances are more than half your total pay, the excess counts as wages. So your wages for gratuity are at least half your total pay."),
    ("""<label for="gr-earlier" id="gr-earlierLbl">Gratuity already received earlier</label>""", "gratuity received earlier",
     "Add up every gratuity you've received from past employers over your career, for example ₹2 lakh from your first job and ₹4 lakh from your second: enter ₹6,00,000. The ₹20 lakh tax-free limit is for your whole life, not per job, so this tells us how much of the limit you have left. If part of an earlier payout was taxed, enter only the tax-free part."),
    ("""<div class="l">Tax-free limit available</div>""", "the tax-free limit available",
     "How much of your ₹20 lakh lifetime tax-free limit you can use for this payout: ₹20 lakh minus the gratuity you received earlier. This payout is tax-free up to this amount, and anything above it is taxed at your slab rate. The figure below shows what's left for any future gratuity after this payout."),
]

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
  <p class="g-callout"><b>New to part-payments?</b> Read our guide, <a href="/guides/how-part-payments-cut-your-home-loan/">How part-payments cut your home loan</a>, worked through one ₹50 lakh loan. Also read: <a href="/guides/prepay-home-loan-early-or-later/">Prepay now or later? Why the timing matters</a>.</p>
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
  <p class="g-callout"><b>New to this decision?</b> Read our guide, <a href="/guides/company-car-lease-vs-car-loan/">Company car lease or car loan? How to decide</a>, worked through one employee's numbers. Also read: <a href="/guides/company-car-perquisite-value-2026/">Company car perquisite value from April 2026</a> and <a href="/guides/car-lease-new-tax-regime/">Car lease under the new tax regime</a>.</p>
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
    ("/guides/how-part-payments-cut-your-home-loan/", "How part-payments cut your home loan, with a worked example",
     "How EMIs work, how much a part-payment saves, cutting the tenure or the EMI, why earlier is better and what a rate change does, worked through one ₹50 lakh loan.",
     "2026-11-13", "guide-emi-part-payments", "Your loans"),
    ("/guides/car-lease-new-tax-regime/", "Car lease under the new tax regime: is it still worth it?",
     "Why a company car lease still cuts tax under the new regime, who gains at each salary level, and when a loan is the better choice.",
     "2026-11-13", "guide-car-new-regime", "Your car"),
    ("/guides/plan-for-school-fees-and-yearly-costs/", "How to plan for school fees and other yearly costs",
     "List your yearly costs, turn them into one monthly set-aside, give them their own account and time it right, with an example family's month-by-month plan.",
     "2026-11-13", "guide-yearly-costs", "Your money"),
    ("/guides/how-much-do-you-need-to-retire/", "How much do you need to retire? One person's numbers",
     "How to work out your retirement number: what you'll need, what EPF and SIPs add up to, the gap, and what closes it.",
     "2026-11-14", "guide-retire-main", "Your investments"),
    ("/guides/25x-rule-retirement-india/", "The 25× rule: does it work in India with 6% inflation?",
     "The 25 times rule for retirement, why higher inflation in India changes it, and the multiple you actually need for 25, 30 or 35 years.",
     "2026-11-14", "guide-25x", "Your investments"),
    ("/guides/transfer-pf-dont-withdraw/", "Changed jobs? Transfer your PF, don't withdraw it",
     "What withdrawing PF at a job change really costs, how to transfer it with your UAN and Form 13, and what happens to EPS.",
     "2026-11-14", "guide-pf-transfer", "Your investments"),
    ("/guides/eps-pension-explained/", "EPS explained: your EPF pension, job changes and how to claim it",
     "What the Employees' Pension Scheme is, how the pension is worked out under EPS 2026, what happens to it when you change jobs, and how to claim it.",
     "2026-11-14", "guide-eps", "Your investments"),
    ("/guides/how-much-epf-at-58/", "How much will your EPF be at 58? One employee's numbers",
     "What EPF could grow to by 58 at 8.25%, where it comes from, what the rate, VPF and capped wages change, and the EPS pension on top.",
     "2026-11-14", "guide-epf-main", "Your investments"),
    ("/guides/epf-wage-ceiling-25000/", "The ₹25,000 EPF wage ceiling: what it changes for your PF, pension and take-home",
     "From 17 September 2026 the EPF wage ceiling is ₹25,000. Who it covers, what it does to contributions, take-home pay and your EPS pension.",
     "2026-11-14", "guide-wage-ceiling", "Your investments"),
    ("/guides/nps-new-exit-rules/", "NPS under the new exit rules: what salaried people get at 60",
     "How NPS works for salaried people after PFRDA's December 2025 changes: up to 80% lump sum, the tax-free 60%, and one saver's numbers at 60.",
     "2026-11-14", "guide-nps-main", "Your investments"),
    ("/guides/employer-nps-14-percent-new-regime/", "Employer NPS at 14% under the new regime: should you ask for it?",
     "Moving part of your pay into employer NPS saves tax even in the new regime. What it saves at 10%, 20% and 30% slabs, the old-regime limit and the ₹7.5 lakh cap.",
     "2026-11-14", "guide-employer-nps", "Your investments"),
    ("/guides/nps-80-percent-withdrawal-tax/", "NPS 80% withdrawal: the tax gap above 60%",
     "PFRDA allows an 80% lump sum, but only 60% is tax-free. What the extra 20% costs in tax for ₹50 lakh, ₹1 crore and ₹2 crore corpuses, and how to choose.",
     "2026-11-14", "guide-nps-gap", "Your investments"),
    ("/guides/nps-vs-ppf-vs-epf/", "NPS vs PPF vs EPF: which is better for retirement?",
     "Return, risk, lock-in and tax for EPF, PPF and NPS, with ₹1.5 lakh a year for 25 years in each, and how to use them together.",
     "2026-11-14", "guide-nps-vs", "Your investments"),
    ("/guides/petrol-cng-or-ev-cost-per-km/", "Petrol, CNG or EV: what a car really costs per km",
     "Petrol, CNG and electric versions of the same car compared per km at 500 to 3,000 km a month, with loan, insurance, service and resale, and the break-even distances.",
     "2026-11-14", "guide-car-cost", "Your car"),
    ("/guides/sip-or-lump-sum-bonus/", "SIP or lump sum: what to do with your bonus",
     "Invest your bonus all at once or spread it over 6 to 12 months? What each did over 10 years with steady returns, after a fall and after a rise.",
     "2026-11-14", "guide-bonus-sip", "Your investments"),
    ("/guides/is-gratuity-taxable-20-lakh-limit/", "Is gratuity taxable? The ₹20 lakh lifetime limit for job-hoppers",
     "Gratuity is tax-free up to ₹20 lakh across your career, not per job. How earlier gratuity uses up the limit, worked through one job-hopper's numbers.",
     "2026-11-14", "guide-gratuity-tax", "Your pay"),
    ("/guides/fd-rd-or-ppf/", "FD, RD or PPF: where should your safe money go?",
     "How FDs, RDs and PPF compare after tax, worked through ₹1.5 lakh a year for 15 years at different tax slabs, and which to use for which goal.",
     "2026-11-14", "guide-fd-ppf-rd", "Your investments"),
    ("/guides/fd-interest-tax-below-50000/", "Is FD interest taxable below ₹50,000? TDS vs tax, explained",
     "FD interest is taxable from the first rupee. ₹50,000 is only the TDS limit. How TDS works, what to do when you file, and where savings interest fits.",
     "2026-11-14", "guide-fd-tds", "Your investments"),
    ("/guides/ppf-deposit-by-5-april/", "PPF: deposit by 5 April and earn more",
     "PPF pays interest on the lowest balance after the 5th of each month. What depositing by 5 April is worth against monthly or late deposits.",
     "2026-11-14", "guide-ppf-april", "Your investments"),
    ("/guides/new-income-tax-section-numbers/", "New income tax section numbers: what 80C, HRA and 24(b) are called now",
     "The Income-tax Act, 2025 renumbered almost every section. The ones salaried people use most, their new numbers, and whether they work under the new regime.",
     "2026-11-14", "guide-section-finder", "Your tax"),
    ("/guides/gratuity-six-month-rule-when-to-resign/", "When to resign: how the six-month rule changes your gratuity",
     "A part-year of more than six months counts as a full year for gratuity, so your last working day can be worth a year's gratuity. How to time your exit.",
     "2026-11-14", "guide-gratuity-resign", "Your pay"),
    ("/guides/are-your-sips-on-track/", "Already investing? How to check if your SIPs are on track for your goal",
     "A once-a-year check: what your funds are worth, what SIP you need from now, and what to do if you're behind or ahead. With one investor's numbers.",
     "2026-11-14", "guide-sip-on-track", "Your investments"),
    ("/guides/gratuity-new-labour-codes/", "Gratuity under the new labour codes: how much you'll get, with an example",
     "How gratuity is worked out under the labour codes, what counts as wages now, how your years are counted, when you qualify and how much is tax-free, worked through one employee's numbers.",
     "2026-11-14", "guide-gratuity", "Your pay"),
    ("/guides/is-rent-really-dead-money/", "Is rent really dead money? What buying costs that you never get back",
     "Rent is money you don't get back, but so is most of what a buyer spends: interest, stamp duty, upkeep and selling costs. How the two compare over 12 years.",
     "2026-11-14", "guide-rent-dead-money", "Your home"),
    ("/guides/prepay-home-loan-early-or-later/", "Prepay your home loan now or later? Why the timing matters",
     "What a ₹2 lakh part-payment saves in year 1, 5, 8, 12 or 16 of a home loan, why earlier always saves more, and the real reasons to wait.",
     "2026-11-14", "guide-prepay-timing", "Your loans"),
    ("/guides/how-much-sip-do-you-need/", "How much SIP do you need? Plan a goal with a step-up",
     "Turn a goal into a monthly SIP: put a number on it, add inflation, work out the SIP, and see how a step-up, an existing portfolio and returns change it.",
     "2026-11-14", "guide-sip-goal", "Your investments"),
    ("/guides/step-up-sip/", "Step-up SIP: how a 10% yearly increase changes your final amount",
     "What a step-up SIP is, how much it adds over 20 years at different step-ups, how much to step up and how to set it up.",
     "2026-11-14", "guide-step-up-sip", "Your investments"),
    ("/guides/how-mutual-fund-gains-are-taxed/", "How mutual fund gains are taxed when you sell",
     "Equity and debt fund tax rules for tax year 2026-27, how they apply to a SIP, a worked example, and legal ways to pay less.",
     "2026-11-14", "guide-mf-tax", "Your investments"),
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
        ("Your pay", [("/ctc-to-in-hand/", "CTC to In-hand", "What actually reaches your account each month, under the old and new regimes.", False, "After the 1 Feb 2027 Budget", []),
                      ("/salary-hike-calculator/", "Salary Hike Calculator", "What your hike really adds to your monthly take-home after tax and PF, and how two offers compare.", False, "After the 1 Feb 2027 Budget", []),
                      ("/gratuity-calculator/", "Gratuity Calculator", "Your gratuity under the new labour codes, how much is tax-free, and what staying longer adds.", L("/gratuity-calculator/"), "Coming soon", ["/guides/gratuity-new-labour-codes/", "/guides/gratuity-six-month-rule-when-to-resign/", "/guides/is-gratuity-taxable-20-lakh-limit/"])]),
        ("Your tax", [("/income-tax-section-finder/", "Income Tax Section Finder", "Old section numbers like 80C, HRA and 24(b), and where they are in the Income-tax Act, 2025.", L("/income-tax-section-finder/"), "Coming soon", ["/guides/new-income-tax-section-numbers/"])]),
        ("Your loans", [("/prepay-vs-invest/", "Prepay or Invest", "Should extra money go into your home loan or into investments? After tax.", True, "", ["/guides/prepay-home-loan-or-invest/", "/guides/prepay-home-loan-early-or-later/"]),
                        ("/emi-calculator/", "EMI Calculator", "Your EMI, with part-payments at any time and rate changes. Save your plan and carry on later.", L("/emi-calculator/"), "Coming soon", ["/guides/how-part-payments-cut-your-home-loan/"])]),
        ("Your investments", [("/sip-calculator/", "SIP Calculator", "What your SIP could grow to, or the SIP you need for a goal. With step-up and your existing portfolio.", L("/sip-calculator/"), "Coming soon", ["/guides/how-much-sip-do-you-need/", "/guides/step-up-sip/", "/guides/are-your-sips-on-track/", "/guides/how-mutual-fund-gains-are-taxed/", "/guides/sip-or-lump-sum-bonus/"]),
                              ("/fd-ppf-rd-calculator/", "FD, PPF and RD Calculator", "What your FD, RD or PPF grows to after tax, whether TDS applies, and all three compared.", L("/fd-ppf-rd-calculator/"), "Coming soon", ["/guides/fd-rd-or-ppf/", "/guides/fd-interest-tax-below-50000/", "/guides/ppf-deposit-by-5-april/"]),
                              ("/nps-calculator/", "NPS Calculator", "Your NPS at 60 under the new exit rules: lump sum, the taxed part and your pension. Plus employer NPS tax saving.", L("/nps-calculator/"), "Coming soon", ["/guides/nps-new-exit-rules/", "/guides/employer-nps-14-percent-new-regime/", "/guides/nps-80-percent-withdrawal-tax/", "/guides/nps-vs-ppf-vs-epf/"]),
                              ("/epf-calculator/", "EPF Calculator", "Your PF at retirement, what you and your employer put in, and your EPS pension, with the ₹25,000 wage ceiling.", L("/epf-calculator/"), "Coming soon", ["/guides/how-much-epf-at-58/", "/guides/eps-pension-explained/", "/guides/epf-wage-ceiling-25000/", "/guides/transfer-pf-dont-withdraw/", "/guides/nps-vs-ppf-vs-epf/"]),
                              ("/eps-pension-calculator/", "EPS Pension Calculator", "Your EPS pension for each wage-ceiling period, at any age from 50 to 60, or your withdrawal benefit under 10 years.", L("/eps-pension-calculator/"), "Coming soon", ["/guides/eps-pension-explained/", "/guides/transfer-pf-dont-withdraw/", "/guides/epf-wage-ceiling-25000/"]),
                              ("/retirement-planner/", "Retirement Planner", "How much you need to retire, what your EPF, NPS, SIPs and FDs add up to, and the extra SIP to close the gap.", L("/retirement-planner/"), "Coming soon", ["/guides/how-much-do-you-need-to-retire/", "/guides/25x-rule-retirement-india/", "/guides/nps-vs-ppf-vs-epf/"])]),
        ("Your home", [("/rent-vs-buy/", "Rent or Buy", "Owning against renting and investing the difference, after stamp duty and tax.", True, "",
                        ["/guides/rent-vs-buy/", "/guides/is-rent-really-dead-money/", "/guides/under-construction-vs-ready-to-move/", "/guides/hra-vs-home-loan-tax-benefits/"])]),
        ("Your money", [("/budget-planner/", "Budget Planner", "See what's really left each month, with yearly costs turned into monthly set-asides.", True, "",
                         ["/guides/monthly-budget/", "/guides/budget-on-50000-1-lakh-2-lakh-salary/", "/guides/plan-for-school-fees-and-yearly-costs/"])]),
        ("Your car", [("/company-car-lease-vs-loan/", "Car Lease vs Car Loan", "Lease a car through your company or buy it on a loan? After tax, running costs and resale.", L("/company-car-lease-vs-loan/"), "Coming soon",
                       ["/guides/company-car-lease-vs-car-loan/", "/guides/company-car-perquisite-value-2026/", "/guides/car-lease-new-tax-regime/"]),
                      ("/car-ownership-cost/", "Car Ownership Cost", "What a petrol, diesel, CNG or electric car really costs per month and per km, after resale. Compare two.", L("/car-ownership-cost/"), "Coming soon", ["/guides/petrol-cng-or-ev-cost-per-km/"])]),
    ]
QUICK_SOON = (["SIP calculator"] if not SIP_LIVE else []) + (["FD, PPF and RD"] if not DEPOSITS_LIVE else []) + (["Gratuity"] if not GRATUITY_LIVE else []) + ["Old vs new regime", "HRA exemption"] + (["Vehicle ownership cost"] if not CAROWN_LIVE else []) + (["Old-to-new section finder"] if not SECTIONS_LIVE else [])

def quick_chips():
    live = "".join(f'<a class="qchip" href="{u}">{n}</a>' for u, n in LIVE_TOOLS if u in QUICK_TOOLS)
    soon = "".join(f'<span class="qchip off">{n}<small>Soon</small></span>' for n in QUICK_SOON[:6 - len(QUICK_TOOLS)])
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
    IC = {"Your investments": "I_GROW", "Your time off": "I_CAL", "Your pay": "I_PAY", "Your loans": "I_LOAN", "Your home": "I_HOME", "Your money": "I_WALLET", "Your car": "I_CAR", "Your tax": "I_TAX"}
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

def guide_emi():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_emi_numbers.js")]))
    b, ot, oe, y1, y10, bo, be, pl, rt, re_, pr = (G[k] for k in ["base", "one_t", "one_e", "yr1", "yr10", "bonus", "bonus_e", "plan", "rate_t", "rate_e", "planRate"])
    path = "/guides/how-part-payments-cut-your-home-loan/"
    def sv(x): return _L(b["totInt"] - x["totInt"])
    def mc(x): return mths_txt(b["months"] - x["months"])
    toc = [("short-answer", "The short answer"), ("emi", "How your EMI works"), ("example", "The example: Karthik's loan"), ("one", "One part-payment"),
           ("tenure-emi", "Cut the tenure or the EMI?"), ("timing", "Why earlier is better"), ("bonus", "A part-payment every year"), ("rate", "When the rate changes"),
           ("plan", "Karthik's plan, all together"), ("tips", "Before you part-pay"), ("method", "How these numbers were worked out")]
    body = guide_head(path, "A home loan EMI looks fixed, but you can change how long you pay it. Part-payments, even small ones now and then, cut years off a loan and lakhs of interest. Here's how they work, worked through one borrower's ₹50 lakh loan.",
                      "A loan balance falling faster with part-payments marked along the way").replace("TYPE_LINE", "")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>On a ₹50 lakh home loan at 8.5% for 20 years, the EMI is {_inr(b['emi0'])} and you pay <strong>{_L(b['totInt'])} in interest</strong>. A part-payment of ₹2 lakh every April, from your bonus, cuts that by <strong>{sv(bo)}</strong> and closes the loan in <strong>{bo['end']} instead of {b['end']}</strong>.</p>
<p>Three rules make the most of every part-payment: pay as early as you can, choose to cut the tenure rather than the EMI, and keep going every year.</p>
<p class="g-cta"><a class="btn" href="/emi-calculator/">Plan your part-payments</a></p>

<h2 id="emi">How your EMI works</h2>
<p>Each month, the bank charges interest on the loan still left, and the rest of your EMI pays the loan down. Early on, the loan is large, so most of the EMI is interest. In the first year of a ₹50 lakh loan at 8.5%, <strong>{_L(b['y1']['i'])} of the {_L(b['emi0'] * 12)} you pay is interest</strong>, and only {_L(b['y1']['p'])} reduces the loan.</p>
<p>A part-payment goes straight to the loan. That lowers the interest charged every month after it, for the rest of the loan. That's why it saves far more than its own size.</p>

<h2 id="example">The example: Karthik's loan</h2>
<p>Karthik, 31, has taken a ₹50 lakh home loan at a floating rate of 8.5% for 20 years. His first EMI is in December 2026. He gets a bonus every April and can spare ₹2 lakh of it, and he has ₹1 lakh he could put in right away. Karthik is an example; use your own loan in the calculator.</p>
<div class="g-scroll"><table class="g-tbl"><tbody>
<tr><th scope="row">EMI</th><td>{_inr(b['emi0'])} a month</td></tr>
<tr><th scope="row">Total interest, no part-payments</th><td>{_L(b['totInt'])}</td></tr>
<tr><th scope="row">Last EMI</th><td>{b['end']}</td></tr>
</tbody></table></div>

<h2 id="one">One part-payment</h2>
<p>If Karthik pays ₹1 lakh now, after his first EMI, and keeps his EMI the same, he saves <strong>{sv(ot)} of interest</strong> and finishes {mc(ot)} sooner, in {ot['end']}. That's more than four times the ₹1 lakh he put in.</p>

<h2 id="tenure-emi">Cut the tenure or the EMI?</h2>
<p>After a part-payment, banks let you either keep your EMI and shorten the loan, or keep the end date and lower your EMI.</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">₹1 lakh now</th><th scope="col">EMI after</th><th scope="col">Loan ends</th><th scope="col">Interest saved</th></tr></thead><tbody>
<tr><th scope="row">Cut the tenure</th><td data-l="EMI after">{_inr(ot['emiLast'])}</td><td data-l="Loan ends">{ot['end']}</td><td data-l="Interest saved"><strong>{sv(ot)}</strong></td></tr>
<tr><th scope="row">Cut the EMI</th><td data-l="EMI after">{_inr(oe['emiLast'])}</td><td data-l="Loan ends">{oe['end']}</td><td data-l="Interest saved">{sv(oe)}</td></tr>
</tbody></table></div>
<p>Cutting the tenure saves about four times as much, because the full EMI keeps working on a smaller loan. Choose a lower EMI only if you need the breathing room each month.</p>

<h2 id="timing">Why earlier is better</h2>
<p>The same ₹2 lakh saves very different amounts depending on when you pay it:</p>
<ul>
  <li><strong>In April 2027,</strong> in year 1: saves {sv(y1)} and {mc(y1)}.</li>
  <li><strong>In April 2036,</strong> in year 10: saves {sv(y10)} and {mc(y10)}.</li>
</ul>
<p>An early part-payment cuts interest for more years. If you're choosing between part-paying now or later, now wins.</p>

<h2 id="bonus">A part-payment every year</h2>
<p>If Karthik puts ₹2 lakh of his bonus in every April, the loan closes in <strong>{bo['end']}</strong>, nearly ten years early, and he saves <strong>{sv(bo)}</strong> of interest. If he chose to lower his EMI each time instead, he'd save {sv(be)} and still be paying until {be['end']}.</p>
<p>In the calculator, add the part-payment once and tick "Repeat every year".</p>

<h2 id="rate">When the rate changes</h2>
<p>Floating rates move. If Karthik's rate rose to 9.25% from June 2027:</p>
<ul>
  <li><strong>EMI stays the same</strong> (what most banks do): the loan runs until {rt['end']}, {mths_txt(rt['months'] - b['months'])} longer, and costs {_L(rt['totInt'] - b['totInt'])} more in interest.</li>
  <li><strong>End date stays the same:</strong> his EMI rises to {_inr(re_['emiLast'])}, and the extra interest is {_L(re_['totInt'] - b['totInt'])}.</li>
</ul>
<p>When rates rise, banks often stretch the tenure quietly. Check your loan statement after a rate change, and ask to raise your EMI if you'd rather keep your end date.</p>

<h2 id="plan">Karthik's plan, all together</h2>
<p>₹1 lakh now, ₹2 lakh every April, EMI kept the same:</p>
<ul>
  <li>At 8.5%: the loan closes in <strong>{pl['end']}</strong>, and he saves <strong>{sv(pl)}</strong> of interest.</li>
  <li>Even if the rate rises to 9.25% in June 2027, it closes in {pr['end']}, still almost a decade early.</li>
</ul>
<p>Part-payments are the best protection against rate rises: a smaller loan means each rise costs less.</p>

<h2 id="tips">Before you part-pay</h2>
<ol class="g-check">
  <li><strong>Keep an emergency fund first.</strong> Money in your loan is hard to get back.</li>
  <li><strong>Check the charges.</strong> RBI rules don't allow banks to charge for prepaying floating-rate loans taken by individuals for purposes other than business. Fixed-rate loans may have a charge.</li>
  <li><strong>Tell the bank what you want:</strong> a shorter tenure or a lower EMI. Get it in writing.</li>
  <li><strong>Compare with investing.</strong> If your loan rate is low and you can invest for the long term, investing may leave you richer. See <a href="/prepay-vs-invest/">Prepay or Invest</a>.</li>
  <li><strong>Keep your plan.</strong> Save it from the calculator, and update it each year from your loan statement.</li>
</ol>
<p class="g-cta"><a class="btn" href="/emi-calculator/">Try your own loan</a></p>

<h2 id="method">How these numbers were worked out</h2>
<p>Every figure comes from the same calculation as the <a href="/emi-calculator/">EMI calculator</a>: interest is charged monthly on the loan left, and each part-payment is made right after that month's EMI. Prepayment charges, processing fees and insurance aren't included. The RBI rule on prepayment charges is from its circular of 2 August 2019. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This guide is for information and education. It isn't financial advice. For a big decision, consider speaking to a qualified adviser.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "How Part-Payments Cut Your Home Loan: EMI, Tenure and Interest Saved (Worked Example) | Salarist", "How part-payments cut your home loan", body, "Part-payments on a home loan")

def mths_txt(n):
    n = round(n); y, m = divmod(n, 12)
    return " ".join(x for x in [f"{y} year{'s' if y != 1 else ''}" if y else "", f"{m} month{'s' if m != 1 else ''}" if m or not y else ""] if x)

def guide_car_newregime():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_car_numbers.js")]))
    S, sl = G["S"], G["slabs"]
    path = "/guides/car-lease-new-tax-regime/"
    bands = [("Up to ₹12,75,000", "0", "Nil, after the rebate"), ("₹12,75,001 – ₹16,75,000", "15", "15%"), ("₹16,75,001 – ₹20,75,000", "20", "20%"),
             ("₹20,75,001 – ₹24,75,000", "25", "25%"), ("Above ₹24,75,000", "30", "30%")]
    rows = "".join(f"<tr><th scope=\"row\">{a}</th><td data-l=\"Your top slab\">{t}</td><td data-l=\"Lease vs loan, Neha's car\">{('Lease saves ' + _L(sl[k]['diff'])) if sl[k]['diff'] > 0 else ('Loan saves ' + _L(-sl[k]['diff']))}</td></tr>" for a, k, t in bands)
    toc = [("short-answer", "The short answer"), ("why", "Why a lease works under the new regime"), ("who", "Who gains, by salary"), ("old", "And under the old regime?"),
           ("check", "Before you sign up"), ("method", "How these numbers were worked out")]
    body = guide_head(path, "The new tax regime takes away most deductions: no HRA, no home loan interest, no 80C. A company car lease still works, because it changes what counts as your salary rather than claiming a deduction. Here's who gains, and by how much.",
                      "A car with a price tag showing a rising value").replace("TYPE_LINE", f"<span>Written for tax year {TAX_YEAR}</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>Yes, a car lease is still worth it under the new regime if your salary is in the higher slabs. In our example, a {_L(S['price'])} car leased for {S['years']} years, the lease saves <strong>{_L(sl['30']['diff'])}</strong> over a loan in the 30% slab and <strong>{_L(sl['20']['diff'])}</strong> in the 20% slab. If your taxable salary is under about ₹12.75 lakh, you pay no tax anyway, and a loan comes out cheaper.</p>
<p class="g-cta"><a class="btn" href="/company-car-lease-vs-loan/">Check your own numbers</a></p>

<h2 id="why">Why a lease works under the new regime</h2>
<p>The new regime removes deductions, but a car lease isn't a deduction. Your company pays the lease rental and running costs out of your CTC, so that money never becomes taxable salary. You're taxed only on the car's fixed value, ₹5,000 or ₹7,000 a month under Rule 15 of the Income-tax Rules, 2026, and that rule is the same under both regimes.</p>
<p>That makes a lease one of the few ways left to cut tax under the new regime, alongside a few other salary items your employer may offer.</p>

<h2 id="who">Who gains, by salary</h2>
<p>New-regime slabs for tax year {TAX_YEAR}, shown as salary before the ₹75,000 standard deduction, and what the lease saves for Neha's car at each top slab:</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Salary, after the lease</th><th scope="col">Your top slab</th><th scope="col">Lease vs loan, Neha's car</th></tr></thead><tbody>{rows}</tbody></table></div>
<p>Tax is nil on total income up to ₹12 lakh because of the rebate, which is ₹12.75 lakh of salary after the standard deduction. Below that, a lease saves no tax, so you'd pay the leasing company's margin for nothing.</p>
<p>A lease also lowers your taxable salary, so it can move you into a lower slab. If your salary is near a slab edge, the saving on the part that drops below it is at the lower rate. Check where your salary lands after the lease rental and running costs come out.</p>

<h2 id="old">And under the old regime?</h2>
<p>The car rules are the same, but the old regime's slabs are steeper: 30% applies above ₹10 lakh of taxable income. So at the same salary, a lease often saves more under the old regime. Whichever regime you choose, use the slab you'll actually pay in the calculator.</p>

<h2 id="check">Before you sign up</h2>
<ol class="g-check">
  <li>Work out your taxable salary after the lease, and check which slab your top rupee falls in.</li>
  <li>Ask what the rental includes: GST, insurance, servicing.</li>
  <li>Ask whether fuel and a driver can go through the company too: that's where much of the saving comes from.</li>
  <li>Check the early closure terms in case you change jobs.</li>
</ol>
<p>For the full worked example, read <a href="/guides/company-car-lease-vs-car-loan/">Company car lease or car loan?</a>, and for the values you're taxed on, <a href="/guides/company-car-perquisite-value-2026/">Company car perquisite value from April 2026</a>.</p>
<p class="g-cta"><a class="btn" href="/company-car-lease-vs-loan/">Compare lease and loan</a></p>

<h2 id="method">How these numbers were worked out</h2>
<p>The lease-vs-loan figures come from the <a href="/company-car-lease-vs-loan/">Car Lease vs Car Loan Calculator</a>, run on Neha's car (a {_L(S['price'])} car, {_inr(S['rental'])} a month for {S['years']} years, fuel through the company, bought back for {_inr(S['buyback'])}) at each slab rate plus 4% cess. The slabs, rebate and standard deduction are the new-regime rules for tax year {TAX_YEAR}; the car values are from Rule 15 of the Income-tax Rules, 2026. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information and education. It isn't tax advice. Surcharge for very high incomes and marginal relief near ₹12 lakh aren't included; check with a tax adviser for your situation.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "Car Lease Under the New Tax Regime: Is It Still Worth It? (2026-27) | Salarist", "Car lease under the new tax regime", body, "Car lease, new regime")

def guide_yearly_costs():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_yearly_costs_numbers.js")]))
    path = "/guides/plan-for-school-fees-and-yearly-costs/"
    items = "".join(f"<tr><th scope=\"row\">{H.escape(i['name'])}</th><td data-l=\"A year\">{_inr(i['amt'])}</td><td data-l=\"Due in\">{i['when']}</td></tr>" for i in G["items"])
    rows = "".join(f"<tr><td class=\"nw\">{r['month']}</td><td data-l=\"Put aside\">{_inr(r['dep'])}</td><td data-l=\"Bills\">{_inr(r['bill']) if r['bill'] else '—'}</td><td data-l=\"In the account\"{' class=\"neg\"' if r['bal'] < -0.5 else ''}>{_inr(r['bal'])}</td></tr>" for r in G["now"]["rows"])
    sa = G["setAside"]
    toc = [("short-answer", "The short answer"), ("list", "Step 1: list every yearly cost"), ("monthly", "Step 2: turn them into one monthly amount"),
           ("account", "Step 3: give them their own account"), ("timing", "Watch the timing"), ("late", "What happens if you start late"), ("tips", "Make it stick"), ("method", "How these numbers were worked out")]
    body = guide_head(path, "Most budgets don't fail on groceries. They fail in April, when school fees are due, or in October, when Diwali lands on top of the fee instalment. Here's a simple way to see those costs coming and pay them without stress.",
                      "A calendar with yearly bills marked and a jar filling up each month").replace("TYPE_LINE", "")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<ol>
  <li>List every cost that comes once or twice a year: school fees, insurance, festivals, holidays.</li>
  <li>Add them up and divide by 12. For the family below, that's <strong>{_inr(sa)} a month</strong>.</li>
  <li>Move that amount into a separate account on salary day, every month, and pay the bills from there.</li>
  <li>Start with a small cushion, about one month's set-aside, because the bills don't arrive evenly.</li>
</ol>
<p class="g-cta"><a class="btn" href="/budget-planner/">Work out your set-aside</a></p>

<h2 id="list">Step 1: list every yearly cost</h2>
<p>Here's an example family with one child in school. Their yearly costs, and when each falls due:</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Cost</th><th scope="col">A year</th><th scope="col">Due in</th></tr></thead><tbody>{items}
<tr><th scope="row"><strong>Total</strong></th><td data-l="A year"><strong>{_inr(G['yearly'])}</strong></td><td></td></tr></tbody></table></div>
<p>Go through last year's bank statement to find yours. People usually miss vehicle servicing, gifts and school extras like books and transport deposits.</p>

<h2 id="monthly">Step 2: turn them into one monthly amount</h2>
<p>{_inr(G['yearly'])} a year is <strong>{_inr(sa)} a month</strong>. In the <a href="/budget-planner/">budget planner</a>, enter each cost as "a year" and it adds them up and shows the monthly set-aside for you.</p>
<p>Treat that amount like a bill. If your budget can't fit it, that's worth knowing now, not in April.</p>

<h2 id="account">Step 3: give them their own account</h2>
<p>Keep the set-aside away from your everyday spending: a separate savings account, a recurring deposit timed to your big bills, or a liquid fund. Set up a standing instruction for the day after salary day, so it happens without a decision.</p>

<h2 id="timing">Watch the timing</h2>
<p>The bills don't arrive evenly. October is the hardest month, with the second fee instalment and Diwali together: {_inr(G['big'][0]['bill'])}. Here's the account month by month, starting from nothing in December 2026:</p>
<div class="g-scroll"><table class="g-tbl g-stack g-yc"><thead><tr><th scope="col">Month</th><th scope="col">Put aside</th><th scope="col">Bills</th><th scope="col">In the account</th></tr></thead><tbody>{rows}</tbody></table></div>
<p>The account dips below zero twice, in May and October, by up to {_inr(G['buffer'])}. Starting with a one-time cushion of about <strong>{_inr(G['buffer'])}</strong>, one month's set-aside, keeps it positive all year. A small bonus or the first month's set-aside paid twice does the job.</p>

<h2 id="late">What happens if you start late</h2>
<p>If the family starts setting money aside only in April, when the first fee instalment is due, they're short by up to <strong>{_inr(-G['late']['low'])}</strong> during the year. That's the gap that ends up on a credit card or a personal loan. The earlier you start, the less it hurts.</p>

<h2 id="tips">Make it stick</h2>
<ol class="g-check">
  <li>Ask the school for the full year's fee schedule, including term fees and annual charges.</li>
  <li>Add fee increases: many schools raise fees every year, so plan for a bit more.</li>
  <li>Check insurance renewal dates and put them in your calendar.</li>
  <li>Plan the year's travel around the long weekends. See <a href="/guides/long-weekends-2027/">Long weekends 2027</a>.</li>
  <li>Use bonuses for the cushion or a part-payment, not to rescue a bad month.</li>
</ol>
<p>For the full budgeting method, read <a href="/guides/monthly-budget/">How to make a monthly budget on a salary</a>.</p>
<p class="g-cta"><a class="btn" href="/budget-planner/">Make your budget</a></p>

<h2 id="method">How these numbers were worked out</h2>
<p>The monthly set-aside comes from the same calculation as the <a href="/budget-planner/">budget planner</a>, which divides each yearly cost by 12. The month-by-month table adds the set-aside each month and takes away the bills due that month. The family and amounts are an example; school fees vary a lot by city and school. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information and education. It isn't financial advice.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "How to Plan for School Fees and Other Yearly Costs (With Monthly Set-Aside) | Salarist", "How to plan for school fees and yearly costs", body, "School fees and yearly costs")

def guide_sip_goal():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_sip_numbers.js")]))
    M = G["main"]; st, fl = M["step10Sim"], M["flatSim"]
    r100 = lambda v: _inr(math.ceil(v / 100) * 100)
    path = "/guides/how-much-sip-do-you-need/"
    toc = [("short-answer", "The short answer"), ("goal", "Step 1: put a number on the goal"), ("inflation", "Step 2: add inflation"), ("sip", "Step 3: work out the SIP"),
           ("stepup", "Why a step-up makes it doable"), ("existing", "If you already invest"), ("returns", "If returns are lower or higher"), ("late", "The cost of starting late"),
           ("tax", "Leave room for tax"), ("checklist", "Your plan in five steps"), ("method", "How these numbers were worked out")]
    body = guide_head(path, "A goal like your child's education feels far away and hard to price. Here's how to turn it into a monthly SIP you can actually start, worked through one parent's numbers: from the goal, to inflation, to a step-up that grows with your pay.",
                      "A rising line of savings reaching a flag on a hill").replace("TYPE_LINE", f"<span>Written for tax year {TAX_YEAR}</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>To have what ₹50 lakh buys today in 15 years, at 6% inflation, you need about <strong>{_L(M['goal'])}</strong>. At a 12% yearly return, that takes a SIP of <strong>{r100(M['flat'])} a month</strong>, or <strong>{r100(M['step10'])} a month</strong> to start if you raise it by 10% every year. If you already have ₹5 lakh invested, the starting SIP drops to <strong>{r100(M['existing'])}</strong>.</p>
<p class="g-cta"><a class="btn" href="/sip-calculator/">Work out your SIP</a></p>

<h2 id="goal">Step 1: put a number on the goal</h2>
<p>Priya, 32, wants to save for her daughter's college education in 15 years. Good courses cost about ₹50 lakh today, including living costs. That's her goal in today's money. Priya is an example; use your own goal in the calculator.</p>

<h2 id="inflation">Step 2: add inflation</h2>
<p>Education costs rise every year. At 6% a year, what costs ₹50 lakh today will cost about <strong>{_L(M['goal'])}</strong> in 15 years. That's the number her SIP has to reach. In the calculator, tick "This amount is in today's money" and it does this for you.</p>

<h2 id="sip">Step 3: work out the SIP</h2>
<p>Assuming her equity funds return 12% a year on average, Priya needs:</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Plan</th><th scope="col">SIP to start</th><th scope="col">Last year's SIP</th><th scope="col">Total put in</th></tr></thead><tbody>
<tr><th scope="row">Same SIP every year</th><td data-l="SIP to start">{r100(M['flat'])}</td><td data-l="Last year's SIP">{r100(fl['lastSip'])}</td><td data-l="Total put in">{_L(fl['invested'])}</td></tr>
<tr><th scope="row">10% step-up every year</th><td data-l="SIP to start"><strong>{r100(M['step10'])}</strong></td><td data-l="Last year's SIP">{r100(st['lastSip'])}</td><td data-l="Total put in">{_L(st['invested'])}</td></tr>
</tbody></table></div>

<h2 id="stepup">Why a step-up makes it doable</h2>
<p>{r100(M['flat'])} a month may be too much for Priya today. With a 10% yearly step-up, she starts at {r100(M['step10'])} and raises it as her pay grows. She puts in more in total, {_L(st['invested'])} against {_L(fl['invested'])}, because more of her money goes in later and has less time to grow, but the starting amount is far easier on today's budget.</p>
<p>Set the step-up to match your expected pay rise, not more. Read more in <a href="/guides/step-up-sip/">Step-up SIP: how a 10% yearly increase changes your final amount</a>.</p>

<h2 id="existing">If you already invest</h2>
<p>Priya already has ₹5 lakh in funds (she put in ₹4 lakh). That money keeps growing, so she needs less from new SIPs: <strong>{r100(M['existing'])} a month</strong> with a 10% step-up, or {r100(M['existingFlat'])} without. In the calculator, choose "I already invest" and enter your portfolio's value and what you've put in.</p>

<h2 id="returns">If returns are lower or higher</h2>
<p>Returns aren't guaranteed, and a couple of percent makes a real difference over 15 years. With a 10% step-up, Priya's starting SIP would be:</p>
<ul>
  <li>At 10% a year: <strong>{r100(M['r10'])}</strong></li>
  <li>At 12% a year: {r100(M['step10'])}</li>
  <li>At 14% a year: {r100(M['r14'])}</li>
</ul>
<p>Planning at a cautious return and being pleasantly surprised is better than the other way round.</p>

<h2 id="late">The cost of starting late</h2>
<p>If Priya waits 5 years and has only 10 years left, the starting SIP for the same goal jumps to <strong>{r100(M['late5'])}</strong> a month with a step-up, two and a half times as much. Time does most of the work in a SIP.</p>

<h2 id="tax">Leave room for tax</h2>
<p>The {_L(M['goal'])} is the value before tax. If Priya sells all her equity funds at once, tax on gains above ₹1,25,000 at 12.5% plus cess comes to about {_L(st['tax'])}, leaving {_L(st['after'])}. Aim slightly higher, or sell in stages over two or three years to use the yearly ₹1,25,000 limit more than once. Read <a href="/guides/how-mutual-fund-gains-are-taxed/">how mutual fund gains are taxed</a>.</p>

<h2 id="checklist">Your plan in five steps</h2>
<ol class="g-check">
  <li>Put today's cost on the goal.</li>
  <li>Choose the years and a cautious return, and let the calculator add inflation.</li>
  <li>Pick a starting SIP your budget can carry, with a step-up that matches your pay rise.</li>
  <li>Save your plan in the calculator.</li>
  <li>Once a year, load it, update your portfolio value from your statement, and check you're on track.</li>
</ol>
<p class="g-cta"><a class="btn" href="/sip-calculator/">Plan your goal</a></p>

<h2 id="method">How these numbers were worked out</h2>
<p>Every figure comes from the same calculation as the <a href="/sip-calculator/">SIP calculator</a>: each SIP goes in at the start of the month and returns compound so that a year gives exactly the rate shown. Tax uses the equity fund rules for tax year {TAX_YEAR}. Returns are assumptions, not predictions. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This guide is for information and education. It isn't investment advice. Mutual fund investments are subject to market risks; consider speaking to a qualified adviser.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "How much SIP do you need?", body, "How much SIP you need")

def guide_sip_step():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_sip_numbers.js")]))
    S_ = G["steps"]; s0, s5, s10, s15 = S_
    path = "/guides/step-up-sip/"
    rows = "".join(f"<tr><th scope=\"row\">{s['step']}% a year</th><td data-l=\"SIP in year 20\">{_inr(s['lastSip'])}</td><td data-l=\"Total put in\">{_L(s['invested'])}</td><td data-l=\"Value after 20 years\"><strong>{_L(s['value'])}</strong></td></tr>" for s in S_)
    toc = [("short-answer", "The short answer"), ("what", "What a step-up SIP is"), ("table", "The numbers over 20 years"), ("why", "Why it adds so much"),
           ("how", "How much to step up"), ("setup", "How to set it up"), ("method", "How these numbers were worked out")]
    body = guide_head(path, "Most people start a SIP and leave it at the same amount for years, even as their pay rises. A step-up raises it a little every year. Here's how much difference that makes, worked out with the Salarist SIP calculator.",
                      "Coin stacks rising step by step").replace("TYPE_LINE", "")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>₹10,000 a month for 20 years at 12% a year grows to about <strong>{_L(s0['value'])}</strong>. Raise it by 10% every year and it grows to about <strong>{_L(s10['value'])}</strong>, roughly twice as much. To get there without a step-up, you'd need to start at about {_inr(round(G['stepSame'], -2))} a month.</p>
<p class="g-cta"><a class="btn" href="/sip-calculator/">Try a step-up</a></p>

<h2 id="what">What a step-up SIP is</h2>
<p>A step-up (or top-up) SIP increases your monthly amount by a fixed percentage once a year. With ₹10,000 and a 10% step-up, you invest ₹10,000 a month in year 1, ₹11,000 in year 2, ₹12,100 in year 3, and so on. Most fund houses and apps let you set this once when you start.</p>

<h2 id="table">The numbers over 20 years</h2>
<p>Starting at ₹10,000 a month, 12% a year:</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Step-up</th><th scope="col">SIP in year 20</th><th scope="col">Total put in</th><th scope="col">Value after 20 years</th></tr></thead><tbody>{rows}</tbody></table></div>

<h2 id="why">Why it adds so much</h2>
<p>Part of the difference is simply that you put in more: {_L(s10['invested'])} with a 10% step-up, against {_L(s0['invested'])} without. But it's also painless, because each year's increase comes out of a pay rise, not out of today's budget. You never feel the full {_inr(s10['lastSip'])} a month you're investing by year 20.</p>

<h2 id="how">How much to step up</h2>
<ul>
  <li><strong>Match your pay rise, not more.</strong> If your salary grows 8–10% a year, a 10% step-up keeps your savings rate steady.</li>
  <li><strong>Be careful with big step-ups.</strong> At 15% a year, the SIP reaches {_inr(s15['lastSip'])} a month by year 20. That only works if your income keeps up.</li>
  <li><strong>Skip a year if you need to.</strong> Most platforms let you pause or change the step-up. A smaller increase is better than stopping the SIP.</li>
</ul>

<h2 id="setup">How to set it up</h2>
<ol class="g-check">
  <li>In your fund app, look for "step-up", "top-up" or "SIP increase" when you create or edit a SIP.</li>
  <li>Choose a percentage or a fixed amount, and the month it rises (just after your appraisal works well).</li>
  <li>Check your plan in the <a href="/sip-calculator/">SIP calculator</a>, and see <a href="/guides/how-much-sip-do-you-need/">how much SIP you need for a goal</a>.</li>
</ol>

<h2 id="method">How these numbers were worked out</h2>
<p>All figures come from the <a href="/sip-calculator/">SIP calculator</a>: each SIP goes in at the start of the month, returns compound so a year gives exactly 12%, and the SIP rises once every 12 months. Values are before tax. Returns are assumptions, not predictions. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information and education. It isn't investment advice. Mutual fund investments are subject to market risks.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "Step-up SIP", body, "Step-up SIP")

def guide_gratuity():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_gratuity_numbers.js")]))
    B, N, S1, S2, E6, E19, F, P4, T = G["base"], G["next"], G["sep1"], G["sep2"], G["earlier6"], G["earlier19"], G["fixed"], G["perm4"], G["table"]
    path = "/guides/gratuity-new-labour-codes/"
    rows = "".join(f"<tr><th scope=\"row\">{t['pct']}% of pay ({_inr(t['basic'])})</th><td data-l=\"Old rule: basic + DA\">{_inr(t['old'])}</td><td data-l=\"Labour codes\"><strong>{_inr(t['now'])}</strong></td><td data-l=\"Difference\">{'+' + _inr(t['now'] - t['old']) if t['now'] > t['old'] else 'None'}</td></tr>" for t in T)
    toc = [("short-answer", "The short answer"), ("formula", "The formula"), ("wages", "What counts as wages now"), ("example", "Neha's gratuity, worked out"),
           ("years", "How your years are counted"), ("eligible", "When you qualify"), ("tax", "How much is tax-free"), ("check", "Before you resign: a checklist"), ("method", "Sources")]
    body = guide_head(path, "Gratuity is the lump sum your employer pays when you leave after years of service. The labour codes that took effect on 21 November 2025 changed what counts as wages, which raises gratuity for many salaried people. Here's how to work out yours, with one employee's numbers.",
                      "A briefcase beside coin stacks that grow with each year of service").replace("TYPE_LINE", f"<span>Written for tax year {TAX_YEAR}</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>Gratuity is 15 days' wages for every year you've worked: <strong>monthly wages × 15 ÷ 26 × years</strong>. Under the labour codes, your wages for gratuity are at least half your total pay, even if your basic is lower. For Neha, with a ₹50,000 basic in a ₹1.2 lakh salary and 7 years 8 months of service, that's <strong>{_inr(B['grat'])}</strong>, against {_inr(B['gratOld'])} under the old basic-only rule.</p>
<p class="g-cta"><a class="btn" href="/gratuity-calculator/">Work out your gratuity</a></p>

<h2 id="formula">The formula</h2>
<p>Under section 53 of the Code on Social Security, 2020, gratuity is:</p>
<p class="g-formula"><strong>Last drawn monthly wages × 15 ÷ 26 × years of service</strong></p>
<p>The 26 is the number of working days in a month, so 15 ÷ 26 is 15 days' pay. The most an employer has to pay is ₹20 lakh, though some pay more under their own policy.</p>

<h2 id="wages">What counts as wages now</h2>
<p>Wages for gratuity are your basic pay plus dearness allowance (DA). The change is a floor: if your other allowances (HRA, special allowance, conveyance and so on) add up to more than half your total pay, the excess is counted as wages too. In practice, <strong>your wages for gratuity are the higher of your basic + DA, or half your total pay</strong>.</p>
<p>So the lower your basic as a share of your pay, the more the new rule adds. For a ₹1.2 lakh monthly salary and 8 years of service:</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Basic + DA</th><th scope="col">Old rule: basic + DA</th><th scope="col">Labour codes</th><th scope="col">Difference</th></tr></thead><tbody>{rows}</tbody></table></div>
<p>If your basic is already half your pay or more, nothing changes.</p>

<h2 id="example">Neha's gratuity, worked out</h2>
<p>Neha joined on 1 March 2019 and is leaving on 14 November 2026. Her basic is ₹50,000 and her total monthly pay is ₹1,20,000.</p>
<ol class="g-check">
  <li><strong>Service:</strong> 7 years, 8 months and 13 days. The part-year is more than six months, so it counts as <strong>8 years</strong>.</li>
  <li><strong>Wages:</strong> her basic (₹50,000) is less than half her pay (₹60,000), so her wages for gratuity are <strong>₹60,000</strong>.</li>
  <li><strong>Gratuity:</strong> ₹60,000 × 15 ÷ 26 × 8 = <strong>{_inr(B['grat'])}</strong>.</li>
  <li><strong>Under the old rule</strong> it would have been ₹50,000 × 15 ÷ 26 × 8 = {_inr(B['gratOld'])}, so the new rule adds {_inr(B['grat'] - B['gratOld'])}.</li>
</ol>

<h2 id="years">How your years are counted</h2>
<p>A part-year of <strong>more than six months</strong> counts as a full year. That makes the exact date you leave matter:</p>
<ul>
  <li>Had Neha left on 1 September 2026 (exactly 7 years 6 months), she'd get {_inr(S1['grat'])}, for 7 years.</li>
  <li>Leaving one day later, on 2 September, her service counts as 8 years: {_inr(S2['grat'])}, about {_inr(S2['grat'] - S1['grat'])} more.</li>
  <li>From today, her next step-up is on {_date(N['date'])}. Staying until then adds about {_inr(N['gain'])}.</li>
</ul>
<p>If you're planning to resign, check how close you are to the next half-year. The <a href="/gratuity-calculator/">gratuity calculator</a> shows the date and the amount.</p>

<h2 id="eligible">When you qualify</h2>
<ul>
  <li><strong>Permanent employees</strong> need 5 years of continuous service. Rounding doesn't help here: 4 years 8 months isn't 5 years. Someone who joined on 1 March 2022 qualifies on {_date(P4['eligibleOn'])}.</li>
  <li><strong>Fixed-term (contract) employees</strong> qualify after just 1 year, a change made by the labour codes. A fixed-term employee on Neha's pay with 1 year 8 months of service would get {_inr(F['grat'])}.</li>
  <li><strong>On death or disablement</strong>, gratuity is paid whatever the length of service.</li>
</ul>

<h2 id="tax">How much is tax-free</h2>
<p>For private-sector employees, gratuity is tax-free up to <strong>₹20 lakh over your whole career</strong>, not per job, under section 19 of the Income-tax Act, 2025 (earlier section 10(10) of the 1961 Act). This applies under both the old and new tax regimes. Gratuity for central and state government employees is fully tax-free.</p>
<p>That's why the calculator asks for the gratuity you've received earlier. If Neha had already received ₹6 lakh tax-free from a past job, ₹14 lakh of her limit would be left, and her {_inr(B['grat'])} would still be fully tax-free. If she'd already had ₹19 lakh, only {_inr(E19['exempt'])} would be tax-free and {_inr(E19['taxable'])} would be added to her salary and taxed at her slab rate.</p>
<p class="g-note"><strong>One open point.</strong> For employees covered by gratuity law, the tax rule (section 19, Table S. No. 5) still refers to the Payment of Gratuity Act, 1972, which the Code replaced. It hasn't been clarified whether the extra gratuity from the new wage rule is fully tax-free. We treat it as tax-free up to the limit; if your gratuity is large, ask your employer how they'll report it.</p>

<h2 id="check">Before you resign: a checklist</h2>
<ol class="g-check">
  <li>Find your exact joining date and your basic + DA on your latest payslip.</li>
  <li>Work out your total monthly pay (leave out bonus and your employer's PF).</li>
  <li>Check whether a few more weeks would take you past a half-year mark.</li>
  <li>Add up any gratuity you've received from past employers, for the tax-free limit.</li>
  <li>Ask HR whether they've paid gratuity on the new wage definition. Some are still working this out for service before 21 November 2025.</li>
</ol>
<p>Then put your numbers into the <a href="/gratuity-calculator/">gratuity calculator</a>. If you're switching jobs, the <a href="/budget-planner/">budget planner</a> helps plan for the gap.</p>

<h2 id="method">Sources</h2>
<p>Gratuity rules: section 53 of the Code on Social Security, 2020 (<a href="https://labour.gov.in/" rel="noopener">Ministry of Labour and Employment</a>), in force from 21 November 2025. Tax: section 19 of the Income-tax Act, 2025, Table S. Nos. 3 to 6, checked on the <a href="https://www.incometaxindia.gov.in/" rel="noopener">Income Tax Department's website</a> for tax year {TAX_YEAR}. All amounts come from the <a href="/gratuity-calculator/">gratuity calculator</a>. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information. It isn't legal or tax advice; your employer's policy and your employment contract also matter.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "Gratuity under the new labour codes", body, "Gratuity under the labour codes")

def guide_rent_dead():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_rent_dead_numbers.js")]))
    b, g8, bw = G["base"], G["grow8"], G["buyWins"]
    path = "/guides/is-rent-really-dead-money/"
    toc = [("short-answer", "The short answer"), ("rent", "What the renter never gets back"), ("buy", "What the buyer never gets back"), ("gain", "What the buyer gets back"),
           ("result", "Who ends up ahead"), ("when", "When buying does win"), ("method", "How these numbers were worked out")]
    sunk_rows = "".join(f"<tr><th scope=\"row\">{n}</th><td data-l=\"Amount\">{_L(v)}</td></tr>" for n, v in [
        ("Interest on the home loan", b["interest"]), ("Stamp duty, registration and other buying costs", b["upfrontCosts"]), ("Maintenance, property tax and insurance", b["own"]),
        ("Selling costs (1%)", b["sellCost"]), ("Capital gains tax on selling", b["propTax"])])
    body = guide_head(path, "\"Why pay rent when an EMI builds an asset?\" is the most common argument for buying a home. But buying has costs you never get back too. Here's how they compare over 12 years, worked out with the Salarist Rent or Buy calculator.",
                      "A balance weighing a house against a pile of rupee notes").replace("TYPE_LINE", "")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>Rent is money you don't get back, but so is most of what a buyer spends in the early years: loan interest, stamp duty, upkeep and, at the end, selling costs and tax. In our example, over 12 years the renter pays <strong>{_L(b['rentPaid'])}</strong> in rent; the buyer pays <strong>{_L(b['buySunk'])}</strong> in costs that don't come back. Whether buying wins depends on how much the home's value grows, and on what the renter does with the money they don't put into the home.</p>
<p class="g-cta"><a class="btn" href="/rent-vs-buy/">Check your own numbers</a></p>

<h2 id="rent">What the renter never gets back</h2>
<p>Arjun can rent a flat for ₹24,000 a month, or buy a similar one for ₹90 lakh with a ₹72 lakh loan at 8.5% for 20 years. Rent rises 5% a year. Over 12 years, he'd pay <strong>{_L(b['rentPaid'])}</strong> in rent. That's the "dead money".</p>

<h2 id="buy">What the buyer never gets back</h2>
<p>If he buys, his EMI is {_inr(b['emi'])} a month. In the first year, {_L(b['y1Interest'])} of the {_L(b['y1Emi'])} he pays in EMIs is interest; only the rest repays the loan. Over 12 years, the costs he won't get back add up like this:</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Cost</th><th scope="col">Amount over 12 years</th></tr></thead><tbody>{sunk_rows}
<tr><th scope="row"><strong>Total</strong></th><td data-l="Amount"><strong>{_L(b['buySunk'])}</strong></td></tr></tbody></table></div>
<p>That's about {b['buySunk'] / b['rentPaid']:.1f} times the rent. Interest alone is more than all the rent he'd pay.</p>

<h2 id="gain">What the buyer gets back</h2>
<p>The buyer's money isn't all spent, of course. The down payment and the loan he's repaid are in the home, and the home grows in value. At 6% a year, Arjun's flat would be worth about {_L(b['home'])} after 12 years, a rise of {_L(b['gainOnHome'])}.</p>
<p>The renter's money isn't idle either. The ₹26.1 lakh the buyer puts in on day one (down payment plus costs), and the gap each month between the EMI and the rent, can be invested instead. That's the half of the comparison the "rent is dead money" argument leaves out.</p>

<h2 id="result">Who ends up ahead</h2>
<p>Putting it all together, with the renter's savings earning 12% a year in equity funds:</p>
<ul>
  <li><strong>With home prices growing 6% a year,</strong> the renter ends up about <strong>{_L(b['diff'])}</strong> ahead after 12 years.</li>
  <li><strong>With prices growing 8% a year,</strong> the renter is still about {_L(g8['diff'])} ahead.</li>
  <li><strong>Buying breaks even</strong> when prices grow about {b['be']['rate']:.1f}% a year.</li>
</ul>

<h2 id="when">When buying does win</h2>
<p>Buying comes out ahead when you stay longer, the home grows faster or your investments would earn less. If Arjun keeps the flat for 15 years, prices grow 8% a year and his investments would earn 10%, buying puts him about <strong>{_L(-bw['diff'])}</strong> ahead.</p>
<p>And some reasons to buy aren't in the numbers at all: not having to move, making the home your own, and the forced saving that EMIs bring. So rent isn't dead money, and neither is buying a mistake. They're two ways of paying for a roof, and the cheaper one depends on your numbers.</p>
<p>Try yours in the <a href="/rent-vs-buy/">Rent or Buy calculator</a>, and read the full worked example in <a href="/guides/rent-vs-buy/">Rent or buy a home in India?</a></p>

<h2 id="method">How these numbers were worked out</h2>
<p>All figures come from the <a href="/rent-vs-buy/">Rent or Buy calculator</a>, with Arjun's numbers from our main guide: ₹90 lakh flat, ₹18 lakh down payment, 7% stamp duty, 8.5% loan for 20 years, ₹48,000 a year in owner's costs, sold after 12 years with 1% selling costs and capital gains tax for tax year {TAX_YEAR}, new tax regime. Growth and returns are assumptions, not predictions. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information and education. It isn't investment or financial advice.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "Is rent really dead money?", body, "Is rent dead money?")

def guide_prepay_timing():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_prepay_timing_numbers.js")]))
    W, SH = G["when"], G["share"]
    w = {x["y"]: x for x in W}; sh = {x["y"]: x for x in SH}
    path = "/guides/prepay-home-loan-early-or-later/"
    rows = "".join(f"<tr><th scope=\"row\">Year {x['y']}</th><td data-l=\"Interest saved\"><strong>{_L(x['saved'])}</strong></td><td data-l=\"Loan ends earlier by\">{x['months']} months</td><td data-l=\"Saved per ₹1 prepaid\">₹{x['perRupee']:.2f}</td></tr>" for x in W)
    share_rows = "".join(f"<tr><th scope=\"row\">Year {x['y']}</th><td data-l=\"Interest\">{_L(x['interest'])}</td><td data-l=\"Principal\">{_L(x['principal'])}</td><td data-l=\"Share that's interest\">{round(x['pct'] * 100)}%</td></tr>" for x in SH)
    toc = [("short-answer", "The short answer"), ("heavy", "Why early EMIs are mostly interest"), ("table", "₹2 lakh, prepaid in different years"), ("why", "Why earlier saves more"),
           ("wait", "Is there any reason to wait?"), ("tax", "If you claim the home loan deduction"), ("method", "How these numbers were worked out")]
    body = guide_head(path, "Some people wait for the \"interest-heavy years\" to pass before they prepay, others rush to prepay in year one. Here's what the timing of a part-payment actually changes, worked out with the Salarist EMI calculator on a ₹50 lakh loan.",
                      "A calendar with an early month circled and a shrinking loan bar").replace("TYPE_LINE", "")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>The earlier you prepay, the more you save. ₹2 lakh prepaid in the first year of a ₹50 lakh, 20-year loan at 8.5% saves about <strong>{_L(w[1]['saved'])}</strong> in interest and ends the loan {w[1]['months']} months early. The same ₹2 lakh in year 12 saves about {_L(w[12]['saved'])}. There's no benefit in waiting for the interest-heavy years to pass; they're the reason to prepay sooner.</p>
<p class="g-cta"><a class="btn" href="/emi-calculator/">Try a part-payment</a></p>

<h2 id="heavy">Why early EMIs are mostly interest</h2>
<p>Each month, the bank charges interest on what you still owe, and the rest of your EMI repays the loan. At the start you owe the most, so most of the EMI is interest. On this loan, with an EMI of {_inr(G['emi'])}:</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Year of the loan</th><th scope="col">Interest paid</th><th scope="col">Principal repaid</th><th scope="col">Share that's interest</th></tr></thead><tbody>{share_rows}</tbody></table></div>

<h2 id="table">₹2 lakh, prepaid in different years</h2>
<p>Here's what a single ₹2 lakh part-payment does, depending on when you make it. You keep paying the same EMI, so the loan simply ends sooner:</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Prepaid in</th><th scope="col">Interest saved</th><th scope="col">Loan ends earlier by</th><th scope="col">Saved per ₹1 prepaid</th></tr></thead><tbody>{rows}</tbody></table></div>
<p>If you ask the bank to lower your EMI instead and keep the end date, you save less: about {_L(w[1]['savedEmi'])} for a year-1 part-payment.</p>

<h2 id="why">Why earlier saves more</h2>
<p>Every rupee you prepay stops being charged 8.5% interest, for as long as the loan would have run. Prepay in year 1 and that saving runs for almost 20 years; prepay in year 16 and it runs for about 4. The "return" on a part-payment is always your loan rate. What changes is how many years it works for you.</p>
<p>That's also why "interest-heavy years" isn't a reason to wait. The interest is heavy because the balance is large, and a part-payment reduces exactly that balance.</p>

<h2 id="wait">Is there any reason to wait?</h2>
<p>A few, and none of them is the interest schedule:</p>
<ul>
  <li><strong>An emergency fund comes first.</strong> Money in your loan is hard to get back. Keep 4 to 6 months of expenses aside before you prepay.</li>
  <li><strong>Costlier debt comes first.</strong> Clear credit card dues or a personal loan before you prepay a home loan.</li>
  <li><strong>Investing might do better.</strong> If you'd invest the money for the long term and expect to earn more than your loan rate after tax, investing can come out ahead. The <a href="/prepay-vs-invest/">Prepay or Invest calculator</a> compares the two.</li>
</ul>

<h2 id="tax">If you claim the home loan deduction</h2>
<p>Under the old tax regime, you can deduct up to ₹2 lakh a year of interest on a home you live in, under section 22 of the Income-tax Act, 2025 (old section 24(b)). In the early years this loan's interest is well above ₹2 lakh (about {_L(sh[1]['interest'])} in year 1), so prepaying doesn't reduce your deduction at all: you still claim the full ₹2 lakh. Later, once yearly interest drops below ₹2 lakh (around year 15 on this loan), every rupee of interest you save also trims the deduction a little. That's one more reason earlier is better. Under the new regime there's no deduction for a home you live in, so it doesn't matter.</p>

<h2 id="method">How these numbers were worked out</h2>
<p>All figures come from the <a href="/emi-calculator/">EMI calculator</a>: a ₹50 lakh loan at 8.5% for 20 years, with the first EMI in December 2026 and a ₹2 lakh part-payment made right after the first EMI of the year shown, keeping the EMI the same. The rate is assumed not to change. Read the full <a href="/guides/how-part-payments-cut-your-home-loan/">guide to part-payments</a> and <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information and education. It isn't financial advice. Check your loan's prepayment terms with your lender.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "Prepay your home loan early or later?", body, "Prepay early or later?")

def guide_sections():
    import subprocess
    D = json.loads(subprocess.check_output(["node", "-e", "const S=require('./src/assets/js/sections.js');process.stdout.write(JSON.stringify(S.DATA.map(r=>Object.assign({lab:S.reg(r)[1]},r))))"], cwd=ROOT))
    by = {r["o"]: r for r in D}
    path = "/guides/new-income-tax-section-numbers/"
    def tbl(keys):
        rows = "".join(f"<tr><th scope=\"row\">{H.escape(by[k]['o'])}</th><td data-l=\"New section\"><strong>{H.escape(by[k]['n'])}</strong></td><td data-l=\"What it covers\">{H.escape(by[k]['t'])}</td><td data-l=\"Regime\">{H.escape(by[k]['lab'])}</td></tr>" for k in keys)
        return f'<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Old section (1961 Act)</th><th scope="col">New section (2025 Act)</th><th scope="col">What it covers</th><th scope="col">Regime</th></tr></thead><tbody>{rows}</tbody></table></div>'
    toc = [("short-answer", "The short answer"), ("which", "Which Act applies to you"), ("salary", "Salary"), ("deductions", "Deductions"), ("home", "Home loan and house property"),
           ("tax", "Rebate and regime"), ("gains", "Capital gains"), ("forms", "Returns and forms"), ("read", "How to read the new numbers"), ("method", "Sources")]
    body = guide_head(path, "From 1 April 2026, the Income-tax Act, 2025 replaced the 1961 Act, and almost every section got a new number. Here are the ones salaried people use most, what they're called now, and whether they work under the new regime.",
                      "Two documents, an old section number pointing to a new one").replace("TYPE_LINE", f"<span>Written for tax year {TAX_YEAR}</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>The rules mostly stayed the same; the numbers changed. <strong>80C is now section 123</strong>, <strong>80D is 126</strong>, the <strong>home loan interest deduction (24(b)) is 22</strong>, <strong>HRA is in Schedule III</strong>, and <strong>Form 16 is now Form 130</strong>. The limits you know (₹1.5 lakh, ₹25,000, ₹2 lakh) haven't changed.</p>
<p class="g-cta"><a class="btn" href="/income-tax-section-finder/">Look up any section</a></p>

<h2 id="which">Which Act applies to you</h2>
<ul>
  <li><strong>Income earned up to 31 March 2026</strong> (financial year 2025-26) is taxed under the 1961 Act. The return you file in 2026 for that year still uses the old numbers.</li>
  <li><strong>Income earned from 1 April 2026</strong> is under the 2025 Act, as "tax year 2026-27". Your employer's TDS, investment declarations and next year's Form 130 use the new numbers.</li>
</ul>

<h2 id="salary">Salary</h2>
<p>Most salary exemptions moved into two places: the table in section 19 (deductions from salary) and Schedule III (exempt allowances).</p>
{tbl(["16(ia)", "16(iii)", "10(13A)", "10(5)", "10(14)", "10(10)", "10(10AA)", "17(2)", "192"])}

<h2 id="deductions">Deductions</h2>
<p>The old Chapter VI-A deductions (80C to 80U) are now sections 122 to 154, all plain numbers. Under the new regime you can't claim most of them; the exception that matters most is your employer's NPS contribution.</p>
{tbl(["80C", "80CCD(1B)", "80CCD(2)", "80D", "80E", "80G", "80GG", "80TTA", "80TTB"])}

<h2 id="home">Home loan and house property</h2>
{tbl(["24(b)", "24(a)", "80EEA"])}
<p>Comparing the regimes for a home loan? The <a href="/guides/hra-vs-home-loan-tax-benefits/">HRA or home loan tax benefits</a> guide works through it.</p>

<h2 id="tax">Rebate and regime</h2>
{tbl(["87A", "115BAC"])}

<h2 id="gains">Capital gains</h2>
{tbl(["111A", "112A", "54"])}

<h2 id="forms">Returns and forms</h2>
{tbl(["139(1)", "139(8A)", "234B", "Form 16", "Form 12BB", "Form 15G / 15H"])}

<h2 id="read">How to read the new numbers</h2>
<ul>
  <li><strong>No more letters.</strong> There's no 80CCD(1B) or 10(13A); every section is a plain number, often with a table inside it.</li>
  <li><strong>"19(1), Table S. No. 2"</strong> means serial number 2 in the table in section 19(1). That's the standard deduction.</li>
  <li><strong>Schedules</strong> at the end of the Act hold lists that used to sit inside sections: Schedule III for exempt allowances like HRA and LTA, Schedule XV for what counts under section 123.</li>
  <li><strong>The new regime is section 202.</strong> Its sub-section (2) lists what you can't claim under it.</li>
</ul>
<p>For anything not in these tables, use the <a href="/income-tax-section-finder/">section finder</a>. It covers about 60 sections, each with what it means under each regime.</p>

<h2 id="method">Sources</h2>
<p>Every mapping here comes from the Salarist section finder, which was checked against the section text of the Income-tax Act, 2025 on the <a href="https://www.incometaxindia.gov.in/" rel="noopener">Income Tax Department's website</a>, including section 202(2) for what applies under the new regime. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information. It isn't tax advice.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "New income tax section numbers", body, "New section numbers")

def guide_gratuity_resign():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_gratuity_resign_numbers.js")]))
    J10, J11, Y4, Y5, NC, CV = G["jul10"], G["jul11"], G["y4m11"], G["y5"], G["notCovered"], G["covered"]
    path = "/guides/gratuity-six-month-rule-when-to-resign/"
    toc = [("short-answer", "The short answer"), ("rule", "The six-month rule"), ("example", "Rahul's numbers"), ("five", "The five-year rule doesn't round"),
           ("date", "Which date counts"), ("covered", "When the rule doesn't apply"), ("plan", "How to time your exit"), ("method", "Sources")]
    body = guide_head(path, "Gratuity counts a part-year of more than six months as a full year. So the date you leave can be worth a whole year's gratuity. Here's how the rule works, with one employee's numbers from the Salarist gratuity calculator.",
                      "A timeline of years of service with the half-year mark highlighted").replace("TYPE_LINE", "")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>If you're past a full year of service by <strong>more than six months</strong>, the part-year counts as a whole year. For Rahul, leaving on 10 July 2026 means {_inr(J10['grat'])} in gratuity; leaving one day later, on 11 July, means <strong>{_inr(J11['grat'])}</strong>. One extra day is worth {_inr(J11['grat'] - J10['grat'])}.</p>
<p class="g-cta"><a class="btn" href="/gratuity-calculator/">Find your next step-up date</a></p>

<h2 id="rule">The six-month rule</h2>
<p>Gratuity is 15 days' wages for every year of service: monthly wages × 15 ÷ 26 × years. Under the Code on Social Security, 2020, a year is counted for every completed year <strong>and for any part-year of more than six months</strong>. So:</p>
<ul>
  <li>6 years and 6 months counts as 6 years.</li>
  <li>6 years, 6 months and 1 day counts as 7 years.</li>
  <li>6 years and 11 months also counts as 7 years, so there's nothing more to gain by staying until the 7-year mark itself.</li>
</ul>

<h2 id="example">Rahul's numbers</h2>
<p>Rahul joined on 10 January 2020. His basic is ₹40,000 and his total pay is ₹1,00,000 a month, so under the labour codes his wages for gratuity are half his pay: ₹50,000. Each counted year is worth {_inr(G['perYear'])}.</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Last working day</th><th scope="col">Service</th><th scope="col">Years counted</th><th scope="col">Gratuity</th></tr></thead><tbody>
<tr><th scope="row">10 July 2026</th><td data-l="Service">6 years 6 months</td><td data-l="Years counted">{J10['yrs']}</td><td data-l="Gratuity">{_inr(J10['grat'])}</td></tr>
<tr><th scope="row">11 July 2026</th><td data-l="Service">6 years 6 months 1 day</td><td data-l="Years counted"><strong>{J11['yrs']}</strong></td><td data-l="Gratuity"><strong>{_inr(J11['grat'])}</strong></td></tr>
<tr><th scope="row">9 January 2027</th><td data-l="Service">6 years 11 months 30 days</td><td data-l="Years counted">{G['jan9']['yrs']}</td><td data-l="Gratuity">{_inr(G['jan9']['grat'])}</td></tr>
</tbody></table></div>
<p>If Rahul is resigning anyway, a last day of 11 July or later gets him the extra year. Staying on to January adds nothing more.</p>

<h2 id="five">The five-year rule doesn't round</h2>
<p>Permanent employees need <strong>5 years of continuous service</strong> to get gratuity at all, and here the six-month rule doesn't help. Someone who joined on 10 January 2022 and leaves on 31 December 2026, at 4 years 11 months, gets nothing. Staying until 10 January 2027 gets them {_inr(Y5['grat'])}.</p>
<p>Fixed-term employees qualify after 1 year, and gratuity is always paid on death or disablement, whatever the length of service.</p>

<h2 id="date">Which date counts</h2>
<p>Your service runs until your <strong>last working day</strong>, the date your employment actually ends, not the day you hand in your resignation. Your notice period counts as service. If you're negotiating an early release, check what it does to your service first.</p>

<h2 id="covered">When the rule doesn't apply</h2>
<p>The six-month rule is part of the Code, which covers establishments with 10 or more employees. If your employer isn't covered, gratuity depends on its own policy, which often counts only completed years. For Rahul, leaving on 31 December 2026 would mean {_inr(CV['grat'])} from a covered employer, or about {_inr(NC['grat'])} from one that counts completed years on his basic pay.</p>

<h2 id="plan">How to time your exit</h2>
<ol class="g-check">
  <li>Find your exact joining date (it's on your appointment letter).</li>
  <li>Work out when you next pass a half-year mark. The <a href="/gratuity-calculator/">gratuity calculator</a> shows the date and what it adds.</li>
  <li>Check that your notice period ends after that date, or ask for a last working day that does.</li>
  <li>If you're close to 5 years, make sure your last day is on or after your 5-year anniversary.</li>
  <li>Ask HR how they count service, especially for years before 21 November 2025.</li>
</ol>
<p>Read the full guide, <a href="/guides/gratuity-new-labour-codes/">Gratuity under the new labour codes</a>, for how wages are counted and how much is tax-free.</p>

<h2 id="method">Sources</h2>
<p>Gratuity rules: section 53 of the Code on Social Security, 2020 (<a href="https://labour.gov.in/" rel="noopener">Ministry of Labour and Employment</a>), in force from 21 November 2025. All amounts come from the <a href="/gratuity-calculator/">gratuity calculator</a>. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information. It isn't legal advice; your employer's policy and your contract also matter.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "When to resign: the six-month gratuity rule", body, "Gratuity six-month rule")

def guide_sip_track():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_sip_track_numbers.js")]))
    B, T, A = G["behind"], G["onTrack"], G["ahead"]
    path = "/guides/are-your-sips-on-track/"
    toc = [("short-answer", "The short answer"), ("plan", "Karan's plan"), ("check", "The check, three years in"), ("behind", "If you're behind"),
           ("ahead", "If you're ahead"), ("steps", "Your yearly check in five steps"), ("method", "How these numbers were worked out")]
    body = guide_head(path, "Starting a SIP for a goal is the easy part. Checking once a year whether it's still on course is what gets you there. Here's how to do it with the Salarist SIP calculator, using one investor's numbers three years in.",
                      "A rising path with a checkpoint flag on the way to a goal").replace("TYPE_LINE", "")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>Once a year, enter what your investments are worth today and what you've put in, then ask the calculator what monthly SIP you need from now to reach your goal. If it's more than you're investing, you're behind; if it's less, you're ahead. For Karan, after a bad year for markets, the answer was <strong>{_inr(B['need'])}</strong> a month against the {_inr(G['sipNow'])} he planned: about {_inr(B['extra'])} more.</p>
<p class="g-cta"><a class="btn" href="/sip-calculator/">Check your SIPs</a></p>

<h2 id="plan">Karan's plan</h2>
<p>Three years ago, Karan set a goal of <strong>₹1 crore in 15 years</strong>. Assuming 12% a year from equity funds and a 10% step-up every year, he needed {_inr(G['planSip'])} a month, so that's what he started with. After three step-ups, his SIP is now {_inr(G['sipNow'])}. In those three years he's put in {_L(G['invested'])}, and if returns had been exactly 12%, his funds would be worth about {_L(G['plan3'])}.</p>

<h2 id="check">The check, three years in</h2>
<p>Returns are never exactly 12% a year, so his portfolio could be anywhere. Here's what the check says in three cases, with 12 years left:</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Portfolio today</th><th scope="col">If he carries on as planned</th><th scope="col">SIP needed from now</th></tr></thead><tbody>
<tr><th scope="row">Behind: {_L(B['value'])}</th><td data-l="If he carries on">{_L(B['keep'])}</td><td data-l="SIP needed"><strong>{_inr(B['need'])}</strong></td></tr>
<tr><th scope="row">On track: {_L(T['value'])}</th><td data-l="If he carries on">{_L(T['keep'])}</td><td data-l="SIP needed">{_inr(T['need'])}</td></tr>
<tr><th scope="row">Ahead: {_L(A['value'])}</th><td data-l="If he carries on">{_L(A['keep'])}</td><td data-l="SIP needed">{_inr(A['need'])}</td></tr>
</tbody></table></div>
<p>The "SIP needed" is the monthly amount from now on, still rising 10% a year, that reaches ₹1 crore at 12% a year. Compare it with his current {_inr(G['sipNow'])}.</p>

<h2 id="behind">If you're behind</h2>
<p>A fall in the market makes the check look worse, but it doesn't mean the plan has failed. Karan has three ways to close the gap of about {_L(10000000 - B['keep'])}:</p>
<ul>
  <li><strong>Invest a little more:</strong> about {_inr(B['extra'])} a month on top of his SIP, still stepping up 10% a year.</li>
  <li><strong>Give it one more year:</strong> carrying on as planned for 13 years instead of 12 would get him about {_L(B['yrs13'])}.</li>
  <li><strong>Wait and re-check next year:</strong> if returns are above 12% from here, the gap closes on its own. That's a reasonable choice if you're only slightly behind, but don't wait several years.</li>
</ul>
<p>What not to do: stop your SIP after a fall. That's when each SIP buys more units.</p>

<h2 id="ahead">If you're ahead</h2>
<p>If the SIP needed is less than you're investing, you're ahead. That's no reason to cut back: returns could be lower in later years. Keep going, and treat the cushion as protection against a bad patch close to your goal.</p>

<h2 id="steps">Your yearly check in five steps</h2>
<ol class="g-check">
  <li><strong>Note two numbers</strong> from your fund statement or app: what your funds for this goal are worth today, and what you've put in so far.</li>
  <li><strong>Open the <a href="/sip-calculator/">SIP calculator</a></strong>, choose "I already invest" and enter both numbers.</li>
  <li><strong>Switch to goal mode</strong>, enter your goal and the years left, and keep your step-up the same.</li>
  <li><strong>Compare</strong> the SIP it shows with what you invest now. More means you're behind; less means you're ahead.</li>
  <li><strong>Save your plan</strong> with "Save SIP plan" so next year you only need to update the two numbers.</li>
</ol>
<p>New to goal planning? Start with <a href="/guides/how-much-sip-do-you-need/">How much SIP do you need?</a></p>

<h2 id="method">How these numbers were worked out</h2>
<p>All figures come from the <a href="/sip-calculator/">SIP calculator</a>: SIPs at the start of each month, returns compounding at 12% a year, a 10% step-up every 12 months, and values before tax. The three portfolio values are examples, not forecasts. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information and education. It isn't investment advice. Mutual fund investments are subject to market risks.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "Are your SIPs on track?", body, "SIPs on track?")

def _fdnums():
    import subprocess
    return json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_fd_numbers.js")]))

def guide_fd_main():
    G = _fdnums(); S = {x["slab"]: x for x in G["slabs"]}; F3 = G["fd3"]
    path = "/guides/fd-rd-or-ppf/"
    rows = "".join(f"<tr><th scope=\"row\">{s}% slab</th><td data-l=\"FD at 7%\">{_L(S[s]['fd'])}</td><td data-l=\"RD at 6.8%\">{_L(S[s]['rd'])}</td><td data-l=\"PPF at 7.1%\"><strong>{_L(S[s]['ppf'])}</strong></td></tr>" for s in (0, 20, 30))
    toc = [("short-answer", "The short answer"), ("three", "How the three work"), ("example", "Neha's ₹1.5 lakh a year"), ("tax", "Why tax decides it"),
           ("goals", "Which to use for what"), ("tds", "TDS: what the bank deducts"), ("ppf", "Getting the most from PPF"), ("method", "How these numbers were worked out")]
    body = guide_head(path, "Fixed deposits, recurring deposits and PPF are where most salaried people keep their safe money. Which one is best depends less on the interest rate than on your tax slab and how long you can lock the money away. Here's how they compare, worked out with the Salarist FD, PPF and RD calculator.",
                      "Three jars of coins of different heights, for FD, RD and PPF").replace("TYPE_LINE", f"<span>Written for tax year {TAX_YEAR}</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>For money you won't need for 15 years, <strong>PPF usually wins</strong>, because its interest is tax-free. Neha, saving ₹1.5 lakh a year for 15 years, ends up with {_L(S[30]['ppf'])} in PPF against {_L(S[30]['fd'])} in FDs at a 30% slab. For money you might need sooner, an FD or RD is the better home: you can get it back, and the tax cost over a few years is small.</p>
<p class="g-cta"><a class="btn" href="/fd-ppf-rd-calculator/">Compare with your numbers</a></p>

<h2 id="three">How the three work</h2>
<ul>
  <li><strong>Fixed deposit (FD):</strong> one lump sum for a fixed time, from 7 days to 10 years. Interest compounds every quarter if you reinvest it, or is paid out monthly or quarterly. Taxed at your slab.</li>
  <li><strong>Recurring deposit (RD):</strong> a fixed amount every month for a fixed time. Interest compounds quarterly. Taxed at your slab. Useful for building up to a goal.</li>
  <li><strong>Public Provident Fund (PPF):</strong> up to ₹1.5 lakh a year for 15 years, at a rate the government resets every quarter (7.1% for October to December 2026). Interest and maturity are tax-free. Limited withdrawals before 15 years.</li>
</ul>

<h2 id="example">Neha's ₹1.5 lakh a year</h2>
<p>Neha can save ₹1.5 lakh a year for 15 years: {_L(S[30]['put'])} in all. Here's what she'd have at the end in each, after tax on the interest:</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Her tax slab</th><th scope="col">FD at 7%</th><th scope="col">RD at 6.8%</th><th scope="col">PPF at 7.1%</th></tr></thead><tbody>{rows}</tbody></table></div>
<p>In today's money, at 6% inflation, her PPF would be worth about {_L(S[30]['realPpf'])}. FD: a new deposit each year. RD: a twelfth of the amount each month.</p>

<h2 id="tax">Why tax decides it</h2>
<p>At a 0% slab, the FD comes out slightly ahead ({_L(S[0]['fd'])} against {_L(S[0]['ppf'])}), because a 7% FD compounding every quarter earns a little more than 7.1% compounding once a year. But every rupee of FD and RD interest is taxed at your slab, every year. At 30% plus cess, a 7% FD earns about 4.8% after tax, while PPF's 7.1% stays 7.1%. Over 15 years, that gap is {_L(S[30]['ppf'] - S[30]['fd'])}.</p>
<p>Under the old regime, PPF deposits also count under section 123 (old 80C), up to ₹1.5 lakh a year, which cuts your tax further.</p>

<h2 id="goals">Which to use for what</h2>
<ul>
  <li><strong>Emergency fund:</strong> FD, ideally one you can break online, or a few smaller FDs. Breaking an FD early usually costs a small penalty on the rate; PPF money isn't easy to get at.</li>
  <li><strong>A goal 1 to 5 years away:</strong> FD or RD. ₹5 lakh in a 3-year FD at 7% becomes {_L(F3['maturity'])}; at a 30% slab, tax on the interest is about {_inr(F3['tax'])}.</li>
  <li><strong>Long-term, safe savings:</strong> PPF, up to ₹1.5 lakh a year. For goals 10 years or more away, also look at equity funds through a <a href="/sip-calculator/">SIP</a>; they can earn more, with more ups and downs.</li>
</ul>

<h2 id="tds">TDS: what the bank deducts</h2>
<p>FD and RD interest is taxable from the first rupee. Separately, your bank deducts 10% TDS once your interest from all FDs and RDs with it crosses ₹50,000 in a year (₹1 lakh for senior citizens). TDS isn't extra tax; it's credited against what you owe. Read <a href="/guides/fd-interest-tax-below-50000/">Is FD interest taxable below ₹50,000?</a> for how it works.</p>

<h2 id="ppf">Getting the most from PPF</h2>
<p>PPF pays interest on the lowest balance between the 5th and the end of each month. Deposit your yearly amount by 5 April and it earns interest for the whole year. Read <a href="/guides/ppf-deposit-by-5-april/">PPF: deposit by 5 April</a> for what that's worth.</p>

<h2 id="method">How these numbers were worked out</h2>
<p>All figures come from the <a href="/fd-ppf-rd-calculator/">FD, PPF and RD calculator</a>: FD at 7% and RD at 6.8% compounding quarterly, PPF at 7.1% (the rate for October to December 2026) on deposits made by 5 April, FD and RD interest taxed each year at the slab shown plus 4% cess. Rates are assumed to stay the same; in reality FD rates and the PPF rate change. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information and education. It isn't investment or tax advice.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "FD, RD or PPF?", body, "FD, RD or PPF?")

def guide_fd_tds():
    G = _fdnums(); A, B = G["tds"]; T = G["twoBanks"]
    path = "/guides/fd-interest-tax-below-50000/"
    toc = [("short-answer", "The short answer"), ("two", "Tax and TDS are different things"), ("below", "Below ₹50,000: no TDS, still taxed"), ("above", "Above ₹50,000: TDS, then the rest"),
           ("banks", "Spreading FDs across banks"), ("savings", "What about savings account interest?"), ("form", "Stopping TDS with Form 121"), ("file", "What to do when you file"), ("method", "Sources")]
    body = guide_head(path, "Many people think FD interest is tax-free up to ₹50,000 because the bank doesn't deduct anything. It isn't. Here's the difference between tax and TDS, with numbers from the Salarist FD, PPF and RD calculator.",
                      "A bank receipt with a TDS stamp next to a tax form").replace("TYPE_LINE", f"<span>Written for tax year {TAX_YEAR}</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>No. <strong>FD and RD interest is taxable from the first rupee</strong>, at your slab rate. ₹50,000 (₹1 lakh for senior citizens) is only the point at which your bank starts deducting TDS. Below it, the bank deducts nothing, but you still owe the tax and must pay it when you file your return.</p>
<p class="g-cta"><a class="btn" href="/fd-ppf-rd-calculator/">Check your FD's tax and TDS</a></p>

<h2 id="two">Tax and TDS are different things</h2>
<ul>
  <li><strong>Tax</strong> is what you owe on your income. Interest is added to your income for the year and taxed at your slab, plus 4% cess.</li>
  <li><strong>TDS</strong> (tax deducted at source) is an advance the bank collects for the government, at 10%, under section 393(1) of the Income-tax Act, 2025 (old section 194A). It's credited against the tax you owe.</li>
</ul>

<h2 id="below">Below ₹50,000: no TDS, still taxed</h2>
<p>Priya, in the 20% slab, puts ₹6 lakh in a one-year FD at 7%. She earns {_inr(A['interest'])} in interest. That's under ₹50,000, so the bank deducts no TDS. But she still owes about <strong>{_inr(A['tax'])}</strong> in tax on it, which she pays when she files her return.</p>

<h2 id="above">Above ₹50,000: TDS, then the rest</h2>
<p>If Priya puts ₹9 lakh in the same FD, she earns {_inr(B['interest'])}. That crosses ₹50,000, so the bank deducts 10% of the <strong>whole</strong> interest: {_inr(B['tds'])}. Her tax is about {_inr(B['tax'])}, so she pays the remaining {_inr(B['more'])} when she files. If her slab were 10% or lower, the TDS would cover it, and anything extra would come back as a refund.</p>

<h2 id="banks">Spreading FDs across banks</h2>
<p>Each bank counts only your FDs and RDs with it, across all its branches. If Priya splits ₹12 lakh between two banks, each pays her {_inr(T['each'])} and neither deducts TDS. That changes nothing about her tax: she owes about {_inr(T['tax'])} on the {_inr(T['total'])} total. Splitting deposits avoids TDS, not tax, and the interest still shows up in your annual tax statement (AIS).</p>

<h2 id="savings">What about savings account interest?</h2>
<p>Savings account interest is taxable too, but banks don't deduct TDS on it, and it doesn't count towards the ₹50,000 limit. Under the old regime, you can deduct up to ₹10,000 of savings interest a year under section 153(2)(a) (old 80TTA). Senior citizens can deduct up to ₹50,000 of all bank and post office interest, FDs included, under section 153(2)(b) (old 80TTB). The new regime has neither deduction.</p>

<h2 id="form">Stopping TDS with Form 121</h2>
<p>If the tax on your total income for the year will be nil, you can give your bank Form 121 (it replaces the old Forms 15G and 15H) at the start of the year, and it won't deduct TDS. Don't submit it if you do owe tax: TDS isn't the problem, and a wrong declaration is.</p>

<h2 id="file">What to do when you file</h2>
<ol class="g-check">
  <li>Add up the interest from every FD, RD and savings account for the year. Your bank's interest certificate and your AIS both show it.</li>
  <li>Report it as income from other sources in your return.</li>
  <li>Claim the TDS the banks deducted; it's in your AIS.</li>
  <li>Pay any balance before you file, or get the refund if TDS was more than your tax.</li>
</ol>

<h2 id="method">Sources</h2>
<p>TDS: section 393(1), Table S. No. 5(ii), and section 393(4) of the Income-tax Act, 2025. Deductions: section 153. Checked on the <a href="https://www.incometaxindia.gov.in/" rel="noopener">Income Tax Department's website</a> for tax year {TAX_YEAR}. Amounts come from the <a href="/fd-ppf-rd-calculator/">FD, PPF and RD calculator</a>, with interest compounding quarterly. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information. It isn't tax advice.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "Is FD interest taxable below ₹50,000?", body, "FD interest and TDS")

def guide_ppf_april():
    G = _fdnums(); P = G["ppf"]
    path = "/guides/ppf-deposit-by-5-april/"
    toc = [("short-answer", "The short answer"), ("rule", "The 5th-of-the-month rule"), ("compare", "By 5 April, monthly, or late"), ("cant", "If you can't deposit it all in April"),
           ("checklist", "A checklist for each April"), ("method", "How these numbers were worked out")]
    body = guide_head(path, "PPF pays interest on the lowest balance between the 5th and the end of each month. So when you deposit matters, and depositing by 5 April each year earns the most. Here's what it's worth, worked out with the Salarist FD, PPF and RD calculator.",
                      "A calendar page showing 5 April with coins going in").replace("TYPE_LINE", "")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>Put your full yearly PPF amount in <strong>on or before 5 April</strong> and it earns interest for all 12 months. On ₹1.5 lakh a year for 15 years at 7.1%, that gives {_L(P['april'])}, about <strong>{_L(P['april'] - P['monthly'])} more</strong> than depositing monthly and {_L(P['april'] - P['late'])} more than depositing in March.</p>
<p class="g-cta"><a class="btn" href="/fd-ppf-rd-calculator/">Try your PPF timing</a></p>

<h2 id="rule">The 5th-of-the-month rule</h2>
<p>PPF interest is worked out each month on the <strong>lowest balance between the 5th and the end of the month</strong>, and credited to your account every March. Money that arrives on or before the 5th counts for that month; money that arrives on the 6th or later doesn't count until the next month.</p>
<p>Deposit ₹1.5 lakh on 6 April instead of 5 April and you lose a month's interest on it: about {_inr(P['oneMonth'])}.</p>

<h2 id="compare">By 5 April, monthly, or late</h2>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">When you deposit ₹1.5 lakh a year</th><th scope="col">After 15 years</th><th scope="col">Difference</th></tr></thead><tbody>
<tr><th scope="row">All by 5 April</th><td data-l="After 15 years"><strong>{_L(P['april'])}</strong></td><td data-l="Difference">Most</td></tr>
<tr><th scope="row">₹12,500 a month, by the 5th</th><td data-l="After 15 years">{_L(P['monthly'])}</td><td data-l="Difference">{_L(P['monthly'] - P['april'])}</td></tr>
<tr><th scope="row">All in March, after the 5th</th><td data-l="After 15 years">{_L(P['late'])}</td><td data-l="Difference">{_L(P['late'] - P['april'])}</td></tr>
</tbody></table></div>
<p>You put in {_L(P['put'])} in each case. The only difference is how long each deposit earns interest.</p>

<h2 id="cant">If you can't deposit it all in April</h2>
<ul>
  <li><strong>Deposit monthly, by the 5th.</strong> You lose a little against April, but much less than depositing late in the year.</li>
  <li><strong>Use your bonus.</strong> If your bonus comes in March, deposit it in early April for the new year, not late March for the old one.</li>
  <li><strong>Old regime?</strong> PPF deposits count under section 123 (old 80C) in the year you make them. An April deposit counts for the new tax year, so plan your declaration with your employer accordingly.</li>
</ul>

<h2 id="checklist">A checklist for each April</h2>
<ol class="g-check">
  <li>Set aside your PPF amount in March.</li>
  <li>Transfer it between 1 and 5 April. If you pay online, allow for the bank to credit it before the 5th.</li>
  <li>Keep it within ₹1.5 lakh for the year (across your own and minor children's accounts).</li>
  <li>Check the new quarter's PPF rate, set by the Ministry of Finance at the start of each quarter.</li>
</ol>
<p>Comparing PPF with an FD or RD? Read <a href="/guides/fd-rd-or-ppf/">FD, RD or PPF: where should your safe money go?</a></p>

<h2 id="method">How these numbers were worked out</h2>
<p>All figures come from the <a href="/fd-ppf-rd-calculator/">FD, PPF and RD calculator</a> at 7.1% (the PPF rate for October to December 2026), assumed to stay the same for 15 years, with interest on the lowest monthly balance after the 5th, credited each March. "In March, after the 5th" means the deposit earns nothing in the year it's made. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information and education. It isn't investment advice.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "PPF: deposit by 5 April", body, "PPF by 5 April")

def _num(script):
    import subprocess
    return json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", script)]))

def guide_car_cost():
    G = _num("guide_car_cost_numbers.js"); B = G["base"]; D = G["dist"]; E = G["be"]; Cr = G["cars"]
    path = "/guides/petrol-cng-or-ev-cost-per-km/"
    def rs(v): return "₹" + f"{v:.2f}"
    rows = "".join(f"<tr><th scope=\"row\">{int(k):,} km</th><td data-l=\"Petrol\">{rs(D[k]['petrol']['perKm'])}</td><td data-l=\"CNG\">{rs(D[k]['cng']['perKm'])}</td><td data-l=\"Electric\">{rs(D[k]['ev']['perKm'])}</td></tr>" for k in ("500", "1000", "1500", "2000", "3000"))
    pr = "".join(f"<tr><th scope=\"row\">{lab}</th><td data-l=\"Petrol\">{_L(B['petrol']['parts'][k])}</td><td data-l=\"CNG\">{_L(B['cng']['parts'][k])}</td><td data-l=\"Electric\">{_L(B['ev']['parts'][k])}</td></tr>"
                 for k, lab in (("depreciation", "Value lost"), ("interest", "Loan interest"), ("fuel", "Fuel or charging"), ("ins", "Insurance"), ("service", "Service and repairs")))
    pr += f"<tr><th scope=\"row\"><b>Total</b></th><td data-l=\"Petrol\"><b>{_L(B['petrol']['total'])}</b></td><td data-l=\"CNG\"><b>{_L(B['cng']['total'])}</b></td><td data-l=\"Electric\"><b>{_L(B['ev']['total'])}</b></td></tr>"
    toc = [("short-answer", "The short answer"), ("cars", "Three versions of the same car"), ("perkm", "Cost per km at different distances"), ("where", "Where the money goes"),
           ("breakeven", "The break-even distances"), ("decide", "Which one suits you"), ("method", "How these numbers were worked out")]
    body = guide_head(path, "The fuel bill is the cost you notice, but it's often not the biggest one. Here's what a petrol, CNG and electric car really cost per km once you add the loan, insurance, service and the value the car loses, worked out with the Salarist car ownership cost calculator.",
                      "Three cars side by side with a fuel pump, a CNG nozzle and a charging plug").replace("TYPE_LINE", "<span>Fuel prices of 14 Nov 2026</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>Driving 1,200 km a month and keeping the car 7 years, the petrol car costs about <strong>{rs(B['petrol']['perKm'])} per km</strong> all in, the CNG version about <strong>{rs(B['cng']['perKm'])}</strong> and the electric car about <strong>{rs(B['ev']['perKm'])}</strong>. CNG pays off from very low distances; the EV needs more kilometres to make up for its higher price, but wins clearly the more you drive.</p>
<p class="g-cta"><a class="btn" href="/car-ownership-cost/">Compare your own cars</a></p>

<h2 id="cars">Three versions of the same car</h2>
<p>Take a compact car, bought with an 80% loan at 9% for 5 years, driven 1,200 km a month, and sold after 7 years:</p>
<ul>
  <li><strong>Petrol:</strong> {_L(Cr['petrol']['price'])} on-road, 15 km a litre, petrol at ₹102.12 (Delhi, 14 Nov 2026). Sold for 40% of the price.</li>
  <li><strong>CNG:</strong> {_L(Cr['cng']['price'])} on-road (about ₹90,000 more), 24 km a kg, CNG at ₹86.98 a kg. Sold for 38%.</li>
  <li><strong>Electric:</strong> {_L(Cr['ev']['price'])} on-road, 7 km a unit, home charging at ₹8 a unit. Sold for 35%.</li>
</ul>
<p>Prices, mileage, insurance and resale values here are examples. Put in your own in the calculator.</p>

<h2 id="perkm">Cost per km at different distances</h2>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Km a month</th><th scope="col">Petrol</th><th scope="col">CNG</th><th scope="col">Electric</th></tr></thead><tbody>{rows}</tbody></table></div>
<p>The less you drive, the more the fixed costs (price, insurance, loan interest, value lost) dominate, and the cheapest car to buy wins. The more you drive, the more fuel matters, and the cheapest car to run wins. Fuel alone costs {rs(B['petrol']['fuelPerKm'])} per km for petrol, {rs(B['cng']['fuelPerKm'])} for CNG and {rs(B['ev']['fuelPerKm'])} for home charging.</p>

<h2 id="where">Where the money goes</h2>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Over 7 years, 1,200 km a month</th><th scope="col">Petrol</th><th scope="col">CNG</th><th scope="col">Electric</th></tr></thead><tbody>{pr}</tbody></table></div>
<p>For the electric car, the value it loses ({_L(B['ev']['parts']['depreciation'])}) is about {B['ev']['parts']['depreciation'] / B['ev']['parts']['fuel']:.0f} times its charging bill ({_L(B['ev']['parts']['fuel'])}). That's why the resale value you assume matters so much: EV resale values are still less settled than petrol's, so try a lower figure to see how much it changes.</p>

<h2 id="breakeven">The break-even distances</h2>
<ul>
  <li><strong>Petrol vs CNG:</strong> CNG is cheaper above about {round(E['petrolCng'] / 50) * 50:,} km a month.</li>
  <li><strong>Petrol vs electric:</strong> the EV is cheaper above about {round(E['petrolEv'] / 50) * 50:,} km a month. At 1,200 km, it's cheaper only if you keep it {E['evYear']} years or more.</li>
  <li><strong>CNG vs electric:</strong> the EV beats CNG above about {round(E['cngEv'] / 50) * 50:,} km a month.</li>
</ul>

<h2 id="decide">Which one suits you</h2>
<ul>
  <li><strong>You drive little (under about 500 km a month):</strong> buy the cheapest car you're happy with. Fuel is a small part of the cost.</li>
  <li><strong>Daily city commute (1,000 to 1,500 km):</strong> CNG and electric both beat petrol; it comes down to the price gap, CNG station queues and boot space versus home charging.</li>
  <li><strong>Long daily drives (2,000 km and more):</strong> an EV saves the most, if you can charge at home and the range fits your trips.</li>
  <li><strong>Paying cash?</strong> Without the loan, every option costs less (petrol {_L(G['cash']['petrol'])}, CNG {_L(G['cash']['cng'])}, electric {_L(G['cash']['ev'])}), and the pricier cars gain most because there's no interest on the bigger loan.</li>
</ul>
<p>Getting a car through your employer? Check the <a href="/company-car-lease-vs-loan/">Car Lease vs Car Loan calculator</a> too.</p>

<h2 id="method">How these numbers were worked out</h2>
<p>All figures come from the <a href="/car-ownership-cost/">car ownership cost calculator</a>: 7 years, fuel and service costs rising 3% a year, insurance at the first-year premium and then a renewal estimate, resale falling by the same share each year. Fuel prices are Delhi prices on 14 November 2026. Personal car-loan interest isn't tax-deductible for salaried people. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information. Your costs depend on the car, your city and how you drive.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "Petrol, CNG or EV: cost per km", body, "Petrol, CNG or EV")

def guide_bonus_sip():
    G = _num("guide_bonus_sip_numbers.js")
    path = "/guides/sip-or-lump-sum-bonus/"
    toc = [("short-answer", "The short answer"), ("first", "Before you invest it"), ("lump", "Lump sum vs spreading it out"), ("swings", "When the market falls, or rises"),
           ("how", "A simple way to do it"), ("method", "How these numbers were worked out")]
    body = guide_head(path, "Got a Diwali or year-end bonus and want to invest it? You can put it all into a mutual fund now or spread it over a few months. Here's what each does, worked out with the Salarist SIP calculator.",
                      "A gift box of coins split into small, growing stacks").replace("TYPE_LINE", "")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>If the money is for a goal 7 years or more away, investing it all at once usually ends up with more, because it's invested for longer. Spreading it over 6 to 12 months costs a little on average but protects you from investing everything just before a fall. If a 20% drop in the first few months would make you stop investing, spread it.</p>
<p class="g-cta"><a class="btn" href="/sip-calculator/">Try it in the SIP calculator</a></p>

<h2 id="first">Before you invest it</h2>
<ol class="g-check">
  <li><strong>Emergency fund:</strong> keep 3 to 6 months of expenses somewhere safe. If you don't have it, start there. The <a href="/budget-planner/">budget planner</a> shows how many months you have.</li>
  <li><strong>Expensive debt:</strong> clear credit card dues and personal loans first; they cost far more than funds are likely to earn.</li>
  <li><strong>Home loan?</strong> Compare prepaying with investing in <a href="/prepay-vs-invest/">Prepay or Invest</a>.</li>
  <li><strong>Short goals:</strong> money needed within 3 years is better in an FD or debt fund than in equity.</li>
</ol>

<h2 id="lump">Lump sum vs spreading it out</h2>
<p>Say your bonus is {_inr(G['bonus'])} and you invest it in an equity fund for 10 years, with markets returning 12% a year on average:</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">How you invest {_inr(G['bonus'])}</th><th scope="col">After 10 years</th></tr></thead><tbody>
<tr><th scope="row">All at once now</th><td data-l="After 10 years"><strong>{_L(G['lump'])}</strong></td></tr>
<tr><th scope="row">Over 6 months</th><td data-l="After 10 years">{_L(G['spread6'])}</td></tr>
<tr><th scope="row">Over 12 months</th><td data-l="After 10 years">{_L(G['spread12'])}</td></tr>
</tbody></table></div>
<p>With steady returns, the lump sum wins by {_L(G['gap12'])} over spreading across 12 months, because on average your money sits uninvested for about 6 months. But markets don't move steadily.</p>

<h2 id="swings">When the market falls, or rises</h2>
<p>Two illustrations, both ending the first year 12% up, then growing at 12% a year:</p>
<ul>
  <li><strong>Markets fall 20% over the first 6 months, then recover:</strong> spreading over 12 months buys more units while prices are low. After 10 years: {_L(G['dip10']['sip'])} spread out, against {_L(G['dip10']['lump'])} all at once.</li>
  <li><strong>Markets rise 25% in 6 months, then give some back:</strong> spreading buys at higher prices. After 10 years: {_L(G['rise10']['sip'])} spread out, against {_L(G['rise10']['lump'])} all at once.</li>
</ul>
<p>Nobody knows which one is coming. Spreading narrows the range of outcomes; investing at once gives you the better result more often. The real risk is the one in your head: if you'd panic and sell after a fall, spreading is the better choice for you.</p>

<h2 id="how">A simple way to do it</h2>
<ol class="g-check">
  <li>Park the bonus in a liquid or money market fund (or your savings account).</li>
  <li>Set up a systematic transfer (STP) or a monthly SIP from it into your equity fund over 6 to 12 months.</li>
  <li>Or split it: half now, the rest over the next 6 months.</li>
  <li>Add the bonus to your goal in the <a href="/sip-calculator/">SIP calculator</a> as money already invested, to see if your goal is still on track.</li>
</ol>
<p>Selling later? Read <a href="/guides/how-mutual-fund-gains-are-taxed/">How mutual fund gains are taxed</a>.</p>

<h2 id="method">How these numbers were worked out</h2>
<p>The steady-return figures come from the <a href="/sip-calculator/">SIP calculator</a>'s own code, at 12% a year compounded monthly, with SIPs at the start of each month, before tax. The fall and rise cases are illustrations of one possible path, not predictions. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information and education. It isn't investment advice. Mutual fund investments are subject to market risks.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "SIP or lump sum: your bonus", body, "Bonus: SIP or lump sum")

def guide_gratuity_tax():
    G = _num("guide_gratuity_tax_numbers.js"); F = G["first"]; Hh = G["hopper"]; Sh = G["short"]
    path = "/guides/is-gratuity-taxable-20-lakh-limit/"
    jobs = "".join(f"<tr><th scope=\"row\">{n}</th><td data-l=\"Gratuity\">{_L(v)}</td></tr>" for n, v in G["earlierJobs"])
    toc = [("short-answer", "The short answer"), ("limit", "How the ₹20 lakh limit works"), ("example", "Meera's fourth job"), ("five", "Leaving before 5 years"),
           ("who", "Who it applies to"), ("tips", "What to do"), ("method", "Sources")]
    body = guide_head(path, "Gratuity is tax-free only up to ₹20 lakh, and for private-sector employees that's a lifetime limit, not a per-job one. If you've collected gratuity from earlier jobs, part of the next one can be taxed. Here's how it works, worked out with the Salarist gratuity calculator.",
                      "A bar of coins filling up to a ₹20 lakh line").replace("TYPE_LINE", f"<span>Written for tax year {TAX_YEAR}</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>For private-sector employees, gratuity is tax-free up to ₹20 lakh <strong>across your whole career</strong>. Every rupee of tax-free gratuity you've received from earlier employers uses up part of that ₹20 lakh. Once it's used, further gratuity is taxed as salary at your slab. Government employees' gratuity is fully tax-free.</p>
<p class="g-cta"><a class="btn" href="/gratuity-calculator/">Check your gratuity and tax</a></p>

<h2 id="limit">How the ₹20 lakh limit works</h2>
<ul>
  <li>The tax-free amount is the lowest of: the gratuity you receive, the amount under the law's formula, and <strong>₹20 lakh minus any tax-free gratuity you've had before</strong>.</li>
  <li>The limit is under section 19 of the Income-tax Act, 2025 (Table S. Nos. 3, 5 and 6), which replaced section 10(10).</li>
  <li>Any gratuity above the tax-free amount is added to your salary for the year and taxed at your slab.</li>
</ul>

<h2 id="example">Meera's fourth job</h2>
<p>Meera has stayed 5 years or more at each of three earlier employers and received gratuity each time:</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Earlier job</th><th scope="col">Gratuity received</th></tr></thead><tbody>{jobs}
<tr><th scope="row"><b>Total, all tax-free</b></th><td data-l="Gratuity"><b>{_L(sum(v for _, v in G['earlierJobs']))}</b></td></tr></tbody></table></div>
<p>She leaves her fourth job after 8 years, with basic pay of ₹1.4 lakh and total pay of ₹3.5 lakh a month. Under the new labour codes her wages for gratuity are {_inr(F['wages'])}, so her gratuity is <strong>{_L(F['grat'])}</strong>.</p>
<ul>
  <li><strong>If it were her first gratuity:</strong> all {_L(F['grat'])} would be tax-free.</li>
  <li><strong>Because she's had {_L(sum(v for _, v in G['earlierJobs']))} before:</strong> only {_L(Hh['room'])} of the limit is left. {_L(Hh['exempt'])} is tax-free and <strong>{_L(Hh['taxable'])} is taxable</strong>. At a 30% slab that's about {_inr(G['hopperTax30'])} in tax.</li>
</ul>

<h2 id="five">Leaving before 5 years</h2>
<p>For permanent employees, gratuity needs 5 years of continuous service (1 year for fixed-term employees under the Code on Social Security, 2020). Leave after 4 years and 9 months and you get <strong>nothing</strong>, not a smaller amount. So many job-hoppers never get near the ₹20 lakh limit. The bigger risk is leaving just before 5 years. Read <a href="/guides/gratuity-six-month-rule-when-to-resign/">When to resign: the six-month rule</a>.</p>

<h2 id="who">Who it applies to</h2>
<ul>
  <li><strong>Private-sector employees, covered by the gratuity law:</strong> the lifetime ₹20 lakh limit applies.</li>
  <li><strong>Employers not covered by the law:</strong> the tax-free amount is half a month's average salary for each completed year, also within the lifetime ₹20 lakh.</li>
  <li><strong>Central and state government employees:</strong> gratuity is fully tax-free, whatever you've had before.</li>
</ul>

<h2 id="tips">What to do</h2>
<ol class="g-check">
  <li>Keep a note of every gratuity you've received and the tax-free part; your Form 16 from each employer shows it.</li>
  <li>Tell your new employer about earlier tax-free gratuity, so TDS on the next one is right.</li>
  <li>Enter your career total in the <a href="/gratuity-calculator/">gratuity calculator</a> under "Gratuity already received earlier" to see what's still tax-free.</li>
</ol>

<h2 id="method">Sources</h2>
<p>Gratuity: section 53 of the Code on Social Security, 2020. Tax: section 19 of the Income-tax Act, 2025, Table S. Nos. 3, 5 and 6, checked on the <a href="https://www.incometaxindia.gov.in/" rel="noopener">Income Tax Department's website</a> for tax year {TAX_YEAR}. Note: S. No. 5 still refers to the Payment of Gratuity Act, 1972, which the Code replaced; the treatment may be clarified. Amounts come from the <a href="/gratuity-calculator/">gratuity calculator</a>. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information. It isn't tax advice.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "Is gratuity taxable? The ₹20 lakh limit", body, "Gratuity tax limit")

def guide_nps_main():
    G = _num("guide_nps_numbers.js"); M = G["main"]; X = M["max"]; Fr = M["free"]
    path = "/guides/nps-new-exit-rules/"
    sl = "".join(f"<tr><th scope=\"row\">{_L(s['c'])}</th><td data-l=\"Non-government\">{_L(s['priv'])}</td><td data-l=\"Government\">{_L(s['govt'])}</td></tr>" for s in G["slabs"])
    toc = [("short-answer", "The short answer"), ("what", "How NPS works for salaried people"), ("example", "Kavya's NPS at 60"), ("rules", "What you can take out at 60"),
           ("choice", "80% or 60%: the tax catch"), ("tax", "Tax while you save"), ("before", "Leaving before 60"), ("method", "How these numbers were worked out")]
    body = guide_head(path, "In December 2025, PFRDA changed what NPS subscribers can take out at retirement. Most salaried people can now take up to 80% as a lump sum. Here's how NPS works today, what you'd get at 60 and where tax still bites, worked out with the Salarist NPS calculator.",
                      "A pension pot split into a large lump sum and a smaller monthly pension").replace("TYPE_LINE", f"<span>Rules as of 14 Nov 2026 · tax year {TAX_YEAR}</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>If you're in NPS through your employer or on your own (not a government employee), at 60 you can now take up to <strong>80% of your corpus as a lump sum</strong> and must use at least 20% to buy an annuity (a pension). Government employees still get 60% and 40%. But only 60% of the corpus is tax-free, so taking the full 80% means paying tax on the extra 20%.</p>
<p class="g-cta"><a class="btn" href="/nps-calculator/">Check your own NPS</a></p>

<h2 id="what">How NPS works for salaried people</h2>
<ul>
  <li>You, your employer, or both put money in every month. It's invested in equity, corporate bonds and government bonds in the mix you choose.</li>
  <li>The money stays locked until 60, with limited partial withdrawals for things like a first home, children's education or medical treatment.</li>
  <li>At 60 you take part as a lump sum and use the rest to buy an annuity, which pays a pension for life.</li>
</ul>

<h2 id="example">Kavya's NPS at 60</h2>
<p>Kavya is 30. She puts in ₹5,000 a month and her employer puts in another ₹5,000, both rising 5% a year. At a 10% return, by 60:</p>
<ul>
  <li>Her NPS grows to about <strong>{_L(X['corpus'])}</strong> (about {_L(X['realCorpus'])} in today's money), from {_L(X['put'])} put in.</li>
  <li>Taking the most allowed, 80%: <strong>{_L(X['lump'])}</strong> as a lump sum, and a pension of about {_inr(X['pension'])} a month from the rest at a 6.5% annuity rate.</li>
  <li>At 8% a year the corpus would be about {_L(M['r8']['corpus'])}; at 12%, about {_L(M['r12']['corpus'])}. The return you get matters more than anything else.</li>
</ul>

<h2 id="rules">What you can take out at 60</h2>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Corpus at 60</th><th scope="col">Most lump sum, non-government</th><th scope="col">Most lump sum, government</th></tr></thead><tbody>{sl}</tbody></table></div>
<ul>
  <li><strong>₹8 lakh or less:</strong> you can take all of it.</li>
  <li><strong>₹8 lakh to ₹12 lakh:</strong> you can also take up to ₹6 lakh and get the rest in instalments over at least 6 years, without buying an annuity.</li>
  <li><strong>Above ₹12 lakh:</strong> up to 80% (non-government) or 60% (government), with the rest in an annuity.</li>
  <li>You can stay invested and delay your withdrawal up to age 85.</li>
</ul>

<h2 id="choice">80% or 60%: the tax catch</h2>
<p>The Income-tax Act, 2025 (Schedule II, S. No. 6) still exempts the lump sum only up to <strong>60% of the corpus</strong>. If Kavya takes 80%, {_L(X['taxable'])} is taxable in the year she exits: about <strong>{_L(X['lumpTax'])}</strong> in tax, if the pension is her only other income. If she takes only 60%, her whole lump sum of {_L(Fr['lump'])} is tax-free and her pension doubles to about {_inr(Fr['pension'])} a month. Read <a href="/guides/nps-80-percent-withdrawal-tax/">NPS 80% withdrawal: the tax gap above 60%</a>.</p>

<h2 id="tax">Tax while you save</h2>
<ul>
  <li><strong>Employer's contribution:</strong> deductible up to 14% of basic + DA under the new regime (section 124 of the 2025 Act). This is the main NPS tax benefit for most salaried people. Read <a href="/guides/employer-nps-14-percent-new-regime/">Employer NPS at 14%: should you ask for it?</a></li>
  <li><strong>Your own contribution:</strong> no deduction in the new regime. In the old regime, up to ₹50,000 extra under section 124(3), plus within the ₹1.5 lakh limit.</li>
  <li><strong>₹7.5 lakh cap:</strong> employer PF, NPS and superannuation above ₹7.5 lakh a year in total is taxed.</li>
</ul>

<h2 id="before">Leaving before 60</h2>
<p>Exiting early is stricter: usually up to 20% as a lump sum and 80% into an annuity, unless the corpus is ₹5 lakh or less, in which case you can take it all. Changing jobs doesn't end your NPS; the account moves with you.</p>
<p>Comparing it with your PF and PPF? Read <a href="/guides/nps-vs-ppf-vs-epf/">NPS vs PPF vs EPF</a>.</p>

<h2 id="method">How these numbers were worked out</h2>
<p>All figures come from the <a href="/nps-calculator/">NPS calculator</a>: monthly contributions at the start of each month, returns compounded monthly, exit at 60 under the PFRDA (Exits and Withdrawals under NPS) (Amendment) Regulations, 2025, and tax at the new regime's rates for tax year {TAX_YEAR} with the section 156 rebate, surcharge and cess. Returns and annuity rates are examples, not promises. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information and education. It isn't investment or tax advice.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "NPS under the new exit rules", body, "NPS exit rules")

def guide_employer_nps():
    G = _num("guide_nps_numbers.js"); Em = G["emp"]; O = G["empOld"]; Cp = G["cap"]; Ci = G["capInputs"]
    path = "/guides/employer-nps-14-percent-new-regime/"
    rows = "".join(f"<tr><th scope=\"row\">{e['slab']}%</th><td data-l=\"Tax saved a year\">{_inr(e['saved'])}</td><td data-l=\"Take-home change a month\">{_inr(e['takeHome'])}</td><td data-l=\"Cost of each ₹1 moved\">{round(e['cost'] * 100)} paise</td></tr>" for e in Em)
    toc = [("short-answer", "The short answer"), ("how", "How it works"), ("example", "Rahul's numbers"), ("old", "In the old regime"), ("cap", "The ₹7.5 lakh cap"),
           ("worth", "When it's worth it, and when it isn't"), ("ask", "How to ask HR"), ("method", "Sources")]
    body = guide_head(path, "Under the new tax regime, almost every deduction is gone, but one remains: your employer's contribution to NPS, up to 14% of basic pay. Moving part of your pay into it can save real tax without changing your CTC. Here's how much, worked out with the Salarist NPS calculator.",
                      "A payslip with part of the salary flowing into a pension jar").replace("TYPE_LINE", f"<span>Written for tax year {TAX_YEAR}</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>If you pay tax at 10% or more and won't need the money before 60, asking your employer to route up to 14% of your basic + DA into NPS usually makes sense. Your CTC stays the same, but that part of your pay isn't taxed. For every ₹1 moved, your take-home falls by only 69 to 90 paise, depending on your slab.</p>
<p class="g-cta"><a class="btn" href="/nps-calculator/?mode=emp">Check your tax saving</a></p>

<h2 id="how">How it works</h2>
<ul>
  <li>Your employer pays part of your CTC into your NPS account instead of as salary. Your CTC doesn't change.</li>
  <li>Under section 124 of the Income-tax Act, 2025, the employer's contribution is deductible up to <strong>14% of basic + DA under the new regime</strong>, for every employer. Under the old regime it's 10% for private employers and 14% for government.</li>
  <li>It's one of the very few deductions the new regime allows, along with the ₹75,000 standard deduction.</li>
</ul>

<h2 id="example">Rahul's numbers</h2>
<p>Rahul's basic pay is ₹75,000 a month and he's in the new regime. His employer moves 14% of basic, {_inr(Em[0]['extra'])} a year, from his salary into NPS:</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">His tax slab</th><th scope="col">Tax saved a year</th><th scope="col">Take-home change a month</th><th scope="col">Cost of each ₹1 moved</th></tr></thead><tbody>{rows}</tbody></table></div>
<p>His take-home falls, but {_inr(Em[0]['extra'] / 12)} a month goes into his NPS. Kept until 60 (25 years) at 10% a year, that adds about <strong>{_L(Em[0]['fv'])}</strong> to his NPS.</p>

<h2 id="old">In the old regime</h2>
<p>Under the old regime, a private employer's contribution is deductible only up to 10% of basic + DA. If Rahul's employer still put in 14%, {_inr(O['overLimit'])} a year wouldn't be deductible: at a 30% slab he'd save {_inr(O['saved'])}, against {_inr(G['empNew30']['saved'])} under the new regime.</p>

<h2 id="cap">The ₹7.5 lakh cap</h2>
<p>Your employer's PF, NPS and superannuation together are tax-free only up to ₹7.5 lakh a year (section 17 of the 2025 Act). With basic pay of {_inr(Ci['basic'])} a month, 12% PF ({_inr(Ci['pf'])}) plus 14% NPS ({_inr(Ci['nps'])}) comes to {_inr(Ci['pf'] + Ci['nps'])}: {_inr(Cp['overCap'])} above the cap is taxed, which cuts the saving to {_inr(Cp['saved'])} a year at a 30% slab. If your PF is worked out on a capped wage (₹15,000 a month), this rarely bites.</p>

<h2 id="worth">When it's worth it, and when it isn't</h2>
<ul>
  <li><strong>Worth it:</strong> you're in the 10% slab or higher, you have an emergency fund, and retirement is a real goal.</li>
  <li><strong>Not worth it:</strong> your income is covered by the new regime's rebate (taxable income up to ₹12 lakh), so there's no tax to save; or you need the money in the next few years. NPS is locked until 60, with limited withdrawals.</li>
  <li><strong>Remember the exit tax:</strong> at 60, only 60% of the corpus comes out tax-free. Read <a href="/guides/nps-80-percent-withdrawal-tax/">NPS 80% withdrawal: the tax gap above 60%</a>.</li>
</ul>

<h2 id="ask">How to ask HR</h2>
<ol class="g-check">
  <li>Check whether your company offers corporate NPS and up to what share of basic.</li>
  <li>Ask to restructure your CTC so the chosen percentage of basic + DA goes to employer NPS.</li>
  <li>Make sure your tax declaration says new regime, if that's your choice, so TDS uses the 14% limit.</li>
  <li>Change your fund mix in your NPS account if you want more or less equity.</li>
</ol>

<h2 id="method">Sources</h2>
<p>Section 124 (employer and own contribution), section 17 (₹7.5 lakh cap) and section 156 (rebate) of the Income-tax Act, 2025, checked on the <a href="https://www.incometaxindia.gov.in/" rel="noopener">Income Tax Department's website</a> for tax year {TAX_YEAR}. Amounts come from the <a href="/nps-calculator/">NPS calculator</a>'s employer NPS check, with 4% cess and no surcharge. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information. It isn't tax advice.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "Employer NPS at 14%", body, "Employer NPS at 14%")

def guide_nps_gap():
    G = _num("guide_nps_numbers.js"); M = G["main"]; X = M["max"]; Fr = M["free"]
    path = "/guides/nps-80-percent-withdrawal-tax/"
    rows = "".join(f"<tr><th scope=\"row\">{_L(g['c'])}</th><td data-l=\"Taxable part of an 80% lump sum\">{_L(g['taxable'])}</td><td data-l=\"Tax on it\">{_inr(g['tax'])}</td><td data-l=\"Pension a month: 80% / 60% lump sum\">{_inr(g['pen80'])} / {_inr(g['pen60'])}</td></tr>" for g in G["gap"])
    toc = [("short-answer", "The short answer"), ("gap", "Where the gap comes from"), ("table", "What the extra 20% costs"), ("kavya", "One saver's choice"),
           ("which", "Which to choose"), ("watch", "What to watch for"), ("method", "Sources")]
    body = guide_head(path, "PFRDA now lets most NPS subscribers take 80% of their corpus as a lump sum at 60. The tax law hasn't caught up: only 60% is tax-free. Here's what the extra 20% really costs, worked out with the Salarist NPS calculator.",
                      "A lump sum split into a tax-free part and a taxed part").replace("TYPE_LINE", f"<span>Rules as of 14 Nov 2026 · tax year {TAX_YEAR}</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>Taking 80% instead of 60% puts more money in your hands, but the extra 20% of the corpus is added to your income that year and taxed at slab rates. For a corpus around ₹50 lakh, the rebate can make that tax nil if you have little other income; for larger corpuses it can run into lakhs. Taking only 60% keeps the lump sum tax-free and doubles the annuity, whose pension is taxed each year instead.</p>
<p class="g-cta"><a class="btn" href="/nps-calculator/">See your own split</a></p>

<h2 id="gap">Where the gap comes from</h2>
<ul>
  <li><strong>PFRDA's rule:</strong> from December 2025, non-government subscribers can take up to 80% as a lump sum at normal exit (government subscribers 60%).</li>
  <li><strong>The tax rule:</strong> Schedule II, S. No. 6 of the Income-tax Act, 2025 exempts a payment from the NPS Trust on closure only up to 60% of the total amount payable.</li>
  <li>So the part between 60% and 80% is income for that year. Unless the law is amended, it's taxed like salary.</li>
</ul>

<h2 id="table">What the extra 20% costs</h2>
<p>Assuming you exit under the new regime with no income that year other than the pension, and a 6.5% annuity rate:</p>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Corpus at 60</th><th scope="col">Taxable part of an 80% lump sum</th><th scope="col">Tax on it</th><th scope="col">Pension a month: 80% / 60% lump sum</th></tr></thead><tbody>{rows}</tbody></table></div>
<p>The tax rises quickly because the whole taxable part lands in one year. If you still have salary or other income that year, the tax is higher than shown.</p>

<h2 id="kavya">One saver's choice</h2>
<p>Kavya, from our <a href="/guides/nps-new-exit-rules/">NPS guide</a>, reaches about {_L(X['corpus'])} at 60:</p>
<ul>
  <li><strong>80% lump sum:</strong> {_L(X['lump'])} in hand, of which {_L(X['taxable'])} is taxable (about {_L(X['lumpTax'])} in tax), and a pension of about {_inr(X['pension'])} a month.</li>
  <li><strong>60% lump sum:</strong> {_L(Fr['lump'])} in hand, all tax-free, and a pension of about {_inr(Fr['pension'])} a month.</li>
</ul>

<h2 id="which">Which to choose</h2>
<ul>
  <li><strong>Take 60%</strong> if you want a bigger guaranteed pension, or the tax on the extra 20% would be large.</li>
  <li><strong>Take 80%</strong> if you'd invest the extra yourself for a better return than the annuity, need a large sum (a home, children), or your corpus is small enough that the tax is low.</li>
  <li><strong>Spread it:</strong> you can delay withdrawal up to 85, or use systematic lump sum withdrawal. How each instalment is taxed isn't spelt out yet, so check with a tax adviser before relying on it.</li>
</ul>

<h2 id="watch">What to watch for</h2>
<p>The government may amend the Act to exempt the full 80%. Until it does, plan on 60% tax-free. We'll update the <a href="/nps-calculator/">NPS calculator</a> and this article if the law changes.</p>

<h2 id="method">Sources</h2>
<p>PFRDA (Exits and Withdrawals under the National Pension System) (Amendment) Regulations, 2025. Income-tax Act, 2025: Schedule II, S. No. 6, section 202 rates and section 156 rebate, checked on the <a href="https://www.incometaxindia.gov.in/" rel="noopener">Income Tax Department's website</a>. Amounts come from the <a href="/nps-calculator/">NPS calculator</a>'s own code, with surcharge and 4% cess. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information. It isn't tax advice.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "NPS 80% withdrawal: the tax gap", body, "NPS 80% tax gap")

def guide_nps_vs():
    G = _num("guide_nps_numbers.js"); C = G["cmp"]
    path = "/guides/nps-vs-ppf-vs-epf/"
    toc = [("short-answer", "The short answer"), ("table", "Side by side"), ("numbers", "₹1.5 lakh a year for 25 years"), ("tax", "How each is taxed"),
           ("access", "Getting your money out"), ("mix", "How to use them together"), ("method", "How these numbers were worked out")]
    body = guide_head(path, "EPF, PPF and NPS are the three retirement savings most salaried people have. They differ in return, risk, tax and how easily you can get the money. Here's how they compare, worked out with Salarist's calculators.",
                      "Three jars labelled for retirement savings").replace("TYPE_LINE", f"<span>Rates as of 14 Nov 2026</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>EPF is the safe, tax-free backbone most salaried people already have. PPF adds safe, tax-free savings you control, up to ₹1.5 lakh a year. NPS can earn more because part of it is in equity, and employer NPS saves tax under the new regime, but part of the payout must buy an annuity and only 60% comes out tax-free.</p>
<p class="g-cta"><a class="btn" href="/nps-calculator/">Try the NPS calculator</a></p>

<h2 id="table">Side by side</h2>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col"></th><th scope="col">EPF</th><th scope="col">PPF</th><th scope="col">NPS</th></tr></thead><tbody>
<tr><th scope="row">Return</th><td data-l="EPF">8.25% for 2025-26, set each year</td><td data-l="PPF">7.1% (Oct–Dec 2026), set each quarter</td><td data-l="NPS">Market-linked; depends on your mix</td></tr>
<tr><th scope="row">Risk</th><td data-l="EPF">Very low</td><td data-l="PPF">Very low</td><td data-l="NPS">Moderate (equity part)</td></tr>
<tr><th scope="row">Lock-in</th><td data-l="EPF">Until you retire or leave work; partial withdrawals allowed</td><td data-l="PPF">15 years; partial withdrawals after year 6</td><td data-l="NPS">Until 60; limited partial withdrawals</td></tr>
<tr><th scope="row">At maturity</th><td data-l="EPF">All of it, tax-free</td><td data-l="PPF">All of it, tax-free</td><td data-l="NPS">Up to 80% lump sum (60% tax-free), rest buys an annuity</td></tr>
<tr><th scope="row">Limit</th><td data-l="EPF">12% of basic; interest on your own contribution above ₹2.5 lakh a year is taxable</td><td data-l="PPF">₹1.5 lakh a year</td><td data-l="NPS">No upper limit</td></tr>
</tbody></table></div>

<h2 id="numbers">₹1.5 lakh a year for 25 years</h2>
<p>Put in ₹12,500 a month ({_L(C['put'])} in all) for 25 years:</p>
<ul>
  <li><strong>EPF at 8.25%:</strong> about <strong>{_L(C['epf'])}</strong>, all tax-free.</li>
  <li><strong>PPF at 7.1%:</strong> about <strong>{_L(C['ppf'])}</strong>, all tax-free.</li>
  <li><strong>NPS at 10%:</strong> about <strong>{_L(C['nps10'])}</strong>. Taking 80% gives {_L(C['nps10Lump'])}, of which {_L(C['nps10Taxable'])} is taxable (about {_L(C['nps10Tax'])} in tax); the remaining {_L(C['nps10Annuity'])} buys a pension. At 8%, NPS would reach about {_L(C['nps8'])}, less than EPF.</li>
</ul>
<p>Rates are assumed to stay the same for 25 years; in reality EPF and PPF rates change, and NPS returns go up and down.</p>

<h2 id="tax">How each is taxed</h2>
<ul>
  <li><strong>EPF:</strong> contributions within the rules, interest and withdrawal after 5 years of service are tax-free, except interest on your own contributions above ₹2.5 lakh a year.</li>
  <li><strong>PPF:</strong> tax-free interest and maturity. Deposits count under section 123 (old 80C) in the old regime only.</li>
  <li><strong>NPS:</strong> employer contribution deductible up to 14% of basic + DA in the new regime; your own contribution only in the old regime. At 60, 60% of the corpus is tax-free; the pension is taxable.</li>
</ul>

<h2 id="access">Getting your money out</h2>
<p>EPF is the easiest to reach in an emergency or between jobs, PPF allows partial withdrawals after the sixth year, and NPS is the hardest to touch before 60. For goals before retirement, a <a href="/sip-calculator/">SIP</a> or an <a href="/fd-ppf-rd-calculator/">FD or RD</a> is a better fit.</p>

<h2 id="mix">How to use them together</h2>
<ol class="g-check">
  <li>Keep your EPF going, and don't withdraw it when you change jobs; transfer it.</li>
  <li>If you're in the new regime and your employer offers it, use employer NPS for the tax saving. Read <a href="/guides/employer-nps-14-percent-new-regime/">Employer NPS at 14%</a>.</li>
  <li>Add PPF for safe money you control, and equity funds for long-term growth.</li>
</ol>

<h2 id="method">How these numbers were worked out</h2>
<p>EPF and PPF use the same method as the <a href="/fd-ppf-rd-calculator/">FD, PPF and RD calculator</a>: monthly deposits, interest on the monthly balance, credited once a year (EPF at 8.25%, the rate approved for 2025-26; PPF at 7.1% for October to December 2026, with deposits continuing after 15 years through extensions). NPS uses the <a href="/nps-calculator/">NPS calculator</a> with monthly compounding, exit under PFRDA's December 2025 rules and new-regime tax for tax year {TAX_YEAR}. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information and education. It isn't investment advice.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "NPS vs PPF vs EPF", body, "NPS vs PPF vs EPF")

def guide_eps():
    G = _num("guide_epf_numbers.js"); Pn = G["pen"]
    path = "/guides/eps-pension-explained/"
    toc = [("short-answer", "The short answer"), ("what", "What EPS is"), ("money", "Where the money goes"), ("pension", "How your pension is worked out"),
           ("helps", "How EPS helps you"), ("jobs", "When you change jobs"), ("claim", "How you claim it"), ("mistakes", "Mistakes to avoid"), ("method", "Sources")]
    body = guide_head(path, "Every month, part of your employer's PF contribution goes somewhere you can't see in your EPF balance: the Employees' Pension Scheme. Here's what EPS is, what it pays, what happens to it when you change jobs, and how you claim it, under the new Employees' Pension Scheme, 2026.",
                      "A pension card with a timeline of jobs joined by one line").replace("TYPE_LINE", "<span>Rules as of 14 Nov 2026</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>EPS is a pension scheme run by EPFO. Of your employer's 12% PF contribution, <strong>8.33% of your wages (up to ₹25,000 a month) goes to EPS</strong>, not to your EPF balance. After <strong>10 years of service</strong> you get a monthly pension for life from 58. With less than 10 years, you can take a one-time withdrawal benefit or keep your service for later with a scheme certificate. When you change jobs, the money stays in the pension fund; only your service record moves.</p>
<p class="g-cta"><a class="btn" href="/eps-pension-calculator/">Work out your EPS pension</a></p>

<h2 id="what">What EPS is</h2>
<ul>
  <li>EPS is the Employees' Pension Scheme. Since 29 June 2026 it's the <strong>Employees' Pension Scheme, 2026</strong>, made under the Code on Social Security, 2020. It replaced the Employees' Pension Scheme, 1995, and protects everything earned under it.</li>
  <li>It's a <strong>defined-benefit</strong> pension: what you get depends on your years of service and wages, not on how much is in a personal account.</li>
  <li>You're in it if you joined EPF with wages up to the ceiling (₹25,000 a month from 17 September 2026; ₹15,000 before). Many people who joined after September 2014 on higher pay are in EPF only, not EPS. Your EPFO passbook shows a "pension contribution" column if you're a member.</li>
</ul>

<h2 id="money">Where the money goes</h2>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Every month</th><th scope="col">Goes to</th></tr></thead><tbody>
<tr><th scope="row">Your 12% of PF wages</th><td data-l="Goes to">Your EPF account</td></tr>
<tr><th scope="row">Employer: 8.33% of wages up to ₹25,000 (at most ₹2,083)</th><td data-l="Goes to">EPS (the pension fund)</td></tr>
<tr><th scope="row">Employer: the rest of its 12%</th><td data-l="Goes to">Your EPF account</td></tr>
<tr><th scope="row">Central Government: 1.16% of wages up to ₹15,000</th><td data-l="Goes to">EPS</td></tr>
</tbody></table></div>
<p>That's why your employer's share in your passbook looks smaller than yours: part of it is in EPS. The EPS money doesn't earn interest in your name; it's pooled, and the pension is paid from the pool.</p>

<h2 id="pension">How your pension is worked out</h2>
<p class="g-formula">Monthly pension = pensionable wages × pensionable service ÷ 70</p>
<ul>
  <li><strong>Pensionable wages:</strong> your average wages over the last 60 months before you leave the scheme, capped at the ceiling. Where the ceiling changed during your service, each period is worked out separately at its own ceiling: ₹15,000 for service up to 16 September 2026 and ₹25,000 after.</li>
  <li><strong>Pensionable service:</strong> your years in EPS, across all jobs, if they're linked. If you retire at 58 with 20 years or more, 2 years are added.</li>
  <li><strong>Minimum:</strong> ₹1,000 a month.</li>
</ul>
<p>Example: 30 years of service, 10 before the ceiling change and 20 after, with wages above ₹25,000: (₹15,000 × 10 + ₹25,000 × 22) ÷ 70 = about <strong>{_inr(Pn['mixed'])}</strong> a month. Had all 30 years been at ₹15,000, it would be {_inr(Pn['allOld'])}.</p>

<h2 id="helps">How EPS helps you</h2>
<ul>
  <li><strong>A pension for life,</strong> from 58, that doesn't run out however long you live.</li>
  <li><strong>Early pension</strong> from 50 if you've stopped working, 4% less for each year before 58. Or <strong>defer</strong> it up to 60 for 4% more for each year.</li>
  <li><strong>Family pension:</strong> if you die, your spouse gets a pension, and up to two children get a children's pension until 25.</li>
  <li><strong>Disablement pension</strong> if you're permanently and totally disabled while working, without the 10-year condition.</li>
</ul>

<h2 id="jobs">When you change jobs</h2>
<ol class="g-check">
  <li><strong>Keep the same UAN.</strong> Your UAN (Universal Account Number) stays with you for life. Each new employer opens a new <strong>member ID</strong> under it.</li>
  <li><strong>Your EPF money moves:</strong> the balance in your old member ID is transferred to the new one. This often starts automatically after your new employer's first contribution, if your UAN is Aadhaar-linked; if not, file a transfer request (Form 13) on the EPFO member portal.</li>
  <li><strong>Your EPS money doesn't move.</strong> It stays in the pension fund. What moves is your <strong>service record</strong>: your years in the old member ID are added to the new one, so they keep counting towards the 10 years and towards your pension.</li>
  <li><strong>If your old employer ran its own PF trust,</strong> its PF balance and your EPS service sit in different places; check after the transfer that your service history shows the old years.</li>
  <li><strong>Check your passbook</strong> after every transfer: the service history should show every employer with no gaps.</li>
</ol>

<h2 id="claim">How you claim it</h2>
<ul>
  <li><strong>10 years or more of service, at 58:</strong> apply for your monthly pension (Form 10D) on the EPFO member portal. Claims are to be settled within 20 days of a complete application.</li>
  <li><strong>10 years or more, but leaving before 58:</strong> you can't withdraw the money. Take a <strong>scheme certificate</strong>, which records your service and wages, and claim your pension at 58 (or early, from 50).</li>
  <li><strong>Less than 10 years:</strong> two choices (Form 10C):
    <ul>
      <li>A <strong>withdrawal benefit</strong>: a lump sum worked out from your months of service and wages (for example, 1.02 times your monthly wages for 12 months of service). Under EPS 2026 it's paid only after 36 months from your last contribution, or at 58 if earlier, if you haven't joined another covered employer.</li>
      <li>A <strong>scheme certificate</strong>, which keeps your service so it adds to future service if you work again. Usually the better choice if you might return to a job covered by EPF.</li>
    </ul></li>
</ul>

<h2 id="mistakes">Mistakes to avoid</h2>
<ul>
  <li><strong>Withdrawing at every job change.</strong> It resets your service, so you may never reach the 10 years needed for a pension.</li>
  <li><strong>Creating a new UAN</strong> at a new job. Give your employer your existing UAN.</li>
  <li><strong>Not checking the service history</strong> after a transfer, especially from companies with their own PF trust.</li>
  <li><strong>Mismatched details:</strong> your name and date of birth must match across Aadhaar, PAN and EPFO, or claims get stuck.</li>
</ul>
<p>Want to see your own numbers? The <a href="/epf-calculator/">EPF calculator</a> estimates your EPF at retirement and your EPS pension. Read also <a href="/guides/how-much-epf-at-58/">How much will your EPF be at 58?</a> and <a href="/guides/epf-wage-ceiling-25000/">The ₹25,000 wage ceiling</a>.</p>

<h2 id="method">Sources</h2>
<p>Employees' Pension Scheme, 2026 (G.S.R. 527(E), 29 June 2026), paragraphs 4 (contributions), 10–12 (service, pensionable wages, formula, early and deferred pension, minimum) and 13 (withdrawal benefit). Wage ceiling of ₹25,000 from 17 September 2026 (Ministry of Labour and Employment, 16 September 2026). Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information. Check your own service history and claim options on the EPFO member portal.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "EPS explained", body, "EPS explained")

def guide_epf_main():
    G = _num("guide_epf_numbers.js"); Bs = G["base"]; Fi = G["first"]
    path = "/guides/how-much-epf-at-58/"
    toc = [("short-answer", "The short answer"), ("arjun", "Arjun's EPF"), ("where", "Where it comes from"), ("rates", "If the interest rate changes"),
           ("levers", "What changes the result most"), ("tax", "Is it tax-free?"), ("method", "How these numbers were worked out")]
    body = guide_head(path, "Your EPF is probably your biggest retirement saving, and you didn't have to do anything to build it. Here's what it could grow to by 58, worked through one employee's numbers with the Salarist EPF calculator.",
                      "A savings jar filling up along a line of birthdays").replace("TYPE_LINE", "<span>EPF rate 8.25% for 2025-26</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>A 28-year-old with PF wages of ₹40,000 a month, rising 7% a year, could have about <strong>{_L(Bs['corpus'])}</strong> in EPF at 58 at today's 8.25% rate (about {_L(Bs['real'])} in today's money), plus an EPS pension of about {_inr(Bs['pension'])} a month. Two-thirds of it is interest.</p>
<p class="g-cta"><a class="btn" href="/epf-calculator/">Work out your own EPF</a></p>

<h2 id="arjun">Arjun's EPF</h2>
<ul>
  <li>Arjun is 28, with ₹2 lakh in EPF already and 4 years in EPS.</li>
  <li>His PF wages (basic + DA) are ₹40,000 a month, and his PF is worked out on full wages.</li>
  <li>Each month he puts in {_inr(Fi['own'] / 12)}; his employer puts in the same {_inr(Fi['own'] / 12)}, of which {_inr(Fi['eps'] / 12)} goes to EPS and {_inr(Fi['emp'] / 12)} to his EPF.</li>
  <li>His pay rises 7% a year, and EPF pays 8.25% until he retires at 58.</li>
</ul>

<h2 id="where">Where it comes from</h2>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">By 58</th><th scope="col">Amount</th></tr></thead><tbody>
<tr><th scope="row">Balance today</th><td data-l="Amount">{_L(G['B']['balance'])}</td></tr>
<tr><th scope="row">Arjun puts in</th><td data-l="Amount">{_L(Bs['putOwn'])}</td></tr>
<tr><th scope="row">Employer puts in (EPF share)</th><td data-l="Amount">{_L(Bs['putEmp'])}</td></tr>
<tr><th scope="row">Interest</th><td data-l="Amount">{_L(Bs['interest'])}</td></tr>
<tr><th scope="row"><b>EPF at 58</b></th><td data-l="Amount"><b>{_L(Bs['corpus'])}</b></td></tr>
<tr><th scope="row">Employer to EPS (pension fund)</th><td data-l="Amount">{_L(Bs['putEps'])}</td></tr>
</tbody></table></div>
<p>His EPS pension, after {Bs['service']} years of counted service, comes to about {_inr(Bs['pension'])} a month from 58. Read <a href="/guides/eps-pension-explained/">EPS explained</a> for how it's worked out.</p>

<h2 id="rates">If the interest rate changes</h2>
<p>The rate is declared every year. At 7.5% Arjun would have about {_L(G['r75']['corpus'])}; at 9%, about {_L(G['r9']['corpus'])}.</p>

<h2 id="levers">What changes the result most</h2>
<ul>
  <li><strong>Not withdrawing.</strong> Every withdrawal at a job change loses decades of compounding. Transfer your PF instead.</li>
  <li><strong>Full wages or capped:</strong> if Arjun's PF were worked out only on the ₹25,000 ceiling, he'd reach about {_L(G['capped']['corpus'])}.</li>
  <li><strong>VPF:</strong> putting in another 10% of wages as voluntary PF would take him to about {_L(G['vpf10']['corpus'])}. Interest on his own contributions above ₹2.5 lakh a year becomes taxable, though.</li>
  <li><strong>Not in EPS?</strong> All of the employer's 12% goes to EPF, so the balance is higher (about {_L(G['noEps']['corpus'])}), but there's no pension.</li>
</ul>

<h2 id="tax">Is it tax-free?</h2>
<p>Mostly. Interest on your own contributions (with VPF) above ₹2.5 lakh a year is taxable; for Arjun that's about {_L(Bs['taxInt'])} of interest over 30 years, in his last working years. Employer PF, NPS and superannuation together above ₹7.5 lakh a year is taxed. Withdrawals after 5 years of continuous service are generally tax-free.</p>
<p>Also saving in NPS? Read <a href="/guides/nps-vs-ppf-vs-epf/">NPS vs PPF vs EPF</a>.</p>

<h2 id="method">How these numbers were worked out</h2>
<p>All figures come from the <a href="/epf-calculator/">EPF calculator</a>: contributions of 12% each, 8.33% of wages up to ₹25,000 to EPS, interest on the monthly balance credited yearly at 8.25% (the rate approved for 2025-26) and assumed to stay the same, pay rising once a year, and an EPS estimate with past service at ₹15,000 and service from 17 September 2026 at up to ₹25,000. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information. EPF rates are declared every year and will differ from 8.25%.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "How much EPF at 58?", body, "EPF at 58")

def guide_wage_ceiling():
    G = _num("guide_epf_numbers.js"); Ce = G["ceil"]; Pn = G["pen"]
    path = "/guides/epf-wage-ceiling-25000/"
    toc = [("short-answer", "The short answer"), ("what", "What the wage ceiling is"), ("who", "Who it affects"), ("capped", "If your PF is on capped wages"),
           ("full", "If your PF is on full wages"), ("pension", "Your pension"), ("check", "What to check"), ("method", "Sources")]
    body = guide_head(path, "From 17 September 2026, the EPF wage ceiling went up from ₹15,000 to ₹25,000 a month, the first change since 2014. Depending on how your PF is worked out, it can lower your take-home, raise your PF, and raise your future pension. Here's what it means for you.",
                      "A gauge moving from 15,000 to 25,000").replace("TYPE_LINE", "<span>Effective 17 Sep 2026</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<ul>
  <li><strong>Earn up to ₹25,000?</strong> EPF, EPS and EDLI are now compulsory for you.</li>
  <li><strong>PF worked out on capped wages?</strong> Your PF deduction goes up from ₹1,800 to ₹3,000 a month, so take-home falls by ₹1,200, and your employer puts in ₹1,200 more too.</li>
  <li><strong>In EPS?</strong> Up to ₹2,083 a month now goes to your pension instead of ₹1,250, and service from 17 September 2026 counts at up to ₹25,000 for your pension.</li>
</ul>
<p class="g-cta"><a class="btn" href="/epf-calculator/">See the effect on your EPF</a></p>

<h2 id="what">What the wage ceiling is</h2>
<p>It's the monthly wage (basic + DA) used to decide who must be covered by EPF, EPS and EDLI, and the most on which contributions are compulsory and EPS is worked out. It was ₹15,000 from September 2014. The Union Cabinet approved ₹25,000 on 16 September 2026, effective from 17 September 2026, and it's notified under the Code on Social Security, 2020.</p>

<h2 id="who">Who it affects</h2>
<ul>
  <li><strong>New joiners earning ₹15,000 to ₹25,000:</strong> now covered compulsorily.</li>
  <li><strong>Members whose PF is worked out on the ceiling:</strong> contributions go up.</li>
  <li><strong>EPS members:</strong> more goes to the pension; members in EPF only with wages up to ₹25,000 are brought into EPS.</li>
  <li><strong>PF on full wages above ₹25,000, not in EPS:</strong> little changes.</li>
</ul>

<h2 id="capped">If your PF is on capped wages</h2>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">A month</th><th scope="col">Before (₹15,000)</th><th scope="col">Now (₹25,000)</th></tr></thead><tbody>
<tr><th scope="row">Your PF (12%)</th><td data-l="Before">₹{Ce['old']['own']:,.0f}</td><td data-l="Now">₹{Ce['now']['own']:,.0f}</td></tr>
<tr><th scope="row">Employer to EPS (8.33%)</th><td data-l="Before">₹{Ce['old']['eps']:,.0f}</td><td data-l="Now">₹{Ce['now']['eps']:,.2f}</td></tr>
<tr><th scope="row">Employer to EPF</th><td data-l="Before">₹{Ce['old']['emp']:,.0f}</td><td data-l="Now">₹{Ce['now']['emp']:,.2f}</td></tr>
</tbody></table></div>
<p>Over a career, that adds up. A 30-year-old with ₹1.5 lakh in EPF whose PF stays at the ceiling for 28 years would retire with about <strong>{_L(G['cap25']['corpus'])}</strong> at the ₹25,000 ceiling, against {_L(G['cap15']['corpus'])} had it stayed at ₹15,000 (at 8.25%, wages not rising).</p>

<h2 id="full">If your PF is on full wages</h2>
<p>Your and your employer's 12% don't change. But if you're in EPS, the employer's EPS share rises from ₹1,250 to up to ₹2,083 a month, so about ₹833 a month less goes into your EPF balance and more into your pension.</p>

<h2 id="pension">Your pension</h2>
<p>EPS pensions are worked out separately for each ceiling period: service up to 16 September 2026 at up to ₹15,000, and service after at up to ₹25,000. With 30 years of service, 10 before the change and 20 after (plus 2 years added for 20 years or more), the pension is about <strong>{_inr(Pn['mixed'])}</strong> a month, against {_inr(Pn['allOld'])} under the old ceiling. The full benefit builds up only as you add service, and your last 60 months' wages need to be at or above ₹25,000.</p>

<h2 id="check">What to check</h2>
<ol class="g-check">
  <li>Your September and October payslips: is PF worked out on ₹25,000 now, if it was capped before?</li>
  <li>Your EPFO passbook: is a pension contribution showing, if your wages are up to ₹25,000?</li>
  <li>Your take-home: if it fell, the extra is going into your PF and pension, not lost.</li>
</ol>
<p>Read also <a href="/guides/eps-pension-explained/">EPS explained</a> and <a href="/guides/how-much-epf-at-58/">How much will your EPF be at 58?</a></p>

<h2 id="method">Sources</h2>
<p>Ministry of Labour and Employment press releases of 16 September 2026 (Cabinet approval; effective 17 September 2026). Employees' Pension Scheme, 2026, paragraphs 4 and 11–12. Figures from the <a href="/epf-calculator/">EPF calculator</a>'s own code. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information. How your employer applies the new ceiling depends on your pay structure.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "EPF wage ceiling ₹25,000", body, "Wage ceiling ₹25,000")

def guide_retire_main():
    G = _num("guide_retire_numbers.js"); B = G["base"]; I = G["B"]
    path = "/guides/how-much-do-you-need-to-retire/"
    toc = [("short-answer", "The short answer"), ("meera", "Meera's plan"), ("need", "What she needs"), ("have", "What she'll have"),
           ("gap", "Closing the gap"), ("assumptions", "The assumptions that matter most"), ("method", "How these numbers were worked out")]
    body = guide_head(path, "Most people know their retirement number only as a vague \"a few crore\". Here's how to work out yours, through one person's numbers with the Salarist retirement planner: what she'll need, what her EPF and SIPs will add up to, and what closes the gap.",
                      "A path of savings blocks rising to a retirement point and then gently falling").replace("TYPE_LINE", "<span>EPF 8.25% for 2025-26 · before tax</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>A 35-year-old who spends ₹60,000 a month today and wants that lifestyle from 60 to 85 needs about <strong>{_L(B['need'])}</strong> at 60 (about {_L(B['needReal'])} in today's money), after her EPS pension. On her current EPF and SIPs she'll have about {_L(B['have'])}. An extra SIP of about <strong>{_inr(B['sip'])} a month</strong>, rising 5% a year, closes the gap; so does retiring at 62 or spending ₹50,000 instead of ₹60,000.</p>
<p class="g-cta"><a class="btn" href="/retirement-planner/">Work out your own number</a></p>

<h2 id="meera">Meera's plan</h2>
<ul>
  <li>Meera is 35 and wants to retire at 60, with money lasting until 85.</li>
  <li>She spends ₹60,000 a month today, and expects to spend the same in retirement (in today's money).</li>
  <li>She has ₹6 lakh in EPF on PF wages of ₹50,000 a month (rising 6% a year), and 8 years in EPS.</li>
  <li>She has ₹8 lakh in mutual funds and a SIP of ₹10,000 a month that she raises 5% a year, plus ₹3 lakh in FDs and PPF.</li>
  <li>Assumptions: 6% inflation, 11% on mutual funds, 7% on FDs, and 7% on her savings after she retires.</li>
</ul>

<h2 id="need">What she needs</h2>
<ul>
  <li><strong>Spending at 60:</strong> ₹60,000 today becomes about {_inr(B['spendAt'])} a month after 25 years of 6% inflation.</li>
  <li><strong>For 25 years:</strong> that spending keeps rising every year she's retired, while her savings earn 7%.</li>
  <li><strong>Less her EPS pension:</strong> about {_inr(B['eps'])} a month from 60. It doesn't rise with inflation, so it covers less each year.</li>
  <li><strong>Result:</strong> she needs about <strong>{_L(B['need'])}</strong> at 60.</li>
</ul>

<h2 id="have">What she'll have</h2>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">At 60</th><th scope="col">Amount</th></tr></thead><tbody>
<tr><th scope="row">EPF</th><td data-l="Amount">{_L(B['epf'])}</td></tr>
<tr><th scope="row">Mutual funds and SIPs</th><td data-l="Amount">{_L(B['mf'])}</td></tr>
<tr><th scope="row">FD, PPF and other savings</th><td data-l="Amount">{_L(B['fd'])}</td></tr>
<tr><th scope="row"><b>She'll have</b></th><td data-l="Amount"><b>{_L(B['have'])}</b></td></tr>
<tr><th scope="row">She needs</th><td data-l="Amount">{_L(B['need'])}</td></tr>
<tr><th scope="row"><b>Gap</b></th><td data-l="Amount"><b>{_L(B['gap'])}</b></td></tr>
</tbody></table></div>
<p>Without changes, her money would run out at about {B['runsOut']}.</p>

<h2 id="gap">Closing the gap</h2>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Change</th><th scope="col">Result</th></tr></thead><tbody>
<tr><th scope="row">Extra SIP of {_inr(B['sip'])} a month, rising 5% a year</th><td data-l="Result">Gap closed</td></tr>
<tr><th scope="row">Retire at 62 instead of 60</th><td data-l="Result">Gap down to {_L(G['late62']['gap'])}</td></tr>
<tr><th scope="row">Spend ₹50,000 a month instead of ₹60,000</th><td data-l="Result">On track</td></tr>
<tr><th scope="row">Put ₹5,000 a month into NPS</th><td data-l="Result">Gap down to {_L(G['nps']['gap'])}, plus an NPS pension of about {_inr(G['nps']['npsPen'])} a month</td></tr>
</tbody></table></div>
<p>The extra SIP is the simplest: starting it at 35, with yearly increases, costs much less than catching up at 45.</p>

<h2 id="assumptions">The assumptions that matter most</h2>
<ul>
  <li><strong>Inflation:</strong> at 7% instead of 6%, she'd need {_L(G['infl7']['need'])} and the extra SIP would be {_inr(G['infl7']['sip'])} a month.</li>
  <li><strong>Returns:</strong> 1% lower on everything takes the extra SIP to {_inr(G['ret6']['sip'])} a month.</li>
  <li><strong>How long you plan for:</strong> planning to 90 instead of 85 takes the need to {_L(G['to90']['need'])}. Running out at 85 is worse than leaving some behind.</li>
  <li><strong>Tax:</strong> these are before-tax figures. EPF withdrawals are tax-free, but pensions, FD interest and part of mutual fund gains are taxed, so keep a margin.</li>
</ul>
<p>Read also <a href="/guides/25x-rule-retirement-india/">The 25× rule: does it work in India?</a> and <a href="/guides/how-much-epf-at-58/">How much will your EPF be at 58?</a></p>

<h2 id="method">How these numbers were worked out</h2>
<p>All figures come from the <a href="/retirement-planner/">retirement planner</a>, which uses the <a href="/epf-calculator/">EPF calculator</a>'s and <a href="/nps-calculator/">NPS calculator</a>'s own code: EPF at 8.25% (the rate approved for 2025-26, assumed to stay the same), the EPS pension estimate under EPS 2026, SIPs growing monthly and stepping up yearly, and withdrawals at the start of each retirement year. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information. Returns and inflation will differ from these assumptions; check your plan once a year.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "How much do you need to retire?", body, "How much to retire")

def guide_25x():
    G = _num("guide_retire_numbers.js"); M = G["mult"]; X = G["x25"]; Ls = G["lasts"]
    path = "/guides/25x-rule-retirement-india/"
    toc = [("short-answer", "The short answer"), ("rule", "What the 25× rule says"), ("india", "Why India is different"), ("table", "The multiple you need"),
           ("example", "An example"), ("use", "How to use it"), ("method", "How these numbers were worked out")]
    body = guide_head(path, "\"Save 25 times your yearly spending and you can retire\" is the most quoted retirement rule. It comes from the US. Here's whether it holds in India, where inflation is higher, and what multiple you actually need.",
                      "Twenty-five small stacks of coins in a grid").replace("TYPE_LINE", "<span>Assumes 6% inflation</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>With 6% inflation, 25 times your first year's spending lasts about <strong>{Ls['7']} years at a 7% return</strong> after retiring, and only {Ls['6']} years at 6%. That's enough if you retire at 60 and plan to 85. If you retire earlier, plan to 90, or keep your money mostly in FDs, you need 30 times or more.</p>
<p class="g-cta"><a class="btn" href="/retirement-planner/">Work out your own number</a></p>

<h2 id="rule">What the 25× rule says</h2>
<p>Save 25 times what you'll spend in your first year of retirement. It's the same as taking out 4% in the first year and raising it with inflation every year after. It's based on US studies of stock and bond returns, where inflation has averaged around 3%.</p>

<h2 id="india">Why India is different</h2>
<p>What matters is the gap between the return your savings earn after you retire and inflation. In India, inflation has been higher (around 5–6%), and retirees often keep most of their money in FDs and other safe options earning 7–8% before tax. That leaves a real return of only 1–2% a year, much less than the rule assumes.</p>

<h2 id="table">The multiple you need</h2>
<p>How many times your first year's spending you need at retirement, with 6% inflation and no pension:</p>
<div class="g-scroll"><table class="g-tbl"><thead><tr><th scope="col">Years in retirement</th><th scope="col">6% return</th><th scope="col">7% return</th><th scope="col">8% return</th><th scope="col">9% return</th></tr></thead><tbody>
""" + "".join(f'<tr><th scope="row">{y} years</th>' + "".join(f'<td>{M[str(y)][str(r)]:.1f}×</td>' for r in (6, 7, 8, 9)) + "</tr>" for y in (25, 30, 35)) + f"""
</tbody></table></div>
<p>At a 6% return with 6% inflation, your money earns nothing in real terms, so you need exactly one year's spending for each year of retirement.</p>

<h2 id="example">An example</h2>
<ul>
  <li>Spending ₹50,000 a month today, retiring in 25 years: about {_L(X['firstYear'])} in the first year of retirement, after 6% inflation.</li>
  <li><strong>25×:</strong> {_L(X['rule'])}.</li>
  <li><strong>What's needed at a 7% return:</strong> {_L(X['need25'])} for 25 years, {_L(X['need30'])} for 30 years, {_L(X['need35'])} for 35 years.</li>
</ul>
<p>So 25× is a little more than enough for 25 years, and short for 30 or 35.</p>

<h2 id="use">How to use it</h2>
<ul>
  <li><strong>As a first check,</strong> not a plan: multiply your expected first-year spending by 25 to 30.</li>
  <li><strong>Count your pensions:</strong> an EPS or NPS pension covers part of your spending, so you need less. The <a href="/retirement-planner/">retirement planner</a> takes them off.</li>
  <li><strong>Keep some equity</strong> after you retire: an extra 1–2% a year in return makes a big difference over 30 years.</li>
  <li><strong>Plan longer than you expect to live,</strong> especially if you retire before 60.</li>
</ul>
<p>Read also <a href="/guides/how-much-do-you-need-to-retire/">How much do you need to retire? One person's numbers</a>.</p>

<h2 id="method">How these numbers were worked out</h2>
<p>Spending is taken out at the start of each year and rises 6% a year; the rest earns the return shown. The multiple is the amount needed at retirement divided by the first year's spending, the same way the <a href="/retirement-planner/">retirement planner</a> works out what you need. Before tax. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information. Returns and inflation will differ from these assumptions.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "The 25× rule in India", body, "25× rule")

def guide_pf_transfer():
    G = _num("guide_retire_numbers.js"); Pg = G["pfGrow"]
    path = "/guides/transfer-pf-dont-withdraw/"
    toc = [("short-answer", "The short answer"), ("cost", "What withdrawing costs"), ("how", "How to transfer your PF"), ("eps", "What happens to EPS"),
           ("tax", "Tax"), ("check", "Check after the transfer"), ("method", "Sources")]
    body = guide_head(path, "Changing jobs is the most common time to empty your PF account. It's also the most expensive. Here's what withdrawing really costs, and how to transfer your PF to your new employer instead.",
                      "Two buildings joined by an arrow carrying a coin").replace("TYPE_LINE", "<span>EPF Scheme 2026</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<p>Keep your UAN, and let your PF move to your new member ID: it often happens automatically, and otherwise takes one online request (Form 13). ₹3 lakh withdrawn at 28 would have been about <strong>{_L(Pg['at28'])}</strong> at 58 at today's 8.25%. Withdrawing also resets your EPS service, and can make the money taxable.</p>
<p class="g-cta"><a class="btn" href="/epf-calculator/">See what your PF grows to</a></p>

<h2 id="cost">What withdrawing costs</h2>
<ul>
  <li><strong>Lost growth:</strong> ₹3 lakh left in EPF at 8.25% grows to about {_L(Pg['at28'])} over 30 years, or {_L(Pg['at32'])} over 26 years.</li>
  <li><strong>Your pension:</strong> if you also take the EPS withdrawal benefit, your EPS service starts from zero, and you may never reach the 10 years needed for a pension.</li>
  <li><strong>Tax:</strong> PF withdrawn before 5 years of continuous service is generally taxable.</li>
  <li><strong>Waiting:</strong> under the EPF Scheme, 2026, you can withdraw the full balance only after 12 months without a job, so withdrawing isn't quick anyway.</li>
</ul>

<h2 id="how">How to transfer your PF</h2>
<ol class="g-check">
  <li><strong>Give your new employer your existing UAN.</strong> Don't let them create a new one. They'll open a new member ID under it.</li>
  <li><strong>Check that your UAN is linked to Aadhaar,</strong> and that your name and date of birth match. With these in place, EPFO usually starts the transfer automatically after your new employer's first contribution.</li>
  <li><strong>If it doesn't start in a couple of months,</strong> file the transfer request (Form 13) on the EPFO member portal: choose the old member ID, and approve it with the OTP on your Aadhaar-linked mobile.</li>
  <li><strong>Make sure your old employer has marked your date of exit.</strong> If they haven't, you can update it yourself on the member portal once two months have passed since the last contribution.</li>
</ol>

<h2 id="eps">What happens to EPS</h2>
<p>Your EPS money doesn't move: it stays in the pension fund. What moves is your service record, so your years with the old employer keep counting towards the 10 years needed for a pension and towards its amount. Read <a href="/guides/eps-pension-explained/">EPS explained</a>, or work out your pension with the <a href="/eps-pension-calculator/">EPS pension calculator</a>.</p>

<h2 id="tax">Tax</h2>
<p>After a transfer, your service with the old employer counts towards the 5 years of continuous service, so a later withdrawal can stay tax-free. Withdrawing instead of transferring breaks that count.</p>

<h2 id="check">Check after the transfer</h2>
<ul>
  <li>The old member ID's balance shows as zero and the new one shows it as "transfer in" in your passbook.</li>
  <li>Your service history lists every employer with no gaps.</li>
  <li>If your old employer ran its own PF trust, the PF comes from the trust and your EPS service from EPFO: check both.</li>
</ul>

<h2 id="method">Sources</h2>
<p>Employees' Provident Funds Scheme, 2026 and Employees' Pension Scheme, 2026 (notified 29 June 2026). EPFO member portal (transfer request, date of exit). Growth at 8.25%, the EPF rate approved for 2025-26, compounded yearly and assumed to stay the same. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information. EPFO's portal steps change from time to time; follow the current instructions there.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "Transfer your PF, don't withdraw it", body, "Transfer your PF")

def guide_mf_tax():
    import subprocess
    G = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "guide_sip_numbers.js")]))
    E, D = G["eq"], G["debt"]
    path = "/guides/how-mutual-fund-gains-are-taxed/"
    toc = [("short-answer", "The short answer"), ("equity", "Equity funds"), ("debt", "Debt funds"), ("sip", "How it works for a SIP"), ("example", "An example"),
           ("tips", "Ways to pay less, legally"), ("method", "Sources")]
    body = guide_head(path, "You pay tax on mutual funds only when you sell, and how much depends on the type of fund and how long you held it. Here are the rules for tax year " + TAX_YEAR + ", what they mean for a SIP, and a worked example.",
                      "A rupee coin passing through a filter into a jar").replace("TYPE_LINE", f"<span>Written for tax year {TAX_YEAR}</span>")
    body += f"""
<div class="wrap g-body prose">
{toc_html(toc)}
<h2 id="short-answer">The short answer</h2>
<div class="g-scroll"><table class="g-tbl g-stack"><thead><tr><th scope="col">Fund type</th><th scope="col">Held 12 months or less</th><th scope="col">Held over 12 months</th></tr></thead><tbody>
<tr><th scope="row">Equity funds</th><td data-l="Held 12 months or less">20%</td><td data-l="Held over 12 months">12.5% on gains above ₹1,25,000 a year</td></tr>
<tr><th scope="row">Debt funds (bought from 1 April 2023)</th><td data-l="Held 12 months or less">Your slab rate</td><td data-l="Held over 12 months">Your slab rate</td></tr>
</tbody></table></div>
<p>Add 4% cess to all of these. You pay nothing while you stay invested; tax is due in the year you sell.</p>
<p class="g-cta"><a class="btn" href="/sip-calculator/">See your SIP after tax</a></p>

<h2 id="equity">Equity funds</h2>
<p>Funds that invest at least 65% in Indian shares are taxed as equity. If you sell units after more than 12 months, the gain is long-term: the first ₹1,25,000 of long-term gains in a tax year is tax-free, and the rest is taxed at 12.5% plus cess. If you sell within 12 months, the gain is short-term and taxed at 20% plus cess.</p>

<h2 id="debt">Debt funds</h2>
<p>For debt fund units bought from 1 April 2023, the gain is added to your income and taxed at your slab rate, however long you hold them. There's no lower long-term rate. That's why a debt fund's after-tax return is close to a fixed deposit's for people in the higher slabs.</p>

<h2 id="sip">How it works for a SIP</h2>
<p>Each SIP instalment counts as a separate purchase with its own date. When you sell, the oldest units go first. So if you sell your whole SIP portfolio, the instalments from the last 12 months are short-term, and everything older is long-term.</p>

<h2 id="example">An example</h2>
<p>₹10,000 a month for 10 years, sold all at once at the end, all units treated as long-term:</p>
<ul>
  <li><strong>Equity fund at 12% a year:</strong> it grows to {_L(E['value'])} on {_L(E['invested'])} put in. Tax on the {_L(E['gain'])} gain, after the ₹1,25,000 limit, is about <strong>{_inr(E['tax'])}</strong>, leaving {_L(E['after'])}.</li>
  <li><strong>Debt fund at 7% a year, 30% slab:</strong> it grows to {_L(D['value'])}. Tax on the {_L(D['gain'])} gain is about <strong>{_inr(D['tax'])}</strong>, leaving {_L(D['after'])}.</li>
</ul>

<h2 id="tips">Ways to pay less, legally</h2>
<ol class="g-check">
  <li><strong>Sell in stages.</strong> Spread equity withdrawals over two or three tax years to use the ₹1,25,000 limit each year.</li>
  <li><strong>Book gains each year.</strong> Some investors sell and buy back enough units each year to realise ₹1,25,000 of long-term gain tax-free. Check exit loads first.</li>
  <li><strong>Wait past 12 months</strong> before selling equity units, to pay 12.5% instead of 20%.</li>
</ol>
<p>The <a href="/sip-calculator/">SIP calculator</a> shows your value after tax for both fund types. Planning a goal? Read <a href="/guides/how-much-sip-do-you-need/">How much SIP do you need?</a></p>

<h2 id="method">Sources</h2>
<p>Capital gains rates from the Finance (No. 2) Act, 2024, unchanged by Budget 2026; the treatment of debt fund units bought from 1 April 2023 from the Finance Act, 2023; checked for tax year {TAX_YEAR} against the <a href="https://www.incometax.gov.in/" rel="noopener">Income Tax Department</a>. Examples from the <a href="/sip-calculator/">SIP calculator</a>. Read <a href="/methodology/">how we check our numbers</a>.</p>
<p class="g-note">This article is for information and education. It isn't tax advice. Surcharge, grandfathering of gains before 31 January 2018, and special fund types aren't covered; check with a tax adviser for your situation.</p>
</div>
</article>
{related(path)}
"""
    return article(path, "x", "How mutual fund gains are taxed", body, "Mutual fund tax")

TOPICS = [("retire", "Retirement and pension"), ("invest", "Investing"), ("home", "Home and loans"), ("tax", "Tax"), ("car", "Car"), ("money", "Budget and leave")]
TOOL_TOPIC = {"/epf-calculator/": "retire", "/eps-pension-calculator/": "retire", "/nps-calculator/": "retire", "/retirement-planner/": "retire", "/gratuity-calculator/": "retire",
              "/sip-calculator/": "invest", "/fd-ppf-rd-calculator/": "invest", "/rent-vs-buy/": "home", "/prepay-vs-invest/": "home", "/emi-calculator/": "home",
              "/income-tax-section-finder/": "tax", "/company-car-lease-vs-loan/": "car", "/car-ownership-cost/": "car", "/budget-planner/": "money", "/leave-planner-2027/": "money"}
# Guides listed under more than one tool appear once on /guides/, under the tool they belong to most.
GUIDE_HOME = {"/guides/nps-vs-ppf-vs-epf/": "/nps-calculator/", "/guides/eps-pension-explained/": "/eps-pension-calculator/",
              "/guides/epf-wage-ceiling-25000/": "/epf-calculator/", "/guides/transfer-pf-dont-withdraw/": "/epf-calculator/"}
TAX_WORDS = ("tax", "tds", "regime", "section", "perquisite", "hra", "80c")

def guides_index():
    gmap = {g[0]: g for g in GUIDES}
    tools = [(tp, n, [x for x in gl if x in gmap]) for grp, items in catalog() for tp, n, d, live, st, gl in items if live]
    home = {}
    for tp, n, gl in tools:
        for x in gl: home.setdefault(x, tp)
    home.update({k: v for k, v in GUIDE_HOME.items() if k in gmap})
    mains = {gl[0] for tp, n, gl in tools if gl}
    def card(g, tool_name):
        p, t, ds, d, im, sec = g
        tp = home.get(p); topics = {TOOL_TOPIC.get(tp, "money")}
        if any(w in (t + " " + ds).lower() for w in TAX_WORDS): topics.add("tax")
        badge = '<span class="gx-main">Start here</span>' if p in mains else ""
        return (f'<a class="g-card" href="{p}" data-date="{d}" data-topics="{" ".join(sorted(topics))}" data-main="{1 if p in mains else 0}" data-text="{H.escape((t + " " + ds + " " + tool_name).lower())}">'
                f'{_pic(im, "")}<span class="k">{badge}{tool_name} · {_date(d)}</span><b>{t}</b><span>{ds}</span></a>')
    secs, used = "", set()
    for tp, n, gl in tools:
        gs = [gmap[x] for x in gl if home.get(x) == tp and x not in used]
        gs.sort(key=lambda g: g[0] not in mains)
        if not gs: continue
        used.update(g[0] for g in gs)
        secs += (f'<div class="gx-sec" data-topic="{TOOL_TOPIC.get(tp, "money")}"><h2 class="list-h" id="{_gslug(tp)}" style="margin:36px 0 6px;scroll-margin-top:90px">{n}</h2>'
                 f'<p class="hint" style="margin:0 0 14px">{len(gs)} guide{"s" if len(gs) != 1 else ""} · <a href="{tp}">Open the {n} tool</a></p><div class="g-cards">'
                 + "".join(card(g, n) for g in gs) + "</div>"
                 + (f'<button type="button" class="btn-sm gx-more" hidden>Show all {len(gs)} guides</button>' if len(gs) > 3 else "") + "</div>")
    rest = [g for g in GUIDES if g[0] not in used]
    if rest: secs += '<div class="gx-sec" data-topic="money"><h2 class="list-h" style="margin:36px 0 14px">More guides</h2><div class="g-cards">' + "".join(card(g, g[5]) for g in rest) + "</div></div>"
    chips = '<button type="button" class="gx-chip" data-t="all" aria-pressed="true">All</button>' + "".join(f'<button type="button" class="gx-chip" data-t="{k}" aria-pressed="false">{v}</button>' for k, v in TOPICS)
    n_all = len(GUIDES)
    body = (f'<section class="tool-hero"><div class="wrap"><p class="eyebrow">Guides</p><h1>Guides to the big money decisions</h1>'
            f'<p class="lead">{n_all} plain-English guides, each with a worked example from the matching tool. Search, pick a topic, or browse by tool. Written for tax year {TAX_YEAR}.</p>'
            f'<div class="gx-bar"><label class="gx-search"><span class="sr-only">Search guides</span><input id="gxQ" type="search" placeholder="Search guides: gratuity, 80C, pension, job change…" autocomplete="off"></label>'
            f'<div class="gx-chips" role="group" aria-label="Topics">{chips}</div>'
            f'<div class="gx-row"><span id="gxCount" class="hint" aria-live="polite">{n_all} guides</span>'
            f'<label class="gx-sort">Show <select id="gxSort" class="sel"><option value="tool">By tool</option><option value="new">Newest first</option><option value="main">Start-here guides only</option></select></label></div></div>'
            f'</div></section>'
            f'<section style="padding-top:0"><div class="wrap"><div id="gxTools">{secs}</div><div id="gxFlat" class="g-cards" hidden></div>'
            f'<p id="gxNone" class="hint" hidden>No guides match. Try a shorter word, or <a href="/tools/">browse the tools</a>.</p></div></section>')
    graph = [{"@type": "CollectionPage", "name": "Salarist guides", "url": SITE + "/guides/", "inLanguage": "en-IN",
              "mainEntity": {"@type": "ItemList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": SITE + g[0], "name": g[1]} for i, g in enumerate(GUIDES)]}}]
    return layout("/guides/", "Guides to Salaried Money Decisions in India | Salarist",
                  "Plain-English guides with worked examples for salaried Indians: tax, EPF and pension, retirement, investing, home loans, car and leave.",
                  body, crumbs=[("/", "Home"), ("/guides/", "Guides")], graph=graph, css=("tool.css", "guide.css"), js=("guides.js",), og="og-home.png")

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
    if SIP_LIVE: write("/sip-calculator/", sip_page())
    if GRATUITY_LIVE: write("/gratuity-calculator/", gratuity_page())
    if SECTIONS_LIVE: write("/income-tax-section-finder/", sections_page())
    if DEPOSITS_LIVE: write("/fd-ppf-rd-calculator/", deposits_page())
    if CAROWN_LIVE: write("/car-ownership-cost/", car_own_page())
    if NPS_LIVE: write("/nps-calculator/", nps_page())
    if EPF_LIVE: write("/epf-calculator/", epf_page())
    if RETIRE_LIVE: write("/retirement-planner/", retirement_page())
    if EPS_LIVE: write("/eps-pension-calculator/", eps_page())
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
    write("/guides/how-part-payments-cut-your-home-loan/", guide_emi())
    write("/guides/car-lease-new-tax-regime/", guide_car_newregime())
    write("/guides/plan-for-school-fees-and-yearly-costs/", guide_yearly_costs())
    write("/guides/how-much-sip-do-you-need/", guide_sip_goal())
    write("/guides/step-up-sip/", guide_sip_step())
    write("/guides/how-mutual-fund-gains-are-taxed/", guide_mf_tax())
    write("/guides/gratuity-new-labour-codes/", guide_gratuity())
    write("/guides/new-income-tax-section-numbers/", guide_sections())
    write("/guides/fd-rd-or-ppf/", guide_fd_main())
    write("/guides/how-much-do-you-need-to-retire/", guide_retire_main())
    write("/guides/25x-rule-retirement-india/", guide_25x())
    write("/guides/transfer-pf-dont-withdraw/", guide_pf_transfer())
    write("/guides/eps-pension-explained/", guide_eps())
    write("/guides/how-much-epf-at-58/", guide_epf_main())
    write("/guides/epf-wage-ceiling-25000/", guide_wage_ceiling())
    write("/guides/nps-new-exit-rules/", guide_nps_main())
    write("/guides/employer-nps-14-percent-new-regime/", guide_employer_nps())
    write("/guides/nps-80-percent-withdrawal-tax/", guide_nps_gap())
    write("/guides/nps-vs-ppf-vs-epf/", guide_nps_vs())
    write("/guides/petrol-cng-or-ev-cost-per-km/", guide_car_cost())
    write("/guides/sip-or-lump-sum-bonus/", guide_bonus_sip())
    write("/guides/is-gratuity-taxable-20-lakh-limit/", guide_gratuity_tax())
    write("/guides/fd-interest-tax-below-50000/", guide_fd_tds())
    write("/guides/ppf-deposit-by-5-april/", guide_ppf_april())
    write("/guides/gratuity-six-month-rule-when-to-resign/", guide_gratuity_resign())
    write("/guides/are-your-sips-on-track/", guide_sip_track())
    write("/guides/is-rent-really-dead-money/", guide_rent_dead())
    write("/guides/prepay-home-loan-early-or-later/", guide_prepay_timing())
    for p, (name, title, desc, h1, b) in PAGES.items(): write(p, text_page(p, name, title, desc, h1, b))
    write("/404.html", page_404())
    urls = [("/", "1.0"), ("/tools/", "0.6"), ("/leave-planner-2027/", "0.9"), ("/prepay-vs-invest/", "0.9"), ("/rent-vs-buy/", "0.9"), ("/guides/", "0.6"), ("/guides/rent-vs-buy/", "0.8"), ("/guides/long-weekends-2027/", "0.8"), ("/guides/monthly-budget/", "0.8"), ("/budget-planner/", "0.9"), ("/guides/prepay-home-loan-or-invest/", "0.8"), ("/guides/under-construction-vs-ready-to-move/", "0.7"), ("/guides/hra-vs-home-loan-tax-benefits/", "0.7"), ("/guides/restricted-holidays-2027/", "0.7"), ("/guides/budget-on-50000-1-lakh-2-lakh-salary/", "0.7"), ("/guides/company-car-lease-vs-car-loan/", "0.8"), ("/guides/company-car-perquisite-value-2026/", "0.7"), ("/guides/best-months-for-a-week-long-break-2027/", "0.7"), ("/guides/long-weekends-2027-six-day-week/", "0.7"), ("/guides/how-part-payments-cut-your-home-loan/", "0.8"), ("/guides/car-lease-new-tax-regime/", "0.7"), ("/guides/plan-for-school-fees-and-yearly-costs/", "0.7"), ("/guides/how-much-sip-do-you-need/", "0.8"), ("/guides/step-up-sip/", "0.7"), ("/guides/how-mutual-fund-gains-are-taxed/", "0.7"), ("/guides/gratuity-new-labour-codes/", "0.8"), ("/guides/new-income-tax-section-numbers/", "0.8"), ("/guides/fd-rd-or-ppf/", "0.8"), ("/guides/how-much-do-you-need-to-retire/", "0.8"), ("/guides/25x-rule-retirement-india/", "0.7"), ("/guides/transfer-pf-dont-withdraw/", "0.7"), ("/guides/how-much-epf-at-58/", "0.8"), ("/guides/eps-pension-explained/", "0.8"), ("/guides/epf-wage-ceiling-25000/", "0.7"), ("/guides/nps-new-exit-rules/", "0.8"), ("/guides/employer-nps-14-percent-new-regime/", "0.7"), ("/guides/nps-80-percent-withdrawal-tax/", "0.7"), ("/guides/nps-vs-ppf-vs-epf/", "0.7"), ("/guides/petrol-cng-or-ev-cost-per-km/", "0.8"), ("/guides/sip-or-lump-sum-bonus/", "0.7"), ("/guides/is-gratuity-taxable-20-lakh-limit/", "0.7"), ("/guides/fd-interest-tax-below-50000/", "0.7"), ("/guides/ppf-deposit-by-5-april/", "0.7"), ("/guides/gratuity-six-month-rule-when-to-resign/", "0.7"), ("/guides/are-your-sips-on-track/", "0.7"), ("/guides/is-rent-really-dead-money/", "0.7"), ("/guides/prepay-home-loan-early-or-later/", "0.7")] + ([("/company-car-lease-vs-loan/", "0.9")] if CAR_LIVE else []) + ([("/emi-calculator/", "0.9")] if EMI_LIVE else []) + ([("/sip-calculator/", "0.9")] if SIP_LIVE else []) + ([("/gratuity-calculator/", "0.9")] if GRATUITY_LIVE else []) + ([("/income-tax-section-finder/", "0.9")] if SECTIONS_LIVE else []) + ([("/fd-ppf-rd-calculator/", "0.9")] if DEPOSITS_LIVE else []) + ([("/car-ownership-cost/", "0.9")] if CAROWN_LIVE else []) + ([("/nps-calculator/", "0.9")] if NPS_LIVE else []) + ([("/epf-calculator/", "0.9")] if EPF_LIVE else []) + ([("/retirement-planner/", "0.9")] if RETIRE_LIVE else []) + ([("/eps-pension-calculator/", "0.9")] if EPS_LIVE else []) + [(p, "0.3") for p in PAGES]
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
    check_seo()
    check_links()
    print("built", sum(len(fs) for _, _, fs in os.walk(DIST)), "files")

if __name__ == "__main__":
    main()
