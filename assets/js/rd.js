/* Salarist best day to resign. Runs entirely in the browser; nothing is stored or sent.
   Gratuity comes from the gratuity calculator's own code (gratuity.js). */
(function () {
  "use strict";
  var NODE = typeof module !== "undefined" && module.exports;
  var GR = NODE ? require("./gratuity.js") : window.SalaristGratuity;
  var DAY = 864e5, HORIZON = 365;

  /* ---------- Core ---------- */
  function parse(s) { var p = String(s).split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function iso(t) { var d = new Date(t); return d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + d.getUTCDate()).slice(-2); }
  function addDays(s, n) { return iso(parse(s) + n * DAY); }
  function days(a, b) { return Math.round((parse(b) - parse(a)) / DAY); }
  /* What you walk away with if your last working day is L.
     o: {today, join, type "permanent"|"fixed", basic, total (gross a month), notice (days), balance (earned leave now), perYear (earned leave a year),
         encashOn "basic"|"gross", bonus, bonusDate, bonusRule "rolls"|"notice", vests [{date, amt}], claw, clawDate, extra (new job's extra pay a month)} */
  function value(o, L) {
    var earliest = addDays(o.today, o.notice), resign = addDays(L, -o.notice);
    var g = GR.calc({ type: o.type, reason: "leave", employer: "covered", basic: o.basic, total: o.total, avg10: o.basic, join: o.join, leave: L, earlier: 0 });
    var leaveDays = o.balance + o.perYear * Math.max(0, days(o.today, L)) / 365;
    var leave = leaveDays * (o.encashOn === "gross" ? o.total : o.basic) / 30;
    var bonus = 0;
    if (o.bonus > 0 && o.bonusDate && o.bonusDate >= o.today) bonus = (o.bonusRule === "notice" ? resign >= o.bonusDate : L >= o.bonusDate) ? o.bonus : 0;
    var vested = (o.vests || []).reduce(function (s, v) { return s + (v.amt > 0 && v.date && v.date >= o.today && L >= v.date ? v.amt : 0); }, 0);
    var claw = o.claw > 0 && o.clawDate && L < o.clawDate ? o.claw : 0;
    var missed = o.extra * Math.max(0, days(earliest, L)) / (365 / 12);
    return { L: L, resign: resign, grat: g.grat, gEligible: g.eligible, leave: leave, leaveDays: leaveDays, bonus: bonus, vested: vested, claw: claw, missed: missed,
             total: g.grat + leave + bonus + vested - claw - missed };
  }
  /* Every possible last working day from the earliest (today + notice) for a year; the best is the highest total (the earliest if tied). */
  function calc(o) {
    var earliest = addDays(o.today, o.notice), path = [], best = null;
    for (var i = 0; i <= HORIZON; i++) {
      var v = value(o, addDays(earliest, i)); path.push(v);
      if (!best || v.total > best.total + 0.5) best = v;
    }
    var first = path[0], ms = [];
    /* Milestones: the first day each item changes */
    for (var k = 1; k < path.length; k++) {
      var a = path[k - 1], b = path[k];
      if (b.grat > a.grat + 1) ms.push({ L: b.L, kind: "grat", what: b.gEligible && !a.gEligible ? "Gratuity becomes payable" : "Gratuity counts one more year", amt: b.grat - a.grat });
      if (b.bonus > a.bonus) ms.push({ L: b.L, kind: "bonus", what: o.bonusRule === "notice" ? "Bonus paid before you resign" : "On the rolls on bonus day", amt: b.bonus - a.bonus });
      if (b.vested > a.vested) ms.push({ L: b.L, kind: "vest", what: "Stock vests", amt: b.vested - a.vested });
      if (b.claw < a.claw) ms.push({ L: b.L, kind: "claw", what: "Joining bonus no longer repayable", amt: a.claw - b.claw });
    }
    ms.forEach(function (m) { m.resign = addDays(m.L, -o.notice); });
    return { earliest: earliest, first: first, best: best, path: path, ms: ms, gain: best.total - first.total };
  }
  var API = { calc: calc, value: value, addDays: addDays, days: days };
  if (NODE) { module.exports = API; return; }
  window.SalaristResign = API;
  if (!document.getElementById("rdVerdict")) return;

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
  function dtxt(s) { return new Date(parse(s)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); }
  var now = new Date(), T = iso(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  function rel(m, d) { var x = new Date(parse(T)); return iso(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + m, d || x.getUTCDate())); }
  var S = { today: T, join: rel(-57), type: "permanent", basic: 50000, total: 120000, notice: 60, balance: 20, perYear: 18, encashOn: "basic",
            bonus: 200000, bonusDate: rel(5, 15), bonusRule: "rolls", v1d: rel(7, 15), v1a: 150000, v2d: "", v2a: 0, v3d: "", v3a: 0, claw: 0, clawDate: "", extra: 25000 };
  var NUM = { basic: [1000, 1e8], total: [1000, 1e8], notice: [0, 180], balance: [0, 300], perYear: [0, 60], bonus: [0, 1e9], v1a: [0, 1e9], v2a: [0, 1e9], v3a: [0, 1e9], claw: [0, 1e9], extra: [0, 1e8] };
  var MONEY = { basic: 1, total: 1, bonus: 1, v1a: 1, v2a: 1, v3a: 1, claw: 1, extra: 1 };
  var DATES = ["join", "bonusDate", "v1d", "v2d", "v3d", "clawDate"];
  var SEGS = { type: ["permanent", "fixed"], encashOn: ["basic", "gross"], bonusRule: ["rolls", "notice"] };
  (function fromUrl() {
    var q = new URLSearchParams(location.search), re = /^\d{4}-\d{2}-\d{2}$/;
    Object.keys(NUM).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= NUM[k][0] && v <= NUM[k][1]) S[k] = v; });
    Object.keys(SEGS).forEach(function (k) { if (SEGS[k].indexOf(q.get(k)) > -1) S[k] = q.get(k); });
    DATES.forEach(function (k) { if (q.has(k)) { var v = q.get(k) || ""; if (v === "" || re.test(v)) S[k] = v; } });
  })();
  function opts() { return { today: S.today, join: S.join, type: S.type, basic: S.basic, total: S.total, notice: S.notice, balance: S.balance, perYear: S.perYear, encashOn: S.encashOn,
    bonus: S.bonus, bonusDate: S.bonusDate, bonusRule: S.bonusRule, vests: [{ date: S.v1d, amt: S.v1a }, { date: S.v2d, amt: S.v2a }, { date: S.v3d, amt: S.v3a }], claw: S.claw, clawDate: S.clawDate, extra: S.extra }; }
  var shows = [];
  function bind(k) {
    var el = $("rd-" + k), note = $("rd-" + k + "-w"); if (!el) return;
    function show() { el.value = MONEY[k] ? fmt.format(S[k]) : String(S[k]); if (note) note.textContent = MONEY[k] ? words(S[k]) : ""; }
    el.addEventListener("input", function () {
      var raw = MONEY[k] ? this.value.replace(/[^0-9]/g, "") : this.value.replace(/[^0-9.]/g, "");
      if (MONEY[k]) this.value = raw ? fmt.format(+raw) : "";
      var v = parseFloat(raw); if (!isFinite(v)) { if (raw === "" && NUM[k][0] === 0) { S[k] = 0; render(); } return; }
      S[k] = Math.max(NUM[k][0], Math.min(NUM[k][1], v));
      if (note) note.textContent = MONEY[k] ? words(S[k]) : ""; render();
    });
    el.addEventListener("blur", show); shows.push(function () { if (document.activeElement !== el) show(); }); show();
  }
  Object.keys(NUM).forEach(bind);
  DATES.forEach(function (k) { var el = $("rd-" + k); el.value = S[k]; el.addEventListener("change", function () { if (this.value || k !== "join") { S[k] = this.value; render(); } }); });
  Object.keys(SEGS).forEach(function (k) { document.querySelectorAll("[data-" + k + "]").forEach(function (b) { b.addEventListener("click", function () { S[k] = b.getAttribute("data-" + k); render(); }); }); });
  function pressed(attr, val) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-" + attr) === String(val) ? "true" : "false"); }); }
  var last = null, ICON = { grat: "G", bonus: "B", vest: "S", claw: "J" };
  function chart(r) {
    var W = 420, Hh = 250, pl = 54, pr = 12, pt = 18, pb = 28, a = r.path, n = a.length - 1;
    var vals = a.map(function (v) { return v.total; }), lo = Math.min(0, Math.min.apply(null, vals)), hi = Math.max.apply(null, vals) || 1;
    var span = hi - lo || 1, st = Math.pow(10, Math.floor(Math.log10(span / 4))), qq = span / 4 / st; st *= qq <= 1 ? 1 : qq <= 2 ? 2 : qq <= 2.5 ? 2.5 : qq <= 5 ? 5 : 10;
    lo = Math.floor(lo / st) * st; hi = lo + st * Math.ceil((hi - lo) / st); if (hi === lo) hi = lo + st;
    function x(i) { return pl + i / n * (W - pl - pr); } function yy(v) { return pt + (hi - v) / (hi - lo) * (Hh - pt - pb); }
    var g = "", k; for (var v = lo; v <= hi + 1; v += st) { var gy = yy(v).toFixed(1); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+gy + 3) + '" class="al" text-anchor="end">' + short(v) + "</text>"; }
    var xl = ""; for (k = 0; k <= 12; k += 2) { var i = Math.min(n, Math.round(k * 30.44)), d = new Date(parse(a[i].L)); xl += '<text x="' + x(i).toFixed(1) + '" y="' + (Hh - 9) + '" class="al" text-anchor="' + (k === 12 ? "end" : k === 0 ? "start" : "middle") + '">' + d.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }) + "</text>"; }
    var p = a.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(v.total).toFixed(1); }).join("");
    var marks = r.ms.map(function (m) { var i = days(r.earliest, m.L); return '<g><line x1="' + x(i).toFixed(1) + '" x2="' + x(i).toFixed(1) + '" y1="' + pt + '" y2="' + (Hh - pb) + '" class="rd-ms"/><text x="' + x(i).toFixed(1) + '" y="' + (pt - 4) + '" class="al rd-mk" text-anchor="middle">' + ICON[m.kind] + "</text></g>"; }).join("");
    var bi = days(r.earliest, r.best.L);
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="What you walk away with, by last working day">' + g + xl + marks + '<path d="' + p + '" class="ln rent"/><circle cx="' + x(bi).toFixed(1) + '" cy="' + yy(r.best.total).toFixed(1) + '" r="5" class="rd-best"/></svg>';
  }
  function rowsOf(r) {
    var a = r.first, b = r.best;
    return [["Gratuity", a.grat, b.grat], ["Leave encashment (" + Math.round(a.leaveDays) + " → " + Math.round(b.leaveDays) + " days)", a.leave, b.leave], ["Bonus", a.bonus, b.bonus],
      ["Stock that vests", a.vested, b.vested], ["Joining bonus repaid", -a.claw, -b.claw], ["Extra pay missed at the new job", -a.missed, -b.missed], ["What you walk away with", a.total, b.total, "tot"]];
  }
  function render() {
    Object.keys(SEGS).forEach(function (k) { pressed(k, S[k]); });
    var r = calc(opts()); last = r; var b = r.best, same = b.L === r.earliest;
    $("rdVerdict").className = "verdict";
    $("rdVerdict").innerHTML = (same ? '<p class="k">Waiting doesn\'t add enough to be worth it</p><p class="v">Best last working day: <b>' + dtxt(b.L) + "</b>, the earliest you can leave</p>" +
        '<p class="k">Hand in your notice today (' + S.notice + " days). You'd walk away with about " + inr(b.total) + ".</p>"
      : '<p class="k">Hand in your notice on ' + dtxt(b.resign) + " (" + S.notice + ' days\' notice)</p><p class="v">Best last working day: <b>' + dtxt(b.L) + "</b></p>" +
        '<p class="k">That\'s about <b>' + inr(r.gain) + "</b> more than leaving at the earliest date (" + dtxt(r.earliest) + ")" + (S.extra ? ", after the extra pay you'd miss at the new job" : "") + ".</p>");
    $("rdS1").textContent = dtxt(b.L); $("rdS1h").textContent = "Resign on " + dtxt(b.resign);
    $("rdS2").textContent = short(b.total); $("rdS2h").textContent = "On that day, before tax";
    $("rdS3").textContent = (r.gain >= 0 ? "+" : "") + short(r.gain); $("rdS3h").textContent = "Against leaving on " + dtxt(r.earliest);
    $("rdS4").textContent = short(b.missed); $("rdS4h").textContent = S.extra ? "Extra pay missed by waiting" : "Add the new job's extra pay";
    $("rdChart").innerHTML = chart(r);
    $("rdMs").innerHTML = r.ms.length ? '<table class="calc"><thead><tr><th>Last day on or after</th><th>What changes</th><th>Adds</th><th>Hand in notice on or after</th></tr></thead><tbody>' +
      r.ms.map(function (m) { var on = m.L === b.L; return "<tr" + (on ? ' class="tot"' : "") + '><th scope="row">' + dtxt(m.L) + (on ? " ★" : "") + '</th><td data-l="What changes"><span class="rd-ic">' + ICON[m.kind] + "</span> " + m.what + '</td><td data-l="Adds">' + inr(m.amt) + '</td><td data-l="Notice on">' + dtxt(m.resign) + "</td></tr>"; }).join("") + "</tbody></table>"
      : '<p class="hint" style="padding:12px">Nothing unlocks in the next 12 months: add your bonus or vesting dates, or check your joining date.</p>';
    $("rdTable").innerHTML = '<table class="calc"><thead><tr><th></th><th>Leave ' + dtxt(r.earliest) + "</th><th>Leave " + dtxt(b.L) + "</th></tr></thead><tbody>" +
      rowsOf(r).map(function (x) { return "<tr" + (x[3] ? ' class="tot"' : "") + '><th scope="row">' + x[0] + '</th><td data-l="Earliest">' + inr(x[1]) + '</td><td data-l="Best">' + inr(x[2]) + "</td></tr>"; }).join("") + "</tbody></table>";
    var notes = [], g0 = r.first, gf = GR.calc({ type: S.type, reason: "leave", employer: "covered", basic: S.basic, total: S.total, avg10: S.basic, join: S.join, leave: r.earliest, earlier: 0 });
    if (!gf.eligible && gf.eligibleOn) notes.push("<b>Gratuity:</b> you complete " + gf.need + (gf.need === 1 ? " year" : " years") + " on " + gf.eligibleOn.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) + ". Your last working day has to be on or after that date.");
    if (S.bonusRule === "notice" && S.bonus) notes.push("<b>Bonus:</b> your policy pays only if you're not serving notice on bonus day, so you'd hand in your notice after it's paid, and your last day is " + S.notice + " days after that.");
    if (S.extra) notes.push("<b>Waiting has a cost:</b> each month you stay, you miss " + inr(S.extra) + " of extra pay at the new job, if it would wait for you.");
    notes.push("Amounts are before tax. Gratuity is tax-free up to ₹20 lakh in a lifetime; bonus, vested stock and leave encashment on resigning are taxed as salary (part of leave encashment can be tax-free).");
    $("rdRule").innerHTML = notes.join("<br><br>");
    $("rdBarT").textContent = "Best day " + dtxt(b.L);
    shows.forEach(function (f) { f(); });
  }

  /* ---------- Reports ---------- */
  function say(m) { var s = $("rdStatus"); s.textContent = m; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function spec() {
    var r = last, months = [], cats = [];
    for (var m = 0; m <= 12; m++) { var i = Math.min(r.path.length - 1, Math.round(m * 30.44)); cats.push(m); months.push(r.path[i]); }
    var data = []; months.forEach(function (v, i) { for (var k = 0; k < (i ? 12 : 1); k++) data.push(v.total); });
    var vests = [[S.v1d, S.v1a], [S.v2d, S.v2a], [S.v3d, S.v3a]].filter(function (v) { return v[0] && v[1]; });
    return {
      title: "Best Day to Resign Report", path: "salarist.in/best-day-to-resign", url: location.origin + location.pathname, file: "salarist-best-day-to-resign",
      question: "When should my last working day be, to leave with the most?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#rdVerdict p"), function (x) { return x.textContent; }), verdictColor: "blue",
      inputs: [["Joined on", dtxt(S.join)], ["Employment", S.type === "fixed" ? "Fixed-term" : "Permanent"], ["Basic + DA a month", inr(S.basic), S.basic], ["Gross pay a month", inr(S.total), S.total],
        ["Notice period", S.notice + " days"], ["Earned leave now / a year", S.balance + " / " + S.perYear + " days"], ["Leave encashed on", S.encashOn === "gross" ? "Gross pay" : "Basic + DA"],
        ["Bonus", S.bonus ? inr(S.bonus) + (S.bonusDate ? " on " + dtxt(S.bonusDate) : "") : "None"], ["Bonus paid if", S.bonusRule === "notice" ? "Not serving notice that day" : "On the rolls that day"]]
        .concat(vests.map(function (v, i) { return ["Stock vesting " + (i + 1), inr(v[1]) + " on " + dtxt(v[0])]; }))
        .concat([["Joining bonus to repay", S.claw && S.clawDate ? inr(S.claw) + " if you leave before " + dtxt(S.clawDate) : "None"], ["New job pays more by", inr(S.extra) + " a month"]]),
      keyNums: [["Best last working day", dtxt(r.best.L), 0], ["Hand in notice on", dtxt(r.best.resign), 0], ["You walk away with", short(r.best.total), r.best.total], ["More than leaving earliest", short(r.gain), r.gain]],
      sensTitle: "Last working day", sens: [["Earliest: " + dtxt(r.earliest), short(r.first.total)], ["Best: " + dtxt(r.best.L), short(r.best.total)], ["A year later", short(r.path[r.path.length - 1].total)]], sensCurrent: 1,
      chartTitle: "What you walk away with, by last working day", chartNote: "Gratuity, leave encashment, bonus and vested stock, less any joining bonus repaid and extra pay missed at the new job. Before tax.", xlsxChartTitle: "Walk away with (₹ lakh)",
      chart: { series: [{ name: "You walk away with", color: "blue", data: data }], cross: null }, chartYears: cats, chartXLabel: "Months after the earliest day", chartAge0: 0,
      money: { title: "Leaving at the earliest date vs the best date", cols: ["Best date", "Earliest"], rows: rowsOf(r).map(function (x) { return [x[0], x[2], inr(x[1]), x[3] ? "total" : undefined]; }), note: $("rdRule").textContent },
      tables: [{ title: "What each date unlocks", sheet: "Milestones", cols: ["Last day on or after", "What changes", "Adds", "Hand in notice on or after"], yearly: r.ms.map(function (m) { return [dtxt(m.L), m.what, m.amt, dtxt(m.resign)]; }), monthly: null }],
      notes: ["Last working day = the day you hand in your notice + your notice period (calendar days). The earliest is today + your notice period.",
        "Gratuity from the gratuity calculator's code: 5 years' service (1 for fixed-term), then a part-year of more than 6 months counts as a full year; wages of at least half your total pay; 15/26 × wages × years.",
        "Leave encashment: your balance plus leave you'd earn until your last day, × monthly " + (S.encashOn === "gross" ? "gross pay" : "basic + DA") + " ÷ 30. Your policy may cap the days paid on exit.",
        "Bonus and vesting: counted in full if your last day (or, for bonus, your resignation date) is on or after the date, as most policies say; check yours. Extra pay missed: the new job's extra pay for each month you stay beyond the earliest date."],
      taxRules: ["Gratuity is tax-free up to ₹20 lakh in a lifetime. Bonus and vested stock are taxed as salary. Leave encashment on resigning: tax-free up to the lowest of four limits under section 19 of the Income-tax Act, 2025."],
      short: short, inr: inr
    };
  }
  function busy(b, on) { b.disabled = on; b.setAttribute("aria-busy", on ? "true" : "false"); }
  $("rdPdf").addEventListener("click", function () { var b = this; busy(b, true); say("Making your PDF…"); withReport(function (Kt) { Kt.pdf(spec()).then(function () { busy(b, false); say("PDF report downloaded."); }, function () { busy(b, false); say("Couldn't make the PDF. Please try again."); }); }); });
  $("rdXlsx").addEventListener("click", function () { var b = this; busy(b, true); withReport(function (Kt) { try { Kt.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(b, false); }); });
  $("rdShare").addEventListener("click", function () {
    var q = new URLSearchParams(); Object.keys(NUM).forEach(function (k) { q.set(k, S[k]); }); Object.keys(SEGS).forEach(function (k) { q.set(k, S[k]); }); DATES.forEach(function (k) { q.set(k, S[k]); });
    var t = location.origin + location.pathname + "?" + q.toString();
    function ok() { say("Link copied. Anyone with it sees these numbers."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { say("Couldn't copy. Copy the address bar instead."); }); else say("Copy the address bar to share.");
  });
  (function bar() {
    var el = $("rdBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("rdVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".rdx .lp-setup"));
    $("rdBarBtn").addEventListener("click", function () { $("rdVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
