/* Salarist back-to-office cost calculator. Runs entirely in the browser; nothing is stored or sent.
   Method: cost of one office day = commute there and back (fuel and wear for a car or two-wheeler plus parking, or fares for metro/bus or cab) + extra food.
   Office days a year = days a week × 46 working weeks (52 less about 4 weeks of leave and 2 of holidays). Monthly = yearly ÷ 12.
   Time: commute hours, valued (optionally) at your take-home per working hour (take-home ÷ (22 days × 9 hours)).
   Pay rise to break even = extra yearly cost ÷ (1 − slab × 1.04), because the rise is taxed and the costs are paid from take-home.
   Moving closer: new rent and a shorter commute against the current rent and commute, with a one-time moving cost. */
(function () {
  "use strict";
  var NODE = typeof module !== "undefined" && module.exports;
  var WEEKS = 46, HOURS = 22 * 9;
  var MODES = {
    car: { name: "your car", fuelUse: true, mileage: 15, wear: 3, park: 100 },
    bike: { name: "your two-wheeler", fuelUse: true, mileage: 45, wear: 1, park: 20 },
    metro: { name: "metro or bus", fuelUse: false },
    cab: { name: "cab or auto", fuelUse: false }
  };
  /* one office day, money: o.mode, km (one way), mileage, fuel (₹/litre), wear (₹/km), park (₹/day), fare (₹ one way), food (₹/day extra) */
  /* Employer support: o.ctype "none" | "free" | "paid" (company cab or bus; travel cost then 0 a day, plus o.cshare a month if partly paid, o.cmins one way);
     o.allow travel allowance or reimbursement a month (taxable, so counted after tax at the slab); o.mealPaid food paid by the employer on an office day (meal card, free lunch). */
  function food(o) { return Math.max(0, o.food - (o.mealPaid || 0)); }
  function dayCost(o, km) {
    var m = MODES[o.mode], travel, f = food(o);
    if (o.ctype && o.ctype !== "none") travel = 0;
    else if (m.fuelUse) travel = 2 * km / Math.max(o.mileage, 1) * o.fuel + 2 * km * o.wear + o.park;
    else travel = 2 * o.fare;
    return { travel: travel, food: f, total: travel + f };
  }
  function monthOf(perDay, days) { return perDay * days * WEEKS / 12; }
  function calc(o) {
    var hourly = o.takehome / HOURS, tv = hourly * o.valueTime / 100;
    var co = o.ctype && o.ctype !== "none", share = o.ctype === "paid" ? o.cshare : 0;
    var d = dayCost(o, o.km), hrsDay = 2 * (co ? o.cmins : o.mins) / 60;
    var nowM = monthOf(d.total, o.daysNow) + (o.daysNow ? share * o.daysNow / Math.max(o.daysNew, 1) : 0), newM = monthOf(d.total, o.daysNew) + (o.daysNew ? share : 0);
    var allowNet = (o.allow || 0) * (1 - o.slab / 100 * 1.04);
    var nowH = hrsDay * o.daysNow * WEEKS / 12, newH = hrsDay * o.daysNew * WEEKS / 12;
    var extraMoney = newM - nowM + o.wfhAllow + o.other - allowNet;   // a month
    var extraHours = newH - nowH;                                      // a month
    var extraTime = extraHours * tv;                                   // ₹ a month, if time is valued
    var raise = extraMoney * 12 / (1 - o.slab / 100 * 1.04);           // gross a year
    var pct = o.takehome ? extraMoney / o.takehome : 0;
    /* by office days, 0..6 */
    var byDays = []; for (var k = 0; k <= 6; k++) { var mm = monthOf(d.total, k) + (k ? share * k / Math.max(o.daysNew, 1) : 0), hh = hrsDay * k * WEEKS / 12; byDays.push({ days: k, money: mm, hours: hh, withTime: mm + hh * tv }); }
    /* same trip by each mode at the new days (time kept the same unless the mode has its own minutes) */
    var modes = Object.keys(MODES).map(function (k) {
      var oo = Object.assign({}, o, { mode: k, ctype: "none" });
      if (k !== o.mode) { var M = MODES[k]; if (M.fuelUse) { oo.mileage = M.mileage; oo.wear = M.wear; oo.park = M.park; } oo.fare = k === "metro" ? o.metroFare : k === "cab" ? o.cabFare : o.fare; }
      var dd = dayCost(oo, o.km); return { mode: k, name: MODES[k].name, perDay: dd.total, month: monthOf(dd.total, o.daysNew) };
    });
    if (co) modes.push({ mode: "company", name: "company cab or bus" + (share ? ", part-paid" : ", free"), perDay: d.total + (o.daysNew ? share * 12 / (o.daysNew * WEEKS) : 0), month: newM });
    /* moving closer, at the new days */
    var dn = dayCost(o, o.nearKm), nearH = 2 * o.nearMins / 60 * o.daysNew * WEEKS / 12;
    var stay = o.rentNow + newM, move = o.rentNear + monthOf(dn.total, o.daysNew) + (o.daysNew ? share : 0);
    var moveDiff = move - stay;                                        // + means moving costs more a month
    var hoursSaved = newH - nearH;
    var moveNet = moveDiff - hoursSaved * tv;                          // after valuing time saved
    var payback = moveNet < 0 ? o.moveCost / -moveNet : null;          // months to recover the moving cost
    return { co: co, share: share, allowNet: allowNet, hourly: hourly, tv: tv, day: d, hrsDay: hrsDay, nowM: nowM, newM: newM, nowH: nowH, newH: newH, extraMoney: extraMoney, extraHours: extraHours, extraTime: extraTime,
             extraAll: extraMoney + extraTime, raise: raise, pct: pct, byDays: byDays, modes: modes,
             near: { day: dn, stay: stay, move: move, diff: moveDiff, hoursSaved: hoursSaved, net: moveNet, payback: payback, nearM: monthOf(dn.total, o.daysNew) + (o.daysNew ? share : 0) },
             yearMoney: extraMoney * 12, yearHours: extraHours * 12, daysYear: (o.daysNew - o.daysNow) * WEEKS };
  }
  var API = { calc: calc, MODES: MODES, WEEKS: WEEKS, HOURS: HOURS };
  if (NODE) { module.exports = API; return; }
  window.SalaristRTO = API;
  if (!document.getElementById("rtVerdict")) return;

  /* ---------- UI ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var fmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  function inr(v) { var r = Math.round(v); return (r < 0 ? "−" : "") + "₹" + fmt.format(Math.abs(r)); }
  function short(v) { var a = Math.abs(v), s = v < 0 ? "−" : ""; if (a >= 1e7) return s + "₹" + (a / 1e7).toFixed(2).replace(/\.?0+$/, "") + " Cr"; if (a >= 1e5) return s + "₹" + (a / 1e5).toFixed(2).replace(/\.?0+$/, "") + " L"; return s + "₹" + fmt.format(Math.round(a)); }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function hrs(h) { return Math.round(h) + (Math.round(h) === 1 ? " hour" : " hours"); }
  var S = { daysNow: 2, daysNew: 5, mode: "car", km: 20, mins: 70, mileage: 15, fuel: 111, wear: 3, park: 100, fare: 50, metroFare: 50, cabFare: 450, food: 150, wfhAllow: 0, other: 0,
            takehome: 110000, valueTime: 50, slab: 20, rentNow: 30000, rentNear: 42000, nearKm: 5, nearMins: 20, moveCost: 60000,
            ctype: "none", cshare: 1500, cmins: 80, allow: 0, mealPaid: 0 };
  var LIM = { daysNow: [0, 6], daysNew: [0, 6], km: [0, 200], mins: [0, 300], mileage: [1, 150], fuel: [0, 500], wear: [0, 50], park: [0, 5000], fare: [0, 10000], metroFare: [0, 10000], cabFare: [0, 20000],
              food: [0, 10000], wfhAllow: [0, 1e6], other: [0, 1e6], takehome: [0, 1e8], valueTime: [0, 100], slab: [0, 30], rentNow: [0, 1e7], rentNear: [0, 1e7], nearKm: [0, 200], nearMins: [0, 300], moveCost: [0, 1e7], cshare: [0, 1e6], cmins: [0, 300], allow: [0, 1e6], mealPaid: [0, 10000] };
  var MONEY = { fuel: 1, park: 1, fare: 1, metroFare: 1, cabFare: 1, food: 1, wfhAllow: 1, other: 1, takehome: 1, rentNow: 1, rentNear: 1, moveCost: 1, cshare: 1, allow: 1, mealPaid: 1 };
  var NUM = ["km", "mins", "mileage", "fuel", "wear", "park", "fare", "food", "wfhAllow", "other", "takehome", "rentNow", "rentNear", "nearKm", "nearMins", "moveCost", "cshare", "cmins", "allow", "mealPaid"];
  (function fromUrl() {
    var q = new URLSearchParams(location.search);
    NUM.concat(["daysNow", "daysNew", "valueTime", "slab", "metroFare", "cabFare"]).forEach(function (k) { var v = parseFloat(q.get(k)); if (isFinite(v) && v >= LIM[k][0] && v <= LIM[k][1]) S[k] = v; });
    if (MODES[q.get("mode")]) S.mode = q.get("mode"); if (["none", "free", "paid"].indexOf(q.get("ctype")) >= 0) S.ctype = q.get("ctype");
  })();
  var shows = [];
  function bind(k) {
    var el = $("rt-" + k), note = $("rt-" + k + "-w"); if (!el) return;
    function show() { el.value = MONEY[k] ? fmt.format(S[k]) : String(S[k]); if (note) note.textContent = MONEY[k] && S[k] >= 1e5 ? short(S[k]) : ""; }
    el.addEventListener("input", function () {
      var raw = MONEY[k] ? this.value.replace(/[^0-9]/g, "") : this.value.replace(/[^0-9.]/g, "");
      if (MONEY[k]) this.value = raw ? fmt.format(+raw) : "";
      var v = parseFloat(raw); if (!isFinite(v)) { if (raw === "") { S[k] = 0; render(); } return; }
      if (v < LIM[k][0] || v > LIM[k][1]) return;
      S[k] = v; if (k === "fare") { if (S.mode === "metro") S.metroFare = v; if (S.mode === "cab") S.cabFare = v; } render();
    });
    el.addEventListener("blur", show); shows.push(function () { if (document.activeElement !== el) show(); }); show();
  }
  NUM.forEach(bind);
  function segs(key, num) { document.querySelectorAll("[data-" + key + "]").forEach(function (b) { b.addEventListener("click", function () { var v = b.getAttribute("data-" + key); S[key] = num ? +v : v;
    if (key === "mode") { var M = MODES[v]; if (M.fuelUse) { S.mileage = M.mileage; S.wear = M.wear; S.park = M.park; } else S.fare = v === "metro" ? S.metroFare : S.cabFare; }
    render(); }); }); }
  segs("daysNow", 1); segs("daysNew", 1); segs("mode"); segs("valueTime", 1); segs("slab", 1); segs("ctype");
  function press(key) { document.querySelectorAll("[data-" + key + "]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-" + key)) === String(S[key]) ? "true" : "false"); }); }
  function opts(ch) { var o = Object.assign({}, S); if (ch) ch(o); return o; }
  var last = null;
  function chart(r) {
    var B = r.byDays, W = 420, Hh = 230, pl = 58, pr = 12, pt = 16, pb = 30, n = B.length;
    var mx = Math.max.apply(null, B.map(function (b) { return Math.max(b.money, b.withTime); })) * 1.08 || 1;
    var st = Math.pow(10, Math.floor(Math.log10(mx / 4))), qq = mx / 4 / st; st *= qq <= 1 ? 1 : qq <= 2 ? 2 : qq <= 2.5 ? 2.5 : qq <= 5 ? 5 : 10; mx = st * Math.ceil(mx / st);
    var bw = (W - pl - pr) / n, g = "";
    function yy(v) { return pt + (mx - v) / mx * (Hh - pt - pb); }
    for (var v = 0; v <= mx + 1; v += st) { var gy = yy(v).toFixed(1); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (+gy + 3) + '" class="al" text-anchor="end">' + short(v) + "</text>"; }
    B.forEach(function (b, i) {
      var x = pl + i * bw + bw * 0.18, w = bw * 0.64, cur = b.days === S.daysNew, was = b.days === S.daysNow;
      if (S.valueTime) g += '<rect x="' + x.toFixed(1) + '" y="' + yy(b.withTime).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (yy(b.money) - yy(b.withTime)).toFixed(1) + '" fill="var(--leave)" opacity="' + (cur ? 0.9 : 0.45) + '" rx="3"/>';
      g += '<rect x="' + x.toFixed(1) + '" y="' + yy(b.money).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (yy(0) - yy(b.money)).toFixed(1) + '" fill="var(--brand)" opacity="' + (cur ? 1 : was ? 0.75 : 0.4) + '" rx="3"/>';
      g += '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (Hh - 12) + '" class="al" text-anchor="middle"' + (cur || was ? ' font-weight="800"' : "") + ">" + b.days + (cur ? " (new)" : was ? " (now)" : "") + "</text>";
    });
    return '<svg viewBox="0 0 ' + W + " " + Hh + '" role="img" aria-label="Monthly cost of going to office, by office days a week">' + g + "</svg>";
  }
  function render() {
    ["daysNow", "daysNew", "mode", "valueTime", "slab", "ctype"].forEach(press);
    var co = S.ctype !== "none", fuel = MODES[S.mode].fuelUse; $("rtOwnF").hidden = co; $("rtFuelF").hidden = co || !fuel; $("rtFareF").hidden = co || fuel;
    $("rtCoF").hidden = !co; $("rtShareF").hidden = S.ctype !== "paid";
    $("rt-fareLblT").textContent = S.mode === "cab" ? "Cab or auto fare, one way" : "Metro or bus fare, one way";
    var r = calc(opts()); last = r;
    var more = S.daysNew - S.daysNow, worse = r.extraMoney > 0;
    $("rtVerdict").className = "verdict" + (worse ? " short" : "");
    $("rtVerdict").innerHTML = '<p class="k">' + S.daysNow + " → " + S.daysNew + " office days a week, by " + (r.co ? (S.ctype === "free" ? "free company transport" : "company transport you part-pay") : { car: "car", bike: "two-wheeler", metro: "metro or bus", cab: "cab or auto" }[S.mode]) + ", " + S.km + " km each way</p>" +
      '<p class="v">' + (worse ? "Going in costs you <b>" + inr(r.extraMoney) + "</b> more a month" : "Going in costs you <b>" + inr(-r.extraMoney) + "</b> less a month") + "</p>" +
      '<p class="k">' + (r.extraHours > 0 ? "Plus " + hrs(r.extraHours) + " more on the road each month" + (S.valueTime ? ", worth " + inr(r.extraTime) + " at " + (S.valueTime === 100 ? "your" : "half your") + " take-home per hour. All in: " + inr(r.extraAll) + " a month." : ".") : "") +
      (worse ? " That's " + (r.pct * 100).toFixed(1) + "% of your take-home; you'd need a pay rise of about " + short(r.raise) + " a year to stand still." : "") + "</p>";
    $("rtS1").textContent = inr(r.extraMoney); $("rtS1h").textContent = inr(r.yearMoney) + " a year; " + inr(r.day.total) + " for each office day";
    $("rtS2").textContent = hrs(r.extraHours); $("rtS2h").textContent = Math.round(r.yearHours) + " hours a year, about " + Math.round(r.yearHours / 9) + " working days";
    $("rtS3").textContent = short(r.raise); $("rtS3h").textContent = "A year, before tax, at your " + S.slab + "% slab, to cover the extra money (not the time)";
    var N = r.near;
    $("rtS4").textContent = N.diff > 0 ? "+" + inr(N.diff) : inr(N.diff); $("rtS4h").textContent = "A month if you move " + S.nearKm + " km away (rent " + inr(S.rentNear) + "), saving " + hrs(N.hoursSaved) + " a month";
    var notes = [];
    notes.push("<b>One office day:</b> " + (r.co ? (S.ctype === "free" ? "the company cab or bus is free" : "the company cab or bus costs you " + inr(S.cshare) + " a month at " + S.daysNew + " days") : MODES[S.mode].fuelUse ? inr(2 * S.km / S.mileage * S.fuel) + " fuel for " + 2 * S.km + " km, " + inr(2 * S.km * S.wear) + " wear and tear, " + inr(S.park) + " parking" : inr(2 * S.fare) + " in fares") + ", and " + inr(r.day.food) + " for food and coffee you wouldn't buy at home" + (S.mealPaid ? " (after " + inr(Math.min(S.mealPaid, S.food)) + " paid by your employer)" : "") + ": " + inr(r.day.total) + " a day. With " + (more > 0 ? more + " more office days a week, that's about " + Math.round(more * 46 / 12) + " more office days a month" : "fewer days") + " (46 working weeks a year).");
    if (S.allow) notes.push("<b>Your employer's travel allowance:</b> " + inr(S.allow) + " a month is taxed as salary, so it covers " + inr(r.allowNet) + " a month after tax at your " + S.slab + "% slab. That's taken off the extra cost.");
    if (S.wfhAllow || S.other) notes.push("<b>Other costs:</b> " + (S.wfhAllow ? inr(S.wfhAllow) + " work-from-home allowance you lose" : "") + (S.wfhAllow && S.other ? " and " : "") + (S.other ? inr(S.other) + " of other monthly costs (childcare, help at home)" : "") + " are added.");
    notes.push("<b>Your time:</b> " + (2 * (r.co ? S.cmins : S.mins)) + " minutes a day on the road. " + (S.valueTime ? "At " + (S.valueTime === 100 ? "your" : "half your") + " take-home per working hour (" + inr(r.hourly) + " an hour, " + inr(S.takehome) + " ÷ 198 hours), an hour is worth " + inr(r.tv) + "." : "Not valued in money here; switch it on to see what it's worth."));
    notes.push("<b>Moving closer:</b> rent " + inr(S.rentNear) + " instead of " + inr(S.rentNow) + ", with a " + S.nearKm + " km commute (" + inr(N.nearM) + " a month): " + (N.diff > 0 ? inr(N.diff) + " a month more" : inr(-N.diff) + " a month less") + " in money, " + hrs(N.hoursSaved) + " saved." +
      (S.valueTime ? (N.net < 0 ? " Counting your time it comes out " + inr(-N.net) + " a month ahead; the " + inr(S.moveCost) + " moving cost is earned back in about " + Math.ceil(N.payback) + " months." : " Even counting your time, it's " + inr(N.net) + " a month dearer.") : ""));
    notes.push("<b>Tax:</b> commuting costs aren't deductible, and a transport allowance is taxable for most employees. Meal cards are tax-free up to ₹200 a meal in both regimes from April 2026: ask HR whether part of your pay can move to one.");
    $("rtRule").innerHTML = notes.join("<br><br>"); r.notes = notes.map(function (n) { var m = /^<b>(.*?):<\/b>\s*([\s\S]*)$/.exec(n); var t = m[2].replace(/<[^>]+>/g, ""); return [m[1], t.charAt(0).toUpperCase() + t.slice(1)]; });
    function alt(ch) { var x = calc(opts(ch)); return inr(x.extraMoney); }
    r.what = [["3 days instead of " + S.daysNew, alt(function (o) { o.daysNew = Math.min(3, o.daysNew); })], ["By metro, " + inr(S.metroFare) + " a trip", alt(function (o) { o.mode = "metro"; o.fare = o.metroFare; })],
      ["By two-wheeler", alt(function (o) { o.mode = "bike"; o.mileage = 45; o.wear = 1; o.park = 20; })], ["Lunch from home", alt(function (o) { o.food = 0; })]];
    $("rtSens").innerHTML = r.what.map(function (w) { return '<div class="sv"><span class="l">' + w[0] + '</span><span class="n">' + w[1] + "</span></div>"; }).join("");
    $("rtChart").innerHTML = chart(r);
    $("rtModes").innerHTML = '<div class="mrow mhead"><span>Same trip by</span><span>A day</span><span>A month at ' + S.daysNew + " days</span></div>" +
      r.modes.map(function (m) { var on = r.co ? m.mode === "company" : m.mode === S.mode; return '<div class="mrow' + (on ? " on" : "") + '"><b>' + cap(m.name.replace("your ", "")) + (on ? " <em>yours</em>" : "") + "</b><span>" + inr(m.perDay) + "</span><span>" + inr(m.month) + "</span></div>"; }).join("");
    $("rtBarT").textContent = r.extraMoney >= 0 ? inr(r.extraMoney) + " more a month" : inr(-r.extraMoney) + " less a month";
    shows.forEach(function (f) { f(); });
  }

  /* ---------- Reports ---------- */
  function say(m) { var s = $("rtStatus"); s.textContent = m; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function spec() {
    var r = last, N = r.near;
    var inputs = [["Office days a week", S.daysNow + " now, " + S.daysNew + " new"], ["Commute", cap(MODES[S.mode].name.replace("your ", "")) + ", " + S.km + " km, " + S.mins + " min"]]
      .concat(MODES[S.mode].fuelUse ? [["Mileage", S.mileage + " km a litre"], ["Fuel price", inr(S.fuel) + " a litre"], ["Wear and tear", inr(S.wear) + " a km"], ["Parking", inr(S.park) + " a day"]] : [["Fare", inr(S.fare) + " one way"]])
      .concat(r.co ? [["Company transport", S.ctype === "free" ? "Free, " + S.cmins + " min each way" : inr(S.cshare) + " a month, " + S.cmins + " min each way"]] : [])
      .concat([["Food and coffee at office", inr(S.food) + " a day"], ["Food paid by employer", inr(S.mealPaid) + " a day"], ["Travel allowance", inr(S.allow) + " a month (taxable)"], ["WFH allowance lost", inr(S.wfhAllow) + " a month"], ["Other costs", inr(S.other) + " a month"], ["Take-home", inr(S.takehome) + " a month"],
        ["Time valued at", S.valueTime ? S.valueTime + "% of take-home per hour" : "Not valued"], ["Tax slab", S.slab + "%"], ["Rent now / closer", inr(S.rentNow) + " / " + inr(S.rentNear)], ["Closer commute", S.nearKm + " km, " + S.nearMins + " min each way"], ["Moving cost", inr(S.moveCost)]]);
    return {
      title: "Back to Office Cost", path: "salarist.in/return-to-office-cost-calculator", url: location.origin + location.pathname, file: "salarist-back-to-office-cost",
      question: "What does going back to office cost me?",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#rtVerdict p"), function (x) { return x.textContent; }), verdictColor: r.extraMoney > 0 ? "amber" : "blue",
      inputs: inputs,
      keyNums: [["Extra a month", inr(r.extraMoney), -r.extraMoney], ["Extra hours a month", String(Math.round(r.extraHours)), 0], ["Rise to break even", short(r.raise), 0], ["Moving closer", (N.diff > 0 ? "+" : "") + inr(N.diff), -N.diff]],
      sensTitle: "Extra a month if", sens: r.what.slice(0, 3), sensCurrent: -1,
      chartTitle: "Cost a month by office days a week", chartNote: "Blue: money a month. Amber: with your commute time valued as you chose. Green: what you spend now.", xlsxChartTitle: "₹ a month",
      chart: (function () { var mo = [], wt = [], nw = []; for (var i = 0; i <= 72; i++) { var dd = i / 12; mo.push(r.day.total * dd * 46 / 12); wt.push(r.day.total * dd * 46 / 12 + r.hrsDay * dd * 46 / 12 * r.tv); nw.push(r.nowM); }
        return { series: [{ name: "Money a month", color: "blue", data: mo }, { name: "With time valued", color: "amber", data: wt }, { name: "What you spend now", color: "green", data: nw }], cross: null }; })(),
      chartYears: [0, 1, 2, 3, 4, 5, 6], chartXLabel: "Office days a week", chartAge0: 0,
      money: { title: "One office day, and the month", cols: ["Amount", "What it is"], rows: [["Travel, there and back", inr(r.day.travel), r.co ? "Company transport" : cap(MODES[S.mode].name.replace("your ", ""))], ["Food and coffee", inr(S.food), "Extra on office days"], ["An office day", inr(r.day.total), "", "total"],
        ["A month now (" + S.daysNow + " days a week)", inr(r.nowM), "46 working weeks a year"], ["A month at " + S.daysNew + " days", inr(r.newM), ""], ["WFH allowance lost and other", inr(S.wfhAllow + S.other), "A month"], ["Travel allowance, after tax", "−" + inr(r.allowNet), "A month"], ["Extra a month", inr(r.extraMoney), "", "total"],
        ["Extra hours a month", String(Math.round(r.extraHours)), S.valueTime ? "Worth " + inr(r.extraTime) : ""], ["Pay rise to break even", inr(r.raise), "A year, before tax"]], note: r.notes, noteTitle: "What this means for you" },
      tables: [{ title: "Cost by office days a week", sheet: "By days", cols: ["Office days a week", "Money a month", "Hours a month", "With time valued"],
        yearly: r.byDays.map(function (b) { return [b.days, b.money, Math.round(b.hours) + " hours", b.withTime]; }), monthly: null },
        { title: "Same trip by each mode", sheet: "By mode", cols: ["Mode", "An office day", "A month at " + S.daysNew + " days"], yearly: r.modes.map(function (m) { return [cap(m.name.replace("your ", "")), m.perDay, m.month]; }), monthly: null }],
      notes: ["46 working weeks a year (52 less about 4 weeks of leave and 2 of public holidays). Monthly = yearly ÷ 12.", "Take-home per working hour = monthly take-home ÷ 198 (22 days × 9 hours).", "Pay rise to break even covers the extra money only, after tax at your slab plus 4% cess."],
      taxRules: ["Commuting costs are not deductible from salary. Transport allowance for commuting is exempt only for employees with specified disabilities (Rule 280, Income-tax Rules, 2026). Meal benefits up to ₹200 a meal are tax-free in both regimes from 1 April 2026 (Rule 15)."],
      short: short, inr: inr
    };
  }
  function busy(b, on) { b.disabled = on; b.setAttribute("aria-busy", on ? "true" : "false"); }
  $("rtPdf").addEventListener("click", function () { var b = this; busy(b, true); say("Making your PDF…"); withReport(function (Kt) { Kt.pdf(spec()).then(function () { busy(b, false); say("PDF report downloaded."); }, function () { busy(b, false); say("Couldn't make the PDF. Please try again."); }); }); });
  $("rtXlsx").addEventListener("click", function () { var b = this; busy(b, true); withReport(function (Kt) { try { Kt.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(b, false); }); });
  $("rtShare").addEventListener("click", function () {
    var q = new URLSearchParams(); NUM.concat(["daysNow", "daysNew", "mode", "valueTime", "slab", "metroFare", "cabFare", "ctype"]).forEach(function (k) { q.set(k, S[k]); });
    var t = location.origin + location.pathname + "?" + q.toString();
    function ok() { say("Link copied. Anyone with it sees these numbers."); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { say("Couldn't copy. Copy the address bar instead."); }); else say("Copy the address bar to share.");
  });
  (function bar() {
    var el = $("rtBar"), seen = false, inForm = false; if (!("IntersectionObserver" in window)) return;
    function upd() { el.hidden = seen || !inForm; }
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("rtVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe(document.querySelector(".rtx .lp-setup"));
    $("rtBarBtn").addEventListener("click", function () { $("rtVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  render();
})();
