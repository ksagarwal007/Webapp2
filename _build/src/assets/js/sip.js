/* Salarist SIP calculator. Runs entirely in the browser; nothing is stored or sent. */
(function () {
  "use strict";
  var CESS = 1.04, LTCG = 0.125, LTCG_EXEMPT = 125000;

  /* ---------- Core ---------- */
  /* o: {start, startCost, sip, step (% a year), years, ret (% a year), kind ("equity"|"debt"), slab, infl}
     start/startCost: money already invested (value today, and what it cost). Each SIP goes in at the start of the month.
     Returns compound at ret% a year exactly (monthly rate = (1 + ret)^(1/12) - 1). The SIP rises by step% every 12 months. */
  function simulate(o) {
    var g = Math.pow(1 + o.ret / 100, 1 / 12) - 1, N = Math.round(o.years * 12), v = o.start, inv = o.startCost, s = o.sip, rows = [], series = [v], invS = [inv], yIn = 0;
    for (var m = 0; m < N; m++) {
      if (m > 0 && m % 12 === 0) s *= 1 + o.step / 100;
      v += s; inv += s; yIn += s; v *= 1 + g;
      series.push(v); invS.push(inv);
      if ((m + 1) % 12 === 0 || m === N - 1) { rows.push({ y: Math.ceil((m + 1) / 12), sip: s, put: yIn, inv: inv, value: v, gain: v - inv }); yIn = 0; }
    }
    var gain = Math.max(0, v - inv), tax = o.kind === "debt" ? gain * o.slab / 100 * CESS : Math.max(0, gain - LTCG_EXEMPT) * LTCG * CESS;
    return { value: v, invested: inv, gain: v - inv, tax: tax, after: v - tax, real: v / Math.pow(1 + o.infl / 100, o.years), realAfter: (v - tax) / Math.pow(1 + o.infl / 100, o.years),
             rows: rows, series: series, invSeries: invS, lastSip: s };
  }
  /* The starting monthly SIP that reaches a target value (before tax). */
  function sipFor(o, target) {
    var base = simulate(Object.assign({}, o, { sip: 0 })).value;
    if (base >= target) return 0;
    var lo = 0, hi = 1;
    while (simulate(Object.assign({}, o, { sip: hi })).value < target && hi < 1e9) hi *= 2;
    for (var i = 0; i < 60; i++) { var mid = (lo + hi) / 2; if (simulate(Object.assign({}, o, { sip: mid })).value < target) lo = mid; else hi = mid; }
    return hi;
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { simulate: simulate, sipFor: sipFor }; return; }

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
  function round100(v) { return Math.ceil(v / 100) * 100; }
  var YEAR = new Date().getFullYear();

  var S = { mode: "fresh", goal: "grow", sip: 10000, step: 10, lump: 0, cur: 900000, cost: 600000, years: 15, ret: 12, kind: "equity", slab: 30, infl: 6, target: 10000000, today: false };
  var FIELDS = { sip: [0, 10000000, 500], step: [0, 30, 1], lump: [0, 100000000, 1000], cur: [0, 1000000000, 1000], cost: [0, 1000000000, 1000], years: [1, 40, 1],
                 ret: [1, 20, 0.5], infl: [0, 12, 0.5], target: [10000, 10000000000, 10000] };
  var MONEY = { sip: 1, lump: 1, cur: 1, cost: 1, target: 1 };
  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    Object.keys(FIELDS).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= FIELDS[k][0] && v <= FIELDS[k][1]) S[k] = v; });
    if (q.get("mode") === "existing") S.mode = "existing";
    if (q.get("goal") === "target") S.goal = "target";
    if (q.get("kind") === "debt") S.kind = "debt";
    var sl = parseInt(q.get("slab"), 10); if ([0, 5, 10, 15, 20, 25, 30].indexOf(sl) > -1) S.slab = sl;
    if (q.get("today") === "1") S.today = true;
  })();

  function shown(k, v) { return MONEY[k] ? fmt.format(v) : String(v); }
  var showers = {};
  function bindField(k) {
    var num = $("sp-" + k), rng = $("sp-" + k + "-r"), note = $("sp-" + k + "-w");
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
    show(); showers[k] = show;
  }
  Object.keys(FIELDS).forEach(bindField);
  function showAll() { Object.keys(showers).forEach(function (k) { showers[k](); }); $("sp-slab").value = String(S.slab); $("sp-today").checked = S.today; }
  function seg(attr, key) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.addEventListener("click", function () { S[key] = b.getAttribute("data-" + attr); render(); }); }); }
  seg("mode", "mode"); seg("goal", "goal"); seg("kind", "kind");
  $("sp-slab").value = String(S.slab);
  $("sp-slab").addEventListener("change", function () { S.slab = parseInt(this.value, 10); render(); });
  $("sp-today").checked = S.today;
  $("sp-today").addEventListener("change", function () { S.today = this.checked; render(); });
  function pressed(attr, val) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-" + attr) === val ? "true" : "false"); }); }

  function opts(extra) {
    var ex = S.mode === "existing";
    return Object.assign({ start: (ex ? S.cur : 0) + S.lump, startCost: (ex ? S.cost : 0) + S.lump, sip: S.sip, step: S.step, years: S.years, ret: S.ret, kind: S.kind, slab: S.slab, infl: S.infl }, extra || {});
  }
  function targetNow() { return S.today ? S.target * Math.pow(1 + S.infl / 100, S.years) : S.target; }

  function chart(sim, flat) {
    var A = sim.series, I = sim.invSeries, F = flat ? flat.series : null, n = A.length - 1, W = 420, Hh = 270, pl = 54, pr = 16, pt = 28, pb = 26;
    var max = Math.max.apply(null, A.concat(F || []).concat(I)) || 1;
    function x(i) { return pl + i / Math.max(1, n) * (W - pl - pr); }
    function y(v) { return pt + (max - v) / max * (Hh - pt - pb); }
    function path(arr) { var s = ""; for (var i = 0; i < arr.length; i += (arr.length > 300 ? 2 : 1)) s += (s ? "L" : "M") + x(i).toFixed(1) + " " + y(arr[i]).toFixed(1); return s + "L" + x(arr.length - 1).toFixed(1) + " " + y(arr[arr.length - 1]).toFixed(1); }
    var grid = "";
    for (var k = 0; k <= 4; k++) { var v = max * k / 4, yy = y(v).toFixed(1); grid += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+yy + 3) + '" class="al" text-anchor="end">' + short(v) + "</text>"; }
    var yrs = n / 12, step = yrs > 20 ? 5 : yrs > 8 ? 2 : 1, xl = "";
    for (var t = 0; t <= yrs + 0.01; t += step) xl += '<text x="' + x(t * 12).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">' + (YEAR + t) + "</text>";
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Value of your investments over time, against the amount you put in">' + grid + xl +
      '<path d="' + path(I) + '" class="ln" style="stroke:var(--muted);stroke-dasharray:4 5"/>' + (F ? '<path d="' + path(F) + '" class="ln buy"/>' : "") + '<path d="' + path(A) + '" class="ln rent"/></svg>';
  }
  var COLS = [["Monthly SIP", "sip"], ["Put in this year", "put"], ["Total put in", "inv"], ["Value at year end", "value"], ["Gains", "gain"]];
  function table(sim) {
    return '<table class="calc"><thead><tr><th scope="col">Year</th>' + COLS.map(function (c) { return '<th scope="col">' + c[0] + "</th>"; }).join("") + "</tr></thead><tbody>" +
      sim.rows.map(function (r) { return '<tr><th scope="row">' + (YEAR + r.y) + "</th>" + COLS.map(function (c) { return "<td>" + inr(r[c[1]]) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>";
  }

  var last = null;
  function render() {
    pressed("mode", S.mode); pressed("goal", S.goal); pressed("kind", S.kind);
    var ex = S.mode === "existing", goal = S.goal === "target";
    $("sp-ex-box").hidden = !ex;
    $("sp-lumpLbl").textContent = ex ? "Adding a lump sum now?" : "Lump sum at the start";
    $("sp-lumpHint").textContent = ex ? "Optional. New money you'll invest today, such as a bonus, on top of what you already have." : "Optional. A one-time amount you invest on day one, before the first SIP.";
    $("sp-sipLbl").textContent = ex ? "Your monthly SIP from now on" : "Monthly SIP";
    $("sp-sip-box").hidden = goal; $("sp-goal-box").hidden = !goal;
    $("sp-slab-box").hidden = S.kind !== "debt";
    $("sp-costHint").textContent = ex && S.cost > S.cur ? "Your portfolio is below what you put in. That's fine: the loss is counted against future gains." : "What you've put in so far, from your fund app or statement. Used to work out tax on the gains.";
    var o = opts(), sipNeed = null, sipFlat = null, T = targetNow();
    if (goal) { sipNeed = sipFor(o, T); sipFlat = sipFor(opts({ step: 0 }), T); o.sip = sipNeed; }
    var sim = simulate(o), flat = S.step > 0 ? simulate(Object.assign({}, o, { step: 0, sip: goal ? sipFlat : S.sip })) : null; last = { o: o, sim: sim, flat: flat, sipNeed: sipNeed, sipFlat: sipFlat, T: T };
    var v = $("spVerdict"), yrs = S.years + (S.years === 1 ? " year" : " years");
    if (goal) {
      var startTxt = ex ? "With your " + short(S.cur + S.lump) + " already invested, " : "";
      if (sipNeed === 0) v.innerHTML = '<p class="k">To reach ' + short(T) + " in " + yrs + '</p><p class="v">You\'re <b>already on track</b></p><p class="k">' + startTxt + "your money could grow to " + short(sim.value) + " at " + S.ret + "% a year without any new SIP.</p>";
      else v.innerHTML = '<p class="k">To reach ' + short(T) + " in " + yrs + (S.today ? " (" + short(S.target) + " in today's money)" : "") + '</p><p class="v">You need a SIP of <b>' + inr(round100(sipNeed)) + '</b> a month</p><p class="k">' + startTxt +
        (S.step > 0 ? "rising " + S.step + "% every year. Without a step-up, you'd need " + inr(round100(sipFlat)) + " a month from the start." : "at " + S.ret + "% a year.") + "</p>";
      $("spBarT").textContent = sipNeed === 0 ? "Already on track" : "SIP needed " + inr(round100(sipNeed));
    } else {
      v.innerHTML = '<p class="k">In ' + yrs + ", at " + S.ret + '% a year</p><p class="v">You could have <b>' + short(sim.value) + '</b></p><p class="k">You put in ' + short(sim.invested) + (ex ? ", including what you've already invested" : "") + ", and it grows by " + short(sim.gain) + ". After tax, " + short(sim.after) + "; that's worth about " + short(sim.realAfter) + " in today's money.</p>";
      $("spBarT").textContent = short(sim.value) + " in " + yrs;
    }
    $("spVal").textContent = short(sim.value); $("spInv").textContent = short(sim.invested); $("spGain").textContent = short(sim.gain); $("spAfter").textContent = short(sim.after); $("spReal").textContent = short(sim.realAfter);
    var pi = sim.value > 0 ? Math.max(0, Math.min(100, Math.round(sim.invested / sim.value * 100))) : 100;
    $("spSplit").innerHTML = '<div class="em-bar" role="img" aria-label="Put in ' + pi + '%, gains ' + (100 - pi) + '%"><i style="width:' + pi + '%;background:var(--muted)"></i></div><div class="legend2"><span><i style="background:var(--muted)"></i>Put in ' + short(sim.invested) + " (" + pi + '%)</span><span><i style="background:var(--leave)"></i>Gains ' + short(Math.max(0, sim.gain)) + " (" + (100 - pi) + "%)</span></div>";
    $("spChart").innerHTML = chart(sim, flat);
    $("spLegFlat").hidden = !flat;
    $("spTable").innerHTML = table(sim);
    $("spSens").innerHTML = [-2, 0, 2].map(function (d) {
      var r = Math.max(1, S.ret + d), s, txt;
      if (goal) { var need = sipFor(opts({ ret: r }), T); txt = need === 0 ? "On track" : inr(round100(need)) + "/mo"; }
      else { s = simulate(opts({ ret: r })); txt = short(s.value); }
      return '<div class="sv' + (d === 0 ? " cur" : "") + '"><span class="l">At ' + r + '% a year</span><span class="n">' + txt + "</span></div>";
    }).join("");
    $("spSensH").textContent = goal ? "What if returns are different? (SIP needed)" : "What if returns are different?";
    $("spNotes").innerHTML = notes().map(function (t) { return "<li>" + t + "</li>"; }).join("");
  }
  function notes() {
    var n = ["Returns grow at a steady " + S.ret + "% a year, compounded monthly so that a full year gives exactly " + S.ret + "%. Real returns go up and down, especially in equity funds, and aren't guaranteed.",
      "Each SIP goes in at the start of the month." + (S.step > 0 ? " The SIP rises " + S.step + "% every 12 months." : ""),
      S.kind === "equity" ? "Tax is worked out as if you sell everything at the end: gains above ₹1,25,000 taxed at 12.5% plus 4% cess. Units held for 12 months or less would be taxed at 20% plus cess instead, so selling in stages over a few years usually costs less." :
        "Debt fund gains are taxed at your slab rate (" + S.slab + "%) plus 4% cess when you sell, whatever the holding period, for units bought from 1 April 2023.",
      "In today's money means divided by " + S.infl + "% inflation a year, to show what the amount would buy today.",
      "Fund expenses are already inside fund returns. Exit loads and stamp duty on purchases aren't included."];
    if (S.mode === "existing") n.push("Your existing " + short(S.cur) + " keeps growing at the same rate as new money. Its tax uses what you put in (" + short(S.cost) + ") as the cost.");
    return n;
  }

  /* ---------- Save and load your plan ---------- */
  function today() { return new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  function stamp() { var d = new Date(), p = function (x) { return (x < 10 ? "0" : "") + x; }; return p(d.getDate()) + p(d.getMonth() + 1) + String(d.getFullYear()).slice(2); }
  function csvCell(x) { x = String(x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }
  var LABEL = { mode: "You are", goal: "Working out", sip: "Monthly SIP", step: "Step-up % a year", lump: "Lump sum", cur: "Portfolio value today", cost: "Invested so far",
                years: "Years", ret: "Expected return % a year", kind: "Fund type", slab: "Tax slab %", infl: "Inflation % a year", target: "Goal amount", today: "Goal in today's money" };
  function toCsv() {
    var rows = [["Salarist SIP Calculator · salarist.in/sip-calculator · Saved " + today()],
      ["To carry on, open salarist.in/sip-calculator and choose Load my SIP plan. Update 'Portfolio value today' and 'Invested so far' from your latest statement."], [], ["Setting", "Value"]];
    rows.push([LABEL.mode, S.mode === "existing" ? "Already investing" : "Starting fresh"], [LABEL.goal, S.goal === "target" ? "SIP needed for a goal" : "What my SIP grows to"]);
    ["sip", "step", "lump", "cur", "cost", "years", "ret"].forEach(function (k) { rows.push([LABEL[k], S[k]]); });
    rows.push([LABEL.kind, S.kind === "debt" ? "Debt" : "Equity"], [LABEL.slab, S.slab], [LABEL.infl, S.infl], [LABEL.target, S.target], [LABEL.today, S.today ? "Yes" : "No"]);
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
  function load(text) {
    var rows = parseCsv(text), found = false, T = {}; Object.keys(LABEL).forEach(function (k) { T[LABEL[k]] = k; });
    rows.forEach(function (r) {
      var a = (r[0] || "").trim(), val = (r[1] || "").trim();
      if (a === "Setting") { found = true; return; }
      if (!found || !T[a]) return;
      var k = T[a];
      if (k === "mode") S.mode = /already/i.test(val) ? "existing" : "fresh";
      else if (k === "goal") S.goal = /goal/i.test(val) ? "target" : "grow";
      else if (k === "kind") S.kind = /debt/i.test(val) ? "debt" : "equity";
      else if (k === "today") S.today = /yes/i.test(val);
      else if (k === "slab") { var sl = parseInt(val, 10); if ([0, 5, 10, 15, 20, 25, 30].indexOf(sl) > -1) S.slab = sl; }
      else if (FIELDS[k]) { var v = +val.replace(/[^0-9.]/g, ""); if (isFinite(v) && val !== "") S[k] = Math.max(FIELDS[k][0], Math.min(FIELDS[k][1], v)); }
    });
    if (!found) throw new Error("not a plan");
    showAll(); render();
  }
  function say(msg) { var s = $("spStatus"); s.textContent = msg; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function download(blob, name) { var u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 800); }
  $("spSaveBtn").addEventListener("click", function () { download(new Blob([toCsv()], { type: "text/csv;charset=utf-8" }), "salarist-sip-plan-" + stamp() + ".csv"); say("SIP plan saved to your device. Load it here any time to carry on."); });
  $("spLoadBtn").addEventListener("click", function () { $("spFile").click(); });
  $("spFile").addEventListener("change", function () {
    var f = this.files && this.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { try { load(String(rd.result)); say("SIP plan loaded from " + f.name + "."); } catch (e) { say("Couldn't read that file. Choose a SIP plan saved from this page."); } };
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
    var L = last, sim = L.sim, ex = S.mode === "existing", goal = S.goal === "target";
    var inputs = [["You are", ex ? "Already investing" : "Starting fresh"], ["Working out", goal ? "SIP needed for a goal" : "What the SIP grows to"]];
    if (ex) inputs.push(["Portfolio value today", inr(S.cur), S.cur], ["Invested so far", inr(S.cost), S.cost]);
    inputs.push([ex ? "Lump sum added now" : "Lump sum at the start", S.lump ? inr(S.lump) : "None", S.lump]);
    if (goal) inputs.push(["Goal", short(L.T) + (S.today ? " (" + short(S.target) + " in today's money)" : ""), L.T], ["SIP needed", inr(round100(L.sipNeed)) + " a month", L.sipNeed]);
    else inputs.push(["Monthly SIP", inr(S.sip), S.sip]);
    inputs.push(["Step-up", S.step ? S.step + "% a year" : "None"], ["Years", String(S.years)], ["Expected return", S.ret + "% a year"], ["Fund type", S.kind === "debt" ? "Debt fund" : "Equity fund"]);
    if (S.kind === "debt") inputs.push(["Tax slab", S.slab + "%"]);
    inputs.push(["Inflation", S.infl + "% a year"]);
    var cats = []; for (var i = 0; i <= S.years; i++) cats.push(i);
    var series = [{ name: S.step > 0 ? "With step-up" : "Value", color: "blue", data: sim.series }];
    if (L.flat) series.push({ name: "Without step-up", color: "amber", data: L.flat.series });
    series.push({ name: "Put in", color: "green", data: sim.invSeries });
    var money = [["At the end of year " + S.years, null, null, "head"], ["Total put in", sim.invested, L.flat ? L.flat.invested : sim.invested], ["Gains", sim.gain, L.flat ? L.flat.gain : sim.gain],
      ["Value before tax", sim.value, L.flat ? L.flat.value : sim.value, "total"], ["Tax if you sell it all", -sim.tax, L.flat ? -L.flat.tax : -sim.tax, "sub"], ["Value after tax", sim.after, L.flat ? L.flat.after : sim.after, "total"],
      ["In today's money", sim.realAfter, L.flat ? L.flat.realAfter : sim.realAfter]];
    return {
      title: "SIP Calculator Report", path: "salarist.in/sip-calculator", url: location.origin + location.pathname, file: "salarist-sip-calculator",
      question: goal ? "What SIP do I need to reach " + short(L.T) + " in " + S.years + " years?" : "What could my SIP grow to in " + S.years + " years?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#spVerdict p"), function (p) { return p.textContent; }),
      verdictColor: "blue", inputs: inputs,
      keyNums: [["Value before tax", short(sim.value), sim.value], ["Total put in", short(sim.invested), sim.invested], ["Value after tax", short(sim.after), sim.after], ["In today's money", short(sim.realAfter), sim.realAfter]],
      sensTitle: $("spSensH").textContent,
      sens: Array.prototype.map.call(document.querySelectorAll("#spSens .sv"), function (el) { return [el.querySelector(".l").textContent, el.querySelector(".n").textContent]; }),
      sensCurrent: 1,
      chartTitle: "Your money over time", chartNote: "Value of your investments, against the total you put in.", xlsxChartTitle: "Value (₹ lakh)",
      chart: { series: series, cross: null }, chartYears: cats,
      money: { title: "Where you end up", cols: [S.step > 0 ? "With step-up" : "Your plan", S.step > 0 ? "Without step-up" : "Your plan"], rows: money, note: "" },
      tables: [{ title: "Year by year", sheet: "Year by year", cols: ["Year"].concat(COLS.map(function (c) { return c[0]; })), yearly: sim.rows.map(function (r) { return [String(YEAR + r.y)].concat(COLS.map(function (c) { return r[c[1]]; })); }), monthly: null }],
      notes: notes().map(function (t) { var d = document.createElement("div"); d.innerHTML = t; return d.textContent; }),
      taxRules: ["Equity mutual funds (tax year " + "2026-27" + "): long-term gains (units held over 12 months) above ₹1,25,000 a year taxed at 12.5% plus 4% cess; short-term gains at 20% plus cess.",
        "Debt mutual funds bought from 1 April 2023: gains taxed at your slab rate plus cess, whatever the holding period."],
      short: short, inr: inr
    };
  }
  function busy(btn, on) { btn.disabled = on; btn.setAttribute("aria-busy", on ? "true" : "false"); }
  $("spPdf").addEventListener("click", function () {
    var btn = this; busy(btn, true); say("Making your PDF…");
    withReport(function (K) { K.pdf(spec()).then(function () { busy(btn, false); say("PDF report downloaded."); }, function () { busy(btn, false); say("Couldn't make the PDF. Please try again."); }); });
  });
  $("spXlsx").addEventListener("click", function () {
    var btn = this; busy(btn, true);
    withReport(function (K) { try { K.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(btn, false); });
  });
  function copy(text, ok) {
    function fb() { var t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); var r = false; try { r = document.execCommand("copy"); } catch (e) {} t.remove(); say(r ? ok : "Couldn't copy. Select the text and copy it yourself."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { say(ok); }, fb); else fb();
  }
  $("spShare").addEventListener("click", function () {
    var q = new URLSearchParams(); Object.keys(FIELDS).forEach(function (k) { q.set(k, S[k]); });
    q.set("mode", S.mode); q.set("goal", S.goal); q.set("kind", S.kind); q.set("slab", S.slab); if (S.today) q.set("today", "1");
    copy(location.origin + location.pathname + "?" + q.toString(), "Link copied. Anyone with it sees these numbers.");
  });
  (function bar() {
    var el = $("spBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("spVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".sp .lp-setup"));
    $("spBarBtn").addEventListener("click", function () { $("spVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
