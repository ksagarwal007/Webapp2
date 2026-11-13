/* Salarist: Rent or buy a home? Runs entirely in the browser; nothing is stored or sent. */
(function () {
  "use strict";
  var CESS = 1.04, LTCG_RATE = 0.125, LTCG_EXEMPT = 125000, HL_INT_CAP = 200000, REINVEST_CAP = 100000000, MAXM = 360;

  /* ---------- Core ---------- */
  function emiOf(P, annualPct, months) {
    var r = annualPct / 1200;
    if (months <= 0 || P <= 0) return 0;
    if (r === 0) return P / months;
    var f = Math.pow(1 + r, months);
    return P * r * f / (f - 1);
  }

  /* o: {price, down, stamp, reg, other, rate, tenure, rent, rentUp, deposit, depUp, own, ownUp, stay, grow, ret, kind, sell,
         keep, reinvest, possess, regime, slab, claimInt, room, claimHra, basic, hra, metro} — money in ₹, rates in % a year */
  function simulate(o) {
    var down = Math.min(o.down, o.price), loan = o.price - down, N = Math.round(o.tenure * 12), r = o.rate / 1200, emi = emiOf(loan, o.rate, N);
    var P = Math.round((o.possess || 0) * 12);                /* months until possession; 0 = ready to move in */
    var slab = o.slab / 100, taxRate = slab * CESS, old = o.regime === "old";
    var fdNet = o.kind === "fd" ? o.ret * (1 - taxRate) : o.ret, g = Math.pow(1 + fdNet / 100, 1 / 12) - 1;
    var cost = o.price + o.stamp + o.reg + o.other;          /* cost of acquisition for capital gains */
    var intCap = P > 60 ? 30000 : HL_INT_CAP;                  /* possession more than 5 years away: ₹30,000 cap */
    var yP = Math.floor(P / 12);                               /* year (0-based) in which you get possession */
    function up(y) { return Math.pow(1 + o.rentUp / 100, y); }
    function depAt(y) { return o.deposit * (o.depUp ? up(y) : 1); }
    var B0 = down + o.stamp + o.reg + o.other + (P > 0 ? o.deposit : 0), R0 = o.deposit;
    var bal = loan, cB = Math.max(0, R0 - B0), cR = Math.max(0, B0 - R0), pB = cB, pR = cR, depB = P > 0 ? o.deposit : 0, depR = o.deposit;
    var intY = 0, prinY = 0, hraY = 0, hraBY = 0, preInt = 0, rows = [], k = 0;
    function invTax(c, p) {
      var gain = Math.max(0, c - p);
      return o.kind === "equity" ? Math.max(0, gain - LTCG_EXEMPT) * LTCG_RATE * CESS : o.kind === "debt" ? gain * taxRate : 0;
    }
    function homeAt(m) { return o.price * Math.pow(1 + o.grow / 100, m / 12); }
    function propTax(m, saleNet) {
      var gain = saleNet - cost; if (gain <= 0) return 0;
      if (m <= 24) return gain * taxRate;
      if (o.reinvest) gain = Math.max(0, gain - REINVEST_CAP);   /* section 82: gain put into another home is exempt, up to ₹10 crore */
      return gain * LTCG_RATE * CESS;
    }
    function snap(m) {
      var V = homeAt(m), saleNet = o.keep ? V : V * (1 - o.sell / 100), pt = o.keep ? 0 : propTax(m, saleNet), tB = invTax(cB, pB), tR = invTax(cR, pR);
      return { V: V, saleNet: saleNet, propTax: pt, taxB: tB, taxR: tR, netB: saleNet - pt - bal + cB - tB + depB, netR: cR - tR + depR };
    }
    function hraOf(rentM, y) {
      var basicM = o.basic * up(y), hraM = o.hra * up(y);
      return Math.max(0, Math.min(hraM, rentM - 0.1 * basicM, (o.metro ? 0.5 : 0.4) * basicM));
    }
    var s0 = snap(0), netB = [s0.netB], netR = [s0.netR];
    for (var m = 1; m <= MAXM; m++) {
      var y = Math.floor((m - 1) / 12), rentM = o.rent * up(y), building = m <= P;
      cB *= 1 + g; cR *= 1 + g;
      var top = 0;                                              /* deposit top-up when the rent is renewed */
      if (o.depUp && m > 1 && (m - 1) % 12 === 0) top = depAt(y) - depAt(y - 1);
      var it = 0, pr = 0, outB, rentB = 0, ownM = 0, back = 0;
      if (building) {
        it = bal * r;                                           /* pre-EMI: interest only while the home is being built */
        if (y < yP) preInt += it; else intY += it;
        rentB = rentM; outB = it + rentB + top; depB += top;
        if (old && o.claimHra) hraBY += hraOf(rentM, y);
      } else {
        if (bal > 0.5 && k < N) { it = bal * r; pr = Math.min(emi - it, bal); bal -= pr; if (bal <= 0.5) bal = 0; k++; }
        intY += it; prinY += pr;
        ownM = o.own / 12 * Math.pow(1 + o.ownUp / 100, y);
        if (depB > 0) { back = depB; depB = 0; }               /* deposit comes back when you move into your home */
        outB = it + pr + ownM - back;
      }
      depR += top;
      var outR = rentM + top;
      if (old && o.claimHra) hraY += hraOf(rentM, y);
      var budget = Math.max(outB + back, outR), invB = budget - outB, invR = budget - outR;
      var refB = 0, refR = 0;
      if (m % 12 === 0) {
        if (old) {
          var inst = y >= yP && y < yP + 5 ? preInt / 5 : 0;      /* pre-possession interest: five equal yearly parts from the year of possession */
          var intDed = o.claimInt && y >= yP ? Math.min(intY + inst, intCap) : 0;
          var ded = intDed + Math.min(prinY + (m === 12 ? o.stamp + o.reg : 0), o.room);
          refB = (ded + hraBY) * taxRate; refR = hraY * taxRate;
        }
        intY = 0; prinY = 0; hraY = 0; hraBY = 0;
      }
      invB += refB; invR += refR;
      cB += invB; pB += invB; cR += invR; pR += invR;
      var sn = snap(m);
      netB.push(sn.netB); netR.push(sn.netR);
      rows.push({ m: m, emi: it + pr, interest: it, own: ownM, rentB: rentB, rent: rentM, top: top, back: back, invB: invB, invR: invR, refB: refB, refR: refR, bal: bal, home: sn.V, cB: cB, cR: cR, budget: budget });
    }
    var H = Math.round(o.stay * 12), part = rows.slice(0, H), sum = function (f) { return part.reduce(function (a, x) { return a + x[f]; }, 0); };
    var lastRow = rows[H - 1], V = homeAt(H), saleNet = o.keep ? V : V * (1 - o.sell / 100), pt = o.keep ? 0 : propTax(H, saleNet);
    var pBH = Math.max(0, R0 - B0) + sum("invB"), pRH = Math.max(0, B0 - R0) + sum("invR");
    var tB = invTax(lastRow.cB, pBH), tR = invTax(lastRow.cR, pRH), depBH = P >= H ? (o.deposit + part.reduce(function (a, x) { return a + (x.rentB ? x.top : 0); }, 0)) : 0;
    var buy = { upfront: B0, down: down, costs: o.stamp + o.reg + o.other, deposit: P > 0 ? o.deposit : 0, emi: sum("emi"), interest: sum("interest"), own: sum("own"), rent: sum("rentB"),
                tops: part.reduce(function (a, x) { return a + (x.rentB ? x.top : 0); }, 0), back: sum("back"), invested: pBH, refunds: sum("refB"),
                gross: lastRow.cB, invTax: tB, home: V, saleNet: saleNet, propTax: pt, loanLeft: lastRow.bal, depEnd: depBH, final: netB[H] };
    var rent = { upfront: R0, rent: sum("rent"), tops: sum("top"), invested: pRH, refunds: sum("refR"), gross: lastRow.cR, invTax: tR, deposit: depAt(Math.max(0, Math.floor((H - 1) / 12))), final: netR[H] };
    return { emi: emi, loan: loan, N: N, P: P, H: H, rows: rows, netB: netB, netR: netR, buy: buy, rent: rent, diff: rent.final - buy.final };
  }

  function breakeven(o) {   /* home price growth at which buying and renting end equal */
    function d(gr) { return simulate(Object.assign({}, o, { grow: gr })).diff; }
    var lo = -10, hi = 30;
    if (d(lo) < 0) return { kind: "buy-always" };
    if (d(hi) > 0) return { kind: "rent-always" };
    for (var i = 0; i < 40; i++) { var mid = (lo + hi) / 2; if (d(mid) > 0) lo = mid; else hi = mid; }
    return { kind: "rate", rate: (lo + hi) / 2 };
  }
  function payoff(sim) {   /* the stay after which buying comes out ahead: within your stay, or later (up to 30 years) */
    var A = sim.netB, B = sim.netR, H = sim.H, n = A.length - 1, k;
    if (A[H] >= B[H]) { k = H; while (k > 0 && A[k - 1] >= B[k - 1]) k--; return k; }
    for (k = H + 1; k <= n; k++) if (A[k] >= B[k]) return k;
    return null;
  }

  if (typeof module !== "undefined" && module.exports) { module.exports = { emiOf: emiOf, simulate: simulate, breakeven: breakeven, payoff: payoff }; return; }

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
  function yrsTxt(m) { var y = m / 12; return y < 1 ? Math.max(1, Math.round(m)) + " months" : (Math.round(y * 10) / 10).toString() + (y === 1 ? " year" : " years"); }

  var S = { price: 8000000, down: 1600000, stamp: 400000, reg: 30000, other: 100000, rate: 8.5, tenure: 20,
            rent: 20000, rentUp: 5, deposit: 60000, depUp: false, own: 45000, ownUp: 5, stay: 10, grow: 5, ret: 12, kind: "equity", sell: 1,
            keep: false, reinvest: false, uc: false, possess: 3,
            regime: "new", slab: 30, claimInt: true, room: 0, claimHra: true, basic: 100000, hra: 50000, metro: true };
  var FIELDS = { price: [500000, 200000000, 100000], down: [0, 200000000, 50000], stamp: [0, 20000000, 1000], reg: [0, 5000000, 1000], other: [0, 20000000, 1000],
                 rate: [5, 15, 0.05], tenure: [1, 30, 1], rent: [0, 1000000, 500], rentUp: [0, 15, 0.5], deposit: [0, 10000000, 1000], own: [0, 5000000, 1000],
                 ownUp: [0, 15, 0.5], possess: [0.5, 7, 0.5], stay: [1, 30, 1], grow: [-5, 15, 0.5], ret: [3, 18, 0.5], sell: [0, 5, 0.25], room: [0, 150000, 1000], basic: [0, 10000000, 1000], hra: [0, 10000000, 1000] };
  var MONEY = { price: 1, down: 1, stamp: 1, reg: 1, other: 1, rent: 1, deposit: 1, own: 1, room: 1, basic: 1, hra: 1 };
  var FLAGS = ["claimInt", "claimHra", "metro", "depUp", "keep", "reinvest", "uc"];
  function opts(extra) { return Object.assign({}, S, { possess: S.uc ? S.possess : 0 }, extra || {}); }

  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    Object.keys(FIELDS).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= FIELDS[k][0] && v <= FIELDS[k][1]) S[k] = v; });
    if (["equity", "debt", "fd"].indexOf(q.get("kind")) > -1) S.kind = q.get("kind");
    if (["new", "old"].indexOf(q.get("regime")) > -1) S.regime = q.get("regime");
    var sl = parseInt(q.get("slab"), 10); if ([0, 5, 10, 15, 20, 25, 30].indexOf(sl) > -1) S.slab = sl;
    FLAGS.forEach(function (k) { if (q.get(k) === "0") S[k] = false; if (q.get(k) === "1") S[k] = true; });
  })();

  function shown(k, v) { return MONEY[k] ? fmt.format(v) : String(v); }
  function bindField(k) {
    var num = $("rb-" + k), rng = $("rb-" + k + "-r"), note = $("rb-" + k + "-w");
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
  document.querySelectorAll("[data-kind]").forEach(function (b) { b.addEventListener("click", function () { S.kind = b.getAttribute("data-kind"); render(); }); });
  document.querySelectorAll("[data-regime]").forEach(function (b) { b.addEventListener("click", function () { S.regime = b.getAttribute("data-regime"); render(); }); });
  document.querySelectorAll("[data-metro]").forEach(function (b) { b.addEventListener("click", function () { S.metro = b.getAttribute("data-metro") === "1"; render(); }); });
  document.querySelectorAll("[data-end]").forEach(function (b) { b.addEventListener("click", function () { S.keep = b.getAttribute("data-end") === "keep"; render(); }); });
  document.querySelectorAll("[data-uc]").forEach(function (b) { b.addEventListener("click", function () { S.uc = b.getAttribute("data-uc") === "1"; render(); }); });
  document.querySelectorAll("[data-state]").forEach(function (sel) { sel.addEventListener("change", function () { var o = this.options[this.selectedIndex], a = $("rb-stateLink"); if (!this.value) { a.hidden = true; return; } a.href = this.value; a.textContent = "Open the " + o.text + " stamp duty calculator"; a.hidden = false; }); });
  $("rb-slab").value = String(S.slab);
  $("rb-slab").addEventListener("change", function () { S.slab = parseInt(this.value, 10); render(); });
  ["claimInt", "claimHra", "depUp", "reinvest"].forEach(function (k) { var el = $("rb-" + k); el.checked = S[k]; el.addEventListener("change", function () { S[k] = this.checked; render(); }); });

  function chart(sim) {
    var H = sim.H, A = sim.netB.slice(0, H + 1), B = sim.netR.slice(0, H + 1), n = H, W = 420, Hh = 270, pl = 54, pr = 16, pt = 28, pb = 26;
    var all = A.concat(B), max = Math.max.apply(null, all), min = Math.min.apply(null, all.concat([0])), span = (max - min) || 1;
    function x(i) { return pl + i / n * (W - pl - pr); }
    function y(v) { return pt + (max - v) / span * (Hh - pt - pb); }
    function path(arr) { var s = ""; for (var i = 0; i <= n; i += (n > 240 ? 2 : 1)) s += (s ? "L" : "M") + x(i).toFixed(1) + " " + y(arr[i]).toFixed(1); return s + "L" + x(n).toFixed(1) + " " + y(arr[n]).toFixed(1); }
    var grid = "";
    for (var k = 0; k <= 4; k++) { var v = min + span * k / 4, yy = y(v).toFixed(1); grid += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+yy + 3) + '" class="al" text-anchor="end">' + short(v) + "</text>"; }
    var yrs = n / 12, step = yrs > 20 ? 5 : yrs > 8 ? 2 : 1, xl = "";
    for (var t = 0; t <= yrs; t += step) xl += '<text x="' + x(t * 12).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">Yr ' + t + "</text>";
    var marks = "";
    if (min < 0 && max > 0) { var y0 = y(0).toFixed(1); marks += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y0 + '" y2="' + y0 + '" class="zl"/><text x="' + (pl + 4) + '" y="' + (+y0 - 5) + '" class="ml">₹0</text>'; }
    var po = payoff(sim);
    if (po !== null && po > 0 && po <= n) marks += '<circle cx="' + x(po).toFixed(1) + '" cy="' + y(A[po]).toFixed(1) + '" r="5" class="cx"/>';
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Net worth over time if you rent or buy">' + grid + xl +
      '<path d="' + path(B) + '" class="ln rent"/><path d="' + path(A) + '" class="ln buy"/>' + marks + "</svg>";
  }

  function yearRows(rows, H) {
    var out = [];
    for (var yI = 0; yI * 12 < H; yI++) {
      var ms = rows.slice(yI * 12, Math.min(yI * 12 + 12, H)), sum = function (f) { return ms.reduce(function (s, r) { return s + r[f]; }, 0); }, e = ms[ms.length - 1];
      out.push({ y: yI + 1, emi: sum("emi"), interest: sum("interest"), own: sum("own"), rent: sum("rent"), invB: sum("invB"), invR: sum("invR"), refB: sum("refB"), refR: sum("refR"), bal: e.bal, home: e.home, cB: e.cB, cR: e.cR, months: ms });
    }
    return out;
  }
  var COLS = {
    buy: [["EMI paid", "emi"], ["Interest", "interest"], ["Rent", "rentB"], ["Upkeep", "own"], ["Tax saved", "refB"], ["Invested", "invB"], ["Loan left", "bal"], ["Home value", "home"], ["Investments", "cB"]],
    rent: [["Rent paid", "rent"], ["Tax saved", "refR"], ["Invested", "invR"], ["Investments", "cR"]]
  };
  function colsFor(which) { return COLS[which].filter(function (c) { return (c[1].indexOf("ref") !== 0 || S.regime === "old") && (c[1] !== "rentB" || S.uc); }); }
  function table(sim, which) {
    var cols = colsFor(which), rows = yearRows(sim.rows, sim.H), h = "";
    rows.forEach(function (r) {
      h += '<tbody><tr class="yr"><th scope="row"><button type="button" class="yb" aria-expanded="false" data-y="' + r.y + '">Year ' + r.y + "</button></th>" + cols.map(function (c) { return "<td>" + inr(r[c[1]]) + "</td>"; }).join("") + "</tr>";
      r.months.forEach(function (m) { h += '<tr class="mo" data-of="' + r.y + '" hidden><th scope="row">Month ' + m.m + "</th>" + cols.map(function (c) { return "<td>" + inr(m[c[1]]) + "</td>"; }).join("") + "</tr>"; });
      h += "</tbody>";
    });
    return '<table class="calc"><thead><tr><th scope="col">Period</th>' + cols.map(function (c) { return '<th scope="col">' + c[0] + "</th>"; }).join("") + "</tr></thead>" + h + "</table>";
  }
  /* rows: [label, buy, rent, kind]; kind: head | sub | total. null = not applicable to that choice */
  function moneyRows(sim) {
    var b = sim.buy, r = sim.rent, old = S.regime === "old", yrs = S.stay + (S.stay === 1 ? " year" : " years"), rows = [
      ["Paid at the start", null, null, "head"],
      ["Down payment", b.down, null],
      ["Stamp duty, registration, other costs", b.costs, null],
      ["Security deposit", S.uc ? b.deposit : null, r.upfront],
      ["Paid over " + yrs, null, null, "head"],
      [S.uc ? "EMIs (pre-EMI interest while it's built)" : "EMIs", b.emi, null], ["of which interest", b.interest, null, "sub"],
      ["Rent while the home is built", S.uc ? b.rent : null, null],
      ["Rent", null, r.rent],
      ["Maintenance, property tax, repairs", b.own, null]];
    if (S.depUp) rows.push(["Deposit top-ups at renewal", S.uc ? b.tops : null, r.tops]);
    if (S.uc && b.back) rows.push(["Deposit back when you move in", -b.back, null]);
    rows.push(["Put into investments", b.invested, r.invested]);
    if (old) rows.push(["of which tax saved", b.refunds, r.refunds, "sub"]);
    rows.push(["At the end of year " + S.stay, null, null, "head"]);
    if (S.keep) rows.push(["Home value (you keep it)", b.home, null]);
    else rows.push(["Home sold for, after selling costs", b.saleNet, null], ["Tax on the home sale", b.propTax ? -b.propTax : 0, null]);
    rows.push([S.keep ? "Loan still owed" : "Loan to repay", b.loanLeft ? -b.loanLeft : 0, null],
      ["Investments after tax", b.gross - b.invTax, r.gross - r.invTax],
      ["Deposit back", b.depEnd ? b.depEnd : null, r.deposit],
      ["You end up with", b.final, r.final, "total"]);
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
  function growTxt(g) { return (g > 0 ? "" : "") + g + "% a year"; }
  var tabWhich = "buy", last = null;
  function render() {
    document.querySelectorAll("[data-kind]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-kind") === S.kind ? "true" : "false"); });
    document.querySelectorAll("[data-regime]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-regime") === S.regime ? "true" : "false"); });
    document.querySelectorAll("[data-metro]").forEach(function (b) { b.setAttribute("aria-pressed", (b.getAttribute("data-metro") === "1") === S.metro ? "true" : "false"); });
    document.querySelectorAll("[data-end]").forEach(function (b) { b.setAttribute("aria-pressed", (b.getAttribute("data-end") === "keep") === S.keep ? "true" : "false"); });
    document.querySelectorAll("[data-uc]").forEach(function (b) { b.setAttribute("aria-pressed", (b.getAttribute("data-uc") === "1") === S.uc ? "true" : "false"); });
    $("rb-uc-box").hidden = !S.uc;
    $("rb-sell-box").hidden = S.keep;
    $("rb-old").hidden = S.regime !== "old";
    $("rb-hra-box").hidden = !S.claimHra;
    var loan = Math.max(0, S.price - S.down);
    $("rb-loanTxt").textContent = S.down > S.price ? "Down payment is more than the price, so there's no loan." : loan ? "Loan: " + inr(loan) + " (" + Math.round(loan / S.price * 100) + "% of the price)" : "No loan: you pay the full price.";
    var sim = simulate(opts()), be = breakeven(opts()), po = payoff(sim); last = { sim: sim, be: be, po: po };
    var d = sim.diff, B = sim.buy, R = sim.rent, v = $("rbVerdict"), yrs = S.stay + (S.stay === 1 ? " year" : " years");
    var buyEnd = S.keep ? " if you buy and keep the home (counted at its market value)" : " if you buy and sell at the end";
    if (Math.abs(d) < Math.max(Math.abs(B.final), Math.abs(R.final)) * 0.01) {
      v.innerHTML = '<p class="k">After ' + yrs + ", if home prices grow " + growTxt(S.grow) + '</p><p class="v">It\'s a <b>near tie</b></p><p class="k">Both choices end within ' + short(Math.abs(d)) + " of each other. Decide on what matters to you beyond money.</p>";
    } else if (d > 0) {
      v.innerHTML = '<p class="k">After ' + yrs + ", if home prices grow " + growTxt(S.grow) + '</p><p class="v">Renting wins by <b>' + short(d) + '</b></p><p class="k">Renting and investing the difference leaves you with ' + short(R.final) + " after tax, against " + short(B.final) + buyEnd + ".</p>";
    } else {
      v.innerHTML = '<p class="k">After ' + yrs + ", if home prices grow " + growTxt(S.grow) + '</p><p class="v">Buying wins by <b>' + short(-d) + '</b></p><p class="k">Buying leaves you with ' + short(B.final) + (S.keep ? " in home value and investments" : " after selling and tax") + ", against " + short(R.final) + " if you rent and invest the difference.</p>";
    }
    $("rbBarT").textContent = Math.abs(d) < Math.max(Math.abs(B.final), Math.abs(R.final)) * 0.01 ? "Near tie" : (d > 0 ? "Renting" : "Buying") + " wins by " + short(Math.abs(d));
    $("rbEmi").textContent = inr(sim.emi);
    $("rbUp").textContent = short(B.upfront);
    $("rbBe").textContent = be.kind === "rate" ? be.rate.toFixed(1) + "% a year" : be.kind === "buy-always" ? "Buying wins even if prices fall" : "Above 30% a year";
    $("rbPay").textContent = po === null ? "Not within 30 years" : po === 0 ? "From day one" : "After " + yrsTxt(po);
    $("rbChart").innerHTML = chart(sim);
    $("rbCross").textContent = po !== null && po > 0 && po <= sim.H ? "The dot marks " + yrsTxt(po) + ", when buying pulls ahead and stays ahead for the rest of your stay." : po !== null && po > sim.H ? "Buying pulls ahead only after " + yrsTxt(po) + ", beyond your " + yrs + " stay." : "";
    var mr = moneyRows(sim);
    $("rbMoney").innerHTML = moneyCard(mr, 1, "If you buy", "pre") + moneyCard(mr, 2, "If you rent and invest", "inv");
    $("rbMoneyNote").textContent = "Both choices use the same money each month. Whichever costs less that month invests the difference" + (S.regime === "old" ? ", and any tax saved is invested too" : "") + ". At the start, the renter invests what the buyer spends on the down payment and buying costs." + (S.uc ? " While the home is being built, the buyer pays rent too." : "");
    $("rbSens").innerHTML = [S.grow - 2, S.grow, S.grow + 2].map(function (gr) {
      var dd = simulate(opts({ grow: gr })).diff;
      return '<div class="sv' + (gr === S.grow ? " cur" : "") + '"><span class="l">Prices grow ' + gr + "% a year</span><span class=\"n\">" + (Math.abs(dd) < 1 ? "Tie" : (dd > 0 ? "Rent +" : "Buy +") + short(Math.abs(dd))) + "</span></div>";
    }).join("");
    $("rbTable").innerHTML = table(sim, tabWhich);
    document.querySelectorAll("[data-tab]").forEach(function (b) { b.setAttribute("aria-selected", b.getAttribute("data-tab") === tabWhich ? "true" : "false"); });
    var nq = new URLSearchParams({ P: Math.max(100000, Math.round(sim.loan)), rate: S.rate, years: S.tenure, ret: S.ret, kind: S.kind, regime: S.regime, slab: S.slab });
    var nx = $("rbNext"); nx.hidden = sim.loan < 100000; nx.href = "/prepay-vs-invest/?" + nq.toString();
    $("rbNotes").innerHTML = notes().map(function (t) { return "<li>" + t + "</li>"; }).join("");
  }
  function notes() {
    var n = [S.keep ? "You keep the home at the end of year " + S.stay + ". We count it at its market value then, with no selling costs or tax, and subtract any loan still owed. Selling later would cost selling charges and tax on the gain." :
      "You sell the home at the end of year " + S.stay + " and pay " + S.sell + "% of the sale price in selling costs. That's how we count what the home is worth to you in cash.",
      "Home prices grow a steady " + S.grow + "% a year and rent rises " + S.rentUp + "% a year. Maintenance, property tax and repairs rise " + S.ownUp + "% a year.",
      "Your investments grow a steady " + S.ret + "% a year. Real returns go up and down.",
      S.depUp ? "The security deposit rises with the rent each year, earns nothing, and comes back in full when you move out." : "The security deposit stays the same, earns nothing, and comes back in full when you move out.",
      "The owner's costs are paid by you as the buyer; the tenant pays none of them. The loan rate stays the same, and there are no prepayments."];
    if (S.uc) n.push("Under construction: possession in " + S.possess + (S.possess === 1 ? " year" : " years") + ". The full loan is paid out at the start and you pay interest only (pre-EMI) until possession, then the EMI for " + S.tenure + " years. You keep renting until then, and your deposit comes back when you move in. Construction delays aren't included.");
    if (S.kind === "equity") n.push("Equity gains are taxed at 12.5% plus cess above ₹1,25,000, once, when you sell at the end.");
    if (S.kind === "debt") n.push("Debt fund gains are taxed at your " + S.slab + "% slab plus cess when you sell.");
    if (S.kind === "fd") n.push("FD interest is taxed every year at your " + S.slab + "% slab plus cess, so money grows at " + (S.ret * (1 - S.slab / 100 * CESS)).toFixed(2) + "% a year after tax.");
    if (!S.keep) {
      if (S.stay * 12 <= 24) n.push("The home is held for 24 months or less, so the gain is short-term and taxed at your " + S.slab + "% slab plus cess. The reinvestment exemption doesn't apply.");
      else if (S.reinvest) n.push("You put the gain into another home within the time allowed, so it's exempt under section 82 of the Income-tax Act, 2025 (section 54 of the 1961 Act), up to ₹10 crore of gain.");
      else n.push("The gain on the home is long-term (held over 24 months): taxed at 12.5% plus cess, without indexation.");
    }
    if (S.regime === "new") n.push("New regime: no tax benefit on home loan interest or principal for a home you live in, and no HRA exemption.");
    else {
      n.push("Old regime, buying: " + (S.claimInt ? "interest deduction up to " + (S.uc && S.possess > 5 ? "₹30,000 (possession more than 5 years away)" : "₹2,00,000") + " a year" + (S.uc ? ", with interest from before the year of possession claimed in five equal parts from that year, inside the same limit" : "") + ", " : "no interest deduction, ") + "plus principal (and stamp duty and registration in year 1) up to the " + inr(S.room) + " of room you have left in the ₹1,50,000 limit.");
      n.push(S.claimHra ? "Old regime, renting: HRA exemption on " + (S.metro ? "50%" : "40%") + " of basic, or rent minus 10% of basic, or the HRA you get, whichever is lowest. Your basic and HRA rise in line with rent." + (S.uc ? " The buyer claims it too while renting before possession." : "") : "Old regime, renting: no HRA exemption claimed.");
    }
    return n;
  }

  $("rbTable").addEventListener("click", function (e) {
    var b = e.target.closest(".yb"); if (!b) return;
    var open = b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", open ? "true" : "false");
    this.querySelectorAll('tr[data-of="' + b.getAttribute("data-y") + '"]').forEach(function (r) { r.hidden = !open; });
  });
  document.querySelectorAll("[data-tab]").forEach(function (b) { b.addEventListener("click", function () { tabWhich = b.getAttribute("data-tab"); $("rbTable").innerHTML = table(last.sim, tabWhich); document.querySelectorAll("[data-tab]").forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); }); }); });

  /* ---------- Reports (the report code loads only when asked) ---------- */
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function spec() {
    var sim = last.sim, be = last.be, po = last.po, yr = yearRows(sim.rows, sim.H), old = S.regime === "old";
    var inputs = [["Home price", inr(S.price), S.price], ["Down payment", inr(S.down), S.down], ["Stamp duty", inr(S.stamp), S.stamp], ["Registration", inr(S.reg), S.reg],
      ["Other buying costs", inr(S.other), S.other], ["Loan", inr(sim.loan), sim.loan], ["Loan rate", S.rate + "% a year"], ["Loan tenure", S.tenure + " years"],
      ["Rent today", inr(S.rent) + " a month", S.rent], ["Rent increase", S.rentUp + "% a year"], ["Security deposit", inr(S.deposit), S.deposit], ["Deposit rises with rent", S.depUp ? "Yes" : "No"], ["Owner's yearly costs", inr(S.own), S.own], ["Owner's costs rise", S.ownUp + "% a year"],
      ["Possession", S.uc ? "In " + S.possess + " years (under construction)" : "Ready to move in"], ["At the end", S.keep ? "Keep the home" : "Sell the home"],
      ["How long you'll stay", S.stay + " years"], ["Home price growth", S.grow + "% a year"], ["Investment return", S.ret + "% a year"],
      ["Invested in", { equity: "Equity funds", debt: "Debt fund", fd: "Fixed deposit" }[S.kind]], ["Selling costs", S.keep ? "Not applied (you keep it)" : S.sell + "% of sale price"], ["Gain put into another home", !S.keep && S.reinvest ? "Yes" : "No"], ["Tax regime", old ? "Old" : "New"], ["Tax slab", S.slab + "%"]];
    if (old) {
      inputs.push(["Home loan interest deduction", S.claimInt ? "Yes" : "No"], ["Room left in ₹1,50,000 limit", inr(S.room), S.room], ["HRA exemption", S.claimHra ? "Yes" : "No"]);
      if (S.claimHra) inputs.push(["Basic salary", inr(S.basic) + " a month", S.basic], ["HRA received", inr(S.hra) + " a month", S.hra], ["City", S.metro ? "Metro (50%)" : "Other (40%)"]);
    }
    function trow(r, which) { return [r.y !== undefined ? "Year " + r.y : "Month " + r.m].concat(colsFor(which).map(function (c) { return r[c[1]]; })); }
    function tb(which, title, sheet) {
      var months = []; yr.forEach(function (y) { y.months.forEach(function (m) { months.push([m.m].concat(colsFor(which).map(function (c) { return m[c[1]]; }))); }); });
      return { title: title, sheet: sheet, cols: ["Year"].concat(colsFor(which).map(function (c) { return c[0]; })), yearly: yr.map(function (r) { return trow(r, which); }), monthly: months };
    }
    var cats = []; for (var i = 0; i <= S.stay; i++) cats.push(i);
    return {
      title: "Rent or Buy Report", path: "salarist.in/rent-vs-buy", url: location.origin + location.pathname, file: "salarist-rent-vs-buy",
      question: "Should you rent or buy a " + short(S.price) + " home?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#rbVerdict p"), function (p) { return p.textContent; }),
      verdictColor: sim.diff >= 0 ? "blue" : "amber",
      inputs: inputs,
      keyNums: [["Your EMI", inr(sim.emi), sim.emi], ["Cash needed to buy", short(sim.buy.upfront), sim.buy.upfront],
        ["Buying wins if prices grow above", $("rbBe").textContent], ["Buying pays off", $("rbPay").textContent]],
      sensTitle: "What if home prices grow differently?",
      sens: Array.prototype.map.call(document.querySelectorAll("#rbSens .sv"), function (el) { return [el.querySelector(".l").textContent, el.querySelector(".n").textContent]; }),
      sensCurrent: 1,
      chartTitle: "Net worth over time", chartNote: S.keep ? "Home value plus investments after tax, minus the loan, each month." : "What you'd have if you sold everything that month, after tax and the loan.",
      chart: { series: [{ name: "Rent and invest", color: "blue", data: sim.netR.slice(0, sim.H + 1) }, { name: "Buy", color: "amber", data: sim.netB.slice(0, sim.H + 1) }],
               cross: po !== null && po > 0 && po <= sim.H ? { m: po, label: "Buying pulls ahead" } : null },
      chartYears: cats,
      money: { cols: ["Buy", "Rent and invest"], rows: moneyRows(sim), note: $("rbMoneyNote").textContent },
      tables: [tb("buy", "If you buy: year by year", "Buy"), tb("rent", "If you rent and invest: year by year", "Rent")],
      notes: notes().map(function (t) { var d = document.createElement("div"); d.innerHTML = t; return d.textContent; }),
      taxRules: ["Home sale: gains on a home held over 24 months are long-term, taxed at 12.5% plus 4% cess without indexation. Held 24 months or less: your slab rate plus cess.",
        "Reinvesting the gain in another home: exempt under section 82 of the Income-tax Act, 2025 (earlier section 54), up to ₹10 crore of gain, if you buy or build within the time limits.",
        "Home loan interest, old regime: up to ₹2,00,000 a year for a home you live in (section 22 of the Income-tax Act, 2025, earlier section 24(b)). Interest paid before the year of possession is claimed in five equal yearly parts from that year, within the same limit; if possession comes more than 5 years after the loan year, the limit is ₹30,000. New regime: no deduction.",
        "Principal repayment, stamp duty and registration, old regime: within the ₹1,50,000 limit of section 123 (earlier section 80C). New regime: no deduction.",
        "HRA, old regime only: the lowest of HRA received, rent minus 10% of basic, and 50% of basic in Delhi, Mumbai, Kolkata, Chennai, Bengaluru, Hyderabad, Pune and Ahmedabad (40% elsewhere), as per the Income-tax Rules, 2026.",
        "Equity mutual funds: long-term gains taxed at 12.5% above ₹1,25,000 a year, plus cess. Debt funds and FDs: your slab rate plus cess."],
      short: short, inr: inr
    };
  }
  function busy(btn, on) { btn.disabled = on; btn.setAttribute("aria-busy", on ? "true" : "false"); }
  $("rbPdf").addEventListener("click", function () {
    var btn = this; busy(btn, true); say("Preparing your report…");
    withReport(function (K) { K.pdf(spec()).then(function () { busy(btn, false); say("PDF report downloaded."); }, function () { busy(btn, false); say("Couldn't make the PDF. Please try again."); }); });
  });
  $("rbXlsx").addEventListener("click", function () {
    var btn = this; busy(btn, true);
    withReport(function (K) { try { K.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(btn, false); });
  });

  /* ---------- Share link ---------- */
  function say(msg) { var s = $("rbStatus"); s.textContent = msg; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 3000); }
  function copy(text, ok) {
    function fb() { var t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); var r = false; try { r = document.execCommand("copy"); } catch (e) {} t.remove(); say(r ? ok : "Couldn't copy. Select the text and copy it yourself."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { say(ok); }, fb); else fb();
  }
  $("rbShare").addEventListener("click", function () {
    var q = new URLSearchParams();
    ["price", "down", "stamp", "reg", "other", "rate", "tenure", "rent", "rentUp", "deposit", "own", "ownUp", "stay", "grow", "ret", "kind", "sell", "regime", "slab"].forEach(function (k) { q.set(k, S[k]); });
    ["depUp", "keep", "reinvest", "uc"].forEach(function (k) { if (S[k]) q.set(k, "1"); }); if (S.uc) q.set("possess", S.possess);
    if (S.regime === "old") { ["room", "basic", "hra"].forEach(function (k) { q.set(k, S[k]); }); ["claimInt", "claimHra", "metro"].forEach(function (k) { q.set(k, S[k] ? "1" : "0"); }); }
    copy(location.origin + location.pathname + "?" + q.toString(), "Link copied. It holds only the numbers on screen.");
  });

  /* ---------- Share as image ---------- */
  var PAL = {
    blue: { bg: "#1F5FE0", text: "#FFFFFF", sub: "rgba(255,255,255,0.88)", acc: "#FFD27A", card: "#FFFFFF", cardText: "#0E1726", cardLine: "#E6ECF5", hi: "#0B7F5A", tagBg: "#FFFFFF", tagText: "#1F5FE0", ink: "#FFFFFF", coin: "#FFFFFF", rule: "rgba(255,255,255,0.35)", buy: "#FFD27A", rent: "#FFFFFF" },
    dark: { bg: "#07090D", text: "#E8EEF7", sub: "#C9D3E2", acc: "#F5B547", card: "#10161F", cardText: "#E8EEF7", cardLine: "#2A3850", hi: "#3DD68C", tagBg: "#4C8DFF", tagText: "#061226", ink: "#E8EEF7", coin: "#4C8DFF", rule: "#2A3850", glow: true, buy: "#F5B547", rent: "#4C8DFF" }
  };
  var FONT = '"Plus Jakarta Sans", system-ui, sans-serif';
  function rr(c, X, Y, W, H, Rr) { Rr = Math.min(Rr, W / 2, H / 2); c.beginPath(); c.moveTo(X + Rr, Y); c.arcTo(X + W, Y, X + W, Y + H, Rr); c.arcTo(X + W, Y + H, X, Y + H, Rr); c.arcTo(X, Y + H, X, Y, Rr); c.arcTo(X, Y, X + W, Y, Rr); c.closePath(); }
  function box(c, X, Y, W, H, Rr, f, s) { rr(c, X, Y, W, H, Rr); if (f) { c.fillStyle = f; c.fill(); } if (s) { c.strokeStyle = s; c.lineWidth = 2; c.stroke(); } }
  function txt(c, t, X, Y, sz, w, col, al) { c.font = w + " " + sz + "px " + FONT; c.fillStyle = col; c.textAlign = al || "left"; c.textBaseline = "alphabetic"; c.fillText(t, X, Y); return c.measureText(t).width; }
  function fit(c, t, sz, w, max, min) { min = min || 20; while (sz > min) { c.font = w + " " + sz + "px " + FONT; if (c.measureText(t).width <= max) break; sz -= 2; } return sz; }
  function logo(c, X, Y, h, ink, coin) {
    var svg = document.querySelector(".top .brand svg"); if (!svg) return;
    var vb = svg.getAttribute("viewBox").split(/\s+/).map(Number), k = h / vb[3];
    c.save(); c.translate(X, Y); c.scale(k, k); c.translate(-vb[0], -vb[1]);
    c.fillStyle = ink; c.fill(new Path2D(svg.querySelector(".ink").getAttribute("d")));
    var ci = svg.querySelector(".coin"); c.beginPath(); c.arc(+ci.getAttribute("cx"), +ci.getAttribute("cy"), +ci.getAttribute("r"), 0, 7); c.fillStyle = coin; c.fill(); c.restore();
  }
  function autoTitle() { return "Renting vs buying a " + short(S.price) + " home, " + S.stay + "-year stay:"; }
  function draw(pal, title) {
    var T = PAL[pal], W = 1080, H = 1350, P = 84, inner = W - 2 * P, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var c = cv.getContext("2d"), sim = last.sim, be = last.be, po = last.po, d = sim.diff;
    c.fillStyle = T.bg; c.fillRect(0, 0, W, H);
    if (T.glow) { var gr = c.createRadialGradient(W * 0.9, 0, 10, W * 0.9, 0, 760); gr.addColorStop(0, "rgba(76,141,255,0.38)"); gr.addColorStop(1, "rgba(76,141,255,0)"); c.fillStyle = gr; c.fillRect(0, 0, W, H); }
    logo(c, P, 70, 56, T.ink, T.coin);
    c.font = "800 24px " + FONT; var tag = "MONEY HACK", tw = c.measureText(tag).width + 44;
    box(c, W - P - tw, 70, tw, 52, 26, T.tagBg); txt(c, tag, W - P - tw / 2, 105, 24, 800, T.tagText, "center");
    txt(c, title, P, 212, fit(c, title, 40, 700, inner, 26), 700, T.sub);
    var l1 = (d >= 0 ? "Renting" : "Buying") + " wins", l2 = "by " + short(Math.abs(d));
    var hs = Math.min(fit(c, l1, 140, 800, inner), fit(c, l2, 140, 800, inner));
    var y = 212 + hs * 1.02; txt(c, l1, P, y, hs, 800, T.text);
    y += hs * 0.98; var wb = txt(c, "by ", P, y, hs, 800, T.text); txt(c, short(Math.abs(d)), P + wb, y, hs, 800, T.acc);
    var rows = [["Buying pays off", po === null ? "Not in 30 yrs" : po === 0 ? "Day one" : "After " + yrsTxt(po).replace("years", "yrs").replace("year", "yr")],
      ["Buying wins if prices grow", be.kind === "rate" ? "above " + be.rate.toFixed(1) + "%" : be.kind === "buy-always" ? "at any rate" : "above 30%"],
      ["Cash needed to buy", short(sim.buy.upfront)],
      ["EMI vs rent today", short(sim.emi) + " vs " + short(S.rent)]];
    var cy = y + 44, rowH = 70, ch = 28 * 2 + rowH * rows.length;
    box(c, P, cy, inner, ch, 40, T.card, pal === "dark" ? T.cardLine : null);
    var ry = cy + 28;
    rows.forEach(function (rw, i) {
      txt(c, rw[0], P + 40, ry + 46, 32, 700, T.cardText);
      txt(c, rw[1], W - P - 40, ry + 46, fit(c, rw[1], 34, 800, inner * 0.42), 800, i === 0 && po !== null ? T.hi : T.cardText, "right");
      if (i < rows.length - 1) { c.strokeStyle = T.cardLine; c.lineWidth = 2; c.beginPath(); c.moveTo(P + 40, ry + rowH); c.lineTo(W - P - 40, ry + rowH); c.stroke(); }
      ry += rowH;
    });
    var top = cy + ch + 44, fy = H - 214, gh = fy - 40 - top - 40;
    if (gh > 80) {
      var A = sim.netB.slice(0, sim.H + 1), B = sim.netR.slice(0, sim.H + 1), n = sim.H, all = A.concat(B), mx = Math.max.apply(null, all), mn = Math.min.apply(null, all), sp = (mx - mn) || 1;
      var px = function (i) { return P + i / n * inner; }, py = function (v) { return top + (mx - v) / sp * gh; };
      [[B, T.rent], [A, T.buy]].forEach(function (s) { c.beginPath(); for (var i = 0; i <= n; i++) { var X = px(i), Y = py(s[0][i]); if (i) c.lineTo(X, Y); else c.moveTo(X, Y); } c.strokeStyle = s[1]; c.lineWidth = 6; c.lineJoin = "round"; c.stroke(); });
      var lx = P, ly = top + gh + 40;
      [[T.rent, "Rent and invest"], [T.buy, "Buy"]].forEach(function (it) { box(c, lx, ly - 20, 26, 26, 7, it[0]); lx += 38; lx += txt(c, it[1], lx, ly, 26, 600, T.sub) + 30; });
      txt(c, "Net worth over " + S.stay + " years", W - P, ly, 26, 600, T.sub, "right");
    }
    c.strokeStyle = T.rule; c.lineWidth = 2; c.beginPath(); c.moveTo(P, fy); c.lineTo(W - P, fy); c.stroke();
    txt(c, "Rent or buy? Check yours, free", P, fy + 60, 34, 800, T.text);
    txt(c, "salarist.in/rent-vs-buy", P, fy + 108, 42, 800, T.acc);
    txt(c, "Prices +" + S.grow + "%/yr · Investments " + S.ret + "%/yr · " + (S.regime === "old" ? "Old" : "New") + " regime" + (S.keep ? " · Home kept" : " · After tax") + (S.uc ? " · Under construction" : ""), P, fy + 150, 24, 600, T.sub);
    return cv;
  }
  var blob = null, pal = "blue", title = "", rt;
  function theme() { var t = document.documentElement.getAttribute("data-theme"); if (t) return t; return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
  function redraw() {
    var cv = draw(pal, title || autoTitle()); $("rbImg").src = cv.toDataURL("image/png"); blob = null; cv.toBlob(function (b) { blob = b; });
    document.querySelectorAll("[data-pal]").forEach(function (b) { b.setAttribute("aria-checked", b.getAttribute("data-pal") === pal ? "true" : "false"); });
  }
  $("rbImgBtn").addEventListener("click", function () {
    pal = theme() === "dark" ? "dark" : "blue"; title = ""; $("rbImgTitle").value = autoTitle();
    (document.fonts && document.fonts.load ? Promise.all(["800", "700", "600"].map(function (w) { return document.fonts.load(w + ' 40px "Plus Jakarta Sans"'); })) : Promise.resolve())
      .catch(function () {}).then(function () { redraw(); $("rbImgStatus").textContent = ""; var dl = $("rbDlg"); if (dl.showModal) dl.showModal(); else dl.setAttribute("open", ""); });
  });
  document.querySelectorAll("[data-pal]").forEach(function (b) { b.addEventListener("click", function () { pal = b.getAttribute("data-pal"); redraw(); }); });
  $("rbImgTitle").addEventListener("input", function () { title = this.value.trim().slice(0, 70); clearTimeout(rt); rt = setTimeout(redraw, 150); });
  $("rbImgTitleReset").addEventListener("click", function () { title = ""; $("rbImgTitle").value = autoTitle(); redraw(); });
  function save() {
    if (!blob) return; var u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = "salarist-rent-vs-buy.png"; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 500); $("rbImgStatus").textContent = "Image saved.";
  }
  $("rbImgShare").addEventListener("click", function () {
    if (!blob) return;
    var f = new File([blob], "salarist-rent-vs-buy.png", { type: "image/png" }), d = last.sim.diff;
    var text = (d >= 0 ? "Renting beats buying for me by " : "Buying beats renting for me by ") + short(Math.abs(d)) + ". Check yours free: " + location.origin + location.pathname;
    if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], text: text, title: "Rent or buy?" }).catch(function () {});
    else { save(); copy(text, "Image saved, and a message to go with it is copied."); }
  });
  $("rbImgDl").addEventListener("click", save);
  $("rbImgClose").addEventListener("click", function () { var dl = $("rbDlg"); if (dl.close) dl.close(); else dl.removeAttribute("open"); });

  (function bar() {   /* phones: keep the result in sight while you edit a long form */
    var el = $("rbBar"), seen = false, inForm = false;
    function upd() { el.hidden = seen || !inForm; }
    if (!("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("rbVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".rb .lp-setup"));
    $("rbBarBtn").addEventListener("click", function () { $("rbVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
