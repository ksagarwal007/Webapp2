/* Salarist income tax section finder: Income-tax Act, 1961 → Income-tax Act, 2025.
   Every row was checked against the section text on incometaxindia.gov.in (Income Tax Department) on 14 Nov 2026.
   Fields: o = old reference, n = new reference, t = what it covers, g = group, k = extra search words, d = one-line note, u = Salarist tool link. */
(function () {
  "use strict";
  var DATA = [
    /* Salary */
    { p: 4, o: "16(ia)", r: "diff", n: "19(1), Table S. No. 2", t: "Standard deduction from salary", g: "salary", k: "std deduction 75000 50000", d: "₹75,000 under the new regime, ₹50,000 under the old." },
    { o: "16(iii)", r: "old", n: "19(1), Table S. No. 1", t: "Professional tax (tax on employment)", g: "salary", k: "profession tax ptax", d: "The full amount paid is deducted." },
    { o: "17(2)", r: "both", n: "17", t: "Perquisites (company car, rent-free house and other benefits)", g: "salary", k: "perks perquisite car accommodation", d: "Values are set by the Income-tax Rules, 2026.", u: ["/company-car-lease-vs-loan/", "Car Lease vs Car Loan"] },
    { p: 4, o: "10(10)", r: "both", n: "19(1), Table S. Nos. 3 to 6", t: "Gratuity", g: "salary", k: "gratuity retirement resignation", d: "Tax-free up to ₹20 lakh for private-sector employees; fully tax-free for government employees.", u: ["/gratuity-calculator/", "Gratuity Calculator"] },
    { o: "10(10AA)", r: "both", n: "19(1), Table S. Nos. 13 and 14", t: "Leave encashment on retirement or leaving", g: "salary", k: "leave encashment earned leave", d: "Fully tax-free for government employees; capped for others." },
    { o: "10(10A)", r: "both", n: "19(1), Table S. No. 8", t: "Commuted pension from a non-government employer", g: "salary", k: "pension commutation commuted", d: "One-third tax-free if you also get gratuity, otherwise one-half." },
    { o: "10(10B)", r: "both", n: "19(1), Table S. Nos. 10 and 11", t: "Retrenchment compensation", g: "salary", k: "retrenchment closure workman", d: "" },
    { o: "10(10C)", r: "both", n: "19(1), Table S. No. 12", t: "Voluntary retirement (VRS) payment", g: "salary", k: "vrs voluntary retirement", d: "Up to ₹5 lakh tax-free." },
    { p: 4, o: "10(13A)", r: "old", n: "Schedule III, Table S. No. 11 (with rule 279)", t: "House rent allowance (HRA)", g: "salary", k: "hra house rent allowance rule 2a", d: "The 50% metro rate now also covers Hyderabad, Pune, Ahmedabad and Bengaluru.", u: ["/rent-vs-buy/", "Rent or Buy"] },
    { o: "10(5)", r: "old", n: "Schedule III, Table S. No. 8", t: "Leave travel allowance (LTA / LTC)", g: "salary", k: "lta ltc leave travel", d: "" },
    { o: "10(14)", r: "part", n: "Schedule III, Table S. Nos. 12 and 13 (with rule 280)", t: "Special allowances (travel, daily, children's education and others)", g: "salary", k: "allowance children education hostel conveyance", d: "Children's education and hostel allowances count only under the old regime." },
    { o: "192", r: "both", n: "392", t: "TDS on salary", g: "salary", k: "tds salary employer deduct", d: "Your employer deducts tax under this section." },
    /* Deductions */
    { p: 4, o: "80C", r: "old", n: "123 (with Schedule XV)", t: "PPF, EPF, ELSS, life insurance, home loan principal, tuition fees and more", g: "deductions", k: "80c ppf epf elss lic tuition principal sukanya nsc 150000", d: "Up to ₹1.5 lakh a year. The list of eligible items is in Schedule XV.", u: ["/sip-calculator/", "SIP Calculator"] },
    { o: "80CCC", r: "old", n: "123 (Schedule XV)", t: "Pension plan of LIC or another insurer", g: "deductions", k: "80ccc pension annuity", d: "Counts within the ₹1.5 lakh limit." },
    { o: "80CCD(1)", r: "old", n: "123 (Schedule XV, para 1(y))", t: "Your own NPS contribution, up to 10% of salary", g: "deductions", k: "nps 80ccd1 pension", d: "Counts within the ₹1.5 lakh limit." },
    { p: 4, o: "80CCD(1B)", r: "old", n: "124(3)", t: "Extra ₹50,000 for your own NPS contribution", g: "deductions", k: "nps 80ccd1b 50000 additional", d: "Over and above ₹1.5 lakh." },
    { o: "80CCD(2)", r: "both", n: "124(1) and 124(2)", t: "Employer's NPS contribution", g: "deductions", k: "nps employer 80ccd2 14%", d: "Up to 14% of salary under the new regime, 10% under the old (14% for government employers)." },
    { p: 4, o: "80D", r: "old", n: "126", t: "Health insurance premium and health check-ups", g: "deductions", k: "80d health insurance mediclaim parents preventive", d: "₹25,000 for your family, ₹25,000 more for parents (₹50,000 each for senior citizens)." },
    { o: "80DD", r: "old", n: "127", t: "Care of a dependant with disability", g: "deductions", k: "80dd disability dependant", d: "₹75,000, or ₹1,25,000 for severe disability." },
    { o: "80DDB", r: "old", n: "128", t: "Treatment of specified illnesses", g: "deductions", k: "80ddb medical treatment disease", d: "Up to ₹40,000, less any insurance payout." },
    { o: "80E", r: "old", n: "129", t: "Interest on an education loan", g: "deductions", k: "80e education loan interest higher studies", d: "" },
    { o: "80EE", r: "old", n: "130", t: "Home loan interest for first-time buyers (loans sanctioned in 2016-17)", g: "deductions", k: "80ee home loan first time", d: "", u: ["/emi-calculator/", "EMI Calculator"] },
    { o: "80EEA", r: "old", n: "131", t: "Home loan interest for affordable housing (loans sanctioned 2019 to 2022)", g: "deductions", k: "80eea affordable home loan 150000", d: "Up to ₹1.5 lakh.", u: ["/emi-calculator/", "EMI Calculator"] },
    { o: "80G", r: "old", n: "133", t: "Donations to charities and relief funds", g: "deductions", k: "80g donation charity", d: "Only donations made as money count." },
    { o: "80GG", r: "old", n: "134", t: "Rent paid when you don't get HRA", g: "deductions", k: "80gg rent no hra self employed", d: "Up to ₹5,000 a month." },
    { o: "80GGC", r: "old", n: "137", t: "Contributions to political parties", g: "deductions", k: "80ggc political party", d: "" },
    { o: "80TTA", r: "old", n: "153(2)(a)", t: "Savings account interest", g: "deductions", k: "80tta savings bank interest 10000", d: "Up to ₹10,000." },
    { o: "80TTB", r: "old", n: "153(2)(b)", t: "Interest on deposits for senior citizens", g: "deductions", k: "80ttb senior citizen fd interest 50000", d: "Up to ₹50,000." },
    { o: "80U", r: "old", n: "154", t: "Taxpayer with a disability", g: "deductions", k: "80u disability", d: "₹75,000, or ₹1,25,000 for severe disability." },
    /* Tax and regime */
    { p: 4, o: "87A", r: "diff", n: "156", t: "Tax rebate", g: "tax", k: "87a rebate 12 lakh 60000 zero tax", d: "New regime: no tax up to ₹12 lakh of taxable income. Old regime: up to ₹12,500, if income is ₹5 lakh or less." },
    { p: 4, o: "115BAC", r: "new", n: "202", t: "New tax regime and its slab rates", g: "tax", k: "115bac new regime default slabs", d: "The default regime. You opt out under section 202(4)." },
    { o: "Previous year / assessment year", r: "both", n: "Tax year (section 3)", t: "The year your income is earned and taxed", g: "tax", k: "assessment year previous year fy ay tax year", d: "Income earned from 1 April 2026 is \"tax year 2026-27\"." },
    /* House property */
    { o: "22", r: "both", n: "20", t: "Income from house property", g: "home", k: "house property rental income", d: "", u: ["/rent-vs-buy/", "Rent or Buy"] },
    { o: "23", r: "both", n: "21", t: "Annual value of a house", g: "home", k: "annual value let out self occupied", d: "" },
    { o: "24(a)", r: "both", n: "22(1)(a)", t: "30% standard deduction on rent received", g: "home", k: "30% standard deduction rental", d: "" },
    { p: 4, o: "24(b)", r: "home", n: "22(1)(b), (c) and 22(2)", t: "Home loan interest", g: "home", k: "24b home loan interest 200000 pre construction", d: "Up to ₹2 lakh a year for a home you live in. A let-out home's interest is allowed in both, but a loss can't reduce other income under the new regime.", u: ["/prepay-vs-invest/", "Prepay or Invest"] },
    /* Capital gains */
    { o: "111A", r: "both", n: "196", t: "Short-term gains on shares and equity funds", g: "gains", k: "111a stcg short term equity 20%", d: "20% on gains from units held 12 months or less.", u: ["/sip-calculator/", "SIP Calculator"] },
    { o: "112", r: "both", n: "197", t: "Other long-term capital gains", g: "gains", k: "112 ltcg property gold debt", d: "Generally 12.5%, without indexation." },
    { p: 4, o: "112A", r: "both", n: "198", t: "Long-term gains on shares and equity funds", g: "gains", k: "112a ltcg long term equity 125000 12.5%", d: "12.5% on gains above ₹1.25 lakh a year.", u: ["/sip-calculator/", "SIP Calculator"] },
    { o: "54", r: "both", n: "82", t: "Gains from selling a house, reinvested in a new house", g: "gains", k: "54 house sale reinvest new house", d: "Gains above ₹10 crore don't count.", u: ["/rent-vs-buy/", "Rent or Buy"] },
    { o: "54EC", r: "both", n: "85", t: "Gains on land or building invested in specified bonds", g: "gains", k: "54ec bonds nhai rec 50 lakh", d: "Up to ₹50 lakh, within six months." },
    { o: "54F", r: "both", n: "86", t: "Gains on any other long-term asset, invested in a house", g: "gains", k: "54f shares gold invest house", d: "" },
    { o: "10(10D)", r: "both", n: "Schedule II, Table S. No. 2", t: "Life insurance maturity amount", g: "gains", k: "10(10d) lic maturity ulip insurance", d: "" },
    /* Returns, interest and notices */
    { p: 4, o: "139(1)", n: "263(1)", t: "Filing your income tax return (ITR)", g: "returns", k: "139 itr return filing due date", d: "Due dates are unchanged." },
    { o: "139(4)", n: "263(4)", t: "Belated (late) return", g: "returns", k: "belated late return", d: "" },
    { o: "139(5)", n: "263(5)", t: "Revised return", g: "returns", k: "revised return correction", d: "" },
    { o: "139(8A)", n: "263(6)", t: "Updated return (ITR-U)", g: "returns", k: "itr-u updated return 48 months", d: "Within 48 months from the end of the year after the tax year." },
    { o: "143(1)", n: "270(1)", t: "Processing of your return (intimation)", g: "returns", k: "143(1) intimation processing", d: "" },
    { o: "147 / 148", n: "279 / 280", t: "Income escaping assessment, and the reassessment notice", g: "returns", k: "147 148 reassessment notice escaped", d: "" },
    { o: "208", n: "404", t: "Who must pay advance tax", g: "returns", k: "advance tax 208", d: "" },
    { o: "234A", n: "423", t: "Interest for filing your return late", g: "returns", k: "234a interest late return", d: "1% a month on the tax due." },
    { o: "234B", n: "424", t: "Interest for not paying enough advance tax", g: "returns", k: "234b interest advance tax shortfall", d: "1% a month." },
    { o: "234C", n: "425", t: "Interest for paying advance tax late", g: "returns", k: "234c interest deferment instalment", d: "" },
    { o: "194A, 194I and other TDS", n: "393", t: "TDS on interest, rent and other payments", g: "returns", k: "194a 194i 194ia tds interest rent property", d: "All non-salary TDS is now in one section, with a table." },
    /* Forms */
    { p: 4, o: "Form 16", n: "Form 130", t: "Salary TDS certificate from your employer", g: "forms", k: "form 16 tds certificate", d: "" },
    { o: "Form 12BB", n: "Form 124", t: "Investment declaration to your employer", g: "forms", k: "12bb declaration hra lta proof", d: "Filed under section 392(5)(b)." },
    { o: "Form 15G / 15H", n: "Form 121", t: "Declaration for no TDS on interest", g: "forms", k: "15g 15h no tds", d: "One form now, under section 393(6)." },
  ];
  var REG = {
    both: ["both", "Both regimes", "You can use this whether you pay tax under the new regime (the default) or the old one."],
    diff: ["both", "Both regimes, different limits", "Available under both regimes, but the amount or limit isn't the same. The note below gives both."],
    old: ["old", "Old regime only", "Only if you choose the old regime. Under the new regime (the default, section 202), you can't claim this."],
    part: ["part", "Only some in the new regime", "Most of these need the old regime. Under the new regime, only the allowances the Income-tax Rules list for it are tax-free (rule 280), such as travel on official tour or transfer and conveyance for official duty."],
    home: ["part", "Old regime for a home you live in", "For a home you live in, the interest deduction is old regime only. For a home you rent out, interest is allowed in both regimes, but under the new regime a loss from it can't reduce your other income."],
    new: ["new", "New regime (the default)", "This is the new regime itself. It applies unless you choose the old regime under section 202(4)."] };
  function reg(r) { return REG[r.r || "both"]; }
  /* "new" filter: anything you can still use under the new regime; "old": things only the old regime gives you */
  function regOk(r, f) { var k = r.r || "both"; return !f || f === "any" || (f === "new" ? k !== "old" : k === "old" || k === "part" || k === "home"); }
  var GROUPS = [["all", "All"], ["salary", "Salary"], ["deductions", "Deductions"], ["tax", "Rebate and regime"], ["home", "House property"], ["gains", "Capital gains"], ["returns", "Returns and interest"], ["forms", "Forms"]];
  function norm(s) { return String(s).toLowerCase().replace(/section|sec\.?|u\/s/g, " ").replace(/[\s()\-\/,.]+/g, ""); }
  function words(s) { return String(s).toLowerCase().split(/[^a-z0-9%]+/).filter(Boolean); }
  /* Score a row against the query: exact old or new section first, then prefix, then words. */
  function score(r, q) {
    var nq = norm(q); if (!nq) return 1;
    var no = norm(r.o), nn = norm(r.n.replace(/\(with.*\)|schedule.*$/i, "")), s = 0;
    if (no === nq) s = 100; else if (nn === nq) s = 90; else if (no.indexOf(nq) === 0) s = 70; else if (nn.indexOf(nq) === 0) s = 60;
    var hay = (r.o + " " + r.n + " " + r.t + " " + r.k + " " + r.d).toLowerCase(), ws = words(q), hit = 0;
    ws.forEach(function (w) { if (hay.indexOf(w) > -1) hit++; });
    if (ws.length && hit === ws.length) s = Math.max(s, 40 + hit);
    if (s && s < 60) s += r.p || 0;   /* the sections people look up most */
    var tq = String(q).trim().toLowerCase(), tl = r.t.toLowerCase();
    if (s && s < 60 && tl.indexOf(tq) > -1) s += tl.indexOf(tq) === 0 ? 8 : 3;   /* the name itself matches, best at the start */
    return s;
  }
  function search(q, g, f) { return DATA.map(function (r, i) { return { r: r, s: score(r, q), i: i }; }).filter(function (x) { return x.s > 0 && (!g || g === "all" || x.r.g === g) && regOk(x.r, f); }).sort(function (a, b) { return b.s - a.s || a.i - b.i; }).map(function (x) { return x.r; }); }
  if (typeof module !== "undefined" && module.exports) { module.exports = { DATA: DATA, search: search, GROUPS: GROUPS, reg: reg }; return; }

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var S = { q: "", g: "all", f: "any" };
  (function fromUrl() { var p = new URLSearchParams(location.search); S.q = (p.get("q") || "").slice(0, 60); var g = p.get("g"); if (GROUPS.some(function (x) { return x[0] === g; })) S.g = g; var f = p.get("regime"); if (f === "new" || f === "old") S.f = f; })();
  var inp = $("sfQ"); inp.value = S.q;
  $("sfChips").innerHTML = GROUPS.map(function (x) { return '<button type="button" class="sf-chip" data-g="' + x[0] + '">' + x[1] + "</button>"; }).join("");
  document.querySelectorAll(".sf-chip").forEach(function (b) { b.addEventListener("click", function () { S.g = b.getAttribute("data-g"); render(); }); });
  document.querySelectorAll("[data-f]").forEach(function (b) { b.addEventListener("click", function () { S.f = b.getAttribute("data-f"); render(); }); });
  inp.addEventListener("input", function () { S.q = this.value; render(); });
  $("sfClear").addEventListener("click", function () { S.q = ""; inp.value = ""; S.g = "all"; S.f = "any"; render(); inp.focus(); });
  document.querySelectorAll("[data-try]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); S.q = a.getAttribute("data-try"); inp.value = S.q; S.g = "all"; render(); }); });
  function card(r) {
    return '<article class="sf-row"><div class="sf-map"><span class="sf-old"><small>1961 Act</small>' + esc(r.o) + '</span><span class="sf-arr" aria-hidden="true">→</span><span class="sf-new"><small>2025 Act</small>' + esc(r.n) + "</span></div>" +
      '<div class="sf-body"><b>' + esc(r.t) + '</b><button type="button" class="sf-reg sf-reg-' + reg(r)[0] + '" aria-expanded="false" aria-label="' + esc(reg(r)[1]) + ': what this means">' + reg(r)[1] + ' <span class="sf-i" aria-hidden="true">i</span></button><span class="sf-why" role="note" hidden>' + esc(reg(r)[2]) + "</span>" + (r.d ? "<p>" + esc(r.d) + "</p>" : "") + (r.u ? '<a class="sf-tool" href="' + r.u[0] + '">Use it in the ' + esc(r.u[1]) + " →</a>" : "") + "</div></article>";
  }
  $("sfList").addEventListener("click", function (e) {
    var bt = e.target.closest(".sf-reg"); if (!bt) return;
    var w = bt.nextElementSibling, open = bt.getAttribute("aria-expanded") === "true";
    bt.setAttribute("aria-expanded", open ? "false" : "true"); w.hidden = open;
  });
  function render() {
    document.querySelectorAll(".sf-chip").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-g") === S.g ? "true" : "false"); });
    document.querySelectorAll("[data-f]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-f") === S.f ? "true" : "false"); });
    var res = search(S.q, S.g, S.f);
    $("sfCount").textContent = res.length ? res.length + (res.length === 1 ? " section" : " sections") + (S.q ? " match “" + S.q.trim() + "”" : "") : "";
    $("sfList").innerHTML = res.length ? res.map(card).join("") : '<p class="sf-none">No match in our list of sections for salaried people. Try the name (like "HRA" or "home loan"), or check the Income Tax Department\'s <a href="https://www.incometaxindia.gov.in/" rel="noopener">full mapping utility</a>.</p>';
    $("sfClear").hidden = !S.q && S.g === "all" && S.f === "any";
    var u = new URL(location.href); if (S.q) u.searchParams.set("q", S.q.trim()); else u.searchParams.delete("q"); if (S.g !== "all") u.searchParams.set("g", S.g); else u.searchParams.delete("g"); if (S.f !== "any") u.searchParams.set("regime", S.f); else u.searchParams.delete("regime");
    try { history.replaceState(null, "", u.pathname + u.search); } catch (e) {}
  }
  function say(m) { var s = $("sfStatus"); s.textContent = m; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  $("sfShare").addEventListener("click", function () {
    var t = location.href;
    function ok() { say("Link copied. It opens this search."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { say("Couldn't copy. Copy the address bar instead."); }); else say("Copy the address bar to share this search.");
  });
  render();
})();
