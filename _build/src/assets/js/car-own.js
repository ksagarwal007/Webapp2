/* Salarist car ownership cost calculator. Runs entirely in the browser; nothing is stored or sent. */
(function () {
  "use strict";
  var FUEL = {
    petrol: { name: "Petrol", unit: "litre", eff: "km per litre", price: 102.12, mileage: 15, service: 10000 },
    diesel: { name: "Diesel", unit: "litre", eff: "km per litre", price: 95.20, mileage: 19, service: 13000 },
    cng: { name: "CNG", unit: "kg", eff: "km per kg", price: 86.98, mileage: 24, service: 12000 },
    ev: { name: "Electric", unit: "unit (kWh)", eff: "km per unit (kWh)", price: 8, mileage: 7, service: 5000 }
  };

  /* ---------- Core ---------- */
  function emiOf(P, annualPct, n) {
    var r = annualPct / 1200;
    if (n <= 0 || P <= 0) return 0;
    if (r === 0) return P / n;
    var f = Math.pow(1 + r, n);
    return P * r * f / (f - 1);
  }
  /* One car over `years`. c: {price, mileage, fuelPrice, insFirst, insLater, service, resalePct, loan, rate, tenure (years)}.
     k: {kmMonth, years, rise (% a year, fuel and service)}.
     Resale value falls evenly in % terms, reaching resalePct of the price after `years`.
     "Cost if sold" after year t = down payment + EMIs paid + running costs + loan still owed − resale value. */
  function car(c, k) {
    var loan = Math.min(Math.max(0, c.loan), c.price), down = c.price - loan, n = Math.round(c.tenure * 12), emi = loan > 0 ? emiOf(loan, c.rate, n) : 0;
    var bal = loan, r = c.rate / 1200, rows = [], cum = down, tot = { fuel: 0, ins: 0, service: 0, emi: 0, interest: 0 };
    var keep = Math.pow(Math.max(1, c.resalePct) / 100, 1 / k.years);
    for (var y = 1; y <= k.years; y++) {
      var grow = Math.pow(1 + k.rise / 100, y - 1);
      var fuel = k.kmMonth * 12 / c.mileage * c.fuelPrice * grow, ins = y === 1 ? c.insFirst : c.insLater, serv = c.service * grow, emiY = 0, intY = 0;
      for (var m = 0; m < 12; m++) {
        if (bal <= 0.005) break;
        var it = bal * r, pay = Math.min(emi, bal + it);
        bal = Math.max(0, bal - (pay - it)); emiY += pay; intY += it;
      }
      cum += fuel + ins + serv + emiY;
      var resale = c.price * Math.pow(keep, y);
      tot.fuel += fuel; tot.ins += ins; tot.service += serv; tot.emi += emiY; tot.interest += intY;
      rows.push({ y: y, fuel: fuel, ins: ins, service: serv, emi: emiY, interest: intY, owed: bal, resale: resale, spent: cum, ifSold: cum + bal - resale });
    }
    var last = rows[rows.length - 1], km = k.kmMonth * 12 * k.years;
    var interestAll = tot.interest;   /* interest paid with the EMIs; any loan left is repaid when you sell */
    var total = last.ifSold;
    return {
      emi: emi, down: down, loan: loan, rows: rows, total: total, perMonth: total / (12 * k.years), perKm: total / km,
      runPerKm: (tot.fuel + tot.service) / km, fuelPerKm: c.fuelPrice / c.mileage,
      parts: { depreciation: c.price - last.resale, interest: interestAll, fuel: tot.fuel, ins: tot.ins, service: tot.service },
      resale: last.resale, owed: last.owed, spent: last.spent
    };
  }
  /* Total cost is a straight line in distance: fixed costs plus fuel per km. Returns the monthly km at which two cars cost the same, or null. */
  function breakEvenKm(a, b, k) {
    function at(km, c) { return car(c, { kmMonth: km, years: k.years, rise: k.rise }).total; }
    var a0 = at(0.0001, a), b0 = at(0.0001, b), a1 = at(1000, a), b1 = at(1000, b);
    var va = (a1 - a0) / 1000, vb = (b1 - b0) / 1000;
    if (Math.abs(va - vb) < 1e-9) return null;
    var km = (b0 - a0) / (va - vb);
    return km > 0 ? km : null;
  }
  /* First year after which the car that costs more up front is cheaper to have owned (if sold then). */
  function breakEvenYear(ra, rb) {
    var aFirst = ra.rows[0].ifSold < rb.rows[0].ifSold;
    for (var i = 0; i < ra.rows.length; i++) { if ((ra.rows[i].ifSold < rb.rows[i].ifSold) !== aFirst) return i + 1; }
    return null;
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { car: car, emiOf: emiOf, breakEvenKm: breakEvenKm, breakEvenYear: breakEvenYear, FUEL: FUEL }; return; }

  /* ---------- UI ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var fmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  var fmt2 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
  function inr(v) { var r = Math.round(v); return (r < 0 ? "−" : "") + "₹" + fmt.format(Math.abs(r)); }
  function short(v) {
    var a = Math.abs(v), s = v < 0 ? "−" : "";
    if (a >= 1e7) return s + "₹" + (a / 1e7).toFixed(2).replace(/\.?0+$/, "") + " Cr";
    if (a >= 1e5) return s + "₹" + (a / 1e5).toFixed(2).replace(/\.?0+$/, "") + " L";
    return s + "₹" + fmt.format(Math.round(a));
  }
  function rs(v) { return "₹" + fmt2.format(Math.round(v * 100) / 100); }
  function words(v) { return v >= 1e5 ? short(v) : ""; }
  function defCar(fuel, name, price, ins1, ins2, resale) {
    var f = FUEL[fuel];
    return { name: name, fuel: fuel, price: price, mileage: f.mileage, fuelPrice: f.price, insFirst: ins1, insLater: ins2, service: f.service, resalePct: resale, loan: Math.round(price * 0.8), rate: 9, tenure: 5 };
  }
  var S = { compare: true, cur: "a", kmMonth: 1200, years: 7, rise: 3,
            a: defCar("petrol", "Petrol car", 1000000, 35000, 22000, 40),
            b: defCar("ev", "Electric car", 1400000, 45000, 30000, 35) };
  var CNUM = { price: [50000, 5e8], mileage: [1, 60], fuelPrice: [0, 500], insFirst: [0, 1e7], insLater: [0, 1e7], service: [0, 1e7], resalePct: [1, 100], loan: [0, 5e8], rate: [0, 30], tenure: [1, 8] };
  var KNUM = { kmMonth: [50, 20000], years: [1, 15], rise: [0, 15] };
  var MONEY = { price: 1, insFirst: 1, insLater: 1, service: 1, loan: 1 };
  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    Object.keys(KNUM).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= KNUM[k][0] && v <= KNUM[k][1]) S[k] = v; });
    ["a", "b"].forEach(function (c) {
      var f = q.get(c + "fuel"); if (FUEL[f]) S[c].fuel = f;
      var nm = q.get(c + "name"); if (nm) S[c].name = nm.slice(0, 40);
      Object.keys(CNUM).forEach(function (k) { var v = parseFloat(q.get(c + k)); if (isFinite(v) && v >= CNUM[k][0] && v <= CNUM[k][1]) S[c][k] = v; });
    });
    if (q.get("compare") === "0") S.compare = false;
  })();
  function C() { return S[S.cur]; }
  var shows = [];
  function bind(k, isCar) {
    var el = $("co-" + k), note = $("co-" + k + "-w"); if (!el) return;
    var lim = isCar ? CNUM[k] : KNUM[k];
    function get() { return isCar ? C()[k] : S[k]; }
    function show() { var v = get(); el.value = MONEY[k] ? fmt.format(v) : String(v); if (note) note.textContent = MONEY[k] ? words(v) : ""; }
    el.addEventListener("input", function () {
      var raw = MONEY[k] ? this.value.replace(/[^0-9]/g, "") : this.value.replace(/[^0-9.]/g, "");
      if (MONEY[k]) this.value = raw ? fmt.format(+raw) : "";
      var v = parseFloat(raw); if (!isFinite(v)) return;
      v = Math.max(lim[0], Math.min(lim[1], v));
      if (isCar) C()[k] = v; else S[k] = v;
      if (note) note.textContent = MONEY[k] ? words(v) : ""; render();
    });
    el.addEventListener("blur", show); shows.push(show); show();
  }
  Object.keys(CNUM).forEach(function (k) { bind(k, true); });
  Object.keys(KNUM).forEach(function (k) { bind(k, false); });
  $("co-name").addEventListener("input", function () { C().name = this.value.slice(0, 40) || (S.cur === "a" ? "Car 1" : "Car 2"); render(); });
  function refresh() { shows.forEach(function (f) { f(); }); $("co-name").value = C().name; }
  document.querySelectorAll("[data-fuel]").forEach(function (b) {
    b.addEventListener("click", function () {
      var f = b.getAttribute("data-fuel"), c = C(); if (c.fuel === f) return;
      c.fuel = f; c.fuelPrice = FUEL[f].price; c.mileage = FUEL[f].mileage; c.service = FUEL[f].service; refresh(); render();
    });
  });
  document.querySelectorAll("[data-car]").forEach(function (b) { b.addEventListener("click", function () { S.cur = b.getAttribute("data-car"); refresh(); render(); }); });
  document.querySelectorAll("[data-compare]").forEach(function (b) { b.addEventListener("click", function () { S.compare = b.getAttribute("data-compare") === "1"; if (!S.compare) S.cur = "a"; refresh(); render(); }); });
  function pressed(attr, val) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-" + attr)) === String(val) ? "true" : "false"); }); }
  function K() { return { kmMonth: S.kmMonth, years: S.years, rise: S.rise }; }
  function yrs(n) { return n + (n === 1 ? " year" : " years"); }

  var last = null;
  function result() {
    var k = K(), ra = car(S.a, k), rb = S.compare ? car(S.b, k) : null, out = { a: ra, b: rb };
    if (rb) { out.km = breakEvenKm(S.a, S.b, k); out.year = breakEvenYear(ra, rb); out.cheap = ra.total <= rb.total ? "a" : "b"; out.gap = Math.abs(ra.total - rb.total); }
    return out;
  }
  function verdict(r) {
    var A = S.a, B = S.b, km = fmt.format(S.kmMonth);
    if (!r.b) return '<p class="k">' + H(A.name) + ", " + yrs(S.years) + ", " + km + ' km a month</p><p class="v">Owning it costs about <b>' + short(r.a.total) + "</b></p>" +
      '<p class="k">That\'s ' + inr(r.a.perMonth) + " a month, or " + rs(r.a.perKm) + " per km, after you sell it for about " + short(r.a.resale) + ".</p>";
    var w = S[r.cheap], l = S[r.cheap === "a" ? "b" : "a"];
    if (r.gap < 0.01 * Math.max(r.a.total, r.b.total)) return '<p class="k">' + yrs(S.years) + ", " + km + ' km a month</p><p class="v">They cost about the same: <b>' + short(r.a.total) + "</b> each</p>";
    return '<p class="k">Over ' + yrs(S.years) + ", " + km + ' km a month</p><p class="v"><b>' + H(w.name) + "</b> costs about <b>" + short(r.gap) + "</b> less than " + H(l.name) + '</p><p class="k">' +
      H(A.name) + ": " + short(r.a.total) + " (" + inr(r.a.perMonth) + " a month). " + H(B.name) + ": " + short(r.b.total) + " (" + inr(r.b.perMonth) + " a month).</p>";
  }
  /* The car that wins at low distances: the one with lower fixed costs. */
  function cheaperBelow(r) { var k = { kmMonth: Math.max(50, r.km / 4), years: S.years, rise: S.rise }; return car(S.a, k).total < car(S.b, k).total ? "a" : "b"; }
  function H(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function chart(r) {
    var W = 420, Hh = 240, pl = 54, pr = 14, pt = 20, pb = 26, n = S.years;
    var A = [0].concat(r.a.rows.map(function (x) { return x.ifSold; })), B = r.b ? [0].concat(r.b.rows.map(function (x) { return x.ifSold; })) : null;
    var all = A.concat(B || []), max = Math.max.apply(null, all) || 1, st = Math.pow(10, Math.floor(Math.log10(max / 4))), qq = max / 4 / st; st *= qq <= 1 ? 1 : qq <= 2 ? 2 : qq <= 2.5 ? 2.5 : qq <= 5 ? 5 : 10; max = st * 4;
    function x(i) { return pl + i / n * (W - pl - pr); } function yy(v) { return pt + (max - v) / max * (Hh - pt - pb); }
    function path(a) { return a.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + yy(v).toFixed(1); }).join(""); }
    var g = ""; for (var k = 0; k <= 4; k++) { var gy = yy(max * k / 4).toFixed(1); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+gy + 3) + '" class="al" text-anchor="end">' + short(max * k / 4) + "</text>"; }
    var stp = n > 10 ? 2 : 1, xl = ""; for (var t = 0; t <= n; t += stp) xl += '<text x="' + x(t).toFixed(1) + '" y="' + (Hh - 8) + '" class="al" text-anchor="middle">' + t + " yr</text>";
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Cost of owning, if sold that year">' + g + xl + '<path d="' + path(A) + '" class="ln rent"/>' + (B ? '<path d="' + path(B) + '" class="ln buy"/>' : "") + "</svg>";
  }
  function partsRows(r) {
    var L = [["depreciation", "Value lost (price − resale)"], ["interest", "Loan interest"], ["fuel", "Fuel or charging"], ["ins", "Insurance"], ["service", "Service and repairs"]];
    return L.map(function (p) { return [p[1], r.a.parts[p[0]], r.b ? r.b.parts[p[0]] : null]; });
  }
  function partsHtml(r) {
    var head = "<tr><th>Cost</th><th>" + H(S.a.name) + "</th>" + (r.b ? "<th>" + H(S.b.name) + "</th>" : "") + "</tr>", rows = "";
    partsRows(r).forEach(function (p) { rows += '<tr><th scope="row">' + p[0] + '</th><td data-l="' + H(S.a.name) + '">' + inr(p[1]) + "</td>" + (r.b ? '<td data-l="' + H(S.b.name) + '">' + inr(p[2]) + "</td>" : "") + "</tr>"; });
    rows += '<tr class="tot"><th scope="row"><b>Total cost</b></th><td data-l="' + H(S.a.name) + '"><b>' + inr(r.a.total) + "</b></td>" + (r.b ? '<td data-l="' + H(S.b.name) + '"><b>' + inr(r.b.total) + "</b></td>" : "") + "</tr>";
    rows += '<tr><th scope="row">Per km</th><td data-l="' + H(S.a.name) + '">' + rs(r.a.perKm) + "</td>" + (r.b ? '<td data-l="' + H(S.b.name) + '">' + rs(r.b.perKm) + "</td>" : "") + "</tr>";
    rows += '<tr><th scope="row">Fuel or charging per km, today</th><td data-l="' + H(S.a.name) + '">' + rs(r.a.fuelPerKm) + "</td>" + (r.b ? '<td data-l="' + H(S.b.name) + '">' + rs(r.b.fuelPerKm) + "</td>" : "") + "</tr>";
    return '<table class="calc"><thead>' + head + "</thead><tbody>" + rows + "</tbody></table>";
  }
  var DIST = [500, 1000, 1500, 2000, 3000];
  function distRows() {
    return DIST.map(function (km) { var k = { kmMonth: km, years: S.years, rise: S.rise }, a = car(S.a, k), b = S.compare ? car(S.b, k) : null; return { km: km, a: a.total, b: b ? b.total : null, pa: a.perKm, pb: b ? b.perKm : null }; });
  }
  function distBox() {
    var d = distRows(), cur = DIST.reduce(function (p, c) { return Math.abs(c - S.kmMonth) < Math.abs(p - S.kmMonth) ? c : p; });
    $("coDist").innerHTML = d.map(function (x) {
      var n = x.b === null ? short(x.a) : (x.a < x.b ? H(S.a.name) : H(S.b.name)) + " saves " + short(Math.abs(x.a - x.b));
      var h = x.b === null ? rs(x.pa) + " per km" : H(S.a.name) + " " + short(x.a) + ", " + H(S.b.name) + " " + short(x.b);
      return '<div class="sv' + (x.km === cur ? " cur" : "") + '"><span class="l">' + fmt.format(x.km) + ' km a month</span><span class="n">' + n + '</span><span class="h">' + h + "</span></div>";
    }).join("");
    return d;
  }
  function table(r) {
    var head = "<tr><th>Year</th>", rows = "";
    var cols = r.b ? [S.a, S.b] : [S.a], rr = r.b ? [r.a, r.b] : [r.a];
    if (r.b) head += "<th>" + H(S.a.name) + ": spent so far</th><th>Cost if sold</th><th>" + H(S.b.name) + ": spent so far</th><th>Cost if sold</th></tr>";
    else head += "<th>Fuel</th><th>Insurance</th><th>Service</th><th>EMIs</th><th>Resale value</th><th>Cost if sold</th></tr>";
    for (var i = 0; i < S.years; i++) {
      rows += '<tr><th scope="row">' + (i + 1) + "</th>";
      if (r.b) rr.forEach(function (x, j) { var w = x.rows[i]; rows += '<td data-l="' + H(cols[j].name) + ': spent">' + inr(w.spent) + '</td><td data-l="' + H(cols[j].name) + ': if sold">' + inr(w.ifSold) + "</td>"; });
      else { var w = r.a.rows[i]; rows += '<td data-l="Fuel">' + inr(w.fuel) + '</td><td data-l="Insurance">' + inr(w.ins) + '</td><td data-l="Service">' + inr(w.service) + '</td><td data-l="EMIs">' + inr(w.emi) + '</td><td data-l="Resale value">' + inr(w.resale) + '</td><td data-l="Cost if sold">' + inr(w.ifSold) + "</td>"; }
      rows += "</tr>";
    }
    return '<table class="calc"><thead>' + head + "</thead><tbody>" + rows + "</tbody></table>";
  }
  function render() {
    var c = C(), f = FUEL[c.fuel];
    pressed("compare", S.compare ? "1" : "0"); pressed("car", S.cur); pressed("fuel", c.fuel);
    $("co-cars").hidden = !S.compare;
    $("co-mileageLbl").textContent = "Mileage, " + f.eff;
    $("co-fuelPriceLbl").textContent = (c.fuel === "ev" ? "Electricity" : f.name) + " price, ₹ per " + f.unit;
    $("co-fuelHint").textContent = c.fuel === "ev" ? "Your home electricity rate per unit: check your bill. Public fast chargers cost more, so raise this if you'll use them often."
      : "Delhi price on 14 Nov 2026: " + rs(f.price) + (c.fuel === "cng" ? " a kg (IGL)" : " a litre") + ". Use your city's price.";
    $("co-mileageHint").textContent = c.fuel === "ev" ? "Real-world range ÷ battery size. Many small EVs do 6 to 8 km per unit." : "Use real-world mileage, usually lower than the company's claimed figure.";
    var em = c.loan > 0 ? emiOf(Math.min(c.loan, c.price), c.rate, Math.round(c.tenure * 12)) : 0;
    $("co-emi").textContent = c.loan > 0 ? "EMI about " + inr(em) + " a month. Down payment " + inr(Math.max(0, c.price - c.loan)) + "." : "Paying in full: no loan.";
    $("co-resaleHint").textContent = "What you expect to sell it for after " + yrs(S.years) + ", as a share of the on-road price. Check used-car listings for the same model at that age.";
    var r = result(); last = r;
    $("coVerdict").innerHTML = verdict(r);
    $("coTot").textContent = short(r.b ? r[r.cheap].total : r.a.total); $("coTotH").textContent = r.b ? H(S[r.cheap].name) + ", the cheaper one" : "After resale, over " + yrs(S.years);
    var main = r.b ? r[r.cheap] : r.a;
    $("coMonth").textContent = inr(main.perMonth); $("coKm").textContent = rs(main.perKm); $("coRun").textContent = rs(main.runPerKm);
    var be = $("coBreak");
    if (r.b) {
      var t = [];
      if (r.km) t.push("<b>Break-even distance:</b> the two cost the same at about " + fmt.format(Math.round(r.km / 50) * 50) + " km a month over " + yrs(S.years) + ". Drive more than that and " + H(S[cheaperBelow(r) === "a" ? "b" : "a"].name) + " comes out ahead.");
      else t.push("<b>No break-even distance:</b> " + H(S[r.cheap].name) + " costs less at any distance over " + yrs(S.years) + ".");
      if (r.year) t.push("<b>Keep it long enough:</b> " + H(S[r.cheap].name) + " is cheaper only if you keep it for " + yrs(r.year) + " or more. Sell earlier and " + H(S[r.cheap === "a" ? "b" : "a"].name) + " costs less.");
      be.innerHTML = t.join(" "); be.hidden = false;
    } else be.hidden = true;
    $("coChart").innerHTML = chart(r);
    $("coLegB").hidden = !r.b; $("coLegA").textContent = S.a.name; $("coLegBt").textContent = S.b.name;
    $("coParts").innerHTML = partsHtml(r);
    r.dist = distBox();
    $("coTable").innerHTML = table(r);
    $("coBarT").textContent = r.b ? H(S[r.cheap].name) + " saves " + short(r.gap) : short(r.a.total) + " over " + yrs(S.years);
  }

  /* ---------- Reports ---------- */
  function say(m) { var s = $("coStatus"); s.textContent = m; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function notes() {
    return ["Total cost = everything you pay (down payment, EMIs, fuel or charging, insurance, service) plus any loan still owed, minus what you sell the car for at the end.",
      "Fuel, charging and service costs rise by " + S.rise + "% a year. Insurance is the first-year premium, then your renewal estimate each year after.",
      "Resale value falls by the same share each year, reaching your estimate at the end. Real cars lose more in the first year or two.",
      "Loan EMIs use the standard reducing-balance formula, the same as the Salarist EMI calculator. If the loan runs longer than you keep the car, the balance is paid off when you sell.",
      "Fuel prices are Delhi prices on 14 Nov 2026 (petrol and diesel from oil companies' daily rates, CNG from IGL). Use your own city's prices.",
      "Not included: parking, tolls, FASTag, cleaning, accessories, extended warranty, and a home charger for an EV unless you add it to the price."];
  }
  function spec() {
    var r = last, cats = [], A = [0], B = [0];
    for (var y = 0; y <= S.years; y++) cats.push(y);
    r.a.rows.forEach(function (x) { A.push(x.ifSold); }); if (r.b) r.b.rows.forEach(function (x) { B.push(x.ifSold); });
    function monthly(arr) { var o = []; arr.forEach(function (v, i) { if (i === 0) { o.push(v); return; } var p = arr[i - 1]; for (var m = 1; m <= 12; m++) o.push(p + (v - p) * m / 12); }); return o; }
    function carInputs(c, lab) {
      var f = FUEL[c.fuel];
      return [[lab, c.name + " (" + f.name + ")"], [lab + ": on-road price", inr(c.price), c.price], [lab + ": mileage", c.mileage + " " + f.eff], [lab + ": " + (c.fuel === "ev" ? "electricity" : "fuel") + " price", rs(c.fuelPrice) + " per " + f.unit],
        [lab + ": insurance, first year", inr(c.insFirst), c.insFirst], [lab + ": insurance, later years", inr(c.insLater), c.insLater], [lab + ": service and repairs a year", inr(c.service), c.service],
        [lab + ": resale after " + yrs(S.years), c.resalePct + "% of price"], [lab + ": loan", c.loan > 0 ? inr(c.loan) : "None", c.loan]].concat(c.loan > 0 ? [[lab + ": loan rate and tenure", c.rate + "% for " + yrs(c.tenure)]] : []);
    }
    var inputs = [["Distance", fmt.format(S.kmMonth) + " km a month"], ["Years you keep it", String(S.years)], ["Fuel and service costs rise", S.rise + "% a year"]].concat(carInputs(S.a, r.b ? "Car 1" : "Car"));
    if (r.b) inputs = inputs.concat(carInputs(S.b, "Car 2"));
    var dcols = ["Year", "Fuel", "Insurance", "Service", "EMIs", "Resale value", "Cost if sold"];
    function detail(x) { return x.rows.map(function (w) { return [String(w.y), w.fuel, w.ins, w.service, w.emi, w.resale, w.ifSold]; }); }
    var tables = r.b ? [{ title: "Year by year", sheet: "Both cars", cols: ["Year", S.a.name + ": spent so far", "Cost if sold", S.b.name + ": spent so far", "Cost if sold"],
                          yearly: r.a.rows.map(function (w, i) { var v = r.b.rows[i]; return [String(w.y), w.spent, w.ifSold, v.spent, v.ifSold]; }), monthly: null },
                        { title: S.a.name + ", year by year", sheet: "Car 1", cols: dcols, yearly: detail(r.a), monthly: null },
                        { title: S.b.name + ", year by year", sheet: "Car 2", cols: dcols, yearly: detail(r.b), monthly: null }]
                     : [{ title: "Year by year", sheet: "By year", cols: dcols, yearly: detail(r.a), monthly: null }];
    var ci = DIST.indexOf(DIST.reduce(function (p, c) { return Math.abs(c - S.kmMonth) < Math.abs(p - S.kmMonth) ? c : p; })), st = Math.max(0, Math.min(DIST.length - 3, ci - 1));
    var sens3 = r.dist.slice(st, st + 3);
    var main = r.b ? r[r.cheap] : r.a;
    var pr = partsRows(r);
    return {
      title: "Car Ownership Cost Report", path: "salarist.in/car-ownership-cost", url: location.origin + location.pathname, file: "salarist-car-ownership-cost",
      question: r.b ? "Which car costs less to own: " + S.a.name + " or " + S.b.name + "?" : "What will owning " + S.a.name + " really cost?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#coVerdict p"), function (p) { return p.textContent; }), verdictColor: "blue",
      inputs: inputs,
      keyNums: [["Total cost" + (r.b ? ", " + S[r.cheap].name : ""), short(main.total), main.total], ["Per month", inr(main.perMonth), main.perMonth], ["Per km", rs(main.perKm), main.perKm], ["Running cost per km", rs(main.runPerKm), main.runPerKm]],
      sensTitle: r.b ? "Total cost at other distances (" + S.a.name + " · " + S.b.name + ")" : "Total cost at other distances",
      sens: sens3.map(function (d) { return [fmt.format(d.km) + " km a month", d.b === null ? short(d.a) : short(d.a) + " · " + short(d.b)]; }),
      sensCurrent: ci - st,
      chartTitle: "Cost of owning, if sold that year", chartNote: "Everything paid so far, plus any loan left, minus the resale value.", xlsxChartTitle: "Cost (₹ lakh)",
      chart: { series: [{ name: S.a.name, color: "blue", data: monthly(A) }].concat(r.b ? [{ name: S.b.name, color: "amber", data: monthly(B) }] : []), cross: null }, chartYears: cats,
      money: { title: "Where the money goes", cols: r.b ? [S.a.name, S.b.name] : ["Amount", "Per month"],
        rows: pr.map(function (p) { return r.b ? [p[0], p[1], p[2]] : [p[0], p[1], p[1] / (12 * S.years)]; }).concat([r.b ? ["Total cost", r.a.total, r.b.total, "total"] : ["Total cost", r.a.total, r.a.perMonth, "total"]]),
        note: r.b ? $("coBreak").textContent : "" },
      tables: tables,
      notes: notes(), taxRules: ["Salaried people can't deduct car loan interest for a personal car under either tax regime. The only exception is section 132 of the Income-tax Act, 2025 (old 80EEB): up to ₹1.5 lakh a year of interest on an electric vehicle loan sanctioned between 1 April 2019 and 31 March 2023, under the old regime only. Loans taken now don't qualify."],
      short: short, inr: inr
    };
  }
  function busy(b, on) { b.disabled = on; b.setAttribute("aria-busy", on ? "true" : "false"); }
  $("coPdf").addEventListener("click", function () { var b = this; busy(b, true); say("Making your PDF…"); withReport(function (Kt) { Kt.pdf(spec()).then(function () { busy(b, false); say("PDF report downloaded."); }, function () { busy(b, false); say("Couldn't make the PDF. Please try again."); }); }); });
  $("coXlsx").addEventListener("click", function () { var b = this; busy(b, true); withReport(function (Kt) { try { Kt.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(b, false); }); });
  $("coShare").addEventListener("click", function () {
    var q = new URLSearchParams(); Object.keys(KNUM).forEach(function (k) { q.set(k, S[k]); }); q.set("compare", S.compare ? "1" : "0");
    ["a", "b"].forEach(function (c) { q.set(c + "name", S[c].name); q.set(c + "fuel", S[c].fuel); Object.keys(CNUM).forEach(function (k) { q.set(c + k, S[c][k]); }); });
    var t = location.origin + location.pathname + "?" + q.toString();
    function ok() { say("Link copied. Anyone with it sees these numbers."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { say("Couldn't copy. Copy the address bar instead."); }); else say("Copy the address bar to share.");
  });
  (function bar() {
    var el = $("coBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("coVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".co .lp-setup"));
    $("coBarBtn").addEventListener("click", function () { $("coVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  refresh(); render();
})();
