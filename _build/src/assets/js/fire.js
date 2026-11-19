/* Salarist FIRE calculator for India. Runs entirely in the browser; nothing is stored or sent.
   Withdrawals use the shared SWP engine (swp.js); the NPS exit split uses the NPS calculator's code (nps.js). */
(function () {
  "use strict";
  var NODE = typeof module !== "undefined" && module.exports;
  var SWP = NODE ? require("./swp.js") : window.SalaristSWP, NPS = NODE ? require("./nps.js") : window.SalaristNPS;
  var EPF_AGE = 58, NPS_AGE = 60, ANNUITY = 6.5, MAX_AGE = 75;

  /* ---------- Core ---------- */
  /* o: {age, spend (a month, today), infl, save (a month), step (% a year), liquid (investments outside EPF/NPS), preRet, postRet,
         epf, epfM (a month, yours + employer's), epfRate, nps, npsM (a month), npsRet, planTo, epfMode "58"|"early", target (FI age you want)}
     Everything before tax: use returns after tax. */
  function mg(r) { return Math.pow(1 + r / 100, 1 / 12) - 1; }
  /* Balances at the end of each year while you're still saving (extra: extra savings a month on top of o.save) */
  function accumulate(o, extra) {
    var L = o.liquid, E = o.epf, N = o.nps, s = o.save + (extra || 0), e = o.epfM, n = o.npsM, rows = [{ age: o.age, L: L, E: E, N: N, put: 0 }];
    var gL = mg(o.preRet), gE = mg(o.epfRate), gN = mg(o.npsRet);
    for (var y = 1; o.age + y <= MAX_AGE; y++) {
      var put = 0;
      for (var m = 0; m < 12; m++) { L = L * (1 + gL) + s; E = E * (1 + gE) + e; N = N * (1 + gN) + n; put += s + e + n; }
      rows.push({ age: o.age + y, L: L, E: E, N: N, put: put });
      s *= 1 + o.step / 100; e *= 1 + o.step / 100; n *= 1 + o.step / 100;
    }
    return rows;
  }
  /* Plan the years after you stop working at age A with balances st, spending mult × your expenses. */
  function after(o, A, st, mult) {
    var months = Math.max(12, (o.planTo - A) * 12), spend = o.spend * mult * Math.pow(1 + o.infl / 100, A - o.age);
    var mE = A >= EPF_AGE ? 0 : o.epfMode === "early" ? 12 : (EPF_AGE - A) * 12;
    var epfOut = st.E * Math.pow(1 + o.epfRate / 100, mE / 12);
    var mN = Math.max(0, (NPS_AGE - A) * 12), npsAt = st.N * Math.pow(1 + o.npsRet / 100, mN / 12);
    var nx = npsAt > 0 ? NPS.exit(npsAt, "private", "max") : { lump: 0, annuity: 0 }, pension = nx.annuity * ANNUITY / 100 / 12;
    function flow(m) { return (m === mE ? epfOut : 0) + (m === mN ? nx.lump : 0) + (m >= mN ? pension : 0); }
    return { months: months, spend: spend, mE: mE, epfOut: epfOut, mN: mN, npsAt: npsAt, npsLump: nx.lump, pension: pension, flow: flow };
  }
  function lasts(o, A, st, mult) {
    var p = after(o, A, st, mult);
    return SWP.run({ corpus: st.L, withdraw: p.spend, step: o.infl, ret: o.postRet, months: p.months, flow: p.flow }).ok;
  }
  function fiAge(o, rows, mult) {
    for (var i = 0; i < rows.length; i++) { var A = rows[i].age; if (A >= o.planTo) break; if (lasts(o, A, rows[i], mult)) return { age: A, st: rows[i] }; }
    return null;
  }
  function calc(o) {
    var rows = accumulate(o, 0), fi = fiAge(o, rows, 1), r = { rows: rows, fi: fi };
    r.lean = fiAge(o, rows, 0.7); r.fat = fiAge(o, rows, 1.5);
    r.rate = o.save / (o.save + o.spend);
    if (fi) {
      var p = after(o, fi.age, fi.st, 1);
      r.p = p;
      r.needL = SWP.needed({ withdraw: p.spend, step: o.infl, ret: o.postRet, months: p.months, flow: p.flow });
      r.number = r.needL + fi.st.E + fi.st.N;
      r.multiple = r.number / (p.spend * 12);
      r.numberToday = r.number / Math.pow(1 + o.infl / 100, fi.age - o.age);
      var run = SWP.run({ corpus: fi.st.L, withdraw: p.spend, step: o.infl, ret: o.postRet, months: p.months, flow: p.flow });
      r.post = run.path.map(function (L, y) {
        var e = (y + 1) * 12 <= p.mE ? fi.st.E * Math.pow(1 + o.epfRate / 100, y + 1) : 0, n = (y + 1) * 12 <= p.mN ? fi.st.N * Math.pow(1 + o.npsRet / 100, y + 1) : 0;
        return { age: fi.age + y + 1, L: L, E: e, N: n, spend: p.spend * 12 * Math.pow(1 + o.infl / 100, y) };
      });
      r.endL = run.end;
    }
    /* Extra savings a month to reach FI by the target age */
    var T = Math.round(o.target), ti = T - o.age;
    if (ti >= 1 && ti < rows.length && T < o.planTo) {
      if (fi && fi.age <= T) r.extra = 0;
      else {
        var lo = 0, hi = Math.max(1e5, o.spend * 20), ok = function (x) { var rr = accumulate(o, x); return lasts(o, T, rr[ti], 1); };
        if (!ok(hi)) r.extra = null;
        else { for (var i = 0; i < 50; i++) { var mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; } r.extra = hi; }
      }
    }
    /* Coast FIRE: invested today, with no more saving into anything, enough to stop at 60 */
    if (o.age < NPS_AGE) {
      var k = NPS_AGE - o.age, st60 = { E: o.epf * Math.pow(1 + o.epfRate / 100, k), N: o.nps * Math.pow(1 + o.npsRet / 100, k) };
      var p60 = after(o, NPS_AGE, st60, 1), need60 = SWP.needed({ withdraw: p60.spend, step: o.infl, ret: o.postRet, months: p60.months, flow: p60.flow });
      r.coast = need60 / Math.pow(1 + o.preRet / 100, k); r.coasted = o.liquid >= r.coast;
    }
    return r;
  }
  var API = { calc: calc, accumulate: accumulate, after: after, ANNUITY: ANNUITY };
  if (NODE) { module.exports = API; return; }
  window.SalaristFIRE = API;
  if (!document.getElementById("fiVerdict")) return;

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
  var S = { age: 30, spend: 60000, infl: 6, save: 50000, step: 7, liquid: 1500000, preRet: 11, postRet: 8, epf: 600000, epfM: 12000, epfRate: 8.25,
            nps: 200000, npsM: 5000, npsRet: 10, planTo: 85, epfMode: "58", target: 42 };
  var NUM = { age: [18, 70], spend: [1000, 1e8], infl: [0, 15], save: [0, 1e8], step: [0, 20], liquid: [0, 1e11], preRet: [0, 20], postRet: [0, 15], epf: [0, 1e10], epfM: [0, 1e7],
              epfRate: [0, 12], nps: [0, 1e10], npsM: [0, 1e7], npsRet: [0, 15], planTo: [60, 100], target: [25, 75] };
  var MONEY = { spend: 1, save: 1, liquid: 1, epf: 1, epfM: 1, nps: 1, npsM: 1 };
  var SEGS = { epfMode: ["58", "early"] };
  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    Object.keys(NUM).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= NUM[k][0] && v <= NUM[k][1]) S[k] = v; });
    Object.keys(SEGS).forEach(function (k) { if (SEGS[k].indexOf(q.get(k)) > -1) S[k] = q.get(k); });
  })();
  var shows = [];
  function bind(k) {
    var el = $("fi-" + k), note = $("fi-" + k + "-w"); if (!el) return;
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
  function pressed(attr, val) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-" + attr) === String(val) ? "true" : "false"); }); }
  var last = null;
  function series(r) {
    var pts = [];
    if (r.fi) {
      r.rows.forEach(function (x) { if (x.age <= r.fi.age) pts.push({ age: x.age, v: x.L + x.E + x.N, L: x.L, E: x.E, N: x.N, phase: x.age < r.fi.age ? "save" : "fi" }); });
      r.post.forEach(function (x) { pts.push({ age: x.age, v: x.L + x.E + x.N, L: x.L, E: x.E, N: x.N, phase: "spend", spend: x.spend }); });
    } else r.rows.forEach(function (x) { if (x.age <= Math.min(MAX_AGE, Math.max(S.target, 60))) pts.push({ age: x.age, v: x.L + x.E + x.N, L: x.L, E: x.E, N: x.N, phase: "save" }); });
    return pts;
  }
  function chart(r, pts) {
    var W = 420, Hh = 240, pl = 54, pr = 12, pt = 18, pb = 26, n = pts.length - 1 || 1;
    var max = Math.max.apply(null, pts.map(function (p) { return p.v; }).concat([1])), st = Math.pow(10, Math.floor(Math.log10(max / 4))), qq = max / 4 / st; st *= qq <= 1 ? 1 : qq <= 2 ? 2 : qq <= 2.5 ? 2.5 : qq <= 5 ? 5 : 10; max = st * 4;
    function x(i) { return pl + i / n * (W - pl - pr); } function yy(v) { return pt + (max - Math.max(0, v)) / max * (Hh - pt - pb); }
    var g = ""; for (var k = 0; k <= 4; k++) { var gy = yy(max * k / 4).toFixed(1); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+gy + 3) + '" class="al" text-anchor="end">' + short(max * k / 4) + "</text>"; }
    var stp = n > 40 ? 10 : n > 20 ? 5 : 2, xl = ""; for (var t = 0; t <= n; t += stp) xl += '<text x="' + x(t).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">' + pts[t].age + "</text>";
    var line = pts.map(function (p, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(p.v).toFixed(1); }).join("");
    var liq = pts.map(function (p, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(p.L).toFixed(1); }).join("");
    var mk = "";
    if (r.fi) { var fi = pts.findIndex(function (p) { return p.age === r.fi.age; }); mk += '<line x1="' + x(fi).toFixed(1) + '" x2="' + x(fi).toFixed(1) + '" y1="' + pt + '" y2="' + (Hh - pb) + '" class="rd-ms"/><text x="' + x(fi).toFixed(1) + '" y="' + (pt - 4) + '" class="al rd-mk" text-anchor="middle">FI ' + r.fi.age + "</text>";
      joins(r).forEach(function (j, k) { var i = pts.findIndex(function (p) { return p.age === j.at; }); if (i > -1) {
        var first = k === 0 && joins(r).length > 1; mk += '<circle cx="' + x(i).toFixed(1) + '" cy="' + yy(pts[i].L).toFixed(1) + '" r="4" class="rd-best"/><text x="' + (x(i) + (first ? -6 : 6)).toFixed(1) + '" y="' + (first ? yy(pts[i].v) - 8 : yy(pts[i].L) + 16).toFixed(1) + '" class="al rd-mk" text-anchor="' + (first ? "end" : "start") + '">' + j.short + "</text>"; } }); }
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Your money by age, saving and then spending">' + g + xl + mk + '<path d="' + liq + '" class="ln buy"/><path d="' + line + '" class="ln rent"/></svg>';
  }
  /* When EPF and NPS move into your investments: the amber line jumps up to meet the blue one */
  function joins(r) {
    if (!r.fi) return [];
    var A = r.fi.age, p = r.p, out = [], eAge = A + Math.round(p.mE / 12), nAge = A + Math.round(p.mN / 12);
    /* age: when it happens; at: the year-end point on the chart where the jump shows */
    if (r.fi.st.E > 0 && eAge > A) out.push({ age: eAge, at: eAge + 1, short: eAge === nAge ? "EPF + NPS in" : "EPF in", kind: "epf", amt: p.epfOut });
    if (r.fi.st.N > 0 && nAge !== eAge && nAge > A) out.push({ age: nAge, at: nAge + 1, short: "NPS in", kind: "nps", amt: p.npsLump });
    if (out.length) out[out.length - 1].meet = true;
    return out;
  }
  function chartNote(r) {
    if (!r.fi) return "Blue: everything you have (investments, EPF and NPS). Amber: your investments outside EPF and NPS. The gap between them is your EPF and NPS. You don't reach FI by " + MAX_AGE + " on these numbers.";
    var j = joins(r), lastJ = j.length ? j[j.length - 1].age : null;
    return "Blue: everything you have. Amber: your investments outside EPF and NPS, the money you can actually spend. The gap between the lines is your EPF and NPS, which stay locked. " +
      "Until " + r.fi.age + " both lines rise as you save; the dashed line marks FI, when you stop working and start drawing on the amber pot. " +
      (j.length ? j.map(function (x) { return "At " + x.age + ", your " + (x.kind === "epf" ? (x.short === "EPF + NPS in" ? "EPF and NPS lump sum (" + short(r.p.epfOut + r.p.npsLump) + ")" : "EPF (" + short(x.amt) + ")") : "NPS lump sum (" + short(x.amt) + ")") + " moves into your investments, so amber jumps up."; }).join(" ") +
        " From " + lastJ + " on, the lines meet: everything you have is now spendable" + (r.p.pension > 0 ? ", plus your NPS pension of " + inr(r.p.pension) + " a month." : ".") : "") +
      " Later the line bends down as rising spending outgrows the returns.";
  }
  function ageTxt(f) { return f ? String(f.age) : "after " + MAX_AGE; }
  function render() {
    Object.keys(SEGS).forEach(function (k) { pressed(k, S[k]); });
    var r = calc(S); last = r; var pts = series(r); r.pts = pts;
    var v = $("fiVerdict");
    v.className = "verdict" + (r.fi ? "" : " short");
    if (r.fi) {
      v.innerHTML = '<p class="k">Saving ' + inr(S.save) + " a month (" + Math.round(r.rate * 100) + '% of what you earn), rising ' + S.step + '% a year</p><p class="v">You reach FI at <b>' + r.fi.age + "</b>, in " + (r.fi.age - S.age) + " years</p>" +
        '<p class="k">Your FIRE number then: <b>' + short(r.number) + "</b> (" + short(r.numberToday) + " in today's money, " + r.multiple.toFixed(0) + "× a year's spending)." +
        (r.extra === 0 ? " That's by your target of " + S.target + "." : r.extra ? " To get there by " + S.target + ", save about " + inr(r.extra) + " more a month." : "") + "</p>";
    } else {
      v.innerHTML = '<p class="k">At ' + inr(S.save) + ' a month</p><p class="v">You don\'t reach FI by ' + MAX_AGE + "</p>" +
        '<p class="k">' + (r.extra ? "To get there by " + S.target + ", save about " + inr(r.extra) + " more a month. " : "") + "Try saving more, spending less, or a later plan-until age.</p>";
    }
    $("fiS1").textContent = r.fi ? short(r.number) : "—"; $("fiS1h").textContent = r.fi ? "At " + r.fi.age + ": " + short(r.needL) + " outside EPF and NPS" : "Not reached by " + MAX_AGE;
    $("fiS2").textContent = r.fi ? short(r.numberToday) : "—"; $("fiS2h").textContent = r.fi ? r.multiple.toFixed(1) + "× a year's spending at " + r.fi.age : "";
    $("fiS3").textContent = Math.round(r.rate * 100) + "%"; $("fiS3h").textContent = "Of take-home you save";
    $("fiS4").textContent = r.coast != null ? short(r.coast) : "—"; $("fiS4h").textContent = r.coast != null ? (r.coasted ? "Coast FIRE: you're there" : "Coast FIRE: " + short(r.coast - S.liquid) + " to go") : "";
    $("fiTypes").innerHTML = [["Lean FIRE", "70% of your spending", r.lean], ["Your FIRE", "Your spending", r.fi], ["Fat FIRE", "150% of your spending", r.fat]].map(function (t, i) {
      return '<div class="sv' + (i === 1 ? " cur" : "") + '"><span class="l">' + t[0] + '</span><span class="n">Age ' + ageTxt(t[2]) + '</span><span class="h">' + t[1] + "</span></div>"; }).join("");
    $("fiChart").innerHTML = chart(r, pts); $("fiChartNote").textContent = chartNote(r);
    var notes = [];
    if (r.fi) {
      var p = r.p, bridge = Math.max(0, Math.min(EPF_AGE, NPS_AGE) - r.fi.age);
      notes.push("<b>The bridge:</b> from " + r.fi.age + ", your " + short(r.fi.st.L) + " outside EPF and NPS pays " + inr(p.spend) + " a month, rising " + S.infl + "% a year. " +
        (S.epfMode === "early" && r.fi.age < EPF_AGE ? "Your EPF (" + short(p.epfOut) + ") comes in after a year out of work, " : r.fi.age < EPF_AGE ? "Your EPF (" + short(p.epfOut) + ") comes in at 58, " : "Your EPF is available now, ") +
        (r.fi.age < NPS_AGE ? "and at 60 your NPS gives a " + short(p.npsLump) + " lump sum plus " + inr(p.pension) + " a month of pension." : "and your NPS too."));
      notes.push("<b>Will it last?</b> At " + S.postRet + "% a year after FI, the money lasts until " + S.planTo + (r.endL > 0 ? ", with " + short(r.endL) + " left." : "."));
    }
    if (r.coast != null) notes.push("<b>Coast FIRE:</b> " + (r.coasted ? "you already have enough invested outside EPF and NPS to stop saving and still stop working at 60." : "with " + short(r.coast) + " invested outside EPF and NPS today, you could stop saving and still stop working at 60. You have " + short(S.liquid) + "."));
    $("fiRule").innerHTML = notes.join("<br><br>");
    function alt(ch) { var rr = calc(Object.assign({}, S, ch)); return rr.fi ? rr.fi.age : null; }
    r.what = [["As now", r.fi ? r.fi.age : null], ["Save ₹10,000 more a month", alt({ save: S.save + 10000 })], ["Returns 1% lower", alt({ preRet: S.preRet - 1, postRet: S.postRet - 1 })], ["Spend 10% less", alt({ spend: S.spend * 0.9 })]];
    $("fiSens").innerHTML = r.what.map(function (w, i) { return '<div class="sv' + (i === 0 ? " cur" : "") + '"><span class="l">' + w[0] + '</span><span class="n">' + (w[1] ? "FI at " + w[1] : "Not by " + MAX_AGE) + "</span></div>"; }).join("");
    $("fiTable").innerHTML = '<table class="calc"><thead><tr><th>Age</th><th>Saved or spent that year</th><th>Investments</th><th>EPF</th><th>NPS</th><th>Total</th></tr></thead><tbody>' +
      pts.slice(1).map(function (p, i) {
        var mv = p.phase === "spend" ? "−" + inr(p.spend) : inr(r.rows[i + 1] ? r.rows[i + 1].put : 0);
        return "<tr" + (p.phase === "fi" ? ' class="tot"' : "") + '><th scope="row">' + p.age + (p.phase === "fi" ? " FI" : "") + '</th><td data-l="Saved or spent">' + mv + '</td><td data-l="Investments">' + inr(p.L) + '</td><td data-l="EPF">' + inr(p.E) + '</td><td data-l="NPS">' + inr(p.N) + '</td><td data-l="Total">' + inr(p.v) + "</td></tr>";
      }).join("") + "</tbody></table>";
    $("fiBarT").textContent = r.fi ? "FI at " + r.fi.age + " · " + short(r.number) : "Not FI by " + MAX_AGE;
    shows.forEach(function (f) { f(); });
  }

  /* ---------- Reports ---------- */
  function say(m) { var s = $("fiStatus"); s.textContent = m; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function spec() {
    var r = last, pts = r.pts, cats = [pts[0].age], data = [pts[0].v], liq = [pts[0].L];
    for (var i = 1; i < pts.length; i++) { cats.push(pts[i].age); for (var m = 1; m <= 12; m++) { data.push(pts[i - 1].v + (pts[i].v - pts[i - 1].v) * m / 12); liq.push(pts[i - 1].L + (pts[i].L - pts[i - 1].L) * m / 12); } }
    return {
      title: "FIRE Report", path: "salarist.in/fire-calculator", url: location.origin + location.pathname, file: "salarist-fire",
      question: "When can I reach financial independence, and how much do I need?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#fiVerdict p"), function (x) { return x.textContent; }), verdictColor: r.fi ? "blue" : "amber",
      inputs: [["Age", String(S.age)], ["Spending a month (today)", inr(S.spend), S.spend], ["Inflation", S.infl + "%"], ["Savings a month", inr(S.save), S.save], ["Savings rise each year", S.step + "%"],
        ["Investments outside EPF and NPS", inr(S.liquid), S.liquid], ["Return before FI", S.preRet + "%"], ["Return after FI", S.postRet + "%"],
        ["EPF balance / a month", inr(S.epf) + " / " + inr(S.epfM)], ["EPF rate", S.epfRate + "%"], ["EPF taken", S.epfMode === "early" ? "A year after you stop work" : "At 58"],
        ["NPS balance / a month", inr(S.nps) + " / " + inr(S.npsM)], ["NPS return", S.npsRet + "%"], ["Plan until age", String(S.planTo)], ["Target FI age", String(S.target)]],
      keyNums: [["FI age", r.fi ? String(r.fi.age) : "After " + MAX_AGE, 0], ["FIRE number", r.fi ? short(r.number) : "—", r.number || 0], ["In today's money", r.fi ? short(r.numberToday) : "—", r.numberToday || 0], ["Savings rate", Math.round(r.rate * 100) + "%", 0]],
      sensTitle: "What if (now: FI at " + (r.fi ? r.fi.age : "after " + MAX_AGE) + ")", sens: r.what.slice(1).map(function (w) { return [w[0], w[1] ? "FI at " + w[1] : "Not by " + MAX_AGE]; }), sensCurrent: -1,
      chartTitle: "Your money by age", chartNote: "Blue: everything you have. Amber: investments outside EPF and NPS. The gap is your locked EPF and NPS. Marked points: FI, and EPF and NPS moving into your investments.", xlsxChartTitle: "Your money by age (₹ lakh)",
      chart: { series: [{ name: "Everything (investments, EPF, NPS)", color: "blue", data: data }, { name: "Investments outside EPF and NPS", color: "amber", data: liq }], cross: null,
        vline: r.fi ? { m: (r.fi.age - pts[0].age) * 12, label: "FI at " + r.fi.age } : null },
      chartPoints: (r.fi ? [{ m: (r.fi.age - pts[0].age) * 12, v: r.fi.st.L + r.fi.st.E + r.fi.st.N, color: "blue", label: "FI at " + r.fi.age + ": you stop working",
          text: "Saving stops here. From now on your spending (" + inr(r.p.spend) + " a month, rising " + S.infl + "% a year) comes out of the amber pot, investments outside EPF and NPS." }] : [])
        .concat(joins(r).map(function (j) { var i = pts.findIndex(function (p) { return p.age === j.at; }); return { m: (j.at - pts[0].age) * 12, v: i > -1 ? pts[i].L : 0, color: "amber",
          label: j.short + " at " + j.age + (j.meet ? ": the lines meet" : ""),
          text: (j.kind === "epf" ? "Your EPF" + (j.short === "EPF + NPS in" ? " and NPS lump sum" : "") : "Your NPS lump sum") + " (" + short(j.short === "EPF + NPS in" ? r.p.epfOut + r.p.npsLump : j.amt) + ") moves into your investments, so the amber line jumps up" +
            (j.meet ? " and meets the blue one. From here everything you have is spendable" + (r.p.pension > 0 ? ", plus an NPS pension of " + inr(r.p.pension) + " a month." : ".") : ".") }; })),
      chartMarks: (r.fi ? [{ i: r.fi.age - pts[0].age, label: "FI at " + r.fi.age, color: "ink", symbol: "diamond", text: "FI: you stop working and start spending from your investments outside EPF and NPS." }] : [])
        .concat(joins(r).map(function (j) { return { i: j.at - pts[0].age, label: j.short + " at " + j.age, color: "green", symbol: "circle",
          text: (j.kind === "epf" ? "EPF" + (j.short === "EPF + NPS in" ? " and NPS lump sum" : "") : "NPS lump sum") + " (" + short(j.short === "EPF + NPS in" ? r.p.epfOut + r.p.npsLump : j.amt) + ") moves into your investments" + (j.meet ? ": the two lines meet from here." : ".") }; })),
      chartYears: cats, chartXLabel: "Age", chartAge0: pts[0].age,
      money: { title: "Lean, regular and Fat FIRE", cols: ["Spending a month now", "FI age"], rows: [["Lean FIRE (70%)", S.spend * 0.7, ageTxt(r.lean)], ["Your FIRE", S.spend, ageTxt(r.fi)], ["Fat FIRE (150%)", S.spend * 1.5, ageTxt(r.fat)]], note: $("fiRule").textContent },
      tables: [{ title: "Year by year", sheet: "By year", cols: ["Age", "Saved or spent", "Investments", "EPF", "NPS", "Total"],
        yearly: pts.slice(1).map(function (p, i) { return [String(p.age) + (p.phase === "fi" ? " (FI)" : ""), p.phase === "spend" ? -p.spend : (r.rows[i + 1] ? r.rows[i + 1].put : 0), p.L, p.E, p.N, p.v]; }), monthly: null }],
      notes: ["FI age: the first age at which your investments outside EPF and NPS, with EPF and NPS when they unlock, pay your spending (rising with inflation) until age " + S.planTo + ", checked month by month.",
        "Before FI: savings, EPF and NPS contributions rise " + S.step + "% a year. After FI: no more contributions; withdrawals come from investments outside EPF and NPS, earning " + S.postRet + "% a year.",
        "EPF: earns " + S.epfRate + "% until " + (S.epfMode === "early" ? "you take it a year after you stop work (the EPF Scheme 2026 allows final settlement after 12 months out of work; a change approved in November 2026 would make it 2 months once notified)" : "58") + ". NPS: earns " + S.npsRet + "% until 60, then up to 80% as a lump sum and the rest buys a pension at " + ANNUITY + "% a year.",
        "Lean and Fat FIRE use 70% and 150% of your spending. Coast FIRE: the amount invested outside EPF and NPS today that, with no more saving, lets you stop at 60.",
        "All figures are before tax: use returns after tax."],
      taxRules: ["Equity mutual fund gains above ₹1.25 lakh a year are taxed at 12.5%; debt fund and FD interest at your slab. EPF is tax-free after 5 years' continuous service; NPS: 60% of the corpus tax-free at exit, the rest of any lump sum taxable."],
      short: short, inr: inr
    };
  }
  function busy(b, on) { b.disabled = on; b.setAttribute("aria-busy", on ? "true" : "false"); }
  $("fiPdf").addEventListener("click", function () { var b = this; busy(b, true); say("Making your PDF…"); withReport(function (Kt) { Kt.pdf(spec()).then(function () { busy(b, false); say("PDF report downloaded."); }, function () { busy(b, false); say("Couldn't make the PDF. Please try again."); }); }); });
  $("fiXlsx").addEventListener("click", function () { var b = this; busy(b, true); withReport(function (Kt) { try { Kt.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(b, false); }); });
  $("fiShare").addEventListener("click", function () {
    var q = new URLSearchParams(); Object.keys(NUM).forEach(function (k) { q.set(k, S[k]); }); Object.keys(SEGS).forEach(function (k) { q.set(k, S[k]); });
    var t = location.origin + location.pathname + "?" + q.toString();
    function ok() { say("Link copied. Anyone with it sees these numbers."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { say("Couldn't copy. Copy the address bar instead."); }); else say("Copy the address bar to share.");
  });
  (function bar() {
    var el = $("fiBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("fiVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".fix .lp-setup"));
    $("fiBarBtn").addEventListener("click", function () { $("fiVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
