/* Salarist SWP calculator. Runs entirely in the browser; nothing is stored or sent.
   Uses the shared withdrawal engine (swp.js), the same one behind the FIRE calculator. */
(function () {
  "use strict";
  var NODE = typeof module !== "undefined" && module.exports;
  var SWP = NODE ? require("./swp.js") : window.SalaristSWP;
  var MAXY = 50;

  /* ---------- Core ---------- */
  /* o: {corpus, gains0, held, mode "last"|"take", withdraw, years, step, ret, kind "equity"|"debt", slab, fd} */
  function calc(o) {
    var tax = { kind: o.kind, slab: o.slab, held: o.held, gains0: o.gains0 }, r = { mode: o.mode };
    r.w = o.mode === "take" ? SWP.sustainable({ corpus: o.corpus, step: o.step, ret: o.ret, months: o.years * 12 }) : o.withdraw;
    var months = o.mode === "take" ? o.years * 12 : MAXY * 12;
    r.sim = SWP.taxed({ corpus: o.corpus, withdraw: r.w, step: o.step, ret: o.ret, months: months, tax: tax });
    r.lastsY = r.sim.ok ? null : r.sim.lasts / 12;
    r.rate = r.w * 12 / o.corpus;
    r.safe = [20, 30, 40].map(function (y) { return { y: y, w: SWP.sustainable({ corpus: o.corpus, step: o.step, ret: o.ret, months: y * 12 }) }; });
    /* FD paying monthly interest on the same amount: fixed, taxed at your slab, principal returned at the end */
    r.fdGross = o.corpus * o.fd / 100 / 12; r.fdNet = r.fdGross * (1 - o.slab / 100 * 1.04);
    r.cmp = [1, 10, 20].map(function (y) { var row = r.sim.rows[y - 1]; return { y: y, swp: row ? row.net / 12 : 0, fd: r.fdNet }; });
    return r;
  }
  var API = { calc: calc };
  if (NODE) { module.exports = API; return; }
  window.SalaristSWPTool = API;
  if (!document.getElementById("swVerdict")) return;

  /* ---------- UI ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var fmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  function inr(v) { var r = Math.round(v); return (r < 0 ? "−" : "") + "₹" + fmt.format(Math.abs(r)); }
  function short(v) {
    var a = Math.abs(v), s = v < 0 ? "−" : "";
    if (a >= 1e7) return s + "₹" + (a / 1e7).toFixed(a >= 1e8 ? 1 : 2).replace(/\.?0+$/, "") + " Cr";
    if (a >= 1e5) return s + "₹" + (a / 1e5).toFixed(a >= 1e6 ? 1 : 2).replace(/\.?0+$/, "") + " L";
    return s + "₹" + fmt.format(Math.round(a));
  }
  function words(v) { return v >= 1e5 ? short(v) : ""; }
  function yrs(y) { var Y = Math.floor(y), m = Math.round((y - Y) * 12); if (m === 12) { Y++; m = 0; } return Y + (Y === 1 ? " year" : " years") + (m ? " " + m + (m === 1 ? " month" : " months") : ""); }
  var S = { corpus: 10000000, gains0: 0, held: "no", mode: "last", withdraw: 50000, years: 30, step: 5, ret: 10, kind: "equity", slab: 20, fd: 7 };
  var NUM = { corpus: [10000, 1e11], gains0: [0, 1e11], withdraw: [100, 1e9], years: [1, 50], step: [0, 15], ret: [0, 20], fd: [0, 15] };
  var MONEY = { corpus: 1, gains0: 1, withdraw: 1 };
  var SEGS = { mode: ["last", "take"], kind: ["equity", "debt"], held: ["no", "yes"] };
  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    Object.keys(NUM).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= NUM[k][0] && v <= NUM[k][1]) S[k] = v; });
    Object.keys(SEGS).forEach(function (k) { if (SEGS[k].indexOf(q.get(k)) > -1) S[k] = q.get(k); });
    var sl = parseFloat(q.get("slab")); if ([0, 5, 10, 15, 20, 25, 30].indexOf(sl) > -1) S.slab = sl;
  })();
  var shows = [];
  function bind(k) {
    var el = $("sw-" + k), note = $("sw-" + k + "-w"); if (!el) return;
    function show() { el.value = MONEY[k] ? fmt.format(S[k]) : String(S[k]); if (note) note.textContent = MONEY[k] ? words(S[k]) : ""; }
    el.addEventListener("input", function () {
      var raw = MONEY[k] ? this.value.replace(/[^0-9]/g, "") : this.value.replace(/[^0-9.]/g, "");
      if (MONEY[k]) this.value = raw ? fmt.format(+raw) : "";
      var v = parseFloat(raw); if (!isFinite(v)) { if (raw === "" && NUM[k][0] === 0) { S[k] = 0; render(); } return; }
      if (v < NUM[k][0] || v > NUM[k][1]) return;
      S[k] = v; if (note) note.textContent = MONEY[k] ? words(S[k]) : ""; render();
    });
    el.addEventListener("blur", show); shows.push(function () { if (document.activeElement !== el) show(); }); show();
  }
  Object.keys(NUM).forEach(bind);
  Object.keys(SEGS).forEach(function (k) { document.querySelectorAll("[data-" + k + "]").forEach(function (b) { b.addEventListener("click", function () { S[k] = b.getAttribute("data-" + k); render(); }); }); });
  $("sw-slab").value = String(S.slab); $("sw-slab").addEventListener("change", function () { S.slab = +this.value; render(); });
  function pressed(attr, val) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-" + attr) === String(val) ? "true" : "false"); }); }
  function opts() { return { corpus: S.corpus, gains0: S.gains0, held: S.held === "yes", mode: S.mode, withdraw: S.withdraw, years: S.years, step: S.step, ret: S.ret, kind: S.kind, slab: S.slab, fd: S.fd }; }
  var last = null;
  function gainType(x) {
    if (x.gains < 1) return "None";
    if (S.kind === "debt") return "Slab";
    return x.st > 0 && x.lt > 0 ? "Short + long-term" : x.st > 0 ? "Short-term" : "Long-term";
  }
  function yrList(a) { return a.length === 1 ? "year " + a[0] : a.length === 2 ? "years " + a[0] + " and " + a[1] : "years " + a[0] + "–" + a[a.length - 1]; }
  /* Plain-language notes on how tax was worked out for these numbers (shown under the table and in the PDF/Excel) */
  function taxNotes(r) {
    var rows = rowsShown(r), y1 = rows[0], n = [], c = 1.04;
    n.push("Only the gain in each withdrawal is taxed; the rest is your own money coming back. In year 1, " + inr(y1.gains) + " of the " + inr(y1.withdrawn) + " you take out is gain" +
      (rows.length >= 10 ? "; by year 10, " + inr(rows[9].gains) + " of " + inr(rows[9].withdrawn) + "." : "."));
    if (S.kind === "equity") {
      if (S.held === "no" && y1.st > 0) n.push("Short-term in year 1: units sold within 12 months of investing are short-term, taxed at 20% plus 4% cess: " + inr(y1.st) + " × 20% × 1.04 = " + inr(y1.st * 0.2 * c) + ".");
      else n.push("Long-term from the start: you invested over a year ago, so every gain is long-term.");
      var zero = rows.filter(function (x) { return x.lt > 0 && x.st < 1 && x.tax < 1; }).map(function (x) { return x.year; });
      if (zero.length) n.push("₹0 tax in " + yrList(zero) + ": " + (zero.length === 1 ? "that year's" : "each year's") + " long-term gains" + (zero.length === 1 ? " (" + inr(rows[zero[0] - 1].lt) + ")" : "") + " are within the ₹1,25,000 a year of long-term gains that's tax-free on equity-oriented funds.");
      var t = rows.filter(function (x) { return x.lt > 125000; })[0];
      if (t) n.push("From year " + t.year + ", long-term gains above ₹1,25,000 are taxed at 12.5% plus cess: in year " + t.year + ", (" + inr(t.lt) + " − ₹1,25,000) × 12.5% × 1.04 = " + inr(Math.max(0, t.lt - 125000) * 0.125 * c) + ".");
      n.push("The ₹1,25,000 is per person, per tax year, across all your equity gains: if you sell other shares or equity funds in the same year, it's shared and your tax is higher.");
    } else {
      n.push("Debt fund or slab: every rupee of gain is taxed at your " + S.slab + "% slab plus 4% cess, with no yearly exemption (debt funds bought after 1 April 2023 get no long-term benefit). Year 1: " + inr(y1.gains) + " × " + S.slab + "% × 1.04 = " + inr(y1.tax) + ".");
      n.push("If your total income is low enough for the section 156 rebate (new regime, up to ₹12 lakh), slab tax could be nil; the calculator leaves the rebate out.");
    }
    n.push("Years here run from the month you start, not April to March, so in your tax return the gains may split a little differently between tax years. Surcharge is left out, and tax is paid from that year's withdrawals.");
    return n;
  }
  function rowsShown(r) { var rows = r.sim.rows; var n = r.lastsY != null ? Math.ceil(r.lastsY) : rows.length; return rows.slice(0, Math.min(rows.length, Math.max(n, 1))); }
  function chart(r) {
    var rows = rowsShown(r), n = rows.length, W = 420, Hh = 240, pl = 54, pr = 12, pt = 18, pb = 26, cum = 0;
    var bal = [S.corpus].concat(rows.map(function (x) { return x.bal; })), inc = [0].concat(rows.map(function (x) { cum += x.net; return cum; }));
    var max = Math.max.apply(null, bal.concat(inc).concat([1])), st = Math.pow(10, Math.floor(Math.log10(max / 4))), qq = max / 4 / st; st *= qq <= 1 ? 1 : qq <= 2 ? 2 : qq <= 2.5 ? 2.5 : qq <= 5 ? 5 : 10; max = st * 4;
    function x(i) { return pl + i / n * (W - pl - pr); } function yy(v) { return pt + (max - Math.max(0, v)) / max * (Hh - pt - pb); }
    var g = ""; for (var k = 0; k <= 4; k++) { var gy = yy(max * k / 4).toFixed(1); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+gy + 3) + '" class="al" text-anchor="end">' + short(max * k / 4) + "</text>"; }
    var stp = n > 30 ? 10 : n > 12 ? 5 : n > 6 ? 2 : 1, xl = ""; for (var t = 0; t <= n; t += stp) xl += '<text x="' + x(t).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">Yr ' + t + "</text>";
    function path(v) { return v.map(function (z, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(z).toFixed(1); }).join(""); }
    var mk = r.lastsY != null ? '<line x1="' + x(r.lastsY).toFixed(1) + '" x2="' + x(r.lastsY).toFixed(1) + '" y1="' + pt + '" y2="' + (Hh - pb) + '" class="rd-ms"/><text x="' + x(r.lastsY).toFixed(1) + '" y="' + (pt - 4) + '" class="al rd-mk" text-anchor="end">Runs out</text>' : "";
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Money left and income taken, year by year">' + g + xl + mk + '<path d="' + path(inc) + '" class="ln buy"/><path d="' + path(bal) + '" class="ln rent"/></svg>';
  }
  function render() {
    Object.keys(SEGS).forEach(function (k) { pressed(k, S[k]); });
    $("swLast").hidden = S.mode !== "last"; $("swTake").hidden = S.mode !== "take"; $("swSlabBox").hidden = false;
    var r = calc(opts()); last = r; var y1 = r.sim.rows[0];
    var v = $("swVerdict"), lasting = r.lastsY == null;
    if (S.mode === "last") {
      v.className = "verdict" + (lasting || r.lastsY >= 30 ? "" : " short");
      v.innerHTML = '<p class="k">Taking ' + inr(r.w) + " a month from " + short(S.corpus) + (S.step ? ", rising " + S.step + "% a year" : "") + ", at " + S.ret + '% a year</p><p class="v">' +
        (lasting ? "Lasts <b>over " + MAXY + " years</b>" : "Lasts <b>" + yrs(r.lastsY) + "</b>") + "</p>" +
        '<p class="k">' + (lasting ? "You'd still have " + short(r.sim.end) + " left after " + MAXY + " years." : "To make it last 30 years, take up to " + inr(r.safe[1].w) + " a month.") + " After tax, about " + inr(y1.net / 12) + " a month in the first year.</p>";
    } else {
      v.className = "verdict";
      v.innerHTML = '<p class="k">' + short(S.corpus) + " at " + S.ret + "% a year, for " + S.years + ' years</p><p class="v">You can take <b>' + inr(r.w) + "</b> a month</p>" +
        '<p class="k">' + (S.step ? "Rising " + S.step + "% a year, to " + inr(r.w * Math.pow(1 + S.step / 100, S.years - 1)) + " in year " + S.years + ". " : "The same every month. ") + "That's " + (r.rate * 100).toFixed(1) + "% of the amount in the first year.</p>";
    }
    $("swS1").textContent = inr(r.w); $("swS1h").textContent = "A month in year 1, before tax";
    $("swS2").textContent = inr(y1.net / 12); $("swS2h").textContent = "After tax, year 1";
    $("swS3").textContent = lasting ? (S.mode === "take" ? S.years + " years" : MAXY + "+ years") : yrs(r.lastsY); $("swS3h").textContent = "How long it lasts";
    $("swS4").textContent = short(r.sim.tax); $("swS4h").textContent = "Tax over " + (lasting ? r.sim.rows.length : Math.ceil(r.lastsY)) + " years";
    $("swChart").innerHTML = chart(r);
    $("swChartNote").textContent = "Blue: money left in your investments at each year end. Amber: total income you've taken, after tax. " +
      (r.lastsY != null ? "The blue line reaches zero when the money runs out." : r.sim.end > S.corpus ? "Here the blue line keeps rising: returns are more than you take out." : "The lines cross when you've taken out more, after tax, than is left.");
    $("swSafe").innerHTML = r.safe.map(function (s) { return '<div class="sv' + (S.mode === "take" && s.y === S.years ? " cur" : "") + '"><span class="l">To last ' + s.y + ' years</span><span class="n">' + inr(s.w) + '</span><span class="h">a month, ' + (s.w * 12 / S.corpus * 100).toFixed(1) + "% a year</span></div>"; }).join("");
    $("swFd").innerHTML = '<table class="calc"><thead><tr><th>After tax, a month</th><th>SWP</th><th>FD interest</th></tr></thead><tbody>' +
      r.cmp.map(function (c) { return '<tr><th scope="row">Year ' + c.y + '</th><td data-l="SWP">' + (c.swp ? inr(c.swp) : "Run out") + '</td><td data-l="FD">' + inr(c.fd) + "</td></tr>"; }).join("") + "</tbody></table>";
    $("swFdNote").textContent = "An FD at " + S.fd + "% pays " + inr(r.fdGross) + " a month before tax and keeps your " + short(S.corpus) + " intact, but the interest never rises and is taxed at your " + S.slab + "% slab. " +
      "The SWP draws down the amount, grows with inflation" + (S.kind === "equity" ? ", and only the gains in each withdrawal are taxed, at 12.5% above ₹1.25 lakh a year." : ", and only the gains in each withdrawal are taxed, at your slab.");
    function alt(ch) { var rr = calc(Object.assign(opts(), ch)); return S.mode === "take" ? inr(rr.w) + " a month" : rr.lastsY == null ? "Over " + MAXY + " years" : yrs(rr.lastsY); }
    r.what = S.mode === "take" ? [["Return 1% lower", alt({ ret: S.ret - 1 })], ["No yearly increase", alt({ step: 0 })], ["For 10 more years", alt({ years: Math.min(50, S.years + 10) })]]
      : [["Return 1% lower", alt({ ret: S.ret - 1 })], ["No yearly increase", alt({ step: 0 })], ["Take 10% less", alt({ withdraw: S.withdraw * 0.9 })]];
    $("swSens").innerHTML = r.what.map(function (w) { return '<div class="sv"><span class="l">' + w[0] + '</span><span class="n">' + w[1] + "</span></div>"; }).join("");
    $("swTable").innerHTML = '<table class="calc"><thead><tr><th>Year</th><th>Taken out</th><th>Gains in it</th><th>Gain type</th><th>Tax</th><th>Income after tax</th><th>Left at year end</th></tr></thead><tbody>' +
      rowsShown(r).map(function (x) { var z = S.kind === "equity" && x.tax < 1 && x.gains >= 1; return '<tr><th scope="row">' + x.year + '</th><td data-l="Taken out">' + inr(x.withdrawn) + '</td><td data-l="Gains">' + inr(x.gains) + '</td><td data-l="Gain type">' + gainType(x) + '</td><td data-l="Tax">' + inr(x.tax) + (z ? "*" : "") + '</td><td data-l="After tax">' + inr(x.net) + '</td><td data-l="Left">' + inr(x.bal) + "</td></tr>"; }).join("") + "</tbody></table>";
    r.taxNotes = taxNotes(r);
    $("swTaxNote").innerHTML = "<b>How tax is worked out here</b><ul>" + r.taxNotes.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>" +
      (rowsShown(r).some(function (x) { return S.kind === "equity" && x.tax < 1 && x.gains >= 1; }) ? "<p style=\"margin:6px 0 0\">* ₹0 tax: gains within the tax-free ₹1,25,000 a year (see above).</p>" : "");
    $("swBarT").textContent = S.mode === "take" ? inr(r.w) + " a month" : lasting ? "Lasts " + MAXY + "+ years" : "Lasts " + yrs(r.lastsY);
    shows.forEach(function (f) { f(); });
  }

  /* ---------- Reports ---------- */
  function say(m) { var s = $("swStatus"); s.textContent = m; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function spec() {
    var r = last, rows = rowsShown(r), cats = [0], bal = [S.corpus], inc = [0], cum = 0, prevC = 0;
    rows.forEach(function (x, i) { cats.push(i + 1); var pb = i ? rows[i - 1].bal : S.corpus; cum += x.net;
      for (var m = 1; m <= 12; m++) { bal.push(pb + (x.bal - pb) * m / 12); inc.push(prevC + (cum - prevC) * m / 12); } prevC = cum; });
    var marks = r.lastsY != null ? [{ i: Math.min(rows.length, Math.ceil(r.lastsY)), label: "Runs out", color: "red", symbol: "x", text: "The money runs out during this year (after " + yrs(r.lastsY) + ")." }] : [];
    return {
      title: "SWP Report", path: "salarist.in/swp-calculator", url: location.origin + location.pathname, file: "salarist-swp",
      question: S.mode === "take" ? "How much can I take out every month?" : "How long will my monthly withdrawals last?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#swVerdict p"), function (x) { return x.textContent; }), verdictColor: r.lastsY != null && r.lastsY < 30 ? "amber" : "blue",
      inputs: [["Money to draw from", inr(S.corpus), S.corpus], ["Gains already in it", inr(S.gains0), S.gains0], ["Invested over a year ago", S.held === "yes" ? "Yes" : "No"],
        [S.mode === "take" ? "For how long" : "Withdrawal a month", S.mode === "take" ? S.years + " years" : inr(S.withdraw), S.mode === "take" ? 0 : S.withdraw],
        ["Withdrawal rises each year", S.step + "%"], ["Return a year", S.ret + "%"], ["Taxed as", S.kind === "equity" ? "Equity-oriented fund" : "Debt fund or similar (slab)"], ["Your tax slab", S.slab + "%"], ["FD rate to compare", S.fd + "%"]],
      keyNums: [["A month, year 1", inr(r.w), r.w], ["After tax, year 1", inr(r.sim.rows[0].net / 12), r.sim.rows[0].net / 12], ["Lasts", r.lastsY == null ? (S.mode === "take" ? S.years + " years" : MAXY + "+ years") : yrs(r.lastsY), 0], ["Tax in all", short(r.sim.tax), r.sim.tax]],
      sensTitle: "What if", sens: r.what, sensCurrent: -1,
      chartTitle: "Money left and income taken", chartNote: "Blue: money left in your investments. Amber: total income taken, after tax." + (r.lastsY != null ? " Marked: when the money runs out." : ""), xlsxChartTitle: "Money left and income taken (₹ lakh)",
      chart: { series: [{ name: "Money left", color: "blue", data: bal }, { name: "Income taken, after tax", color: "amber", data: inc }], cross: null, vline: r.lastsY != null ? { m: Math.round(r.lastsY * 12), label: "Runs out" } : null },
      chartMarks: marks, chartYears: cats, chartXLabel: "Year",
      money: { title: "SWP or FD interest: income a month after tax", cols: ["SWP", "FD interest"], rows: r.cmp.map(function (c) { return ["Year " + c.y, c.swp, inr(c.fd)]; }), note: $("swFdNote").textContent },
      tables: [{ title: "Year by year", sheet: "By year", cols: ["Year", "Taken out", "Gains in it", "Gain type", "Tax", "Income after tax", "Left at year end"],
        yearly: rows.map(function (x) { return [String(x.year), x.withdrawn, x.gains, gainType(x), S.kind === "equity" && x.tax < 1 && x.gains >= 1 ? "₹0*" : x.tax, x.net, x.bal]; }), monthly: null,
        noteTitle: "How tax is worked out in your plan", note: r.taxNotes.concat(rows.some(function (x) { return S.kind === "equity" && x.tax < 1 && x.gains >= 1; }) ? ["* ₹0 tax: that year's gains are within the tax-free ₹1,25,000 a year (above)."] : []) }],
      notes: ["Each month the withdrawal is taken first, then the rest earns a month's return (" + S.ret + "% a year). The withdrawal rises " + S.step + "% every 12 months.",
        "Tax: only the gain in each withdrawal is taxed (average cost). " + (S.kind === "equity" ? "Equity-oriented funds: 12.5% on long-term gains above ₹1.25 lakh a year, 20% on gains from units held under 12 months." : "Debt funds: gains at your " + S.slab + "% slab.") + " 4% cess; surcharge and the section 156 rebate left out. Tax is paid out of that year's withdrawals.",
        "FD: interest paid monthly at " + S.fd + "%, taxed at your slab; the amount stays the same and is returned at the end.",
        "Years run from the month you start, not April to March."],
      taxRules: ["Income-tax Act, 2025: long-term capital gains on equity-oriented funds taxed at 12.5% above ₹1.25 lakh a year; short-term at 20%. Debt mutual funds bought after 1 April 2023 taxed at slab rates. FD interest at slab rates."],
      short: short, inr: inr
    };
  }
  function busy(b, on) { b.disabled = on; b.setAttribute("aria-busy", on ? "true" : "false"); }
  $("swPdf").addEventListener("click", function () { var b = this; busy(b, true); say("Making your PDF…"); withReport(function (Kt) { Kt.pdf(spec()).then(function () { busy(b, false); say("PDF report downloaded."); }, function () { busy(b, false); say("Couldn't make the PDF. Please try again."); }); }); });
  $("swXlsx").addEventListener("click", function () { var b = this; busy(b, true); withReport(function (Kt) { try { Kt.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(b, false); }); });
  $("swShare").addEventListener("click", function () {
    var q = new URLSearchParams(); Object.keys(NUM).forEach(function (k) { q.set(k, S[k]); }); Object.keys(SEGS).forEach(function (k) { q.set(k, S[k]); }); q.set("slab", S.slab);
    var t = location.origin + location.pathname + "?" + q.toString();
    function ok() { say("Link copied. Anyone with it sees these numbers."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { say("Couldn't copy. Copy the address bar instead."); }); else say("Copy the address bar to share.");
  });
  (function bar() {
    var el = $("swBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("swVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".swx .lp-setup"));
    $("swBarBtn").addEventListener("click", function () { $("swVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
