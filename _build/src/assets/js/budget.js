/* Salarist: Budget Planner. Runs entirely in the browser; nothing is stored or sent. Save and load as a CSV file. */
(function () {
  "use strict";
  var DPY = 365;   /* daily amounts: × 365 a year, ÷ 12 a month */

  /* ---------- Core ---------- */
  function monthly(l) { var a = +l.amt || 0; return l.freq === "y" ? a / 12 : l.freq === "d" ? a * DPY / 12 : a; }
  function summarise(st) {
    var inc = 0, incRegular = 0, salary = 0, need = 0, want = 0, save = 0, emi = 0, setAside = 0, secs = {}, yearly = [];
    st.lines.forEach(function (l) {
      var m = monthly(l); if (!m) return;
      if (l.sec === "Income") { inc += m; if (l.freq !== "y") incRegular += m; if (l.salary) salary += m; return; }
      if (l.type === "need") need += m; else if (l.type === "want") want += m; else save += m;
      if (l.emi) emi += m;
      if (l.freq === "y") { setAside += m; yearly.push(l); }
      secs[l.sec] = (secs[l.sec] || 0) + m;
    });
    var spend = need + want, left = inc - spend - save;
    return { inc: inc, incRegular: incRegular, salary: salary, need: need, want: want, save: save, emi: emi, spend: spend, left: left,
             setAside: setAside, yearly: yearly, secs: secs,
             saveRate: inc > 0 ? Math.max(0, save + left) / inc : 0,
             emiLoad: salary > 0 ? emi / salary : (incRegular > 0 ? emi / incRegular : 0),
             efMonths: need > 0 ? st.ef / need : null };
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { monthly: monthly, summarise: summarise }; return; }

  /* ---------- Defaults ---------- */
  var EXP = ["Home", "Family", "Getting around", "EMIs and insurance", "Lifestyle", "Occasions"], SECTIONS = ["Income"].concat(EXP, ["Savings"]);
  var DEF = [
    ["Income", "In-hand salary", "m", "need", "e.g. 85,000", { salary: 1 }], ["Income", "Bonus or variable pay", "y", "need", "e.g. 1,20,000"], ["Income", "Other income (rent received, freelance)", "m", "need", "e.g. 5,000"],
    ["Home", "Rent", "m", "need", "e.g. 24,000"], ["Home", "Home loan EMI", "m", "need", "e.g. 45,000", { emi: 1 }], ["Home", "Society maintenance", "m", "need", "e.g. 3,500"],
    ["Home", "Electricity", "m", "need", "e.g. 2,500"], ["Home", "Cooking gas", "m", "need", "e.g. 1,000"], ["Home", "Internet and mobile", "m", "need", "e.g. 1,500"], ["Home", "Domestic help", "m", "need", "e.g. 6,000"],
    ["Family", "Groceries", "m", "need", "e.g. 12,000"], ["Family", "Milk, bread and daily needs", "d", "need", "e.g. 120"], ["Family", "School fees", "y", "need", "e.g. 1,50,000"],
    ["Family", "Support for parents", "m", "need", "e.g. 10,000"], ["Family", "Medicines and doctor visits", "m", "need", "e.g. 2,000"],
    ["Getting around", "Fuel", "m", "need", "e.g. 4,000"], ["Getting around", "Cabs, autos and metro", "m", "need", "e.g. 3,000"], ["Getting around", "Car or bike EMI", "m", "need", "e.g. 12,000", { emi: 1 }],
    ["Getting around", "Vehicle insurance and servicing", "y", "need", "e.g. 25,000"],
    ["EMIs and insurance", "Other EMIs (personal loan, credit card)", "m", "need", "e.g. 8,000", { emi: 1 }], ["EMIs and insurance", "Health insurance premium", "y", "need", "e.g. 25,000"],
    ["EMIs and insurance", "Life insurance premium", "y", "need", "e.g. 15,000"],
    ["Lifestyle", "Eating out and ordering in", "m", "want", "e.g. 6,000"], ["Lifestyle", "Shopping and clothes", "m", "want", "e.g. 4,000"], ["Lifestyle", "OTT and subscriptions", "m", "want", "e.g. 800"],
    ["Lifestyle", "Gym, hobbies and personal care", "m", "want", "e.g. 2,500"],
    ["Occasions", "Festivals and gifts", "y", "want", "e.g. 40,000"], ["Occasions", "Weddings and family functions", "y", "want", "e.g. 30,000"], ["Occasions", "Travel and holidays", "y", "want", "e.g. 80,000"],
    ["Occasions", "Gadgets and appliances", "y", "want", "e.g. 30,000"],
    ["Savings", "SIPs and mutual funds", "m", "save", "e.g. 15,000"], ["Savings", "Recurring deposit or PPF", "m", "save", "e.g. 5,000"],
    ["Savings", "Emergency fund top-up", "m", "save", "e.g. 5,000"], ["Savings", "NPS or other retirement savings", "m", "save", "e.g. 3,000"]
  ];
  var uid = 0;
  function mk(d) { var x = d[5] || {}; return { id: ++uid, sec: d[0], name: d[1], freq: d[2], type: d[3], ph: d[4] || "", amt: 0, salary: !!x.salary, emi: !!x.emi }; }
  var S = { lines: DEF.map(mk), ef: 0, tNeed: 50, tWant: 30, tSave: 20 };

  var $ = function (id) { return document.getElementById(id); };
  var fmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  function inr(v) { var r = Math.round(v); return (r < 0 ? "−" : "") + "₹" + fmt.format(Math.abs(r)); }
  function short(v) {
    var a = Math.abs(v), s = v < 0 ? "−" : "";
    if (a >= 1e7) return s + "₹" + (a / 1e7).toFixed(2).replace(/\.?0+$/, "") + " Cr";
    if (a >= 1e5) return s + "₹" + (a / 1e5).toFixed(2).replace(/\.?0+$/, "") + " L";
    return s + "₹" + fmt.format(Math.round(a));
  }
  function pct(x) { return Math.round(x * 100) + "%"; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var TYPE_TXT = { need: "Need", want: "Want", save: "Saving" }, FREQ_TXT = { m: "Monthly", y: "Yearly", d: "Daily" };

  /* ---------- Editor ---------- */
  function rowHtml(l) {
    var inc = l.sec === "Income";
    return '<div class="bl" data-id="' + l.id + '">' +
      '<input class="bl-n" type="text" value="' + esc(l.name) + '" aria-label="Item name" maxlength="60">' +
      '<div class="bl-a"><span>₹</span><input class="bl-v" type="text" inputmode="numeric" autocomplete="off" placeholder="' + esc(l.ph) + '" aria-label="Amount for ' + esc(l.name) + '" value="' + (l.amt ? fmt.format(l.amt) : "") + '"></div>' +
      '<select class="bl-f" aria-label="How often for ' + esc(l.name) + '"><option value="m"' + (l.freq === "m" ? " selected" : "") + '>Monthly</option><option value="y"' + (l.freq === "y" ? " selected" : "") + '>Yearly</option><option value="d"' + (l.freq === "d" ? " selected" : "") + ">Daily</option></select>" +
      (inc || l.sec === "Savings" ? '<span class="bl-t" aria-hidden="true"></span>' : '<button type="button" class="bl-t t-' + l.type + '" aria-label="' + esc(l.name) + ' counts as a ' + TYPE_TXT[l.type].toLowerCase() + '. Tap to change.">' + TYPE_TXT[l.type] + "</button>") +
      '<button type="button" class="bl-x" aria-label="Remove ' + esc(l.name) + '">×</button></div>';
  }
  function secList(sec, open) {
    var ls = S.lines.filter(function (l) { return l.sec === sec; });
    return '<details class="bsec" data-sec="' + esc(sec) + '"' + (open ? " open" : "") + '><summary><span class="bsec-n">' + esc(sec) + '</span><span class="bsec-t" data-tot="' + esc(sec) + '"></span></summary>' +
      ls.map(rowHtml).join("") + '<button type="button" class="bl-add" data-add="' + esc(sec) + '">+ Add a line</button></details>';
  }
  function drawEditor() {
    var open = {}; document.querySelectorAll("#bpEdit details[open]").forEach(function (d) { open[d.getAttribute("data-sec")] = 1; });
    var extra = S.lines.map(function (l) { return l.sec; }).filter(function (sc, i, a) { return SECTIONS.indexOf(sc) < 0 && a.indexOf(sc) === i; });
    var inc = S.lines.filter(function (l) { return l.sec === "Income"; });
    var h = '<section class="bgrp g-inc"><div class="bgrp-h"><h3>Income</h3><span class="bsec-t" data-tot="Income"></span></div>' +
      '<div class="bsec open" data-sec="Income">' + inc.map(rowHtml).join("") + '<button type="button" class="bl-add" data-add="Income">+ Add a line</button></div></section>';
    h += '<section class="bgrp g-exp"><div class="bgrp-h"><h3>Expenses</h3><span class="bsec-t" data-tot="__exp"></span><button type="button" class="bgrp-x" data-all="exp">Open all</button></div>' +
      EXP.concat(extra).map(function (sc) { return secList(sc, open[sc]); }).join("") + "</section>";
    h += '<section class="bgrp g-sav"><div class="bgrp-h"><h3>Savings</h3><span class="bsec-t" data-tot="__sav"></span></div>' + secList("Savings", open.Savings).replace('<span class="bsec-n">Savings</span>', '<span class="bsec-n">SIPs, deposits and more</span>').replace('data-tot="Savings"', 'data-tot="__savc"') + "</section>";
    $("bpEdit").innerHTML = h; syncAll();
  }
  function syncAll() { var b = document.querySelector("[data-all]"); if (!b) return; var ds = document.querySelectorAll(".g-exp details"), all = Array.prototype.every.call(ds, function (d) { return d.open; }); b.textContent = all ? "Close all" : "Open all"; }
  $("bpEdit").addEventListener("toggle", syncAll, true);
  function find(el) { var r = el.closest(".bl"); return r ? S.lines.filter(function (l) { return l.id === +r.getAttribute("data-id"); })[0] : null; }
  $("bpEdit").addEventListener("input", function (e) {
    var l = find(e.target); if (!l) return;
    if (e.target.classList.contains("bl-v")) { var raw = e.target.value.replace(/[^0-9]/g, "").slice(0, 10); l.amt = raw ? +raw : 0; e.target.value = raw ? fmt.format(+raw) : ""; render(); }
    if (e.target.classList.contains("bl-n")) { l.name = e.target.value; }
  });
  $("bpEdit").addEventListener("change", function (e) { var l = find(e.target); if (l && e.target.classList.contains("bl-f")) { l.freq = e.target.value; render(); } });
  $("bpEdit").addEventListener("click", function (e) {
    var t = e.target, l = find(t);
    if (t.classList.contains("bl-t") && t.tagName === "BUTTON" && l) { l.type = l.type === "need" ? "want" : "need"; t.className = "bl-t t-" + l.type; t.textContent = TYPE_TXT[l.type]; t.setAttribute("aria-label", l.name + " counts as a " + TYPE_TXT[l.type].toLowerCase() + ". Tap to change."); render(); }
    if (t.classList.contains("bl-x") && l) { S.lines = S.lines.filter(function (x) { return x !== l; }); t.closest(".bl").remove(); render(); }
    if (t.hasAttribute("data-all")) { var ds = document.querySelectorAll(".g-exp details"), all = Array.prototype.every.call(ds, function (d) { return d.open; }); ds.forEach(function (d) { d.open = !all; }); syncAll(); return; }
    if (t.hasAttribute("data-add")) {
      var sec = t.getAttribute("data-add"), nl = mk([sec, "", "m", sec === "Savings" ? "save" : sec === "Lifestyle" || sec === "Occasions" ? "want" : "need", ""]);
      S.lines.push(nl); t.insertAdjacentHTML("beforebegin", rowHtml(nl)); var row = t.previousElementSibling; row.querySelector(".bl-n").focus(); render();
    }
  });
  function bindNum(id, key, max) {
    var el = $(id); el.value = S[key] ? fmt.format(S[key]) : (key === "ef" ? "" : String(S[key]));
    el.addEventListener("input", function () { var raw = this.value.replace(/[^0-9]/g, "").slice(0, 10); S[key] = Math.min(max, raw ? +raw : 0); this.value = raw ? fmt.format(+raw) : ""; render(); });
  }
  bindNum("bp-ef", "ef", 1e10);
  ["tNeed", "tWant", "tSave"].forEach(function (k) { var el = $("bp-" + k); el.value = S[k]; el.addEventListener("input", function () { var v = parseInt(this.value, 10); if (v >= 0 && v <= 100) { S[k] = v; render(); } }); });

  /* ---------- Results ---------- */
  var last = null;
  function bar(parts, total) {
    return '<div class="sbar" role="img" aria-label="' + parts.map(function (p) { return p[1] + " " + pct(total ? p[0] / total : 0); }).join(", ") + '">' +
      parts.map(function (p) { var w = total > 0 ? Math.max(0, p[0]) / total * 100 : 0; return w > 0 ? '<i class="' + p[2] + '" style="width:' + w.toFixed(2) + '%"></i>' : ""; }).join("") + "</div>";
  }
  function render() {
    var r = summarise(S); last = r;
    var v = $("bpVerdict");
    if (r.inc <= 0) {
      v.className = "verdict"; v.innerHTML = '<p class="k">Start with your income</p><p class="v">Enter your <b>in-hand salary</b></p><p class="k">Then add your expenses. Every number updates as you type.</p>';
    } else if (r.left >= 0) {
      v.className = "verdict"; v.innerHTML = '<p class="k">After expenses and planned savings</p><p class="v">You have <b>' + short(r.left) + '</b> left each month</p><p class="k">You save ' + pct(r.saveRate) + " of your income" + (r.left > 0 ? ", counting what's left over." : ".") + (r.setAside > 0 ? " That's after setting aside " + short(r.setAside) + " a month for yearly costs." : "") + "</p>";
    } else {
      v.className = "verdict short"; v.innerHTML = '<p class="k">Your plan spends more than you earn</p><p class="v">You\'re short by <b>' + short(-r.left) + '</b> a month</p><p class="k">Trim wants first, or spread a big yearly cost over more months.</p>';
    }
    $("bpBarT").textContent = r.inc <= 0 ? "Enter your salary" : r.left >= 0 ? short(r.left) + " left each month" : "Short by " + short(-r.left) + " a month";
    $("bpInc").textContent = short(r.inc);
    $("bpSave").textContent = r.inc > 0 ? pct(r.saveRate) : "—";
    $("bpEmi").textContent = r.inc > 0 ? pct(r.emiLoad) : "—";
    $("bpEf").textContent = r.efMonths === null ? "—" : (r.efMonths >= 10 ? Math.round(r.efMonths) : r.efMonths.toFixed(1)) + " months";
    var spendAll = r.need + r.want + r.save + Math.max(0, r.left), base = Math.max(r.inc, r.need + r.want + r.save);
    $("bpSplit").innerHTML =
      '<div class="srow"><span class="sl">Your plan</span>' + bar([[r.need, "Needs", "n"], [r.want, "Wants", "w"], [Math.max(0, r.save + r.left), "Savings and left over", "s"]], base) + "</div>" +
      '<div class="srow"><span class="sl">Your target</span>' + bar([[S.tNeed, "Needs", "n"], [S.tWant, "Wants", "w"], [S.tSave, "Savings", "s"]], S.tNeed + S.tWant + S.tSave) + "</div>" +
      '<dl class="sleg">' + [["n", "Needs", r.need, S.tNeed], ["w", "Wants", r.want, S.tWant], ["s", "Savings and left over", Math.max(0, r.save + r.left), S.tSave]].map(function (x) {
        return '<div><dt><i class="' + x[0] + '"></i>' + x[1] + "</dt><dd>" + inr(x[2]) + " · " + (r.inc > 0 ? pct(x[2] / r.inc) : "—") + ' <span class="tg">target ' + x[3] + "%</span></dd></div>"; }).join("") + "</dl>";
    var tips = [];
    if (r.inc > 0) {
      if (r.need / r.inc * 100 > S.tNeed + 5) tips.push("Needs take " + pct(r.need / r.inc) + " of your income, above your " + S.tNeed + "% target. Housing and EMIs are usually the biggest lever.");
      if (r.want / r.inc * 100 > S.tWant + 5) tips.push("Wants take " + pct(r.want / r.inc) + ", above your " + S.tWant + "% target. Eating out and shopping are the easiest to trim.");
      if (r.saveRate * 100 < S.tSave - 2 && r.left >= 0) tips.push("You save " + pct(r.saveRate) + ", below your " + S.tSave + "% target.");
      if (r.efMonths !== null && r.efMonths < 6) tips.push("Your emergency fund covers " + (r.efMonths < 1 ? "less than a month" : r.efMonths.toFixed(1) + " months") + " of needs. Building it to 6 months comes before investing for growth.");
    }
    $("bpTips").innerHTML = tips.map(function (t) { return "<li>" + t + "</li>"; }).join("");
    $("bpTips").hidden = !tips.length;
    /* yearly costs */
    var ys = r.yearly.slice().sort(function (a, b) { return b.amt - a.amt; });
    $("bpYearly").innerHTML = ys.length ? '<p class="ytot">Put aside <b>' + inr(r.setAside) + "</b> every month for these</p><ul>" +
      ys.map(function (l) { return "<li><span>" + esc(l.name || "Untitled") + "</span><span>" + inr(l.amt) + " a year → " + inr(l.amt / 12) + " a month</span></li>"; }).join("") + "</ul>" :
      '<p class="hint">Add yearly costs like school fees, insurance premiums, festivals and holidays. They\'re what usually breaks a budget, so we turn each into a monthly amount to put aside.</p>';
    /* categories */
    var secs = Object.keys(r.secs).sort(function (a, b) { return r.secs[b] - r.secs[a]; }), mx = secs.length ? r.secs[secs[0]] : 0;
    $("bpCats").innerHTML = secs.map(function (s) { return '<li><span class="cn">' + esc(s) + '</span><span class="cb"><i style="width:' + (mx ? r.secs[s] / mx * 100 : 0).toFixed(1) + '%"></i></span><span class="cv">' + inr(r.secs[s]) + "</span></li>"; }).join("") || '<li class="hint">Your spending by section shows here.</li>';
    document.querySelectorAll("[data-tot]").forEach(function (el) {
      var s = el.getAttribute("data-tot"), t = s === "Income" ? r.inc : s === "__exp" ? r.spend : s === "__sav" || s === "__savc" ? r.save : r.secs[s] || 0;
      el.textContent = t ? inr(t) + " a month" : "";
    });
    /* next decisions */
    var amt = function (name) { var l = S.lines.filter(function (x) { return x.name === name; })[0]; return l ? monthly(l) : 0; };
    var nx = [];
    if (r.left > 1000 && amt("Home loan EMI") > 0) nx.push(['/prepay-vs-invest/?extra=' + Math.min(500000, Math.round(r.left / 1000) * 1000), "Spare money and a home loan? See whether to prepay it or invest " + short(Math.round(r.left / 1000) * 1000) + " a month"]);
    if (amt("Rent") > 0) nx.push(["/rent-vs-buy/?rent=" + Math.round(amt("Rent")), "Paying " + short(amt("Rent")) + " in rent? Check whether buying would leave you richer"]);
    if (amt("Travel and holidays") > 0) nx.push(["/leave-planner-2027/", "Budgeting for holidays? Turn your leave into the longest breaks of 2027"]);
    $("bpNext").innerHTML = nx.map(function (n) { return '<a class="next" href="' + n[0] + '"><span class="k">Your next decision</span><b>' + n[1] + "</b></a>"; }).join("");
  }

  /* ---------- CSV save and load ---------- */
  function today() { return new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  function stamp() { var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; }; return p(d.getDate()) + p(d.getMonth() + 1) + String(d.getFullYear()).slice(2); }
  function csvCell(v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function toCsv() {
    var rows = [["Salarist Budget Planner · salarist.in/budget-planner · Saved " + today()],
      ["To keep planning, open salarist.in/budget-planner and choose Load budget. You can edit amounts here first."], [],
      ["Section", "Item", "Frequency", "Amount", "Type", "Tag"]];
    S.lines.forEach(function (l) { rows.push([l.sec, l.name, FREQ_TXT[l.freq], l.amt || "", l.sec === "Income" ? "" : TYPE_TXT[l.type], l.salary ? "Salary" : l.emi ? "EMI" : ""]); });
    rows.push(["Settings", "Emergency fund saved so far", "", S.ef || "", "", ""], ["Settings", "Target needs %", "", S.tNeed, "", ""], ["Settings", "Target wants %", "", S.tWant, "", ""], ["Settings", "Target savings %", "", S.tSave, "", ""]);
    return "﻿" + rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n") + "\r\n";
  }
  function parseCsv(text) {
    var rows = [], row = [], cell = "", q = false, i, c;
    text = text.replace(/^﻿/, "");
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function load(text) {
    var rows = parseCsv(text), h = -1;
    for (var i = 0; i < rows.length; i++) if ((rows[i][0] || "").trim().toLowerCase() === "section" && (rows[i][1] || "").trim().toLowerCase() === "item") { h = i; break; }
    if (h < 0) throw new Error("no header");
    var lines = [], st = { ef: 0, tNeed: 50, tWant: 30, tSave: 20 }, F = { monthly: "m", yearly: "y", daily: "d" }, T = { need: "need", want: "want", saving: "save", savings: "save" };
    rows.slice(h + 1).forEach(function (r) {
      var sec = (r[0] || "").trim(), name = (r[1] || "").trim(), amt = Math.max(0, Math.min(1e10, +String(r[3] || "").replace(/[^0-9.]/g, "") || 0));
      if (!sec) return;
      if (sec === "Settings") {
        if (/emergency/i.test(name)) st.ef = amt;
        else if (/need/i.test(name)) st.tNeed = Math.min(100, amt); else if (/want/i.test(name)) st.tWant = Math.min(100, amt); else if (/sav/i.test(name)) st.tSave = Math.min(100, amt);
        return;
      }
      if (sec === "Money commitments") sec = T[(r[4] || "").trim().toLowerCase()] === "save" ? "Savings" : "EMIs and insurance";
      if (T[(r[4] || "").trim().toLowerCase()] === "save" && sec !== "Savings") sec = "Savings";
      var def = DEF.filter(function (d) { return d[0] === sec && d[1] === name; })[0];
      var ty = sec === "Savings" ? "save" : T[(r[4] || "").trim().toLowerCase()] === "want" ? "want" : sec === "Income" ? "need" : T[(r[4] || "").trim().toLowerCase()] === "need" ? "need" : (def ? def[3] : "need");
      var l = mk([sec, name, F[(r[2] || "").trim().toLowerCase()] || "m", ty, def ? def[4] : "", def ? def[5] : null]);
      var tag = (r[5] || "").trim().toLowerCase(); if (tag === "salary") l.salary = true; if (tag === "emi") l.emi = true;
      l.amt = Math.round(amt); lines.push(l);
    });
    if (!lines.length) throw new Error("empty");
    S.lines = lines; S.ef = st.ef; S.tNeed = st.tNeed; S.tWant = st.tWant; S.tSave = st.tSave;
    $("bp-ef").value = S.ef ? fmt.format(S.ef) : ""; ["tNeed", "tWant", "tSave"].forEach(function (k) { $("bp-" + k).value = S[k]; });
    drawEditor(); render();
  }
  function say(msg) { var s = $("bpStatus"); s.textContent = msg; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 4000); }
  function download(blob, name) { var u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 800); }
  $("bpSaveBtn").addEventListener("click", function () { download(new Blob([toCsv()], { type: "text/csv;charset=utf-8" }), "salarist-budget-" + stamp() + ".csv"); say("Budget saved to your device. Load it here next time to carry on."); });
  $("bpLoadBtn").addEventListener("click", function () { $("bpFile").click(); });
  $("bpFile").addEventListener("change", function () {
    var f = this.files && this.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { try { load(String(rd.result)); say("Budget loaded from " + f.name + "."); } catch (e) { say("Couldn't read that file. Choose a budget CSV saved from this page."); } };
    rd.readAsText(f); this.value = "";
  });
  $("bpClear").addEventListener("click", function () { if (!S.lines.some(function (l) { return l.amt; }) && !S.ef) return; S.lines.forEach(function (l) { l.amt = 0; }); S.ef = 0; $("bp-ef").value = ""; drawEditor(); render(); say("Amounts cleared. Your lines are still here."); });
  $("bpReset").addEventListener("click", function () { S.lines = DEF.map(mk); S.ef = 0; S.tNeed = 50; S.tWant = 30; S.tSave = 20; $("bp-ef").value = ""; ["tNeed", "tWant", "tSave"].forEach(function (k) { $("bp-" + k).value = S[k]; }); drawEditor(); render(); say("Back to the starting list."); });

  /* ---------- Reports ---------- */
  function withReport(cb) {
    if (window.SalaristReportKit) return cb(window.SalaristReportKit);
    var sc = document.createElement("script"); sc.src = document.body.getAttribute("data-report-js") || "/assets/js/report-kit.js"; sc.async = true;
    sc.onload = function () { cb(window.SalaristReportKit); }; sc.onerror = function () { say("Couldn't load the report. Check your connection and try again."); };
    document.head.appendChild(sc);
  }
  function spec() {
    var r = last, filled = S.lines.filter(function (l) { return l.amt; });
    var months = 60, a = [], b = [], perMonth = r.save + r.left;
    for (var m = 0; m <= months; m++) { a.push(S.ef + perMonth * m); b.push(r.need * 6); }
    var secRows = EXP.concat(Object.keys(r.secs).filter(function (s) { return SECTIONS.indexOf(s) < 0; })).filter(function (s) { return r.secs[s]; })
      .map(function (s) { return [s, r.secs[s], r.secs[s] * 12]; });
    var lineRow = function (l) { return [(l.name || "Untitled") + " (" + FREQ_TXT[l.freq].toLowerCase() + ")", monthly(l), monthly(l) * 12]; };
    return {
      title: "Budget Report", path: "salarist.in/budget-planner", url: location.origin + location.pathname, file: "salarist-budget",
      question: "Your monthly budget",
      verdictLines: Array.prototype.map.call(document.querySelectorAll("#bpVerdict p"), function (p) { return p.textContent; }),
      verdictColor: r.left >= 0 ? "green" : "amber",
      inputs: [["Income a month", inr(r.inc), r.inc], ["Regular income a month", inr(r.incRegular), r.incRegular], ["Needs a month", inr(r.need), r.need], ["Wants a month", inr(r.want), r.want],
        ["Planned savings a month", inr(r.save), r.save], ["EMIs a month", inr(r.emi), r.emi], ["Yearly costs, set aside a month", inr(r.setAside), r.setAside], ["Emergency fund saved", inr(S.ef), S.ef],
        ["Target split", S.tNeed + " / " + S.tWant + " / " + S.tSave], ["Lines in your budget", String(filled.length)]],
      keyNums: [["Left each month", short(r.left), r.left], ["Savings rate", pct(r.saveRate)], ["EMI load", pct(r.emiLoad)], ["Emergency fund", $("bpEf").textContent]],
      sensTitle: "Your split against your target",
      sens: [["Needs (target " + S.tNeed + "%)", r.inc ? pct(r.need / r.inc) : "—"], ["Wants (target " + S.tWant + "%)", r.inc ? pct(r.want / r.inc) : "—"], ["Savings (target " + S.tSave + "%)", pct(r.saveRate)]],
      sensCurrent: -1,
      chartTitle: "What you'd put away at this pace", chartNote: "Your emergency fund plus planned savings and what's left each month, over 5 years, before any returns.",
      xlsxChartTitle: "Saved at this pace (₹ lakh)",
      chart: { series: [{ name: "Saved at this pace", color: "green", data: a }, { name: "6 months of needs", color: "amber", data: b }], cross: null },
      chartYears: [0, 1, 2, 3, 4, 5],
      money: { title: "Your budget by section", cols: ["Per month", "Per year"], rows: [["Income", r.inc, r.inc * 12, "total"]].concat(secRows, [["Planned savings", r.save, r.save * 12], ["Left over", r.left, r.left * 12, r.left >= 0 ? "total" : ""]]),
        note: "Yearly costs are spread evenly over 12 months. Daily costs are counted for 365 days." },
      tables: [{ title: "Every line in your budget", sheet: "Lines", cols: ["Item", "Per month", "Per year"], yearly: filled.map(lineRow), monthly: null }],
      notes: ["Amounts are what you entered. Yearly amounts are divided by 12; daily amounts are multiplied by 365 and divided by 12.",
        "Savings rate counts planned savings plus anything left over, as a share of all income including yearly extras spread monthly.",
        "EMI load is all EMIs as a share of your in-hand salary. Lenders look at this before approving a new loan.",
        "Emergency fund months compare what you've saved with your monthly needs, including EMIs.",
        "The chart adds savings at today's pace with no investment returns, so the real figure should be higher."],
      taxRules: ["This planner works with in-hand pay, after tax, so no tax rules are applied."],
      short: short, inr: inr
    };
  }
  function busy(btn, on) { btn.disabled = on; btn.setAttribute("aria-busy", on ? "true" : "false"); }
  $("bpPdf").addEventListener("click", function () {
    if (last.inc <= 0) return say("Enter your income first."); var btn = this; busy(btn, true); say("Preparing your report…");
    withReport(function (K) { K.pdf(spec()).then(function () { busy(btn, false); say("PDF report downloaded."); }, function () { busy(btn, false); say("Couldn't make the PDF. Please try again."); }); });
  });
  $("bpXlsx").addEventListener("click", function () {
    if (last.inc <= 0) return say("Enter your income first."); var btn = this; busy(btn, true);
    withReport(function (K) { try { K.xlsx(spec()); say("Excel file downloaded."); } catch (e) { say("Couldn't make the Excel file. Please try again."); } busy(btn, false); });
  });

  (function bar() {
    var el = $("bpBar"), seen = false, inForm = false;
    function upd() { el.hidden = seen || !inForm; }
    if (!("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (e) { seen = e[0].isIntersecting; upd(); }).observe($("bpVerdict"));
    new IntersectionObserver(function (e) { inForm = e[0].isIntersecting; upd(); }).observe($("bpEdit"));
    $("bpBarBtn").addEventListener("click", function () { $("bpVerdict").scrollIntoView({ behavior: "smooth", block: "start" }); });
  })();
  window.addEventListener("beforeunload", function (e) { if (S.lines.some(function (l) { return l.amt; })) { e.preventDefault(); e.returnValue = ""; } });

  drawEditor(); render();
})();
