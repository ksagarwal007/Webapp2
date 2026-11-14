/* Salarist retirement planner. Runs entirely in the browser; nothing is stored or sent.
   Uses the EPF calculator's and NPS calculator's own code (epf.js, nps.js) for those two. */
(function () {
  "use strict";
  var NODE = typeof module !== "undefined" && module.exports;
  var EPF = NODE ? require("./epf.js") : window.SalaristEPF, NPS = NODE ? require("./nps.js") : window.SalaristNPS;
  var NPS_AGE = 60, EPS_AGE = 58, ANNUITY = 6.5;

  /* ---------- Core ---------- */
  /* o: {age, retireAge, lifeTo, spend (a month, today's money), infl, retRet (return after retiring),
         epfBal, wage, hike, epfRate, eps, epsYears, npsBal, npsMonthly, npsRet, mfBal, sip, step, mfRet, fdBal, fdRet,
         other (income a month in retirement, today's money), extra (extra SIP a month, optional)}
     Everything is before tax. Spending and other income rise with inflation; EPS and NPS pensions stay fixed. */
  function sipGrow(bal, sip, step, ret, years) { return NPS.grow({ age: 0, exitAge: years, balance: bal, own: sip, emp: 0, step: step, ret: ret }); }
  function plan(o) {
    var N = Math.max(0, Math.round(o.retireAge - o.age)), R = Math.max(1, Math.round(o.lifeTo - o.retireAge));
    var fi = 1 + o.infl / 100, rr = o.retRet / 100;
    /* EPF (and EPS pension) from the EPF calculator's code */
    var ep = o.epfBal > 0 || o.wage > 0 ? EPF.plan({ age: o.age, retireAge: o.retireAge, balance: o.epfBal, wage: o.wage, basis: "full", eps: o.eps && o.wage > 0,
      epsYears: o.epsYears, vpf: 0, hike: o.hike, rate: o.epfRate, infl: o.infl, slab: 0 }) : null;
    var epfAt = ep ? ep.corpus : 0, pen = ep && ep.pension.member && ep.pension.eligible ? ep.pension : null;
    var epsM = pen ? pen.monthly : 0, epsFrom = Math.max(EPS_AGE, o.retireAge);
    /* NPS: contributions until retirement; stays invested until 60 if you retire earlier. Normal exit, most allowed as a lump sum (80% for non-government
       subscribers), the rest buys an annuity at ANNUITY% a year (rules from nps.js). */
    var npsExit = Math.max(NPS_AGE, o.retireAge), npG = sipGrow(o.npsBal, o.npsMonthly, o.step, o.npsRet, N);
    var npsAt = npG.corpus * Math.pow(1 + o.npsRet / 100, npsExit - o.retireAge);
    var npx = npsAt > 0 ? NPS.exit(npsAt, "private", "max") : { lump: 0, annuity: 0 };
    var npsPen = npx.annuity * ANNUITY / 100 / 12;
    /* Mutual funds / SIPs (with any extra SIP) and FD/PPF */
    var mf = sipGrow(o.mfBal, o.sip + (o.extra || 0), o.step, o.mfRet, N), fdAt = o.fdBal * Math.pow(1 + o.fdRet / 100, N);
    var have = epfAt + mf.corpus + fdAt + (npsExit === o.retireAge ? npx.lump : 0);
    /* Retirement years: withdraw what pensions and other income don't cover at the start of each year; the rest earns retRet. */
    function stream(k) {
      var A = o.retireAge + k, spend = o.spend * 12 * Math.pow(fi, N + k);
      var inc = (A >= epsFrom ? epsM * 12 : 0) + (A >= npsExit ? npsPen * 12 : 0) + o.other * 12 * Math.pow(fi, N + k);
      var inflow = A === npsExit && npsExit > o.retireAge ? npx.lump : 0;
      return { age: A, spend: spend, inc: inc, inflow: inflow };
    }
    var need = 0, st = [];
    for (var k = 0; k < R; k++) { var s = stream(k); st.push(s); need += (s.spend - s.inc - s.inflow) / Math.pow(1 + rr, k); }
    need = Math.max(0, need);
    /* Year-by-year path */
    var rows = [], fdB = o.fdBal, npsB = o.npsBal;
    for (var y = 1; y <= N; y++) {
      fdB *= 1 + o.fdRet / 100; npsB = npG.rows[y - 1].bal;
      var eb = ep ? ep.rows[y - 1].bal : 0, er = ep ? ep.rows[y - 1] : null;
      var put = (er ? er.own + er.emp : 0) + npG.rows[y - 1].own + mf.rows[y - 1].own;
      rows.push({ age: o.age + y, phase: "save", put: put, spend: 0, inc: 0, total: eb + npsB + mf.rows[y - 1].bal + fdB, nps: npsB });
    }
    var pot = have, npsHeld = npsExit > o.retireAge ? npsAt / Math.pow(1 + o.npsRet / 100, npsExit - o.retireAge) : 0, runsOut = null;
    for (k = 0; k < R; k++) {
      s = st[k]; pot += s.inflow - (s.spend - s.inc); if (s.inflow) npsHeld = 0;
      if (pot < -1 && runsOut === null) runsOut = s.age;
      pot = pot > 0 ? pot * (1 + rr) : pot; if (npsHeld) npsHeld *= 1 + o.npsRet / 100;
      rows.push({ age: s.age + 1, phase: "spend", put: 0, spend: s.spend, inc: s.inc, total: Math.max(0, pot) + npsHeld, nps: npsHeld });
    }
    var fv1 = N > 0 ? sipGrow(0, 1, o.step, o.mfRet, N).corpus : 0, gap = need - have;
    return { N: N, R: R, need: need, have: have, gap: gap, needReal: need / Math.pow(fi, N), extraSip: gap > 0 && fv1 > 0 ? gap / fv1 : 0,
             spendAt: o.spend * Math.pow(fi, N), runsOut: runsOut, endPot: pot, rows: rows,
             epf: epfAt, eps: pen, epsM: epsM, epsFrom: epsFrom, mf: mf.corpus, fd: fdAt, nps: npsAt, npsLump: npx.lump, npsPen: npsPen, npsExit: npsExit,
             put: (ep ? ep.putOwn + ep.putEmp : 0) + npG.putOwn + mf.putOwn };
  }
  if (NODE) { module.exports = { plan: plan, ANNUITY: ANNUITY }; return; }

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
  var S = { eps: true, age: 30, retireAge: 60, lifeTo: 85, spend: 50000, infl: 6, retRet: 7, epfBal: 300000, wage: 40000, hike: 6, epfRate: 8.25, epsYears: 5,
            npsBal: 0, npsMonthly: 0, npsRet: 10, mfBal: 300000, sip: 5000, step: 5, mfRet: 11, fdBal: 200000, fdRet: 7, other: 0 };
  var NUM = { age: [18, 65], retireAge: [40, 70], lifeTo: [60, 100], spend: [1000, 1e8], infl: [0, 12], retRet: [0, 15], epfBal: [0, 1e9], wage: [0, 1e8], hike: [0, 20],
              epfRate: [1, 15], epsYears: [0, 40], npsBal: [0, 1e9], npsMonthly: [0, 1e7], npsRet: [1, 16], mfBal: [0, 1e10], sip: [0, 1e7], step: [0, 20], mfRet: [1, 20],
              fdBal: [0, 1e10], fdRet: [0, 12], other: [0, 1e8] };
  var MONEY = { spend: 1, epfBal: 1, wage: 1, npsBal: 1, npsMonthly: 1, mfBal: 1, sip: 1, fdBal: 1, other: 1 };
  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    Object.keys(NUM).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= NUM[k][0] && v <= NUM[k][1]) S[k] = v; });
    if (q.get("eps") === "0") S.eps = false;
  })();
  function fixAges() { /* keep ages in order */
    if (S.retireAge <= S.age) S.retireAge = Math.min(70, S.age + 1);
    if (S.lifeTo <= S.retireAge) S.lifeTo = Math.min(100, S.retireAge + 1);
  }
  var shows = [];
  function bind(k) {
    var el = $("rp-" + k), note = $("rp-" + k + "-w"); if (!el) return;
    function show() { el.value = MONEY[k] ? fmt.format(S[k]) : String(S[k]); if (note) note.textContent = MONEY[k] ? words(S[k]) : ""; }
    el.addEventListener("input", function () {
      var raw = MONEY[k] ? this.value.replace(/[^0-9]/g, "") : this.value.replace(/[^0-9.]/g, "");
      if (MONEY[k]) this.value = raw ? fmt.format(+raw) : "";
      var v = parseFloat(raw); if (!isFinite(v)) { if (MONEY[k] && raw === "" && NUM[k][0] === 0) { S[k] = 0; render(); } return; }
      S[k] = Math.max(NUM[k][0], Math.min(NUM[k][1], v));
      if (note) note.textContent = MONEY[k] ? words(S[k]) : ""; render();
    });
    el.addEventListener("blur", function () { fixAges(); render(); show(); }); shows.push(function () { if (document.activeElement !== el) show(); }); show();
  }
  Object.keys(NUM).forEach(function (k) { bind(k); });
  document.querySelectorAll("[data-eps]").forEach(function (b) { b.addEventListener("click", function () { S.eps = b.getAttribute("data-eps") === "1"; render(); }); });
  function pressed(attr, val) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-" + attr) === String(val) ? "true" : "false"); }); }
  function yrs(n) { return n + (n === 1 ? " year" : " years"); }
  function cur() { var o = Object.assign({}, S); if (o.retireAge <= o.age) o.retireAge = o.age + 1; if (o.lifeTo <= o.retireAge) o.lifeTo = o.retireAge + 1; return o; }
  var last = null, lastX = null;
  function chart(r, rx) {
    var W = 420, Hh = 240, pl = 54, pr = 14, pt = 20, pb = 26, n = r.rows.length || 1, o = cur();
    var a = [o.epfBal + o.npsBal + o.mfBal + o.fdBal].concat(r.rows.map(function (x) { return x.total; }));
    var b = rx ? [a[0]].concat(rx.rows.map(function (x) { return x.total; })) : null;
    var max = Math.max.apply(null, a.concat(b || [])) || 1, st = Math.pow(10, Math.floor(Math.log10(max / 4))), qq = max / 4 / st; st *= qq <= 1 ? 1 : qq <= 2 ? 2 : qq <= 2.5 ? 2.5 : qq <= 5 ? 5 : 10; max = st * 4;
    function x(i) { return pl + i / n * (W - pl - pr); } function yy(v) { return pt + (max - v) / max * (Hh - pt - pb); }
    function path(arr) { return arr.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(v).toFixed(1); }).join(""); }
    var g = ""; for (var k = 0; k <= 4; k++) { var gy = yy(max * k / 4).toFixed(1); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+gy + 3) + '" class="al" text-anchor="end">' + short(max * k / 4) + "</text>"; }
    var stp = n > 40 ? 10 : n > 24 ? 5 : n > 12 ? 3 : 1, xl = ""; for (var t = 0; t <= n; t += stp) xl += '<text x="' + x(t).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">' + (o.age + t) + "</text>";
    var rx0 = x(r.N).toFixed(1), mark = '<line x1="' + rx0 + '" x2="' + rx0 + '" y1="' + pt + '" y2="' + (Hh - pb) + '" class="gl" stroke-dasharray="3 3"/><text x="' + (+rx0 + 4) + '" y="' + (pt + 10) + '" class="al">Retire</text>';
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Your savings by age">' + g + xl + mark + (b ? '<path d="' + path(b) + '" class="ln buy"/>' : "") + '<path d="' + path(a) + '" class="ln rent"/></svg>';
  }
  function whatIfs(o) {
    var L = [["As you've set it", o], ["Retire 2 years later", Object.assign({}, o, { retireAge: Math.min(o.retireAge + 2, o.lifeTo - 1) })],
      ["Returns 1% lower", Object.assign({}, o, { retRet: Math.max(0, o.retRet - 1), mfRet: Math.max(1, o.mfRet - 1), npsRet: Math.max(1, o.npsRet - 1), fdRet: Math.max(0, o.fdRet - 1) })],
      ["Inflation 1% higher", Object.assign({}, o, { infl: o.infl + 1 })]];
    return L.map(function (x) { var p = plan(x[1]); return { label: x[0], gap: p.gap, sip: p.extraSip, runsOut: p.runsOut }; });
  }
  function whatText(w) { return w.gap > 0 ? "Gap " + short(w.gap) : "No gap"; }
  function whatHint(w) { return w.gap > 0 ? (w.sip > 0 ? "Extra SIP " + inr(w.sip) + " a month" : "") : "Surplus " + short(-w.gap); }
  function haveRows(r) {
    var x = [["EPF", r.epf], ["Mutual funds and SIPs", r.mf], ["FD, PPF and other savings", r.fd]];
    if (r.nps > 0) x.push([r.npsExit > S.retireAge ? "NPS lump sum (at " + r.npsExit + ", counted in what you need)" : "NPS lump sum", r.npsLump]);
    return x;
  }
  function tableHtml(r) {
    var rows = r.rows.map(function (w) {
      return '<tr><th scope="row">' + w.age + '</th><td data-l="Put in">' + (w.put ? inr(w.put) : "—") + '</td><td data-l="Spending">' + (w.spend ? inr(w.spend) : "—") + '</td><td data-l="Pensions and income">' + (w.inc ? inr(w.inc) : "—") + '</td><td data-l="Savings">' + inr(w.total) + "</td></tr>";
    }).join("");
    return '<table class="calc"><thead><tr><th>Age</th><th>You put in (year)</th><th>Spending (year)</th><th>Pensions and income (year)</th><th>Savings at the end</th></tr></thead><tbody>' + rows + "</tbody></table>";
  }
  function render() {
    pressed("eps", S.eps ? "1" : "0"); $("rp-epsWrap").hidden = !S.eps;
    var o = cur(), r = plan(o); last = r;
    var rx = r.extraSip > 0 ? plan(Object.assign({}, o, { extra: r.extraSip })) : null; lastX = rx;
    var ok = r.gap <= 0;
    $("rpVerdict").className = "verdict" + (ok ? "" : " short");
    $("rpVerdict").innerHTML = '<p class="k">To retire at ' + o.retireAge + " and spend " + inr(o.spend) + " a month in today's money until " + o.lifeTo + '</p>' +
      '<p class="v">' + (ok ? "You're on track, with about <b>" + short(-r.gap) + "</b> to spare" : "You're short by about <b>" + short(r.gap) + "</b>") + "</p>" +
      '<p class="k">' + (ok ? "Your savings could last beyond " + o.lifeTo + "." : r.extraSip > 0 ? "An extra SIP of about " + inr(r.extraSip) + " a month" + (o.step ? ", rising " + o.step + "% a year," : "") + " would close the gap." : "Retiring later or spending less would close the gap.") + "</p>";
    $("rpS1").textContent = short(r.need); $("rpS1h").textContent = "About " + short(r.needReal) + " in today's money";
    $("rpS2").textContent = short(r.have); $("rpS2h").textContent = "EPF, mutual funds, FD" + (r.nps > 0 && r.npsExit === o.retireAge ? ", NPS" : "");
    $("rpS3").textContent = ok ? "—" : inr(r.extraSip); $("rpS3h").textContent = ok ? "Not needed" : "A month" + (o.step ? ", rising " + o.step + "% a year" : "");
    $("rpS4").textContent = r.runsOut ? "Age " + r.runsOut : "Beyond " + o.lifeTo; $("rpS4h").textContent = r.runsOut ? "Without the extra SIP" : "Your savings last";
    var notes = ["<b>At " + o.retireAge + ",</b> " + inr(o.spend) + " a month today will cost about " + inr(r.spendAt) + " a month (at " + o.infl + "% inflation)."];
    if (r.eps) notes.push("<b>EPS pension:</b> about " + inr(r.epsM) + " a month from " + r.epsFrom + ", fixed, from the EPF calculator's estimate (<a href=\"/eps-pension-calculator/\">work it out exactly</a>).");
    else if (S.eps && o.wage > 0) notes.push("<b>EPS:</b> less than 10 years of pension service by 58, so no pension is counted.");
    if (r.nps > 0) notes.push("<b>NPS:</b> about " + short(r.nps) + " at " + r.npsExit + ": " + short(r.npsLump) + " as a lump sum and a pension of about " + inr(r.npsPen) + " a month from the rest (annuity at " + ANNUITY + "%)." + (r.npsExit > o.retireAge ? " It stays invested until 60." : ""));
    if (o.other > 0) notes.push("<b>Other income:</b> " + inr(o.other) + " a month in today's money, rising with inflation.");
    $("rpRule").innerHTML = notes.join("<br><br>");
    $("rpChart").innerHTML = chart(r, rx);
    $("rpLegX").hidden = !rx;
    $("rpHave").innerHTML = '<table class="calc"><thead><tr><th>At ' + o.retireAge + '</th><th>Amount</th></tr></thead><tbody>' + haveRows(r).map(function (x) { return '<tr><th scope="row">' + x[0] + '</th><td data-l="Amount">' + inr(x[1]) + "</td></tr>"; }).join("") +
      '<tr class="tot"><th scope="row"><b>You\'ll have</b></th><td data-l="Amount"><b>' + inr(r.have) + '</b></td></tr><tr><th scope="row">You need</th><td data-l="Amount">' + inr(r.need) + '</td></tr><tr class="tot"><th scope="row"><b>' + (ok ? "Surplus" : "Gap") + '</b></th><td data-l="Amount"><b>' + inr(Math.abs(r.gap)) + "</b></td></tr></tbody></table>";
    r.what = whatIfs(o);
    $("rpSens").innerHTML = r.what.map(function (w, i) { return '<div class="sv' + (i === 0 ? " cur" : "") + '"><span class="l">' + w.label + '</span><span class="n">' + whatText(w) + '</span><span class="h">' + whatHint(w) + "</span></div>"; }).join("");
    $("rpTable").innerHTML = tableHtml(r);
    $("rpBarT").textContent = ok ? "On track at " + o.retireAge : "Short by " + short(r.gap);
    shows.forEach(function (f) { f(); });
  }

  /* ---------- Reports ---------- */
  function say(m) { var s = $("rpStatus"); s.textContent = m; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function spec() {
    var r = last, rx = lastX, o = cur(), cats = [o.age], start = o.epfBal + o.npsBal + o.mfBal + o.fdBal, a = [start], b = [start];
    function months(rows, arr) { rows.forEach(function (w, i) { var prev = i ? rows[i - 1].total : start; for (var m = 1; m <= 12; m++) arr.push(prev + (w.total - prev) * m / 12); }); }
    r.rows.forEach(function (w) { cats.push(w.age); }); months(r.rows, a); if (rx) months(rx.rows, b);
    var series = [{ name: "Savings as you are", color: "blue", data: a }]; if (rx) series.push({ name: "With the extra SIP", color: "amber", data: b });
    var w3 = r.what.slice(0, 3);
    return {
      title: "Retirement Plan Report", path: "salarist.in/retirement-planner", url: location.origin + location.pathname, file: "salarist-retirement",
      question: "How much do I need to retire at " + o.retireAge + ", and am I on track?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#rpVerdict p"), function (x) { return x.textContent; }), verdictColor: r.gap > 0 ? "amber" : "blue",
      inputs: [["Age now", String(o.age)], ["Retire at", String(o.retireAge)], ["Plan until age", String(o.lifeTo)], ["Spending a month (today's money)", inr(o.spend), o.spend],
        ["Inflation", o.infl + "% a year"], ["Return after retiring", o.retRet + "% a year"], ["EPF balance now", inr(o.epfBal), o.epfBal], ["PF wages a month", inr(o.wage), o.wage],
        ["Pay rise each year", o.hike + "%"], ["EPF interest rate", o.epfRate + "% a year"], ["In EPS", S.eps ? "Yes, " + yrs(o.epsYears) + " so far" : "No"],
        ["NPS balance now", inr(o.npsBal), o.npsBal], ["NPS a month (you + employer)", inr(o.npsMonthly), o.npsMonthly], ["NPS return", o.npsRet + "% a year"],
        ["Mutual funds now", inr(o.mfBal), o.mfBal], ["SIP a month", inr(o.sip), o.sip], ["SIP and NPS step-up", o.step + "% a year"], ["Mutual fund return", o.mfRet + "% a year"],
        ["FD, PPF and other savings now", inr(o.fdBal), o.fdBal], ["Their return", o.fdRet + "% a year"], ["Other income in retirement", inr(o.other) + " a month", o.other]],
      keyNums: [["You need at " + o.retireAge, short(r.need), r.need], ["You'll have", short(r.have), r.have], ["Extra SIP needed", r.gap > 0 ? inr(r.extraSip) : "—", r.extraSip], ["Savings last until", r.runsOut ? "Age " + r.runsOut : "Beyond " + o.lifeTo, 0]],
      sensTitle: "What if", sens: w3.map(function (w) { return [w.label, whatText(w)]; }), sensCurrent: 0,
      chartTitle: "Your savings by age", chartNote: "Savings you can draw on, building up until " + o.retireAge + " and drawn down after." + (rx ? " Second line: with the extra SIP." : ""), xlsxChartTitle: "Savings (₹ lakh)",
      chart: { series: series, cross: null }, chartYears: cats, chartXLabel: "Age", chartAge0: o.age,
      money: { title: "What you'll have at " + o.retireAge, cols: ["Amount", "Share"], rows: haveRows(r).map(function (x) { return [x[0], x[1], r.have ? (x[1] / r.have * 100).toFixed(1) + "%" : "—"]; }).concat([["You'll have", r.have, "100%", "total"], ["You need", r.need, ""], [r.gap > 0 ? "Gap" : "Surplus", Math.abs(r.gap), "", "total"]]), note: $("rpRule").textContent },
      tables: [{ title: "Year by year", sheet: "By year", cols: ["Age", "You put in (year)", "Spending (year)", "Pensions and income (year)", "Savings at the end"], yearly: r.rows.map(function (w) { return [String(w.age), w.put, w.spend, w.inc, w.total]; }), monthly: null }],
      notes: ["What you need: enough at retirement to pay your spending, rising with inflation, until the age you plan for, after pensions and other income, with the rest earning the return after retiring. Withdrawals at the start of each year.",
        "EPF and the EPS pension come from the EPF calculator's code (12% + 12% of PF wages, 8.33% of wages up to ₹25,000 to EPS, pension estimate at 58 or when you retire, if later).",
        "NPS comes from the NPS calculator's code: contributions until you retire, invested until 60 if you retire earlier, then the most allowed as a lump sum (80% for non-government subscribers) and an annuity at " + ANNUITY + "% from the rest.",
        "SIPs and NPS contributions rise once a year by the step-up you set. The extra SIP is the amount, rising the same way, that closes the gap at the mutual fund return.",
        "All figures are before tax. EPF and most of the NPS lump sum are tax-free; pensions, FD interest and part of mutual fund gains are taxable, so keep a margin."],
      taxRules: ["Pensions (EPS and NPS annuity) are taxed as income each year. NPS lump sum up to 60% of the corpus is tax-free (Income-tax Act, 2025, Schedule II, S. No. 6). EPF withdrawals after 5 years of continuous service are generally tax-free."],
      short: short, inr: inr
    };
  }
  function busy(b, on) { b.disabled = on; b.setAttribute("aria-busy", on ? "true" : "false"); }
  $("rpPdf").addEventListener("click", function () { var b = this; busy(b, true); say("Making your PDF…"); withReport(function (Kt) { Kt.pdf(spec()).then(function () { busy(b, false); say("PDF report downloaded."); }, function () { busy(b, false); say("Couldn't make the PDF. Please try again."); }); }); });
  $("rpXlsx").addEventListener("click", function () { var b = this; busy(b, true); withReport(function (Kt) { try { Kt.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(b, false); }); });
  $("rpShare").addEventListener("click", function () {
    var q = new URLSearchParams(); Object.keys(NUM).forEach(function (k) { q.set(k, S[k]); }); q.set("eps", S.eps ? "1" : "0");
    var t = location.origin + location.pathname + "?" + q.toString();
    function ok() { say("Link copied. Anyone with it sees these numbers."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { say("Couldn't copy. Copy the address bar instead."); }); else say("Copy the address bar to share.");
  });
  (function bar() {
    var el = $("rpBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("rpVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".rpx .lp-setup"));
    $("rpBarBtn").addEventListener("click", function () { $("rpVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
