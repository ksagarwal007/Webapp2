/* Salarist full and final settlement calculator. Runs entirely in the browser; nothing is stored or sent.
   Gratuity comes from the gratuity calculator's own code (gratuity.js). */
(function () {
  "use strict";
  var NODE = typeof module !== "undefined" && module.exports;
  var GR = NODE ? require("./gratuity.js") : window.SalaristGratuity;
  var LEAVE_CAP = 2500000;   /* ₹25 lakh: lifetime tax-free limit on leave encashment for non-government employees */

  /* ---------- Core ---------- */
  function parse(s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function iso(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function addMonths(s, n) { var d = parse(s), x = new Date(d.getFullYear(), d.getMonth() + n, d.getDate()); if (x.getDate() !== d.getDate()) x.setDate(0); return iso(x); }
  /* o: {join, leave (last working day), type "permanent"|"fixed", employer "covered"|"govt", basic (basic + DA a month), total (gross a month), avg10 (average basic + DA, last 10 months),
         divisor "month"|"30", balance (earned leave days), perYear (earned leave credited a year, days), encashOn "basic"|"gross", earlierLeave (leave encashment exemption used before, ₹),
         noticeReq, noticeServed (days), noticeOn "basic"|"gross", bonus, reimb, other (recoveries), pf (bool), slab (%), earlierGrat (₹)} */
  function calc(o) {
    var L = parse(o.leave), dim = new Date(L.getFullYear(), L.getMonth() + 1, 0).getDate(), days = L.getDate();
    var div = o.divisor === "30" ? 30 : dim, salary = o.total / div * Math.min(days, div);
    var basicEarned = o.basic / div * Math.min(days, div), pf = o.pf ? basicEarned * 0.12 : 0;
    /* Leave encashment and its tax-free part */
    var encBase = o.encashOn === "gross" ? o.total : o.basic, leaveAmt = o.balance * encBase / 30;
    var sv = GR.service(o.join, o.leave), yrsDone = sv.ok ? sv.y : 0;
    /* Tax counts leave at no more than 30 days for each completed year. If your company credits 30 days a year or less, your whole balance counts;
       above 30, the extra days credited each year are taken off. */
    var extra = Math.max(0, o.perYear - 30) * yrsDone, unavailed = Math.max(0, o.balance - extra), avg = o.avg10 || o.basic, credit = unavailed;
    var lim = { actual: leaveAmt, cap: Math.max(0, LEAVE_CAP - o.earlierLeave), tenMonths: 10 * avg, formula: unavailed * avg / 30 };
    var leaveFree = o.employer === "govt" ? leaveAmt : Math.min(lim.actual, lim.cap, lim.tenMonths, lim.formula);
    /* Gratuity, from gratuity.js */
    var g = GR.calc({ type: o.type, reason: "leave", employer: o.employer, basic: o.basic, total: o.total, avg10: avg, join: o.join, leave: o.leave, earlier: o.earlierGrat || 0 });
    /* Notice */
    var short = Math.max(0, o.noticeReq - o.noticeServed), notice = short * (o.noticeOn === "basic" ? o.basic : o.total) / 30;
    /* Totals. Recovered notice pay isn't taken off taxable income here (it's disputed), so tax may be slightly overstated. */
    var gross = salary + leaveAmt + o.bonus + o.reimb + g.grat;
    var taxable = salary + (leaveAmt - leaveFree) + o.bonus + g.taxable;
    var tax = taxable * o.slab / 100 * 1.04, rec = notice + pf + o.other;
    var wagesPart = salary + leaveAmt + o.bonus + o.reimb - notice - pf - o.other - tax;
    return { encBase: encBase, extra: extra, days: Math.min(days, div), div: div, salary: salary, pf: pf, leaveAmt: leaveAmt, leaveFree: leaveFree, leaveTax: leaveAmt - leaveFree, lim: lim, unavailed: unavailed, credit: credit, yrsDone: yrsDone,
             g: g, short: short, notice: notice, gross: gross, taxable: taxable, tax: tax, rec: rec, net: gross - rec - tax, wagesPart: wagesPart, sv: sv };
  }
  /* The same settlement if the last working day moved n months later (notice served in full is unchanged). */
  function later(o, n) { return calc(Object.assign({}, o, { leave: addMonths(o.leave, n) })); }
  if (NODE) { module.exports = { calc: calc, later: later, addMonths: addMonths, LEAVE_CAP: LEAVE_CAP }; return; }

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
  function dtxt(s) { return parse(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  function svTxt(sv) { return sv.y + (sv.y === 1 ? " year" : " years") + (sv.m ? ", " + sv.m + (sv.m === 1 ? " month" : " months") : ""); }
  var today = new Date(), defLeave = iso(new Date(today.getFullYear(), today.getMonth() + 1, 15)), defJoin = iso(new Date(today.getFullYear() - 4, today.getMonth() + 3, 1));
  var S = { join: defJoin, leave: defLeave, type: "permanent", employer: "covered", divisor: "month", encashOn: "basic", noticeOn: "gross", pf: true,
            basic: 60000, total: 120000, avg10: 60000, balance: 25, perYear: 24, earlierLeave: 0, noticeReq: 90, noticeServed: 75, bonus: 0, reimb: 0, other: 0, slab: 20, earlierGrat: 0 };
  var NUM = { basic: [1000, 1e8], total: [1000, 1e8], avg10: [0, 1e8], balance: [0, 1000], perYear: [0, 60], earlierLeave: [0, 2.5e6], noticeReq: [0, 365], noticeServed: [0, 365],
              bonus: [0, 1e9], reimb: [0, 1e8], other: [0, 1e9], slab: [0, 30], earlierGrat: [0, 2e6] };
  var MONEY = { basic: 1, total: 1, avg10: 1, earlierLeave: 1, bonus: 1, reimb: 1, other: 1, earlierGrat: 1 };
  var SEGS = { type: ["permanent", "fixed"], employer: ["covered", "govt"], divisor: ["month", "30"], encashOn: ["basic", "gross"], noticeOn: ["gross", "basic"] };
  var avgTouched = false;
  (function fromUrl() {
    var q = new URLSearchParams(location.search), re = /^\d{4}-\d{2}-\d{2}$/;
    Object.keys(NUM).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= NUM[k][0] && v <= NUM[k][1]) S[k] = v; });
    Object.keys(SEGS).forEach(function (k) { if (SEGS[k].indexOf(q.get(k)) > -1) S[k] = q.get(k); });
    ["join", "leave"].forEach(function (k) { if (re.test(q.get(k) || "")) S[k] = q.get(k); });
    if (q.get("pf") === "0") S.pf = false; if (q.has("avg10")) avgTouched = true;
  })();
  var shows = [];
  function bind(k) {
    var el = $("fs-" + k), note = $("fs-" + k + "-w"); if (!el) return;
    function show() { el.value = MONEY[k] ? fmt.format(S[k]) : String(S[k]); if (note) note.textContent = MONEY[k] ? words(S[k]) : ""; }
    el.addEventListener("input", function () {
      var raw = MONEY[k] ? this.value.replace(/[^0-9]/g, "") : this.value.replace(/[^0-9.]/g, "");
      if (MONEY[k]) this.value = raw ? fmt.format(+raw) : "";
      var v = parseFloat(raw); if (!isFinite(v)) { if (raw === "" && NUM[k][0] === 0) { S[k] = 0; render(); } return; }
      S[k] = Math.max(NUM[k][0], Math.min(NUM[k][1], v));
      if (k === "avg10") avgTouched = true; if (k === "basic" && !avgTouched) S.avg10 = S.basic;
      if (note) note.textContent = MONEY[k] ? words(S[k]) : ""; render();
    });
    el.addEventListener("blur", show); shows.push(function () { if (document.activeElement !== el) show(); }); show();
  }
  Object.keys(NUM).forEach(bind);
  ["join", "leave"].forEach(function (k) { var el = $("fs-" + k); el.value = S[k]; el.addEventListener("change", function () { if (this.value) { S[k] = this.value; render(); } }); });
  Object.keys(SEGS).forEach(function (k) { document.querySelectorAll("[data-" + k + "]").forEach(function (b) { b.addEventListener("click", function () { S[k] = b.getAttribute("data-" + k); render(); }); }); });
  document.querySelectorAll("[data-pf]").forEach(function (b) { b.addEventListener("click", function () { S.pf = b.getAttribute("data-pf") === "1"; render(); }); });
  function pressed(attr, val) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-" + attr) === String(val) ? "true" : "false"); }); }
  function payBy(s) { /* 2 working days after the last working day (Saturdays and Sundays skipped; holidays aren't known) */
    var d = parse(s), n = 0; while (n < 2) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n++; } return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  function plus30(s) { var d = parse(s); d.setDate(d.getDate() + 30); return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  var last = null, MONTHS = 12;
  function horizon() { /* 12 months, or up to the month gratuity becomes payable (at most 24) */
    var g = calc(S).g; if (g.eligible || !g.eligibleOn) return MONTHS;
    for (var m = 1; m <= 24; m++) if (later(S, m).g.eligible) return Math.max(MONTHS, m);
    return MONTHS;
  }
  function path12() { var a = [], h = horizon(); for (var m = 0; m <= h; m++) a.push(later(S, m).net); return a; }
  function chart(a) {
    var W = 420, Hh = 230, pl = 54, pr = 10, pt = 16, pb = 26, n = a.length, bw = (W - pl - pr) / n;
    var max = Math.max.apply(null, a.concat([1])), st = Math.pow(10, Math.floor(Math.log10(max / 4))), qq = max / 4 / st; st *= qq <= 1 ? 1 : qq <= 2 ? 2 : qq <= 2.5 ? 2.5 : qq <= 5 ? 5 : 10; max = st * 4;
    function yy(v) { return pt + (max - Math.max(0, v)) / max * (Hh - pt - pb); }
    var g = ""; for (var k = 0; k <= 4; k++) { var gy = yy(max * k / 4).toFixed(1); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+gy + 3) + '" class="al" text-anchor="end">' + short(max * k / 4) + "</text>"; }
    var bars = a.map(function (v, i) { var x = pl + i * bw + bw * .15, y = yy(v); return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw * .7).toFixed(1) + '" height="' + (Hh - pb - y).toFixed(1) + '" rx="3" class="' + (i ? "bar2" : "bar1") + '"/>' + (i % (n > 14 ? 4 : 2) === 0 ? '<text x="' + (x + bw * .35).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">' + (i ? "+" + i : "Now") + "</text>" : ""); }).join("");
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Settlement if you leave later">' + g + bars + "</svg>";
  }
  function rowsOf(r) {
    var R = [["Salary for " + r.days + " days of the last month", r.salary, 0, r.salary, "2 working days"],
      ["Leave encashment (" + S.balance + " days)", r.leaveAmt, r.leaveFree, r.leaveTax, "2 working days"]];
    if (S.bonus) R.push(["Bonus or variable pay due", S.bonus, 0, S.bonus, "2 working days"]);
    if (S.reimb) R.push(["Reimbursements due", S.reimb, S.reimb, 0, "2 working days"]);
    R.push(["Gratuity" + (r.g.eligible ? "" : " (not eligible yet)"), r.g.grat, r.g.exempt, r.g.taxable, r.g.eligible ? "30 days" : "—"]);
    return R;
  }
  function less(r) {
    var R = [];
    if (r.notice) R.push(["Notice shortfall: " + r.short + " days", r.notice]);
    if (r.pf) R.push(["Your PF on the last month's basic + DA (12%)", r.pf]);
    if (S.other) R.push(["Other recoveries (loans, assets, joining bonus)", S.other]);
    R.push(["Tax estimate at " + S.slab + "% + cess on the taxable part", r.tax]);
    return R;
  }
  function render() {
    Object.keys(SEGS).forEach(function (k) { pressed(k, S[k]); }); pressed("pf", S.pf ? "1" : "0");
    var r = calc(S); last = r;
    var bad = !r.sv.ok;
    $("fsVerdict").className = "verdict" + (r.net < 0 ? " short" : "");
    $("fsVerdict").innerHTML = bad ? '<p class="v">Your last working day must be after your joining date.</p>' :
      '<p class="k">Leaving on ' + dtxt(S.leave) + " after " + svTxt(r.sv) + '</p><p class="v">Your full and final settlement: about <b>' + inr(r.net) + "</b></p>" +
      '<p class="k">' + (r.g.eligible ? "Wages and leave by " + payBy(S.leave) + " (2 working days); gratuity of " + inr(r.g.grat) + " by " + plus30(S.leave) + "." : "Due by " + payBy(S.leave) + ", 2 working days after your last day.") + "</p>";
    $("fsS1").textContent = inr(r.gross); $("fsS1h").textContent = "Before recoveries and tax";
    $("fsS2").textContent = inr(r.rec); $("fsS2h").textContent = r.notice ? "Includes " + inr(r.notice) + " notice shortfall" : "PF and other recoveries";
    $("fsS3").textContent = inr(r.leaveFree + r.g.exempt + S.reimb); $("fsS3h").textContent = "Leave encashment, gratuity, reimbursements";
    $("fsS4").textContent = inr(r.tax); $("fsS4h").textContent = "At " + S.slab + "% + cess, estimate";
    var notes = [];
    var perDay = r.encBase / 30, L4 = [["What you receive", r.lim.actual], ["₹25 lakh lifetime limit, less what you've used", r.lim.cap], ["10 months' average basic + DA", r.lim.tenMonths], [Math.round(r.unavailed) + " days × average daily basic + DA" + (r.extra ? " (leave above 30 days a year left out)" : ""), r.lim.formula]];
    var lowest = L4.reduce(function (m, x) { return x[1] < m[1] ? x : m; });
    $("fsLeave").innerHTML = '<h3>Leave encashment</h3><p class="calcline">' + S.balance + " days × " + inr(perDay) + " a day = <b>" + inr(r.leaveAmt) + "</b></p>" +
      '<p class="split"><span>Tax-free <b>' + inr(r.leaveFree) + '</b></span><span>Taxable <b>' + inr(r.leaveTax) + "</b></span></p>" +
      (S.employer === "govt" ? '<p class="hint">Fully tax-free for Central and State Government employees.</p>' :
        '<p class="hint">Tax-free up to the lowest of these four:</p><ul class="lim">' + L4.map(function (x) { return "<li" + (x === lowest ? ' class="on"' : "") + "><span>" + x[0] + "</span><b>" + inr(x[1]) + (x === lowest ? " ← applies" : "") + "</b></li>"; }).join("") + "</ul>");
    $("fsNotice").innerHTML = '<h3>Notice period</h3>' + (r.short ? '<p class="calcline">' + r.short + " days short × " + inr((S.noticeOn === "basic" ? S.basic : S.total) / 30) + " a day = <b>−" + inr(r.notice) + '</b></p><p class="hint">Served ' + S.noticeServed + " of " + S.noticeReq + " days. Many employers waive or reduce this if you ask, or your new employer may buy it out.</p>"
      : '<p class="calcline"><b>Nothing recovered</b></p><p class="hint">You serve the full ' + S.noticeReq + " days.</p>");
    if (!r.g.eligible && r.g.eligibleOn) notes.push("<b>Gratuity:</b> you're eligible from " + r.g.eligibleOn.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) + ". Leaving then would add about " + inr(GR.calc({ type: S.type, reason: "leave", employer: S.employer, basic: S.basic, total: S.total, avg10: S.avg10, join: S.join, leave: iso(r.g.eligibleOn), earlier: S.earlierGrat }).grat) + '. See the <a href="/gratuity-calculator/">gratuity calculator</a>.');
    else if (r.g.eligible) notes.push("<b>Gratuity:</b> " + inr(r.g.grat) + " for " + r.g.yrs + ' counted years, worked out as in the <a href="/gratuity-calculator/">gratuity calculator</a>.');
    $("fsRule").innerHTML = notes.join("<br><br>"); $("fsRule").hidden = !notes.length;
    $("fsTable").innerHTML = '<table class="calc"><thead><tr><th>You get</th><th>Amount</th><th>Tax-free</th><th>Taxable</th><th>Due within</th></tr></thead><tbody>' +
      rowsOf(r).map(function (x) { return '<tr><th scope="row">' + x[0] + '</th><td data-l="Amount">' + inr(x[1]) + '</td><td data-l="Tax-free">' + inr(x[2]) + '</td><td data-l="Taxable">' + inr(x[3]) + '</td><td data-l="Due within">' + x[4] + "</td></tr>"; }).join("") +
      '<tr class="tot"><th scope="row"><b>Total due to you</b></th><td data-l="Amount"><b>' + inr(r.gross) + '</b></td><td data-l="Tax-free">' + inr(r.gross - r.taxable) + '</td><td data-l="Taxable">' + inr(r.taxable) + "</td><td></td></tr>" +
      less(r).map(function (x) { return '<tr><th scope="row">Less: ' + x[0] + '</th><td data-l="Amount">−' + inr(x[1]) + "</td><td></td><td></td><td></td></tr>"; }).join("") +
      '<tr class="tot"><th scope="row"><b>You receive</b></th><td data-l="Amount"><b>' + inr(r.net) + "</b></td><td></td><td></td><td></td></tr></tbody></table>";
    var a = path12(); r.path = a; $("fsChart").innerHTML = chart(a);
    var full = calc(Object.assign({}, S, { noticeServed: Math.max(S.noticeServed, S.noticeReq) }));
    r.what = [["As planned", r.net, ""], ["Serve the full notice", full.net, r.short ? "No recovery of " + inr(r.notice) : "Already served"], ["Leave a month later", a[1], "Settlement only"]];
    if (!r.g.eligible && r.g.eligibleOn) {
      var mo = 0; while (mo < 36 && later(S, mo).g.eligible === false) mo++;
      if (mo < 36) r.what.splice(2, 0, ["Stay until gratuity (" + mo + " months)", later(S, mo).net, "Gratuity becomes payable"]);
    }
    $("fsSens").innerHTML = r.what.map(function (w, i) { return '<div class="sv' + (i === 0 ? " cur" : "") + '"><span class="l">' + w[0] + '</span><span class="n">' + inr(w[1]) + '</span><span class="h">' + w[2] + "</span></div>"; }).join("");
    $("fsBarT").textContent = "Settlement " + inr(r.net);
    shows.forEach(function (f) { f(); });
  }

  /* ---------- Reports ---------- */
  function say(m) { var s = $("fsStatus"); s.textContent = m; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function spec() {
    var r = last, data = [], cats = [];
    r.path.forEach(function (v, i) { cats.push(i); for (var m = 0; m < (i ? 12 : 1); m++) data.push(v); });
    return {
      title: "Full and Final Settlement Report", path: "salarist.in/full-and-final-settlement", url: location.origin + location.pathname, file: "salarist-full-and-final",
      question: "What will my full and final settlement be?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#fsVerdict p"), function (x) { return x.textContent; }), verdictColor: "blue",
      inputs: [["Joined on", dtxt(S.join)], ["Last working day", dtxt(S.leave)], ["Employment", S.type === "fixed" ? "Fixed-term" : "Permanent"], ["Employer", S.employer === "govt" ? "Government" : "Private"],
        ["Basic + DA a month", inr(S.basic), S.basic], ["Gross pay a month", inr(S.total), S.total], ["Average basic + DA, last 10 months", inr(S.avg10), S.avg10],
        ["Last month's pay worked out on", S.divisor === "30" ? "30 days" : "Days in the month"], ["Earned leave balance", S.balance + " days"], ["Earned leave you get each year", S.perYear + " days"],
        ["Leave encashed on", S.encashOn === "gross" ? "Gross pay" : "Basic + DA"], ["Leave encashment exemption used before", inr(S.earlierLeave), S.earlierLeave],
        ["Notice required / served", S.noticeReq + " / " + S.noticeServed + " days"], ["Notice recovered on", S.noticeOn === "basic" ? "Basic + DA" : "Gross pay"],
        ["Bonus or variable pay due", inr(S.bonus), S.bonus], ["Reimbursements due", inr(S.reimb), S.reimb], ["Other recoveries", inr(S.other), S.other], ["PF on the last month", S.pf ? "Yes" : "No"], ["Tax slab for the estimate", S.slab + "%"]],
      keyNums: [["You receive", inr(r.net), r.net], ["Total due to you", inr(r.gross), r.gross], ["Tax-free", inr(r.gross - r.taxable), r.gross - r.taxable], ["Recoveries and tax", inr(r.rec + r.tax), r.rec + r.tax]],
      sensTitle: "What if", sens: r.what.slice(0, 3).map(function (w) { return [w[0], inr(w[1])]; }), sensCurrent: 0,
      chartTitle: "Settlement if your last day moves later", chartNote: "Settlement amount only; salary for the extra months is paid as usual.", xlsxChartTitle: "Settlement (₹ lakh)",
      chart: { series: [{ name: "Settlement", color: "blue", data: data }], cross: null }, chartYears: cats, chartXLabel: "Months later", chartAge0: 0,
      money: { title: "Your settlement", cols: ["Amount", "Tax-free"], rows: rowsOf(r).map(function (x) { return [x[0], x[1], inr(x[2])]; }).concat([["Total due to you", r.gross, inr(r.gross - r.taxable), "total"]])
        .concat(less(r).map(function (x) { return ["Less: " + x[0], -x[1], ""]; })).concat([["You receive", r.net, "", "total"]]), note: $("fsLeave").textContent.replace("Leave encashment", "Leave encashment: ").replace(" ← applies", " (applies)") + " " + $("fsRule").textContent },
      tables: [{ title: "Settlement by last working day", sheet: "By month", cols: ["Last working day", "Gratuity", "Settlement"], yearly: r.path.map(function (v, i) { var x = later(S, i); return [dtxt(addMonths(S.leave, i)) + (i ? " (+" + i + ")" : ""), x.g.grat, v]; }), monthly: null }],
      notes: ["Last month's salary: gross pay ÷ " + (S.divisor === "30" ? "30" : "days in the month") + " × days worked. Leave encashment: leave balance × monthly " + (S.encashOn === "gross" ? "gross pay" : "basic + DA") + " ÷ 30. Your employer's policy decides both.",
        "Leave encashment tax-free part (non-government): the lowest of the amount received, ₹25 lakh less exemption used before, 10 months' average basic + DA, and your leave balance (counting no more than 30 days of leave a year) × average monthly basic + DA ÷ 30 (Income-tax Act, 2025, section 19).",
        "Gratuity from the gratuity calculator's code: Code on Social Security, 2020, wages of at least half of total pay, 15/26 × wages × years.",
        "Notice shortfall: days short × monthly " + (S.noticeOn === "basic" ? "basic + DA" : "gross pay") + " ÷ 30. Tax is estimated on the taxable part at your slab plus 4% cess, without taking off the notice recovery.",
        "Wages, leave encashment and other dues are due within 2 working days of your last day (Code on Wages, 2019, section 17(2)); gratuity within 30 days."],
      taxRules: ["Leave encashment on leaving: tax-free part under section 19 of the Income-tax Act, 2025 (₹25 lakh lifetime limit for non-government employees). Gratuity: tax-free up to ₹20 lakh in a lifetime. Salary, bonus and the taxable parts are added to your income for the year."],
      short: short, inr: inr
    };
  }
  function busy(b, on) { b.disabled = on; b.setAttribute("aria-busy", on ? "true" : "false"); }
  $("fsPdf").addEventListener("click", function () { var b = this; busy(b, true); say("Making your PDF…"); withReport(function (Kt) { Kt.pdf(spec()).then(function () { busy(b, false); say("PDF report downloaded."); }, function () { busy(b, false); say("Couldn't make the PDF. Please try again."); }); }); });
  $("fsXlsx").addEventListener("click", function () { var b = this; busy(b, true); withReport(function (Kt) { try { Kt.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(b, false); }); });
  $("fsShare").addEventListener("click", function () {
    var q = new URLSearchParams(); Object.keys(NUM).forEach(function (k) { q.set(k, S[k]); }); Object.keys(SEGS).forEach(function (k) { q.set(k, S[k]); }); q.set("join", S.join); q.set("leave", S.leave); q.set("pf", S.pf ? "1" : "0");
    var t = location.origin + location.pathname + "?" + q.toString();
    function ok() { say("Link copied. Anyone with it sees these numbers."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { say("Couldn't copy. Copy the address bar instead."); }); else say("Copy the address bar to share.");
  });
  (function bar() {
    var el = $("fsBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("fsVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".fsx .lp-setup"));
    $("fsBarBtn").addEventListener("click", function () { $("fsVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
