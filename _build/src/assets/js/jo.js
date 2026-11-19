/* Salarist job offer comparator. Runs entirely in the browser; nothing is stored or sent.
   Tax from the NPS calculator's code (nps.js, new regime). */
(function () {
  "use strict";
  var NODE = typeof module !== "undefined" && module.exports;
  var NPS = NODE ? require("./nps.js") : window.SalaristNPS;
  var CEIL = 25000, GCAP = 2000000, WEEKS = 48;

  /* ---------- Core ---------- */
  function pfw(b, basis) { return basis === "capped" ? Math.min(b, CEIL) : b; }
  /* Gratuity on leaving after s years (permanent, covered employer): 5 years, then a part-year over 6 months counts; wages at least half of pay. */
  function grat(s, basic, gross) {
    if (s < 5) return 0;
    var y = Math.floor(s + 1e-9), f = s - y, yrs = y + (f > 0.5 ? 1 : 0);
    return Math.min(GCAP, 15 / 26 * Math.max(basic, gross / 2) * yrs);
  }
  /* One year in a job. j: {basic, hra, other (a month), pf, variable (a year, full), payout (%), bonus (joining, year 1 only), stock (a year), hike (%),
     office (days a week), commute (₹ a day, both ways), hours (a day), wfhAllow, wfhCost (a month)}; y = 1, 2, ... */
  function year(o, j, y, isNew) {
    var g = Math.pow(1 + j.hike / 100, y - 1), basic = j.basic * g, gross = (j.basic + j.hra + j.other) * g;
    var emp = 0.12 * pfw(basic, j.pf), own = emp, variable = j.variable * g * j.payout / 100, bonus = isNew && y === 1 ? j.bonus : 0;
    var allow = j.wfhAllow * 12, taxable = gross * 12 + variable + bonus + j.stock + allow;
    var tax = NPS.newTax(Math.max(0, taxable - 75000));
    var cash = gross * 12 + allow - own * 12 + variable + bonus + j.stock - tax;   /* everything you get after tax, stock at vest value */
    var days = j.office * WEEKS, commute = days * j.commute, hours = days * j.hours, wfh = j.wfhCost * 12;
    var monthly = gross - own - NPS.newTax(Math.max(0, gross * 12 + allow - 75000)) / 12;   /* fixed pay only */
    return { y: y, basic: basic, gross: gross, own: own, emp: emp, pf: (own + emp) * 12, variable: variable, bonus: bonus, stock: j.stock, allow: allow, tax: tax, cash: cash,
             commute: commute, wfh: wfh, hours: hours, time: hours * o.timeValue, monthly: monthly,
             net: cash + (own + emp) * 12 - commute - wfh - hours * o.timeValue };
  }
  /* o: {a (current job), b (new offer), years (compare over), done (years at current job so far), claw (joining bonus you'd repay), notice (notice pay you'd bear), timeValue (₹ an hour)} */
  function calc(o) {
    var N = Math.max(1, Math.round(o.years)), A = [], B = [];
    for (var y = 1; y <= N; y++) { A.push(year(o, o.a, y, false)); B.push(year(o, o.b, y, true)); }
    var la = A[N - 1], lb = B[N - 1];
    var gStay = grat(o.done + N, la.basic, la.gross);                       /* stay: gratuity when you leave after N more years */
    var gNow = grat(o.done, o.a.basic, o.a.basic + o.a.hra + o.a.other);       /* switch: gratuity from the current job now */
    var gNew = grat(N, lb.basic, lb.gross);                                   /* switch: gratuity from the new job after N years */
    function sum(L, k) { return L.reduce(function (s, x) { return s + x[k]; }, 0); }
    var stay = { cash: sum(A, "cash"), pf: sum(A, "pf"), grat: gStay, costs: sum(A, "commute") + sum(A, "wfh"), time: sum(A, "time"), hours: sum(A, "hours"), one: 0 };
    var sw = { cash: sum(B, "cash"), pf: sum(B, "pf"), grat: gNow + gNew, costs: sum(B, "commute") + sum(B, "wfh"), time: sum(B, "time"), hours: sum(B, "hours"), one: o.claw + o.notice };
    [stay, sw].forEach(function (s) { s.total = s.cash + s.pf + s.grat - s.costs - s.time - s.one; });
    /* Gratuity at the current job: when it becomes payable, and what leaving now gives up */
    var gAt5 = o.done < 5 ? grat(5, o.a.basic * Math.pow(1 + o.a.hike / 100, Math.max(0, Math.ceil(5 - o.done) - 1)), (o.a.basic + o.a.hra + o.a.other) * Math.pow(1 + o.a.hike / 100, Math.max(0, Math.ceil(5 - o.done) - 1))) : 0;
    var cumA = [0], cumB = [-(o.claw + o.notice) + gNow];
    A.forEach(function (x, i) { cumA.push(cumA[i] + x.net); }); B.forEach(function (x, i) { cumB.push(cumB[i] + x.net); });
    cumA[N] += gStay; cumB[N] += gNew;
    return { N: N, A: A, B: B, stay: stay, sw: sw, diff: sw.total - stay.total, gNow: gNow, gStay: gStay, gNew: gNew, gAt5: gAt5, toFive: Math.max(0, 5 - o.done), cumA: cumA, cumB: cumB };
  }
  var API = { calc: calc, year: year, grat: grat };
  if (NODE) { module.exports = API; return; }
  window.SalaristOffer = API;
  if (!document.getElementById("joVerdict")) return;

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
  var JOB = ["basic", "hra", "other", "variable", "payout", "bonus", "stock", "hike", "office", "commute", "hours", "wfhAllow", "wfhCost"];
  var S = { years: 3, done: 4.5, claw: 0, notice: 0, timeValue: 0, wm: "on",
    a: { basic: 50000, hra: 25000, other: 45000, pf: "full", variable: 150000, payout: 80, bonus: 0, stock: 0, hike: 8, office: 2, commute: 400, hours: 1.5, wfhAllow: 0, wfhCost: 1500 },
    b: { basic: 60000, hra: 30000, other: 60000, pf: "capped", variable: 200000, payout: 70, bonus: 150000, stock: 100000, hike: 7, office: 5, commute: 600, hours: 2, wfhAllow: 0, wfhCost: 0 } };
  var LIM = { basic: [0, 1e8], hra: [0, 1e8], other: [0, 1e8], variable: [0, 1e9], payout: [0, 200], bonus: [0, 1e9], stock: [0, 1e9], hike: [0, 50], office: [0, 7], commute: [0, 1e5], hours: [0, 12], wfhAllow: [0, 1e6], wfhCost: [0, 1e6],
              years: [1, 10], done: [0, 40], claw: [0, 1e9], notice: [0, 1e9], timeValue: [0, 1e5] };
  var MONEY = { basic: 1, hra: 1, other: 1, variable: 1, bonus: 1, stock: 1, commute: 1, wfhAllow: 1, wfhCost: 1, claw: 1, notice: 1, timeValue: 1 };
  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    function num(key, lim) { var v = parseFloat(q.get(key)); return isFinite(v) && v >= lim[0] && v <= lim[1] ? v : null; }
    ["a", "b"].forEach(function (s) { JOB.forEach(function (k) { var v = num(s + "_" + k, LIM[k]); if (v !== null) S[s][k] = v; }); var pf = q.get(s + "_pf"); if (pf === "full" || pf === "capped") S[s].pf = pf; });
    ["years", "done", "claw", "notice", "timeValue"].forEach(function (k) { var v = num(k, LIM[k]); if (v !== null) S[k] = v; });
    if (q.get("wm") === "off") S.wm = "off";
  })();
  var shows = [];
  function bind(id, get, set, k) {
    var el = $(id), note = $(id + "-w"); if (!el) return;
    function show() { el.value = MONEY[k] ? fmt.format(get()) : String(get()); if (note) note.textContent = MONEY[k] ? words(get()) : ""; }
    el.addEventListener("input", function () {
      var raw = MONEY[k] ? this.value.replace(/[^0-9]/g, "") : this.value.replace(/[^0-9.]/g, "");
      if (MONEY[k]) this.value = raw ? fmt.format(+raw) : "";
      var v = parseFloat(raw); if (!isFinite(v)) { if (raw === "") { set(0); render(); } return; }
      if (v < LIM[k][0] || v > LIM[k][1]) return;
      set(v); if (note) note.textContent = MONEY[k] ? words(v) : ""; render();
    });
    el.addEventListener("blur", show); shows.push(function () { if (document.activeElement !== el) show(); }); show();
  }
  ["a", "b"].forEach(function (s) { JOB.forEach(function (k) { bind("jo-" + s + "-" + k, function () { return S[s][k]; }, function (v) { S[s][k] = v; }, k); }); });
  ["years", "done", "claw", "notice", "timeValue"].forEach(function (k) { bind("jo-" + k, function () { return S[k]; }, function (v) { S[k] = v; }, k); });
  document.querySelectorAll("[data-pf]").forEach(function (b) { b.addEventListener("click", function () { var p = b.getAttribute("data-pf").split(":"); S[p[0]].pf = p[1]; render(); }); });
  document.querySelectorAll("[data-wm]").forEach(function (b) { b.addEventListener("click", function () { S.wm = b.getAttribute("data-wm"); render(); }); });
  function opts(ch) {
    var o = { a: Object.assign({}, S.a), b: Object.assign({}, S.b), years: S.years, done: S.done, claw: S.claw, notice: S.notice, timeValue: S.wm === "on" ? S.timeValue : 0 };
    if (S.wm === "off") ["a", "b"].forEach(function (s) { o[s].office = 0; o[s].commute = 0; o[s].hours = 0; o[s].wfhAllow = 0; o[s].wfhCost = 0; });
    return ch ? ch(o) || o : o;
  }
  var last = null;
  function chart(r) {
    var A = r.cumA, B = r.cumB, n = r.N, W = 420, Hh = 230, pl = 54, pr = 12, pt = 16, pb = 26;
    var all = A.concat(B), mx = Math.max.apply(null, all), mn = Math.min(0, Math.min.apply(null, all)), span = mx - mn || 1;
    var st = Math.pow(10, Math.floor(Math.log10(span / 4))), qq = span / 4 / st; st *= qq <= 1 ? 1 : qq <= 2 ? 2 : qq <= 2.5 ? 2.5 : qq <= 5 ? 5 : 10;
    mn = Math.floor(mn / st) * st; mx = mn + st * Math.ceil((mx - mn) / st);
    function x(i) { return pl + i / n * (W - pl - pr); } function yy(v) { return pt + (mx - v) / (mx - mn) * (Hh - pt - pb); }
    var g = ""; for (var v = mn; v <= mx + 1; v += st) { var gy = yy(v).toFixed(1); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+gy + 3) + '" class="al" text-anchor="end">' + short(v) + "</text>"; }
    var xl = ""; for (var t = 0; t <= n; t++) xl += '<text x="' + x(t).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">' + (t ? "Yr " + t : "Now") + "</text>";
    function path(L) { return L.map(function (z, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(z).toFixed(1); }).join(""); }
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="What each choice is worth, year by year">' + g + xl + '<path d="' + path(A) + '" class="ln buy"/><path d="' + path(B) + '" class="ln rent"/></svg>';
  }
  function rows(r) {
    var a = r.stay, b = r.sw;
    return [["Take-home after tax (salary, variable, bonus)", a.cash - sumK(r.A, "stock"), b.cash - sumK(r.B, "stock")], ["Stock that vests", sumK(r.A, "stock"), sumK(r.B, "stock")],
      ["PF, yours + employer's", a.pf, b.pf], ["Gratuity", a.grat, b.grat], ["Commute and work-from-home costs", -a.costs, -b.costs]]
      .concat(S.wm === "on" && S.timeValue > 0 ? [["Commute time at " + inr(S.timeValue) + " an hour", -a.time, -b.time]] : [])
      .concat([["Switching costs (repaid bonus, notice pay)", 0, -b.one], ["What it's worth", a.total, b.total, "tot"]]);
  }
  function sumK(L, k) { return L.reduce(function (s, x) { return s + x[k]; }, 0); }
  function render() {
    document.querySelectorAll("[data-pf]").forEach(function (b) { var p = b.getAttribute("data-pf").split(":"); b.setAttribute("aria-pressed", S[p[0]].pf === p[1] ? "true" : "false"); });
    document.querySelectorAll("[data-wm]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-wm") === S.wm ? "true" : "false"); });
    $("joWm").hidden = S.wm !== "on";
    var r = calc(opts()); last = r; var a1 = r.A[0], b1 = r.B[0], better = r.diff >= 0, yrs = r.N + (r.N === 1 ? " year" : " years");
    $("joVerdict").className = "verdict" + (better ? "" : " short");
    $("joVerdict").innerHTML = '<p class="k">Over ' + yrs + ", counting take-home, PF, gratuity, stock" + (S.wm === "on" ? " and commute" : "") + '</p><p class="v">' +
      (better ? "The new offer is worth <b>" + short(r.diff) + "</b> more" : "Staying is worth <b>" + short(-r.diff) + "</b> more") + "</p>" +
      '<p class="k">In hand each month: ' + inr(a1.monthly) + " now vs " + inr(b1.monthly) + " (" + (b1.monthly >= a1.monthly ? "+" : "") + inr(b1.monthly - a1.monthly) + ")" +
      (r.toFive > 0 && r.gNow === 0 ? ". Leaving now gives up gratuity of about " + short(r.gAt5) + " you'd get " + (r.toFive <= 1 ? "in " + Math.round(r.toFive * 12) + " months" : "after " + r.toFive.toFixed(1) + " more years") + "." : ".") + "</p>";
    $("joS1").textContent = inr(b1.monthly - a1.monthly); $("joS1h").textContent = "More in hand a month (fixed pay)";
    $("joS2").textContent = short(r.diff); $("joS2h").textContent = "New offer vs staying, over " + yrs;
    $("joS3").textContent = short(b1.cash + b1.pf - a1.cash - a1.pf); $("joS3h").textContent = "Year 1, before commute";
    $("joS4").textContent = S.wm === "on" ? Math.round((b1.hours - a1.hours)) + " h" : "—"; $("joS4h").textContent = S.wm === "on" ? "More commuting a year (" + S.b.office + " vs " + S.a.office + " days a week)" : "Office and home costs off";
    $("joChart").innerHTML = chart(r);
    $("joCmp").innerHTML = '<table class="calc"><thead><tr><th>Over ' + yrs + '</th><th>Stay</th><th>Switch</th></tr></thead><tbody>' + rows(r).map(function (x) {
      return "<tr" + (x[3] ? ' class="tot"' : "") + '><th scope="row">' + x[0] + '</th><td data-l="Stay">' + inr(x[1]) + '</td><td data-l="Switch">' + inr(x[2]) + "</td></tr>"; }).join("") + "</tbody></table>";
    $("joY1").innerHTML = '<table class="calc"><thead><tr><th>Year 1, a month</th><th>Current job</th><th>New offer</th></tr></thead><tbody>' +
      [["Gross pay", a1.gross, b1.gross], ["Your PF", a1.own, b1.own], ["Employer PF", a1.emp, b1.emp], ["Income tax on fixed pay", a1.gross - a1.own - a1.monthly, b1.gross - b1.own - b1.monthly], ["In hand (fixed pay)", a1.monthly, b1.monthly, "tot"],
       ["Variable pay you expect (a year)", a1.variable, b1.variable], ["Joining bonus", 0, b1.bonus], ["Stock vesting (a year)", a1.stock, b1.stock]]
        .concat(S.wm === "on" ? [["Commute cost (a year)", a1.commute, b1.commute], ["Commute time (hours a year)", a1.hours, b1.hours, "h"], ["Work-from-home costs (a year)", a1.wfh, b1.wfh]] : [])
        .map(function (x) { var f = x[3] === "h" ? function (v) { return Math.round(v) + " h"; } : inr; return "<tr" + (x[3] === "tot" ? ' class="tot"' : "") + '><th scope="row">' + x[0] + '</th><td data-l="Current">' + f(x[1]) + '</td><td data-l="New">' + f(x[2]) + "</td></tr>"; }).join("") + "</tbody></table>";
    var notes = [];
    if (r.toFive > 0) notes.push(r.gNow === 0 ? "<b>Gratuity:</b> you've done " + S.done + " years. Gratuity is paid only after 5 years, so leaving now gives up about " + short(r.gAt5) + ". " + (r.toFive <= 1 ? "Can you join after " + Math.round(r.toFive * 12) + " more months? <a href=\"/best-day-to-resign/\">Find your best day to resign</a>." : "")
      : "<b>Gratuity:</b> you'd take " + short(r.gNow) + " from your current job.");
    else notes.push("<b>Gratuity:</b> leaving now pays " + short(r.gNow) + "; staying " + yrs + " more pays " + short(r.gStay) + ". At the new job, gratuity starts again from zero" + (r.N >= 5 ? "." : " and needs 5 years, so none is counted over " + yrs + "."));
    if (S.b.pf === "capped" && S.a.pf === "full") notes.push("<b>PF:</b> the new offer caps PF at ₹25,000 wages, so more comes as cash now and less goes into EPF.");
    if (S.b.bonus > 0) notes.push("<b>Joining bonus:</b> " + inr(S.b.bonus) + " in year 1, usually repayable if you leave within a year. <a href=\"/guides/joining-bonus-clawback/\">How clawbacks work</a>.");
    notes.push("<b>Variable pay</b> is counted at the payout you expect: " + S.a.payout + "% now, " + S.b.payout + "% at the new job.");
    $("joRule").innerHTML = notes.join("<br><br>");
    function alt(ch) { var rr = calc(opts(ch)); return (rr.diff >= 0 ? "Switch +" : "Stay +") + short(Math.abs(rr.diff)); }
    r.what = [["Variable pay 50% at both", alt(function (o) { o.a.payout = 50; o.b.payout = 50; })], ["New job's rise 2% lower", alt(function (o) { o.b.hike = Math.max(0, o.b.hike - 2); })],
      ["Commute time at ₹500 an hour", alt(function (o) { o.timeValue = S.wm === "on" ? 500 : 0; })], ["Compare over 5 years", alt(function (o) { o.years = 5; })]];
    $("joSens").innerHTML = r.what.map(function (w) { return '<div class="sv"><span class="l">' + w[0] + '</span><span class="n">' + w[1] + "</span></div>"; }).join("");
    $("joBarT").textContent = (better ? "Switch: +" : "Stay: +") + short(Math.abs(r.diff));
    shows.forEach(function (f) { f(); });
  }

  /* ---------- Reports ---------- */
  function say(m) { var s = $("joStatus"); s.textContent = m; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function spec() {
    var r = last, cats = [], da = [], db = [];
    for (var i = 0; i <= r.N; i++) { cats.push(i); for (var m = i ? 1 : 0; m <= (i ? 12 : 0); m++) { var pa = i ? r.cumA[i - 1] : 0, pb = i ? r.cumB[i - 1] : r.cumB[0]; da.push(i ? pa + (r.cumA[i] - pa) * m / 12 : 0); db.push(i ? pb + (r.cumB[i] - pb) * m / 12 : r.cumB[0]); } }
    function job(s, label) { var j = S[s]; return [[label + ": basic + DA / HRA / other a month", inr(j.basic) + " / " + inr(j.hra) + " / " + inr(j.other)], [label + ": PF", j.pf === "capped" ? "Capped at ₹25,000 wages" : "On full basic"],
      [label + ": variable pay a year (expected payout)", inr(j.variable) + " (" + j.payout + "%)"], [label + ": stock a year / pay rise", inr(j.stock) + " / " + j.hike + "%"]]
      .concat(s === "b" ? [["New offer: joining bonus", inr(j.bonus)]] : []).concat(S.wm === "on" ? [[label + ": office days, commute a day", j.office + " days, " + inr(j.commute) + ", " + j.hours + " h"]] : []); }
    return {
      title: "Job Offer Comparison", path: "salarist.in/job-offer-comparator", url: location.origin + location.pathname, file: "salarist-job-offer",
      question: "Is the new offer really worth more than my current job?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#joVerdict p"), function (x) { return x.textContent; }), verdictColor: r.diff >= 0 ? "blue" : "amber",
      inputs: job("a", "Current").concat(job("b", "New offer"), [["Years at current job", String(S.done)], ["Compare over", r.N + " years"], ["Joining bonus you'd repay / notice pay you'd bear", inr(S.claw) + " / " + inr(S.notice)]]),
      keyNums: [["More in hand a month", inr(r.B[0].monthly - r.A[0].monthly), 0], ["New offer vs staying", short(r.diff), r.diff], ["Year 1, before commute", short(r.B[0].cash + r.B[0].pf - r.A[0].cash - r.A[0].pf), 0], ["Gratuity given up", r.gNow === 0 && r.toFive > 0 ? short(r.gAt5) : "—", 0]],
      sensTitle: "What if", sens: r.what.slice(0, 3), sensCurrent: -1,
      chartTitle: "What each choice is worth, year by year", chartNote: "Running total of take-home, PF, stock and gratuity, less commute and switching costs. Blue: switch. Amber: stay. Gratuity is added when it's paid.", xlsxChartTitle: "Running total (₹ lakh)",
      chart: { series: [{ name: "Switch", color: "blue", data: db }, { name: "Stay", color: "amber", data: da }], cross: null }, chartYears: cats, chartXLabel: "Year",
      money: { title: "Over " + r.N + " years", cols: ["Switch", "Stay"], rows: rows(r).map(function (x) { return [x[0], x[2], inr(x[1]), x[3] ? "total" : undefined]; }), note: $("joRule").textContent },
      tables: [{ title: "Year by year", sheet: "By year", cols: ["Year", "Stay: in hand a year", "Switch: in hand a year", "Stay: PF", "Switch: PF", "Stay: tax", "Switch: tax"],
        yearly: r.A.map(function (x, i) { var y = r.B[i]; return [String(i + 1), x.cash, y.cash, x.pf, y.pf, x.tax, y.tax]; }), monthly: null,
        noteTitle: "How this is worked out", note: ["In hand a year: salary, variable pay at the payout you expect, joining bonus (year 1) and stock at vest value, less your PF and income tax (new regime, ₹75,000 standard deduction).",
          "Pay, variable pay and stock rise each year by each job's pay rise. Gratuity: paid after 5 years' service; at the current job it counts the years you've done."] }],
      notes: ["Tax: new regime for tax year 2026-27 (section 202 rates, ₹75,000 standard deduction, section 156 rebate), on salary, variable pay, joining bonus and stock; professional tax and surcharge left out.",
        "PF: 12% from you and your employer, on basic + DA or on wages capped at ₹25,000. Counted as value, since it's yours with interest later.",
        "Gratuity: 15/26 × wages × years, with wages at least half of pay (labour codes), paid after 5 years; a part-year over 6 months counts once you qualify. ₹20 lakh limit.",
        S.wm === "on" ? "Commute: office days × " + WEEKS + " weeks a year × daily cost; hours the same way" + (S.timeValue ? ", valued at " + inr(S.timeValue) + " an hour." : ", not valued in money.") : "Office and home costs left out."],
      taxRules: ["Income-tax Act, 2025: salary, bonus and stock (perquisite at vest) taxed at slab rates; employer PF within ₹7.5 lakh a year (with NPS and superannuation) not taxed; gratuity tax-free up to ₹20 lakh."],
      short: short, inr: inr
    };
  }
  function busy(b, on) { b.disabled = on; b.setAttribute("aria-busy", on ? "true" : "false"); }
  $("joPdf").addEventListener("click", function () { var b = this; busy(b, true); say("Making your PDF…"); withReport(function (Kt) { Kt.pdf(spec()).then(function () { busy(b, false); say("PDF report downloaded."); }, function () { busy(b, false); say("Couldn't make the PDF. Please try again."); }); }); });
  $("joXlsx").addEventListener("click", function () { var b = this; busy(b, true); withReport(function (Kt) { try { Kt.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(b, false); }); });
  $("joShare").addEventListener("click", function () {
    var q = new URLSearchParams(); ["a", "b"].forEach(function (s) { JOB.forEach(function (k) { q.set(s + "_" + k, S[s][k]); }); q.set(s + "_pf", S[s].pf); });
    ["years", "done", "claw", "notice", "timeValue", "wm"].forEach(function (k) { q.set(k, S[k]); });
    var t = location.origin + location.pathname + "?" + q.toString();
    function ok() { say("Link copied. Anyone with it sees these numbers."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { say("Couldn't copy. Copy the address bar instead."); }); else say("Copy the address bar to share.");
  });
  (function bar() {
    var el = $("joBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("joVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".jox .lp-setup"));
    $("joBarBtn").addEventListener("click", function () { $("joVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
