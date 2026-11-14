/* Salarist FD, RD and PPF calculator. Runs entirely in the browser; nothing is stored or sent. */
(function () {
  "use strict";
  var CESS = 1.04, TDS_RATE = 0.10, PPF_MAX = 150000, PPF_MIN = 500;

  /* ---------- Core ---------- */
  /* FD. o: {amt, rate, months, payout: "reinvest"|"quarterly"|"monthly"}. Banks compound quarterly; a part-quarter at the end earns simple interest.
     Returns yearly interest (by year of the deposit) so tax and TDS can be worked out year by year. */
  function fd(o) {
    var q = o.rate / 400, years = [], bal = o.amt, paid = 0, m;
    if (o.payout === "reinvest") {
      for (m = 1; m <= o.months; m++) {
        var before = bal;
        if (m % 3 === 0) bal = bal * (1 + q);                       /* quarter ends: compound */
        var y = Math.ceil(m / 12) - 1; years[y] = (years[y] || 0);
        if (m % 3 === 0) years[y] += bal - before;
      }
      var left = o.months % 3;
      if (left) { var simple = bal * o.rate / 100 * left / 12, yl = Math.ceil(o.months / 12) - 1; years[yl] = (years[yl] || 0) + simple; bal += simple; }
      return { maturity: bal, interest: bal - o.amt, years: fill(years, o.months), payout: 0 };
    }
    var per = o.payout === "quarterly" ? o.amt * q : o.amt * q / (3 + 3 * (o.rate / 1200) + Math.pow(o.rate / 1200, 2));   /* monthly payout is the quarterly interest, discounted */
    var step = o.payout === "quarterly" ? 3 : 1;
    for (m = step; m <= o.months; m += step) { var yy = Math.ceil(m / 12) - 1; years[yy] = (years[yy] || 0) + per; paid += per; }
    var rem = o.months % step; if (rem) { var s2 = o.amt * o.rate / 100 * rem / 12, y2 = Math.ceil(o.months / 12) - 1; years[y2] = (years[y2] || 0) + s2; paid += s2; }
    return { maturity: o.amt, interest: paid, years: fill(years, o.months), payout: per };
  }
  /* RD. o: {inst, rate, months}. Each instalment compounds quarterly for the months it stays in (the formula banks use). */
  function rd(o) {
    var q = o.rate / 400, mat = 0, years = [], prev = 0;
    for (var m = 1; m <= o.months; m++) {
      /* value at the end of month m of everything paid so far, compounding quarterly (fractional quarters for the months in between) */
      var v = 0; for (var k = 1; k <= m; k++) v += o.inst * Math.pow(1 + q, (m - k + 1) / 3);
      var deposits = o.inst * m, intSoFar = v - deposits, y = Math.ceil(m / 12) - 1;
      years[y] = (years[y] || 0) + (intSoFar - prev); prev = intSoFar; mat = v;
    }
    return { maturity: mat, deposits: o.inst * o.months, interest: mat - o.inst * o.months, years: fill(years, o.months) };
  }
  /* PPF. o: {yearly, rate, years: 15|20|25, when: "april"|"monthly", stopAfter15: bool}. Interest on the lowest balance between the 5th and the month end, credited each March. */
  function ppf(o) {
    var bal = 0, rows = [], dep = 0, r = o.rate / 100;
    for (var y = 1; y <= o.years; y++) {
      var put = (o.stopAfter15 && y > 15) ? 0 : Math.min(PPF_MAX, o.yearly), intY = 0;
      if (o.when === "april") { bal += put; intY = bal * r; }
      else { var mth = put / 12; for (var m = 0; m < 12; m++) { bal += mth; intY += bal * r / 12; } }
      dep += put; bal += intY; rows.push({ y: y, put: put, interest: intY, bal: bal });
    }
    return { maturity: bal, deposits: dep, interest: bal - dep, rows: rows };
  }
  function fill(a, months) { var n = Math.ceil(months / 12), out = []; for (var i = 0; i < n; i++) out.push(a[i] || 0); return out; }
  /* Tax on interest, year by year. t: {slab, regime, senior, otherSameBank}. Old-regime senior citizens can deduct up to ₹50,000 of interest a year (section 153(2)(b)). */
  function tax(yearly, t) {
    var total = 0, ded = 0, tdsYears = 0, tdsAmt = 0, lim = t.senior ? 100000 : 50000;
    yearly.forEach(function (i) {
      var d = (t.regime === "old" && t.senior) ? Math.min(50000, i) : 0;
      ded += d; total += Math.max(0, i - d) * t.slab / 100 * CESS;
      if (i + (t.otherSameBank || 0) > lim) { tdsYears++; tdsAmt += i * TDS_RATE; }
    });
    return { tax: total, deducted: ded, tdsYears: tdsYears, tds: tdsAmt, limit: lim, maxYear: Math.max.apply(null, yearly.concat([0])) };
  }
  /* The same yearly saving for N years in each: a new FD every year, an RD of a twelfth each month, or PPF. FD and RD interest is taxed each year at your slab. */
  function compare(o) {
    var t = o.slab / 100 * CESS, fdR = Math.pow(1 + o.fdRate / 400, 4) - 1, out = { fd: 0, rd: 0, ppf: 0, put: o.yearly * o.years };
    var fv = 0; for (var y = 0; y < o.years; y++) { fv += o.yearly; fv *= 1 + fdR * (1 - t); } out.fd = fv;
    var mr = Math.pow(1 + o.rdRate / 400, 1 / 3) - 1, rv = 0; for (var m = 0; m < o.years * 12; m++) { rv += o.yearly / 12; rv *= 1 + mr * (1 - t); } out.rd = rv;
    out.ppf = ppf({ yearly: Math.min(PPF_MAX, o.yearly), rate: o.ppfRate, years: o.years, when: "april" }).maturity + Math.max(0, o.yearly - PPF_MAX) * 0;   /* PPF takes at most ₹1.5 lakh a year */
    out.ppfCapped = o.yearly > PPF_MAX;
    var d = Math.pow(1 + o.infl / 100, o.years); out.real = { fd: out.fd / d, rd: out.rd / d, ppf: out.ppf / d };
    return out;
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { fd: fd, rd: rd, ppf: ppf, tax: tax, compare: compare, PPF_MAX: PPF_MAX }; return; }

  /* ---------- UI ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var fmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  function inr(v) { var r = Math.round(v); return (r < 0 ? "−" : "") + "₹" + fmt.format(Math.abs(r)); }
  function short(v) {
    var a = Math.abs(v), s = v < 0 ? "−" : "";
    if (a >= 1e7) return s + "₹" + (a / 1e7).toFixed(2).replace(/\.?0+$/, "") + " Cr";
    if (a >= 1e5) return s + "₹" + (a / 1e5).toFixed(2).replace(/\.?0+$/, "") + " L";
    return s + "₹" + fmt.format(Math.round(a));
  }
  function words(v) { return v >= 1e5 ? short(v) : ""; }
  var S = { mode: "fd", amt: 500000, fdRate: 7, fdY: 3, fdM: 0, payout: "reinvest", taxSaver: false,
            inst: 10000, rdRate: 6.8, rdY: 5, rdM: 0,
            yearly: 150000, ppfRate: 7.1, ext: 0, when: "april", stopAfter15: false,
            slab: 30, regime: "new", senior: false, other: 0, infl: 6, cYearly: 150000, cYears: 15 };
  var NUM = { amt: [1000, 1e9], fdRate: [1, 15], fdY: [0, 10], fdM: [0, 11], inst: [100, 1e7], rdRate: [1, 15], rdY: [0, 10], rdM: [0, 11],
              yearly: [500, 150000], ppfRate: [1, 15], slab: [0, 30], other: [0, 1e8], infl: [0, 15], cYearly: [1000, 1e8], cYears: [1, 30] };
  var MONEY = { amt: 1, inst: 1, yearly: 1, other: 1, cYearly: 1 };
  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    Object.keys(NUM).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= NUM[k][0] && v <= NUM[k][1]) S[k] = v; });
    if (["fd", "rd", "ppf"].indexOf(q.get("mode")) > -1) S.mode = q.get("mode");
    if (["reinvest", "quarterly", "monthly"].indexOf(q.get("payout")) > -1) S.payout = q.get("payout");
    if (["april", "monthly"].indexOf(q.get("when")) > -1) S.when = q.get("when");
    if (["new", "old"].indexOf(q.get("regime")) > -1) S.regime = q.get("regime");
    var e = parseInt(q.get("ext"), 10); if (e === 5 || e === 10) S.ext = e;
    ["taxSaver", "senior", "stopAfter15"].forEach(function (k) { if (q.get(k) === "1") S[k] = true; });
  })();
  function bindNum(k) {
    var el = $("dp-" + k), note = $("dp-" + k + "-w"); if (!el) return;
    function show() { el.value = MONEY[k] ? fmt.format(S[k]) : String(S[k]); if (note) note.textContent = MONEY[k] ? words(S[k]) : ""; }
    el.addEventListener("input", function () {
      var raw = MONEY[k] ? this.value.replace(/[^0-9]/g, "") : this.value.replace(/[^0-9.]/g, "");
      if (MONEY[k]) this.value = raw ? fmt.format(+raw) : "";
      var v = parseFloat(raw); if (!isFinite(v)) return;
      S[k] = Math.max(NUM[k][0], Math.min(NUM[k][1], v)); if (note) note.textContent = MONEY[k] ? words(S[k]) : ""; render();
    });
    el.addEventListener("blur", show); show();
  }
  Object.keys(NUM).forEach(bindNum);
  function seg(attr, key, conv) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.addEventListener("click", function () { var v = b.getAttribute("data-" + attr); S[key] = conv ? conv(v) : v; render(); }); }); }
  seg("mode", "mode"); seg("payout", "payout"); seg("when", "when"); seg("regime", "regime"); seg("ext", "ext", Number);
  ["taxSaver", "senior", "stopAfter15"].forEach(function (k) { var c = $("dp-" + k); c.checked = S[k]; c.addEventListener("change", function () { S[k] = this.checked; render(); }); });
  function pressed(attr, val) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-" + attr)) === String(val) ? "true" : "false"); }); }
  function tenure(y, m) { return (y ? y + (y === 1 ? " year" : " years") : "") + (y && m ? ", " : "") + (m ? m + (m === 1 ? " month" : " months") : ""); }

  var last = null;
  function result() {
    var t = { slab: S.slab, regime: S.regime, senior: S.senior, otherSameBank: S.other }, r;
    if (S.mode === "fd") {
      var months = Math.max(1, S.fdY * 12 + S.fdM); if (S.taxSaver && months < 60) months = 60;
      var f = fd({ amt: S.amt, rate: S.fdRate, months: months, payout: S.payout }), tx = tax(f.years, t);
      r = { kind: "fd", months: months, put: S.amt, interest: f.interest, maturity: f.maturity, years: f.years, tax: tx, payout: f.payout,
            after: f.maturity + (S.payout === "reinvest" ? 0 : f.interest) - tx.tax, ded123: S.taxSaver && S.regime === "old" ? Math.min(S.amt, 150000) : 0 };
    } else if (S.mode === "rd") {
      var mo = Math.max(6, S.rdY * 12 + S.rdM), d = rd({ inst: S.inst, rate: S.rdRate, months: mo }), tx2 = tax(d.years, t);
      r = { kind: "rd", months: mo, put: d.deposits, interest: d.interest, maturity: d.maturity, years: d.years, tax: tx2, after: d.maturity - tx2.tax };
    } else {
      var p = ppf({ yearly: S.yearly, rate: S.ppfRate, years: 15 + S.ext, when: S.when, stopAfter15: S.stopAfter15 });
      r = { kind: "ppf", months: (15 + S.ext) * 12, put: p.deposits, interest: p.interest, maturity: p.maturity, rows: p.rows, years: p.rows.map(function (x) { return x.interest; }),
            tax: { tax: 0, deducted: 0, tdsYears: 0, tds: 0, maxYear: 0 }, after: p.maturity, ded123: S.regime === "old" ? Math.min(S.yearly, 150000) : 0 };
    }
    r.real = r.after / Math.pow(1 + S.infl / 100, r.months / 12);
    return r;
  }
  function verdict(r) {
    var head, sub = [];
    if (r.kind === "fd" && S.payout !== "reinvest") {
      head = "You get about <b>" + inr(r.payout) + "</b> " + (S.payout === "monthly" ? "a month" : "a quarter") + " in interest";
      sub.push("Your " + short(S.amt) + " comes back at the end of " + tenure(Math.floor(r.months / 12), r.months % 12) + ". Total interest: " + short(r.interest) + ".");
    } else {
      head = (r.kind === "ppf" ? "Your PPF grows to about <b>" : "You get about <b>") + short(r.maturity) + "</b>";
      sub.push("You put in " + short(r.put) + " and earn " + short(r.interest) + " in interest" + (r.kind === "ppf" ? ", all of it tax-free." : "."));
    }
    if (r.kind !== "ppf") {
      sub.push(r.tax.tax > 0 ? "Tax on the interest at your " + S.slab + "% slab: about " + short(r.tax.tax) + (r.tax.deducted ? ", after the senior citizen deduction" : "") + ". You keep " + short(r.after) + "." : "No tax on this interest at your slab" + (r.tax.deducted ? ", after the senior citizen deduction" : "") + ".");
    }
    return '<p class="k">' + ({ fd: "Fixed deposit", rd: "Recurring deposit", ppf: "Public Provident Fund" })[r.kind] + ", " + tenure(Math.floor(r.months / 12), r.months % 12) + '</p><p class="v">' + head + '</p><p class="k">' + sub.join(" ") + "</p>";
  }
  function tdsText(r) {
    if (r.kind === "ppf") return "PPF interest is tax-free and no TDS is deducted.";
    var lim = r.tax.limit;
    if (r.tax.tdsYears) return "<b>Your bank will deduct TDS.</b> Interest from this deposit" + (S.other ? " plus your other deposits there" : "") + " crosses " + inr(lim) + " in " + r.tax.tdsYears + (r.tax.tdsYears === 1 ? " year" : " years") + ", so the bank keeps 10%: about " + short(r.tax.tds) + " in all. That's not extra tax: it's credited against the tax you owe when you file your return.";
    return "<b>No TDS expected.</b> Interest from this deposit" + (S.other ? " plus your other deposits there" : "") + " stays under " + inr(lim) + " a year at this bank (the highest year is about " + short(r.tax.maxYear + S.other) + "). You still pay tax on it: add it to your income when you file your return.";
  }
  function chart(r) {
    var W = 420, Hh = 240, pl = 54, pr = 14, pt = 20, pb = 26, n = Math.ceil(r.months / 12), put = [], val = [];
    if (r.kind === "ppf") { var c = 0; r.rows.forEach(function (x) { c += x.put; put.push(c); val.push(x.bal); }); }
    else if (r.kind === "rd") { var dv = 0, cum = 0; for (var y = 0; y < n; y++) { cum = S.inst * Math.min(r.months, (y + 1) * 12); dv += r.years[y]; put.push(cum); val.push(cum + dv); } }
    else { var acc = S.amt; for (var y2 = 0; y2 < n; y2++) { acc += S.payout === "reinvest" ? r.years[y2] : 0; put.push(S.amt); val.push(S.payout === "reinvest" ? acc : S.amt + r.years.slice(0, y2 + 1).reduce(function (a, b) { return a + b; }, 0)); } }
    put.unshift(r.kind === "fd" ? S.amt : 0); val.unshift(r.kind === "fd" ? S.amt : 0);
    var max = Math.max.apply(null, val) || 1, st = Math.pow(10, Math.floor(Math.log10(max / 4))), qq = max / 4 / st; st *= qq <= 1 ? 1 : qq <= 2 ? 2 : qq <= 2.5 ? 2.5 : qq <= 5 ? 5 : 10; max = st * 4;
    function x(i) { return pl + i / n * (W - pl - pr); } function yy(v) { return pt + (max - v) / max * (Hh - pt - pb); }
    function path(a) { return a.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(v).toFixed(1); }).join(""); }
    var g = ""; for (var k = 0; k <= 4; k++) { var gy = yy(max * k / 4).toFixed(1); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+gy + 3) + '" class="al" text-anchor="end">' + short(max * k / 4) + "</text>"; }
    var stp = n > 12 ? 5 : n > 5 ? 2 : 1, xl = ""; for (var t = 0; t <= n; t += stp) xl += '<text x="' + x(t).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">' + t + " yr</text>";
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Value by year">' + g + xl + '<path d="' + path(put) + '" class="ln buy"/><path d="' + path(val) + '" class="ln rent"/></svg>';
  }
  function table(r) {
    var head, rows = "";
    if (r.kind === "ppf") {
      head = "<tr><th>Year</th><th>Deposit</th><th>Interest</th><th>Balance</th></tr>";
      r.rows.forEach(function (x) { rows += '<tr><td data-l="Year">' + x.y + '</td><td data-l="Deposit">' + inr(x.put) + '</td><td data-l="Interest">' + inr(x.interest) + '</td><td data-l="Balance">' + inr(x.bal) + "</td></tr>"; });
    } else {
      head = "<tr><th>Year</th><th>Interest</th><th>Tax on it</th><th>TDS by bank</th></tr>";
      var lim = r.tax.limit;
      r.years.forEach(function (i, y) {
        var d = (S.regime === "old" && S.senior) ? Math.min(50000, i) : 0, tx = Math.max(0, i - d) * S.slab / 100 * CESS, tds = i + S.other > lim ? i * TDS_RATE : 0;
        rows += '<tr><td data-l="Year">' + (y + 1) + '</td><td data-l="Interest">' + inr(i) + '</td><td data-l="Tax on it">' + inr(tx) + '</td><td data-l="TDS by bank">' + (tds ? inr(tds) : "None") + "</td></tr>";
      });
    }
    return '<table class="calc"><thead>' + head + "</thead><tbody>" + rows + "</tbody></table>";
  }
  function compareBox() {
    var c = compare({ yearly: S.cYearly, years: S.cYears, fdRate: S.fdRate, rdRate: S.rdRate, ppfRate: S.ppfRate, slab: S.slab, infl: S.infl });
    var best = Math.max(c.fd, c.rd, c.ppf);
    function cell(name, v, real, note) { return '<div class="sv' + (v === best ? " cur" : "") + '"><span class="l">' + name + '</span><span class="n">' + short(v) + '</span><span class="h">' + short(real) + " in today's money" + (note ? ". " + note : "") + "</span></div>"; }
    $("dpCmp").innerHTML = cell("FD at " + S.fdRate + "%", c.fd, c.real.fd) + cell("RD at " + S.rdRate + "%", c.rd, c.real.rd) + cell("PPF at " + S.ppfRate + "%", c.ppf, c.real.ppf, c.ppfCapped ? "PPF takes at most ₹1.5 lakh a year" : "Tax-free");
    $("dpCmpNote").textContent = "Putting " + short(S.cYearly) + " a year for " + S.cYears + " years into each (" + short(c.put) + " in all), after tax at your " + S.slab + "% slab. FD: a new deposit each year. RD: a twelfth each month.";
    return c;
  }
  function render() {
    pressed("mode", S.mode); pressed("payout", S.payout); pressed("when", S.when); pressed("regime", S.regime); pressed("ext", S.ext);
    ["fd", "rd", "ppf"].forEach(function (m) { $("dp-" + m).hidden = S.mode !== m; });
    $("dp-seniorBox").hidden = S.mode === "ppf"; $("dp-otherBox").hidden = S.mode === "ppf";
    $("dp-stopBox").hidden = S.ext === 0;
    var r = result(); last = r;
    $("dpVerdict").innerHTML = verdict(r);
    $("dpTds").innerHTML = tdsText(r);
    $("dpPut").textContent = short(r.put); $("dpInt").textContent = short(r.interest);
    $("dpTax").textContent = r.kind === "ppf" ? "₹0" : short(r.tax.tax); $("dpReal").textContent = short(r.real);
    $("dpTaxH").textContent = r.kind === "ppf" ? "PPF interest is tax-free" : "At your " + S.slab + "% slab, with cess";
    var n = []; if (r.ded123) n.push("Old regime: your " + (r.kind === "ppf" ? "PPF deposits count" : "tax-saver FD counts") + " under section 123 (old 80C), cutting your taxable income by up to " + short(r.ded123) + (r.kind === "ppf" ? " a year" : " in the year you invest") + ". The ₹1.5 lakh limit is shared with EPF, ELSS, life insurance and the rest.");
    if (r.kind === "fd" && S.taxSaver && S.fdY * 12 + S.fdM < 60) n.push("A tax-saver FD is locked for 5 years, so we've used 5 years.");
    if (r.tax.deducted) n.push("Old regime, senior citizen: up to ₹50,000 of interest a year is deducted under section 153(2)(b) (old 80TTB). It's shared with your other bank and post office interest, so the real saving may be less.");
    $("dpExtra").innerHTML = n.map(function (t) { return "<p>" + t + "</p>"; }).join(""); $("dpExtra").hidden = !n.length;
    $("dpChart").innerHTML = chart(r);
    $("dpTable").innerHTML = table(r);
    last.cmp = compareBox();
    $("dpBarT").textContent = r.kind === "fd" && S.payout !== "reinvest" ? inr(r.payout) + (S.payout === "monthly" ? " a month" : " a quarter") : short(r.maturity) + " at maturity";
  }

  /* ---------- Reports ---------- */
  function say(m) { var s = $("dpStatus"); s.textContent = m; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function notes() {
    return ["FD and RD interest is taxed at your slab rate from the first rupee, whether or not the bank deducts TDS. We add 4% cess and leave out surcharge.",
      "Banks deduct 10% TDS only if your interest from all FDs and RDs at that bank is more than ₹50,000 in a year (₹1 lakh for senior citizens), under section 393(1) of the Income-tax Act, 2025 (old 194A). TDS is credited against the tax you owe.",
      "Savings account interest is taxable too, but banks don't deduct TDS on it and it doesn't count towards the ₹50,000 limit.",
      "Banks compound FD and RD interest every quarter. Your bank's maturity amount may differ by a few rupees because of rounding and day counts.",
      "PPF interest is " + S.ppfRate + "% (Oct–Dec 2026, set every quarter by the Ministry of Finance), on the lowest balance between the 5th and the end of each month, credited every March. We assume the rate stays the same.",
      "Today's money uses " + S.infl + "% inflation a year."];
  }
  function spec() {
    var r = last, n = Math.ceil(r.months / 12), cats = [], A = [], B = [], tr = [];
    var svg = document.querySelector("#dpChart svg");
    var put = 0, val = r.kind === "fd" ? S.amt : 0;
    for (var y = 0; y <= n; y++) {
      cats.push(y);
      if (y === 0) { A.push(r.kind === "fd" ? S.amt : 0); B.push(r.kind === "fd" ? S.amt : 0); continue; }
      if (r.kind === "ppf") { put += r.rows[y - 1].put; val = r.rows[y - 1].bal; }
      else if (r.kind === "rd") { put = S.inst * Math.min(r.months, y * 12); val = (B[y - 1] - A[y - 1]) + put + r.years[y - 1]; }
      else { put = S.amt; val += r.years[y - 1]; }
      A.push(put); B.push(val);
    }
    function monthly(arr) { var o = []; arr.forEach(function (v, i) { if (i === 0) { o.push(v); return; } var p = arr[i - 1]; for (var m = 1; m <= 12; m++) o.push(p + (v - p) * m / 12); }); return o; }
    if (r.kind === "ppf") r.rows.forEach(function (x) { tr.push([String(x.y), x.put, x.interest, x.bal]); });
    else r.years.forEach(function (i, y) { var d = (S.regime === "old" && S.senior) ? Math.min(50000, i) : 0; tr.push([String(y + 1), i, Math.max(0, i - d) * S.slab / 100 * CESS, i + S.other > r.tax.limit ? i * TDS_RATE : 0]); });
    var KIND = { fd: "Fixed deposit", rd: "Recurring deposit", ppf: "PPF" }[r.kind];
    var inputs = [["Deposit", KIND]];
    if (r.kind === "fd") inputs.push(["Amount", inr(S.amt), S.amt], ["Rate", S.fdRate + "% a year"], ["Tenure", tenure(Math.floor(r.months / 12), r.months % 12)], ["Interest", ({ reinvest: "Reinvested (cumulative)", quarterly: "Paid every quarter", monthly: "Paid every month" })[S.payout]], ["Tax-saver FD", S.taxSaver ? "Yes" : "No"]);
    if (r.kind === "rd") inputs.push(["Monthly instalment", inr(S.inst), S.inst], ["Rate", S.rdRate + "% a year"], ["Tenure", tenure(Math.floor(r.months / 12), r.months % 12)]);
    if (r.kind === "ppf") inputs.push(["Yearly deposit", inr(S.yearly), S.yearly], ["Rate", S.ppfRate + "% a year"], ["Years", String(15 + S.ext)], ["Deposit timing", S.when === "april" ? "By 5 April each year" : "Monthly, by the 5th"]);
    inputs.push(["Tax regime", S.regime === "old" ? "Old" : "New"], ["Tax slab", S.slab + "%"]);
    if (r.kind !== "ppf") inputs.push(["Senior citizen", S.senior ? "Yes" : "No"], ["Other FD/RD interest at this bank, a year", inr(S.other), S.other]);
    var c = r.cmp;
    return {
      title: "FD, PPF and RD Calculator Report", path: "salarist.in/fd-ppf-rd-calculator", url: location.origin + location.pathname, file: "salarist-fd-ppf-rd-calculator",
      question: "What will my " + (r.kind === "ppf" ? "PPF" : KIND.toLowerCase()) + " grow to, after tax?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#dpVerdict p"), function (p) { return p.textContent; }), verdictColor: "blue",
      inputs: inputs,
      keyNums: [["You put in", short(r.put), r.put], ["Interest", short(r.interest), r.interest], ["Tax on interest", r.kind === "ppf" ? "₹0" : short(r.tax.tax), r.kind === "ppf" ? 0 : r.tax.tax], ["In today's money", short(r.real), r.real]],
      sensTitle: "Same saving in each: " + short(S.cYearly) + " a year for " + S.cYears + " years, after tax",
      sens: [["FD at " + S.fdRate + "%", short(c.fd)], ["RD at " + S.rdRate + "%", short(c.rd)], ["PPF at " + S.ppfRate + "%", short(c.ppf)]], sensCurrent: [c.fd, c.rd, c.ppf].indexOf(Math.max(c.fd, c.rd, c.ppf)),
      chartTitle: "Value by year", chartNote: "Money you put in, and its value with interest, before tax.", xlsxChartTitle: "Value (₹ lakh)",
      chart: { series: [{ name: "With interest", color: "blue", data: monthly(B) }, { name: "Put in", color: "amber", data: monthly(A) }], cross: null }, chartYears: cats,
      money: (function () { var dfl = Math.pow(1 + S.infl / 100, r.months / 12), tx = r.kind === "ppf" ? 0 : r.tax.tax;
        return { title: "Where your money ends up", cols: ["Amount", "In today's money"], rows: [["You put in", r.put, r.put / dfl], ["Interest earned", r.interest, r.interest / dfl], ["Tax on interest", -tx, -tx / dfl], ["You keep", r.after, r.after / dfl, "total"]], note: $("dpTds").textContent }; })(),
      tables: [{ title: "Year by year", sheet: "By year", cols: r.kind === "ppf" ? ["Year", "Deposit", "Interest", "Balance"] : ["Year", "Interest", "Tax on it", "TDS by bank"], yearly: tr, monthly: null }],
      notes: notes(), taxRules: ["FD and RD interest: taxed at your slab. PPF interest and maturity: tax-free. Old regime: PPF deposits and 5-year tax-saver FDs count under section 123 (old 80C), up to ₹1.5 lakh; senior citizens can deduct up to ₹50,000 of interest under section 153(2)(b) (old 80TTB)."],
      short: short, inr: inr
    };
  }
  function busy(b, on) { b.disabled = on; b.setAttribute("aria-busy", on ? "true" : "false"); }
  $("dpPdf").addEventListener("click", function () { var b = this; busy(b, true); say("Making your PDF…"); withReport(function (K) { K.pdf(spec()).then(function () { busy(b, false); say("PDF report downloaded."); }, function () { busy(b, false); say("Couldn't make the PDF. Please try again."); }); }); });
  $("dpXlsx").addEventListener("click", function () { var b = this; busy(b, true); withReport(function (K) { try { K.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(b, false); }); });
  $("dpShare").addEventListener("click", function () {
    var q = new URLSearchParams(); Object.keys(NUM).forEach(function (k) { q.set(k, S[k]); }); ["mode", "payout", "when", "regime", "ext"].forEach(function (k) { q.set(k, S[k]); });
    ["taxSaver", "senior", "stopAfter15"].forEach(function (k) { if (S[k]) q.set(k, "1"); });
    var t = location.origin + location.pathname + "?" + q.toString();
    function ok() { say("Link copied. Anyone with it sees these numbers."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { say("Couldn't copy. Copy the address bar instead."); }); else say("Copy the address bar to share.");
  });
  (function bar() {
    var el = $("dpBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("dpVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".dp .lp-setup"));
    $("dpBarBtn").addEventListener("click", function () { $("dpVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
