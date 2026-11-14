/* Salarist EPF calculator. Runs entirely in the browser; nothing is stored or sent. */
(function () {
  "use strict";
  var CEIL = 25000, OLD_CEIL = 15000, EPS_PCT = 8.33, CESS = 1.04, OWN_LIMIT = 250000, CAP = 750000, SUPER = 58;

  /* ---------- Core ---------- */
  /* o: {age, retireAge, balance, wage (PF wages a month now), basis ("full"|"capped"), eps (bool), epsYears (EPS service so far),
         vpf (% of wages), hike (% a year), rate (% a year), infl, slab}
     Interest is worked out on the monthly running balance at rate/12 and credited once a year, as EPFO does. */
  function plan(o) {
    var years = Math.max(0, Math.round(o.retireAge - o.age)), bal = o.balance, wage = o.wage, rows = [];
    var putOwn = 0, putEmp = 0, putEps = 0, intTot = 0, taxAcc = 0, taxIntTot = 0, r = o.rate / 100;
    for (var y = 1; y <= years; y++) {
      var pfWage = o.basis === "capped" ? Math.min(wage, CEIL) : wage, ageNow = o.age + y - 1;
      var epsM = o.eps && ageNow < SUPER ? Math.min(wage, CEIL) * EPS_PCT / 100 : 0;
      var ownM = pfWage * 0.12 + wage * o.vpf / 100, empM = pfWage * 0.12 - epsM;
      var intY = 0, taxIntY = 0, own12 = 0;
      for (var m = 0; m < 12; m++) {
        own12 += ownM; bal += ownM + empM;
        var over = Math.max(0, own12 - OWN_LIMIT);   /* own contributions above ₹2.5 lakh this year go to the taxable account */
        intY += bal * r / 12; taxIntY += (taxAcc + over) * r / 12;
      }
      var ownY = ownM * 12, empY = empM * 12, epsY = epsM * 12, overY = Math.max(0, ownY - OWN_LIMIT);
      taxAcc += overY + taxIntY;  /* the taxable account keeps earning interest that is taxable */
      bal += intY; putOwn += ownY; putEmp += empY; putEps += epsY; intTot += intY; taxIntTot += taxIntY;
      rows.push({ y: y, age: o.age + y, wage: wage, own: ownY, emp: empY, eps: epsY, interest: intY, taxInt: taxIntY, bal: bal, empTotal: pfWage * 0.12 * 12 });
      wage *= 1 + o.hike / 100;
    }
    var t = o.slab / 100 * CESS, defl = Math.pow(1 + o.infl / 100, years);
    return { years: years, corpus: bal, real: bal / defl, putOwn: putOwn, putEmp: putEmp, putEps: putEps, interest: intTot, balance: o.balance,
             taxInt: taxIntTot, taxOnInt: taxIntTot * t, rows: rows, pension: pension(o, rows), firstEmpYear: rows.length ? rows[0].empTotal : 0 };
  }
  /* EPS pension estimate (Employees' Pension Scheme, 2026, paras 10–12): (pensionable wages × pensionable service) ÷ 70,
     worked out separately for each wage-ceiling period. Past service is taken at the ₹15,000 ceiling; service from 17 Sep 2026 at up to ₹25,000.
     10 years' service needed; 2 years added for 20 years or more at superannuation (58); early pension from 50, 4% less a year; minimum ₹1,000. */
  function pension(o, rows) {
    if (!o.eps) return { member: false };
    var future = Math.max(0, Math.min(o.retireAge, SUPER) - o.age), past = o.epsYears, service = past + future;
    var lastWage = rows.length ? rows[Math.max(0, Math.min(rows.length, future) - 1)].wage : o.wage;
    var lastN = rows.slice(Math.max(0, Math.min(rows.length, future) - 5), Math.min(rows.length, future));
    var avg = lastN.length ? lastN.reduce(function (s, x) { return s + Math.min(x.wage, CEIL); }, 0) / lastN.length : Math.min(o.wage, CEIL);
    var pastWage = Math.min(o.wage, OLD_CEIL);
    if (service < 10) return { member: true, eligible: false, service: service, past: past, future: future };
    var atSuper = o.retireAge >= SUPER, weight = atSuper && service >= 20 ? 2 : 0;
    var raw = (pastWage * past + avg * (future + weight)) / 70;
    var early = atSuper ? 0 : SUPER - o.retireAge, factor = 1 - 0.04 * early;
    var at58 = Math.max(1000, raw), earlyP = early ? Math.max(1000, raw * factor) : null;
    return { member: true, eligible: true, service: service, weight: weight, past: past, future: future, avg: avg, pastWage: pastWage,
             monthly: at58, early: earlyP, earlyYears: early, raw: raw, lastWage: lastWage };
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { plan: plan, pension: pension, CEIL: CEIL }; return; }
  window.SalaristEPF = { plan: plan, pension: pension, CEIL: CEIL };
  if (!document.getElementById("ep-age")) return;  /* core only (used by the retirement planner) */

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
  var S = { basis: "full", eps: true, slab: 20, age: 30, retireAge: 58, balance: 300000, wage: 50000, epsYears: 5, vpf: 0, hike: 6, rate: 8.25, infl: 6 };
  var NUM = { age: [18, 57], retireAge: [50, 60], balance: [0, 1e9], wage: [1000, 1e8], epsYears: [0, 40], vpf: [0, 88], hike: [0, 20], rate: [1, 15], infl: [0, 12] };
  var MONEY = { balance: 1, wage: 1 };
  var SLABS = [0, 5, 10, 15, 20, 25, 30];
  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    Object.keys(NUM).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= NUM[k][0] && v <= NUM[k][1]) S[k] = v; });
    if (q.get("basis") === "capped") S.basis = "capped";
    if (q.get("eps") === "0") S.eps = false;
    var sl = parseInt(q.get("slab"), 10); if (SLABS.indexOf(sl) > -1) S.slab = sl;
  })();
  var shows = [];
  function bind(k) {
    var el = $("ep-" + k), note = $("ep-" + k + "-w"); if (!el) return;
    function show() { el.value = MONEY[k] ? fmt.format(S[k]) : String(S[k]); if (note) note.textContent = MONEY[k] ? words(S[k]) : ""; }
    el.addEventListener("input", function () {
      var raw = MONEY[k] ? this.value.replace(/[^0-9]/g, "") : this.value.replace(/[^0-9.]/g, "");
      if (MONEY[k]) this.value = raw ? fmt.format(+raw) : "";
      var v = parseFloat(raw); if (!isFinite(v)) return;
      S[k] = Math.max(NUM[k][0], Math.min(NUM[k][1], v));
      if (note) note.textContent = MONEY[k] ? words(S[k]) : ""; render();
    });
    el.addEventListener("blur", show); shows.push(function () { if (document.activeElement !== el) show(); }); show();
  }
  Object.keys(NUM).forEach(function (k) { bind(k); });
  document.querySelectorAll("[data-basis]").forEach(function (b) { b.addEventListener("click", function () { S.basis = b.getAttribute("data-basis"); render(); }); });
  document.querySelectorAll("[data-eps]").forEach(function (b) { b.addEventListener("click", function () { S.eps = b.getAttribute("data-eps") === "1"; render(); }); });
  $("ep-slab").addEventListener("change", function () { S.slab = parseInt(this.value, 10); render(); });
  $("ep-slab").value = String(S.slab);
  function pressed(attr, val) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-" + attr) === String(val) ? "true" : "false"); }); }
  function yrs(n) { return n + (n === 1 ? " year" : " years"); }
  var last = null;
  function chart(r) {
    var W = 420, Hh = 240, pl = 54, pr = 14, pt = 20, pb = 26, rows = r.rows, n = rows.length || 1;
    var bal = [S.balance].concat(rows.map(function (x) { return x.bal; })), put = [S.balance], acc = S.balance;
    rows.forEach(function (x) { acc += x.own + x.emp; put.push(acc); });
    var max = Math.max.apply(null, bal) || 1, st = Math.pow(10, Math.floor(Math.log10(max / 4))), qq = max / 4 / st; st *= qq <= 1 ? 1 : qq <= 2 ? 2 : qq <= 2.5 ? 2.5 : qq <= 5 ? 5 : 10; max = st * 4;
    function x(i) { return pl + i / n * (W - pl - pr); } function yy(v) { return pt + (max - v) / max * (Hh - pt - pb); }
    function path(a) { return a.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(v).toFixed(1); }).join(""); }
    var g = ""; for (var k = 0; k <= 4; k++) { var gy = yy(max * k / 4).toFixed(1); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+gy + 3) + '" class="al" text-anchor="end">' + short(max * k / 4) + "</text>"; }
    var stp = n > 24 ? 5 : n > 12 ? 3 : n > 6 ? 2 : 1, xl = ""; for (var t = 0; t <= n; t += stp) xl += '<text x="' + x(t).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">' + (S.age + t) + "</text>";
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="EPF balance by age">' + g + xl + '<path d="' + path(put) + '" class="ln buy"/><path d="' + path(bal) + '" class="ln rent"/></svg>';
  }
  var RATES = [7.5, 8.25, 9];
  function sensRows() {
    var s = RATES.slice(); if (s.indexOf(S.rate) < 0) { s.push(S.rate); s.sort(function (a, b) { return a - b; }); }
    return s.map(function (rt) { var p = plan(Object.assign({}, S, { rate: rt })); return { rate: rt, corpus: p.corpus, real: p.real }; });
  }
  function splitRows(r) {
    return [["Your balance today", r.balance], ["You put in (12%" + (S.vpf ? " + " + S.vpf + "% VPF" : "") + ")", r.putOwn], ["Employer put in (EPF share)", r.putEmp], ["Interest", r.interest]];
  }
  function tableHtml(r) {
    var rows = r.rows.map(function (w) {
      return '<tr><th scope="row">' + w.age + '</th><td data-l="PF wages a month">' + inr(w.wage) + '</td><td data-l="You put in">' + inr(w.own) + '</td><td data-l="Employer to EPF">' + inr(w.emp) + '</td><td data-l="Employer to EPS">' + inr(w.eps) + '</td><td data-l="Interest">' + inr(w.interest) + '</td><td data-l="Balance">' + inr(w.bal) + "</td></tr>";
    }).join("");
    return '<table class="calc"><thead><tr><th>Age</th><th>PF wages a month</th><th>You put in</th><th>Employer to EPF</th><th>Employer to EPS</th><th>Interest</th><th>Balance at the end</th></tr></thead><tbody>' + rows + "</tbody></table>";
  }
  function pensionText(p) {
    if (!p.member) return "You're not in the pension scheme (EPS), so all of your employer's contribution goes to your EPF. That's common if you joined after September 2014 earning above the ceiling at the time.";
    if (!p.eligible) return "<b>EPS:</b> " + yrs(p.service) + " of service by 58 is less than the 10 years needed for a pension. You'd get a one-time withdrawal benefit instead (worked out on months of service and wages), or you can keep a scheme certificate so the service counts if you join another covered employer. The <a href=\"/eps-pension-calculator/\">EPS pension calculator</a> shows the withdrawal amount.";
    var t = "<b>EPS pension:</b> about " + inr(p.monthly) + " a month for life from 58, with " + yrs(p.service) + " of service" + (p.weight ? " (plus 2 years added for 20 years or more)" : "") + ". ";
    t += "Past service is counted at the ₹15,000 ceiling and service from 17 September 2026 at up to ₹25,000.";
    t += ' For an exact split of your service, use the <a href="/eps-pension-calculator/">EPS pension calculator</a>.';
    if (p.early) t += " Retiring at " + S.retireAge + ", you could take it early at about " + inr(p.early) + " a month (4% less for each year before 58), or wait until 58.";
    return t;
  }
  function render() {
    pressed("basis", S.basis); pressed("eps", S.eps ? "1" : "0");
    $("ep-epsWrap").hidden = !S.eps;
    var r = plan(S); last = r; var p = r.pension;
    $("epVerdict").innerHTML = '<p class="k">At ' + S.retireAge + ", after " + yrs(r.years) + '</p><p class="v">Your EPF could be about <b>' + short(r.corpus) + "</b></p>" +
      '<p class="k">That\'s about ' + short(r.real) + " in today's money" + (p.member && p.eligible ? ", plus an EPS pension of about " + inr(p.monthly) + " a month." : ".") + "</p>";
    $("epS1").textContent = short(r.corpus); $("epS1h").textContent = "About " + short(r.real) + " in today's money";
    $("epS2").textContent = p.member && p.eligible ? inr(p.monthly) : "—"; $("epS2h").textContent = !p.member ? "Not in EPS" : p.eligible ? "A month, from 58" : "Under 10 years: withdrawal benefit";
    $("epS3").textContent = short(r.putOwn + r.putEmp); $("epS3h").textContent = "You " + short(r.putOwn) + " · employer " + short(r.putEmp);
    $("epS4").textContent = short(r.interest); $("epS4h").textContent = "At " + S.rate + "% a year";
    var notes = [pensionText(p)];
    if (r.taxInt > 1) notes.push("<b>Taxable interest:</b> your own PF contributions (with VPF) go above ₹2.5 lakh a year, so interest on the excess is taxable: about " + short(r.taxInt) + " over the years, roughly " + short(r.taxOnInt) + " in tax at your " + S.slab + "% slab.");
    if (r.firstEmpYear > CAP) notes.push("<b>₹7.5 lakh cap:</b> your employer's PF alone is " + inr(r.firstEmpYear) + " a year. Employer PF, NPS and superannuation above ₹7.5 lakh a year in total is taxed as a perquisite.");
    $("epRule").innerHTML = notes.join("<br><br>");
    $("epChart").innerHTML = chart(r);
    $("epSplit").innerHTML = '<table class="calc"><thead><tr><th>Where it comes from</th><th>Amount</th></tr></thead><tbody>' + splitRows(r).map(function (x) { return '<tr><th scope="row">' + x[0] + '</th><td data-l="Amount">' + inr(x[1]) + "</td></tr>"; }).join("") +
      '<tr class="tot"><th scope="row"><b>EPF at ' + S.retireAge + '</b></th><td data-l="Amount"><b>' + inr(r.corpus) + "</b></td></tr>" +
      (r.putEps ? '<tr><th scope="row">Employer to EPS (pension fund, not in your EPF)</th><td data-l="Amount">' + inr(r.putEps) + "</td></tr>" : "") + "</tbody></table>";
    r.sens = sensRows();
    $("epSens").innerHTML = r.sens.map(function (s) { return '<div class="sv' + (s.rate === S.rate ? " cur" : "") + '"><span class="l">' + s.rate + '% a year</span><span class="n">' + short(s.corpus) + '</span><span class="h">' + short(s.real) + " in today's money</span></div>"; }).join("");
    $("epTable").innerHTML = tableHtml(r);
    $("epBarT").textContent = short(r.corpus) + " at " + S.retireAge;
    shows.forEach(function (f) { f(); });
  }

  /* ---------- Reports ---------- */
  function say(m) { var s = $("epStatus"); s.textContent = m; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function spec() {
    var r = last, p = r.pension, cats = [S.age], monthly = [S.balance], putM = [S.balance];
    r.rows.forEach(function (w, i) {
      cats.push(w.age); var prev = i ? r.rows[i - 1].bal : S.balance, prevPut = putM[putM.length - 1];
      for (var m = 1; m <= 12; m++) { monthly.push(prev + (w.bal - prev) * m / 12); putM.push(prevPut + (w.own + w.emp) * m / 12); }
    });
    var sens = r.sens.slice(0, 3);
    return {
      title: "EPF Retirement Report", path: "salarist.in/epf-calculator", url: location.origin + location.pathname, file: "salarist-epf",
      question: "How much will my EPF be at " + S.retireAge + ", and what EPS pension can I expect?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#epVerdict p"), function (x) { return x.textContent; }), verdictColor: "blue",
      inputs: [["Age now", String(S.age)], ["Retire at", String(S.retireAge)], ["EPF balance now", inr(S.balance), S.balance], ["PF wages a month (basic + DA)", inr(S.wage), S.wage],
        ["PF worked out on", S.basis === "capped" ? "Wages capped at ₹25,000" : "Full wages"], ["Voluntary PF (VPF)", S.vpf + "% of wages"], ["Pay rise each year", S.hike + "%"],
        ["EPF interest rate", S.rate + "% a year"], ["In the pension scheme (EPS)", S.eps ? "Yes, " + yrs(S.epsYears) + " of service so far" : "No"], ["Tax slab", S.slab + "% + cess"], ["Inflation", S.infl + "% a year"]],
      keyNums: [["EPF at " + S.retireAge, short(r.corpus), r.corpus], ["EPS pension a month", p.member && p.eligible ? inr(p.monthly) : "—", p.monthly || 0], ["You and employer put in", short(r.putOwn + r.putEmp), r.putOwn + r.putEmp], ["Interest earned", short(r.interest), r.interest]],
      sensTitle: "EPF at other interest rates", sens: sens.map(function (s) { return [s.rate + "% a year", short(s.corpus)]; }), sensCurrent: sens.map(function (s) { return s.rate; }).indexOf(S.rate),
      chartTitle: "EPF balance by age", chartNote: "Upper line: balance. Lower line: what you and your employer put in.", xlsxChartTitle: "Balance (₹ lakh)",
      chart: { series: [{ name: "EPF balance", color: "blue", data: monthly }, { name: "Put in", color: "amber", data: putM }], cross: null }, chartYears: cats, chartXLabel: "Age", chartAge0: S.age,
      money: { title: "Where your EPF comes from", cols: ["Amount", "Share"], rows: splitRows(r).map(function (x) { return [x[0], x[1], r.corpus ? (x[1] / r.corpus * 100).toFixed(1) + "%" : "—"]; }).concat([["EPF at " + S.retireAge, r.corpus, "100%", "total"]]), note: $("epRule").textContent },
      tables: [{ title: "Year by year", sheet: "By year", cols: ["Age", "PF wages a month", "You put in", "Employer to EPF", "Employer to EPS", "Interest", "Balance at the end"], yearly: r.rows.map(function (w) { return [String(w.age), w.wage, w.own, w.emp, w.eps, w.interest, w.bal]; }), monthly: null }],
      notes: ["Contributions: you 12% of PF wages (plus any VPF); your employer 12%, of which 8.33% of wages up to ₹25,000 goes to the pension scheme (EPS) if you're a member, and the rest to your EPF.",
        "Interest is worked out on the monthly balance and credited once a year, at the rate you set (8.25% was approved for 2025-26). Future rates will differ.",
        "Pay rises once a year by the rate you set. PF wages are basic + DA; under the labour codes they are at least half your total pay.",
        "EPS pension is an estimate: (pensionable wages × service) ÷ 70, past service at the ₹15,000 ceiling and service from 17 September 2026 at up to ₹25,000, 2 years added for 20 years or more, minimum ₹1,000. Higher pension on actual wages isn't included.",
        "Taxable interest: interest on your own contributions above ₹2.5 lakh a year, taxed at your slab plus 4% cess."],
      taxRules: ["Income-tax Act, 2025: interest on your own PF contributions above ₹2.5 lakh a year is taxable; employer PF, NPS and superannuation above ₹7.5 lakh a year in total is a taxable perquisite (section 17). Withdrawals after 5 years of continuous service are generally tax-free.",
        "Employees' Provident Funds Scheme, 2026 and Employees' Pension Scheme, 2026 (notified 29 June 2026). Wage ceiling ₹25,000 a month from 17 September 2026."],
      short: short, inr: inr
    };
  }
  function busy(b, on) { b.disabled = on; b.setAttribute("aria-busy", on ? "true" : "false"); }
  $("epPdf").addEventListener("click", function () { var b = this; busy(b, true); say("Making your PDF…"); withReport(function (Kt) { Kt.pdf(spec()).then(function () { busy(b, false); say("PDF report downloaded."); }, function () { busy(b, false); say("Couldn't make the PDF. Please try again."); }); }); });
  $("epXlsx").addEventListener("click", function () { var b = this; busy(b, true); withReport(function (Kt) { try { Kt.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(b, false); }); });
  $("epShare").addEventListener("click", function () {
    var q = new URLSearchParams(); Object.keys(NUM).forEach(function (k) { q.set(k, S[k]); }); q.set("basis", S.basis); q.set("eps", S.eps ? "1" : "0"); q.set("slab", S.slab);
    var t = location.origin + location.pathname + "?" + q.toString();
    function ok() { say("Link copied. Anyone with it sees these numbers."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { say("Couldn't copy. Copy the address bar instead."); }); else say("Copy the address bar to share.");
  });
  (function bar() {
    var el = $("epBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("epVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".epx .lp-setup"));
    $("epBarBtn").addEventListener("click", function () { $("epVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
