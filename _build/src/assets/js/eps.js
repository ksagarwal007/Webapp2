/* Salarist EPS pension calculator. Runs entirely in the browser; nothing is stored or sent. */
(function () {
  "use strict";
  /* Wage-ceiling periods (Employees' Pension Scheme, 2026, para 12(2): pension worked out pro rata for each wage-ceiling period). */
  var PERIODS = [{ k: "p1", name: "Before 1 September 2014", ceil: 6500 }, { k: "p2", name: "1 September 2014 to 16 September 2026", ceil: 15000 }, { k: "p3", name: "From 17 September 2026", ceil: 25000 }];
  /* Table-IV of EPS 2026: withdrawal benefit as a multiple of pensionable wages, by completed months of service (1 to 120). */
  var T4 = [0.08, 0.17, 0.25, 0.33, 0.42, 0.51, 0.60, 0.68, 0.77, 0.85, 0.94, 1.02, 1.10, 1.18, 1.26, 1.34, 1.42, 1.51, 1.59, 1.67, 1.75, 1.83, 1.91, 1.99, 2.07, 2.16, 2.24, 2.32, 2.40, 2.49,
    2.57, 2.65, 2.73, 2.82, 2.90, 2.98, 3.06, 3.15, 3.23, 3.32, 3.40, 3.49, 3.57, 3.65, 3.74, 3.82, 3.91, 3.99, 4.08, 4.16, 4.25, 4.33, 4.42, 4.51, 4.59, 4.68, 4.76, 4.85, 4.93, 5.02,
    5.11, 5.20, 5.28, 5.37, 5.46, 5.55, 5.63, 5.72, 5.81, 5.90, 5.98, 6.07, 6.16, 6.25, 6.34, 6.42, 6.51, 6.60, 6.69, 6.78, 6.87, 6.95, 7.04, 7.13, 7.22, 7.31, 7.40, 7.49, 7.58, 7.68,
    7.77, 7.86, 7.95, 8.04, 8.13, 8.22, 8.31, 8.41, 8.50, 8.59, 8.68, 8.78, 8.87, 8.96, 9.05, 9.15, 9.24, 9.33];
  function factor(months) { var m = Math.max(0, Math.min(120, Math.floor(months))); return m ? T4[Math.min(m, 108) - 1] : 0; }
  var SUPER = 58, MIN = 1000;

  /* ---------- Core ---------- */
  /* o: {p1, p2, p3 (years of EPS service in each period, may be decimals), wage (average wages a month, basic + DA, last 60 months),
         higher (bool: pension on actual wages), start (age the pension starts, 50–60)} */
  function calc(o) {
    var yrs = o.p1 + o.p2 + o.p3, months = Math.round(yrs * 12), eligible = yrs >= 10 - 1e-9;
    var atSuper = o.start >= SUPER, weight = eligible && atSuper && yrs >= 20 ? 2 : 0;
    var lastK = o.p3 > 0 ? "p3" : o.p2 > 0 ? "p2" : "p1";
    var rows = PERIODS.map(function (p) {
      var y = o[p.k] + (p.k === lastK ? weight : 0), w = o.higher ? o.wage : Math.min(o.wage, p.ceil);
      return { name: p.name, ceil: p.ceil, years: o[p.k], plus: p.k === lastK ? weight : 0, wage: w, pension: w * y / 70 };
    });
    var raw = rows.reduce(function (s, r) { return s + r.pension; }, 0), lastW = rows[["p1", "p2", "p3"].indexOf(lastK)].wage;
    var raw0 = raw - weight * lastW / 70;   /* without the 2 added years */
    function at(age) {
      if (!eligible) return 0;
      var w = age >= SUPER && yrs >= 20 ? 2 : 0, f = age < SUPER ? 1 - 0.04 * (SUPER - age) : 1 + 0.04 * (Math.min(age, 60) - SUPER);
      return Math.max(MIN, (raw0 + w * lastW / 70) * f);
    }
    /* Pensionable wages for the withdrawal benefit: service-weighted average of the capped wages. */
    var pw = yrs > 0 ? rows.reduce(function (s, r) { return s + r.wage * r.years; }, 0) / yrs : 0;
    var fac = eligible ? 0 : factor(months);
    return { years: yrs, months: months, eligible: eligible, weight: weight, rows: rows, raw: raw, monthly: at(o.start), at: at,
             wb: fac * pw, wbFactor: fac, pw: pw, short: Math.max(0, 120 - months) };
  }
  function cumulative(at, from, to) { var a = []; for (var age = 50; age <= to; age++) a.push(age < from ? 0 : at * 12 * (age - from)); return a; }
  if (typeof module !== "undefined" && module.exports) { module.exports = { calc: calc, factor: factor, T4: T4 }; return; }

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
  function yrsTxt(n) { var y = Math.floor(n + 1e-9), m = Math.round((n - y) * 12); if (m === 12) { y++; m = 0; } return y + (y === 1 ? " year" : " years") + (m ? " " + m + (m === 1 ? " month" : " months") : ""); }
  var S = { higher: false, p1: 0, p2: 8, p3: 20, wage: 40000, start: 58 };
  var NUM = { p1: [0, 45], p2: [0, 13], p3: [0, 45], wage: [1000, 1e8], start: [50, 60] };
  var MONEY = { wage: 1 };
  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    Object.keys(NUM).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= NUM[k][0] && v <= NUM[k][1]) S[k] = v; });
    if (q.get("higher") === "1") S.higher = true;
  })();
  var shows = [];
  function bind(k) {
    var el = $("es-" + k), note = $("es-" + k + "-w"); if (!el) return;
    function show() { el.value = MONEY[k] ? fmt.format(S[k]) : String(S[k]); if (note) note.textContent = MONEY[k] ? words(S[k]) : ""; }
    el.addEventListener("input", function () {
      var raw = MONEY[k] ? this.value.replace(/[^0-9]/g, "") : this.value.replace(/[^0-9.]/g, "");
      if (MONEY[k]) this.value = raw ? fmt.format(+raw) : "";
      var v = parseFloat(raw); if (!isFinite(v)) { if (!MONEY[k] && raw === "" && NUM[k][0] === 0) { S[k] = 0; render(); } return; }
      S[k] = Math.max(NUM[k][0], Math.min(NUM[k][1], v)); render();
    });
    el.addEventListener("blur", show); shows.push(function () { if (document.activeElement !== el) show(); }); show();
  }
  Object.keys(NUM).forEach(function (k) { bind(k); });
  document.querySelectorAll("[data-higher]").forEach(function (b) { b.addEventListener("click", function () { S.higher = b.getAttribute("data-higher") === "1"; render(); }); });
  function pressed(attr, val) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-" + attr) === String(val) ? "true" : "false"); }); }
  var last = null, AGES = [50, 55, 58, 60];
  function other() { return S.start === 58 ? 60 : 58; }
  function chart(r) {
    var W = 420, Hh = 240, pl = 54, pr = 14, pt = 20, pb = 26, to = 85, n = to - 50;
    var a = cumulative(r.monthly, S.start, to), b = cumulative(r.at(other()), other(), to);
    var max = Math.max.apply(null, a.concat(b)) || 1, st = Math.pow(10, Math.floor(Math.log10(max / 4))), qq = max / 4 / st; st *= qq <= 1 ? 1 : qq <= 2 ? 2 : qq <= 2.5 ? 2.5 : qq <= 5 ? 5 : 10; max = st * 4;
    function x(i) { return pl + i / n * (W - pl - pr); } function yy(v) { return pt + (max - v) / max * (Hh - pt - pb); }
    function path(arr) { return arr.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(v).toFixed(1); }).join(""); }
    var g = ""; for (var k = 0; k <= 4; k++) { var gy = yy(max * k / 4).toFixed(1); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+gy + 3) + '" class="al" text-anchor="end">' + short(max * k / 4) + "</text>"; }
    var xl = ""; for (var t = 0; t <= n; t += 5) xl += '<text x="' + x(t).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">' + (50 + t) + "</text>";
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Total pension received by age">' + g + xl + '<path d="' + path(b) + '" class="ln buy"/><path d="' + path(a) + '" class="ln rent"/></svg>';
  }
  function breakEven(r) { /* age from which starting later has paid more in total */
    var s1 = Math.min(S.start, other()), s2 = Math.max(S.start, other()), p1 = r.at(s1), p2 = r.at(s2);
    if (p2 <= p1) return null; var age = (p2 * s2 - p1 * s1) / (p2 - p1); return { early: s1, late: s2, age: age };
  }
  function periodTable(r) {
    return '<table class="calc"><thead><tr><th>Service period</th><th>Years</th><th>Wages counted</th><th>Pension a month</th></tr></thead><tbody>' +
      r.rows.map(function (x) { return '<tr><th scope="row">' + x.name + (S.higher ? "" : " (up to " + inr(x.ceil) + ")") + '</th><td data-l="Years">' + (x.years ? yrsTxt(x.years) : "—") + (x.plus ? " + 2 added" : "") + '</td><td data-l="Wages counted">' + (x.years || x.plus ? inr(x.wage) : "—") + '</td><td data-l="Pension a month">' + (x.years || x.plus ? inr(x.pension) : "—") + "</td></tr>"; }).join("") +
      '<tr class="tot"><th scope="row"><b>Pension at 58</b></th><td data-l="Years">' + yrsTxt(r.years) + '</td><td></td><td data-l="Pension a month"><b>' + inr(Math.max(MIN, r.raw)) + "</b></td></tr></tbody></table>";
  }
  function render() {
    pressed("higher", S.higher ? "1" : "0");
    var r = calc(S); last = r;
    $("esElig").hidden = !r.eligible; $("esWb").hidden = r.eligible;
    if (r.eligible) {
      $("esVerdict").className = "verdict";
      $("esVerdict").innerHTML = '<p class="k">With ' + yrsTxt(r.years) + " of EPS service, starting at " + S.start + '</p><p class="v">Your EPS pension could be about <b>' + inr(r.monthly) + "</b> a month</p>" +
        '<p class="k">For life' + (S.start < 58 ? ", " + (4 * (58 - S.start)) + "% less than at 58 (" + inr(r.at(58)) + ")" : S.start > 58 ? ", " + (4 * (S.start - 58)) + "% more than at 58 (" + inr(r.at(58)) + ")" : "") + ". It doesn't rise with inflation.</p>";
    } else {
      $("esVerdict").className = "verdict short";
      $("esVerdict").innerHTML = '<p class="k">With ' + yrsTxt(r.years) + " of EPS service (less than the 10 years needed for a pension)</p>" +
        '<p class="v">Withdrawal benefit: about <b>' + inr(r.wb) + "</b></p>" + '<p class="k">Or keep a scheme certificate and add ' + yrsTxt(r.short / 12) + " more service to get a pension for life.</p>";
    }
    $("esS1").textContent = r.eligible ? inr(r.monthly) : inr(r.wb); $("esS1l").textContent = r.eligible ? "Pension a month" : "Withdrawal benefit";
    $("esS1h").textContent = r.eligible ? "From " + S.start : r.wbFactor + " × " + inr(r.pw) + " wages";
    $("esS2").textContent = yrsTxt(r.years + r.weight); $("esS2h").textContent = r.weight ? "Including 2 years added for 20+ years" : "Pensionable service";
    var be = r.eligible ? breakEven(r) : null;
    $("esS3").textContent = r.eligible ? inr(r.monthly * 12) : "—"; $("esS3h").textContent = r.eligible ? "A year, before tax" : "No pension";
    $("esS4").textContent = be ? "Age " + Math.ceil(be.age) : "—"; $("esS4h").textContent = be ? "Starting at " + be.late + " pays more in total than " + be.early + " after this age" : r.eligible ? "" : "Payable after 36 months";
    var notes = [];
    if (r.eligible) {
      notes.push("<b>How it's worked out:</b> (wages counted × years of service) ÷ 70 for each wage-ceiling period, added up" + (S.higher ? ", on your actual wages (higher pension option)." : ". Wages above each period's ceiling don't count unless you opted for the higher pension."));
      if (r.years >= 20 && S.start < 58) notes.push("<b>Taking it early</b> also loses the 2 years added for 20 years or more of service, which apply only to a pension at 58 or later.");
      notes.push("<b>Your family:</b> if you die, your spouse gets a family pension for life (at least ₹1,000 a month), and up to two children get 25% of it each until 25. EPFO works out the amount.");
    } else {
      notes.push("<b>Withdrawal benefit:</b> " + r.wbFactor + " times your pensionable wages for " + r.months + " months of service (Table-IV of EPS 2026). Under EPS 2026, it's paid only after 36 months from your last contribution, or at 58 if earlier, and only if you haven't joined another covered employer.");
      notes.push("<b>Scheme certificate:</b> keeps your service so it adds to future service. Usually the better choice if you might work again in a job covered by EPF: at 10 years you'd get a pension for life instead.");
    }
    $("esRule").innerHTML = notes.join("<br><br>");
    $("esPeriods").innerHTML = periodTable(r);
    if (r.eligible) {
      $("esChart").innerHTML = chart(r);
      $("esLegA").textContent = "Starting at " + S.start; $("esLegB").textContent = "Starting at " + other();
      r.sens = AGES.map(function (a) { return { age: a, p: r.at(a) }; });
      $("esSens").innerHTML = r.sens.map(function (s) { return '<div class="sv' + (s.age === S.start ? " cur" : "") + '"><span class="l">Start at ' + s.age + '</span><span class="n">' + inr(s.p) + '</span><span class="h">' + (s.age < 58 ? 4 * (58 - s.age) + "% less" : s.age > 58 ? 4 * (s.age - 58) + "% more" : "Normal age") + "</span></div>"; }).join("");
    }
    $("esBarT").textContent = r.eligible ? inr(r.monthly) + " a month" : "Withdrawal " + inr(r.wb);
    shows.forEach(function (f) { f(); });
  }

  /* ---------- Reports ---------- */
  function say(m) { var s = $("esStatus"); s.textContent = m; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function spec() {
    var r = last, o = other(), cats = [], a = [], b = [0];
    for (var age = 50; age <= 85; age++) cats.push(age);
    var ca = cumulative(r.monthly, S.start, 85), cb = cumulative(r.at(o), o, 85); a = [ca[0]]; b = [cb[0]];
    for (var i = 1; i < ca.length; i++) for (var m = 1; m <= 12; m++) { a.push(ca[i - 1] + (ca[i] - ca[i - 1]) * m / 12); b.push(cb[i - 1] + (cb[i] - cb[i - 1]) * m / 12); }
    var rowsMoney = r.rows.map(function (x) { return [x.name + (x.plus ? " (incl. 2 years added)" : ""), x.pension, x.years ? yrsTxt(x.years) : "—"]; });
    var s = {
      title: "EPS Pension Report", path: "salarist.in/eps-pension-calculator", url: location.origin + location.pathname, file: "salarist-eps-pension",
      question: r.eligible ? "How much EPS pension will I get, and when should I start it?" : "What do I get from EPS with less than 10 years of service?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#esVerdict p"), function (x) { return x.textContent; }), verdictColor: r.eligible ? "blue" : "amber",
      inputs: [["Service before 1 Sep 2014", yrsTxt(S.p1)], ["Service 1 Sep 2014 to 16 Sep 2026", yrsTxt(S.p2)], ["Service from 17 Sep 2026", yrsTxt(S.p3)],
        ["Average wages a month (last 60 months)", inr(S.wage), S.wage], ["Pension on actual wages (higher pension)", S.higher ? "Yes" : "No"], ["Pension starts at", String(S.start)]],
      keyNums: r.eligible ? [["Pension a month", inr(r.monthly), r.monthly], ["Pensionable service", yrsTxt(r.years + r.weight), 0], ["Pension a year", inr(r.monthly * 12), r.monthly * 12], ["Pension at 58", inr(r.at(58)), r.at(58)]]
        : [["Withdrawal benefit", inr(r.wb), r.wb], ["Months of service", String(r.months), 0], ["Table-IV factor", String(r.wbFactor), 0], ["Service still needed", yrsTxt(r.short / 12), 0]],
      sensTitle: "Pension by starting age", sens: r.eligible ? [50, 58, 60].map(function (x) { return ["Start at " + x, inr(r.at(x))]; }) : [], sensCurrent: [50, 58, 60].indexOf(S.start),
      chartTitle: "Total pension received by age", chartNote: "Upper line at the end: the later start. Lines: starting at " + S.start + " and at " + o + ".", xlsxChartTitle: "Total received (₹ lakh)",
      chart: { series: [{ name: "Starting at " + S.start, color: "blue", data: a }, { name: "Starting at " + o, color: "amber", data: b }], cross: null }, chartYears: cats, chartXLabel: "Age", chartAge0: 50,
      money: { title: "Pension by service period", cols: ["Pension a month", "Service"], rows: rowsMoney.concat([["Pension at 58", Math.max(MIN, r.raw), yrsTxt(r.years), "total"]]), note: $("esRule").textContent },
      tables: r.eligible ? [{ title: "Pension by starting age", sheet: "By age", cols: ["Starts at", "Pension a month", "Pension a year", "Total received by 85"], yearly: [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60].map(function (x) { var pm = r.at(x); return [String(x), pm, pm * 12, pm * 12 * (85 - x)]; }), monthly: null }]
        : [{ title: "Table-IV withdrawal benefit (EPS 2026), at your wages", sheet: "Table-IV", cols: ["Months of service", "Factor", "Withdrawal benefit"], yearly: T4.slice(0, 119).map(function (f, i) { return [String(i + 1), f.toFixed(2), f * r.pw]; }), monthly: null }],
      notes: ["Pension = (wages counted × years of service) ÷ 70 for each wage-ceiling period: ₹6,500 before 1 September 2014, ₹15,000 to 16 September 2026, ₹25,000 from 17 September 2026 (Employees' Pension Scheme, 2026, para 12(2)).",
        "Wages counted are your average wages over the last 60 months, capped at each period's ceiling unless you opted for pension on actual wages.",
        "2 years are added for 20 years or more of service, for a pension at 58 or later. Early pension from 50 is 4% less for each year before 58; deferring to 59 or 60 adds 4% a year. Minimum ₹1,000 a month.",
        "Service is counted here in years and months as entered; EPFO's own count of your service decides.",
        "Withdrawal benefit (under 10 years): Table-IV factor for your months of service × pensionable wages; payable after 36 months from your last contribution, or at 58 if earlier."],
      taxRules: ["EPS pension is taxed as salary income each year (standard deduction applies). The withdrawal benefit on leaving after 5 years of continuous service is generally tax-free."],
      short: short, inr: inr
    };
    if (!r.eligible) {
      var wb = []; for (var mo = 0; mo <= 120; mo++) wb.push(factor(Math.min(mo, 119)) * r.pw);
      var c10 = []; for (var yy = 0; yy <= 10; yy++) c10.push(yy);
      s.chart = { series: [{ name: "Withdrawal benefit", color: "blue", data: wb }], cross: null }; s.chartYears = c10; s.chartXLabel = "Years of service"; delete s.chartAge0;
      s.chartTitle = "Withdrawal benefit by length of service"; s.chartNote = "At your pensionable wages, from Table-IV. At 10 years you get a pension instead."; s.xlsxChartTitle = "Benefit (₹ lakh)";
      s.sensTitle = "Your choices"; s.sens = [["Withdrawal benefit", inr(r.wb)], ["Service still needed", yrsTxt(r.short / 12)], ["Pension at 58 with 10 years", inr(Math.max(MIN, r.pw * 10 / 70))]]; s.sensCurrent = 0;
    }
    return s;
  }
  function busy(b, on) { b.disabled = on; b.setAttribute("aria-busy", on ? "true" : "false"); }
  $("esPdf").addEventListener("click", function () { var b = this; busy(b, true); say("Making your PDF…"); withReport(function (Kt) { Kt.pdf(spec()).then(function () { busy(b, false); say("PDF report downloaded."); }, function () { busy(b, false); say("Couldn't make the PDF. Please try again."); }); }); });
  $("esXlsx").addEventListener("click", function () { var b = this; busy(b, true); withReport(function (Kt) { try { Kt.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(b, false); }); });
  $("esShare").addEventListener("click", function () {
    var q = new URLSearchParams(); Object.keys(NUM).forEach(function (k) { q.set(k, S[k]); }); q.set("higher", S.higher ? "1" : "0");
    var t = location.origin + location.pathname + "?" + q.toString();
    function ok() { say("Link copied. Anyone with it sees these numbers."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { say("Couldn't copy. Copy the address bar instead."); }); else say("Copy the address bar to share.");
  });
  (function bar() {
    var el = $("esBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("esVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".esx .lp-setup"));
    $("esBarBtn").addEventListener("click", function () { $("esVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
