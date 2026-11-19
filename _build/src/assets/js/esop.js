/* Salarist ESOP and RSU tax calculator. Runs entirely in the browser; nothing is stored or sent.
   Income-tax Act, 2025: perquisite on specified security or sweat equity, section 17(1)(d), taxed as salary in the year of exercise (ESOP) or vesting (RSU);
   capital gains on sale, cost = value taxed as the perquisite: listed in India (STT paid) section 196 (20%, up to 12 months) / section 198 (12.5% above ₹1.25 lakh);
   foreign or unlisted shares: up to 24 months at slab rates, longer section 197 (12.5%, no indexation). Eligible start-ups: tax on the perquisite deferred under
   section 392(3) read with section 289(3) to the earliest of 60 months from the end of the tax year, sale, or leaving the company.
   Tax from the NPS calculator's code (nps.js newTax: new regime, rebate, surcharge, 4% cess). */
(function () {
  "use strict";
  var NODE = typeof module !== "undefined" && module.exports;
  var NPS = NODE ? require("./nps.js") : window.SalaristNPS;
  var SD = 75000, CESS = 1.04, LTCG_FREE = 125000;

  function scCG(total) { return total > 10000000 ? 0.15 : total > 5000000 ? 0.10 : 0; }   /* surcharge on special-rate gains is capped at 15% */
  /* o: {kind: "rsu"|"esop", co: "in"|"abroad"|"unlisted", shares, strike (₹ a share, ESOP), fmv (₹ a share on exercise or vest), salary (other taxable pay a year),
         sale (₹ a share), held (months from exercise/vest to sale), used (long-term gains already used of the ₹1.25 lakh this year), startup (true/false), on ("YYYY-MM" of vesting or exercise),
         saleSalary (other taxable pay in the tax year of the sale, if that's a later year), leave (true/false: you leave the company before selling), leaveAt (months from vesting/exercise to leaving).
         (old note: tyEnd = year the tax year of exercise ends, e.g. 2027)} */
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function addM(d, m) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + Math.round(m), Math.min(d.getUTCDate(), 28))); }
  function addD(d, n) { return new Date(d.getTime() + n * 864e5); }
  function fmtD(d) { return d.getUTCDate() + " " + MON[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
  function fmtM(d) { return MON[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
  function tyOf(d) { return d.getUTCMonth() >= 3 ? d.getUTCFullYear() + 1 : d.getUTCFullYear(); }   /* year the tax year ends */
  function tyLabel(e) { return (e - 1) + "-" + String(e).slice(2); }
  function calc(o) {
    var on = /^(\d{4})-(\d{2})$/.exec(o.on || "") || [0, 2026, 7], ex = new Date(Date.UTC(+on[1], +on[2] - 1, 15));
    var saleD = addM(ex, o.held), leaveD = o.leave ? addM(ex, Math.min(o.leaveAt, o.held)) : null;
    var tyEx = tyOf(ex), later = tyOf(saleD) > tyEx;
    o = Object.assign({}, o, { tyEnd: tyEx, later: later });
    var n = Math.max(0, o.shares), strike = o.kind === "rsu" ? 0 : o.strike, perq = Math.max(0, (o.fmv - strike) * n);
    var base = Math.max(0, o.salary - SD);
    var perqTax = NPS.newTax(base + perq) - NPS.newTax(base);
    var perqRate = perq ? perqTax / perq : 0;
    var limit = o.co === "in" ? 12 : 24, long = o.held > limit;
    var saleBase = later ? Math.max(0, o.saleSalary - SD) : base + perq;
    var gain = (o.sale - o.fmv) * n, cg = sale(o, gain, long, saleBase);
    var proceeds = o.sale * n, paid = strike * n;
    var kept = proceeds - paid - perqTax - cg.tax;
    var cover = o.kind === "rsu" && o.fmv > 0 ? Math.ceil(perqTax / o.fmv) : 0;
    var defer = null;
    if (o.startup && o.kind === "esop" && o.co === "unlisted") {
      var outer = new Date(Date.UTC(tyEx + 5, 2, 31)), trig = [[outer, "60 months from the end of tax year " + tyLabel(tyEx)], [saleD, "the sale"]];
      if (leaveD) trig.push([leaveD, "leaving the company"]);
      trig.sort(function (a, b) { return a[0] - b[0]; });
      defer = { end: fmtD(outer), by: fmtD(addD(trig[0][0], 14)), why: trig[0][1], ty: tyLabel(tyEx), outerBy: fmtD(addD(outer, 14)) };
    }
    return { n: n, strike: strike, perq: perq, perqTax: perqTax, perqRate: perqRate, limit: limit, long: long, gain: gain, cg: cg, proceeds: proceeds, paid: paid, kept: kept,
             cover: cover, defer: defer, value: o.fmv * n, totalTax: perqTax + cg.tax,
             other: sale(o, gain, !long, saleBase), later: later, saleTy: tyLabel(tyOf(saleD)), exTy: tyLabel(tyEx), saleM: fmtM(saleD), leaveM: leaveD ? fmtM(leaveD) : "" };   /* the same sale on the other side of the holding line */
  }
  function sale(o, gain, long, before) {
    if (gain === 0) return { tax: 0, type: "No gain", rate: 0, free: 0, loss: 0 };
    if (gain < 0) return { tax: 0, type: long ? "Long-term loss" : "Short-term loss", rate: 0, free: 0, loss: -gain };
    if (o.co === "in") {
      if (long) { var free = Math.max(0, Math.min(gain, LTCG_FREE - o.used)), t = (gain - free) * 0.125; return { tax: t * (1 + scCG(before + gain)) * CESS, type: "Long-term, 12.5% above ₹1.25 lakh (section 198)", rate: 12.5, free: free, loss: 0 }; }
      return { tax: gain * 0.20 * (1 + scCG(before + gain)) * CESS, type: "Short-term, 20% (section 196)", rate: 20, free: 0, loss: 0 };
    }
    if (long) return { tax: gain * 0.125 * (1 + scCG(before + gain)) * CESS, type: "Long-term, 12.5% (section 197)", rate: 12.5, free: 0, loss: 0 };
    var st = NPS.newTax(before + gain) - NPS.newTax(before);
    return { tax: st, type: "Short-term, at your slab rate", rate: gain ? st / gain * 100 : 0, free: 0, loss: 0 };
  }
  var API = { calc: calc };
  if (NODE) { module.exports = API; return; }
  window.SalaristEsop = API;
  if (!document.getElementById("soVerdict")) return;

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
  var CO = { "in": "listed in India", abroad: "listed abroad (for example in the US)", unlisted: "unlisted (a private company or start-up)" };
  var COA = { "in": "a company listed in India", abroad: "a company listed abroad", unlisted: "an unlisted company" };
  var S = { kind: "rsu", co: "abroad", shares: 100, strike: 0, fmv: 17500, salary: 4000000, sale: 21000, held: 14, used: 0, startup: "no", on: "2026-07", saleSalary: 4000000, leave: "no", leaveAt: 6 };
  var LIM = { shares: [0, 1e8], strike: [0, 1e8], fmv: [0, 1e8], salary: [0, 1e10], sale: [0, 1e8], held: [0, 600], used: [0, 125000], saleSalary: [0, 1e10], leaveAt: [0, 600] };
  var MONEY = { strike: 1, fmv: 1, salary: 1, sale: 1, used: 1, saleSalary: 1 };
  var NUM = ["shares", "strike", "fmv", "salary", "sale", "held", "used", "saleSalary", "leaveAt"];
  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    NUM.forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= LIM[k][0] && v <= LIM[k][1]) S[k] = v; });
    if (q.get("kind") === "esop") S.kind = "esop"; if (["in", "abroad", "unlisted"].indexOf(q.get("co")) > -1) S.co = q.get("co"); if (q.get("startup") === "yes") S.startup = "yes"; if (q.get("leave") === "yes") S.leave = "yes";
    var on = q.get("on"); if (on && /^20\d\d-(0[1-9]|1[0-2])$/.test(on)) S.on = on;
  })();
  var shows = [];
  function bind(k) {
    var el = $("so-" + k), note = $("so-" + k + "-w"); if (!el) return;
    function show() { el.value = MONEY[k] ? fmt.format(S[k]) : String(S[k]); if (note) note.textContent = MONEY[k] ? words(S[k]) : ""; }
    el.addEventListener("input", function () {
      var raw = MONEY[k] ? this.value.replace(/[^0-9]/g, "") : this.value.replace(/[^0-9.]/g, "");
      if (MONEY[k]) this.value = raw ? fmt.format(+raw) : "";
      var v = parseFloat(raw); if (!isFinite(v)) { if (raw === "") { S[k] = 0; render(); } return; }
      if (v < LIM[k][0] || v > LIM[k][1]) return;
      S[k] = v; if (note) note.textContent = MONEY[k] ? words(v) : ""; render();
    });
    el.addEventListener("blur", show); shows.push(function () { if (document.activeElement !== el) show(); }); show();
  }
  NUM.forEach(bind);
  $("so-on").value = S.on; $("so-on").addEventListener("change", function () { if (/^20\d\d-\d\d$/.test(this.value)) { S.on = this.value; render(); } });
  document.querySelectorAll("[data-leave]").forEach(function (b) { b.addEventListener("click", function () { S.leave = b.getAttribute("data-leave"); render(); }); });
  document.querySelectorAll("[data-kind]").forEach(function (b) { b.addEventListener("click", function () { S.kind = b.getAttribute("data-kind"); if (S.kind === "rsu") S.startup = "no"; render(); }); });
  document.querySelectorAll("[data-co]").forEach(function (b) { b.addEventListener("click", function () { S.co = b.getAttribute("data-co"); render(); }); });
  document.querySelectorAll("[data-startup]").forEach(function (b) { b.addEventListener("click", function () { S.startup = b.getAttribute("data-startup"); render(); }); });
  function opts(ch) { var o = { kind: S.kind, co: S.co, shares: S.shares, strike: S.strike, fmv: S.fmv, salary: S.salary, sale: S.sale, held: S.held, used: S.used, startup: S.startup === "yes", on: S.on, saleSalary: S.saleSalary, leave: S.leave === "yes", leaveAt: S.leaveAt }; return ch ? ch(o) || o : o; }
  var last = null, STEPS = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  function curve(longTerm) { return STEPS.map(function (p) { return calc(opts(function (o) { o.sale = o.fmv * (1 + p / 100); o.held = longTerm ? Math.max(o.held, (o.co === "in" ? 12 : 24) + 1) : Math.min(o.held, o.co === "in" ? 12 : 24); })).kept; }); }
  function chart(A, B) {
    var n = STEPS.length - 1, W = 420, Hh = 230, pl = 54, pr = 12, pt = 16, pb = 26;
    var all = A.concat(B), mx = Math.max.apply(null, all), mn = Math.min(0, Math.min.apply(null, all)), span = mx - mn || 1;
    var st = Math.pow(10, Math.floor(Math.log10(span / 4))), qq = span / 4 / st; st *= qq <= 1 ? 1 : qq <= 2 ? 2 : qq <= 2.5 ? 2.5 : qq <= 5 ? 5 : 10;
    mn = Math.floor(mn / st) * st; mx = mn + st * Math.ceil((mx - mn) / st);
    function x(i) { return pl + i / n * (W - pl - pr); } function yy(v) { return pt + (mx - v) / (mx - mn) * (Hh - pt - pb); }
    var g = ""; for (var v = mn; v <= mx + 1; v += st) { var gy = yy(v).toFixed(1); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+gy + 3) + '" class="al" text-anchor="end">' + short(v) + "</text>"; }
    var xl = ""; STEPS.forEach(function (p, i) { if (p % 50 === 0) xl += '<text x="' + x(i).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">' + (p > 0 ? "+" : "") + p + "%</text>"; });
    var z = STEPS.indexOf(0), zl = '<line x1="' + x(z).toFixed(1) + '" x2="' + x(z).toFixed(1) + '" y1="' + pt + '" y2="' + (Hh - pb) + '" class="gl" stroke-dasharray="4 4"/>';
    function path(L) { return L.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(v).toFixed(1); }).join(""); }
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="What you keep at different sale prices, short-term and long-term">' + g + xl + zl + '<path d="' + path(A) + '" class="ln buy"/><path d="' + path(B) + '" class="ln rent"/></svg>';
  }
  function render() {
    if (S.co !== "unlisted" || S.kind !== "esop") S.startup = "no";
    document.querySelectorAll("[data-kind]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-kind") === S.kind ? "true" : "false"); });
    document.querySelectorAll("[data-co]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-co") === S.co ? "true" : "false"); });
    document.querySelectorAll("[data-startup]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-startup") === S.startup ? "true" : "false"); });
    document.querySelectorAll("[data-leave]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-leave") === S.leave ? "true" : "false"); });
    var esop = S.kind === "esop";
    $("soStrikeF").hidden = !esop; $("soStartF").hidden = !(esop && S.co === "unlisted"); $("soLeaveAtF").hidden = S.leave !== "yes";
    $("soUsedF").hidden = S.co !== "in";
    $("so-fmvLbl").firstChild.nodeValue = esop ? "Value a share on the exercise date" : "Value a share on the vesting date";
    $("so-heldLbl").firstChild.nodeValue = esop ? "Months from exercise to sale" : "Months from vesting to sale";
    var r = calc(opts()); last = r; var ev = esop ? "exercise" : "vesting";
    $("soSaleSalF").hidden = !r.later; $("so-saleSalaryLbl").firstChild.nodeValue = "Other taxable pay in tax year " + r.saleTy;
    $("so-onLbl").firstChild.nodeValue = esop ? "Month you exercise" : "Month they vest";
    $("so-salaryLbl").firstChild.nodeValue = "Other taxable pay in tax year " + r.exTy;
    $("so-leaveAtLbl").firstChild.nodeValue = "Months from " + ev + " to leaving";
    $("soVerdict").className = "verdict" + (r.gain < 0 ? " short" : "");
    $("soVerdict").innerHTML = '<p class="k">' + r.n + " " + (esop ? "ESOP shares" : "RSUs") + " in " + COA[S.co] + ", sold for " + short(r.proceeds) + " after " + S.held + " months</p>" +
      '<p class="v">You keep <b>' + short(r.kept) + "</b> after " + short(r.totalTax) + " of tax" + (esop ? " and " + short(r.paid) + " paid to exercise" : "") + "</p>" +
      '<p class="k">' + short(r.perqTax) + " on " + ev + " (taxed as salary on " + short(r.perq) + ")" + (r.defer ? ", due by " + r.defer.by + " (on " + r.defer.why + ")" : "") + ", and " +
      (r.gain > 0 ? short(r.cg.tax) + " on the " + short(r.gain) + " gain when you sell (" + r.cg.type.toLowerCase().replace(/ \(section.*\)/, "") + ")." : r.gain < 0 ? "no capital gains tax: a loss of " + short(-r.gain) + " to set off against other capital gains." : "no capital gains tax, as there's no gain.") + "</p>";
    $("soS1").textContent = short(r.perq); $("soS1h").textContent = "Taxed as salary on " + ev + (esop ? " (value less exercise price)" : " (full value)");
    $("soS2").textContent = short(r.perqTax); $("soS2h").textContent = "Extra income tax on it, about " + Math.round(r.perqRate * 100) + "% of the value";
    $("soS3").textContent = short(r.cg.tax); $("soS3h").textContent = r.gain > 0 ? r.cg.type : (r.gain < 0 ? "Capital loss " + short(-r.gain) : "No gain");
    $("soS4").textContent = short(r.kept); $("soS4h").textContent = "Kept from " + short(r.proceeds) + " of sale proceeds";
    var notes = [];
    notes.push("<b>Two tax points:</b> on " + ev + ", " + short(r.perq) + " is added to your salary and taxed at your slab (your employer deducts TDS). When you sell, only the rise above " + inr(S.fmv) + " a share is a capital gain; the " + ev + " value is your cost.");
    notes.push("<b>Holding period:</b> " + (S.co === "in" ? "shares listed in India become long-term after 12 months from " + ev + ": 20% before, 12.5% above ₹1.25 lakh a year after." : "foreign and unlisted shares become long-term only after 24 months from " + ev + ": slab rate before, 12.5% after.") +
      (r.gain > 0 && r.long !== true ? " Held past " + r.limit + " months at the same price, the tax on the sale would be " + short(r.other.tax) + " instead of " + short(r.cg.tax) + "." : ""));
    if (r.cover) notes.push("<b>Sell to cover:</b> many employers sell part of the vest to pay the TDS. At this value that's about " + r.cover + " of your " + r.n + " shares; some deduct at a flat higher rate, and the difference comes back when you file.");
    if (S.co === "abroad") notes.push("<b>Foreign shares:</b> report them in Schedule FA of your return every year you hold them, even below ₹20 lakh. Tax the employer's country withheld on dividends can be claimed back with Form 67.");
    if (r.defer) notes.push("<b>Start-up deferral:</b> for an eligible start-up, tax on the perquisite is paid within 14 days of the earliest of: 60 months from the end of tax year " + r.defer.ty + " (" + r.defer.end + "), the sale, or the day you leave the company, at the rates of tax year " + r.defer.ty + ". Here that's " + r.defer.why + ": by " + r.defer.by + "." + (S.leave === "yes" ? " Leaving ends the deferral even if you keep the shares and can't sell them yet." : ""));
    if (S.leave === "yes") notes.push("<b>Leaving in " + r.leaveM + ":</b> shares you already hold stay yours, and leaving doesn't change the tax when you sell; the " + r.limit + "-month clock keeps running. Unvested RSUs and options usually lapse; vested options must normally be exercised within your plan's exit window, and are still taxed as salary from your former employer when you do." + (r.later ? " If you take a break, set your pay in the year you sell lower: short-term gains on foreign or unlisted shares are taxed at that year's slab." : ""));
    else notes.push("<b>Leaving the company?</b> Your vested shares stay yours. Switch on \"Leave before selling\" to see what changes" + (S.co === "unlisted" && esop ? ", including when start-up deferred tax falls due." : "."));
    if (r.later) notes.push("<b>Sale year:</b> " + ev + " falls in tax year " + r.exTy + ", the sale in " + r.saleTy + " (" + r.saleM + "), so the sale is taxed with your other pay in " + r.saleTy + ".");
    if (S.co === "unlisted" && !r.defer) notes.push("<b>Unlisted shares:</b> the value is a merchant banker's valuation, and you may not be able to sell until a buyback or listing, but tax on the perquisite is due in the year of " + ev + " unless the start-up deferral applies.");
    $("soRule").innerHTML = notes.join("<br><br>");
    function alt(ch) { return short(calc(opts(ch)).kept); }
    r.what = [["Sell on the " + ev + " day", alt(function (o) { o.sale = o.fmv; o.held = 0; })], ["Price 30% lower when you sell", alt(function (o) { o.sale = o.fmv * 0.7; })],
      ["Held past " + r.limit + " months", alt(function (o) { o.held = r.limit + 1; })], ["Sold in a later year with no other pay", alt(function (o) { o.held = Math.max(o.held, 13); o.saleSalary = 0; })]];
    $("soSens").innerHTML = r.what.map(function (w) { return '<div class="sv"><span class="l">' + w[0] + '</span><span class="n">' + w[1] + "</span></div>"; }).join("");
    r.cs = curve(false); r.cl = curve(true);
    $("soChart").innerHTML = chart(r.cs, r.cl);
    var st = r.long ? r.other : r.cg, lt = r.long ? r.cg : r.other;
    $("soCmp").innerHTML = '<table class="calc"><thead><tr><th>At ' + inr(S.sale) + ' a share</th><th>Sold within ' + r.limit + ' months</th><th>Sold after ' + r.limit + ' months</th></tr></thead><tbody>' +
      [["Sale proceeds", r.proceeds, r.proceeds], ["Paid to exercise", -r.paid, -r.paid], ["Tax on " + ev, -r.perqTax, -r.perqTax], ["Capital gain", r.gain, r.gain], ["Tax on the sale", -st.tax, -lt.tax],
       ["You keep", r.proceeds - r.paid - r.perqTax - st.tax, r.proceeds - r.paid - r.perqTax - lt.tax, "tot"]]
        .map(function (x) { return "<tr" + (x[3] ? ' class="tot"' : "") + '><th scope="row">' + x[0] + '</th><td data-l="Within">' + inr(x[1]) + '</td><td data-l="After">' + inr(x[2]) + "</td></tr>"; }).join("") + "</tbody></table>";
    $("soBarT").textContent = "You keep " + short(r.kept);
    shows.forEach(function (f) { f(); });
  }

  /* ---------- Reports ---------- */
  function say(m) { var s = $("soStatus"); s.textContent = m; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function spec() {
    var r = last, esop = S.kind === "esop", ev = esop ? "exercise" : "vesting", da = [], db = [];
    STEPS.forEach(function (p, i) { var m = i ? 12 : 1; for (var k = 0; k < m; k++) { da.push(r.cs[i]); db.push(r.cl[i]); } });
    var inputs = [["Type", esop ? "ESOP (options you exercise)" : "RSUs (shares that vest)"], ["Company", CO[S.co]], ["Shares", String(S.shares)]]
      .concat(esop ? [["Exercise price a share", inr(S.strike)]] : []).concat([["Value a share on " + ev, inr(S.fmv)], ["Other taxable pay this year", inr(S.salary)], ["Sale price a share", inr(S.sale)], ["Months from " + ev + " to sale", String(S.held)]])
      .concat(S.co === "in" ? [["Long-term gains already used this year", inr(S.used)]] : []).concat(r.later ? [["Other taxable pay in tax year " + r.saleTy, inr(S.saleSalary)]] : [])
      .concat([["Month of " + ev, S.on], ["Leave before selling", S.leave === "yes" ? "Yes, " + S.leaveAt + " months after " + ev : "No"]])
      .concat(r.defer ? [["Start-up deferral", "Yes: tax due by " + r.defer.by + " (" + r.defer.why + ")"]] : []);
    return {
      title: "ESOP and RSU Tax", path: "salarist.in/esop-rsu-tax-calculator", url: location.origin + location.pathname, file: "salarist-esop-rsu-tax",
      question: "How much tax will I pay on my " + (esop ? "ESOPs" : "RSUs") + ", and what do I keep?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#soVerdict p"), function (x) { return x.textContent; }), verdictColor: "blue",
      inputs: inputs,
      keyNums: [["Taxed as salary", short(r.perq), 0], ["Tax on " + ev, short(r.perqTax), 0], ["Tax on the sale", short(r.cg.tax), 0], ["You keep", short(r.kept), r.kept]],
      sensTitle: "What you'd keep if", sens: r.what.slice(0, 3), sensCurrent: -1,
      chartTitle: "What you keep at different sale prices", chartNote: "Sale price against the " + ev + " value. Blue: sold after " + r.limit + " months (long-term). Amber: sold within " + r.limit + " months (short-term).", xlsxChartTitle: "You keep (₹ lakh)",
      chart: { series: [{ name: "Long-term", color: "blue", data: db }, { name: "Short-term", color: "amber", data: da }], cross: null }, chartYears: STEPS, chartXLabel: "Sale price vs " + ev + " value (%)",
      money: { title: "Your sale", cols: ["Within " + r.limit + " months", "After " + r.limit + " months"], rows: Array.prototype.map.call(document.querySelectorAll("#soCmp tbody tr"), function (tr) { var c = tr.children; return [c[0].textContent, c[1].textContent, c[2].textContent, tr.className === "tot" ? "total" : undefined]; }), note: $("soRule").textContent },
      tables: [{ title: "What you keep by sale price", sheet: "By price", cols: ["Sale price vs " + ev + " value", "Price a share", "Kept, short-term", "Kept, long-term"],
        yearly: STEPS.map(function (p, i) { return [(p > 0 ? "+" : "") + p + "%", S.fmv * (1 + p / 100), r.cs[i], r.cl[i]]; }), monthly: null,
        noteTitle: "How this is worked out", note: ["You keep = sale proceeds − exercise price paid − tax on " + ev + " − tax on the sale. Tax on " + ev + " is the extra income tax on your other pay (new regime, ₹75,000 standard deduction, rebate, surcharge, 4% cess).",
          S.co === "in" ? "Listed in India: short-term 20%, long-term 12.5% above ₹1,25,000 a year (less any already used)." : "Foreign or unlisted: short-term at your slab rate (added to this year's income), long-term 12.5% without indexation. A loss is set off only against capital gains."] }],
      notes: ["Perquisite: value on " + ev + (esop ? " less the exercise price" : "") + ", taxed as salary in the tax year of " + ev + " (section 17(1)(d)); employer deducts TDS (section 392).",
        "Capital gain: sale price less the value taxed on " + ev + "; the holding period runs from " + ev + ".",
        "The sale is taxed with your other pay in its own tax year (the same pay if it's the year of " + ev + "). Foreign values are in rupees at the exchange rates the rules prescribe; check your employer's figures.",
        "Not included: tax withheld abroad (claim with Form 67), dividends, and the old tax regime."],
      taxRules: ["Income-tax Act, 2025: sections 17(1)(d), 392 and 289(3) (start-up deferral, 60 months), 196 (20%), 197 (12.5%), 198 (12.5% above ₹1.25 lakh), 202 (new regime rates), 111 (capital losses carried forward 8 years)."],
      short: short, inr: inr
    };
  }
  function busy(b, on) { b.disabled = on; b.setAttribute("aria-busy", on ? "true" : "false"); }
  $("soPdf").addEventListener("click", function () { var b = this; busy(b, true); say("Making your PDF…"); withReport(function (Kt) { Kt.pdf(spec()).then(function () { busy(b, false); say("PDF report downloaded."); }, function () { busy(b, false); say("Couldn't make the PDF. Please try again."); }); }); });
  $("soXlsx").addEventListener("click", function () { var b = this; busy(b, true); withReport(function (Kt) { try { Kt.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(b, false); }); });
  $("soShare").addEventListener("click", function () {
    var q = new URLSearchParams(); NUM.concat(["kind", "co", "startup", "on", "leave"]).forEach(function (k) { q.set(k, S[k]); });
    var t = location.origin + location.pathname + "?" + q.toString();
    function ok() { say("Link copied. Anyone with it sees these numbers."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { say("Couldn't copy. Copy the address bar instead."); }); else say("Copy the address bar to share.");
  });
  (function bar() {
    var el = $("soBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("soVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".sox .lp-setup"));
    $("soBarBtn").addEventListener("click", function () { $("soVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
