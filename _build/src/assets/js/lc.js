/* Salarist labour codes salary calculator. Runs entirely in the browser; nothing is stored or sent. */
(function () {
  "use strict";
  var NODE = typeof module !== "undefined" && module.exports;
  var NPS = NODE ? require("./nps.js") : window.SalaristNPS;
  var EPF = NODE ? require("./epf.js") : window.SalaristEPF;
  var CEIL = 25000, G = 15 / 26 / 12, CESS = 1.04, CAP = 750000, GCAP = 2000000;

  /* ---------- Core ---------- */
  function pfw(w, basis) { return basis === "capped" ? Math.min(w, CEIL) : w; }
  /* Old-regime tax (section 202(2) rates as carried over: nil to ₹2.5 lakh, 5% to ₹5 lakh, 20% to ₹10 lakh, 30% above; section 156 rebate up to ₹5 lakh; surcharge; 4% cess). */
  function oldTax(inc) {
    var S = [[250000, 0], [500000, 0.05], [1000000, 0.2], [Infinity, 0.3]], t = 0, lo = 0;
    for (var i = 0; i < S.length; i++) { if (inc > lo) t += (Math.min(inc, S[i][0]) - lo) * S[i][1]; lo = S[i][0]; }
    if (inc <= 500000) t = 0;
    var sc = inc > 50000000 ? 0.37 : inc > 20000000 ? 0.25 : inc > 10000000 ? 0.15 : inc > 5000000 ? 0.10 : 0;
    return t * (1 + sc) * CESS;
  }
  /* Tax for a year on fixed pay. x: {B (basic + DA), hra, gross, own (your PF), emp (employer PF)} a month. */
  function tax(o, x) {
    var sal = x.gross * 12, over = Math.max(0, x.emp * 12 - CAP);   /* employer PF above ₹7.5 lakh a year is taxable (section 17) */
    if (o.regime === "new") return { tax: NPS.newTax(Math.max(0, sal - 75000 + over)), hraEx: 0, ded: 0 };
    var hraEx = o.rent > 0 ? Math.max(0, Math.min(x.hra * 12, (o.rent - 0.1 * x.B) * 12, (o.metro ? 0.5 : 0.4) * x.B * 12)) : 0;
    var ded = Math.min(150000, x.own * 12 + o.ded);
    return { tax: oldTax(Math.max(0, sal - 50000 - hraEx - ded + over)), hraEx: hraEx, ded: ded };
  }
  /* Build one salary structure: basic B, wages W (for PF and gratuity), HRA and other allowances. */
  function make(o, B, W, hra, other, basis) {
    var emp = 0.12 * pfw(W, basis), gratP = o.gratCtc ? G * W : 0, gross = B + hra + other;
    var x = { B: B, W: W, hra: hra, other: other, basis: basis, gross: gross, emp: emp, own: emp, gratP: gratP, ctc: gross + emp + gratP };
    var t = tax(o, x); x.tax = t.tax; x.hraEx = t.hraEx; x.ded = t.ded;
    x.takeHome = gross - x.own - x.tax / 12;
    x.gratYear = 15 / 26 * W;   /* gratuity earned for each year of service at today's wages */
    var last = W * Math.pow(1 + o.hike / 100, Math.max(0, o.years - 1));
    x.gratExit = Math.min(GCAP, 15 / 26 * last * o.years);
    if (o.age < 58) {
      var p = EPF.plan({ age: o.age, retireAge: 58, balance: 0, wage: W, basis: basis, eps: true, epsYears: 0, vpf: 0, hike: o.hike, rate: 8.25, infl: 6, slab: 0 });
      x.epf = p.corpus; x.epfReal = p.real; x.epfRows = p.rows;
    } else { x.epf = 0; x.epfReal = 0; x.epfRows = []; }
    return x;
  }
  /* The 50% test on a structure: wages (basic + DA) against total remuneration (pay plus employer PF; gratuity left out, per the Labour Ministry's FAQ of 16 Mar 2026). */
  function test(x) {
    var T = x.gross + x.emp, excl = T - x.B, add = Math.max(0, excl - T / 2);
    return { T: T, share: T ? x.B / T : 1, excl: excl, add: add, wages: x.B + add, ok: add < 1 };
  }
  /* o: {basic, hra, other, pfNow ("full"|"capped"), gratCtc (bool), regime, rent, metro, ded, years, age, hike} */
  function calc(o) {
    var now = make(o, o.basic, o.basic, o.hra, o.other, o.pfNow), t = test(now), C = now.ctc;
    function split(B, gross) { var al = Math.max(0, gross - B), h = Math.min(o.hra, al); return [h, al - h]; }
    /* CTC unchanged: basic raised to half of total pay; the extra employer PF and gratuity come out of allowances (other allowances first, then HRA). */
    function sameCtc(basis) {
      var B = o.basic;
      for (var i = 0; i < 60; i++) { var gp = o.gratCtc ? G * B : 0; B = Math.max(o.basic, (C - gp) / 2); }
      var emp = 0.12 * pfw(B, basis), gp2 = o.gratCtc ? G * B : 0, gross = C - emp - gp2, s = split(B, gross);
      return make(o, B, B, s[0], s[1], basis);
    }
    /* Employer pays the extra: your gross pay stays the same, basic is raised to half of (gross + employer PF), CTC goes up. */
    function absorb() {
      var B = o.basic;
      for (var i = 0; i < 60; i++) B = Math.max(o.basic, (now.gross + 0.12 * pfw(B, o.pfNow)) / 2);
      var s = split(B, now.gross);
      return make(o, B, B, s[0], s[1], o.pfNow);
    }
    var plans = t.ok ? { full: now, capped: now, absorb: now } : { full: sameCtc("full"), capped: sameCtc("capped"), absorb: absorb() };
    return { now: now, test: t, ctc: C, plans: plans, ok: t.ok };
  }
  var API = { calc: calc, test: test, oldTax: oldTax, CEIL: CEIL, G: G };
  if (NODE) { module.exports = API; return; }
  window.SalaristLC = API;
  if (!document.getElementById("lcVerdict")) return;

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
  function delta(v, unit) { var r = Math.round(v); return r === 0 ? "No change" : (r > 0 ? "↑ " : "↓ ") + inr(Math.abs(r)) + (unit || ""); }
  function sdelta(v) { return delta(v).replace("No change", "unchanged").replace(/₹[\d,]+/, function (m) { return short(+m.replace(/[₹,]/g, "")); }); }
  function pct(v) { return Math.round(v * 100) + "%"; }
  var S = { basic: 40000, hra: 20000, other: 60000, pfNow: "full", gratCtc: true, regime: "new", rent: 20000, metro: true, ded: 0, years: 10, age: 30, hike: 7, plan: "full" };
  var NUM = { basic: [1000, 1e8], hra: [0, 1e8], other: [0, 1e8], rent: [0, 1e8], ded: [0, 1e7], years: [1, 40], age: [18, 65], hike: [0, 20] };
  var MONEY = { basic: 1, hra: 1, other: 1, rent: 1, ded: 1 };
  var SEGS = { pfNow: ["full", "capped"], regime: ["new", "old"], plan: ["full", "capped", "absorb"] };
  var planTouched = false;
  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    Object.keys(NUM).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= NUM[k][0] && v <= NUM[k][1]) S[k] = v; });
    Object.keys(SEGS).forEach(function (k) { if (SEGS[k].indexOf(q.get(k)) > -1) S[k] = q.get(k); });
    if (q.get("gratCtc") === "0") S.gratCtc = false; if (q.get("metro") === "0") S.metro = false;
    if (q.has("plan")) planTouched = true; else S.plan = S.pfNow === "capped" ? "capped" : "full";
  })();
  var shows = [];
  function bind(k) {
    var el = $("lc-" + k), note = $("lc-" + k + "-w"); if (!el) return;
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
  Object.keys(SEGS).forEach(function (k) { document.querySelectorAll("[data-" + k + "]").forEach(function (b) { b.addEventListener("click", function () {
    S[k] = b.getAttribute("data-" + k);
    if (k === "plan") planTouched = true;
    if (k === "pfNow" && !planTouched) S.plan = S.pfNow === "capped" ? "capped" : "full";
    render(); }); }); });
  document.querySelectorAll("[data-gratctc]").forEach(function (b) { b.addEventListener("click", function () { S.gratCtc = b.getAttribute("data-gratctc") === "1"; render(); }); });
  document.querySelectorAll("[data-metro]").forEach(function (b) { b.addEventListener("click", function () { S.metro = b.getAttribute("data-metro") === "1"; render(); }); });
  function pressed(attr, val) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-" + attr) === String(val) ? "true" : "false"); }); }
  var LABEL = { full: "CTC unchanged, PF on your full basic", capped: "CTC unchanged, PF capped at ₹25,000 wages", absorb: "Employer pays the extra, CTC goes up" };
  var SHORTL = { full: "PF on full basic", capped: "PF capped at ₹25,000", absorb: "Employer pays the extra" };
  var last = null;
  function chart(r) {
    var a = r.now.epfRows, b = r.plans[S.plan].epfRows; if (!a.length) return "";
    var W = 420, Hh = 240, pl = 54, pr = 14, pt = 20, pb = 26, n = a.length;
    var A = [0].concat(a.map(function (x) { return x.bal; })), Bv = [0].concat(b.map(function (x) { return x.bal; }));
    var max = Math.max.apply(null, A.concat(Bv)) || 1, st = Math.pow(10, Math.floor(Math.log10(max / 4))), qq = max / 4 / st; st *= qq <= 1 ? 1 : qq <= 2 ? 2 : qq <= 2.5 ? 2.5 : qq <= 5 ? 5 : 10; max = st * 4;
    function x(i) { return pl + i / n * (W - pl - pr); } function yy(v) { return pt + (max - v) / max * (Hh - pt - pb); }
    function path(v) { return v.map(function (z, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(z).toFixed(1); }).join(""); }
    var g = ""; for (var k = 0; k <= 4; k++) { var gy = yy(max * k / 4).toFixed(1); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+gy + 3) + '" class="al" text-anchor="end">' + short(max * k / 4) + "</text>"; }
    var stp = n > 24 ? 5 : n > 12 ? 3 : n > 6 ? 2 : 1, xl = ""; for (var t = 0; t <= n; t += stp) xl += '<text x="' + x(t).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">' + (S.age + t) + "</text>";
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="EPF balance by age, now and after restructuring">' + g + xl + '<path d="' + path(A) + '" class="ln buy"/><path d="' + path(Bv) + '" class="ln rent"/></svg>';
  }
  function rowsOf(r) {
    var a = r.now, b = r.plans[S.plan];
    return [["Basic + DA", a.B, b.B], ["HRA", a.hra, b.hra], ["Other allowances", a.other, b.other], ["Gross pay", a.gross, b.gross, "sub"],
      ["Employer PF (12%)", a.emp, b.emp], ["Gratuity set aside in CTC", a.gratP, b.gratP], ["CTC a month", a.ctc, b.ctc, "tot"],
      ["Your PF (12%)", a.own, b.own], ["Income tax a month", a.tax / 12, b.tax / 12], ["Take-home a month", a.takeHome, b.takeHome, "tot"],
      ["PF a month, yours + employer's", a.own + a.emp, b.own + b.emp], ["Gratuity earned per year of service", a.gratYear, b.gratYear]];
  }
  function render() {
    Object.keys(SEGS).forEach(function (k) { pressed(k, S[k]); }); pressed("gratctc", S.gratCtc ? "1" : "0"); pressed("metro", S.metro ? "1" : "0");
    $("lcOld").hidden = S.regime !== "old";
    var r = calc(S), t = r.test, a = r.now, b = r.plans[S.plan]; last = r;
    var dTH = b.takeHome - a.takeHome, dPF = (b.own + b.emp) - (a.own + a.emp), dG = b.gratExit - a.gratExit, dE = b.epf - a.epf;
    $("lcVerdict").className = "verdict" + (r.ok ? "" : dTH < -1 ? " short" : "");
    if (r.ok) {
      $("lcVerdict").innerHTML = '<p class="k">Your basic + DA is ' + pct(t.share) + " of your pay (" + inr(t.T) + ' a month, with employer PF)</p><p class="v">Already above 50%: <b>nothing has to change</b></p>' +
        '<p class="k">The rule only adds to your wages when HRA and other allowances are more than half your pay.</p>';
    } else {
      $("lcVerdict").innerHTML = '<p class="k">Your basic + DA is ' + pct(t.share) + " of your pay. The floor is 50%, so " + inr(t.add) + " a month counts as wages for PF and gratuity.</p>" +
        '<p class="v">' + LABEL[S.plan] + ": take-home <b>" + delta(dTH, " a month") + "</b></p>" +
        '<p class="k">PF (yours + employer\'s) ' + delta(dPF, " a month").replace("No change", "unchanged") + "; gratuity after " + S.years + " years " + sdelta(dG) +
        (S.age < 58 && Math.round(dE) ? "; EPF at 58 " + sdelta(dE) + " (about " + short(Math.abs(b.epfReal - a.epfReal)) + " in today's money)" : "") + ".</p>";
    }
    $("lcS1").textContent = inr(b.takeHome); $("lcS1h").textContent = r.ok ? "Take-home a month" : delta(dTH, " a month");
    $("lcS2").textContent = inr(b.own + b.emp); $("lcS2h").textContent = r.ok ? "PF a month, yours + employer's" : delta(dPF, " a month");
    $("lcS3").textContent = inr(b.tax); $("lcS3h").textContent = r.ok ? "Income tax a year" : "Tax a year: " + delta(b.tax - a.tax).toLowerCase().replace("no change", "no change");
    $("lcS4").textContent = short(b.gratExit); $("lcS4h").textContent = "Gratuity after " + S.years + " years" + (r.ok ? "" : ": " + sdelta(dG));
    /* 50% test */
    var parts = [["Basic + DA", a.B, true], ["HRA", a.hra], ["Other allowances", a.other], ["Employer PF", a.emp]];
    $("lcTest").innerHTML = '<h3>The 50% test on your pay now</h3><div class="lc-bar" role="img" aria-label="Basic + DA is ' + pct(t.share) + ' of total pay"><span class="w" style="width:' + (t.share * 100).toFixed(1) + '%"></span><i style="left:50%"></i></div>' +
      '<ul class="lim">' + parts.map(function (p) { return "<li" + (p[2] ? ' class="on"' : "") + "><span>" + p[0] + "</span><b>" + inr(p[1]) + " · " + pct(t.T ? p[1] / t.T : 0) + "</b></li>"; }).join("") +
      '<li><span>Total pay for the test</span><b>' + inr(t.T) + "</b></li></ul>" +
      '<p class="hint">' + (r.ok ? "HRA, other allowances and employer PF are " + inr(t.excl) + ", within half of " + inr(t.T) + ". Wages stay at your basic + DA."
        : "HRA, other allowances and employer PF are " + inr(t.excl) + ", more than half of " + inr(t.T) + " (" + inr(t.T / 2) + "). The extra " + inr(t.add) + " is added to wages, so wages become " + inr(t.wages) + ".") + "</p>";
    var notes = [];
    if (!r.ok) {
      if (S.plan === "capped") notes.push(S.pfNow === "full" && S.basic > 25000 ? "<b>PF capped:</b> your PF is on full basic today, so moving it to the ₹25,000 ceiling cuts PF for you and your employer to ₹3,000 a month each. Take-home goes up, but you save " + inr((a.own + a.emp) - (b.own + b.emp)) + " a month less in EPF. PF above the ceiling is optional, so ask HR whether you can choose."
        : "<b>PF capped:</b> PF stays on wages of up to ₹25,000, so your PF only changes if your basic is below that today. The Labour Ministry has said take-home doesn't fall when PF stays on the wage ceiling; here it moves only because the bigger gratuity set-aside and any tax change come out of the same CTC.");
      if (S.plan === "absorb") notes.push("<b>Employer pays the extra:</b> your gross pay stays the same and your CTC goes up by " + inr(b.ctc - a.ctc) + " a month. Your take-home falls only by your own higher PF" + (S.pfNow === "capped" ? ", which is little or nothing when PF is capped." : "."));
      if (S.plan === "full") notes.push("<b>CTC unchanged, PF on full basic:</b> the most common way companies restructure, and the one that cuts take-home the most. The money isn't lost: it goes into your EPF (and gratuity), which you get later.");
      if (S.regime === "old") notes.push("<b>Old regime:</b> a higher basic changes your HRA exemption (" + inr(a.hraEx) + " → " + inr(b.hraEx) + " a year) and your PF counts towards the ₹1.5 lakh deduction.");
      else notes.push("<b>New regime:</b> your own PF gets no deduction, but less taxable pay (when allowances move into employer PF and gratuity) means a little less tax.");
    }
    $("lcRule").innerHTML = notes.join("<br><br>"); $("lcRule").hidden = !notes.length;
    $("lcTable").innerHTML = '<table class="calc"><thead><tr><th>A month</th><th>Now</th><th>After</th><th>Change</th></tr></thead><tbody>' +
      rowsOf(r).map(function (x) { var cls = x[3] === "tot" ? ' class="tot"' : ""; return "<tr" + cls + '><th scope="row">' + x[0] + '</th><td data-l="Now">' + inr(x[1]) + '</td><td data-l="After">' + inr(x[2]) + '</td><td data-l="Change">' + (Math.round(x[2] - x[1]) === 0 ? "—" : (x[2] > x[1] ? "+" : "") + inr(x[2] - x[1])) + "</td></tr>"; }).join("") + "</tbody></table>";
    $("lcTableH").textContent = "Your salary now and after (" + SHORTL[S.plan].replace("Employer", "employer") + ")";
    var c = chart(r); $("lcChartBox").hidden = !c; $("lcChart").innerHTML = c;
    $("lcChartNote").textContent = c ? "Blue: after restructuring (" + LABEL[S.plan] + "). Amber: your salary as it is now. From today's contributions only, at 8.25% a year with " + S.hike + "% pay rises; your current EPF balance adds the same to both." : "";
    r.what = ["full", "capped", "absorb"].map(function (k) { var p = r.plans[k]; return [LABEL[k], p.takeHome - a.takeHome, (p.own + p.emp) - (a.own + a.emp), p.gratExit - a.gratExit, p.epf - a.epf, k]; });
    $("lcSens").innerHTML = r.what.map(function (w) {
      return '<button type="button" class="sv' + (w[5] === S.plan ? " cur" : "") + '" data-pick="' + w[5] + '"><span class="l">' + w[0] + '</span><span class="n">' + delta(w[1], " a month") + '</span><span class="h">Take-home. PF ' + delta(w[2], "/month").replace("No change", "unchanged") + ", gratuity " + sdelta(w[3]) + "</span></button>";
    }).join("");
    document.querySelectorAll("[data-pick]").forEach(function (el) { el.addEventListener("click", function () { S.plan = el.getAttribute("data-pick"); planTouched = true; render(); }); });
    $("lcBarT").textContent = r.ok ? "Basic already " + pct(t.share) : "Take-home " + delta(dTH, "/mo");
    shows.forEach(function (f) { f(); });
  }

  /* ---------- Reports ---------- */
  function say(m) { var s = $("lcStatus"); s.textContent = m; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function spec() {
    var r = last, a = r.now, b = r.plans[S.plan], cats = [S.age], m1 = [0], m2 = [0];
    a.epfRows.forEach(function (w, i) {
      cats.push(w.age); var p1 = i ? a.epfRows[i - 1].bal : 0, p2 = i ? b.epfRows[i - 1].bal : 0, q2 = b.epfRows[i].bal;
      for (var m = 1; m <= 12; m++) { m1.push(p1 + (w.bal - p1) * m / 12); m2.push(p2 + (q2 - p2) * m / 12); }
    });
    return {
      title: "Labour Codes Salary Report", path: "salarist.in/labour-codes-salary-calculator", url: location.origin + location.pathname, file: "salarist-labour-codes-salary",
      question: "What will the labour codes' 50% wage rule do to my salary?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#lcVerdict p"), function (x) { return x.textContent; }), verdictColor: "blue",
      inputs: [["Basic + DA a month", inr(S.basic), S.basic], ["HRA a month", inr(S.hra), S.hra], ["Other allowances a month", inr(S.other), S.other],
        ["PF now", S.pfNow === "capped" ? "On wages capped at ₹25,000" : "On full basic + DA"], ["Gratuity included in CTC", S.gratCtc ? "Yes" : "No"],
        ["Tax regime", S.regime === "old" ? "Old" : "New"]].concat(S.regime === "old" ? [["Rent a month", inr(S.rent), S.rent], ["HRA city", S.metro ? "50% city" : "Other (40%)"], ["Other deductions a year (80C, 80D…)", inr(S.ded), S.ded]] : [])
        .concat([["Years you expect to stay", String(S.years)], ["Age", String(S.age)], ["Pay rise each year", S.hike + "%"], ["Restructuring shown", LABEL[S.plan]]]),
      keyNums: [["Take-home a month after", inr(b.takeHome), b.takeHome], ["Change in take-home", delta(b.takeHome - a.takeHome, "/month"), b.takeHome - a.takeHome],
        ["PF a month, yours + employer's", inr(b.own + b.emp), b.own + b.emp], ["Gratuity after " + S.years + " years", short(b.gratExit), b.gratExit]],
      sensTitle: "Three ways your employer might restructure", sens: r.what.map(function (w) { return [w[0], delta(w[1], "/month")]; }), sensCurrent: ["full", "capped", "absorb"].indexOf(S.plan),
      chartTitle: "EPF balance by age, now and after", chartNote: "From today's contributions only, at 8.25% a year with " + S.hike + "% pay rises.", xlsxChartTitle: "EPF (₹ lakh)",
      chart: a.epfRows.length ? { series: [{ name: "After", color: "blue", data: m2 }, { name: "Now", color: "amber", data: m1 }], cross: null } : null, chartYears: cats, chartXLabel: "Age", chartAge0: S.age,
      money: { title: "Your salary now and after", cols: ["Now", "After"], rows: rowsOf(r).map(function (x) { return [x[0], x[1], inr(x[2]), x[3] === "tot" ? "total" : undefined]; }), note: "The 50% test on your pay now: basic + DA is " + inr(r.test.T ? a.B : 0) + " of " + inr(r.test.T) + " (" + pct(r.test.share) + "). " + $("lcTest").querySelector(".hint").textContent + " " + $("lcRule").textContent },
      tables: [{ title: "Three ways your employer might restructure", sheet: "Options", cols: ["Option", "Take-home a month", "Change", "PF a month (both)", "CTC a month", "Gratuity after " + S.years + " years", "EPF at 58"],
        yearly: ["full", "capped", "absorb"].map(function (k) { var p = r.plans[k]; return [SHORTL[k], p.takeHome, p.takeHome - a.takeHome, p.own + p.emp, p.ctc, p.gratExit, p.epf]; }), monthly: null }],
      notes: ["50% test: wages (basic + DA) must be at least half of total pay. Total pay here is gross monthly pay plus employer PF; gratuity is left out, per the Labour Ministry's FAQ of 16 March 2026. If HRA, other allowances and employer PF are more than half, the excess counts as wages (Code on Wages, 2019, section 2(y)).",
        "CTC unchanged: basic is raised to half of total pay; the extra employer PF and gratuity set-aside come out of other allowances first, then HRA. Employer pays the extra: gross pay stays the same and CTC goes up.",
        "PF: 12% each from you and your employer, on full basic + DA or on wages capped at ₹25,000 (ceiling from 17 September 2026). Gratuity set aside in CTC: 15/26 of a month's wages a year (4.81%).",
        "Tax: " + (S.regime === "old" ? "old regime, ₹50,000 standard deduction, HRA exemption, your PF and other deductions up to ₹1.5 lakh." : "new regime, ₹75,000 standard deduction, section 156 rebate up to ₹12 lakh.") + " Professional tax, ESI and variable pay are left out.",
        "Gratuity after " + S.years + " years: 15/26 × last wages × years, with pay rising " + S.hike + "% a year; payable after 5 years (1 year for fixed-term); ₹20 lakh limit. EPF at 58: from today's contributions only, at 8.25%."],
      taxRules: ["Code on Wages, 2019, section 2(y) (in force from 21 November 2025); Labour Ministry FAQs of 30 December 2025 and 16 March 2026. Income-tax Act, 2025: employer PF, NPS and superannuation above ₹7.5 lakh a year is taxable (section 17)."],
      short: short, inr: inr
    };
  }
  function busy(b, on) { b.disabled = on; b.setAttribute("aria-busy", on ? "true" : "false"); }
  $("lcPdf").addEventListener("click", function () { var b = this; busy(b, true); say("Making your PDF…"); withReport(function (Kt) { Kt.pdf(spec()).then(function () { busy(b, false); say("PDF report downloaded."); }, function () { busy(b, false); say("Couldn't make the PDF. Please try again."); }); }); });
  $("lcXlsx").addEventListener("click", function () { var b = this; busy(b, true); withReport(function (Kt) { try { Kt.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(b, false); }); });
  $("lcShare").addEventListener("click", function () {
    var q = new URLSearchParams(); Object.keys(NUM).forEach(function (k) { q.set(k, S[k]); }); Object.keys(SEGS).forEach(function (k) { q.set(k, S[k]); }); q.set("gratCtc", S.gratCtc ? "1" : "0"); q.set("metro", S.metro ? "1" : "0");
    var t = location.origin + location.pathname + "?" + q.toString();
    function ok() { say("Link copied. Anyone with it sees these numbers."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { say("Couldn't copy. Copy the address bar instead."); }); else say("Copy the address bar to share.");
  });
  (function bar() {
    var el = $("lcBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("lcVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".lcx .lp-setup"));
    $("lcBarBtn").addEventListener("click", function () { $("lcVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
