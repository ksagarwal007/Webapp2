/* Salarist: did your hike beat inflation? Runs entirely in the browser; nothing is stored or sent.
   Prices: All India CPI (General, Combined), base 2024=100, from MoSPI's press release for October 2026 (Annexure-IV).
   Earlier years: average CPI inflation for each financial year (2012=100 series; 2025-26 from the RBI Annual Report 2025-26).
   Tax from the NPS calculator's code (nps.js, new regime). */
(function () {
  "use strict";
  var NODE = typeof module !== "undefined" && module.exports;
  var NPS = NODE ? require("./nps.js") : window.SalaristNPS;

  /* ---------- Data ---------- */
  var IDX = { "2025-01": 101.67, "2025-02": 101.32, "2025-03": 101.39, "2025-04": 101.58, "2025-05": 101.90, "2025-06": 102.51, "2025-07": 103.35, "2025-08": 103.74,
    "2025-09": 103.74, "2025-10": 103.74, "2025-11": 104.01, "2025-12": 104.10, "2026-01": 104.45, "2026-02": 104.57, "2026-03": 104.84, "2026-04": 105.12,
    "2026-05": 105.91, "2026-06": 107.00, "2026-07": 107.95, "2026-08": 108.74, "2026-09": 109.49, "2026-10": 110.05 };
  var FIRST = "2025-01", LATEST = "2026-10", LATEST_YOY = 6.09;
  /* Average CPI inflation for each financial year (April to March), % */
  var FY = { "2015-16": 4.91, "2016-17": 4.52, "2017-18": 3.59, "2018-19": 3.41, "2019-20": 4.77, "2020-21": 6.16, "2021-22": 5.51, "2022-23": 6.65,
    "2023-24": 5.40, "2024-25": 4.60, "2025-26": 2.10 };
  /* 2026-27 so far: average index April-October 2026 over April-October 2025 */
  var FY_NOW = "2026-27", FY_NOW_NOTE = "April to October";
  (function () { var a = 0, b = 0; for (var m = 4; m <= 10; m++) { var k = (m < 10 ? "0" : "") + m; a += IDX["2026-" + k]; b += IDX["2025-" + k]; } FY[FY_NOW] = (a / b - 1) * 100; })();
  var FYS = ["2014-15"].concat(Object.keys(FY));
  /* Price rise in the last 12 months by CPI division (Combined, October 2026, %): defaults for your own spending */
  var DIV = { rent: 2.90, school: 4.02, food: 8.51, transport: 5.84, health: 2.05, emi: 0, other: LATEST_YOY };

  function ym(k) { var p = k.split("-"); return +p[0] * 12 + (+p[1] - 1); }
  function key(n) { var y = Math.floor(n / 12), m = n % 12 + 1; return y + "-" + (m < 10 ? "0" : "") + m; }
  var NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function label(k) { var p = k.split("-"); return NAMES[+p[1] - 1] + " " + p[0]; }
  function idx(n) { var a = ym(FIRST), b = ym(LATEST); return IDX[key(Math.max(a, Math.min(b, n)))]; }
  function tax(g) { return NPS.newTax(Math.max(0, g - 75000)); }

  /* ---------- Core ----------
     o: {before, after (pay a year), start ("YYYY-MM" the new pay started), gap (months since the pay before it started), useTax, personal (null or rows [{amt, rise}]),
         since (FY the starting pay was for), startPay} */
  function calc(o) {
    var s = ym(o.start), lo = ym(FIRST), hi = ym(LATEST);
    var gap = Math.max(1, Math.round(o.gap)), p0 = s - gap, clamped = false;
    if (p0 < lo) { p0 = lo; clamped = true; }
    var sEff = Math.min(s, hi), estimated = s > hi;
    var cpiPrev = idx(p0), cpiStart = idx(sEff), cpiNow = idx(hi);
    /* Inflation over the period the old pay covered. If the new pay starts after the latest CPI, the latest 12-month rate fills the missing months. */
    var inflAt = cpiStart / cpiPrev * (estimated ? Math.pow(1 + LATEST_YOY / 100, (s - hi) / 12) : 1) - 1;
    var hike = o.after / o.before - 1;
    var real = (1 + hike) / (1 + inflAt) - 1;
    var keep = o.before * (1 + inflAt);                               /* pay that would just have kept up */
    /* Since the new pay started: prices to the latest month */
    var sinceStart = s < hi ? cpiNow / cpiStart - 1 : 0;
    var left = (1 + hike) / ((1 + inflAt) * (1 + sinceStart)) - 1;     /* what's left of the hike in today's prices */
    /* After tax (new regime), both years on today's rules */
    var tb = o.before - tax(o.before), ta = o.after - tax(o.after), hikeTax = ta / tb - 1, realTax = (1 + hikeTax) / (1 + inflAt) - 1;
    /* Your own prices */
    var pers = null;
    if (o.personal) {
      var tot = 0, w = 0; o.personal.forEach(function (r) { tot += r.amt; w += r.amt * r.rise; });
      var yr = tot ? w / tot / 100 : 0, per = Math.pow(1 + yr, gap / 12) - 1;
      pers = { yearly: yr, period: per, real: (1 + hike) / (1 + per) - 1, keep: o.before * (1 + per), spend: tot };
    }
    /* Next hike: 12 months after this one. To be back where the old pay was, and keep up if prices rise at the latest rate until then. */
    var nextAt = s + 12, toNext = Math.max(0, nextAt - hi);
    var needNext = (cpiNow / cpiPrev) * Math.pow(1 + LATEST_YOY / 100, toNext / 12) / (1 + hike) - 1;
    if (estimated) needNext = (1 + inflAt) * Math.pow(1 + LATEST_YOY / 100, 1) / (1 + hike) - 1;
    /* Long view: starting pay, grown with each year's average inflation to now */
    var i0 = FYS.indexOf(o.since), path = [], f = 1;
    if (i0 < 0) i0 = FYS.indexOf("2019-20");
    path.push({ fy: FYS[i0], infl: null, f: 1 });
    for (var i = i0 + 1; i < FYS.length; i++) { f *= 1 + FY[FYS[i]] / 100; path.push({ fy: FYS[i], infl: FY[FYS[i]], f: f }); }
    var years = path.length - 1, need = o.startPay * f, cagr = years ? Math.pow(o.after / o.startPay, 1 / years) - 1 : 0, inflCagr = years ? Math.pow(f, 1 / years) - 1 : 0;
    var realCagr = (1 + cagr) / (1 + inflCagr) - 1, worth = o.after / f;
    path.forEach(function (p, j) { p.keep = o.startPay * p.f; p.pay = o.startPay * Math.pow(1 + cagr, j); });
    return { s: s, p0: p0, gap: s - p0, clamped: clamped, estimated: estimated, cpiPrev: cpiPrev, cpiStart: cpiStart, cpiNow: cpiNow, prevKey: key(p0), startKey: key(sEff),
      infl: inflAt, hike: hike, real: real, keep: keep, gapMonth: (o.after - keep) / 12, sinceStart: sinceStart, left: left,
      tb: tb, ta: ta, hikeTax: hikeTax, realTax: realTax, pers: pers, needNext: needNext, nextKey: key(nextAt),
      long: { path: path, years: years, need: need, cagr: cagr, inflCagr: inflCagr, realCagr: realCagr, worth: worth, f: f, since: FYS[i0] } };
  }
  var API = { calc: calc, IDX: IDX, FY: FY, DIV: DIV, LATEST: LATEST, LATEST_YOY: LATEST_YOY, label: label, tax: tax };
  if (NODE) { module.exports = API; return; }
  window.SalaristHike = API;
  if (!document.getElementById("hvVerdict")) return;

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
  function pc(v, d) { var x = v * 100, t = Math.abs(x).toFixed(d === undefined ? 1 : d); return (x < -0.05 ? "−" : "") + t + "%"; }
  function spc(v) { return (v >= 0.0005 ? "+" : "") + pc(v); }
  function words(v) { return v >= 1e5 ? short(v) : ""; }
  var ROWS = [["rent", "Rent or housing"], ["school", "School or college fees"], ["food", "Food and groceries"], ["transport", "Fuel and transport"], ["health", "Health"], ["emi", "Loan EMIs"], ["other", "Everything else"]];
  var S = { before: 1200000, after: 1284000, start: "2026-04", gap: 12, tax: "on", own: "off", since: "2019-20", startPay: 600000,
    amt: { rent: 25000, school: 8000, food: 15000, transport: 6000, health: 2000, emi: 20000, other: 14000 },
    rise: { rent: DIV.rent, school: DIV.school, food: DIV.food, transport: DIV.transport, health: DIV.health, emi: 0, other: LATEST_YOY } };
  var LIM = { before: [10000, 1e9], after: [10000, 1e9], gap: [1, 21], startPay: [10000, 1e9], amt: [0, 1e8], rise: [-20, 100] };
  var MONEY = { before: 1, after: 1, startPay: 1, amt: 1 };
  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    function num(k, lim) { var v = parseFloat(q.get(k)); return isFinite(v) && v >= lim[0] && v <= lim[1] ? v : null; }
    ["before", "after", "gap", "startPay"].forEach(function (k) { var v = num(k, LIM[k]); if (v !== null) S[k] = v; });
    var st = q.get("start"); if (st && /^20\d\d-\d\d$/.test(st)) S.start = st;
    var si = q.get("since"); if (si && (FYS.indexOf(si) >= 0 || si === "2014-15")) S.since = si;
    if (q.get("tax") === "off") S.tax = "off"; if (q.get("own") === "on") S.own = "on";
    ROWS.forEach(function (r) { var a = num("a_" + r[0], LIM.amt), b = num("r_" + r[0], LIM.rise); if (a !== null) S.amt[r[0]] = a; if (b !== null) S.rise[r[0]] = b; });
  })();
  var shows = [];
  function bind(id, get, set, kind) {
    var el = $(id), note = $(id + "-w"); if (!el) return;
    function show() { el.value = MONEY[kind] ? fmt.format(get()) : String(get()); if (note) note.textContent = MONEY[kind] ? words(get()) : ""; }
    el.addEventListener("input", function () {
      var raw = MONEY[kind] ? this.value.replace(/[^0-9]/g, "") : this.value.replace(/[^0-9.\-]/g, "");
      if (MONEY[kind]) this.value = raw ? fmt.format(+raw) : "";
      var v = parseFloat(raw); if (!isFinite(v)) return;
      if (v < LIM[kind][0] || v > LIM[kind][1]) return;
      set(v); if (note) note.textContent = MONEY[kind] ? words(v) : ""; render();
    });
    el.addEventListener("blur", show); shows.push(function () { if (document.activeElement !== el) show(); }); show();
  }
  ["before", "after", "gap", "startPay"].forEach(function (k) { bind("hv-" + k, function () { return S[k]; }, function (v) { S[k] = v; }, k); });
  ROWS.forEach(function (r) {
    bind("hv-a-" + r[0], function () { return S.amt[r[0]]; }, function (v) { S.amt[r[0]] = v; }, "amt");
    bind("hv-r-" + r[0], function () { return S.rise[r[0]]; }, function (v) { S.rise[r[0]] = v; }, "rise");
  });
  $("hv-start").value = S.start; $("hv-start").addEventListener("change", function () { S.start = this.value; render(); });
  $("hv-since").value = S.since; $("hv-since").addEventListener("change", function () { S.since = this.value; render(); });
  document.querySelectorAll("[data-tax]").forEach(function (b) { b.addEventListener("click", function () { S.tax = b.getAttribute("data-tax"); render(); }); });
  document.querySelectorAll("[data-own]").forEach(function (b) { b.addEventListener("click", function () { S.own = b.getAttribute("data-own"); render(); }); });
  function opts(ch) {
    var o = { before: S.before, after: S.after, start: S.start, gap: S.gap, since: S.since, startPay: S.startPay,
      personal: S.own === "on" ? ROWS.map(function (r) { return { amt: S.amt[r[0]], rise: S.rise[r[0]] }; }) : null };
    return ch ? ch(o) || o : o;
  }
  var last = null;
  function chart(L) {
    var P = L.path, n = P.length - 1, W = 420, Hh = 230, pl = 54, pr = 12, pt = 16, pb = 26;
    var all = P.map(function (p) { return p.keep; }).concat(P.map(function (p) { return p.pay; })), mx = Math.max.apply(null, all), mn = 0, span = mx - mn || 1;
    var st = Math.pow(10, Math.floor(Math.log10(span / 4))), qq = span / 4 / st; st *= qq <= 1 ? 1 : qq <= 2 ? 2 : qq <= 2.5 ? 2.5 : qq <= 5 ? 5 : 10;
    mx = st * Math.ceil(mx / st);
    function x(i) { return pl + (n ? i / n : 0) * (W - pl - pr); } function yy(v) { return pt + (mx - v) / (mx - mn) * (Hh - pt - pb); }
    var g = ""; for (var v = mn; v <= mx + 1; v += st) { var gy = yy(v).toFixed(1); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+gy + 3) + '" class="al" text-anchor="end">' + short(v) + "</text>"; }
    var every = n > 8 ? 2 : 1, xl = ""; P.forEach(function (p, i) { if (i % every === 0 || i === n) xl += '<text x="' + x(i).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">' + p.fy.slice(2) + "</text>"; });
    function path(k) { return P.map(function (p, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(p[k]).toFixed(1); }).join(""); }
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Your pay against the pay that would have kept up with prices">' + g + xl +
      '<path d="' + path("keep") + '" class="ln buy"/><path d="' + path("pay") + '" class="ln rent"/></svg>';
  }
  function render() {
    document.querySelectorAll("[data-tax]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-tax") === S.tax ? "true" : "false"); });
    document.querySelectorAll("[data-own]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-own") === S.own ? "true" : "false"); });
    $("hvOwn").hidden = S.own !== "on";
    var r = calc(opts()); last = r;
    var use = r.pers ? r.pers.real : r.real, beat = use >= 0, measure = r.pers ? "your own prices" : "inflation";
    $("hvVerdict").className = "verdict" + (beat ? "" : " short");
    $("hvVerdict").innerHTML = '<p class="k">Your ' + pc(r.hike) + " hike from " + label(S.start) + ", against " + (r.pers ? "your own price rise of " + pc(r.pers.period) : "prices up " + pc(r.infl)) + " since " + label(r.prevKey) + '</p><p class="v">' +
      (beat ? "Yes: you beat " + measure + " by <b>" + pc(use) + "</b>" : "No: you fell behind " + measure + " by <b>" + pc(-use) + "</b>") + "</p>" +
      '<p class="k">' + (r.sinceStart > 0 ? "Since " + label(S.start) + ", prices have risen another " + pc(r.sinceStart) + " to " + label(LATEST) + ". In today's prices, " + (r.left >= 0 ? pc(r.left) + " of real raise is left." : "your pay is now " + pc(-r.left) + " below what it was worth before the hike.") : "Pay that would just have kept up: " + short(r.keep) + " a year.") + "</p>";
    $("hvS1").textContent = spc(r.real); $("hvS1h").textContent = "Real raise: " + pc(r.hike) + " hike, " + pc(r.infl) + " inflation";
    $("hvS2").textContent = (r.gapMonth >= 0 ? "+" : "") + inr(r.gapMonth); $("hvS2h").textContent = "A month, against pay that just kept up (" + short(r.keep) + " a year)";
    $("hvS3").textContent = S.tax === "on" ? spc(r.realTax) : "—"; $("hvS3h").textContent = S.tax === "on" ? "After tax: take-home up " + pc(r.hikeTax) + " (new regime)" : "Tax view off";
    $("hvS4").textContent = r.needNext > 0 ? pc(r.needNext) : "Any"; $("hvS4h").textContent = "Next hike (" + label(r.nextKey) + ") to keep up, if prices rise " + pc(LATEST_YOY / 100) + " a year";
    var L = r.long;
    $("hvChart").innerHTML = chart(L);
    $("hvLong").innerHTML = "<b>Since " + L.since + ":</b> " + short(S.startPay) + " then would need to be <b>" + short(L.need) + "</b> now just to buy the same. You're at " + short(S.after) + ": " +
      (S.after >= L.need ? short(S.after - L.need) + " (" + pc(S.after / L.need - 1) + ") ahead of prices." : short(L.need - S.after) + " (" + pc(1 - S.after / L.need) + ") behind prices.") +
      " Your pay grew " + pc(L.cagr) + " a year against " + pc(L.inflCagr) + " inflation: a real " + spc(L.realCagr) + " a year. Today's pay in " + L.since + " prices: " + short(L.worth) + ".";
    var notes = [];
    notes.push("<b>Inflation used:</b> All India CPI (2024=100), " + label(r.prevKey) + " " + r.cpiPrev.toFixed(2) + " to " + label(r.startKey) + " " + r.cpiStart.toFixed(2) + (r.estimated ? ", then " + pc(LATEST_YOY / 100) + " a year for the months after " + label(LATEST) + " (no figures yet)" : "") + ". " +
      (r.clamped ? "CPI on the new base starts in January 2025, so the comparison starts there. " : "") + "It's the change over the " + r.gap + " months your old pay covered.");
    if (S.tax === "on") notes.push("<b>After tax:</b> take-home " + short(r.tb) + " → " + short(r.ta) + " a year (gross less income tax, new regime, ₹75,000 standard deduction; PF left out). Tax takes a bigger share of the raise than of the rest of your pay, so take-home rises less than gross.");
    if (r.pers) notes.push("<b>Your own prices:</b> spending of " + inr(r.pers.spend) + " a month rising " + pc(r.pers.yearly) + " a year on average, " + pc(r.pers.period) + " over " + r.gap + " months. Pay that would have kept up with your costs: " + short(r.pers.keep) + ". Against official CPI the real raise is " + spc(r.real) + ".");
    else notes.push("<b>Your costs may rise faster:</b> rent, school fees and food often rise more than the CPI average, while EMIs don't rise at all. Switch on \"Use my own spending\" to see your own rate.");
    $("hvRule").innerHTML = notes.join("<br><br>");
    function alt(ch) { var x = calc(opts(ch)); return spc(x.pers ? x.pers.real : x.real); }
    r.what = [["Hike of 5%", alt(function (o) { o.after = o.before * 1.05; })], ["Hike of 10%", alt(function (o) { o.after = o.before * 1.10; })],
      ["Hike of 15%", alt(function (o) { o.after = o.before * 1.15; })], [r.pers ? "Official CPI instead" : "With rent and fees rising 10%", r.pers ? spc(r.real) : alt(function (o) { o.personal = [{ amt: 25000, rise: 10 }, { amt: 8000, rise: 10 }, { amt: 15000, rise: DIV.food }, { amt: 6000, rise: DIV.transport }, { amt: 2000, rise: DIV.health }, { amt: 20000, rise: 0 }, { amt: 14000, rise: LATEST_YOY }]; })]];
    $("hvSens").innerHTML = r.what.map(function (w) { return '<div class="sv"><span class="l">' + w[0] + '</span><span class="n">' + w[1] + "</span></div>"; }).join("");
    $("hvCpi").innerHTML = '<table class="calc"><thead><tr><th>Month</th><th>CPI (2024=100)</th><th>Inflation, 12 months</th></tr></thead><tbody>' +
      Object.keys(IDX).slice().reverse().map(function (k) { var pk = key(ym(k) - 12), yoy = IDX[pk] ? (IDX[k] / IDX[pk] - 1) * 100 : null;
        var mark = k === r.prevKey || k === r.startKey ? ' class="tot"' : "";
        return "<tr" + mark + '><th scope="row">' + label(k) + (k === r.prevKey ? " (old pay)" : k === r.startKey ? " (new pay)" : "") + '</th><td data-l="CPI">' + IDX[k].toFixed(2) + '</td><td data-l="Inflation">' + (yoy === null ? "—" : yoy.toFixed(2) + "%") + "</td></tr>"; }).join("") + "</tbody></table>";
    $("hvYears").innerHTML = '<table class="calc"><thead><tr><th>Financial year</th><th>Average inflation</th><th>Pay that keeps up</th><th>Your pay at your average rise</th></tr></thead><tbody>' +
      L.path.map(function (p) { return '<tr><th scope="row">' + p.fy + (p.fy === "2026-27" ? " (Apr–Oct)" : "") + '</th><td data-l="Inflation">' + (p.infl === null ? "Start" : p.infl.toFixed(2) + "%") + '</td><td data-l="Keeps up">' + inr(p.keep) + '</td><td data-l="Your pay">' + inr(p.pay) + "</td></tr>"; }).join("") + "</tbody></table>";
    $("hvBarT").textContent = (beat ? "Beat " : "Behind ") + measure + ": " + spc(use);
    shows.forEach(function (f) { f(); });
  }

  /* ---------- Reports ---------- */
  function say(m) { var s = $("hvStatus"); s.textContent = m; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function spec() {
    var r = last, L = r.long, cats = [], keep = [], pay = [];
    L.path.forEach(function (p, i) { cats.push(+p.fy.slice(0, 4));
      if (!i) { keep.push(p.keep); pay.push(p.pay); return; }
      var a = L.path[i - 1]; for (var m = 1; m <= 12; m++) { keep.push(a.keep * Math.pow(p.keep / a.keep, m / 12)); pay.push(a.pay * Math.pow(p.pay / a.pay, m / 12)); } });
    var inputs = [["Pay before the hike, a year", inr(S.before)], ["Pay after the hike, a year", inr(S.after) + " (" + pc(r.hike) + ")"], ["New pay started", label(S.start)],
      ["Pay before it started", label(r.prevKey) + " (" + r.gap + " months earlier)"], ["After-tax view", S.tax === "on" ? "On (new regime)" : "Off"], ["Starting pay, " + L.since, inr(S.startPay)]];
    if (r.pers) ROWS.forEach(function (x) { inputs.push(["Your spending: " + x[1].toLowerCase() + " a month, price rise", inr(S.amt[x[0]]) + ", " + S.rise[x[0]] + "% a year"]); });
    return {
      title: "Did Your Hike Beat Inflation?", path: "salarist.in/salary-hike-vs-inflation", url: location.origin + location.pathname, file: "salarist-hike-vs-inflation",
      question: "Did my pay rise beat inflation?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#hvVerdict p"), function (x) { return x.textContent; }), verdictColor: (r.pers ? r.pers.real : r.real) >= 0 ? "blue" : "amber",
      inputs: inputs,
      keyNums: [["Real raise (official CPI)", spc(r.real), r.real], ["A month vs keeping up", inr(r.gapMonth), r.gapMonth], ["After tax, real", S.tax === "on" ? spc(r.realTax) : "—", S.tax === "on" ? r.realTax : 0], ["Next hike needed", r.needNext > 0 ? pc(r.needNext) : "Any", 0]],
      sensTitle: "Real raise with a different hike", sens: r.what.slice(0, 3), sensCurrent: -1,
      chartTitle: "Your pay against pay that keeps up with prices, since " + L.since, chartNote: "Amber: starting pay grown with each year's average inflation. Blue: your pay at your average yearly rise.",
      xlsxChartTitle: "Pay a year (₹ lakh)",
      chart: { series: [{ name: "Your pay (average rise)", color: "blue", data: pay }, { name: "Pay that keeps up with prices", color: "amber", data: keep }], cross: null }, chartYears: cats, chartXLabel: "Financial year from",
      money: { title: "This hike", cols: ["Amount", "Change"], rows: [["Pay before", short(S.before), ""], ["Pay after", short(S.after), pc(r.hike)], ["Pay that would just have kept up", short(r.keep), pc(r.infl)]]
        .concat(S.tax === "on" ? [["Take-home before (after tax)", short(r.tb), ""], ["Take-home after (after tax)", short(r.ta), pc(r.hikeTax)]] : [])
        .concat(r.pers ? [["Pay that would have kept up with your own costs", short(r.pers.keep), pc(r.pers.period)]] : [])
        .map(function (x, i) { return [x[0], x[1], x[2], i === 1 ? "total" : undefined]; }), note: $("hvRule").textContent },
      tables: [{ title: "Year by year since " + L.since, sheet: "By year", cols: ["Financial year", "Average inflation (%)", "Pay that keeps up", "Your pay at your average rise"],
        yearly: L.path.map(function (p) { return [p.fy, p.infl === null ? "Start" : p.infl.toFixed(2), p.keep, p.pay]; }), monthly: null,
        noteTitle: "How this is worked out", note: ["Average CPI inflation for each financial year (April to March): 2015-16 to 2024-25 on the 2012=100 series, 2025-26 from the RBI Annual Report 2025-26, 2026-27 so far from April to October 2026 on the 2024=100 series.",
          "Your pay is shown rising at the same rate every year from your starting pay to today's pay; your actual hikes may have been uneven."] },
        { title: "CPI used for this hike", sheet: "CPI", cols: ["Month", "CPI (2024=100)"], yearly: Object.keys(IDX).map(function (k) { return [label(k), IDX[k].toFixed(2)]; }), monthly: null,
          noteTitle: "Source", note: ["All India CPI (General), Combined, base 2024=100: MoSPI press release for October 2026 (provisional for October), Annexure-IV."] }],
      notes: [$("hvLong").textContent, "Inflation: change in the All India CPI from the month your old pay started to the month your new pay started" + (r.estimated ? "; months after " + label(LATEST) + " at " + pc(LATEST_YOY / 100) + " a year." : "."),
        "Real raise = (1 + hike) ÷ (1 + inflation) − 1.",
        S.tax === "on" ? "After tax: income tax under the new regime for tax year 2026-27 on both, with the ₹75,000 standard deduction; PF, professional tax and surcharge left out." : "After-tax view off.",
        r.pers ? "Your own prices: each spending line rises at the rate you set; the average is weighted by what you spend." : "Official CPI covers an average household's spending; yours may differ."],
      taxRules: ["Income-tax Act, 2025: section 202 new-regime rates, section 156 rebate, ₹75,000 standard deduction."],
      short: short, inr: inr
    };
  }
  function busy(b, on) { b.disabled = on; b.setAttribute("aria-busy", on ? "true" : "false"); }
  $("hvPdf").addEventListener("click", function () { var b = this; busy(b, true); say("Making your PDF…"); withReport(function (Kt) { Kt.pdf(spec()).then(function () { busy(b, false); say("PDF report downloaded."); }, function () { busy(b, false); say("Couldn't make the PDF. Please try again."); }); }); });
  $("hvXlsx").addEventListener("click", function () { var b = this; busy(b, true); withReport(function (Kt) { try { Kt.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(b, false); }); });
  $("hvShare").addEventListener("click", function () {
    var q = new URLSearchParams(); ["before", "after", "start", "gap", "since", "startPay", "tax", "own"].forEach(function (k) { q.set(k, S[k]); });
    if (S.own === "on") ROWS.forEach(function (x) { q.set("a_" + x[0], S.amt[x[0]]); q.set("r_" + x[0], S.rise[x[0]]); });
    var t = location.origin + location.pathname + "?" + q.toString();
    function ok() { say("Link copied. Anyone with it sees these numbers."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { say("Couldn't copy. Copy the address bar instead."); }); else say("Copy the address bar to share.");
  });
  (function bar() {
    var el = $("hvBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("hvVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".hvx .lp-setup"));
    $("hvBarBtn").addEventListener("click", function () { $("hvVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
