/* Salarist: Prepay home loan or invest? Runs entirely in the browser; nothing is stored or sent. */
(function () {
  "use strict";
  var CESS = 1.04, LTCG_RATE = 0.125, LTCG_EXEMPT = 125000, HL_CAP = 200000;

  /* ---------- Core ---------- */
  function emiOf(P, annualPct, months) {
    var r = annualPct / 1200;
    if (months <= 0) return 0;
    if (r === 0) return P / months;
    var f = Math.pow(1 + r, months);
    return P * r * f / (f - 1);
  }

  /* o: {P, rate, years, extra, lump, ret, kind:'equity'|'debt'|'fd', regime:'new'|'old', slab, claim} */
  function simulate(o) {
    var N = Math.round(o.years * 12), r = o.rate / 1200, emi = emiOf(o.P, o.rate, N);
    var slab = o.slab / 100, fdNet = o.kind === "fd" ? o.ret * (1 - slab * CESS) : o.ret;
    var g = Math.pow(1 + fdNet / 100, 1 / 12) - 1;
    var claim = o.regime === "old" && o.claim, taxRate = slab * CESS;

    function path(prepay) {
      var bal = o.P, corpus = 0, paidIn = 0, interestTotal = 0, yearInt = 0, payoff = N, net = [], rows = [], bank = 0;
      var lumpToLoan = 0;
      if (prepay) { lumpToLoan = Math.min(o.lump, bal); bal -= lumpToLoan; bank += lumpToLoan; corpus += o.lump - lumpToLoan; paidIn += o.lump - lumpToLoan; }
      else { corpus += o.lump; paidIn += o.lump; }
      net.push(corpus - bal);
      for (var m = 1; m <= N; m++) {
        corpus *= 1 + g;
        var invest = 0, emiPaid = 0, toLoan = 0, it = 0, refund = 0;
        if (bal > 0.5) {
          it = bal * r; var pr = Math.min(emi - it, bal);
          bal -= pr; interestTotal += it; yearInt += it; emiPaid = it + pr; invest += emi - emiPaid;   /* any unused part of the last EMI is invested */
          if (prepay) {
            toLoan = Math.min(o.extra, bal); bal -= toLoan; invest += o.extra - toLoan;
            if (bal <= 0.5) { bal = 0; payoff = m; }
          } else invest += o.extra;
        } else {
          bal = 0; invest += emi + o.extra;           /* loan closed: EMI and extra both go to investing */
        }
        if (m % 12 === 0 || m === N) {               /* old regime: tax saved on the year's interest is invested */
          if (claim) { refund = Math.min(yearInt, HL_CAP) * taxRate; invest += refund; }
          yearInt = 0;
        }
        bank += emiPaid + toLoan;
        corpus += invest; paidIn += invest;
        net.push(corpus - bal);
        rows.push({ m: m, emi: emiPaid, extra: toLoan, interest: it, bal: bal, invest: invest, refund: refund, corpus: corpus });
      }
      var gain = Math.max(0, corpus - paidIn), tax = 0;
      if (o.kind === "equity") tax = Math.max(0, gain - LTCG_EXEMPT) * LTCG_RATE * CESS;
      else if (o.kind === "debt") tax = gain * taxRate;
      return { final: corpus - tax, gross: corpus, tax: tax, interest: interestTotal, payoff: payoff, net: net, rows: rows,
               bank: bank, invested: paidIn, growth: corpus - paidIn, lumpToLoan: lumpToLoan };
    }
    var A = path(true), B = path(false);
    return { emi: emi, N: N, prepay: A, invest: B, diff: B.final - A.final };
  }

  function breakeven(o) {
    function d(ret) { var c = Object.assign({}, o, { ret: ret }); return simulate(c).diff; }
    var lo = 0, hi = 30, dl = d(lo), dh = d(hi);
    if (dl > 0) return { kind: "invest-always" };
    if (dh < 0) return { kind: "prepay-always" };
    for (var i = 0; i < 40; i++) { var m = (lo + hi) / 2; if (d(m) < 0) lo = m; else hi = m; }
    return { kind: "rate", rate: (lo + hi) / 2 };
  }

  if (typeof module !== "undefined" && module.exports) { module.exports = { emiOf: emiOf, simulate: simulate, breakeven: breakeven }; return; }

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

  var S = { P: 4000000, rate: 8.5, years: 15, extra: 15000, lump: 0, ret: 12, kind: "equity", regime: "new", slab: 30, claim: true };
  var FIELDS = { P: [100000, 50000000, 50000], rate: [5, 15, 0.05], years: [1, 30, 1], extra: [0, 500000, 1000], lump: [0, 20000000, 50000], ret: [3, 18, 0.5] };

  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    Object.keys(FIELDS).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= FIELDS[k][0] && v <= FIELDS[k][1]) S[k] = v; });
    if (["equity", "debt", "fd"].indexOf(q.get("kind")) > -1) S.kind = q.get("kind");
    if (["new", "old"].indexOf(q.get("regime")) > -1) S.regime = q.get("regime");
    var sl = parseInt(q.get("slab"), 10); if ([0, 5, 10, 15, 20, 25, 30].indexOf(sl) > -1) S.slab = sl;
    if (q.get("claim") === "0") S.claim = false;
  })();

  var MONEY = { P: 1, extra: 1, lump: 1 };
  function shown(k, v) { return MONEY[k] ? fmt.format(v) : String(v); }
  function bindField(k) {
    var num = $("pv-" + k), rng = $("pv-" + k + "-r"), note = $("pv-" + k + "-w");
    function show() {
      num.value = shown(k, S[k]); rng.value = Math.min(S[k], +rng.max);
      if (note) note.textContent = words(S[k]);
    }
    num.addEventListener("input", function () {
      var raw = MONEY[k] ? this.value.replace(/[^0-9]/g, "") : this.value, v = parseFloat(raw);
      if (MONEY[k]) { this.value = raw ? fmt.format(+raw) : ""; }
      if (!isFinite(v)) { if (MONEY[k] && raw === "") v = 0; else return; }
      v = Math.max(FIELDS[k][0], Math.min(FIELDS[k][1], v)); S[k] = v; rng.value = Math.min(v, +rng.max); if (note) note.textContent = words(v); render();
    });
    num.addEventListener("blur", show);
    rng.addEventListener("input", function () { S[k] = parseFloat(this.value); num.value = shown(k, S[k]); if (note) note.textContent = words(S[k]); render(); });
    show();
  }
  Object.keys(FIELDS).forEach(bindField);
  document.querySelectorAll("[data-kind]").forEach(function (b) { b.addEventListener("click", function () { S.kind = b.getAttribute("data-kind"); render(); }); });
  document.querySelectorAll("[data-regime]").forEach(function (b) { b.addEventListener("click", function () { S.regime = b.getAttribute("data-regime"); render(); }); });
  $("pv-slab").value = String(S.slab);
  $("pv-slab").addEventListener("change", function () { S.slab = parseInt(this.value, 10); render(); });
  $("pv-claim").checked = S.claim;
  $("pv-claim").addEventListener("change", function () { S.claim = this.checked; render(); });

  function crossover(A, B) {
    /* first month after which the leader never changes, if the lead changes at all */
    var n = A.length - 1, sign = Math.sign(B[n] - A[n]), k = n;
    while (k > 0 && Math.sign(B[k - 1] - A[k - 1]) === sign) k--;
    return k >= 12 ? { m: k, invest: sign > 0 } : null;   /* ignore tiny early wobbles */
  }
  function chart(sim) {
    var A = sim.prepay.net, B = sim.invest.net, n = A.length - 1, W = 420, H = 270, pl = 54, pr = 8, pt = 28, pb = 26;
    var all = A.concat(B), max = Math.max.apply(null, all), min = Math.min.apply(null, all.concat([0])), span = (max - min) || 1;
    function x(i) { return pl + i / n * (W - pl - pr); }
    function y(v) { return pt + (max - v) / span * (H - pt - pb); }
    function path(arr) { var s = ""; for (var i = 0; i <= n; i += (n > 240 ? 2 : 1)) s += (s ? "L" : "M") + x(i).toFixed(1) + " " + y(arr[i]).toFixed(1); return s + "L" + x(n).toFixed(1) + " " + y(arr[n]).toFixed(1); }
    var grid = "";
    for (var k = 0; k <= 4; k++) { var v = min + span * k / 4, yy = y(v).toFixed(1); grid += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+yy + 3) + '" class="al" text-anchor="end">' + short(v) + "</text>"; }
    var yrs = n / 12, step = yrs > 20 ? 5 : yrs > 8 ? 2 : 1, xl = "";
    for (var t = 0; t <= yrs; t += step) xl += '<text x="' + x(t * 12).toFixed(1) + '" y="' + (H - 8) + '" class="al" text-anchor="middle">Yr ' + t + "</text>";
    var marks = "";
    if (min < 0 && max > 0) {
      var y0 = y(0).toFixed(1);
      marks += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y0 + '" y2="' + y0 + '" class="zl"/><text x="' + (pl + 4) + '" y="' + (+y0 - 5) + '" class="ml">₹0 · above this you own more than you owe</text>';
    }
    var pm = sim.prepay.payoff;
    if (pm < n) {
      var px = x(pm).toFixed(1);
      marks += '<line x1="' + px + '" x2="' + px + '" y1="' + pt + '" y2="' + (H - pb) + '" class="vl"/><text x="' + px + '" y="' + (pt - 8) + '" class="ml" text-anchor="' + (pm / n > 0.7 ? "end" : "middle") + '">Loan closed (prepay), yr ' + (pm / 12).toFixed(1).replace(/\.0$/, "") + "</text>";
    }
    var co = crossover(A, B);
    if (co) marks += '<circle cx="' + x(co.m).toFixed(1) + '" cy="' + y(B[co.m]).toFixed(1) + '" r="5" class="cx"/>';
    return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Net worth over time for both choices">' + grid + xl +
      '<path d="' + path(B) + '" class="ln inv"/><path d="' + path(A) + '" class="ln pre"/>' + marks + "</svg>";
  }

  function yearRows(rows, prepay) {
    var out = [], N = rows.length;
    for (var yI = 0; yI * 12 < N; yI++) {
      var ms = rows.slice(yI * 12, yI * 12 + 12), sum = function (f) { return ms.reduce(function (s, r) { return s + r[f]; }, 0); };
      out.push({ y: yI + 1, emi: sum("emi"), extra: sum("extra"), interest: sum("interest"), invest: sum("invest"), bal: ms[ms.length - 1].bal, corpus: ms[ms.length - 1].corpus, months: ms });
    }
    return out;
  }
  function table(sim, which) {
    var P = which === "prepay", rows = yearRows(sim[which].rows, P), h = "";
    rows.forEach(function (r) {
      h += '<tbody><tr class="yr"><th scope="row"><button type="button" class="yb" aria-expanded="false" data-y="' + r.y + '">Year ' + r.y + "</button></th>" +
        "<td>" + inr(r.emi) + "</td>" + (P ? "<td>" + inr(r.extra) + "</td>" : "") + "<td>" + inr(r.interest) + "</td><td>" + inr(r.bal) + "</td><td>" + inr(r.invest) + "</td><td>" + inr(r.corpus) + "</td></tr>";
      r.months.forEach(function (m) {
        h += '<tr class="mo" data-of="' + r.y + '" hidden><th scope="row">Month ' + m.m + "</th><td>" + inr(m.emi) + "</td>" + (P ? "<td>" + inr(m.extra) + "</td>" : "") + "<td>" + inr(m.interest) + "</td><td>" + inr(m.bal) + "</td><td>" + inr(m.invest) + "</td><td>" + inr(m.corpus) + "</td></tr>";
      });
      h += "</tbody>";
    });
    return '<table class="calc"><thead><tr><th scope="col">Period</th><th scope="col">EMI paid</th>' + (P ? '<th scope="col">Extra into loan</th>' : "") +
      '<th scope="col">Interest</th><th scope="col">Loan left</th><th scope="col">Invested</th><th scope="col">Investments value</th></tr></thead>' + h + "</table>";
  }
  var tabWhich = "prepay";
  function money(x, label, cls) {
    return '<div class="mw ' + cls + '"><h3>' + label + "</h3><dl>" +
      "<dt>Paid to the bank</dt><dd>" + inr(x.bank) + "</dd>" +
      '<dt class="sub">of which interest</dt><dd class="sub">' + inr(x.interest) + "</dd>" +
      "<dt>Put into investments</dt><dd>" + inr(x.invested) + "</dd>" +
      "<dt>Investment growth</dt><dd>+ " + inr(x.growth) + "</dd>" +
      "<dt>Tax on investments</dt><dd>− " + inr(x.tax) + "</dd>" +
      '<dt class="tot">You end up with</dt><dd class="tot">' + inr(x.final) + "</dd></dl></div>";
  }
  var last = null;
  function render() {
    document.querySelectorAll("[data-kind]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-kind") === S.kind ? "true" : "false"); });
    document.querySelectorAll("[data-regime]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-regime") === S.regime ? "true" : "false"); });
    $("pv-claim-row").hidden = S.regime !== "old";
    var sim = simulate(S), be = breakeven(S); last = { sim: sim, be: be };
    var d = sim.diff, yrs = S.years, A = sim.prepay, B = sim.invest;
    var savedInt = B.interest - A.interest, early = (sim.N - A.payoff) / 12;
    var v = $("pvVerdict");
    if (!S.extra && !S.lump) {
      v.innerHTML = '<p class="v">Add an extra amount</p><p class="k">Enter what you could pay each month, or a one-time amount, to compare the two choices.</p>';
    } else if (Math.abs(d) < Math.max(A.final, B.final) * 0.01) {
      v.innerHTML = '<p class="k">After ' + yrs + " years</p><p class=\"v\">It's a <b>near tie</b></p><p class=\"k\">Both choices end within " + short(Math.abs(d)) + " of each other. Go with what lets you sleep better.</p>";
    } else if (d > 0) {
      v.innerHTML = '<p class="k">After ' + yrs + ' years, at ' + S.ret + '% a year</p><p class="v">Investing wins by <b>' + short(d) + "</b></p><p class=\"k\">Investing the extra leaves you with " + short(B.final) + " after tax, against " + short(A.final) + " if you prepay and then invest.</p>";
    } else {
      v.innerHTML = '<p class="k">After ' + yrs + ' years, at ' + S.ret + '% a year</p><p class="v">Prepaying wins by <b>' + short(-d) + "</b></p><p class=\"k\">Clearing the loan first and then investing leaves you with " + short(A.final) + " after tax, against " + short(B.final) + " if you invest the extra from day one.</p>";
    }
    $("pvSaved").textContent = short(savedInt);
    $("pvEarly").textContent = early >= 0.05 ? (early >= 1 ? early.toFixed(1).replace(/\.0$/, "") + " years" : Math.round(early * 12) + " months") + " sooner" : "No change";
    $("pvBe").textContent = be.kind === "rate" ? be.rate.toFixed(1) + "% a year" : be.kind === "invest-always" ? "Investing wins at any return" : "Above 30% a year";
    $("pvEmi").textContent = inr(sim.emi);
    $("pvChart").innerHTML = chart(sim);
    var co = crossover(A.net, B.net);
    $("pvCross").textContent = co ? "The dot marks year " + (co.m / 12).toFixed(1).replace(/\.0$/, "") + ", when " + (co.invest ? "investing" : "prepaying") + " pulls ahead for good." : "";
    $("pvMoney").innerHTML = money(A, "If you prepay, then invest", "pre") + money(B, "If you invest the extra", "inv");
    $("pvMoneyNote").textContent = "Both choices use the same " + inr(A.bank + A.invested) + " of your money over " + S.years + " years. Prepaying sends less to the bank (" + short(B.interest - A.interest) + " less interest), and that money is invested once the loan closes, so it's already inside the totals.";
    var sens = [S.ret - 2, S.ret, S.ret + 2].filter(function (x) { return x > 0; }).map(function (rt) {
      var dd = simulate(Object.assign({}, S, { ret: rt })).diff;
      return '<div class="sv' + (rt === S.ret ? " cur" : "") + '"><span class="l">At ' + rt + "% a year</span><span class=\"n\">" + (Math.abs(dd) < 1 ? "Tie" : (dd > 0 ? "Invest +" : "Prepay +") + short(Math.abs(dd))) + "</span></div>";
    });
    $("pvSens").innerHTML = sens.join("");
    $("pvTable").innerHTML = table(sim, tabWhich);
    document.querySelectorAll("[data-tab]").forEach(function (b) { b.setAttribute("aria-selected", b.getAttribute("data-tab") === tabWhich ? "true" : "false"); });
    var notes = [];
    if (S.regime === "old" && S.claim) notes.push("Includes the tax you save on home loan interest under the old regime (up to ₹2,00,000 of interest a year, at your " + S.slab + "% slab plus 4% cess). Prepaying shrinks this saving, and the comparison accounts for it.");
    if (S.regime === "new") notes.push("New regime: home loan interest on a self-occupied home gives no tax deduction, so prepaying loses no tax benefit.");
    if (S.kind === "equity") notes.push("Equity gains are taxed at 12.5% plus cess above ₹1,25,000, once, when you sell at the end. Selling a little every year to use the yearly ₹1,25,000 exemption would make investing slightly better.");
    if (S.kind === "debt") notes.push("Debt fund gains are taxed at your " + S.slab + "% slab plus cess when you sell.");
    if (S.kind === "fd") notes.push("FD interest is taxed every year at your " + S.slab + "% slab plus cess, so the calculator grows your money at " + (S.ret * (1 - S.slab / 100 * CESS)).toFixed(2) + "% a year after tax.");
    var base = ["When you prepay, your EMI stays the same and the loan closes sooner.",
      "Both choices run until your loan's original end date, with the same money going in each month.",
      "Your investments grow at a steady " + S.ret + "% a year. Real returns go up and down.",
      "Inflation isn't included. It affects both choices in the same way.",
      "No prepayment charges. Banks can't charge them on floating-rate home loans taken by individuals."];
    $("pvNotes").innerHTML = base.concat(notes).map(function (t) { return "<li>" + t + "</li>"; }).join("");
  }

  $("pvTable").addEventListener("click", function (e) {
    var b = e.target.closest(".yb"); if (!b) return;
    var open = b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", open ? "true" : "false");
    this.querySelectorAll('tr[data-of="' + b.getAttribute("data-y") + '"]').forEach(function (r) { r.hidden = !open; });
  });
  document.querySelectorAll("[data-tab]").forEach(function (b) { b.addEventListener("click", function () { tabWhich = b.getAttribute("data-tab"); $("pvTable").innerHTML = table(last.sim, tabWhich); document.querySelectorAll("[data-tab]").forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); }); }); });

  /* Reports: the report code loads only when someone asks for a report */
  function withReport(cb) {
    if (window.SalaristReport) return cb(window.SalaristReport);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReport); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function reportData() {
    var sim = last.sim, be = last.be;
    return { S: Object.assign({}, S), sim: sim, be: be, yearsPrepay: yearRows(sim.prepay.rows, true), yearsInvest: yearRows(sim.invest.rows, false),
      sens: [S.ret - 2, S.ret, S.ret + 2].filter(function (x) { return x > 0; }).map(function (rt) { return { rate: rt, diff: simulate(Object.assign({}, S, { ret: rt })).diff }; }),
      notes: Array.prototype.map.call(document.querySelectorAll("#pvNotes li"), function (li) { return li.textContent; }),
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#pvVerdict p"), function (p) { return p.textContent; }), short: short, inr: inr, url: location.origin + location.pathname, cross: crossover(sim.prepay.net, sim.invest.net) };
  }
  function busy(btn, on) { btn.disabled = on; btn.setAttribute("aria-busy", on ? "true" : "false"); }
  $("pvPdf").addEventListener("click", function () {
    if (!S.extra && !S.lump) { say("Add an extra amount first."); return; }
    var btn = this; busy(btn, true); say("Preparing your report…");
    withReport(function (R) { R.pdf(reportData()).then(function () { busy(btn, false); say("PDF report downloaded."); }, function () { busy(btn, false); say("Couldn't make the PDF. Please try again."); }); });
  });
  $("pvXlsx").addEventListener("click", function () {
    if (!S.extra && !S.lump) { say("Add an extra amount first."); return; }
    var btn = this; busy(btn, true);
    withReport(function (R) { try { R.xlsx(reportData()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(btn, false); });
  });

  /* Share link */
  function say(msg) { var s = $("pvStatus"); s.textContent = msg; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 3000); }
  function copy(text, ok) {
    function fb() { var t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); var r = false; try { r = document.execCommand("copy"); } catch (e) {} t.remove(); say(r ? ok : "Couldn't copy. Select the text and copy it yourself."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { say(ok); }, fb); else fb();
  }
  $("pvShare").addEventListener("click", function () {
    var q = new URLSearchParams();
    ["P", "rate", "years", "extra", "lump", "ret", "kind", "regime", "slab"].forEach(function (k) { q.set(k, S[k]); });
    if (!S.claim) q.set("claim", "0");
    copy(location.origin + location.pathname + "?" + q.toString(), "Link copied. It holds only the numbers on screen.");
  });

  /* ---------- Share as image ---------- */
  var PAL = {
    blue: { bg: "#1F5FE0", text: "#FFFFFF", sub: "rgba(255,255,255,0.88)", acc: "#FFD27A", card: "#FFFFFF", cardText: "#0E1726", cardLine: "#E6ECF5", hi: "#0B7F5A", tagBg: "#FFFFFF", tagText: "#1F5FE0", ink: "#FFFFFF", coin: "#FFFFFF", rule: "rgba(255,255,255,0.35)", pre: "#FFD27A", inv: "#FFFFFF" },
    dark: { bg: "#07090D", text: "#E8EEF7", sub: "#C9D3E2", acc: "#F5B547", card: "#10161F", cardText: "#E8EEF7", cardLine: "#2A3850", hi: "#3DD68C", tagBg: "#4C8DFF", tagText: "#061226", ink: "#E8EEF7", coin: "#4C8DFF", rule: "#2A3850", glow: true, pre: "#F5B547", inv: "#4C8DFF" }
  };
  var FONT = '"Plus Jakarta Sans", system-ui, sans-serif';
  function rr(c, X, Y, W, H, R) { R = Math.min(R, W / 2, H / 2); c.beginPath(); c.moveTo(X + R, Y); c.arcTo(X + W, Y, X + W, Y + H, R); c.arcTo(X + W, Y + H, X, Y + H, R); c.arcTo(X, Y + H, X, Y, R); c.arcTo(X, Y, X + W, Y, R); c.closePath(); }
  function box(c, X, Y, W, H, R, f, s) { rr(c, X, Y, W, H, R); if (f) { c.fillStyle = f; c.fill(); } if (s) { c.strokeStyle = s; c.lineWidth = 2; c.stroke(); } }
  function txt(c, t, X, Y, sz, w, col, al) { c.font = w + " " + sz + "px " + FONT; c.fillStyle = col; c.textAlign = al || "left"; c.textBaseline = "alphabetic"; c.fillText(t, X, Y); return c.measureText(t).width; }
  function fit(c, t, sz, w, max, min) { min = min || 20; while (sz > min) { c.font = w + " " + sz + "px " + FONT; if (c.measureText(t).width <= max) break; sz -= 2; } return sz; }
  function logo(c, X, Y, h, ink, coin) {
    var svg = document.querySelector(".top .brand svg"); if (!svg) return;
    var vb = svg.getAttribute("viewBox").split(/\s+/).map(Number), k = h / vb[3];
    c.save(); c.translate(X, Y); c.scale(k, k); c.translate(-vb[0], -vb[1]);
    c.fillStyle = ink; c.fill(new Path2D(svg.querySelector(".ink").getAttribute("d")));
    var ci = svg.querySelector(".coin"); c.beginPath(); c.arc(+ci.getAttribute("cx"), +ci.getAttribute("cy"), +ci.getAttribute("r"), 0, 7); c.fillStyle = coin; c.fill(); c.restore();
  }
  function autoTitle() { return (S.extra ? short(S.extra) + "/month extra" : short(S.lump) + " one-time") + " on a " + short(S.P) + " home loan:"; }
  function draw(pal, title) {
    var T = PAL[pal], W = 1080, H = 1350, P = 84, inner = W - 2 * P, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var c = cv.getContext("2d"), sim = last.sim, be = last.be, d = sim.diff;
    c.fillStyle = T.bg; c.fillRect(0, 0, W, H);
    if (T.glow) { var g = c.createRadialGradient(W * 0.9, 0, 10, W * 0.9, 0, 760); g.addColorStop(0, "rgba(76,141,255,0.38)"); g.addColorStop(1, "rgba(76,141,255,0)"); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    logo(c, P, 70, 56, T.ink, T.coin);
    c.font = "800 24px " + FONT; var tag = "MONEY HACK", tw = c.measureText(tag).width + 44;
    box(c, W - P - tw, 70, tw, 52, 26, T.tagBg); txt(c, tag, W - P - tw / 2, 105, 24, 800, T.tagText, "center");
    txt(c, title, P, 212, fit(c, title, 40, 700, inner, 26), 700, T.sub);
    var win = d >= 0 ? "Investing" : "Prepaying", l1 = win + " wins", l2 = "by " + short(Math.abs(d));
    var hs = Math.min(fit(c, l1, 140, 800, inner), fit(c, l2, 140, 800, inner));
    var y = 212 + hs * 1.02; txt(c, l1, P, y, hs, 800, T.text);
    y += hs * 0.98; var wb = txt(c, "by ", P, y, hs, 800, T.text); txt(c, short(Math.abs(d)), P + wb, y, hs, 800, T.acc);
    var rows = [["Interest saved by prepaying", short(sim.invest.interest - sim.prepay.interest)],
      ["Loan closes", ((sim.N - sim.prepay.payoff) / 12).toFixed(1).replace(/\.0$/, "") + " yrs sooner"],
      ["Investing wins above", be.kind === "rate" ? be.rate.toFixed(1) + "% a year" : be.kind === "invest-always" ? "any return" : "30% a year"],
      ["Return assumed", S.ret + "% a year"]];
    var cy = y + 44, rowH = 70, ch = 28 * 2 + rowH * rows.length;
    box(c, P, cy, inner, ch, 40, T.card, pal === "dark" ? T.cardLine : null);
    var ry = cy + 28;
    rows.forEach(function (rw, i) {
      txt(c, rw[0], P + 40, ry + 46, 32, 700, T.cardText);
      txt(c, rw[1], W - P - 40, ry + 46, 34, 800, i === 0 ? T.hi : T.cardText, "right");
      if (i < rows.length - 1) { c.strokeStyle = T.cardLine; c.lineWidth = 2; c.beginPath(); c.moveTo(P + 40, ry + rowH); c.lineTo(W - P - 40, ry + rowH); c.stroke(); }
      ry += rowH;
    });
    /* mini chart */
    var top = cy + ch + 44, fy = H - 214, gh = fy - 40 - top - 40;
    if (gh > 80) {
      var A = sim.prepay.net, B = sim.invest.net, n = A.length - 1, all = A.concat(B), mx = Math.max.apply(null, all), mn = Math.min.apply(null, all), sp = (mx - mn) || 1;
      function px(i) { return P + i / n * inner; } function py(v) { return top + (mx - v) / sp * gh; }
      [[B, T.inv], [A, T.pre]].forEach(function (s) { c.beginPath(); for (var i = 0; i <= n; i++) { var X = px(i), Y = py(s[0][i]); if (i) c.lineTo(X, Y); else c.moveTo(X, Y); } c.strokeStyle = s[1]; c.lineWidth = 6; c.lineJoin = "round"; c.stroke(); });
      var lx = P, ly = top + gh + 40;
      [[T.inv, "Invest the extra"], [T.pre, "Prepay, then invest"]].forEach(function (it) { box(c, lx, ly - 20, 26, 26, 7, it[0]); lx += 38; lx += txt(c, it[1], lx, ly, 26, 600, T.sub) + 30; });
      txt(c, "Net worth over " + S.years + " years", W - P, ly, 26, 600, T.sub, "right");
    }
    c.strokeStyle = T.rule; c.lineWidth = 2; c.beginPath(); c.moveTo(P, fy); c.lineTo(W - P, fy); c.stroke();
    txt(c, "Prepay or invest? Check yours, free", P, fy + 60, 34, 800, T.text);
    txt(c, "salarist.in/prepay-vs-invest", P, fy + 108, 42, 800, T.acc);
    txt(c, S.rate + "% loan · " + S.years + " yrs left · " + (S.regime === "old" ? "old" : "new") + " tax regime · After tax", P, fy + 150, 24, 600, T.sub);
    return cv;
  }
  var blob = null, pal = "blue", title = "", rt;
  function theme() { var t = document.documentElement.getAttribute("data-theme"); if (t) return t; return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
  function redraw() {
    var cv = draw(pal, title || autoTitle()); $("pvImg").src = cv.toDataURL("image/png"); blob = null; cv.toBlob(function (b) { blob = b; });
    document.querySelectorAll("[data-pal]").forEach(function (b) { b.setAttribute("aria-checked", b.getAttribute("data-pal") === pal ? "true" : "false"); });
  }
  $("pvImgBtn").addEventListener("click", function () {
    if (!S.extra && !S.lump) { say("Add an extra amount first."); return; }
    pal = theme() === "dark" ? "dark" : "blue"; title = ""; $("pvImgTitle").value = autoTitle();
    (document.fonts && document.fonts.load ? Promise.all(["800", "700", "600"].map(function (w) { return document.fonts.load(w + ' 40px "Plus Jakarta Sans"'); })) : Promise.resolve())
      .catch(function () {}).then(function () { redraw(); $("pvImgStatus").textContent = ""; var dl = $("pvDlg"); if (dl.showModal) dl.showModal(); else dl.setAttribute("open", ""); });
  });
  document.querySelectorAll("[data-pal]").forEach(function (b) { b.addEventListener("click", function () { pal = b.getAttribute("data-pal"); redraw(); }); });
  $("pvImgTitle").addEventListener("input", function () { title = this.value.trim().slice(0, 70); clearTimeout(rt); rt = setTimeout(redraw, 150); });
  $("pvImgTitleReset").addEventListener("click", function () { title = ""; $("pvImgTitle").value = autoTitle(); redraw(); });
  function save() {
    if (!blob) return; var u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = "salarist-prepay-vs-invest.png"; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 500); $("pvImgStatus").textContent = "Image saved.";
  }
  $("pvImgShare").addEventListener("click", function () {
    if (!blob) return;
    var f = new File([blob], "salarist-prepay-vs-invest.png", { type: "image/png" }), d = last.sim.diff;
    var text = (d >= 0 ? "Investing beats prepaying my home loan by " : "Prepaying my home loan beats investing by ") + short(Math.abs(d)) + ". Check yours free: " + location.origin + location.pathname;
    if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], text: text, title: "Prepay or invest?" }).catch(function () {});
    else { save(); copy(text, "Image saved, and a message to go with it is copied."); }
  });
  $("pvImgDl").addEventListener("click", save);
  $("pvImgClose").addEventListener("click", function () { var dl = $("pvDlg"); if (dl.close) dl.close(); else dl.removeAttribute("open"); });

  render();
})();
