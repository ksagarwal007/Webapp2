/* Salarist: Company car lease or car loan? Runs entirely in the browser; nothing is stored or sent. */
(function () {
  "use strict";
  var CESS = 1.04;
  /* Income-tax Rules, 2026, Rule 15: monthly value of a car owned or hired by the employer, used for both official and personal use.
     Employer meets running costs: ₹5,000 (engine up to 1.6 litres, or electric) / ₹7,000 (above 1.6 litres).
     Employee meets running costs for personal use: ₹2,000 / ₹3,000. Chauffeur provided by the employer: ₹3,000 more. */
  var PERK = { co: { small: 5000, big: 7000 }, self: { small: 2000, big: 3000 }, driver: 3000 };

  /* ---------- Core ---------- */
  function emiOf(P, annualPct, months) {
    var r = annualPct / 1200;
    if (months <= 0 || P <= 0) return 0;
    if (r === 0) return P / months;
    var f = Math.pow(1 + r, months);
    return P * r * f / (f - 1);
  }
  function perkOf(o) { return (o.runCo ? PERK.co[o.engine] : PERK.self[o.engine]) + (o.runCo && o.driver ? PERK.driver : 0); }

  /* o: {price, engine, years, rental, insInc, maintInc, runCo, driver, driverCost, end, buyback, down, rate, loanYrs,
         ins, maint, fuel, dep, slab, ret} — money in ₹ (ins and maint a year, others a month), rates in % a year */
  function simulate(o) {
    var N = Math.round(o.years * 12), t = o.slab / 100 * CESS, g = Math.pow(1 + o.ret / 100, 1 / 12) - 1;
    var perk = perkOf(o), insM = o.ins / 12, maintM = o.maint / 12, drv = o.driver ? o.driverCost : 0;
    /* Lease: what goes through the company comes out of pre-tax salary; you pay tax only on the perquisite value. */
    var preL = o.rental + (o.runCo ? o.fuel + drv + (o.insInc ? 0 : insM) + (o.maintInc ? 0 : maintM) : 0);
    var postL = o.runCo ? 0 : o.fuel + drv + (o.insInc ? 0 : insM) + (o.maintInc ? 0 : maintM);
    var taxSavedM = preL * t, perkTaxM = perk * t, outL = preL - taxSavedM + perkTaxM + postL;
    /* Loan: EMI and every running cost come out of take-home pay; there is no tax benefit on a personal car loan. */
    var down = Math.min(o.down, o.price), loan = o.price - down, LN = Math.round(o.loanYrs * 12), emi = emiOf(loan, o.rate, LN), r = o.rate / 1200;
    var runLoan = o.fuel + drv + insM + maintM;
    var bal = loan, rows = [], cumL = [0], cumB = [down], fvL = 0, fvB = down * Math.pow(1 + g, N), intTot = 0, emiTot = 0;
    for (var m = 1; m <= N; m++) {
      var e = 0, it = 0;
      if (m <= LN && bal > 0) { it = bal * r; e = Math.min(emi, bal + it); bal = Math.max(0, bal + it - e); }
      intTot += it; emiTot += e;
      var outB = e + runLoan, f = Math.pow(1 + g, N - m);
      fvL += outL * f; fvB += outB * f;
      cumL.push(cumL[m - 1] + outL); cumB.push(cumB[m - 1] + outB);
      rows.push({ m: m, rental: o.rental, preOther: preL - o.rental, taxSaved: taxSavedM, perkTax: perkTaxM, postRun: postL, outL: outL,
                  emi: e, interest: it, run: runLoan, outB: outB, bal: bal });
    }
    if (bal < 1) bal = 0;
    var carEnd = o.price * Math.pow(1 - o.dep / 100, o.years), buy = o.end === "buy";
    var xc = o.closeCharge || 0;                                /* early closure charge, when you leave the job mid-lease */
    if (buy) cumL[N] += o.buyback; cumL[N] += xc;
    var endL = (buy ? carEnd - o.buyback : 0) - xc - fvL, endB = carEnd - bal - fvB;
    return { N: N, t: t, perk: perk, preL: preL, postL: postL, outL: outL, taxSavedM: taxSavedM, perkTaxM: perkTaxM, emi: emi, loan: loan, down: down,
             runLoan: runLoan, outB: emi + runLoan, rows: rows, cumL: cumL, cumB: cumB, carEnd: carEnd, balEnd: bal, intTot: intTot, emiTot: emiTot,
             fvL: fvL, fvB: fvB, endL: endL, endB: endB, diff: endL - endB,
             lease: { rental: o.rental * N, preOther: (preL - o.rental) * N, taxSaved: taxSavedM * N, perkTax: perkTaxM * N, postRun: postL * N, buyback: buy ? o.buyback : 0, exitCharge: xc, paid: outL * N + (buy ? o.buyback : 0) + xc },
             loanT: { down: down, emi: emiTot, interest: intTot, run: runLoan * N, paid: down + emiTot + runLoan * N } };
  }
  /* The monthly lease rental at which both come out equal. */
  function breakeven(o) {
    function d(x) { return simulate(Object.assign({}, o, { rental: x })).diff; }
    var lo = 0, hi = 500000;
    if (d(hi) > 0) return hi; if (d(lo) < 0) return 0;
    for (var i = 0; i < 60; i++) { var mid = (lo + hi) / 2; if (d(mid) > 0) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  /* Leaving the job mid-lease: compare both options at the exit date. The lease ends early with a closure charge,
     and you either buy the car at the price your lease terms set for that date or hand it back. The loan carries on: its balance is counted. */
  function exitSim(o) {
    var yrsX = Math.min(o.exitYrs, o.years - 0.5);
    return simulate(Object.assign({}, o, { years: yrsX, end: o.exitEnd, buyback: o.exitPrice, closeCharge: o.exitCharge }));
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { emiOf: emiOf, perkOf: perkOf, simulate: simulate, breakeven: breakeven, exitSim: exitSim, PERK: PERK }; return; }

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

  var S = { price: 1200000, engine: "small", years: 4, rental: 30000, insInc: true, maintInc: true, runCo: true, driver: false, driverCost: 15000,
            end: "buy", buyback: 240000, early: false, exitYrs: 2, exitCharge: 50000, exitEnd: "buy", exitPrice: 650000, down: 240000, rate: 9, loanYrs: 4, ins: 30000, maint: 15000, fuel: 6000, dep: 15, slab: 30, ret: 7 };
  var FIELDS = { price: [100000, 50000000, 10000], years: [1, 7, 1], rental: [0, 1000000, 500], driverCost: [0, 200000, 500], buyback: [0, 50000000, 1000],
                 down: [0, 50000000, 10000], rate: [5, 18, 0.05], loanYrs: [1, 8, 1], ins: [0, 1000000, 500], maint: [0, 1000000, 500], fuel: [0, 200000, 500],
                 dep: [0, 40, 1], ret: [0, 15, 0.5], exitYrs: [0.5, 6.5, 0.5], exitCharge: [0, 5000000, 1000], exitPrice: [0, 50000000, 1000] };
  var MONEY = { exitCharge: 1, exitPrice: 1, price: 1, rental: 1, driverCost: 1, buyback: 1, down: 1, ins: 1, maint: 1, fuel: 1 };
  var FLAGS = ["insInc", "maintInc", "runCo", "driver", "early"];
  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    Object.keys(FIELDS).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= FIELDS[k][0] && v <= FIELDS[k][1]) S[k] = v; });
    if (["small", "big"].indexOf(q.get("engine")) > -1) S.engine = q.get("engine");
    if (["buy", "return"].indexOf(q.get("end")) > -1) S.end = q.get("end");
    if (["buy", "return"].indexOf(q.get("exitEnd")) > -1) S.exitEnd = q.get("exitEnd");
    var sl = parseInt(q.get("slab"), 10); if ([0, 5, 10, 15, 20, 25, 30].indexOf(sl) > -1) S.slab = sl;
    FLAGS.forEach(function (k) { if (q.get(k) === "0") S[k] = false; if (q.get(k) === "1") S[k] = true; });
  })();

  function shown(k, v) { return MONEY[k] ? fmt.format(v) : String(v); }
  function bindField(k) {
    var num = $("cl-" + k), rng = $("cl-" + k + "-r"), note = $("cl-" + k + "-w");
    if (!num) return;
    function show() { num.value = shown(k, S[k]); if (rng) rng.value = Math.min(S[k], +rng.max); if (note) note.textContent = words(S[k]); }
    num.addEventListener("input", function () {
      var raw = MONEY[k] ? this.value.replace(/[^0-9]/g, "") : this.value, v = parseFloat(raw);
      if (MONEY[k]) this.value = raw ? fmt.format(+raw) : "";
      if (!isFinite(v)) { if (MONEY[k] && raw === "") v = 0; else return; }
      v = Math.max(FIELDS[k][0], Math.min(FIELDS[k][1], v)); S[k] = v; if (rng) rng.value = Math.min(v, +rng.max); if (note) note.textContent = words(v); render();
    });
    num.addEventListener("blur", show);
    if (rng) rng.addEventListener("input", function () { S[k] = parseFloat(this.value); num.value = shown(k, S[k]); if (note) note.textContent = words(S[k]); render(); });
    show();
  }
  Object.keys(FIELDS).forEach(bindField);
  function seg(attr, key, conv) {
    document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.addEventListener("click", function () { S[key] = conv(b.getAttribute("data-" + attr)); render(); }); });
  }
  seg("engine", "engine", String); seg("end", "end", String); seg("exitend", "exitEnd", String);
  seg("runco", "runCo", function (v) { return v === "1"; });
  $("cl-slab").addEventListener("change", function () { S.slab = parseInt(this.value, 10); render(); });
  $("cl-slab").value = String(S.slab);
  ["insInc", "maintInc", "driver", "early"].forEach(function (k) { var el = $("cl-" + k); el.checked = S[k]; el.addEventListener("change", function () { S[k] = this.checked; render(); }); });

  function pressed(attr, fn) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", fn(b.getAttribute("data-" + attr)) ? "true" : "false"); }); }
  function yrs(n) { return n + (n === 1 ? " year" : " years"); }

  function chart(sim) {
    var A = sim.cumL, B = sim.cumB, n = sim.N, W = 420, Hh = 270, pl = 54, pr = 16, pt = 28, pb = 26;
    var max = Math.max.apply(null, A.concat(B)) || 1, min = 0, span = max - min;
    function x(i) { return pl + i / n * (W - pl - pr); }
    function y(v) { return pt + (max - v) / span * (Hh - pt - pb); }
    function path(arr) { var s = ""; for (var i = 0; i <= n; i++) s += (s ? "L" : "M") + x(i).toFixed(1) + " " + y(arr[i]).toFixed(1); return s; }
    var grid = "";
    for (var k = 0; k <= 4; k++) { var v = min + span * k / 4, yy = y(v).toFixed(1); grid += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+yy + 3) + '" class="al" text-anchor="end">' + short(v) + "</text>"; }
    var xl = ""; for (var t = 0; t <= S.years; t++) xl += '<text x="' + x(t * 12).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">Yr ' + t + "</text>";
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Money paid out of your take-home pay over time, lease against loan">' + grid + xl +
      '<path d="' + path(B) + '" class="ln buy"/><path d="' + path(A) + '" class="ln rent"/></svg>';
  }

  function moneyRows(sim) {
    var L = sim.lease, B = sim.loanT, n = yrs(S.years), buy = S.end === "buy", rows = [
      ["Paid at the start", null, null, "head"],
      ["Down payment", null, B.down],
      ["Paid over " + n, null, null, "head"],
      ["Lease rental (from pre-tax pay)", L.rental, null],
      ["Fuel, upkeep and driver through the company (pre-tax)", L.preOther || null, null],
      ["Tax saved on the above", -L.taxSaved, null, "sub"],
      ["Tax on the perquisite value", L.perkTax, null, "sub"],
      ["Running costs you pay yourself", L.postRun || null, sim.runLoan * sim.N],
      ["EMIs", null, B.emi], ["of which interest", null, B.interest, "sub"],
      ["At the end of year " + S.years, null, null, "head"]];
    if (buy) rows.push(["Buy-back price", L.buyback, null]);
    rows.push(["Loan still owed", null, sim.balEnd ? sim.balEnd : null],
      ["Out of your pocket in all", L.paid, B.paid + sim.balEnd, "total"],
      ["Car's value, which you own", buy ? -sim.carEnd : 0, -sim.carEnd],
      ["Net cost of the car", L.paid - (buy ? sim.carEnd : 0), B.paid + sim.balEnd - sim.carEnd, "total"]);
    return rows;
  }
  function moneyCard(rows, idx, label, cls) {
    var h = '<div class="mw ' + cls + '"><h3>' + label + "</h3><dl>";
    rows.forEach(function (r) {
      if (r[3] === "head") { h += '<dt style="grid-column:1/-1;font-weight:800;color:var(--text);margin-top:6px">' + r[0] + "</dt>"; return; }
      var v = r[idx]; if (v === null || v === undefined) return;
      var c = r[3] === "sub" ? ' class="sub"' : r[3] === "total" ? ' class="tot"' : "";
      h += "<dt" + c + ">" + r[0] + "</dt><dd" + c + ">" + inr(v) + "</dd>";
    });
    return h + "</dl></div>";
  }

  var COLS = { lease: [["Lease rental", "rental"], ["Other costs through the company", "preOther"], ["Tax saved", "taxSaved"], ["Tax on perquisite", "perkTax"], ["Costs you pay yourself", "postRun"], ["Out of take-home", "outL"]],
               loan: [["EMI", "emi"], ["of which interest", "interest"], ["Fuel, upkeep, insurance, driver", "run"], ["Out of take-home", "outB"], ["Loan left", "bal"]] };
  function colsFor(which) { return COLS[which].filter(function (c) { return !(which === "lease" && ((c[1] === "preOther" && !S.runCo) || (c[1] === "postRun" && S.runCo))); }); }
  function yearRows(rows) {
    var out = [];
    for (var yI = 0; yI * 12 < rows.length; yI++) {
      var ms = rows.slice(yI * 12, yI * 12 + 12), o = { y: yI + 1, months: ms };
      ["rental", "preOther", "taxSaved", "perkTax", "postRun", "outL", "emi", "interest", "run", "outB"].forEach(function (f) { o[f] = ms.reduce(function (s, r) { return s + r[f]; }, 0); });
      o.bal = ms[ms.length - 1].bal; out.push(o);
    }
    return out;
  }
  function table(sim, which) {
    var cols = colsFor(which), h = "";
    yearRows(sim.rows).forEach(function (r) {
      h += '<tbody><tr class="yr"><th scope="row"><button type="button" class="yb" aria-expanded="false" data-y="' + r.y + '">Year ' + r.y + "</button></th>" + cols.map(function (c) { return "<td>" + inr(r[c[1]]) + "</td>"; }).join("") + "</tr>";
      r.months.forEach(function (m) { h += '<tr class="mo" data-of="' + r.y + '" hidden><th scope="row">Month ' + m.m + "</th>" + cols.map(function (c) { return "<td>" + inr(m[c[1]]) + "</td>"; }).join("") + "</tr>"; });
      h += "</tbody>";
    });
    return '<table class="calc"><thead><tr><th scope="col">Period</th>' + cols.map(function (c) { return '<th scope="col">' + c[0] + "</th>"; }).join("") + "</tr></thead>" + h + "</table>";
  }

  var tabWhich = "lease", last = null;
  function sensSlabs() { var s = [10, 20, 30]; if (s.indexOf(S.slab) < 0) s.push(S.slab); return s.sort(function (a, b) { return a - b; }); }
  function render() {
    pressed("engine", function (v) { return v === S.engine; });
    pressed("end", function (v) { return v === S.end; });
    pressed("runco", function (v) { return (v === "1") === S.runCo; });
    pressed("exitend", function (v) { return v === S.exitEnd; });
    $("cl-early-box").hidden = !S.early;
    $("cl-exitPrice-box").hidden = S.exitEnd !== "buy";
    $("cl-buy-box").hidden = S.end !== "buy";
    $("cl-driver-box").hidden = !S.driver;
    var loan = Math.max(0, S.price - S.down);
    $("cl-loanTxt").textContent = S.down >= S.price ? "Down payment covers the full price, so there's no loan." : "Loan: " + inr(loan) + " (" + Math.round(loan / S.price * 100) + "% of the price)";
    var sim = simulate(S), be = breakeven(S); last = { sim: sim, be: be };
    var d = sim.diff, n = yrs(S.years), v = $("clVerdict");
    var tie = Math.abs(d) < Math.max(5000, S.price * 0.01);
    if (tie) v.innerHTML = '<p class="k">Over ' + n + '</p><p class="v">It\'s a <b>near tie</b></p><p class="k">Both end within ' + short(Math.abs(d)) + " of each other. Decide on flexibility: a loan leaves you free to change jobs; a lease ties the car to this one.</p>";
    else if (d > 0) v.innerHTML = '<p class="k">Over ' + n + '</p><p class="v">Leasing through your company saves <b>' + short(d) + '</b></p><p class="k">You pay ' + inr(sim.outL) + " a month out of take-home pay, against " + inr(sim.outB) + " with a loan" + (S.down ? " plus the " + short(sim.down) + " down payment" : "") + "." + (S.end === "return" ? " That's after counting the car you'd own at the end with the loan." : "") + "</p>";
    else v.innerHTML = '<p class="k">Over ' + n + '</p><p class="v">The car loan costs <b>' + short(-d) + ' less</b></p><p class="k">The lease rental is too high for the tax saved to make up for it. With a loan you pay ' + inr(sim.outB) + " a month, against " + inr(sim.outL) + " with the lease." + (S.end === "return" ? " With the loan, you also own the car at the end." : "") + "</p>";
    $("clBarT").textContent = tie ? "Near tie" : d > 0 ? "Lease saves " + short(d) : "Loan saves " + short(-d);
    $("clOutL").textContent = inr(sim.outL);
    $("clOutB").textContent = inr(sim.outB);
    $("clTax").textContent = short(sim.lease.taxSaved - sim.lease.perkTax);
    $("clBe").textContent = be >= 500000 ? "Above ₹5,00,000" : be <= 0 ? "Loan wins at any rental" : inr(Math.round(be / 100) * 100) + " a month";
    $("clChart").innerHTML = chart(sim);
    var mr = moneyRows(sim);
    $("clMoney").innerHTML = moneyCard(mr, 1, "Company lease", "inv") + moneyCard(mr, 2, "Car loan", "pre");
    $("clMoneyNote").textContent = "Amounts as they're paid, without investment growth. The verdict also counts what the money you don't spend could earn at " + S.ret + "% a year." + (S.end === "return" ? " You return the car at the end of the lease, so you don't own it." : "");
    $("clSens").innerHTML = sensSlabs().map(function (sl) {
      var dd = simulate(Object.assign({}, S, { slab: sl })).diff;
      return '<div class="sv' + (sl === S.slab ? " cur" : "") + '"><span class="l">' + sl + "% tax slab</span><span class=\"n\">" + (Math.abs(dd) < 1000 ? "Tie" : (dd > 0 ? "Lease +" : "Loan +") + short(Math.abs(dd))) + "</span></div>";
    }).join("");
    $("clPerk").textContent = "Taxed as " + inr(sim.perk) + " a month of extra salary (Rule 15)";
    $("clTable").innerHTML = table(sim, tabWhich);
    document.querySelectorAll("[data-tab]").forEach(function (b) { b.setAttribute("aria-selected", b.getAttribute("data-tab") === tabWhich ? "true" : "false"); });
    var ex = $("clExit"); ex.hidden = !S.early || S.years < 1;
    if (!ex.hidden) {
      var X = exitSim(S), xy = Math.min(S.exitYrs, S.years - 0.5), xd = X.diff, xn = (xy === 1 ? "1 year" : xy + " years");
      $("clExitH").textContent = "If you leave your job after " + xn;
      $("clExitV").innerHTML = (Math.abs(xd) < Math.max(5000, S.price * 0.01) ? "It's a <b>near tie</b> at that point." : xd > 0 ? "The lease still comes out <b>" + short(xd) + " ahead</b>." : "The loan comes out <b>" + short(-xd) + " ahead</b>.");
      $("clExitT").textContent = "With the lease you'd have paid " + short(X.lease.paid) + " out of your pocket by then, including the " + inr(S.exitCharge) + " closure charge" +
        (S.exitEnd === "buy" ? " and " + inr(S.exitPrice) + " to buy the car" : ", and you hand the car back") + ". With the loan you'd have paid " + short(X.loanT.paid) +
        (X.balEnd ? " and still owe " + short(X.balEnd) + " on the loan" : "") + ", and you own the car, worth about " + short(X.carEnd) + ". This counts what your savings would earn, like the main result.";
      if (S.exitYrs >= S.years) $("clExitT").textContent += " (Your exit date was later than the lease, so we used " + xn + ".)";
    }
    $("clNotes").innerHTML = notes().map(function (t) { return "<li>" + t + "</li>"; }).join("");
  }
  function notes() {
    var n = ["You pay income tax at " + S.slab + "% plus 4% cess on your top rupee of salary, so every rupee through the company saves " + (S.slab * 1.04).toFixed(1) + " paise. Surcharge isn't included.",
      "Under the lease, you're taxed on a fixed " + inr(perkOf(S)) + " a month (Rule 15 of the Income-tax Rules, 2026), whatever the car really costs. This works the same under the old and new regimes.",
      "The car loses " + S.dep + "% of its value a year, so after " + yrs(S.years) + " it's worth about " + short(S.price * Math.pow(1 - S.dep / 100, S.years)) + ".",
      "Fuel, insurance and upkeep cost the same under both options; what changes is whether they come out of pre-tax or post-tax pay. Insurance and upkeep are spread evenly over the months.",
      "Money you don't spend earns " + S.ret + "% a year, after tax. The loan rate stays the same."];
    if (S.loanYrs > S.years) n.push("Your loan runs longer than " + yrs(S.years) + ", so the loan still owed at the end is counted as a cost.");
    if (S.early) n.push("Early exit: the lease closes after " + Math.min(S.exitYrs, S.years - 0.5) + " years with a " + inr(S.exitCharge) + " charge" + (S.exitEnd === "buy" ? " and you buy the car for " + inr(S.exitPrice) : " and you hand the car back") + ". The loan carries on, and its balance at that date is counted. Charges and buy-out prices vary by scheme: use your own lease terms.");
    if (S.end === "buy") n.push("At the end of the lease you buy the car for " + inr(S.buyback) + " from your own money. Check how your company's scheme handles the transfer.");
    return n;
  }
  $("clTable").addEventListener("click", function (e) {
    var b = e.target.closest(".yb"); if (!b) return;
    var open = b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", open ? "true" : "false");
    this.querySelectorAll('tr[data-of="' + b.getAttribute("data-y") + '"]').forEach(function (r) { r.hidden = !open; });
  });
  document.querySelectorAll("[data-tab]").forEach(function (b) { b.addEventListener("click", function () { tabWhich = b.getAttribute("data-tab"); $("clTable").innerHTML = table(last.sim, tabWhich); document.querySelectorAll("[data-tab]").forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); }); }); });

  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function spec() {
    var sim = last.sim, yr = yearRows(sim.rows);
    var inputs = [["Car price on the road, without insurance", inr(S.price), S.price], ["Engine", S.engine === "small" ? "Up to 1.6 litres, or electric" : "Above 1.6 litres"], ["Comparing over", yrs(S.years)],
      ["Lease rental", inr(S.rental) + " a month", S.rental], ["Insurance in the rental", S.insInc ? "Yes" : "No"], ["Upkeep in the rental", S.maintInc ? "Yes" : "No"],
      ["Fuel and running costs through the company", S.runCo ? "Yes" : "No, I pay them"], ["Driver", S.driver ? inr(S.driverCost) + " a month" : "No"],
      ["At the end of the lease", S.end === "buy" ? "Buy the car for " + inr(S.buyback) : "Return the car"],
      ["Leaving the job early", S.early ? "After " + Math.min(S.exitYrs, S.years - 0.5) + " years" : "Not checked"]].concat(S.early ? [["Early closure charge", inr(S.exitCharge), S.exitCharge], ["When you leave", S.exitEnd === "buy" ? "Buy the car for " + inr(S.exitPrice) : "Hand the car back"]] : []).concat([
      ["Down payment", inr(S.down), S.down], ["Loan", inr(sim.loan), sim.loan], ["Loan rate", S.rate + "% a year"], ["Loan tenure", yrs(S.loanYrs)],
      ["Insurance", inr(S.ins) + " a year", S.ins], ["Servicing and repairs", inr(S.maint) + " a year", S.maint], ["Fuel", inr(S.fuel) + " a month", S.fuel],
      ["Car loses value", S.dep + "% a year"], ["Tax slab", S.slab + "%"], ["Return on savings", S.ret + "% a year"]]);
    function trow(r, which) { return [r.y !== undefined ? "Year " + r.y : "Month " + r.m].concat(colsFor(which).map(function (c) { return r[c[1]]; })); }
    function tb(which, title, sheet) {
      var months = []; yr.forEach(function (y) { y.months.forEach(function (m) { months.push([m.m].concat(colsFor(which).map(function (c) { return m[c[1]]; }))); }); });
      return { title: title, sheet: sheet, cols: ["Year"].concat(colsFor(which).map(function (c) { return c[0]; })), yearly: yr.map(function (r) { return trow(r, which); }), monthly: months };
    }
    var cats = []; for (var i = 0; i <= S.years; i++) cats.push(i);
    return {
      title: "Car Lease vs Car Loan Report", path: "salarist.in/company-car-lease-vs-loan", url: location.origin + location.pathname, file: "salarist-car-lease-vs-car-loan",
      question: "Lease a " + short(S.price) + " car through your company, or buy it on a loan?",
      verdictLines: (function () { var v = Array.prototype.map.call(document.querySelectorAll("#clVerdict p"), function (p) { return p.textContent; }); if (S.early) v[2] = (v[2] || "") + " " + $("clExitH").textContent + ", " + $("clExitV").textContent.charAt(0).toLowerCase() + $("clExitV").textContent.slice(1); return v; })(),
      verdictColor: sim.diff >= 0 ? "blue" : "amber",
      inputs: inputs,
      keyNums: [["Lease: out of take-home a month", inr(sim.outL), sim.outL], ["Loan: out of take-home a month", inr(sim.outB), sim.outB],
        ["Tax saved with the lease", short(sim.lease.taxSaved - sim.lease.perkTax), sim.lease.taxSaved - sim.lease.perkTax], ["Both equal at a rental of", $("clBe").textContent]],
      sensTitle: "What if your tax slab is different?",
      sens: Array.prototype.map.call(document.querySelectorAll("#clSens .sv"), function (el) { return [el.querySelector(".l").textContent, el.querySelector(".n").textContent]; }),
      sensCurrent: sensSlabs().indexOf(S.slab),
      chartTitle: "Money paid out of take-home pay", chartNote: "Running total for each option" + (S.end === "buy" ? ", with the buy-back price at the end of the lease." : "."),
      xlsxChartTitle: "Paid out of take-home (₹ lakh)",
      chart: { series: [{ name: "Company lease", color: "blue", data: sim.cumL }, { name: "Car loan", color: "amber", data: sim.cumB }], cross: null },
      chartYears: cats,
      money: { title: "Where your money went", cols: ["Lease", "Loan"], rows: moneyRows(sim), note: $("clMoneyNote").textContent },
      tables: [tb("lease", "Company lease: year by year", "Lease"), tb("loan", "Car loan: year by year", "Loan")],
      notes: notes().map(function (t) { var d = document.createElement("div"); d.innerHTML = t; return d.textContent; }),
      taxRules: ["Car owned or hired by the employer, used for both official and personal purposes (Rule 15 of the Income-tax Rules, 2026, from 1 April 2026): taxable value ₹5,000 a month for an engine up to 1.6 litres or an electric car, ₹7,000 a month above 1.6 litres, if the employer meets the running costs.",
        "If you meet the running costs for personal use yourself: ₹2,000 or ₹3,000 a month. If the employer also provides a driver: ₹3,000 a month more.",
        "The lease rental and running costs paid through the company come out of salary before tax. The same treatment applies under the old and new regimes.",
        "A loan for a car you own personally gets no tax deduction for a salaried employee."],
      short: short, inr: inr
    };
  }
  function busy(btn, on) { btn.disabled = on; btn.setAttribute("aria-busy", on ? "true" : "false"); }
  $("clPdf").addEventListener("click", function () {
    var btn = this; busy(btn, true); say("Making your PDF…");
    withReport(function (K) { K.pdf(spec()).then(function () { busy(btn, false); say("PDF report downloaded."); }, function () { busy(btn, false); say("Couldn't make the PDF. Please try again."); }); });
  });
  $("clXlsx").addEventListener("click", function () {
    var btn = this; busy(btn, true);
    withReport(function (K) { try { K.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(btn, false); });
  });
  function say(msg) { var s = $("clStatus"); s.textContent = msg; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 3000); }
  function copy(text, ok) {
    function fb() { var t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); var r = false; try { r = document.execCommand("copy"); } catch (e) {} t.remove(); say(r ? ok : "Couldn't copy. Select the text and copy it yourself."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { say(ok); }, fb); else fb();
  }
  $("clShare").addEventListener("click", function () {
    var q = new URLSearchParams();
    Object.keys(FIELDS).forEach(function (k) { q.set(k, S[k]); }); q.set("engine", S.engine); q.set("end", S.end); q.set("exitEnd", S.exitEnd); q.set("slab", S.slab);
    FLAGS.forEach(function (k) { q.set(k, S[k] ? "1" : "0"); });
    copy(location.origin + location.pathname + "?" + q.toString(), "Link copied. Anyone with it sees these numbers.");
  });
  (function bar() {   /* phones: keep the result in sight while you edit a long form */
    var el = $("clBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("clVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".cl .lp-setup"));
    $("clBarBtn").addEventListener("click", function () { $("clVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
