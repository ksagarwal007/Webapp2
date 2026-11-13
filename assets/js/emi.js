/* Salarist EMI calculator. Runs entirely in the browser; nothing is stored or sent. */
(function () {
  "use strict";
  var MAXM = 600;
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /* ---------- Core ---------- */
  function emiOf(P, annualPct, n) {
    var r = annualPct / 1200;
    if (n <= 0 || P <= 0) return 0;
    if (r === 0) return P / n;
    var f = Math.pow(1 + r, n);
    return P * r * f / (f - 1);
  }
  /* Months left to repay bal at a monthly EMI (fractional). Infinity if the EMI doesn't cover the interest. */
  function nper(bal, annualPct, emi) {
    var r = annualPct / 1200;
    if (bal <= 0) return 0;
    if (r === 0) return bal / emi;
    if (emi <= bal * r) return Infinity;
    return -Math.log(1 - bal * r / emi) / Math.log(1 + r);
  }
  /* Months are counted as y*12+m (m 0-11). */
  function ym(s) { var p = String(s).split("-"); return +p[0] * 12 + (+p[1] - 1); }
  function ymTxt(k) { return MON[k % 12] + " " + Math.floor(k / 12); }
  function ymIso(k) { var m = k % 12 + 1; return Math.floor(k / 12) + "-" + (m < 10 ? "0" : "") + m; }

  /* o: {bal, rate, n (months) or emi, start (first EMI month, y*12+m), effect ("tenure"|"emi"), extra (monthly), events: [{kind:"pay"|"rate", at, amount, rate, repeat, effect}]}
     A part-payment is made right after that month's EMI. A rate change applies from that month's EMI. */
  function simulate(o) {
    var bal = o.bal, rate = o.rate, emi = o.emi || emiOf(bal, rate, o.n), rows = [], k = o.start, totInt = 0, totEmi = 0, totPre = 0, marks = [];
    if (!(bal > 0) || !(emi > 0)) return { rows: [], emi0: 0, totInt: 0, totEmi: 0, totPre: 0, months: 0, end: o.start, marks: [], ok: false };
    var ev = {};
    (o.events || []).forEach(function (e, i) {
      if (!(e.at >= 0)) return;
      for (var t = e.at, guard = 0; t < o.start + MAXM && guard < 60; t += 12, guard++) {
        if (t >= o.start) (ev[t] = ev[t] || []).push(Object.assign({ id: i }, e));
        if (!(e.kind === "pay" && e.repeat)) break;
      }
    });
    var emi0 = emi, stuck = false;
    for (var m = 0; m < MAXM && bal > 0.5; m++, k++) {
      var here = ev[k] || [], rateEv = here.filter(function (e) { return e.kind === "rate"; }), payEv = here.filter(function (e) { return e.kind === "pay"; });
      rateEv.forEach(function (e) {
        var left = nper(bal, rate, emi);
        rate = e.rate;
        var eff = e.effect === "emi" || e.effect === "tenure" ? e.effect : "tenure";
        if (eff === "emi" && isFinite(left)) emi = emiOf(bal, rate, Math.max(1, Math.round(left)));
        else if (emi <= bal * rate / 1200 * 1.0001) emi = emiOf(bal, rate, Math.max(1, Math.round(isFinite(left) ? left : 360)));  /* EMI must cover the interest */
        marks.push({ m: m, kind: "rate", rate: rate });
      });
      var r = rate / 1200, it = bal * r, pay = Math.min(emi, bal + it), pr = pay - it;
      bal = Math.max(0, bal - pr); totInt += it; totEmi += pay;
      var pre = 0, effUsed = null;
      var payments = payEv.map(function (e) { return { amt: e.amount, eff: e.effect === "emi" || e.effect === "tenure" ? e.effect : o.effect, id: e.id }; });
      if (o.extra > 0) payments.push({ amt: o.extra, eff: o.effect, id: -1 });
      payments.forEach(function (p) {
        if (bal <= 0.5 || !(p.amt > 0)) return;
        var left = nper(bal, rate, emi), a = Math.min(p.amt, bal);
        bal -= a; pre += a;
        if (p.id >= 0) marks.push({ m: m, kind: "pay", amount: a, id: p.id });
        if (p.eff === "emi" && bal > 0.5 && isFinite(left)) { emi = emiOf(bal, rate, Math.max(1, Math.round(left))); effUsed = "emi"; }
      });
      totPre += pre;
      rows.push({ m: m + 1, k: k, rate: rate, emi: pay, interest: it, principal: pr, pre: pre, bal: bal, emiNow: emi });
      if (m === MAXM - 1 && bal > 0.5) stuck = true;
    }
    return { rows: rows, emi0: emi0, emiLast: rows.length ? rows[rows.length - 1].emiNow : 0, totInt: totInt, totEmi: totEmi, totPre: totPre, months: rows.length,
             end: rows.length ? rows[rows.length - 1].k : o.start, marks: marks, ok: !stuck };
  }
  /* The loan a monthly EMI supports, at a rate over n months. */
  function affordable(emi, annualPct, n) { var r = annualPct / 1200; if (r === 0) return emi * n; return emi * (1 - Math.pow(1 + r, -n)) / r; }

  if (typeof module !== "undefined" && module.exports) { module.exports = { emiOf: emiOf, nper: nper, simulate: simulate, affordable: affordable, ym: ym, ymTxt: ymTxt, ymIso: ymIso }; return; }

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
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function mths(n) { n = Math.round(n); var y = Math.floor(n / 12), m = n % 12; return (y ? y + (y === 1 ? " year" : " years") : "") + (y && m ? " " : "") + (m || !y ? m + (m === 1 ? " month" : " months") : ""); }
  var now = new Date(), NEXT = now.getFullYear() * 12 + now.getMonth() + 1;

  var PRESET = { home: { amount: 5000000, rate: 8.5, years: 20 }, car: { amount: 800000, rate: 9, years: 5 }, personal: { amount: 500000, rate: 11.5, years: 4 } };
  var S = { type: "home", mode: "new", amount: 5000000, rate: 8.5, years: 20, start: NEXT, owe: 4000000, know: "emi", curEmi: 45000, left: 180,
            effect: "tenure", extra: 0, events: [], afford: 40000 };
  var FIELDS = { amount: [10000, 500000000, 10000], rate: [1, 30, 0.05], years: [1, 30, 1], owe: [1000, 500000000, 1000], curEmi: [100, 50000000, 100], left: [1, 480, 1],
                 extra: [0, 10000000, 500], afford: [0, 50000000, 500] };
  var MONEY = { amount: 1, owe: 1, curEmi: 1, extra: 1, afford: 1 };
  var uid = 0;
  function newEvent(kind, at) { return { uid: ++uid, kind: kind, at: at, amount: kind === "pay" ? 100000 : 0, rate: kind === "rate" ? Math.round((S.rate + 0.25) * 100) / 100 : 0, repeat: false, effect: "default" }; }

  /* URL: ev=p.2026-11.100000.0.d;r.2027-06.8.75.t */
  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    if (["home", "car", "personal"].indexOf(q.get("type")) > -1) { S.type = q.get("type"); Object.assign(S, PRESET[S.type]); }
    Object.keys(FIELDS).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= FIELDS[k][0] && v <= FIELDS[k][1]) S[k] = v; });
    if (q.get("mode") === "existing") S.mode = "existing";
    if (["emi", "left"].indexOf(q.get("know")) > -1) S.know = q.get("know");
    if (["tenure", "emi"].indexOf(q.get("effect")) > -1) S.effect = q.get("effect");
    if (/^\d{4}-\d{2}$/.test(q.get("start") || "")) S.start = ym(q.get("start"));
    (q.get("ev") || "").split(";").forEach(function (t) {
      var p = t.split("."); if (p.length < 5 || !/^\d{4}-\d{2}$/.test(p[1])) return;
      var e = newEvent(p[0] === "r" ? "rate" : "pay", ym(p[1]));
      if (e.kind === "pay") { e.amount = Math.max(0, +p[2] || 0); e.repeat = p[3] === "1"; } else e.rate = Math.max(0, Math.min(30, parseFloat(p[2] + "." + p[3]) || 0));
      e.effect = { d: "default", t: "tenure", e: "emi" }[p[p.length - 1]] || "default"; S.events.push(e);
    });
  })();

  function shown(k, v) { return MONEY[k] ? fmt.format(v) : String(v); }
  function bindField(k) {
    var num = $("em-" + k), rng = $("em-" + k + "-r"), note = $("em-" + k + "-w");
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
    show.call(null); bindField.show[k] = show;
  }
  bindField.show = {};
  Object.keys(FIELDS).forEach(bindField);
  function showAll() { Object.keys(bindField.show).forEach(function (k) { bindField.show[k](); }); $("em-start").value = ymIso(S.start); }
  $("em-start").value = ymIso(S.start);
  $("em-start").addEventListener("change", function () { if (/^\d{4}-\d{2}$/.test(this.value)) { S.start = ym(this.value); render(); } });
  document.querySelectorAll("[data-type]").forEach(function (b) { b.addEventListener("click", function () { S.type = b.getAttribute("data-type"); Object.assign(S, PRESET[S.type]); showAll(); render(); }); });
  document.querySelectorAll("[data-mode]").forEach(function (b) { b.addEventListener("click", function () { S.mode = b.getAttribute("data-mode"); render(); }); });
  document.querySelectorAll("[data-know]").forEach(function (b) { b.addEventListener("click", function () { S.know = b.getAttribute("data-know"); render(); }); });
  document.querySelectorAll("[data-effect]").forEach(function (b) { b.addEventListener("click", function () { S.effect = b.getAttribute("data-effect"); render(); }); });
  function pressed(attr, val) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-" + attr) === val ? "true" : "false"); }); }

  /* ---------- Part-payments and rate changes ---------- */
  function drawEvents() {
    var box = $("emEvents");
    if (!S.events.length) { box.innerHTML = '<p class="hint" style="margin:0">No part-payments or rate changes yet.</p>'; return; }
    S.events.sort(function (a, b) { return a.at - b.at; });
    box.innerHTML = S.events.map(function (e) {
      var pay = e.kind === "pay", id = "ev" + e.uid;
      return '<div class="em-ev" data-uid="' + e.uid + '"><div class="em-ev-h"><b>' + (pay ? "Part-payment" : "Rate change") + '</b><button type="button" class="link-btn" data-act="del" aria-label="Remove this ' + (pay ? "part-payment" : "rate change") + '">Remove</button></div>' +
        '<div class="two-col"><div class="fld"><label for="' + id + 'm">Month</label><input class="sel" type="month" id="' + id + 'm" data-f="at" value="' + ymIso(e.at) + '"></div>' +
        (pay ? '<div class="fld"><label for="' + id + 'a">Amount</label><div class="numin"><span>₹</span><input id="' + id + 'a" data-f="amount" type="text" inputmode="numeric" autocomplete="off" value="' + fmt.format(e.amount) + '"></div></div>'
             : '<div class="fld"><label for="' + id + 'a">New rate</label><div class="numin"><input id="' + id + 'a" data-f="rate" type="number" inputmode="decimal" step="0.05" min="0" max="30" value="' + e.rate + '"><span>%</span></div></div>') + "</div>" +
        '<div class="fld"><label for="' + id + 'e">' + (pay ? "This part-payment" : "When the rate changes") + '</label><select class="sel" id="' + id + 'e" data-f="effect">' +
        (pay ? '<option value="default">Same as the setting above</option><option value="tenure">Cuts the tenure (EMI stays)</option><option value="emi">Cuts the EMI (end date stays)</option>'
             : '<option value="tenure">EMI stays, tenure changes</option><option value="emi">End date stays, EMI changes</option>') + "</select></div>" +
        (pay ? '<label class="chk" style="border:0;grid-template-columns:22px 1fr"><input type="checkbox" data-f="repeat"' + (e.repeat ? " checked" : "") + "><span>Repeat every year in this month</span></label>" : "") + "</div>";
    }).join("");
    S.events.forEach(function (e) { var s = box.querySelector('[data-uid="' + e.uid + '"] select'); s.value = e.kind === "rate" && e.effect === "default" ? "tenure" : e.effect; });
  }
  $("emEvents").addEventListener("input", function (ev) {
    var t = ev.target, row = t.closest(".em-ev"); if (!row) return;
    var e = S.events.filter(function (x) { return x.uid === +row.getAttribute("data-uid"); })[0], f = t.getAttribute("data-f"); if (!e || !f) return;
    if (f === "amount") { var raw = t.value.replace(/[^0-9]/g, ""); t.value = raw ? fmt.format(+raw) : ""; e.amount = Math.min(1e10, +raw || 0); }
    else if (f === "rate") { var v = parseFloat(t.value); if (isFinite(v)) e.rate = Math.max(0, Math.min(30, v)); }
    else if (f === "at") { if (/^\d{4}-\d{2}$/.test(t.value)) e.at = ym(t.value); else return; }
    else if (f === "effect") e.effect = t.value;
    else if (f === "repeat") e.repeat = t.checked;
    render(false);
  });
  $("emEvents").addEventListener("change", function (ev) { if (ev.target.getAttribute("data-f") === "at") { drawEvents(); render(false); } });
  $("emEvents").addEventListener("click", function (ev) {
    var b = ev.target.closest('[data-act="del"]'); if (!b) return;
    var u = +b.closest(".em-ev").getAttribute("data-uid"); S.events = S.events.filter(function (x) { return x.uid !== u; }); drawEvents(); render(false);
  });
  function firstFree() { return Math.max(S.start, NEXT); }
  $("emAddPay").addEventListener("click", function () { S.events.push(newEvent("pay", firstFree())); drawEvents(); render(false); });
  $("emAddRate").addEventListener("click", function () { S.events.push(newEvent("rate", firstFree() + 6)); drawEvents(); render(false); });

  /* ---------- Calculation from the inputs ---------- */
  function base() {
    if (S.mode === "existing") {
      var o = { bal: S.owe, rate: S.rate, start: S.start, effect: S.effect };
      if (S.know === "emi") o.emi = S.curEmi; else o.n = S.left;
      return o;
    }
    return { bal: S.amount, rate: S.rate, n: S.years * 12, start: S.start, effect: S.effect };
  }
  function evs() { return S.events.map(function (e) { return { kind: e.kind, at: e.at, amount: e.amount, rate: e.rate, repeat: e.repeat, effect: e.effect }; }); }
  function calc() {
    var b = base(), all = evs();
    var withP = simulate(Object.assign({}, b, { events: all, extra: S.extra }));
    var noP = simulate(Object.assign({}, b, { events: all.filter(function (e) { return e.kind === "rate"; }), extra: 0 }));
    return { b: b, withP: withP, noP: noP, hasP: S.extra > 0 || all.some(function (e) { return e.kind === "pay" && e.amount > 0; }) };
  }
  /* What each part-payment adds: the loan with everything, against the loan without that one (and its repeats). */
  function eachPay(c) {
    var all = evs();
    return S.events.map(function (e, i) {
      if (e.kind !== "pay" || !(e.amount > 0)) return null;
      var w = simulate(Object.assign({}, c.b, { events: all.filter(function (x, j) { return j !== i; }), extra: S.extra }));
      return { e: e, saved: w.totInt - c.withP.totInt, months: w.months - c.withP.months };
    }).filter(Boolean);
  }

  function chart(c) {
    var A = [c.b.bal].concat(c.withP.rows.map(function (r) { return r.bal; })), B = [c.b.bal].concat(c.noP.rows.map(function (r) { return r.bal; }));
    var n = Math.max(A.length, B.length) - 1, W = 420, Hh = 270, pl = 54, pr = 16, pt = 28, pb = 26, max = c.b.bal || 1;
    function x(i) { return pl + i / Math.max(1, n) * (W - pl - pr); }
    function y(v) { return pt + (max - v) / max * (Hh - pt - pb); }
    function path(arr) { var s = ""; for (var i = 0; i < arr.length; i += (arr.length > 300 ? 2 : 1)) s += (s ? "L" : "M") + x(i).toFixed(1) + " " + y(arr[i]).toFixed(1); return s + "L" + x(arr.length - 1).toFixed(1) + " " + y(arr[arr.length - 1]).toFixed(1); }
    var grid = "";
    for (var k = 0; k <= 4; k++) { var v = max * k / 4, yy = y(v).toFixed(1); grid += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+yy + 3) + '" class="al" text-anchor="end">' + short(v) + "</text>"; }
    var yrs = n / 12, step = yrs > 20 ? 5 : yrs > 8 ? 2 : 1, xl = "";
    for (var t = 0; t <= yrs + 0.01; t += step) xl += '<text x="' + x(t * 12).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">' + Math.floor((c.b.start + t * 12) / 12) + "</text>";
    var marks = c.withP.marks.filter(function (mk) { return mk.kind === "pay"; }).map(function (mk) { return '<circle cx="' + x(mk.m + 1).toFixed(1) + '" cy="' + y(A[mk.m + 1]).toFixed(1) + '" r="4.5" class="cx"/>'; }).join("");
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Loan left over time, with and without part-payments">' + grid + xl +
      (c.hasP ? '<path d="' + path(B) + '" class="ln buy"/>' : "") + '<path d="' + path(A) + '" class="ln rent"/>' + marks + "</svg>";
  }

  function yearRows(sim) {
    var out = [], cur = null;
    sim.rows.forEach(function (r) {
      var yr = Math.floor(r.k / 12);
      if (!cur || cur.y !== yr) { cur = { y: yr, months: [], emi: 0, interest: 0, principal: 0, pre: 0, bal: 0, rate: r.rate }; out.push(cur); }
      cur.months.push(r); cur.emi += r.emi; cur.interest += r.interest; cur.principal += r.principal; cur.pre += r.pre; cur.bal = r.bal; cur.rate = r.rate;
    });
    return out;
  }
  var COLS = [["EMIs paid", "emi"], ["Interest", "interest"], ["Principal", "principal"], ["Part-payments", "pre"], ["Loan left", "bal"]];
  function table(sim) {
    var h = "";
    yearRows(sim).forEach(function (r) {
      h += '<tbody><tr class="yr"><th scope="row"><button type="button" class="yb" aria-expanded="false" data-y="' + r.y + '">' + r.y + "</button></th>" + COLS.map(function (c) { return "<td>" + inr(r[c[1]]) + "</td>"; }).join("") + "<td>" + r.rate + "%</td></tr>";
      r.months.forEach(function (m) { h += '<tr class="mo" data-of="' + r.y + '" hidden><th scope="row">' + ymTxt(m.k) + "</th>" + COLS.map(function (c) { return "<td>" + inr(m[c[1]]) + "</td>"; }).join("") + "<td>" + m.rate + "%</td></tr>"; });
      h += "</tbody>";
    });
    return '<table class="calc"><thead><tr><th scope="col">Year</th>' + COLS.map(function (c) { return '<th scope="col">' + c[0] + "</th>"; }).join("") + '<th scope="col">Rate</th></tr></thead>' + h + "</table>";
  }

  var last = null;
  function render(redraw) {
    pressed("type", S.type); pressed("mode", S.mode); pressed("know", S.know); pressed("effect", S.effect);
    $("em-new-box").hidden = S.mode !== "new"; $("em-old-box").hidden = S.mode !== "existing";
    $("em-curEmi-box").hidden = S.know !== "emi"; $("em-left-box").hidden = S.know !== "left";
    $("em-startLbl").textContent = S.mode === "new" ? "Month of your first EMI" : "Month of your next EMI";
    if (redraw !== false) drawEvents();
    var c = calc(), W = c.withP, N = c.noP; last = c;
    var v = $("emVerdict");
    if (!W.rows.length || !W.ok) {
      v.innerHTML = '<p class="k">Check your numbers</p><p class="v">This EMI doesn\'t repay the loan</p><p class="k">At ' + S.rate + "% the interest alone is " + inr(c.b.bal * S.rate / 1200) + " a month. Enter a higher EMI, or the months left instead.</p>";
      ["emEmi", "emInt", "emSaved", "emEnd"].forEach(function (id) { $(id).textContent = "—"; }); $("emChart").innerHTML = ""; $("emTable").innerHTML = ""; $("emEach").innerHTML = ""; $("emSplit").innerHTML = "";
      return;
    }
    var saved = N.totInt - W.totInt, cut = N.months - W.months;
    var head = S.mode === "new" ? "On a loan of " + short(c.b.bal) + " at " + S.rate + "% for " + mths(S.years * 12) : "On the " + short(c.b.bal) + " you owe today, at " + S.rate + "%";
    if (c.hasP) {
      var emiTxt = Math.abs(W.emiLast - W.emi0) > 1 && W.rows.length > 1 ? " Your EMI ends at " + inr(W.emiLast) + "." : "";
      v.innerHTML = '<p class="k">' + head + '</p><p class="v">Your EMI is <b>' + inr(W.emi0) + '</b></p><p class="k">Your part-payments save <b>' + short(saved) + "</b> of interest" + (cut > 0 ? " and close the loan " + mths(cut) + " sooner, in " + ymTxt(W.end) + " instead of " + ymTxt(N.end) : ", and the loan still closes in " + ymTxt(W.end)) + "." + emiTxt + "</p>";
    } else {
      v.innerHTML = '<p class="k">' + head + '</p><p class="v">Your EMI is <b>' + inr(W.emi0) + '</b></p><p class="k">You pay ' + short(W.totInt) + " in interest over " + mths(W.months) + ", and the loan closes in " + ymTxt(W.end) + ".</p>";
    }
    $("emBarT").textContent = "EMI " + inr(W.emi0);
    $("emEmi").textContent = inr(W.emi0);
    $("emInt").textContent = short(W.totInt);
    $("emSaved").textContent = c.hasP ? short(saved) : "—";
    $("emEnd").textContent = ymTxt(W.end);
    var P = c.b.bal, tot = P + W.totInt, pp = Math.round(P / tot * 100);
    $("emSplit").innerHTML = '<div class="em-bar" role="img" aria-label="Principal ' + pp + '%, interest ' + (100 - pp) + '%"><i style="width:' + pp + '%"></i></div><div class="legend2"><span><i style="background:var(--brand)"></i>Principal ' + short(P) + " (" + pp + '%)</span><span><i style="background:var(--leave)"></i>Interest ' + short(W.totInt) + " (" + (100 - pp) + "%)</span></div>";
    $("emChart").innerHTML = chart(c);
    $("emLegendNo").hidden = !c.hasP;
    var each = eachPay(c);
    $("emEachBox").hidden = !c.hasP;
    $("emEach").innerHTML = each.map(function (x) {
      return "<li><b>" + inr(x.e.amount) + " in " + ymTxt(x.e.at) + (x.e.repeat ? ", every year" : "") + "</b>: saves " + short(x.saved) + " of interest" + (x.months > 0 ? " and " + mths(x.months) : "") + ".</li>";
    }).join("") + (S.extra > 0 ? "<li><b>" + inr(S.extra) + " extra every month</b> is counted in the total above.</li>" : "");
    $("emTable").innerHTML = table(W);
    $("emSens").innerHTML = [-1, 0, 1].map(function (d) {
      var rr = Math.max(0.5, S.rate + d), s = simulate(Object.assign({}, c.b, { rate: rr, events: evs(), extra: S.extra }));
      return '<div class="sv' + (d === 0 ? " cur" : "") + '"><span class="l">At ' + rr.toFixed(2).replace(/\.?0+$/, "") + '%</span><span class="n">' + (s.ok ? inr(s.emi0) + " · " + short(s.totInt) : "Doesn't repay") + "</span></div>";
    }).join("");
    var aff = affordable(S.afford, S.rate, S.mode === "new" ? S.years * 12 : Math.max(1, Math.round(nper(c.b.bal, S.rate, W.emi0))));
    $("emAffRes").textContent = S.afford > 0 ? "supports a loan of about " + short(aff) + " at " + S.rate + "% over " + mths(S.mode === "new" ? S.years * 12 : Math.round(nper(c.b.bal, S.rate, W.emi0))) + "." : "";
    var nx = $("emNext");
    if (S.type === "home") { nx.href = "/prepay-vs-invest/?" + new URLSearchParams({ P: Math.round(c.b.bal), rate: S.rate, years: Math.max(1, Math.round(N.months / 12)) }).toString(); nx.querySelector("b").textContent = "Have spare money? See whether to prepay this loan or invest it"; nx.querySelector(".h").textContent = "Opens Prepay or Invest with your loan and rate filled in."; }
    else if (S.type === "car") { nx.href = "/company-car-lease-vs-loan/"; nx.querySelector("b").textContent = "Does your company offer a car lease? Compare it with this loan"; nx.querySelector(".h").textContent = "A lease paid from pre-tax salary can cost less in the higher tax slabs."; }
    else { nx.href = "/budget-planner/"; nx.querySelector("b").textContent = "Fit this EMI into your monthly budget"; nx.querySelector(".h").textContent = "See what's left each month after the EMI."; }
    $("emNotes").innerHTML = notes(c).map(function (t) { return "<li>" + t + "</li>"; }).join("");
  }
  function notes(c) {
    var n = ["Interest is worked out monthly on the loan left, the way banks calculate EMIs on reducing-balance loans. The last EMI may be smaller.",
      "Each part-payment is made right after that month's EMI. A rate change applies from that month's EMI.",
      S.effect === "tenure" ? "By default, part-payments cut the tenure and your EMI stays the same. That saves the most interest." : "By default, part-payments cut your EMI and the loan keeps its end date.",
      "Processing fees, prepayment charges and insurance bundled with the loan aren't included. Banks can't charge a prepayment penalty on floating-rate loans to individuals; fixed-rate loans may have one, so check your loan terms."];
    if (S.mode === "existing") n.push("You're starting from what you owe today. Use the figure on your latest loan statement.");
    if (S.events.some(function (e) { return e.kind === "rate"; })) n.push("Rate changes are what you enter; nobody can predict them. Banks usually keep the EMI and change the tenure when a floating rate moves, unless you ask otherwise.");
    return n;
  }
  $("emTable").addEventListener("click", function (e) {
    var b = e.target.closest(".yb"); if (!b) return;
    var open = b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", open ? "true" : "false");
    this.querySelectorAll('tr[data-of="' + b.getAttribute("data-y") + '"]').forEach(function (r) { r.hidden = !open; });
  });

  /* ---------- Save and load your plan ---------- */
  function today() { return new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  function stamp() { var d = new Date(), p = function (x) { return (x < 10 ? "0" : "") + x; }; return p(d.getDate()) + p(d.getMonth() + 1) + String(d.getFullYear()).slice(2); }
  function csvCell(x) { x = String(x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }
  var LABEL = { type: "Loan type", mode: "Loan", amount: "Loan amount", rate: "Interest rate %", years: "Tenure (years)", start: "First or next EMI month", owe: "Amount you owe today",
                know: "You know", curEmi: "Current EMI", left: "Months left", effect: "Part-payments cut", extra: "Extra every month" };
  function toCsv() {
    var rows = [["Salarist EMI Calculator · salarist.in/emi-calculator · Saved " + today()],
      ["To carry on, open salarist.in/emi-calculator and choose Load my loan plan. Update 'Amount you owe today' from your latest loan statement."], [],
      ["Setting", "Value"]];
    rows.push([LABEL.type, S.type], [LABEL.mode, S.mode === "new" ? "New loan" : "Loan I already have"], [LABEL.rate, S.rate], [LABEL.start, ymIso(S.start)]);
    if (S.mode === "new") rows.push([LABEL.amount, S.amount], [LABEL.years, S.years]);
    else { rows.push([LABEL.owe, S.owe], [LABEL.know, S.know === "emi" ? "My EMI" : "Months left"]); rows.push(S.know === "emi" ? [LABEL.curEmi, S.curEmi] : [LABEL.left, S.left]); }
    rows.push([LABEL.effect, S.effect === "tenure" ? "Tenure" : "EMI"], [LABEL.extra, S.extra], [], ["Change", "Month", "Amount or new rate", "Repeat every year", "Effect"]);
    S.events.forEach(function (e) { rows.push([e.kind === "pay" ? "Part-payment" : "Rate change", ymIso(e.at), e.kind === "pay" ? e.amount : e.rate, e.kind === "pay" ? (e.repeat ? "Yes" : "No") : "", { default: "Same as setting", tenure: e.kind === "pay" ? "Cut tenure" : "EMI stays", emi: e.kind === "pay" ? "Cut EMI" : "End date stays" }[e.effect]]); });
    return "﻿" + rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n") + "\r\n";
  }
  function parseCsv(text) {
    var rows = [], row = [], cell = "", q = false, i, ch;
    text = text.replace(/^﻿/, "");
    for (i = 0; i < text.length; i++) {
      ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true; else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function num(x) { return +String(x || "").replace(/[^0-9.]/g, ""); }
  function load(text) {
    var rows = parseCsv(text), set = {}, evRows = [], inEv = false, found = false;
    rows.forEach(function (r) {
      var a = (r[0] || "").trim();
      if (a === "Setting") { found = true; return; }
      if (a === "Change") { inEv = true; return; }
      if (!found || !a) return;
      if (inEv) evRows.push(r); else set[a] = (r[1] || "").trim();
    });
    if (!found) throw new Error("not a plan");
    var T = {}; Object.keys(LABEL).forEach(function (k) { T[LABEL[k]] = k; });
    var st = {};
    Object.keys(set).forEach(function (lab) { if (T[lab]) st[T[lab]] = set[lab]; });
    if (PRESET[st.type]) S.type = st.type;
    S.mode = /already/i.test(st.mode || "") ? "existing" : "new";
    ["rate", "amount", "years", "owe", "curEmi", "left", "extra"].forEach(function (k) { if (st[k] !== undefined && st[k] !== "") { var v = num(st[k]); if (isFinite(v)) S[k] = Math.max(FIELDS[k][0], Math.min(FIELDS[k][1], v)); } });
    if (/^\d{4}-\d{2}$/.test(st.start || "")) S.start = ym(st.start);
    S.know = /month/i.test(st.know || "") ? "left" : "emi";
    S.effect = /emi/i.test(st.effect || "") ? "emi" : "tenure";
    S.events = [];
    evRows.forEach(function (r) {
      var kind = /rate/i.test(r[0]) ? "rate" : /part/i.test(r[0]) ? "pay" : null, m = (r[1] || "").trim();
      if (!kind || !/^\d{4}-\d{2}$/.test(m)) return;
      var e = newEvent(kind, ym(m));
      if (kind === "pay") { e.amount = Math.min(1e10, num(r[2]) || 0); e.repeat = /yes/i.test(r[3] || ""); } else e.rate = Math.max(0, Math.min(30, num(r[2]) || 0));
      var ef = (r[4] || "").toLowerCase(); e.effect = /tenure|emi stays/.test(ef) ? "tenure" : /cut emi|end date/.test(ef) ? "emi" : "default";
      if (kind === "rate" && e.effect === "default") e.effect = "tenure";
      S.events.push(e);
    });
    showAll(); render();
  }
  function say(msg) { var s = $("emStatus"); s.textContent = msg; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function download(blob, name) { var u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 800); }
  $("emSaveBtn").addEventListener("click", function () { download(new Blob([toCsv()], { type: "text/csv;charset=utf-8" }), "salarist-loan-plan-" + stamp() + ".csv"); say("Loan plan saved to your device. Load it here any time to carry on."); });
  $("emLoadBtn").addEventListener("click", function () { $("emFile").click(); });
  $("emFile").addEventListener("change", function () {
    var f = this.files && this.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { try { load(String(rd.result)); say("Loan plan loaded from " + f.name + "."); } catch (e) { say("Couldn't read that file. Choose a loan plan saved from this page."); } };
    rd.readAsText(f); this.value = "";
  });

  /* ---------- Reports ---------- */
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function spec() {
    var c = last, W = c.withP, N = c.noP, yr = yearRows(W), TYPES = { home: "Home loan", car: "Car loan", personal: "Personal loan" };
    var inputs = [["Loan type", TYPES[S.type]], ["Loan", S.mode === "new" ? "New loan" : "Loan I already have"]];
    if (S.mode === "new") inputs.push(["Loan amount", inr(S.amount), S.amount], ["Tenure", mths(S.years * 12)]);
    else { inputs.push(["Amount you owe today", inr(S.owe), S.owe]); inputs.push(S.know === "emi" ? ["Current EMI", inr(S.curEmi), S.curEmi] : ["Months left", String(S.left)]); }
    inputs.push(["Interest rate", S.rate + "% a year"], [S.mode === "new" ? "First EMI" : "Next EMI", ymTxt(S.start)], ["Part-payments cut", S.effect === "tenure" ? "The tenure" : "The EMI"], ["Extra every month", S.extra ? inr(S.extra) : "None"]);
    S.events.forEach(function (e) { inputs.push(e.kind === "pay" ? ["Part-payment, " + ymTxt(e.at), inr(e.amount) + (e.repeat ? ", every year" : ""), e.amount] : ["Rate change, " + ymTxt(e.at), e.rate + "%"]); });
    function trow(r) { return [String(r.y)].concat(COLS.map(function (cc) { return r[cc[1]]; })); }
    var months = []; yr.forEach(function (y) { y.months.forEach(function (m) { months.push([ymTxt(m.k)].concat(COLS.map(function (cc) { return m[cc[1]]; }))); }); });
    var nYears = Math.ceil(Math.max(W.months, N.months) / 12), cats = []; for (var i = 0; i <= nYears; i++) cats.push(i);
    var A = [c.b.bal].concat(W.rows.map(function (r) { return r.bal; })), B = [c.b.bal].concat(N.rows.map(function (r) { return r.bal; }));
    while (A.length < B.length) A.push(0); while (B.length < A.length) B.push(0);
    var series = c.hasP ? [{ name: "With your part-payments", color: "blue", data: A }, { name: "Without part-payments", color: "amber", data: B }] : [{ name: "Loan left", color: "blue", data: A }];
    var money = [["Paid over the loan", null, null, "head"], ["EMIs", N.totEmi, W.totEmi], ["Part-payments", 0, W.totPre], ["of which interest", N.totInt, W.totInt, "sub"],
      ["Total paid", N.totEmi + N.totPre, W.totEmi + W.totPre, "total"], ["Loan closes", null, null, "head"]];
    return {
      title: "EMI Calculator Report", path: "salarist.in/emi-calculator", url: location.origin + location.pathname, file: "salarist-emi-calculator",
      question: TYPES[S.type] + " of " + short(c.b.bal) + " at " + S.rate + "%: EMI and part-payments",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#emVerdict p"), function (p) { return p.textContent; }),
      verdictColor: "blue",
      inputs: inputs,
      keyNums: [["Your EMI", inr(W.emi0), W.emi0], ["Total interest", short(W.totInt), W.totInt], ["Interest saved", c.hasP ? short(N.totInt - W.totInt) : "No part-payments", c.hasP ? N.totInt - W.totInt : undefined], ["Loan closes", ymTxt(W.end) + (c.hasP ? " (was " + ymTxt(N.end) + ")" : "")]],
      sensTitle: "What if the rate is different? (EMI · total interest)",
      sens: Array.prototype.map.call(document.querySelectorAll("#emSens .sv"), function (el) { return [el.querySelector(".l").textContent, el.querySelector(".n").textContent]; }),
      sensCurrent: 1,
      chartTitle: "Loan left over time", chartNote: c.hasP ? "With and without your part-payments." : "Loan left after each EMI.",
      xlsxChartTitle: "Loan left (₹ lakh)",
      chart: { series: series, cross: null }, chartYears: cats,
      money: { title: "Where your money goes", cols: ["Without part-payments", "With part-payments"], rows: money.slice(0, 5), note: c.hasP ? "Your part-payments save " + inr(N.totInt - W.totInt) + " of interest. The loan closes in " + ymTxt(W.end) + " instead of " + ymTxt(N.end) + "." : "" },
      tables: [{ title: "Year by year", sheet: "Schedule", cols: ["Year"].concat(COLS.map(function (cc) { return cc[0]; })), yearly: yr.map(trow), monthly: months }],
      notes: notes(c).map(function (t) { var d = document.createElement("div"); d.innerHTML = t; return d.textContent; }),
      taxRules: ["The EMI doesn't depend on your tax regime. Under the old regime, home loan interest on a home you live in can be deducted up to ₹2,00,000 a year (section 22 of the Income-tax Act, 2025) and principal within the ₹1,50,000 limit of section 123. The new regime allows neither. Car and personal loans for personal use get no deduction."],
      short: short, inr: inr
    };
  }
  function busy(btn, on) { btn.disabled = on; btn.setAttribute("aria-busy", on ? "true" : "false"); }
  $("emPdf").addEventListener("click", function () {
    if (!last || !last.withP.rows.length) return say("Fix the loan details first.");
    var btn = this; busy(btn, true); say("Making your PDF…");
    withReport(function (K) { K.pdf(spec()).then(function () { busy(btn, false); say("PDF report downloaded."); }, function () { busy(btn, false); say("Couldn't make the PDF. Please try again."); }); });
  });
  $("emXlsx").addEventListener("click", function () {
    if (!last || !last.withP.rows.length) return say("Fix the loan details first.");
    var btn = this; busy(btn, true);
    withReport(function (K) { try { K.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(btn, false); });
  });
  function copy(text, ok) {
    function fb() { var t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); var r = false; try { r = document.execCommand("copy"); } catch (e) {} t.remove(); say(r ? ok : "Couldn't copy. Select the text and copy it yourself."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { say(ok); }, fb); else fb();
  }
  $("emShare").addEventListener("click", function () {
    var q = new URLSearchParams({ type: S.type, mode: S.mode, rate: S.rate, start: ymIso(S.start), effect: S.effect });
    if (S.mode === "new") { q.set("amount", S.amount); q.set("years", S.years); } else { q.set("owe", S.owe); q.set("know", S.know); q.set(S.know === "emi" ? "curEmi" : "left", S.know === "emi" ? S.curEmi : S.left); }
    if (S.extra) q.set("extra", S.extra);
    if (S.events.length) q.set("ev", S.events.map(function (e) {
      var f = { default: "d", tenure: "t", emi: "e" }[e.effect];
      return e.kind === "pay" ? ["p", ymIso(e.at), Math.round(e.amount), e.repeat ? 1 : 0, f].join(".") : ["r", ymIso(e.at)].concat(String(e.rate).split(".").concat(["0"]).slice(0, 2)).concat([f]).join(".");
    }).join(";"));
    copy(location.origin + location.pathname + "?" + q.toString(), "Link copied. Anyone with it sees these numbers.");
  });
  (function bar() {
    var el = $("emBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("emVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".em .lp-setup"));
    $("emBarBtn").addEventListener("click", function () { $("emVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
