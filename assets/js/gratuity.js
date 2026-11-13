/* Salarist gratuity calculator. Runs entirely in the browser; nothing is stored or sent. */
(function () {
  "use strict";
  var CAP = 2000000;   /* ₹20 lakh: the ceiling on gratuity under the Code, and the lifetime tax-free limit for private-sector employees */

  /* ---------- Core ---------- */
  function parse(s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addMonths(d, n) { var x = new Date(d.getFullYear(), d.getMonth() + n, d.getDate()); if (x.getDate() !== d.getDate()) x.setDate(0); return x; }
  /* Completed years, plus months and days beyond them. */
  function service(join, leave) {
    var j = parse(join), l = parse(leave), y = 0, m = 0;
    if (!(l > j)) return { y: 0, m: 0, d: 0, ok: false };
    while (addMonths(j, (y + 1) * 12) <= l) y++;
    while (addMonths(j, y * 12 + m + 1) <= l) m++;
    var from = addMonths(j, y * 12 + m), d = Math.round((l - from) / 864e5);
    return { y: y, m: m, d: d, ok: true };
  }
  /* Years counted: a part-year of more than six months counts as a full year (covered employees). */
  function counted(sv, covered) { return covered ? sv.y + ((sv.m > 6 || (sv.m === 6 && sv.d > 0)) ? 1 : 0) : sv.y; }
  /* Wages under the Code: basic + DA, but if excluded pay is more than half the total, the excess is added back, so wages are at least half of total pay. */
  function wagesNew(basic, total) { return Math.max(basic, total / 2); }
  /* o: {type: "permanent"|"fixed", reason: "leave"|"death", employer: "covered"|"notcovered"|"govt", basic, total, avg10, join, leave, earlier} */
  function calc(o) {
    var sv = service(o.join, o.leave), cov = o.employer !== "notcovered";
    var need = o.reason === "death" ? 0 : o.type === "fixed" ? 1 : 5;
    var eligible = sv.ok && sv.y >= need && (o.reason !== "death" || sv.y + sv.m + sv.d > 0);
    var yrs = counted(sv, cov), w = cov ? wagesNew(o.basic, o.total) : o.basic;
    var raw = w * 15 / 26 * yrs, rawOld = o.basic * 15 / 26 * yrs;
    var grat = eligible ? Math.min(raw, CAP) : 0, gratOld = eligible ? Math.min(rawOld, CAP) : 0;
    var room = Math.max(0, CAP - o.earlier), exempt, formula;
    if (o.employer === "govt") { exempt = grat; formula = grat; }
    else if (cov) { formula = grat; exempt = Math.min(grat, formula, room); }
    else { formula = (o.avg10 || o.basic) / 2 * sv.y; exempt = Math.min(grat, formula, room); }
    var eligibleOn = null;
    if (!eligible && sv.ok && need > 0) eligibleOn = addMonths(parse(o.join), need * 12);
    return { sv: sv, yrs: yrs, need: need, eligible: eligible, eligibleOn: eligibleOn, wages: w, raw: raw, grat: grat, gratOld: gratOld, capped: raw > CAP,
             room: room, exempt: exempt, taxable: Math.max(0, grat - exempt), formula: formula };
  }
  /* The next date on which the counted years go up, and what that adds. */
  function nextStep(o) {
    var base = calc(o), j = parse(o.join), l = parse(o.leave), sv = base.sv;
    if (!sv.ok) return null;
    var cov = o.employer !== "notcovered";
    var past = sv.m > 6 || (sv.m === 6 && sv.d > 0);   /* already past the half-year, so the next step is in the following year */
    var target = cov ? new Date(addMonths(j, (sv.y + (past ? 1 : 0)) * 12 + 6).getTime() + 864e5) : addMonths(j, (sv.y + 1) * 12);
    if (!base.eligible && base.eligibleOn) target = base.eligibleOn > target ? base.eligibleOn : target;
    var iso = target.getFullYear() + "-" + ("0" + (target.getMonth() + 1)).slice(-2) + "-" + ("0" + target.getDate()).slice(-2);
    var after = calc(Object.assign({}, o, { leave: iso }));
    return { date: target, days: Math.round((target - l) / 864e5), gain: after.grat - base.grat, after: after };
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { service: service, counted: counted, wagesNew: wagesNew, calc: calc, nextStep: nextStep, CAP: CAP }; return; }

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
  function dtxt(d) { return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  function iso(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function svTxt(sv) { return sv.y + (sv.y === 1 ? " year" : " years") + (sv.m ? ", " + sv.m + (sv.m === 1 ? " month" : " months") : "") + (sv.d ? ", " + sv.d + (sv.d === 1 ? " day" : " days") : ""); }
  var today = new Date(), T = iso(today);
  var S = { type: "permanent", reason: "leave", employer: "covered", basic: 50000, total: 120000, avg10: 50000, join: iso(new Date(today.getFullYear() - 7, today.getMonth() - 3, today.getDate())), leave: T, earlier: 0 };
  var FIELDS = { basic: [0, 100000000, 500], total: [0, 100000000, 500], avg10: [0, 100000000, 500], earlier: [0, 2000000, 1000] };
  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    Object.keys(FIELDS).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= FIELDS[k][0] && v <= FIELDS[k][1]) S[k] = v; });
    if (q.get("type") === "fixed") S.type = "fixed";
    if (q.get("reason") === "death") S.reason = "death";
    if (["covered", "notcovered", "govt"].indexOf(q.get("employer")) > -1) S.employer = q.get("employer");
    ["join", "leave"].forEach(function (k) { if (/^\d{4}-\d{2}-\d{2}$/.test(q.get(k) || "")) S[k] = q.get(k); });
  })();
  function bindField(k) {
    var num = $("gr-" + k), note = $("gr-" + k + "-w");
    function show() { num.value = fmt.format(S[k]); if (note) note.textContent = words(S[k]); }
    num.addEventListener("input", function () {
      var raw = this.value.replace(/[^0-9]/g, ""); this.value = raw ? fmt.format(+raw) : "";
      S[k] = Math.max(FIELDS[k][0], Math.min(FIELDS[k][1], +raw || 0)); if (note) note.textContent = words(S[k]); render();
    });
    num.addEventListener("blur", show); show();
  }
  Object.keys(FIELDS).forEach(bindField);
  ["join", "leave"].forEach(function (k) { var el = $("gr-" + k); el.value = S[k]; el.addEventListener("change", function () { if (/^\d{4}-\d{2}-\d{2}$/.test(this.value)) { S[k] = this.value; render(); } }); });
  function seg(attr, key) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.addEventListener("click", function () { S[key] = b.getAttribute("data-" + attr); render(); }); }); }
  seg("type", "type"); seg("reason", "reason"); seg("employer", "employer");
  function pressed(attr, val) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-" + attr) === val ? "true" : "false"); }); }

  function chart() {
    var maxY = Math.max(10, last.r.yrs + 5), pts = [], ptsOld = [], W = 420, Hh = 250, pl = 54, pr = 16, pt = 24, pb = 26;
    for (var y = 0; y <= maxY; y++) { pts.push(Math.min(CAP, last.r.wages * 15 / 26 * y)); ptsOld.push(Math.min(CAP, S.basic * 15 / 26 * y)); }
    var max = Math.max.apply(null, pts.concat(ptsOld)) || 1, st = Math.pow(10, Math.floor(Math.log10(max / 4))), q = max / 4 / st; st *= q <= 1 ? 1 : q <= 2 ? 2 : q <= 2.5 ? 2.5 : q <= 5 ? 5 : 10; max = st * 4;
    function x(i) { return pl + i / maxY * (W - pl - pr); }
    function yy(v) { return pt + (max - v) / max * (Hh - pt - pb); }
    function path(a) { return a.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(v).toFixed(1); }).join(""); }
    var grid = ""; for (var k = 0; k <= 4; k++) { var v = max * k / 4, gy = yy(v).toFixed(1); grid += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+gy + 3) + '" class="al" text-anchor="end">' + short(v) + "</text>"; }
    var step = maxY > 20 ? 5 : 2, xl = ""; for (var t = 0; t <= maxY; t += step) xl += '<text x="' + x(t).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">' + t + " yrs</text>";
    var mk = last.r.eligible ? '<circle cx="' + x(last.r.yrs).toFixed(1) + '" cy="' + yy(pts[last.r.yrs]).toFixed(1) + '" r="5" class="cx"/>' : "";
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Gratuity by years of service">' + grid + xl + '<path d="' + path(ptsOld) + '" class="ln buy"/><path d="' + path(pts) + '" class="ln rent"/>' + mk + "</svg>";
  }

  var last = null;
  function render() {
    pressed("type", S.type); pressed("reason", S.reason); pressed("employer", S.employer);
    var govt = S.employer === "govt", nc = S.employer === "notcovered";
    $("gr-avg-box").hidden = !nc;
    $("gr-earlier-box").hidden = govt;
    var r = calc(S), ns = nextStep(S); last = { r: r, ns: ns };
    $("gr-svc").textContent = r.sv.ok ? "Service: " + svTxt(r.sv) + (r.eligible ? ". Counted as " + r.yrs + (r.yrs === 1 ? " year." : " years.") : ".") : "Your leaving date must be after your joining date.";
    $("gr-wageTxt").textContent = "Wages used: " + inr(r.wages) + " a month" + (r.wages > S.basic ? " (half of your total pay, because your basic + DA is less than half)" : " (your basic + DA)") + ".";
    var v = $("grVerdict");
    if (govt) {
      v.innerHTML = '<p class="k">Government employee</p><p class="v">Your gratuity is <b>fully tax-free</b></p><p class="k">Gratuity for central and state government employees follows their own service rules, not the formula here, so we don\'t estimate the amount. Whatever you receive is not taxed.</p>';
    } else if (!r.sv.ok) {
      v.innerHTML = '<p class="k">Check your dates</p><p class="v">Leaving date is before joining date</p><p class="k">Enter the date you joined and the date you leave (or today).</p>';
    } else if (!r.eligible) {
      v.innerHTML = '<p class="k">' + svTxt(r.sv) + ' of service</p><p class="v">Not eligible <b>yet</b></p><p class="k">' + (S.type === "fixed" ? "Fixed-term employees qualify after 1 year of service under the Code on Social Security, 2020." : "Permanent employees qualify after 5 years of continuous service, unless they leave because of death or disablement.") +
        (r.eligibleOn ? " You qualify on <b>" + dtxt(r.eligibleOn) + "</b>, when your gratuity would be about " + short(ns ? ns.after.grat : 0) + "." : "") + "</p>";
    } else {
      v.innerHTML = '<p class="k">' + svTxt(r.sv) + ", counted as " + r.yrs + (r.yrs === 1 ? " year" : " years") + '</p><p class="v">Your gratuity is about <b>' + short(r.grat) + '</b></p><p class="k">' +
        (r.taxable > 0 ? short(r.exempt) + " of it is tax-free and " + short(r.taxable) + " is taxable." : "All of it is tax-free.") + (r.wages > S.basic ? " Under the old basic + DA rule it would have been " + short(r.gratOld) + "." : "") + (r.capped ? " The legal maximum is ₹20 lakh; your employer may choose to pay more." : "") + "</p>";
    }
    $("grBarT").textContent = govt ? "Fully tax-free" : r.eligible ? "Gratuity " + short(r.grat) : "Not eligible yet";
    $("grGrat").textContent = govt ? "—" : short(r.grat); $("grFree").textContent = govt ? "All" : short(r.exempt); $("grTax").textContent = govt ? "₹0" : short(r.taxable); $("grRoom").textContent = govt ? "No limit" : short(r.room);
    $("grRoomH").textContent = govt ? "Government gratuity has no limit" : (S.earlier > 0 ? "₹20 L lifetime − " + short(S.earlier) + " received earlier. " : "₹20 L lifetime, nothing used yet. ") + "After this payout: " + short(Math.max(0, r.room - r.exempt)) + " left.";
    var sb = $("grStay");
    if (!govt && r.eligible && ns && ns.gain > 0 && ns.days > 0) { sb.hidden = false; sb.innerHTML = "<b>Stay until " + dtxt(ns.date) + "</b> (" + ns.days + (ns.days === 1 ? " more day" : " more days") + ") and your gratuity " + (r.eligible ? "rises by about <b>" + short(ns.gain) + "</b>, to " + short(ns.after.grat) : "becomes payable: about <b>" + short(ns.after.grat) + "</b>") + "."; }
    else sb.hidden = true;
    $("grCmpBox").hidden = govt || nc;
    $("grCmp").innerHTML = govt ? "" : '<div class="sv"><span class="l">Old rule: basic + DA (' + short(S.basic) + ')</span><span class="n">' + short(r.gratOld) + '</span></div><div class="sv cur"><span class="l">Labour codes: wages ' + short(r.wages) + '</span><span class="n">' + short(r.grat) + "</span></div>";
    $("grChartBox").hidden = govt;
    if (!govt) $("grChart").innerHTML = chart();
    $("grNotes").innerHTML = notes().map(function (t) { return "<li>" + t + "</li>"; }).join("");
  }
  function notes() {
    var n = ["Gratuity = last drawn monthly wages × 15 ÷ 26 × years counted, under section 53 of the Code on Social Security, 2020, in force from 21 November 2025. The legal maximum is ₹20 lakh.",
      S.employer === "notcovered" ? "Your employer isn't covered by the Code, so years are counted only in full, and the tax-free part uses half your average monthly salary (last 10 months) × completed years. Your employer may not have to pay gratuity at all; check your policy." :
        "A part-year of more than six months counts as a full year.",
      "Wages are basic + DA (and retaining allowance). If your other allowances are more than half your total pay, the excess counts as wages, so wages are at least half of total pay. We use the total monthly pay you enter for this.",
      "How service before 21 November 2025 is treated under the new wage rule is still being clarified. Some employers use the old basic + DA for those years; we show both figures.",
      "For employees covered by gratuity law, the tax rule (section 19 of the Income-tax Act, 2025, Table S. No. 5) still refers to the Payment of Gratuity Act, 1972, which the Code replaced. Whether the extra gratuity from the new wage rule is fully tax-free hasn't been clarified. We show it as tax-free, up to the limit.",
      "The ₹20 lakh tax-free limit is for your whole career, across all employers, under section 19 of the Income-tax Act, 2025 (earlier section 10(10)). It applies under both tax regimes. Taxable gratuity is added to your salary and taxed at your slab rate."];
    return n;
  }

  /* ---------- Reports ---------- */
  function say(msg) { var s = $("grStatus"); s.textContent = msg; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function spec() {
    var r = last.r, maxY = Math.max(10, r.yrs + 5), cats = [], A = [], B = [], rows = [];
    for (var y = 0; y <= maxY; y++) { cats.push(y); A.push(Math.min(CAP, r.wages * 15 / 26 * y)); B.push(Math.min(CAP, S.basic * 15 / 26 * y)); if (y) rows.push([String(y), B[y], A[y]]); }
    /* report-kit charts by month; spread the yearly points across 12-month steps */
    function monthly(arr) { var o = []; arr.forEach(function (v, i) { if (i === 0) { o.push(v); return; } var p = arr[i - 1]; for (var m = 1; m <= 12; m++) o.push(p + (v - p) * m / 12); }); return o; }
    var ET = { covered: "Private, covered by the Code", notcovered: "Private, not covered by the Code", govt: "Government" };
    return {
      title: "Gratuity Calculator Report", path: "salarist.in/gratuity-calculator", url: location.origin + location.pathname, file: "salarist-gratuity-calculator",
      question: "How much gratuity will I get?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#grVerdict p"), function (p) { return p.textContent; }), verdictColor: "blue",
      inputs: [["Employment", S.type === "fixed" ? "Fixed-term" : "Permanent"], ["Reason for leaving", S.reason === "death" ? "Death or disablement" : "Resigning or retiring"], ["Employer", ET[S.employer]],
        ["Joined", dtxt(parse(S.join))], ["Leaving", dtxt(parse(S.leave))], ["Service", svTxt(r.sv)], ["Years counted", String(r.yrs)],
        ["Basic + DA a month", inr(S.basic), S.basic], ["Total pay a month", inr(S.total), S.total], ["Wages used", inr(r.wages), r.wages], ["Gratuity already received earlier (whole career)", inr(S.earlier), S.earlier]],
      keyNums: [["Gratuity", short(r.grat), r.grat], ["Tax-free", short(r.exempt), r.exempt], ["Taxable", short(r.taxable), r.taxable], ["Tax-free limit available", short(r.room), r.room]],
      sensTitle: "Old rule vs labour codes",
      sens: [["Old rule: basic + DA", short(r.gratOld)], ["Labour codes: wages", short(r.grat)]], sensCurrent: 1,
      chartTitle: "Gratuity by years of service", chartNote: "At your current wages, up to the ₹20 lakh maximum.", xlsxChartTitle: "Gratuity (₹ lakh)",
      chart: { series: [{ name: "Labour codes", color: "blue", data: monthly(A) }, { name: "Old rule", color: "amber", data: monthly(B) }], cross: null }, chartYears: cats,
      money: { title: "Your gratuity", cols: ["Old rule", "Labour codes"], rows: [["Gratuity", r.gratOld, r.grat, "total"], ["Tax-free", Math.min(r.gratOld, r.room), r.exempt], ["Taxable", Math.max(0, r.gratOld - Math.min(r.gratOld, r.room)), r.taxable]], note: last.ns && last.ns.gain > 0 ? $("grStay").textContent : "" },
      tables: [{ title: "Gratuity by years counted", sheet: "By years", cols: ["Years counted", "Old rule", "Labour codes"], yearly: rows, monthly: null }],
      notes: notes(), taxRules: ["Gratuity up to ₹20 lakh over your whole career is tax-free for private-sector employees, under section 19 of the Income-tax Act, 2025 (earlier section 10(10)), under both regimes. Government employees' gratuity is fully tax-free."],
      short: short, inr: inr
    };
  }
  function busy(btn, on) { btn.disabled = on; btn.setAttribute("aria-busy", on ? "true" : "false"); }
  $("grPdf").addEventListener("click", function () {
    if (S.employer === "govt") return say("Reports aren't available for government employees, whose gratuity follows their own rules.");
    var btn = this; busy(btn, true); say("Making your PDF…");
    withReport(function (K) { K.pdf(spec()).then(function () { busy(btn, false); say("PDF report downloaded."); }, function () { busy(btn, false); say("Couldn't make the PDF. Please try again."); }); });
  });
  $("grXlsx").addEventListener("click", function () {
    if (S.employer === "govt") return say("Reports aren't available for government employees, whose gratuity follows their own rules.");
    var btn = this; busy(btn, true);
    withReport(function (K) { try { K.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(btn, false); });
  });
  function copy(text, ok) {
    function fb() { var t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); var r = false; try { r = document.execCommand("copy"); } catch (e) {} t.remove(); say(r ? ok : "Couldn't copy. Select the text and copy it yourself."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { say(ok); }, fb); else fb();
  }
  $("grShare").addEventListener("click", function () {
    var q = new URLSearchParams(); Object.keys(FIELDS).forEach(function (k) { q.set(k, S[k]); }); ["type", "reason", "employer", "join", "leave"].forEach(function (k) { q.set(k, S[k]); });
    copy(location.origin + location.pathname + "?" + q.toString(), "Link copied. Anyone with it sees these numbers.");
  });
  (function bar() {
    var el = $("grBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("grVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".gr .lp-setup"));
    $("grBarBtn").addEventListener("click", function () { $("grVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
