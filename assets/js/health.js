/* Salarist health insurance cover calculator. Runs entirely in the browser; nothing is stored or sent.
   Method: the cover a family needs in a bad year = one serious illness in a good private hospital + (if more than one person) one more ordinary hospital stay,
   at today's costs for your city, grown by medical inflation to the end of the years you want the cover to stay enough. Cover is then split into a base policy
   and a super top-up whose aggregate deductible equals the base. Employer group cover is shown separately: it ends when you leave the job.
   Tax: section 126 of the Income-tax Act, 2025 (old 80D), old regime only: premiums up to ₹25,000 for self, spouse and children (₹50,000 if any of them is a
   senior citizen) and ₹25,000 for parents (₹50,000 if a parent is a senior citizen). Individual health insurance is GST-free from 22 Sep 2025. */
(function () {
  "use strict";
  var NODE = typeof module !== "undefined" && module.exports;
  var L = 100000;
  var CITY = { metro: { bill: 15 * L, stay: 1 * L, base: 10 * L, name: "a metro" }, big: { bill: 10 * L, stay: 75000, base: 10 * L, name: "a big city" }, small: { bill: 7 * L, stay: 50000, base: 5 * L, name: "a smaller town" } };
  var LADDER = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 100, 150, 200, 300].map(function (x) { return x * L; });
  function up(v) { for (var i = 0; i < LADDER.length; i++) if (LADDER[i] >= v - 1) return LADDER[i]; return Math.ceil(v / (50 * L)) * 50 * L; }
  function dedOf(v) { return v >= 10 * L ? 10 * L : v >= 5 * L ? 5 * L : v >= 3 * L ? 3 * L : 0; }
  /* o: {city, adults (1-2), kids (0-4), age (eldest adult), years, infl (% a year), bill, stay, base (your personal base cover), topup (existing super top-up),
         group (employer group cover), parents (0-2), pAge (older parent), pCover (parents' existing cover), regime ("new"|"old"), slab (%), prem (premium for your family a year), pPrem (parents' premium a year)} */
  function plan(people, o, have) {
    var need0 = o.bill + (people > 1 ? o.stay : 0), g = 1 + o.infl / 100;
    var target = need0 * Math.pow(g, o.years), buy = target <= 100 * L ? Math.ceil(target / (5 * L) - 1e-9) * 5 * L : Math.ceil(target / (25 * L) - 1e-9) * 25 * L;
    var base = have.base >= 3 * L ? have.base : CITY[o.city].base, ded = dedOf(base) || base;
    var top = Math.max(0, up(Math.max(buy - ded, 0)));
    var yrs = []; for (var t = 0; t <= o.years; t++) yrs.push(need0 * Math.pow(g, t));
    var mine = have.base + have.topup, short = null;
    for (var y = 0; y <= o.years; y++) if (yrs[y] > mine + 1) { short = y; break; }
    return { need0: need0, target: target, buy: buy, base: base, ded: ded, top: top, yrs: yrs, mine: mine, short: short, gap: Math.max(0, buy - mine) };
  }
  function calc(o) {
    var people = Math.max(1, o.adults) + Math.max(0, o.kids);
    var you = plan(people, o, { base: o.base, topup: o.topup });
    var withJob = you.mine + o.group, shortJob = null;
    for (var y = 0; y <= o.years; y++) if (you.yrs[y] > withJob + 1) { shortJob = y; break; }
    var par = o.parents > 0 ? plan(o.parents, o, { base: o.pCover, topup: 0 }) : null;
    var selfSenior = o.age >= 60, pSenior = o.pAge >= 60;
    var dSelf = Math.min(o.prem, selfSenior ? 50000 : 25000), dPar = o.parents > 0 ? Math.min(o.pPrem, pSenior ? 50000 : 25000) : 0;
    var taxSaved = o.regime === "old" ? (dSelf + dPar) * o.slab / 100 * 1.04 : 0;
    return { people: people, you: you, withJob: withJob, shortJob: shortJob, par: par, dSelf: dSelf, dPar: dPar, taxSaved: taxSaved, selfSenior: selfSenior, pSenior: pSenior,
             oldSaved: (dSelf + dPar) * o.slab / 100 * 1.04 };
  }
  var API = { calc: calc, CITY: CITY, up: up };
  if (NODE) { module.exports = API; return; }
  window.SalaristHealth = API;
  if (!document.getElementById("hcVerdict")) return;

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
  var S = { city: "metro", adults: 2, kids: 1, age: 32, years: 10, infl: 10, bill: 15 * L, stay: 1 * L, base: 5 * L, topup: 0, group: 5 * L, parents: 2, pAge: 62, pCover: 0, regime: "new", slab: 20, prem: 15000, pPrem: 0 };
  var LIM = { adults: [1, 2], kids: [0, 4], age: [18, 75], years: [1, 30], infl: [0, 20], bill: [0, 1e9], stay: [0, 1e8], base: [0, 1e9], topup: [0, 1e9], group: [0, 1e9], parents: [0, 2], pAge: [40, 95], pCover: [0, 1e9], slab: [0, 30], prem: [0, 1e7], pPrem: [0, 1e7] };
  var MONEY = { bill: 1, stay: 1, base: 1, topup: 1, group: 1, pCover: 1, prem: 1, pPrem: 1 };
  var NUM = ["age", "years", "infl", "bill", "stay", "base", "topup", "group", "pAge", "pCover", "prem", "pPrem"];
  var billTouched = false;
  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    NUM.concat(["adults", "kids", "parents", "slab"]).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= LIM[k][0] && v <= LIM[k][1]) S[k] = v; });
    if (CITY[q.get("city")]) S.city = q.get("city"); if (q.get("regime") === "old") S.regime = "old";
    if (q.get("bill")) billTouched = true;
  })();
  var shows = [];
  function bind(k) {
    var el = $("hc-" + k), note = $("hc-" + k + "-w"); if (!el) return;
    function show() { el.value = MONEY[k] ? fmt.format(S[k]) : String(S[k]); if (note) note.textContent = MONEY[k] ? words(S[k]) : ""; }
    el.addEventListener("input", function () {
      var raw = MONEY[k] ? this.value.replace(/[^0-9]/g, "") : this.value.replace(/[^0-9.]/g, "");
      if (MONEY[k]) this.value = raw ? fmt.format(+raw) : "";
      var v = parseFloat(raw); if (!isFinite(v)) { if (raw === "") { S[k] = 0; render(); } return; }
      if (v < LIM[k][0] || v > LIM[k][1]) return;
      S[k] = v; if (k === "bill" || k === "stay") billTouched = true; if (note) note.textContent = MONEY[k] ? words(v) : ""; render();
    });
    el.addEventListener("blur", show); shows.push(function () { if (document.activeElement !== el) show(); }); show();
  }
  NUM.forEach(bind);
  function segs(key, num) { document.querySelectorAll("[data-" + key + "]").forEach(function (b) { b.addEventListener("click", function () { var v = b.getAttribute("data-" + key); S[key] = num ? +v : v;
    if (key === "city" && !billTouched) { S.bill = CITY[v].bill; S.stay = CITY[v].stay; } render(); }); }); }
  segs("city"); segs("adults", 1); segs("kids", 1); segs("parents", 1); segs("regime"); segs("slab", 1);
  function opts(ch) { var o = Object.assign({}, S); return ch ? ch(o) || o : o; }
  function press(key) { document.querySelectorAll("[data-" + key + "]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-" + key)) === String(S[key]) ? "true" : "false"); }); }
  var last = null;
  function chart(r) {
    var Y = r.you.yrs, n = Y.length - 1, W = 420, Hh = 230, pl = 54, pr = 12, pt = 16, pb = 26;
    var lines = [r.you.mine, r.withJob];
    var mx = Math.max.apply(null, Y.concat(lines)) * 1.05, mn = 0, span = mx - mn || 1;
    var st = Math.pow(10, Math.floor(Math.log10(span / 4))), qq = span / 4 / st; st *= qq <= 1 ? 1 : qq <= 2 ? 2 : qq <= 2.5 ? 2.5 : qq <= 5 ? 5 : 10;
    mx = st * Math.ceil(mx / st);
    function x(i) { return pl + (n ? i / n : 0) * (W - pl - pr); } function yy(v) { return pt + (mx - v) / (mx - mn) * (Hh - pt - pb); }
    var g = ""; for (var v = 0; v <= mx + 1; v += st) { var gy = yy(v).toFixed(1); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+gy + 3) + '" class="al" text-anchor="end">' + short(v) + "</text>"; }
    var xl = "", stp = n > 15 ? 5 : n > 6 ? 2 : 1; for (var i = 0; i <= n; i += stp) xl += '<text x="' + x(i).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">' + (S.age + i) + "</text>";
    function flat(v, cls, dash) { return '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy(v).toFixed(1) + '" y2="' + yy(v).toFixed(1) + '" class="ln ' + cls + '"' + (dash ? ' stroke-dasharray="6 5"' : "") + "/>"; }
    var p = Y.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(v).toFixed(1); }).join("");
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Cover needed in a bad year, by your age, against the cover you have">' + g + xl +
      flat(r.withJob, "buy", true) + flat(r.you.mine, "buy") + '<path d="' + p + '" class="ln rent"/></svg>';
  }
  function render() {
    ["city", "adults", "kids", "parents", "regime", "slab"].forEach(press);
    $("hcParF").hidden = S.parents === 0; $("hcTaxF").hidden = S.regime !== "old"; $("hcPPremF").hidden = S.parents === 0 || S.regime !== "old";
    var r = calc(opts()); last = r; var Y = r.you, ppl = r.people;
    var members = ["you"].concat(S.adults > 1 ? ["your spouse"] : []).concat(S.kids ? [S.kids + (S.kids > 1 ? " children" : " child")] : []);
    var whoL = members.length > 1 ? members.slice(0, -1).join(", ") + " and " + members[members.length - 1] : "You";
    whoL = whoL.charAt(0).toUpperCase() + whoL.slice(1);
    var haveOwn = Y.base > 0 && S.base >= 3 * L;
    $("hcVerdict").className = "verdict" + (Y.gap > 0 ? " short" : "");
    $("hcVerdict").innerHTML = '<p class="k">' + whoL + " in " + CITY[S.city].name + ", for the next " + S.years + " years" + (S.parents ? ". Your parents are worked out separately, below." : "") + "</p>" +
      '<p class="v">' + (ppl === 1 ? "You need" : "Your family needs") + " about <b>" + short(Y.buy) + "</b> of health cover</p>" +
      '<p class="k">' + (Y.gap > 0 ? "Your own policies cover " + short(Y.mine) + ", so you're " + short(Y.gap) + " short. To fill it: " + (haveOwn ? "keep your " : "buy a ") + short(Y.base) + " base policy and add a " + short(Y.top) + " super top-up with a " + short(Y.ded) + " deductible."
        : "Your own policies (" + short(Y.mine) + ") already cover it. Review it every few years as costs rise.") +
      (S.group ? " Your employer's " + short(S.group) + " isn't counted in this, because it ends when you leave the job; while you're there it can pay " + (S.group >= Y.ded ? "the super top-up's " + short(Y.ded) + " deductible" : short(S.group) + " of the super top-up's " + short(Y.ded) + " deductible") + ", and you're " + (Y.buy > r.withJob ? short(Y.buy - r.withJob) + " short until then." : "covered until then.") : "") + "</p>";
    var pv = $("hcParV"); pv.hidden = !r.par;
    if (r.par) {
      var P = r.par;
      pv.className = "verdict pv" + (P.gap > 0 ? " short" : "");
      pv.innerHTML = '<p class="k">Your ' + (S.parents === 1 ? "parent" : "parents") + ", on a separate policy</p>" +
        '<p class="v">' + (S.parents === 1 ? "Your parent needs" : "They need") + " about <b>" + short(P.buy) + "</b></p>" +
        '<p class="k">' + (S.pCover ? "They have " + short(S.pCover) + (P.gap > 0 ? ", " + short(P.gap) + " short." : ", which is enough.") : "They have no cover of their own.") +
        (P.gap > 0 ? " To fill it: " + (S.pCover >= 3 * L ? "keep their " : "a ") + short(P.base) + " senior citizen policy plus a " + short(P.top) + " super top-up with a " + short(P.ded) + " deductible." : "") + " Not on your family floater: see why below.</p>";
    }
    $("hcS1").textContent = short(Y.buy); $("hcS1h").textContent = "A bad year costs " + short(Y.need0) + " today, " + short(Y.target) + " in " + S.years + " years at " + S.infl + "% medical inflation";
    $("hcS2").textContent = short(Y.gap); $("hcS2h").textContent = "Your own cover is " + short(Y.mine) + (Y.short === null ? ", enough for all " + S.years + " years" : Y.short === 0 ? ", already short of a bad year today" : ", short from age " + (S.age + Y.short));
    $("hcS3").textContent = S.group ? short(Math.max(0, Y.buy - r.withJob)) : "—"; $("hcS3h").textContent = S.group ? "Short while you're in this job, counting its " + short(S.group) + " cover. It ends when you leave." : "No employer cover entered";
    $("hcS4").textContent = r.par ? short(r.par.buy) : "—"; $("hcS4h").textContent = r.par ? "Separate policy; they have " + short(S.pCover) + (r.par.gap > 0 ? ", " + short(r.par.gap) + " short" : "") : "No parents to cover";
    var notes = [];
    notes.push("<b>How the need is worked out:</b> one serious illness in a good private hospital in " + CITY[S.city].name + " costs about " + short(S.bill) + " today" + (ppl > 1 ? ", plus " + short(S.stay) + " for another member's hospital stay in the same year, since a family floater shares one sum insured" : "") + ". Medical costs have been rising about " + S.infl + "% a year, so the same bills come to " + short(Y.target) + " in " + S.years + " years.");
    notes.push("<b>Base plus super top-up:</b> a base policy pays the smaller, frequent bills. A super top-up pays once your total bills in the policy year cross its deductible, and costs far less than raising the base by the same amount. " + (Y.gap > 0 ? "Here: " + short(Y.base) + " base + " + short(Y.top) + " super top-up (deductible " + short(Y.ded) + ") = " + short(Y.base + Y.top) + "." : ""));
    if (S.group) notes.push("<b>Your employer's cover:</b> " + short(S.group) + " helps while you're in the job, and many super top-ups let a claim paid by it count towards the deductible. It ends when you resign, retire or are laid off, often when you need cover most, so it isn't counted in your own cover above. Keep a personal base policy too: buying one later means fresh waiting periods.");
    if (r.par) notes.push("<b>Your parents:</b> " + (S.parents === 1 ? "one parent" : "two parents") + " need about " + short(r.par.buy) + " on the same basis; " + (S.pCover ? "they have " + short(S.pCover) + (r.par.gap > 0 ? ", so they're " + short(r.par.gap) + " short" : ", which is enough") : "they have no cover of their own") + ". Cover them on a separate policy, not your floater: older members raise the floater's premium for everyone and share its sum insured. Senior citizen plans often have a co-payment and up to 3 years' wait for existing illnesses.");
    notes.push(S.regime === "old" ? "<b>Tax:</b> under the old regime, section 126 (old 80D) allows " + inr(r.dSelf) + " for your family's premium" + (r.par ? " and " + inr(r.dPar) + " for your parents'" : "") + ", saving about " + inr(r.taxSaved) + " at your " + S.slab + "% slab." : "<b>Tax:</b> under the new regime there's no deduction for health insurance premiums (section 126 is old regime only). Individual policies have been GST-free since 22 September 2025.");
    $("hcRule").innerHTML = notes.join("<br><br>"); r.notes = notes.map(function (n) { var m = /^<b>(.*?):<\/b>\s*([\s\S]*)$/.exec(n); return m ? [m[1].charAt(0).toUpperCase() + m[1].slice(1), (function (t) { return t.charAt(0).toUpperCase() + t.slice(1); })(m[2].replace(/<[^>]+>/g, ""))] : ["Note", n.replace(/<[^>]+>/g, "")]; });
    function alt(ch) { return short(calc(opts(ch)).you.buy); }
    r.what = [["Medical inflation 12%", alt(function (o) { o.infl = 12; })], ["Bills 25% higher", alt(function (o) { o.bill *= 1.25; o.stay *= 1.25; })],
      ["Enough for 15 years", alt(function (o) { o.years = 15; })], ["Medical inflation 8%", alt(function (o) { o.infl = 8; })]];
    $("hcSens").innerHTML = r.what.map(function (w) { return '<div class="sv"><span class="l">' + w[0] + '</span><span class="n">' + w[1] + "</span></div>"; }).join("");
    $("hcChart").innerHTML = chart(r);
    $("hcTbl").innerHTML = '<table class="calc"><thead><tr><th>Year</th><th>Your age</th><th>A bad year costs</th><th>Your own cover</th><th>With employer cover</th></tr></thead><tbody>' +
      Y.yrs.map(function (v, i) { return '<tr><th scope="row">' + (i ? "In " + i + (i > 1 ? " years" : " year") : "Today") + '</th><td data-l="Age">' + (S.age + i) + '</td><td data-l="Bad year">' + short(v) + '</td><td data-l="Own cover"' + (v > Y.mine ? ' class="neg"' : "") + ">" + (v > Y.mine ? "Short " + short(v - Y.mine) : "Enough") + '</td><td data-l="With employer"' + (v > r.withJob ? ' class="neg"' : "") + ">" + (v > r.withJob ? "Short " + short(v - r.withJob) : "Enough") + "</td></tr>"; }).join("") + "</tbody></table>";
    $("hcBarT").textContent = "You need " + short(Y.buy);
    shows.forEach(function (f) { f(); });
  }

  /* ---------- Reports ---------- */
  function say(m) { var s = $("hcStatus"); s.textContent = m; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function spec() {
    var r = last, Y = r.you, need = [], mine = [], job = [];
    var gm = Math.pow(1 + S.infl / 100, 1 / 12);
    for (var m = 0; m <= S.years * 12; m++) { need.push(Y.need0 * Math.pow(gm, m)); mine.push(Y.mine); job.push(r.withJob); }
    var inputs = [["City", { metro: "Metro", big: "Other big city", small: "Smaller town" }[S.city]], ["Adults", String(S.adults)], ["Children", String(S.kids)], ["Age of the eldest adult", String(S.age)],
      ["Cover should stay enough for", S.years + " years"], ["Medical inflation", S.infl + "% a year"], ["Serious illness bill today", inr(S.bill)], ["Second hospital stay today", inr(S.stay)],
      ["Your base policy", inr(S.base)], ["Your super top-up", inr(S.topup)], ["Employer group cover", inr(S.group)], ["Parents to cover", String(S.parents)]]
      .concat(S.parents ? [["Age of the older parent", String(S.pAge)], ["Parents' existing cover", inr(S.pCover)]] : [])
      .concat([["Tax regime", S.regime === "old" ? "Old, " + S.slab + "% slab" : "New"]]);
    return {
      title: "Health Insurance Cover", path: "salarist.in/health-insurance-cover-calculator", url: location.origin + location.pathname, file: "salarist-health-cover",
      question: "How much health insurance cover do I need?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#hcVerdict p"), function (x) { return x.textContent; }).concat(r.par ? [Array.prototype.map.call(document.querySelectorAll("#hcParV p"), function (x) { return x.textContent; }).join(" ")] : []), verdictColor: Y.gap > 0 ? "amber" : "blue",
      inputs: inputs,
      keyNums: [["Your family needs", short(Y.buy), 0], ["Short of own cover", short(Y.gap), -Y.gap], ["Short while employed", S.group ? short(Math.max(0, Y.buy - r.withJob)) : "—", 0], ["Parents need", r.par ? short(r.par.buy) : "—", 0]],
      sensTitle: "Cover you'd need if", sens: r.what.slice(0, 3), sensCurrent: -1,
      chartTitle: "What a bad year costs, by your age", chartNote: "Blue: one serious illness" + (r.people > 1 ? " and one more hospital stay" : "") + ", rising with medical inflation. Amber: your own cover. Green: with your employer's cover.", xlsxChartTitle: "₹ lakh",
      chart: { series: [{ name: "A bad year costs", color: "blue", data: need }, { name: "Your own cover", color: "amber", data: mine }, { name: "With employer cover", color: "green", data: job }], cross: null },
      chartYears: Y.yrs.map(function (v, i) { return S.age + i; }), chartXLabel: "Your age", chartAge0: S.age,
      money: { title: "How the cover adds up", cols: ["Amount", "What it is"], rows: [["Serious illness, today", inr(S.bill), "Private hospital, " + CITY[S.city].name]].concat(r.people > 1 ? [["Second hospital stay, today", inr(S.stay), "Another member, same year"]] : [])
        .concat([["A bad year, today", inr(Y.need0), "", "total"], ["In " + S.years + " years", inr(Y.target), "At " + S.infl + "% a year"], ["Cover you need", inr(Y.buy), "Rounded up to ₹5 lakh", "total"], ["Your own cover", inr(Y.mine), "Base + super top-up"], ["Short by", inr(Y.gap), "", "total"]]
        .concat(Y.gap > 0 ? [["Suggested base policy", inr(Y.base), "Pays smaller bills"], ["Suggested super top-up", inr(Y.top), "Deductible " + inr(Y.ded)]] : [])
        .concat(r.par ? [["Parents need", inr(r.par.buy), "Separate policy"], ["Parents short by", inr(r.par.gap), ""]] : [])), note: r.notes, noteTitle: "What this means for you" },
      tables: [{ title: "Year by year", sheet: "By year", cols: ["Your age", "A bad year costs", "Short of own cover", "Short with employer cover"],
        yearly: Y.yrs.map(function (v, i) { return [S.age + i, v, Math.max(0, v - Y.mine), Math.max(0, v - r.withJob)]; }), monthly: null,
        noteTitle: "How this is worked out", note: ["A bad year = one serious illness (" + inr(S.bill) + " today)" + (r.people > 1 ? " + one more hospital stay (" + inr(S.stay) + ")" : "") + ", grown at " + S.infl + "% a year.", "Your own cover = base policy + super top-up. Employer group cover is shown separately because it ends when you leave the job."] }],
      notes: ["Costs are typical private-hospital figures for your kind of city; change them to what hospitals near you charge.", "Super top-ups pay once total bills in a policy year cross the deductible; the base policy (or employer cover, if the policy allows) pays up to it.",
        "No premium estimates: premiums depend on age, health, city and insurer."],
      taxRules: ["Income-tax Act, 2025, section 126 (old 80D), old regime only: up to ₹25,000 for self, spouse and children (₹50,000 if senior) and ₹25,000 for parents (₹50,000 if senior). Individual health insurance GST-free from 22 Sep 2025."],
      short: short, inr: inr
    };
  }
  function busy(b, on) { b.disabled = on; b.setAttribute("aria-busy", on ? "true" : "false"); }
  $("hcPdf").addEventListener("click", function () { var b = this; busy(b, true); say("Making your PDF…"); withReport(function (Kt) { Kt.pdf(spec()).then(function () { busy(b, false); say("PDF report downloaded."); }, function () { busy(b, false); say("Couldn't make the PDF. Please try again."); }); }); });
  $("hcXlsx").addEventListener("click", function () { var b = this; busy(b, true); withReport(function (Kt) { try { Kt.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(b, false); }); });
  $("hcShare").addEventListener("click", function () {
    var q = new URLSearchParams(); NUM.concat(["city", "adults", "kids", "parents", "regime", "slab"]).forEach(function (k) { q.set(k, S[k]); });
    var t = location.origin + location.pathname + "?" + q.toString();
    function ok() { say("Link copied. Anyone with it sees these numbers."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { say("Couldn't copy. Copy the address bar instead."); }); else say("Copy the address bar to share.");
  });
  (function bar() {
    var el = $("hcBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("hcVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".hcx .lp-setup"));
    $("hcBarBtn").addEventListener("click", function () { $("hcVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
