/* Salarist Sukanya Samriddhi calculator. Runs entirely in the browser; nothing is stored or sent. */
(function () {
  "use strict";
  var MAX = 150000, MIN = 250, DEP_YEARS = 15, TERM = 21, CESS = 1.04;
  /* ---------- Core ---------- */
  /* o: {age (girl's age now, 0–10), yearly (deposit a year), when "april"|"monthly", rate, ppfRate, edu (% withdrawn for education at 18, 0–50), regime "old"|"new", slab} */
  function run(o, rate, years, depYears, wd) {
    var bal = 0, rows = [], dep = 0, r = rate / 100, out = 0;
    for (var y = 1; y <= years; y++) {
      var put = y <= depYears ? Math.min(MAX, o.yearly) : 0, intY = 0, take = 0;
      /* Education withdrawal (up to 50% of the balance at the end of the previous year), once she has turned 18 */
      if (wd && o.edu > 0 && o.age + y - 1 >= 18 && !out) { take = bal * Math.min(50, o.edu) / 100; bal -= take; out = take; }
      if (o.when === "april") { bal += put; intY = bal * r; }
      else { var mth = put / 12; for (var m = 0; m < 12; m++) { bal += mth; intY += bal * r / 12; } }
      dep += put; bal += intY; rows.push({ y: y, age: o.age + y, put: put, interest: intY, take: take, bal: bal });
    }
    return { maturity: bal, deposits: dep, interest: bal + out - dep, withdrawn: out, rows: rows };
  }
  function calc(o) {
    var s = run(o, o.rate, TERM, DEP_YEARS, true), noWd = run(o, o.rate, TERM, DEP_YEARS, false);
    var ppf15 = run(o, o.ppfRate, 15, 15, false), ppf21 = run(o, o.ppfRate, TERM, 15, false);   /* PPF: same deposits for 15 years, then extended without deposits */
    var ded = o.regime === "old" ? Math.min(MAX, o.yearly) : 0, saved = ded * o.slab / 100 * CESS;
    return { s: s, noWd: noWd, ppf15: ppf15, ppf21: ppf21, maturityAge: o.age + TERM, depEnd: o.age + DEP_YEARS, taxSavedYear: saved, taxSaved: saved * DEP_YEARS };
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { calc: calc, MAX: MAX }; return; }

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
  var S = { age: 2, yearly: 150000, when: "april", rate: 8.2, ppfRate: 7.1, edu: 0, regime: "new", slab: 20 };
  var NUM = { age: [0, 10], yearly: [MIN, MAX], rate: [1, 12], ppfRate: [1, 12], edu: [0, 50], slab: [0, 30] };
  var MONEY = { yearly: 1 };
  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    Object.keys(NUM).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= NUM[k][0] && v <= NUM[k][1]) S[k] = v; });
    if (q.get("when") === "monthly") S.when = "monthly"; if (q.get("regime") === "old") S.regime = "old";
  })();
  var shows = [];
  function bind(k) {
    var el = $("sy-" + k), note = $("sy-" + k + "-w"); if (!el) return;
    function show() { el.value = MONEY[k] ? fmt.format(S[k]) : String(S[k]); if (note) note.textContent = MONEY[k] ? words(S[k]) : ""; }
    el.addEventListener("input", function () {
      var raw = MONEY[k] ? this.value.replace(/[^0-9]/g, "") : this.value.replace(/[^0-9.]/g, "");
      if (MONEY[k]) this.value = raw ? fmt.format(+raw) : "";
      var v = parseFloat(raw); if (!isFinite(v)) return;
      S[k] = Math.max(NUM[k][0], Math.min(NUM[k][1], v)); if (note) note.textContent = MONEY[k] ? words(S[k]) : ""; render();
    });
    el.addEventListener("blur", show); shows.push(function () { if (document.activeElement !== el) show(); }); show();
  }
  Object.keys(NUM).forEach(bind);
  ["when", "regime"].forEach(function (k) { document.querySelectorAll("[data-" + k + "]").forEach(function (b) { b.addEventListener("click", function () { S[k] = b.getAttribute("data-" + k); render(); }); }); });
  function pressed(attr, val) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-" + attr) === String(val) ? "true" : "false"); }); }
  var last = null;
  function chart(r) {
    var W = 420, Hh = 240, pl = 54, pr = 14, pt = 20, pb = 26, a = [0].concat(r.s.rows.map(function (x) { return x.bal; })), b = [0].concat(r.ppf21.rows.map(function (x) { return x.bal; })), n = a.length - 1;
    var max = Math.max.apply(null, a.concat(b, [1])), st = Math.pow(10, Math.floor(Math.log10(max / 4))), qq = max / 4 / st; st *= qq <= 1 ? 1 : qq <= 2 ? 2 : qq <= 2.5 ? 2.5 : qq <= 5 ? 5 : 10; max = st * 4;
    function x(i) { return pl + i / n * (W - pl - pr); } function yy(v) { return pt + (max - v) / max * (Hh - pt - pb); }
    function path(arr) { return arr.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(v).toFixed(1); }).join(""); }
    var g = ""; for (var k = 0; k <= 4; k++) { var gy = yy(max * k / 4).toFixed(1); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+gy + 3) + '" class="al" text-anchor="end">' + short(max * k / 4) + "</text>"; }
    var xl = ""; for (var t = 0; t <= n; t += 3) xl += '<text x="' + x(t).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">' + (S.age + t) + "</text>";
    var d15 = x(DEP_YEARS).toFixed(1);
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Balance by your daughter\'s age">' + g + xl + '<line x1="' + d15 + '" x2="' + d15 + '" y1="' + pt + '" y2="' + (Hh - pb) + '" class="gl" stroke-dasharray="3 3"/><text x="' + (+d15 + 4) + '" y="' + (pt + 10) + '" class="al">Deposits stop</text><path d="' + path(b) + '" class="ln buy"/><path d="' + path(a) + '" class="ln rent"/></svg>';
  }
  function render() {
    pressed("when", S.when); pressed("regime", S.regime); $("sy-slabWrap").hidden = S.regime !== "old";
    var r = calc(S); last = r;
    $("syVerdict").className = "verdict";
    $("syVerdict").innerHTML = '<p class="k">Putting in ' + inr(S.yearly) + " a year for 15 years, from age " + S.age + '</p><p class="v">At ' + r.maturityAge + ", your daughter's account could have <b>" + short(r.s.maturity) + "</b></p>" +
      '<p class="k">Tax-free, at ' + S.rate + "% a year" + (r.s.withdrawn ? ", after taking out " + short(r.s.withdrawn) + " for her education at 18" : "") + ". The rate is reset every quarter.</p>";
    $("syS1").textContent = short(r.s.maturity); $("syS1h").textContent = "At age " + r.maturityAge;
    $("syS2").textContent = short(r.s.deposits); $("syS2h").textContent = "15 years of deposits";
    $("syS3").textContent = short(r.s.interest); $("syS3h").textContent = "Interest, tax-free";
    $("syS4").textContent = S.regime === "old" ? inr(r.taxSavedYear) : "₹0"; $("syS4h").textContent = S.regime === "old" ? "Tax saved a year (old regime)" : "No deduction in the new regime";
    var notes = ["<b>Deposits</b> run for 15 years from opening (until she's " + r.depEnd + "); the account then keeps earning until it matures at 21 years (age " + r.maturityAge + ")."];
    notes.push("<b>Against PPF:</b> the same deposits in PPF at " + S.ppfRate + "% would be " + short(r.ppf15.maturity) + " after 15 years, or " + short(r.ppf21.maturity) + " if extended without deposits to the same date.");
    if (S.when === "monthly") notes.push("<b>Paying monthly</b> earns less than paying the year's amount by 5 April: interest counts only the lowest balance after the 5th of each month. By 5 April, the same money would reach " + short(calc(Object.assign({}, S, { when: "april" })).s.maturity) + ".");
    $("syRule").innerHTML = notes.join("<br><br>");
    $("syChart").innerHTML = chart(r);
    var cmp = [["As you've set it", r.s.maturity], ["Rate falls to 7.5%", calc(Object.assign({}, S, { rate: 7.5 })).s.maturity], ["Same money in PPF (" + S.ppfRate + "%)", r.ppf21.maturity], [S.edu ? "No education withdrawal" : "50% taken out at 18", S.edu ? r.noWd.maturity : calc(Object.assign({}, S, { edu: 50 })).s.maturity]];
    r.what = cmp;
    $("sySens").innerHTML = cmp.map(function (w, i) { return '<div class="sv' + (i === 0 ? " cur" : "") + '"><span class="l">' + w[0] + '</span><span class="n">' + short(w[1]) + "</span></div>"; }).join("");
    $("syTable").innerHTML = '<table class="calc"><thead><tr><th>Her age</th><th>You put in</th><th>Taken out</th><th>Interest</th><th>Balance</th></tr></thead><tbody>' + r.s.rows.map(function (w) {
      return '<tr><th scope="row">' + w.age + '</th><td data-l="You put in">' + (w.put ? inr(w.put) : "—") + '</td><td data-l="Taken out">' + (w.take ? inr(w.take) : "—") + '</td><td data-l="Interest">' + inr(w.interest) + '</td><td data-l="Balance">' + inr(w.bal) + "</td></tr>"; }).join("") + "</tbody></table>";
    $("syBarT").textContent = short(r.s.maturity) + " at " + r.maturityAge;
    shows.forEach(function (f) { f(); });
  }

  /* ---------- Reports ---------- */
  function say(m) { var s = $("syStatus"); s.textContent = m; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function spec() {
    var r = last, cats = [0], a = [0], b = [0];
    function months(rows, arr) { rows.forEach(function (w, i) { var prev = i ? rows[i - 1].bal : 0; for (var m = 1; m <= 12; m++) arr.push(prev + (w.bal - prev) * m / 12); }); }
    r.s.rows.forEach(function (w, i) { cats.push(i + 1); }); months(r.s.rows, a); months(r.ppf21.rows, b);
    return {
      title: "Sukanya Samriddhi Report", path: "salarist.in/sukanya-samriddhi-calculator", url: location.origin + location.pathname, file: "salarist-sukanya-samriddhi",
      question: "What will my daughter's Sukanya Samriddhi account be worth?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#syVerdict p"), function (x) { return x.textContent; }), verdictColor: "blue",
      inputs: [["Daughter's age now", String(S.age)], ["Deposit a year", inr(S.yearly), S.yearly], ["Deposit", S.when === "april" ? "Whole year's amount by 5 April" : "Monthly"], ["Interest rate", S.rate + "% a year"],
        ["PPF rate, for comparison", S.ppfRate + "% a year"], ["Taken out for education at 18", S.edu + "% of the balance"], ["Your tax regime", S.regime === "old" ? "Old, " + S.slab + "% slab" : "New"]],
      keyNums: [["At age " + r.maturityAge, short(r.s.maturity), r.s.maturity], ["You put in", short(r.s.deposits), r.s.deposits], ["Interest", short(r.s.interest), r.s.interest], ["Tax saved a year", S.regime === "old" ? inr(r.taxSavedYear) : "₹0", r.taxSavedYear]],
      sensTitle: "What if", sens: r.what.slice(0, 3).map(function (w) { return [w[0], short(w[1])]; }), sensCurrent: 0,
      chartTitle: "Balance by your daughter's age", chartNote: "Deposits for 15 years, then interest only until 21 years. Second line: the same deposits in PPF, extended without deposits.", xlsxChartTitle: "Balance (₹ lakh)",
      chart: { series: [{ name: "Sukanya Samriddhi", color: "blue", data: a }, { name: "PPF", color: "amber", data: b }], cross: null }, chartYears: cats, chartXLabel: "Her age", chartAge0: S.age,
      money: { title: "Where the money comes from", cols: ["Amount", "Share"], rows: [["You put in", r.s.deposits, (r.s.deposits / (r.s.maturity + r.s.withdrawn) * 100).toFixed(0) + "%"], ["Interest", r.s.interest, (r.s.interest / (r.s.maturity + r.s.withdrawn) * 100).toFixed(0) + "%"]]
        .concat(r.s.withdrawn ? [["Less: taken out for education", -r.s.withdrawn, ""]] : []).concat([["At maturity", r.s.maturity, "", "total"]]), note: $("syRule").textContent },
      tables: [{ title: "Year by year", sheet: "By year", cols: ["Her age", "You put in", "Taken out", "Interest", "Balance"], yearly: r.s.rows.map(function (w) { return [String(w.age), w.put, w.take, w.interest, w.bal]; }), monthly: null }],
      notes: ["Deposits for 15 years from opening (₹250 to ₹1.5 lakh a year); the account matures 21 years from opening. Interest is worked out on the lowest balance between the 5th and the end of each month and added once a year.",
        "The rate (" + S.rate + "% for October–December 2026) is reset every quarter; it's assumed to stay the same.",
        "Education withdrawal: up to 50% of the balance at the end of the previous year, once she turns 18 (or passes Class 10).",
        "PPF comparison: the same deposits for 15 years at the PPF rate, then extended without deposits to the same date."],
      taxRules: ["Deposits can be deducted under section 123 of the Income-tax Act, 2025 (with Schedule XV; earlier section 80C), within ₹1.5 lakh, in the old regime only. Interest and the maturity amount are tax-free."],
      short: short, inr: inr
    };
  }
  function busy(b, on) { b.disabled = on; b.setAttribute("aria-busy", on ? "true" : "false"); }
  $("syPdf").addEventListener("click", function () { var b = this; busy(b, true); say("Making your PDF…"); withReport(function (Kt) { Kt.pdf(spec()).then(function () { busy(b, false); say("PDF report downloaded."); }, function () { busy(b, false); say("Couldn't make the PDF. Please try again."); }); }); });
  $("syXlsx").addEventListener("click", function () { var b = this; busy(b, true); withReport(function (Kt) { try { Kt.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(b, false); }); });
  $("syShare").addEventListener("click", function () {
    var q = new URLSearchParams(); Object.keys(NUM).forEach(function (k) { q.set(k, S[k]); }); q.set("when", S.when); q.set("regime", S.regime);
    var t = location.origin + location.pathname + "?" + q.toString();
    function ok() { say("Link copied. Anyone with it sees these numbers."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { say("Couldn't copy. Copy the address bar instead."); }); else say("Copy the address bar to share.");
  });
  (function bar() {
    var el = $("syBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("syVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".syx .lp-setup"));
    $("syBarBtn").addEventListener("click", function () { $("syVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
