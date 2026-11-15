/* Salarist term insurance cover calculator. Runs entirely in the browser; nothing is stored or sent. */
(function () {
  "use strict";
  /* ---------- Core ---------- */
  /* o: {age, years (years your family needs support), expenses (family's monthly expenses without you, today's money), spouse (spouse's income a month, today's money),
         infl, ret (return on the payout once invested), edu (child's education cost today), eduIn (years until), wed (other goal today), wedIn (years until), goalInfl,
         loans (loans left), loanYears (years left on them), buffer (bool: 6 months' expenses), savings (investments your family could use), cover (existing personal life cover),
         income (your yearly income, for the rule-of-thumb check)} */
  function need(o, t) {   /* cover needed t years from now */
    var yrs = Math.max(0, o.years - t), r = o.ret / 100, fi = 1 + o.infl / 100, gi = 1 + o.goalInfl / 100;
    var net = Math.max(0, o.expenses - o.spouse) * 12 * Math.pow(fi, t), inc = 0;
    for (var k = 0; k < yrs; k++) inc += net * Math.pow(fi / (1 + r), k);
    function goal(cost, inYrs) { var n = inYrs - t; return n < 0 ? 0 : cost * Math.pow(gi, inYrs) / Math.pow(1 + r, n); }
    var goals = goal(o.edu, o.eduIn) + goal(o.wed, o.wedIn);
    var loans = o.loanYears > 0 ? o.loans * Math.max(0, 1 - t / o.loanYears) : (t === 0 ? o.loans : 0);   /* roughly straight-line repayment */
    var buffer = o.buffer ? o.expenses * 6 * Math.pow(fi, t) : 0;
    var have = o.savings * Math.pow(1 + r, t) + o.cover;
    var gross = inc + goals + loans + buffer;
    return { income: inc, goals: goals, loans: loans, buffer: buffer, gross: gross, have: have, cover: Math.max(0, gross - have) };
  }
  function round(v) { var step = v >= 1e7 ? 2500000 : 500000; return Math.ceil(v / step) * step; }   /* up to the next ₹25 lakh (or ₹5 lakh below ₹1 crore) */
  function calc(o) {
    var now = need(o, 0), until = o.age + Math.max(o.years, o.eduIn, o.wedIn, o.loanYears), path = [];
    for (var t = 0; t <= until - o.age; t++) { var x = need(o, t); path.push({ age: o.age + t, cover: x.cover, gross: x.gross }); }
    /* Cover is level for the whole policy, so it must meet the highest need along the way: with inflation, the need often rises for some years before it falls. */
    var peak = path.reduce(function (m, x) { return x.cover > m.cover ? x : m; }, path[0]);
    /* What moves the line. Goals and the end of support make sudden drops between two ages; between them, the need slides a little each year. */
    var ev = [], N = path.length - 1, jumps = {};
    function add(t, kind, label, text) { if (t >= 0 && t <= N) ev.push({ t: t, age: o.age + t, kind: kind, label: label, text: text, cover: path[t].cover, before: t ? path[t - 1].cover : path[t].cover }); }
    function between(t) { return "Between ages " + (o.age + t - 1) + " and " + (o.age + t); }
    if (peak.age > o.age) add(peak.age - o.age, "peak", "Age " + peak.age + ": highest need", "Until here, rising costs add more each year than loan repayments and the shrinking years of support take away.");
    if (o.edu > 0 && o.eduIn + 1 <= N) { jumps[o.eduIn + 1] = 1; add(o.eduIn + 1, "drop", between(o.eduIn + 1), "Children's education is paid for, so it no longer needs cover."); }
    if (o.wed > 0 && o.wedIn + 1 <= N) { jumps[o.wedIn + 1] = 1; add(o.wedIn + 1, "drop", between(o.wedIn + 1), "The other goal is paid for, so it no longer needs cover."); }
    if (o.years <= N) { jumps[o.years] = 1; add(o.years, "drop", between(o.years), "The years your family needs your support end" + (o.buffer ? ", along with the 6-month buffer" : "") + ". Only goals or loans still to come keep the need above zero."); }
    /* gradual stretches after the peak (3 years or more with no sudden drop) */
    var st = peak.age - o.age + 1, loanDone = !(o.loans > 0 && o.loanYears > 0 && o.loanYears <= N) || o.loanYears < st;
    for (var t2 = st; t2 <= N + 1; t2++) {
      var stop = t2 > N || jumps[t2] || path[t2].cover >= path[t2 - 1].cover;
      if (stop) {
        var a0 = st, b0 = t2 - 1;
        if (b0 - a0 + 1 >= 3) { var mid = Math.round((a0 - 1 + b0) / 2), loansOn = o.loans > 0 && o.loanYears > a0 - 1, loanEnd = loansOn && o.loanYears <= b0;
          if (loanEnd) loanDone = true;
          add(mid, "slide", "Ages " + (o.age + a0 - 1) + " to " + (o.age + b0) + ": a steady fall", "No sudden change here: each year, one year less of support is left to cover" + (loansOn ? " and loans are paid down" + (loanEnd ? " (fully repaid at age " + (o.age + o.loanYears) + ")" : "") : "") + ", so the need slides a little.");
        }
        st = t2 + 1;
      }
    }
    if (!loanDone) add(o.loanYears, "drop", "Age " + (o.age + o.loanYears) + ": loans repaid", "The loans are fully paid off. Until here, part of each year's change came from paying them down.");
    ev.sort(function (a, b) { return a.t - b.t; });
    return { events: ev, now: now, cover: now.cover, peak: peak.cover, peakAge: peak.age, rounded: round(peak.cover), until: until, path: path, rule10: o.income * 10, rule15: o.income * 15 };
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { calc: calc, need: need, round: round }; return; }

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
  var S = { age: 32, years: 28, expenses: 50000, spouse: 0, infl: 6, ret: 7, edu: 2000000, eduIn: 15, wed: 1000000, wedIn: 23, goalInfl: 8,
            loans: 4000000, loanYears: 18, buffer: true, savings: 500000, cover: 0, income: 1500000 };
  var NUM = { age: [18, 65], years: [1, 50], expenses: [0, 1e8], spouse: [0, 1e8], infl: [0, 12], ret: [0, 12], edu: [0, 1e9], eduIn: [0, 30], wed: [0, 1e9], wedIn: [0, 35], goalInfl: [0, 15],
              loans: [0, 1e10], loanYears: [0, 30], savings: [0, 1e10], cover: [0, 1e10], income: [0, 1e10] };
  var MONEY = { expenses: 1, spouse: 1, edu: 1, wed: 1, loans: 1, savings: 1, cover: 1, income: 1 };
  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    Object.keys(NUM).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= NUM[k][0] && v <= NUM[k][1]) S[k] = v; });
    if (q.get("buffer") === "0") S.buffer = false;
  })();
  var shows = [];
  function bind(k) {
    var el = $("ti-" + k), note = $("ti-" + k + "-w"); if (!el) return;
    function show() { el.value = MONEY[k] ? fmt.format(S[k]) : String(S[k]); if (note) note.textContent = MONEY[k] ? words(S[k]) : ""; }
    el.addEventListener("input", function () {
      var raw = MONEY[k] ? this.value.replace(/[^0-9]/g, "") : this.value.replace(/[^0-9.]/g, "");
      if (MONEY[k]) this.value = raw ? fmt.format(+raw) : "";
      var v = parseFloat(raw); if (!isFinite(v)) { if (raw === "" && NUM[k][0] === 0) { S[k] = 0; render(); } return; }
      S[k] = Math.max(NUM[k][0], Math.min(NUM[k][1], v)); if (note) note.textContent = MONEY[k] ? words(S[k]) : ""; render();
    });
    el.addEventListener("blur", show); shows.push(function () { if (document.activeElement !== el) show(); }); show();
  }
  Object.keys(NUM).forEach(bind);
  document.querySelectorAll("[data-buffer]").forEach(function (b) { b.addEventListener("click", function () { S.buffer = b.getAttribute("data-buffer") === "1"; render(); }); });
  function pressed(attr, val) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-" + attr) === String(val) ? "true" : "false"); }); }
  var last = null;
  function chart(r) {
    var W = 420, Hh = 240, pl = 54, pr = 14, pt = 20, pb = 26, a = r.path.map(function (x) { return x.cover; }), n = Math.max(1, a.length - 1);
    var max = Math.max.apply(null, a.concat([r.rounded, 1])), st = Math.pow(10, Math.floor(Math.log10(max / 4))), qq = max / 4 / st; st *= qq <= 1 ? 1 : qq <= 2 ? 2 : qq <= 2.5 ? 2.5 : qq <= 5 ? 5 : 10; max = st * 4;
    function x(i) { return pl + i / n * (W - pl - pr); } function yy(v) { return pt + (max - v) / max * (Hh - pt - pb); }
    var g = ""; for (var k = 0; k <= 4; k++) { var gy = yy(max * k / 4).toFixed(1); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+gy + 3) + '" class="al" text-anchor="end">' + short(max * k / 4) + "</text>"; }
    var stp = n > 30 ? 10 : n > 15 ? 5 : 2, xl = ""; for (var t = 0; t <= n; t += stp) xl += '<text x="' + x(t).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">' + (S.age + t) + "</text>";
    var p = a.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(v).toFixed(1); }).join("");
    var lvl = yy(r.rounded).toFixed(1);
    var dots = r.events.map(function (e, i) {
      var cx = x(e.t).toFixed(1), cy = yy(e.cover).toFixed(1);
      return '<g class="ti-ev" tabindex="0" role="button" data-ev="' + i + '" aria-label="' + (e.label + ": " + e.text).replace(/"/g, "") + '"><title>' + e.label + ": " + e.text + '</title><circle cx="' + cx + '" cy="' + cy + '" r="13" class="hit"/><circle cx="' + cx + '" cy="' + cy + '" r="6" class="dot ' + e.kind + '"/><text x="' + cx + '" y="' + (+cy - 10) + '" text-anchor="middle" class="evn">' + (i + 1) + "</text></g>";
    }).join("");
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Cover needed by age">' + g + xl + '<line x1="' + pl + '" x2="' + x(n).toFixed(1) + '" y1="' + lvl + '" y2="' + lvl + '" class="ln buy" stroke-dasharray="5 4"/><path d="' + p + '" class="ln rent"/>' + dots + "</svg>";
  }
  function parts(r) {
    var x = r.now, R = [["Replace your support for " + S.years + " years", x.income], ["Children's education and other goals", x.goals], ["Loans to pay off", x.loans]];
    if (S.buffer) R.push(["Buffer: 6 months' expenses", x.buffer]);
    return R;
  }
  function less(r) { var R = []; if (S.savings) R.push(["Savings your family can use", S.savings]); if (S.cover) R.push(["Life cover you already have", S.cover]); return R; }
  function whatIfs() {
    var L = [["As you've set it", S], ["Return 1% lower", Object.assign({}, S, { ret: Math.max(0, S.ret - 1) })], ["Expenses 20% higher", Object.assign({}, S, { expenses: S.expenses * 1.2 })], ["Support 5 years longer", Object.assign({}, S, { years: S.years + 5 })]];
    return L.map(function (x) { var c = calc(x[1]); return [x[0], c.rounded, c.cover]; });
  }
  function render() {
    pressed("buffer", S.buffer ? "1" : "0");
    var r = calc(S); last = r;
    $("tiVerdict").className = "verdict";
    $("tiVerdict").innerHTML = '<p class="k">To protect your family for ' + S.years + " years, with your loans and goals covered</p>" +
      '<p class="v">You need term cover of about <b>' + short(r.rounded) + "</b></p>" +
      '<p class="k">Until age ' + r.until + " (a " + (r.until - S.age) + "-year policy). " + (r.peakAge > S.age ? "Today you'd need " + short(r.cover) + ", but with rising costs the need peaks at about " + short(r.peak) + " around age " + r.peakAge + "." : "Worked out need: " + short(r.cover) + ", rounded up.") + "</p>";
    $("tiS1").textContent = short(r.rounded); $("tiS1h").textContent = "Needed today: " + short(r.cover);
    $("tiS2").textContent = "Age " + r.until; $("tiS2h").textContent = (r.until - S.age) + "-year policy";
    $("tiS3").textContent = S.income ? (r.rounded / S.income).toFixed(1) + "×" : "—"; $("tiS3h").textContent = S.income ? "Your yearly income (rule of thumb: 10–15×)" : "Enter your income";
    $("tiS4").textContent = short(r.now.have); $("tiS4h").textContent = "Savings and cover you already have";
    var notes = [];
    if (S.income && r.rounded < r.rule10) notes.push("<b>Below 10× your income:</b> your expenses and goals need less than the usual rule of thumb. That's fine if your family's costs really are lower than your pay; check the expenses you've entered.");
    else if (S.income && r.rounded > r.rule15) notes.push("<b>Above 15× your income:</b> loans and goals push the need past the usual rule of thumb. That's normal for big home loans; insurers may limit cover by income, so you may need two policies.");
    notes.push("<b>Employer group cover</b> usually ends when you leave the job, so it isn't counted here. Add it under \"Life cover you already have\" only if it continues.");
    notes.push(r.peakAge > S.age ? "<b>Why more than today's need:</b> term cover stays the same for the whole policy, but your family's costs rise with inflation. The need climbs until about age " + r.peakAge + ", then falls as loans are paid and the years of support run out. " + short(r.rounded) + " covers the highest point." : "<b>Your need falls over time</b> as loans are paid and goals pass, so a level cover of " + short(r.rounded) + " keeps you covered with a margin.");
    $("tiRule").innerHTML = notes.join("<br><br>");
    $("tiChart").innerHTML = chart(r);
    $("tiEvents").innerHTML = r.events.map(function (e, i) { var d = e.before - e.cover; return '<li data-ev="' + i + '"><b>' + (i + 1) + ". " + e.label + "</b>" + (e.kind === "drop" && d > 0 ? ' <span class="dd">−' + short(d) + "</span>" : "") + "<br>" + e.text + "</li>"; }).join("");
    $("tiEvTip").hidden = true;
    $("tiParts").innerHTML = '<table class="calc"><thead><tr><th>Your family would need</th><th>Today</th></tr></thead><tbody>' +
      parts(r).map(function (x) { return '<tr><th scope="row">' + x[0] + '</th><td data-l="Today">' + inr(x[1]) + "</td></tr>"; }).join("") +
      '<tr class="tot"><th scope="row"><b>Total need</b></th><td data-l="Today"><b>' + inr(r.now.gross) + "</b></td></tr>" +
      less(r).map(function (x) { return '<tr><th scope="row">Less: ' + x[0] + '</th><td data-l="Today">−' + inr(x[1]) + "</td></tr>"; }).join("") +
      '<tr class="tot"><th scope="row"><b>Cover needed today</b></th><td data-l="Today"><b>' + inr(r.cover) + "</b></td></tr>" + (r.peakAge > S.age ? '<tr><th scope="row">Highest need, around age ' + r.peakAge + '</th><td data-l="Today">' + inr(r.peak) + "</td></tr>" : "") + '<tr class="tot"><th scope="row"><b>Cover to buy, rounded up</b></th><td data-l="Today"><b>' + inr(r.rounded) + "</b></td></tr></tbody></table>";
    r.what = whatIfs();
    $("tiSens").innerHTML = r.what.map(function (w, i) { return '<div class="sv' + (i === 0 ? " cur" : "") + '"><span class="l">' + w[0] + '</span><span class="n">' + short(w[1]) + "</span></div>"; }).join("");
    $("tiBarT").textContent = "Cover " + short(r.rounded) + " to " + r.until;
    shows.forEach(function (f) { f(); });
  }

  function showEv(i, anchor) {
    var e = last.events[i], tip = $("tiEvTip"), box = $("tiChart").getBoundingClientRect(), a = anchor.getBoundingClientRect();
    tip.innerHTML = "<b>" + e.label + (e.kind === "drop" && e.before > e.cover ? ": −" + short(e.before - e.cover) : e.kind === "peak" ? ", " + short(e.cover) : "") + "</b><br>" + e.text;
    tip.hidden = false; var left = Math.min(Math.max(a.left - box.left - 110, 0), box.width - 240); tip.style.left = left + "px"; tip.style.top = (a.top - box.top + 24) + "px";
    document.querySelectorAll("#tiEvents li").forEach(function (li) { li.classList.toggle("on", li.getAttribute("data-ev") === String(i)); });
  }
  $("tiChart").addEventListener("click", function (ev) { var g = ev.target.closest(".ti-ev"); if (g) showEv(+g.getAttribute("data-ev"), g); else $("tiEvTip").hidden = true; });
  $("tiChart").addEventListener("mouseover", function (ev) { var g = ev.target.closest(".ti-ev"); if (g) showEv(+g.getAttribute("data-ev"), g); });
  $("tiChart").addEventListener("keydown", function (ev) { var g = ev.target.closest(".ti-ev"); if (g && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); showEv(+g.getAttribute("data-ev"), g); } });
  $("tiChart").addEventListener("focusin", function (ev) { var g = ev.target.closest(".ti-ev"); if (g) showEv(+g.getAttribute("data-ev"), g); });
  $("tiChart").addEventListener("mouseleave", function () { $("tiEvTip").hidden = true; document.querySelectorAll("#tiEvents li.on").forEach(function (li) { li.classList.remove("on"); }); });

  /* ---------- Reports ---------- */
  function say(m) { var s = $("tiStatus"); s.textContent = m; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function spec() {
    var r = last, cats = [], a = [], b = [];
    r.path.forEach(function (x, i) { cats.push(i); if (!i) { a.push(x.cover); b.push(r.rounded); return; } var prev = r.path[i - 1].cover; for (var m = 1; m <= 12; m++) { a.push(prev + (x.cover - prev) * m / 12); b.push(r.rounded); } });
    return {
      title: "Term Insurance Cover Report", path: "salarist.in/term-insurance-calculator", url: location.origin + location.pathname, file: "salarist-term-cover",
      question: "How much term insurance cover do I need, and for how long?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#tiVerdict p"), function (x) { return x.textContent; }), verdictColor: "blue",
      inputs: [["Your age", String(S.age)], ["Years your family needs support", String(S.years)], ["Family's monthly expenses without you", inr(S.expenses), S.expenses], ["Spouse's income a month", inr(S.spouse), S.spouse],
        ["Inflation", S.infl + "% a year"], ["Return on the payout", S.ret + "% a year"], ["Children's education (today's cost)", inr(S.edu) + " in " + S.eduIn + " years", S.edu], ["Other goal (today's cost)", inr(S.wed) + " in " + S.wedIn + " years", S.wed],
        ["Goal cost inflation", S.goalInfl + "% a year"], ["Loans left", inr(S.loans) + " over " + S.loanYears + " years", S.loans], ["6 months' buffer", S.buffer ? "Yes" : "No"],
        ["Savings your family can use", inr(S.savings), S.savings], ["Life cover you already have", inr(S.cover), S.cover], ["Your yearly income", inr(S.income), S.income]],
      keyNums: [["Cover to buy", short(r.rounded), r.rounded], ["Cover until age", String(r.until), 0], ["Times your income", S.income ? (r.rounded / S.income).toFixed(1) + "×" : "—", 0], ["Already have", short(r.now.have), r.now.have]],
      sensTitle: "What if", sens: r.what.slice(0, 3).map(function (w) { return [w[0], short(w[1])]; }), sensCurrent: 0,
      chartTitle: "Cover needed by age", chartNote: "Rises with inflation, then falls. Second line: the level cover to buy. The numbered points are explained below the chart.", xlsxChartTitle: "Cover needed (₹ lakh)",
      chart: { series: [{ name: "Cover needed", color: "blue", data: a }, { name: "Cover to buy", color: "amber", data: b }], cross: null }, chartPoints: r.events.map(function (e) { var d = e.before - e.cover; return { m: e.t * 12, v: e.cover, color: e.kind === "peak" ? "amber" : "blue", label: e.label + (e.kind === "drop" && d > 0 ? ": −" + short(d) : e.kind === "peak" ? ", " + short(e.cover) : ""), text: e.text }; }), chartYears: cats, chartXLabel: "Age", chartAge0: S.age,
      money: { title: "How the cover adds up", cols: ["Amount", "Share of need"], rows: parts(r).map(function (x) { return [x[0], x[1], r.now.gross ? (x[1] / r.now.gross * 100).toFixed(0) + "%" : ""]; }).concat([["Total need", r.now.gross, "100%", "total"]]).concat(less(r).map(function (x) { return ["Less: " + x[0], -x[1], ""]; })).concat([["Cover needed today", r.cover, "", "total"], ["Highest need (age " + r.peakAge + ")", r.peak, ""], ["Cover to buy, rounded up", r.rounded, "", "total"]]), note: $("tiRule").textContent },
      tables: [{ title: "Cover needed by age", sheet: "By age", cols: ["Age", "Total need", "Cover needed"], yearly: r.path.map(function (x) { return [String(x.age), x.gross, x.cover]; }), monthly: null }],
      notes: ["Support: your family's monthly expenses without you, less your spouse's income, rising with inflation, for the years you set, paid from the payout earning the return you set (worked out as today's value).",
        "Goals: today's cost grown at goal inflation to the year needed, then worked back to today at the return on the payout. Loans: the amount left, falling evenly to zero over the years left.",
        "Less savings your family could use and personal life cover you already have. Employer group cover usually ends when you leave a job, so it isn't counted unless you add it.",
        "Cover to buy: the highest need over the policy (the need rises with inflation before it falls), rounded up to the next ₹5 lakh below ₹1 crore and the next ₹25 lakh above. Cover until: the latest of the support years, goals and loans."],
      taxRules: ["Death benefit from a term policy is tax-free (Income-tax Act, 2025, section 11 with Schedule II). Premium: deduction under section 123 with Schedule XV, within the ₹1.5 lakh limit, old regime only. No GST on individual term insurance from 22 September 2025."],
      short: short, inr: inr
    };
  }
  function busy(b, on) { b.disabled = on; b.setAttribute("aria-busy", on ? "true" : "false"); }
  $("tiPdf").addEventListener("click", function () { var b = this; busy(b, true); say("Making your PDF…"); withReport(function (Kt) { Kt.pdf(spec()).then(function () { busy(b, false); say("PDF report downloaded."); }, function () { busy(b, false); say("Couldn't make the PDF. Please try again."); }); }); });
  $("tiXlsx").addEventListener("click", function () { var b = this; busy(b, true); withReport(function (Kt) { try { Kt.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(b, false); }); });
  $("tiShare").addEventListener("click", function () {
    var q = new URLSearchParams(); Object.keys(NUM).forEach(function (k) { q.set(k, S[k]); }); q.set("buffer", S.buffer ? "1" : "0");
    var t = location.origin + location.pathname + "?" + q.toString();
    function ok() { say("Link copied. Anyone with it sees these numbers."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { say("Couldn't copy. Copy the address bar instead."); }); else say("Copy the address bar to share.");
  });
  (function bar() {
    var el = $("tiBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("tiVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".tix .lp-setup"));
    $("tiBarBtn").addEventListener("click", function () { $("tiVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
