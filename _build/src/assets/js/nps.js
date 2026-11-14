/* Salarist NPS calculator. Runs entirely in the browser; nothing is stored or sent. */
(function () {
  "use strict";
  var CESS = 1.04, L8 = 800000, L12 = 1200000, SIX = 600000, CAP = 750000;

  /* ---------- Core ---------- */
  /* Corpus at exit. o: {age, exitAge, balance, own (a month), emp (a month), step (% a year), ret (% a year)} */
  function grow(o) {
    var g = Math.pow(1 + o.ret / 100, 1 / 12) - 1, bal = o.balance, own = o.own, emp = o.emp, rows = [], putOwn = 0, putEmp = 0;
    var years = Math.max(0, Math.round(o.exitAge - o.age));
    for (var y = 1; y <= years; y++) {
      var yo = 0, ye = 0;
      for (var m = 0; m < 12; m++) { bal = bal * (1 + g) + own + emp; yo += own; ye += emp; }
      putOwn += yo; putEmp += ye;
      rows.push({ y: y, age: o.age + y, own: yo, emp: ye, bal: bal });
      own *= 1 + o.step / 100; emp *= 1 + o.step / 100;
    }
    return { corpus: bal, rows: rows, putOwn: putOwn, putEmp: putEmp, years: years };
  }
  /* Normal exit (at 60 or later) under the PFRDA (Exits and Withdrawals under NPS) (Amendment) Regulations, 2025.
     sector: "private" (All Citizen, Corporate) or "govt". choice: "max" (most allowed) or "free" (only the tax-free 60%).
     Returns the most you can take as a lump sum and the split chosen. */
  function maxLump(c, sector) {
    if (c <= L8) return c;
    if (sector === "govt") return c <= L12 ? Math.max(SIX, 0.6 * c) : 0.6 * c;
    return 0.8 * c;
  }
  function exit(c, sector, choice) {
    var mx = maxLump(c, sector), free = 0.6 * c, lump = choice === "free" ? Math.min(free, mx) : mx;
    return { max: mx, lump: lump, annuity: c - lump, taxFree: Math.min(lump, free), taxable: Math.max(0, lump - free) };
  }
  /* New-regime tax for a tax year (section 202(1) rates, section 156 rebate with marginal relief, surcharge without marginal relief, 4% cess). */
  var NEW_SLABS = [[400000, 0], [800000, 0.05], [1200000, 0.10], [1600000, 0.15], [2000000, 0.20], [2400000, 0.25], [Infinity, 0.30]];
  function newTax(inc) {
    var t = 0, lo = 0;
    for (var i = 0; i < NEW_SLABS.length; i++) { var hi = NEW_SLABS[i][0]; if (inc > lo) t += (Math.min(inc, hi) - lo) * NEW_SLABS[i][1]; lo = hi; }
    if (inc <= 1200000) t = 0; else t = Math.min(t, inc - 1200000);
    var sc = inc > 20000000 ? 0.25 : inc > 10000000 ? 0.15 : inc > 5000000 ? 0.10 : 0;
    return t * (1 + sc) * CESS;
  }
  /* Everything for the "My NPS at retirement" view. */
  function plan(o) {
    var gr = grow(o), c = gr.corpus, ex = exit(c, o.sector, o.choice), t = o.slab / 100 * CESS;
    var pension = ex.annuity * o.annuity / 100 / 12, defl = Math.pow(1 + o.infl / 100, gr.years);
    var ownTaxSave = o.regime === "old" ? Math.min(o.own * 12, 50000) * t : 0;
    var penYear = pension * 12;
    return { gr: gr, corpus: c, ex: ex, lumpTax: newTax(ex.taxable + penYear) - newTax(penYear), penTax: newTax(penYear), pension: pension, 
             realCorpus: c / defl, realPension: pension / defl, defl: defl, put: o.balance + gr.putOwn + gr.putEmp, ownTaxSave: ownTaxSave };
  }
  /* Employer NPS check: move part of pay into employer NPS without changing CTC.
     e: {basic (basic + DA a month), nowPct, newPct, regime, sector, slab, pf (employer PF a year), yrs, ret} */
  function employer(e) {
    var bYear = e.basic * 12, limPct = e.regime === "new" || e.sector === "govt" ? 14 : 10, lim = bYear * limPct / 100;
    var now = bYear * e.nowPct / 100, nw = bYear * e.newPct / 100, extra = Math.max(0, nw - now), t = e.slab / 100 * CESS;
    function taxable(empNps) { /* the part of employer NPS that isn't deductible, plus the part over the ₹7.5 lakh cap, is taxed */
      var notDed = Math.max(0, empNps - lim), over = Math.max(0, empNps + e.pf - CAP);
      return Math.max(notDed, over);
    }
    var taxNow = taxable(now) * t, taxNew = taxable(nw) * t;
    /* Salary falls by `extra` (CTC unchanged); tax falls on the salary removed, less any tax on employer NPS that isn't covered. */
    var saved = extra * t - (taxNew - taxNow);
    var g = Math.pow(1 + e.ret / 100, 1 / 12) - 1, fv = 0;
    for (var m = 0; m < e.yrs * 12; m++) fv = fv * (1 + g) + extra / 12;
    return { limPct: limPct, lim: lim, now: now, nw: nw, extra: extra, saved: saved, takeHome: (saved - extra) / 12, fv: fv,
             overLimit: Math.max(0, nw - lim), overCap: Math.max(0, nw + e.pf - CAP), costPerRupee: extra > 0 ? (extra - saved) / extra : 0 };
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { newTax: newTax, grow: grow, exit: exit, maxLump: maxLump, plan: plan, employer: employer }; return; }
  window.SalaristNPS = { newTax: newTax, grow: grow, exit: exit, maxLump: maxLump, plan: plan, employer: employer };
  if (!document.getElementById("np-age")) return;  /* core only (used by the retirement planner) */

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
  function H(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var S = { mode: "plan", sector: "private", choice: "max", regime: "new", slab: 20,
            age: 30, exitAge: 60, balance: 200000, own: 5000, emp: 0, step: 5, ret: 10, annuity: 6.5, infl: 6,
            basic: 60000, nowPct: 0, newPct: 14, pf: 86400 };
  var NUM = { age: [18, 59], exitAge: [60, 75], balance: [0, 1e9], own: [0, 1e7], emp: [0, 1e7], step: [0, 20], ret: [1, 16], annuity: [1, 12], infl: [0, 12],
              basic: [1000, 1e8], nowPct: [0, 14], newPct: [0, 14], pf: [0, 1e8] };
  var MONEY = { balance: 1, own: 1, emp: 1, basic: 1, pf: 1 };
  var SLABS = [0, 5, 10, 15, 20, 25, 30];
  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    Object.keys(NUM).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= NUM[k][0] && v <= NUM[k][1]) S[k] = v; });
    if (q.get("mode") === "emp") S.mode = "emp";
    if (q.get("sector") === "govt") S.sector = "govt";
    if (q.get("choice") === "free") S.choice = "free";
    if (q.get("regime") === "old") S.regime = "old";
    var sl = parseInt(q.get("slab"), 10); if (SLABS.indexOf(sl) > -1) S.slab = sl;
  })();
  var shows = [];
  function bind(k, id) {
    var el = $(id || "np-" + k), note = $((id || "np-" + k) + "-w"); if (!el) return;
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
  bind("ret", "np-ret2");
  function seg(attr, key) {
    document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.addEventListener("click", function () { S[key] = b.getAttribute("data-" + attr); render(); }); });
  }
  seg("mode", "mode"); seg("sector", "sector"); seg("choice", "choice"); seg("regime", "regime");
  $("np-slab").addEventListener("change", function () { S.slab = parseInt(this.value, 10); render(); });
  $("np-slab").value = String(S.slab);
  function pressed(attr, val) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-" + attr) === String(val) ? "true" : "false"); }); }
  function yrs(n) { return n + (n === 1 ? " year" : " years"); }
  function P() { return plan(S); }
  function E() { return employer({ basic: S.basic, nowPct: S.nowPct, newPct: S.newPct, regime: S.regime, sector: S.sector, slab: S.slab, pf: S.pf, yrs: Math.max(0, 60 - S.age), ret: S.ret }); }

  var last = null;
  function chart(r) {
    var W = 420, Hh = 240, pl = 54, pr = 14, pt = 20, pb = 26, rows = r.gr.rows, n = rows.length || 1;
    var bal = [S.balance].concat(rows.map(function (x) { return x.bal; })), put = [S.balance], acc = S.balance;
    rows.forEach(function (x) { acc += x.own + x.emp; put.push(acc); });
    var max = Math.max.apply(null, bal) || 1, st = Math.pow(10, Math.floor(Math.log10(max / 4))), qq = max / 4 / st; st *= qq <= 1 ? 1 : qq <= 2 ? 2 : qq <= 2.5 ? 2.5 : qq <= 5 ? 5 : 10; max = st * 4;
    function x(i) { return pl + i / n * (W - pl - pr); } function yy(v) { return pt + (max - v) / max * (Hh - pt - pb); }
    function path(a) { return a.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(v).toFixed(1); }).join(""); }
    var g = ""; for (var k = 0; k <= 4; k++) { var gy = yy(max * k / 4).toFixed(1); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+gy + 3) + '" class="al" text-anchor="end">' + short(max * k / 4) + "</text>"; }
    var stp = n > 24 ? 5 : n > 12 ? 3 : n > 6 ? 2 : 1, xl = ""; for (var t = 0; t <= n; t += stp) xl += '<text x="' + x(t).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">' + (S.age + t) + "</text>";
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="NPS balance by age">' + g + xl + '<path d="' + path(put) + '" class="ln buy"/><path d="' + path(bal) + '" class="ln rent"/></svg>';
  }
  var RETS = [8, 10, 12];
  function sensRows() {
    var s = RETS.slice(); if (s.indexOf(S.ret) < 0) { s.push(S.ret); s.sort(function (a, b) { return a - b; }); }
    return s.map(function (rt) { var p = plan(Object.assign({}, S, { ret: rt })); return { ret: rt, corpus: p.corpus, pension: p.pension }; });
  }
  function tableHtml(r) {
    var rows = r.gr.rows.map(function (w) {
      return '<tr><th scope="row">' + w.age + '</th><td data-l="You put in">' + inr(w.own) + '</td><td data-l="Employer put in">' + inr(w.emp) + '</td><td data-l="Balance">' + inr(w.bal) + "</td></tr>";
    }).join("");
    return '<table class="calc"><thead><tr><th>Age</th><th>You put in</th><th>Employer put in</th><th>Balance at the end</th></tr></thead><tbody>' + rows + "</tbody></table>";
  }
  function splitRows(r) {
    var ex = r.ex;
    return [["Lump sum, tax-free (up to 60%)", ex.taxFree], ["Lump sum, taxable (above 60%)", ex.taxable], ["Tax on the taxable part, about", r.lumpTax], ["Goes into an annuity (pension)", ex.annuity]];
  }
  function ruleLine(c) {
    if (c <= L8) return "Your corpus is ₹8 lakh or less, so you can take all of it out (as a lump sum or in instalments).";
    if (S.sector === "govt") return c <= L12 ? "Between ₹8 lakh and ₹12 lakh: up to ₹6 lakh as a lump sum (rest in instalments over at least 6 years, or an annuity), or 60% lump sum with 40% annuity." : "Government subscribers: up to 60% as a lump sum, at least 40% into an annuity.";
    return c <= L12 ? "Between ₹8 lakh and ₹12 lakh: up to 80% as a lump sum with 20% annuity, or ₹6 lakh with the rest in instalments over at least 6 years." : "Non-government subscribers: up to 80% as a lump sum, at least 20% into an annuity.";
  }
  function renderPlan() {
    var r = P(); last = { mode: "plan", r: r };
    var ex = r.ex, ageT = S.exitAge;
    $("npVerdict").innerHTML = '<p class="k">At ' + ageT + ", after " + yrs(r.gr.years) + '</p><p class="v">Your NPS could be about <b>' + short(r.corpus) + "</b></p>" +
      '<p class="k">Take ' + short(ex.lump) + " as a lump sum" + (ex.taxable > 0 ? " (" + short(ex.taxable) + " of it taxable)" : ", all tax-free") + (ex.annuity > 1 ? ", and get a pension of about " + inr(r.pension) + " a month from the rest." : ".") + "</p>";
    $("npS1").textContent = short(r.corpus); $("npS1h").textContent = "About " + short(r.realCorpus) + " in today's money";
    $("npS2").textContent = short(ex.lump); $("npS2h").textContent = ex.taxable > 0 ? short(ex.taxable) + " above the tax-free 60%" : "All within the tax-free 60%";
    $("npS3").textContent = ex.annuity > 1 ? inr(r.pension) : "—"; $("npS3h").textContent = ex.annuity > 1 ? "Before tax" + (r.penTax > 0 ? " (about " + inr(r.penTax / 12) + " a month)" : ", and no tax at today's rates if it's your only income") + " · " + inr(r.realPension) + " in today's money" : "No annuity needed";
    $("npS4").textContent = short(r.put); $("npS4h").textContent = "Growth: " + short(r.corpus - r.put);
    var notes = [ruleLine(r.corpus)];
    if (ex.taxable > 0) notes.push("<b>Tax gap:</b> PFRDA lets you take more than 60% as a lump sum, but only 60% of the corpus is tax-free under Schedule II, S. No. 6 of the Income-tax Act, 2025. The extra " + short(ex.taxable) + " is added to your income in the year you exit: about " + inr(r.lumpTax) + " in tax under the new regime, if your only other income that year is the pension.");
    else if (ex.lump < ex.max - 1) notes.push("You could take up to " + short(ex.max) + " as a lump sum; taking only 60% keeps it all tax-free and puts more into the annuity.");
    if (S.regime === "old" && S.own > 0) notes.push("<b>Old regime:</b> your own contribution can save about " + inr(r.ownTaxSave) + " a year under section 124(3) (up to ₹50,000, over and above ₹1.5 lakh). The new regime has no deduction for your own contribution.");
    $("npRule").innerHTML = notes.join("<br><br>");
    $("npChart").innerHTML = chart(r);
    $("npSplit").innerHTML = '<table class="calc"><thead><tr><th>At exit</th><th>Amount</th></tr></thead><tbody>' + splitRows(r).map(function (x) { return '<tr><th scope="row">' + x[0] + '</th><td data-l="Amount">' + inr(x[1]) + "</td></tr>"; }).join("") +
      '<tr class="tot"><th scope="row"><b>Total corpus</b></th><td data-l="Amount"><b>' + inr(r.corpus) + "</b></td></tr></tbody></table>";
    r.sens = sensRows();
    $("npSens").innerHTML = r.sens.map(function (s) { return '<div class="sv' + (s.ret === S.ret ? " cur" : "") + '"><span class="l">' + s.ret + '% a year</span><span class="n">' + short(s.corpus) + '</span><span class="h">Pension about ' + inr(s.pension) + " a month</span></div>"; }).join("");
    $("npTable").innerHTML = tableHtml(r);
    $("npBarT").textContent = short(r.corpus) + " at " + ageT;
  }
  function renderEmp() {
    var e = E(); last = { mode: "emp", e: e };
    var pct = S.newPct - S.nowPct;
    if (e.extra <= 0) {
      $("npVerdict").innerHTML = '<p class="k">Employer NPS check</p><p class="v">Set the new employer NPS higher than today\'s to see the effect</p>';
    } else {
      $("npVerdict").innerHTML = '<p class="k">Moving ' + pct + "% of basic (" + inr(e.extra) + ' a year) into employer NPS</p><p class="v">You save about <b>' + inr(e.saved) + "</b> in tax a year</p>" +
        '<p class="k">Your take-home falls by about ' + inr(-e.takeHome) + " a month, but " + inr(e.extra / 12) + " a month goes into your NPS. Every ₹1 moved costs you about " + (e.costPerRupee * 100).toFixed(0) + " paise of take-home.</p>";
    }
    $("npE1").textContent = inr(e.saved); $("npE2").textContent = inr(e.takeHome); $("npE3").textContent = inr(e.extra);
    $("npE4").textContent = short(e.fv); $("npE4h").textContent = "If kept until 60 at " + S.ret + "% a year";
    var n = ["<b>Deduction limit:</b> " + e.limPct + "% of basic + DA = " + inr(e.lim) + " a year (" + (S.regime === "new" ? "new regime" : S.sector === "govt" ? "government employer" : "old regime, private employer") + ", section 124 of the Income-tax Act, 2025)."];
    if (e.overLimit > 0) n.push("<b>Above the limit:</b> " + inr(e.overLimit) + " a year of employer NPS isn't deductible, so it stays taxable.");
    if (e.overCap > 0) n.push("<b>₹7.5 lakh cap:</b> employer PF plus NPS comes to " + inr(e.nw + S.pf) + " a year. The " + inr(e.overCap) + " above ₹7.5 lakh is taxed as a perquisite (section 17 of the 2025 Act).");
    if (S.slab === 0) n.push("At a 0% slab there's no tax to save, so moving pay into NPS only locks it away until 60.");
    $("npRule").innerHTML = n.join("<br><br>");
    $("npBarT").textContent = "Saves " + inr(e.saved) + " a year";
  }
  function render() {
    shows.forEach(function (f) { f(); });
    pressed("mode", S.mode); pressed("sector", S.sector); pressed("choice", S.choice); pressed("regime", S.regime);
    var emp = S.mode === "emp";
    $("np-slabWrap").hidden = !emp && S.regime === "new";
    document.querySelectorAll(".np-plan").forEach(function (el) { el.hidden = emp; });
    document.querySelectorAll(".np-emp").forEach(function (el) { el.hidden = !emp; });
    if (emp) renderEmp(); else renderPlan();
  }

  /* ---------- Reports ---------- */
  function say(m) { var s = $("npStatus"); s.textContent = m; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  var TAXRULES = ["Exit rules: PFRDA (Exits and Withdrawals under the National Pension System) (Amendment) Regulations, 2025. Normal exit: non-government subscribers up to 80% lump sum, at least 20% annuity; government subscribers up to 60%, at least 40%. Corpus up to ₹8 lakh: all of it can be withdrawn. ₹8 lakh to ₹12 lakh: up to ₹6 lakh lump sum with the rest in instalments over at least 6 years, or the usual split.",
    "Tax on the lump sum: Schedule II, S. No. 6 of the Income-tax Act, 2025 exempts a payment from the NPS Trust on closure up to 60% of the total amount payable. Anything above that is added to your income for the year. The annuity pension is taxed as income each year.",
    "Contributions: section 124 of the Income-tax Act, 2025. Employer contribution deductible up to 14% of basic + DA under the new regime or for government employers, 10% for private employers under the old regime. Your own contribution: up to ₹50,000 extra under section 124(3), old regime only. Employer PF + NPS + superannuation above ₹7.5 lakh a year is a taxable perquisite (section 17)."];
  function specPlan(r) {
    var cats = [S.age], ser = [S.balance];
    r.gr.rows.forEach(function (w) { cats.push(w.age); });
    var monthly = [S.balance], g = Math.pow(1 + S.ret / 100, 1 / 12) - 1, bal = S.balance, own = S.own, emp = S.emp;
    for (var y = 0; y < r.gr.years; y++) { for (var m = 0; m < 12; m++) { bal = bal * (1 + g) + own + emp; monthly.push(bal); } own *= 1 + S.step / 100; emp *= 1 + S.step / 100; }
    var putM = [S.balance], acc = S.balance; own = S.own; emp = S.emp;
    for (y = 0; y < r.gr.years; y++) { for (m = 0; m < 12; m++) { acc += own + emp; putM.push(acc); } own *= 1 + S.step / 100; emp *= 1 + S.step / 100; }
    var sens = r.sens.filter(function (s, i, a) { return a.length <= 3 || s.ret !== 8 || S.ret === 8; }).slice(0, 3);
    return {
      title: "NPS Retirement Report", path: "salarist.in/nps-calculator", url: location.origin + location.pathname, file: "salarist-nps",
      question: "How much will my NPS be worth at " + S.exitAge + ", and what can I take out?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#npVerdict p"), function (p) { return p.textContent; }), verdictColor: "blue",
      inputs: [["Age now", String(S.age)], ["Exit age", String(S.exitAge)], ["Subscriber type", S.sector === "govt" ? "Government" : "Non-government (All Citizen or Corporate)"], ["NPS balance now", inr(S.balance), S.balance],
        ["You put in a month", inr(S.own), S.own], ["Employer puts in a month", inr(S.emp), S.emp], ["Increase each year", S.step + "%"], ["Expected return", S.ret + "% a year"],
        ["Lump sum", S.choice === "free" ? "Only the tax-free 60%" : "Most allowed"], ["Annuity rate", S.annuity + "% a year"], ["Tax slab now", S.slab + "% + cess"], ["Inflation", S.infl + "% a year"], ["Tax regime now", S.regime === "new" ? "New" : "Old"]],
      keyNums: [["Corpus at " + S.exitAge, short(r.corpus), r.corpus], ["Lump sum", short(r.ex.lump), r.ex.lump], ["Pension a month", r.ex.annuity > 1 ? inr(r.pension) : "—", r.pension], ["You and employer put in", short(r.put), r.put]],
      sensTitle: "Corpus at other returns", sens: sens.map(function (s) { return [s.ret + "% a year", short(s.corpus)]; }), sensCurrent: sens.map(function (s) { return s.ret; }).indexOf(S.ret),
      chartTitle: "NPS balance by age", chartNote: "Upper line: balance. Lower line: what you and your employer put in.", xlsxChartTitle: "Balance (₹ lakh)",
      chart: { series: [{ name: "NPS balance", color: "blue", data: monthly }, { name: "Put in", color: "amber", data: putM }], cross: null }, chartYears: cats, chartXLabel: "Age", chartAge0: S.age,
      money: { title: "What happens at exit", cols: ["Amount", "Share of corpus"], rows: splitRows(r).map(function (x) { return [x[0], x[1], r.corpus ? (x[1] / r.corpus * 100).toFixed(1) + "%" : "—"]; }).concat([["Total corpus", r.corpus, "100%", "total"]]),
        note: $("npRule").textContent },
      tables: [{ title: "Year by year", sheet: "By year", cols: ["Age", "You put in", "Employer put in", "Balance at the end"], yearly: r.gr.rows.map(function (w) { return [String(w.age), w.own, w.emp, w.bal]; }), monthly: null }],
      notes: notes(), taxRules: TAXRULES, short: short, inr: inr
    };
  }
  function specEmp(e) {
    return {
      title: "Employer NPS Report", path: "salarist.in/nps-calculator", url: location.origin + location.pathname, file: "salarist-employer-nps",
      question: "Should I move part of my pay into employer NPS?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#npVerdict p"), function (p) { return p.textContent; }), verdictColor: "blue",
      inputs: [["Basic + DA a month", inr(S.basic), S.basic], ["Employer NPS now", S.nowPct + "% of basic"], ["Employer NPS proposed", S.newPct + "% of basic"], ["Tax regime", S.regime === "new" ? "New" : "Old"],
        ["Employer", S.sector === "govt" ? "Government" : "Private"], ["Tax slab", S.slab + "% + cess"], ["Employer PF a year", inr(S.pf), S.pf], ["Age now", String(S.age)], ["Expected return", S.ret + "% a year"]],
      keyNums: [["Tax saved a year", inr(e.saved), e.saved], ["Take-home change a month", inr(e.takeHome), e.takeHome], ["Extra into NPS a year", inr(e.extra), e.extra], ["Extra NPS by 60", short(e.fv), e.fv]],
      sensTitle: "Tax saved a year at other slabs", sens: [10, 20, 30].map(function (sl) { var x = employer({ basic: S.basic, nowPct: S.nowPct, newPct: S.newPct, regime: S.regime, sector: S.sector, slab: sl, pf: S.pf, yrs: Math.max(0, 60 - S.age), ret: S.ret }); return [sl + "% slab", inr(x.saved)]; }),
      sensCurrent: [10, 20, 30].indexOf(S.slab),
      chartTitle: "Extra NPS from the switch", chartNote: "The extra employer contribution, growing until 60.", xlsxChartTitle: "Extra NPS (₹ lakh)",
      chart: (function () { var d = [0], g = Math.pow(1 + S.ret / 100, 1 / 12) - 1, fv = 0, n = Math.max(1, 60 - S.age), c = [S.age]; for (var m = 0; m < n * 12; m++) { fv = fv * (1 + g) + e.extra / 12; d.push(fv); } for (var y = 1; y <= n; y++) c.push(S.age + y); return { series: [{ name: "Extra NPS", color: "blue", data: d }], cross: null, years: c }; })(),
      chartXLabel: "Age", chartAge0: S.age, chartYears: (function () { var c = [S.age]; for (var y = 1; y <= Math.max(1, 60 - S.age); y++) c.push(S.age + y); return c; })(),
      money: { title: "Your pay, a year", cols: ["Now", "With the switch"], rows: [["Employer NPS", e.now, e.nw], ["Deductible employer NPS", Math.min(e.now, e.lim), Math.min(e.nw, e.lim)], ["Tax saved vs now", 0, e.saved], ["Take-home change", 0, e.takeHome * 12, "total"]], note: $("npRule").textContent },
      tables: [], notes: notes(), taxRules: TAXRULES, short: short, inr: inr
    };
  }
  function notes() {
    return ["Returns are your estimate and aren't guaranteed. NPS returns depend on your fund choice and the markets.",
      "Contributions are made monthly and grow at the return you set, compounded monthly. Contributions rise by your yearly increase.",
      "The pension assumes an annuity bought at exit at the rate you set; actual annuity rates depend on the insurer and plan you choose.",
      "Tax at exit uses the new regime's rates for tax year 2026-27 (section 202), the section 156 rebate, surcharge and 4% cess, assuming your only other income that year is the pension. Rates may change by the time you exit.",
      "The employer NPS check and the old-regime saving on your own contribution use your tax slab plus 4% cess.",
      "Exit at 60 or later is treated as a normal exit. Exiting earlier has stricter rules (usually 20% lump sum and 80% annuity)."];
  }
  function spec() { return last.mode === "emp" ? specEmp(last.e) : specPlan(last.r); }
  function busy(b, on) { b.disabled = on; b.setAttribute("aria-busy", on ? "true" : "false"); }
  $("npPdf").addEventListener("click", function () { var b = this; busy(b, true); say("Making your PDF…"); withReport(function (Kt) { Kt.pdf(spec()).then(function () { busy(b, false); say("PDF report downloaded."); }, function () { busy(b, false); say("Couldn't make the PDF. Please try again."); }); }); });
  $("npXlsx").addEventListener("click", function () { var b = this; busy(b, true); withReport(function (Kt) { try { Kt.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(b, false); }); });
  $("npShare").addEventListener("click", function () {
    var q = new URLSearchParams(); Object.keys(NUM).forEach(function (k) { q.set(k, S[k]); });
    ["mode", "sector", "choice", "regime", "slab"].forEach(function (k) { q.set(k, S[k]); });
    var t = location.origin + location.pathname + "?" + q.toString();
    function ok() { say("Link copied. Anyone with it sees these numbers."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { say("Couldn't copy. Copy the address bar instead."); }); else say("Copy the address bar to share.");
  });
  (function bar() {
    var el = $("npBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("npVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".np .lp-setup"));
    $("npBarBtn").addEventListener("click", function () { $("npVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
