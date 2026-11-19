/* Salarist systematic withdrawal (SWP) engine, shared by the FIRE calculator and the SWP calculator.
   Runs entirely in the browser; nothing is stored or sent. Money in ₹, rates in % a year. */
(function () {
  "use strict";
  /* Monthly simulation. Each month: add any flow for that month (lump sums in, pension in), take the withdrawal at the start of the month,
     then the rest earns a month's return. The withdrawal rises by `step`% every 12 months.
     o: {corpus, withdraw (first month), step, ret, months, flow (optional function m -> ₹ in that month)}
     Returns {end, lasts (months before it runs out, = months if it lasts), path (balance at the end of each year), withdrawn}. */
  function run(o) {
    var g = Math.pow(1 + o.ret / 100, 1 / 12) - 1, bal = o.corpus, w = o.withdraw, out = 0, path = [], lasts = o.months, gone = false;
    for (var m = 0; m < o.months; m++) {
      if (m && m % 12 === 0) w *= 1 + o.step / 100;
      if (o.flow) bal += o.flow(m);
      bal -= w; out += w;
      if (bal < 0 && !gone) { lasts = m; gone = true; }
      if (bal > 0) bal *= 1 + g;
      if ((m + 1) % 12 === 0) path.push(Math.max(0, bal));
    }
    return { end: bal, lasts: lasts, ok: !gone, path: path, withdrawn: out };
  }
  /* The smallest starting corpus that lasts all the months. */
  function needed(o) {
    var lo = 0, hi = Math.max(1e5, o.withdraw * o.months * 4);
    while (run(Object.assign({}, o, { corpus: hi })).ok === false && hi < 1e13) hi *= 2;
    for (var i = 0; i < 60; i++) { var mid = (lo + hi) / 2; if (run(Object.assign({}, o, { corpus: mid })).ok) hi = mid; else lo = mid; }
    return hi;
  }
  /* The largest starting monthly withdrawal a corpus supports for all the months. */
  function sustainable(o) {
    var lo = 0, hi = o.corpus;
    for (var i = 0; i < 60; i++) { var mid = (lo + hi) / 2; if (run(Object.assign({}, o, { withdraw: mid })).ok) lo = mid; else hi = mid; }
    return lo;
  }
  /* Year by year, with tax on the gains in each withdrawal (average cost). Tax is paid out of that year's withdrawals.
     o: run()'s options plus {years (to show), tax: {kind "equity"|"debt", slab (%), held (bool: invested over a year ago), gains0 (₹ of gains already in the corpus)}}
     Equity-oriented funds: gains on units held over 12 months taxed at 12.5% above ₹1.25 lakh a year, under 12 months at 20% (sections 67 and 196 of the Income-tax Act, 2025; earlier 112A and 111A).
     Debt funds (and gains taxed like them): at your slab. 4% cess on both; surcharge and the section 156 rebate left out.
     Returns {rows: [{year, withdrawn, gains, tax, net, bal}], lasts, ok, end, withdrawn, gains, tax}. */
  function taxed(o) {
    var t = o.tax || { kind: "equity", slab: 0, held: false, gains0: 0 }, g = Math.pow(1 + o.ret / 100, 1 / 12) - 1;
    var bal = o.corpus, cost = Math.max(0, o.corpus - (t.gains0 || 0)), w = o.withdraw, rows = [], lasts = o.months, gone = false, TW = 0, TG = 0, TT = 0;
    var Y = Math.ceil(o.months / 12);
    for (var y = 0; y < Y; y++) {
      var W = 0, st = 0, lt = 0;
      for (var k = 0; k < 12; k++) {
        var m = y * 12 + k; if (m >= o.months) break;
        if (m && m % 12 === 0) w *= 1 + o.step / 100;
        if (o.flow) { var f = o.flow(m); bal += f; cost += f; }
        var take = gone ? 0 : Math.min(w, Math.max(0, bal));
        if (!gone && bal - w < 0) { lasts = m; gone = true; }
        if (take > 0) {
          var share = bal > 0 ? take / bal : 1, c = cost * share, gain = Math.max(0, take - c);
          cost -= c; bal -= take; W += take;
          if (t.kind === "equity" && !t.held && m < 12) st += gain; else lt += gain;
        }
        if (bal > 0) bal *= 1 + g;
      }
      var tax = t.kind === "equity" ? (st * 0.20 + Math.max(0, lt - 125000) * 0.125) * 1.04 : (st + lt) * (t.slab || 0) / 100 * 1.04;
      TW += W; TG += st + lt; TT += tax;
      rows.push({ year: y + 1, withdrawn: W, gains: st + lt, st: st, lt: lt, tax: tax, net: W - tax, bal: Math.max(0, bal) });
    }
    return { rows: rows, lasts: lasts, ok: !gone, end: bal, withdrawn: TW, gains: TG, tax: TT };
  }
  /* Link to the SWP calculator, prefilled (used by the retirement planner, NPS and SIP calculators) */
  function link(p) {
    var q = ["corpus=" + Math.round(p.corpus), "mode=take", "years=" + Math.round(p.years), "step=" + p.step, "ret=" + p.ret];
    if (p.kind) q.push("kind=" + p.kind);
    return "/swp-calculator/?" + q.join("&");
  }
  var API = { run: run, needed: needed, sustainable: sustainable, taxed: taxed, link: link };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }
  window.SalaristSWP = API;
})();
