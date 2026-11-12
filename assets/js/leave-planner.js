/* Salarist Leave Planner. Runs entirely in the browser; nothing is stored or sent. */
(function (root) {
  "use strict";

  /* ---------- Core (pure functions, also used by tests) ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseIso(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }

  function isWeekend(d, pattern) {
    var w = d.getDay();
    if (w === 0) return true;
    if (w === 6) {
      if (pattern === "ss") return true;
      if (pattern === "s24") { var n = Math.ceil(d.getDate() / 7); return n === 2 || n === 4; }
    }
    return false;
  }

  /* holidays: object iso -> [names] */
  function buildDays(year, pattern, holidays) {
    var out = [], d = new Date(year, 0, 1);
    while (d.getFullYear() === year) {
      var k = iso(d), wk = isWeekend(d, pattern), hol = holidays[k] || null;
      out.push({ iso: k, date: new Date(d), wk: wk, hol: hol, off: wk || !!hol });
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  /* Every maximal stretch that starts and ends on a day off and needs 1..maxLeave leave days. */
  function candidates(days, maxLeave) {
    var res = [], n = days.length;
    for (var a = 0; a < n; a++) {
      if (!days[a].off || (a > 0 && days[a - 1].off)) continue;
      var leave = 0;
      for (var b = a; b < n; b++) {
        if (!days[b].off) { leave++; if (leave > maxLeave) break; continue; }
        if (b + 1 < n && days[b + 1].off) continue;
        if (leave > 0) res.push({ a: a, b: b, leave: leave, len: b - a + 1 });
      }
    }
    return res;
  }

  function longWeekends(days) {
    var res = [], n = days.length, a = -1;
    for (var i = 0; i <= n; i++) {
      var off = i < n && days[i].off;
      if (off && a < 0) a = i;
      if (!off && a >= 0) {
        var len = i - a, hasHol = false;
        for (var j = a; j < i; j++) if (days[j].hol) hasHol = true;
        if (len >= 3 && hasHol) res.push({ a: a, b: i - 1, leave: 0, len: len });
        a = -1;
      }
    }
    return res;
  }

  /* Choose non-overlapping breaks that give the most days off within the leave budget (ties: less leave). */
  function bestPlan(cands, budget) {
    var c = cands.slice().sort(function (x, y) { return x.b - y.b || x.a - y.a; });
    var n = c.length, p = new Array(n);
    for (var i = 0; i < n; i++) {
      var lo = 0, hi = i - 1, ans = -1;
      while (lo <= hi) { var m = (lo + hi) >> 1; if (c[m].b < c[i].a) { ans = m; lo = m + 1; } else hi = m - 1; }
      p[i] = ans;
    }
    var W = budget + 1, dp = new Float64Array((n + 1) * W), take = new Uint8Array((n + 1) * W);
    for (i = 1; i <= n; i++) {
      var ci = c[i - 1], val = ci.len * 1000 - ci.leave, base = (p[i - 1] + 1) * W;
      for (var l = 0; l < W; l++) {
        var best = dp[(i - 1) * W + l], t = 0;
        if (l >= ci.leave) { var v = dp[base + l - ci.leave] + val; if (v > best) { best = v; t = 1; } }
        dp[i * W + l] = best; take[i * W + l] = t;
      }
    }
    var picked = [], row = n, col = budget;
    while (row > 0) {
      if (take[row * W + col]) { var cc = c[row - 1]; picked.push(cc); col -= cc.leave; row = p[row - 1] + 1; }
      else row--;
    }
    return picked.reverse();
  }

  /* Highest days-off per leave day, non-overlapping, using at most maxLeave each. */
  function bestValue(cands, maxLeave, count) {
    var c = cands.filter(function (x) { return x.leave <= maxLeave; })
      .sort(function (x, y) { return (y.len / y.leave) - (x.len / x.leave) || y.len - x.len || x.a - y.a; });
    var out = [];
    for (var i = 0; i < c.length && out.length < count; i++) {
      var ok = out.every(function (o) { return c[i].b < o.a || c[i].a > o.b; });
      if (ok) out.push(c[i]);
    }
    return out.sort(function (x, y) { return x.a - y.a; });
  }

  /* Every window of exactly `len` days, ranked by fewest leave days, non-overlapping. month: 0-11 or -1 for any. */
  function bestWindows(days, len, month, count) {
    var c = [];
    for (var a = 0; a + len - 1 < days.length; a++) {
      if (month > -1 && days[a].date.getMonth() !== month) continue;
      var b = a + len - 1, leave = 0, hol = 0;
      for (var i = a; i <= b; i++) { if (!days[i].off) leave++; if (days[i].hol) hol++; }
      c.push({ a: a, b: b, leave: leave, len: len, hol: hol, edge: (days[a].off ? 1 : 0) + (days[b].off ? 1 : 0) });
    }
    c.sort(function (x, y) { return x.leave - y.leave || y.edge - x.edge || y.hol - x.hol || x.a - y.a; });
    var out = [];
    for (var j = 0; j < c.length && out.length < count; j++) {
      var w = { a: c[j].a, b: c[j].b, leave: c[j].leave };
      while (w.a > 0 && days[w.a - 1].off) w.a--;           /* free days next to the break are yours too */
      while (w.b < days.length - 1 && days[w.b + 1].off) w.b++;
      w.len = w.b - w.a + 1;
      var ok = out.every(function (o) { return w.b < o.a - 1 || w.a > o.b + 1; });
      if (ok) out.push(w);
    }
    return out;
  }

  var core = { bestWindows: bestWindows, iso: iso, parseIso: parseIso, isWeekend: isWeekend, buildDays: buildDays, candidates: candidates,
               longWeekends: longWeekends, bestPlan: bestPlan, bestValue: bestValue };
  if (typeof module !== "undefined" && module.exports) { module.exports = core; return; }

  /* ---------- UI ---------- */
  var dataEl = document.getElementById("lp-data");
  if (!dataEl) return;
  var DATA = JSON.parse(dataEl.textContent), YEAR = DATA.year;
  var $ = function (id) { return document.getElementById(id); };
  var MONFULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], WD2 = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fd(d) { return WD[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()]; }
  function mmdd(k) { return k.slice(5, 7) + k.slice(8, 10); }
  function fromMmdd(s) { return /^\d{4}$/.test(s) ? YEAR + "-" + s.slice(0, 2) + "-" + s.slice(2) : null; }

  var gazDates = {}; DATA.gazetted.forEach(function (h) { gazDates[h[0]] = true; });
  var S = { mode: "break", len: 5, month: -1, pattern: "ss", budget: 8, excluded: {}, rh: {}, custom: [] };

  /* Restore from a shared link (query string only; nothing is stored on the device). */
  (function () {
    var q = new URLSearchParams(location.search);
    if (["ss", "s", "s24"].indexOf(q.get("w")) > -1) S.pattern = q.get("w");
    var l = parseInt(q.get("l"), 10); if (l >= 1 && l <= 30) S.budget = l;
    if (q.get("m") === "most") S.mode = "most";
    var n = parseInt(q.get("n"), 10); if (n >= 3 && n <= 21) S.len = n;
    var mo = parseInt(q.get("mo"), 10); if (mo >= 1 && mo <= 12) S.month = mo - 1;
    (q.get("x") || "").split(",").forEach(function (m) { var k = fromMmdd(m); if (k && gazDates[k]) S.excluded[k] = true; });
    (q.get("r") || "").split(",").forEach(function (m) { var k = fromMmdd(m); if (k) DATA.restricted.forEach(function (h) { if (h[0] === k) S.rh[k] = true; }); });
    (q.get("c") || "").split(",").forEach(function (m) { var k = fromMmdd(m); if (k && !isNaN(parseIso(k))) S.custom.push([k, "Company holiday"]); });
  })();

  function holidayMap() {
    var h = {};
    function add(k, n) { (h[k] = h[k] || []).push(n); }
    DATA.gazetted.forEach(function (x) { if (!S.excluded[x[0]]) add(x[0], x[1]); });
    DATA.restricted.forEach(function (x) { if (S.rh[x[0]]) add(x[0], x[1]); });
    S.custom.forEach(function (x) { add(x[0], x[1]); });
    return h;
  }

  var last = null;
  function compute() {
    var days = buildDays(YEAR, S.pattern, holidayMap());
    var cands = candidates(days, Math.min(S.budget, 9));
    var plan = S.mode === "most" ? bestPlan(cands, S.budget) : bestWindows(days, S.len, S.month, 6);
    return { days: days, plan: plan, value: bestValue(cands, 3, 8), lw: longWeekends(days) };
  }

  function leaveDays(days, br) { var r = []; for (var i = br.a; i <= br.b; i++) if (!days[i].off) r.push(days[i]); return r; }
  function holNames(days, br) { var r = []; for (var i = br.a; i <= br.b; i++) if (days[i].hol) r = r.concat(days[i].hol); return r; }
  function range(days, br) { return fd(days[br.a].date) + " – " + fd(days[br.b].date); }

  function strip(days, br) {
    var s = "";
    for (var i = br.a; i <= br.b; i++) {
      var d = days[i], cls = d.hol ? "hol" : d.off ? "wk" : "lv";
      s += '<span class="chip ' + cls + '" title="' + esc(d.hol ? d.hol.join(", ") : d.off ? "Weekly off" : "Your leave") + '">' + WD2[d.date.getDay()] + "<b>" + d.date.getDate() + "</b></span>";
    }
    return '<div class="chips" aria-hidden="true">' + s + "</div>";
  }

  function breakItem(days, br, showStrip) {
    var lv = leaveDays(days, br), hn = holNames(days, br);
    return '<li class="brk"><div class="brk-h"><span class="brk-d">' + range(days, br) + '</span><span class="brk-n"><b class="num">' + br.len + "</b> days off</span></div>" +
      '<p class="brk-s">' + (br.leave ? br.leave + " leave day" + (br.leave > 1 ? "s" : "") : "No leave needed") + (hn.length ? " · " + esc(hn.join(", ")) : "") + "</p>" +
      (showStrip ? strip(days, br) : "") +
      (lv.length ? '<p class="brk-l">Take leave on ' + lv.map(function (d) { return fd(d.date); }).join(", ") + "</p>" : "") + "</li>";
  }

  function calendar(days, plan) {
    var inBreak = {}, isLeave = {};
    plan.forEach(function (br) { for (var i = br.a; i <= br.b; i++) { inBreak[i] = true; if (!days[i].off) isLeave[i] = true; } });
    var html = "", idx = 0;
    for (var m = 0; m < 12; m++) {
      var first = new Date(YEAR, m, 1), lead = (first.getDay() + 6) % 7, cells = "";
      for (var k = 0; k < lead; k++) cells += "<span></span>";
      while (idx < days.length && days[idx].date.getMonth() === m) {
        var d = days[idx], cls = isLeave[idx] ? "lv" : d.hol ? "hol" : d.wk ? "wk" : "";
        if (inBreak[idx]) cls += " in";
        cells += '<span class="' + cls + '"' + (d.hol ? ' title="' + esc(d.hol.join(", ")) + '"' : "") + ">" + d.date.getDate() + "</span>";
        idx++;
      }
      html += '<div class="mon"><h4>' + MON[m] + "</h4><div class=\"wd\"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div><div class=\"grid\">" + cells + "</div></div>";
    }
    return html;
  }

  function render() {
    var r = compute(); last = r;
    var used = r.plan.reduce(function (s, b) { return s + b.leave; }, 0);
    var off = r.plan.reduce(function (s, b) { return s + b.len; }, 0);
    if (S.mode === "most") {
      $("lpVerdict").innerHTML = r.plan.length
        ? '<p class="k">Using up to ' + S.budget + ' leave day' + (S.budget === 1 ? "" : "s") + '</p><p class="v"><span class="num">' + used + "</span> leave day" + (used === 1 ? "" : "s") + ' → <b><span class="num">' + off + "</span> days off</b></p><p class=\"k\">Across " + r.plan.length + " break" + (r.plan.length > 1 ? "s" : "") + ", counting the weekends and holidays inside each one." + (used < S.budget ? " Using more leave wouldn't make these breaks longer." : "") + "</p>"
        : '<p class="v">No breaks found</p><p class="k">Try more leave days or a different weekly off.</p>';
      $("lpListH").textContent = "Your breaks";
    } else {
      var best = r.plan.length ? r.plan[0] : null, when = S.month > -1 ? " starting in " + MONFULL[S.month] : "";
      $("lpVerdict").innerHTML = best
        ? '<p class="k">For at least ' + S.len + ' days off in a row' + when + '</p><p class="v">Take just <b><span class="num">' + best.leave + "</span> leave day" + (best.leave === 1 ? "" : "s") + "</b></p><p class=\"k\">Best option: " + range(r.days, best) + ". " + (r.plan.length > 1 ? "More options below, fewest leave days first." : "") + "</p>"
        : '<p class="v">No dates found</p><p class="k">Try a different month or a shorter break.</p>';
      $("lpListH").textContent = "Your options, fewest leave days first";
    }
    document.querySelectorAll("[data-mode]").forEach(function (b) { b.setAttribute("aria-selected", b.getAttribute("data-mode") === S.mode ? "true" : "false"); });
    document.querySelectorAll("[data-for]").forEach(function (el) { el.hidden = el.getAttribute("data-for") !== S.mode; });
    $("lpLenVal").textContent = S.len; $("lpLen").value = S.len; $("lpMonth").value = String(S.month);
    $("lpPlan").innerHTML = r.plan.map(function (b) { return breakItem(r.days, b, true); }).join("");
    $("lpValue").innerHTML = r.value.map(function (b) { return breakItem(r.days, b, false); }).join("") || '<li class="brk"><p class="brk-s">No short bridges found with these settings.</p></li>';
    $("lpLong").innerHTML = r.lw.map(function (b) { return breakItem(r.days, b, false); }).join("") || '<li class="brk"><p class="brk-s">No holiday long weekends with these settings.</p></li>';
    $("lpCal").innerHTML = calendar(r.days, S.mode === "most" ? r.plan : r.plan.slice(0, 1));
    $("lpBudgetVal").textContent = S.budget;
    $("lpBudget").value = S.budget;
    $("lpHolCount").textContent = Object.keys(holidayMap()).length;
    document.querySelectorAll("[data-pattern]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-pattern") === S.pattern ? "true" : "false"); });
  }

  function renderEditors() {
    $("lpGaz").innerHTML = DATA.gazetted.map(function (h, i) {
      var id = "g" + i, d = parseIso(h[0]);
      return '<label class="chk" for="' + id + '"><input type="checkbox" id="' + id + '" data-gaz="' + h[0] + '"' + (S.excluded[h[0]] ? "" : " checked") + "><span>" + esc(h[1]) + '</span><span class="dt">' + fd(d) + "</span></label>";
    }).join("");
    $("lpRh").innerHTML = DATA.restricted.map(function (h, i) {
      var id = "r" + i, d = parseIso(h[0]);
      return '<label class="chk" for="' + id + '"><input type="checkbox" id="' + id + '" data-rh="' + h[0] + '"' + (S.rh[h[0]] ? " checked" : "") + "><span>" + esc(h[1]) + '</span><span class="dt">' + fd(d) + "</span></label>";
    }).join("");
    $("lpCustomList").innerHTML = S.custom.map(function (h, i) {
      return '<li><span>' + esc(h[1]) + ' · ' + fd(parseIso(h[0])) + '</span><button type="button" class="link-btn" data-del="' + i + '" aria-label="Remove ' + esc(h[1]) + '">Remove</button></li>';
    }).join("");
  }

  function say(msg) { var s = $("lpStatus"); s.textContent = msg; clearTimeout(say.t); say.t = setTimeout(function () { s.textContent = ""; }, 3000); }
  function copy(text, okMsg) {
    function fallback() {
      var t = document.createElement("textarea"); t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select(); var ok = false; try { ok = document.execCommand("copy"); } catch (e) {} t.remove();
      say(ok ? okMsg : "Couldn't copy. Select the text and copy it yourself.");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { say(okMsg); }, fallback); else fallback();
  }

  /* Events */
  document.querySelectorAll("[data-pattern]").forEach(function (b) { b.addEventListener("click", function () { S.pattern = b.getAttribute("data-pattern"); render(); }); });
  document.querySelectorAll("[data-mode]").forEach(function (b) { b.addEventListener("click", function () { S.mode = b.getAttribute("data-mode"); render(); }); });
  $("lpLen").addEventListener("input", function () { var v = parseInt(this.value, 10); if (v >= 3 && v <= 21) { S.len = v; render(); } });
  $("lpLenMinus").addEventListener("click", function () { if (S.len > 3) { S.len--; render(); } });
  $("lpLenPlus").addEventListener("click", function () { if (S.len < 21) { S.len++; render(); } });
  $("lpMonth").addEventListener("change", function () { S.month = parseInt(this.value, 10); render(); });
  $("lpBudget").addEventListener("input", function () { var v = parseInt(this.value, 10); if (v >= 1 && v <= 30) { S.budget = v; render(); } });
  $("lpMinus").addEventListener("click", function () { if (S.budget > 1) { S.budget--; render(); } });
  $("lpPlus").addEventListener("click", function () { if (S.budget < 30) { S.budget++; render(); } });
  $("lpEdit").addEventListener("change", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-gaz")) { if (t.checked) delete S.excluded[t.getAttribute("data-gaz")]; else S.excluded[t.getAttribute("data-gaz")] = true; render(); }
    if (t.hasAttribute("data-rh")) { if (t.checked) S.rh[t.getAttribute("data-rh")] = true; else delete S.rh[t.getAttribute("data-rh")]; render(); }
  });
  $("lpCustomForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var d = $("lpCustomDate").value, n = $("lpCustomName").value.trim() || "Company holiday";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d.slice(0, 4) !== String(YEAR)) { say("Pick a date in " + YEAR + "."); return; }
    S.custom.push([d, n.slice(0, 60)]); $("lpCustomName").value = ""; renderEditors(); render(); say("Added " + n + ".");
  });
  $("lpCustomList").addEventListener("click", function (e) {
    var b = e.target.closest("[data-del]"); if (!b) return;
    S.custom.splice(+b.getAttribute("data-del"), 1); renderEditors(); render();
  });
  $("lpReset").addEventListener("click", function () { S.excluded = {}; S.rh = {}; S.custom = []; renderEditors(); render(); say("Back to the central government list."); });

  function chosen() { return S.mode === "most" ? last.plan : last.plan.slice(0, 1); }
  $("lpCopy").addEventListener("click", function () {
    if (!last || !last.plan.length) return;
    var lines = chosen().map(function (b) {
      return range(last.days, b) + " (" + b.len + " days off): leave on " + leaveDays(last.days, b).map(function (d) { return fd(d.date); }).join(", ");
    });
    copy("My " + YEAR + " leave " + (S.mode === "most" ? "plan" : "options") + "\n" + lines.join("\n") + "\nPlanned with salarist.in", "Leave dates copied.");
  });
  $("lpShare").addEventListener("click", function () {
    var q = new URLSearchParams();
    q.set("m", S.mode); q.set("w", S.pattern);
    if (S.mode === "most") q.set("l", S.budget); else { q.set("n", S.len); if (S.month > -1) q.set("mo", S.month + 1); }
    var x = Object.keys(S.excluded).map(mmdd), r = Object.keys(S.rh).map(mmdd), c = S.custom.map(function (h) { return mmdd(h[0]); });
    if (x.length) q.set("x", x.join(",")); if (r.length) q.set("r", r.join(",")); if (c.length) q.set("c", c.join(","));
    copy(location.origin + location.pathname + "?" + q.toString(), "Link copied. Holiday names you typed aren't included.");
  });
  $("lpIcs").addEventListener("click", function () {
    if (!last || !last.plan.length) return;
    function ymd(d) { return iso(d).replace(/-/g, ""); }
    var now = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    var ev = chosen().map(function (b, i) {
      var end = new Date(last.days[b.b].date); end.setDate(end.getDate() + 1);
      var lv = leaveDays(last.days, b).map(function (d) { return fd(d.date); }).join(", ");
      return ["BEGIN:VEVENT", "UID:salarist-" + YEAR + "-" + i + "-" + ymd(last.days[b.a].date) + "@salarist.in", "DTSTAMP:" + now,
        "DTSTART;VALUE=DATE:" + ymd(last.days[b.a].date), "DTEND;VALUE=DATE:" + ymd(end),
        "SUMMARY:Break: " + b.len + " days off", "DESCRIPTION:Take leave on " + lv + ". Planned with salarist.in", "TRANSP:TRANSPARENT", "END:VEVENT"].join("\r\n");
    });
    var ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Salarist//Leave Planner//EN", "CALSCALE:GREGORIAN"].concat(ev, ["END:VCALENDAR"]).join("\r\n");
    var url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })), a = document.createElement("a");
    a.href = url; a.download = "leave-plan-" + YEAR + ".ics"; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
    say("Calendar file downloaded. Open it to add your breaks.");
  });

  /* ---------- Share as image (drawn in the browser; nothing is uploaded) ---------- */
  var PAL = {
    blue: { bg: "#1F5FE0", text: "#FFFFFF", sub: "rgba(255,255,255,0.88)", acc: "#FFD27A", card: "#FFFFFF", cardText: "#0E1726", cardLine: "#E6ECF5", tot: "#0B7F5A",
            boxHol: "#1F5FE0", boxWk: "#C3CEDD", lv: "#F2A93B", onLv: "#2B1A00", chipHol: "#FFFFFF", onChipHol: "#1F5FE0", chipWk: "rgba(255,255,255,0.22)", onChipWk: "#FFFFFF",
            tagBg: "#FFFFFF", tagText: "#1F5FE0", ink: "#FFFFFF", coin: "#FFFFFF", rule: "rgba(255,255,255,0.35)" },
    dark: { bg: "#07090D", text: "#E8EEF7", sub: "#C9D3E2", acc: "#F5B547", card: "#10161F", cardText: "#E8EEF7", cardLine: "#2A3850", tot: "#3DD68C",
            boxHol: "#4C8DFF", boxWk: "#3A4868", lv: "#F5B547", onLv: "#2A1A00", chipHol: "#4C8DFF", onChipHol: "#061226", chipWk: "#2A3550", onChipWk: "#E8EEF7",
            tagBg: "#4C8DFF", tagText: "#061226", ink: "#E8EEF7", coin: "#4C8DFF", rule: "#2A3850", glow: true }
  };
  var FONT = '"Plus Jakarta Sans", system-ui, sans-serif';
  var SHORT = { "Id-ul-Zuha (Bakrid)": "Bakrid", "Mahatma Gandhi's Birthday": "Gandhi Jayanti", "Dussehra (Vijaya Dashmi)": "Dussehra",
    "Janmashtami (Vaishnav)": "Janmashtami", "Diwali (Deepavali)": "Diwali", "Milad-un-Nabi (Id-e-Milad)": "Milad-un-Nabi", "Guru Nanak's Birthday": "Guru Nanak Jayanti",
    "Makar Sankranti / Magha Bihu": "Makar Sankranti", "Pongal / Guru Gobind Singh's Birthday": "Pongal", "Basant Panchami / Sri Panchami": "Basant Panchami",
    "Guru Ravi Das's Birthday": "Ravidas Jayanti", "Swami Dayananda Saraswati's Birthday": "Dayananda Jayanti", "Holika Dahan / Dolyatra": "Holika Dahan",
    "Chaitra Sukladi / Gudi Padava / Ugadi / Cheti Chand": "Ugadi", "Vaisakhi / Vishu / Meshadi (Tamil New Year)": "Vaisakhi", "Vaisakhadi (Bengal) / Bahag Bihu (Assam)": "Bihu",
    "Guru Rabindranath Tagore's Birthday": "Tagore Jayanti", "Parsi New Year / Navroz": "Navroz", "Ganesh Chaturthi / Vinayaka Chaturthi": "Ganesh Chaturthi",
    "Onam / Thiru Onam": "Onam", "Dussehra (Saptami)": "Durga Puja", "Dussehra (Mahashtami)": "Durga Puja", "Dussehra (Mahanavmi)": "Durga Puja",
    "Maharishi Valmiki's Birthday": "Valmiki Jayanti", "Karaka Chaturthi (Karwa Chauth)": "Karwa Chauth", "Chhath Puja (Pratihar / Surya Shashthi)": "Chhath Puja",
    "Guru Teg Bahadur's Martyrdom Day": "Guru Teg Bahadur Day", "Hazarat Ali's Birthday": "Hazarat Ali Jayanti", "Republic Day": "Republic Day" };
  function shortName(n) { return SHORT[n] || n; }
  function shortRange(days, br) {
    var d1 = days[br.a].date, d2 = days[br.b].date;
    return d1.getMonth() === d2.getMonth() ? d1.getDate() + "–" + d2.getDate() + " " + MONFULL[d1.getMonth()]
      : d1.getDate() + " " + MON[d1.getMonth()] + " – " + d2.getDate() + " " + MON[d2.getMonth()];
  }
  function autoTitle(r) {
    if (S.mode === "most") return "My " + YEAR + " leave plan, " + r.plan.length + " break" + (r.plan.length > 1 ? "s" : "") + ":";
    var br = r.plan[0], rg = shortRange(r.days, br), hs = [];
    holNames(r.days, br).forEach(function (n) { var k = shortName(n); if (hs.indexOf(k) < 0) hs.push(k); });
    if (!br.leave) return "Free long weekend, " + rg + ":";
    if (!hs.length) return "The " + MONFULL[r.days[br.a].date.getMonth()] + " getaway, " + rg + ":";
    var name = hs.length === 1 ? hs[0] : hs.length === 2 ? hs[0] + " + " + hs[1] : hs[0] + " and more";
    return "The " + name + " " + (br.len >= 10 ? "mega break" : "hack") + ", " + rg + ":";
  }
  function rr(ctx, X, Y, W, Hh, R) { R = Math.min(R, W / 2, Hh / 2); ctx.beginPath(); ctx.moveTo(X + R, Y); ctx.arcTo(X + W, Y, X + W, Y + Hh, R); ctx.arcTo(X + W, Y + Hh, X, Y + Hh, R); ctx.arcTo(X, Y + Hh, X, Y, R); ctx.arcTo(X, Y, X + W, Y, R); ctx.closePath(); }
  function box(ctx, X, Y, W, Hh, R, fill, stroke) { rr(ctx, X, Y, W, Hh, R); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); } }
  function txt(ctx, t, X, Y, size, weight, color, align) { ctx.font = weight + " " + size + "px " + FONT; ctx.fillStyle = color; ctx.textAlign = align || "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(t, X, Y); return ctx.measureText(t).width; }
  function fit(ctx, t, size, weight, maxW, min) { min = min || 20; while (size > min) { ctx.font = weight + " " + size + "px " + FONT; if (ctx.measureText(t).width <= maxW) break; size -= 2; } return size; }
  function drawLogo(ctx, X, Y, h, ink, coin) {
    var svg = document.querySelector(".top .brand svg"); if (!svg) return;
    var vb = svg.getAttribute("viewBox").split(/\s+/).map(Number), k = h / vb[3];
    ctx.save(); ctx.translate(X, Y); ctx.scale(k, k); ctx.translate(-vb[0], -vb[1]);
    ctx.fillStyle = ink; ctx.fill(new Path2D(svg.querySelector(".ink").getAttribute("d")));
    var c = svg.querySelector(".coin"); ctx.beginPath(); ctx.arc(+c.getAttribute("cx"), +c.getAttribute("cy"), +c.getAttribute("r"), 0, 7); ctx.fillStyle = coin; ctx.fill();
    ctx.restore();
  }
  function customised() { return Object.keys(S.excluded).length || Object.keys(S.rh).length || S.custom.length; }
  function counts(days, list) {
    var c = { lv: 0, hol: 0, wk: 0, names: [] };
    list.forEach(function (br) { for (var i = br.a; i <= br.b; i++) { var d = days[i]; if (!d.off) c.lv++; else if (d.hol) { c.hol++; d.hol.forEach(function (n) { var k = shortName(n); if (c.names.indexOf(k) < 0) c.names.push(k); }); } else c.wk++; } });
    return c;
  }
  function drawShareImage(r, palName, title) {
    var T = PAL[palName], W = 1080, Hh = 1350, P = 84, inner = W - 2 * P, cv = document.createElement("canvas"); cv.width = W; cv.height = Hh;
    var ctx = cv.getContext("2d");
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, Hh);
    if (T.glow) { var g = ctx.createRadialGradient(W * 0.9, 0, 10, W * 0.9, 0, 760); g.addColorStop(0, "rgba(76,141,255,0.38)"); g.addColorStop(1, "rgba(76,141,255,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh); }
    drawLogo(ctx, P, 70, 56, T.ink, T.coin);
    ctx.font = "800 24px " + FONT; var tw = ctx.measureText("SAVE FOR " + YEAR).width + 44;
    box(ctx, W - P - tw, 70, tw, 52, 26, T.tagBg); txt(ctx, "SAVE FOR " + YEAR, W - P - tw / 2, 105, 24, 800, T.tagText, "center");
    var most = S.mode === "most", list = most ? r.plan : [r.plan[0]], c = counts(r.days, list);
    var total = list.reduce(function (s, b) { return s + b.len; }, 0);
    // kicker (title)
    txt(ctx, title, P, 212, fit(ctx, title, 40, 700, inner, 26), 700, T.sub);
    // headline
    var l1 = c.lv + " leave" + (c.lv === 1 ? "" : "s"), l2a = "= ", l2b = total + " days off";
    var big = most ? 132 : (list[0].len > 18 ? 118 : list[0].len > 9 ? 136 : 150);
    var hs = Math.min(fit(ctx, l1, big, 800, inner), fit(ctx, l2a + l2b, big, 800, inner));
    var y = 212 + hs * 1.02; txt(ctx, l1, P, y, hs, 800, T.text);
    y += hs * 0.98; var wA = txt(ctx, l2a, P, y, hs, 800, T.text); txt(ctx, l2b, P + wA, y, hs, 800, T.acc);
    // equation card
    var rows = [["Leave you take", T.lv, c.lv],
      [most ? "Holidays" : (c.names.length ? (c.names.length > 2 ? c.names[0] + " + more" : c.names.join(" + ")) : "Holidays"), T.boxHol, c.hol],
      [c.wk > 2 ? "Weekends" : "Weekend", T.boxWk, c.wk]];
    var cy = y + 44, rowH = 68, cardH = 28 * 2 + rowH * 4;
    box(ctx, P, cy, inner, cardH, 40, T.card, palName === "dark" ? T.cardLine : null);
    var ry = cy + 28;
    rows.forEach(function (row) {
      var n = row[2], bs = n <= 8 ? 38 : n <= 14 ? 26 : 18, gap = 7, bw = n ? n * bs + (n - 1) * gap : 0, numX = W - P - 40;
      txt(ctx, row[0], P + 40, ry + 44, fit(ctx, row[0], 34, 700, inner - 80 - bw - 110, 22), 700, T.cardText);
      for (var i = 0; i < n; i++) box(ctx, numX - 70 - bw + i * (bs + gap), ry + rowH / 2 - bs / 2, bs, bs, Math.max(5, bs / 4), row[1]);
      txt(ctx, String(n), numX, ry + 48, 44, 800, T.cardText, "right");
      ctx.strokeStyle = T.cardLine; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P + 40, ry + rowH); ctx.lineTo(W - P - 40, ry + rowH); ctx.stroke();
      ry += rowH;
    });
    txt(ctx, most ? "Days off in total" : "Days off in a row", P + 40, ry + 46, 34, 700, T.tot);
    txt(ctx, String(total), W - P - 40, ry + 48, 44, 800, T.tot, "right");
    var top = cy + cardH + 40, fy = Hh - 214;
    if (most) {
      var items = r.plan.slice(0, 6), colW = (inner - 28) / 2;
      items.forEach(function (b, i) {
        var X = P + (i % 2) * (colW + 28), Y = top + 34 + Math.floor(i / 2) * 50, a = shortRange(r.days, b);
        var w1 = txt(ctx, a + " · ", X, Y, fit(ctx, a + " · 10 days", 30, 700, colW, 22), 700, T.text);
        txt(ctx, b.len + " days", X + w1, Y, fit(ctx, a + " · 10 days", 30, 700, colW, 22), 700, T.acc);
      });
      if (r.plan.length > 6) txt(ctx, "+ " + (r.plan.length - 6) + " more", P, top + 34 + 3 * 50, 26, 600, T.sub);
    } else {
      var br = r.plan[0], n = br.b - br.a + 1, cols = n <= 9 ? n : n <= 18 ? 9 : 7, rowsN = Math.ceil(n / cols), gap2 = 10;
      var legendH = 44, avail = fy - 36 - top - legendH;
      var cw = Math.min(104, (inner - gap2 * (cols - 1)) / cols), ch = Math.min(cw * 1.08, (avail - gap2 * (rowsN - 1)) / rowsN);
      var sx = P + (inner - (cols * cw + (cols - 1) * gap2)) / 2;
      for (var i = 0; i < n; i++) {
        var d = r.days[br.a + i], hol = !!d.hol, lv = !d.off, X = sx + (i % cols) * (cw + gap2), Y = top + Math.floor(i / cols) * (ch + gap2);
        box(ctx, X, Y, cw, ch, Math.min(20, cw / 4), hol ? T.chipHol : lv ? T.lv : T.chipWk);
        var ink = hol ? T.onChipHol : lv ? T.onLv : T.onChipWk;
        if (ch >= 72) {
          txt(ctx, WD2[d.date.getDay()], X + cw / 2, Y + ch * 0.38, Math.round(Math.min(cw, ch) * 0.24), 700, ink, "center");
          txt(ctx, String(d.date.getDate()), X + cw / 2, Y + ch * 0.8, Math.round(Math.min(cw, ch) * 0.4), 800, ink, "center");
        } else {
          txt(ctx, String(d.date.getDate()), X + cw / 2, Y + ch * 0.68, Math.round(ch * 0.5), 800, ink, "center");
        }
      }
      var ly = top + rowsN * ch + (rowsN - 1) * gap2 + 40, lx = sx;
      [[T.chipHol, "Holiday"], [T.lv, "Leave"], [T.chipWk, "Weekend"]].forEach(function (it) { box(ctx, lx, ly - 22, 26, 26, 7, it[0]); lx += 38; lx += txt(ctx, it[1], lx, ly, 26, 600, T.sub) + 30; });
    }
    ctx.strokeStyle = T.rule; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P, fy); ctx.lineTo(W - P, fy); ctx.stroke();
    txt(ctx, "Find your own " + YEAR + " leave hacks, free", P, fy + 60, 34, 800, T.text);
    txt(ctx, "salarist.in/leave-planner-2027", P, fy + 108, 42, 800, T.acc);
    txt(ctx, (customised() ? "Based on my company's holidays" : "Based on the central govt holiday list") + " · No sign-up", P, fy + 150, 24, 600, T.sub);
    return cv;
  }
  function shareText(r) {
    var url = location.origin + location.pathname;
    if (S.mode === "break") {
      var b = r.plan[0], m = MONFULL[r.days[b.a].date.getMonth()];
      return (b.leave ? "Just " + b.leave + " leave" + (b.leave > 1 ? "s" : "") + " for " + b.len + " days off in " + m + " " + YEAR + "!" : b.len + " days off in " + m + " " + YEAR + " without taking leave!") + " Find your best leave dates free: " + url;
    }
    var used = r.plan.reduce(function (s, x) { return s + x.leave; }, 0), off = r.plan.reduce(function (s, x) { return s + x.len; }, 0);
    return "I turned " + used + " leaves into " + off + " days off in " + YEAR + "! Plan yours free: " + url;
  }
  var imgBlob = null, imgPal = "blue", imgTitle = "", redrawT;
  function currentTheme() { var t = document.documentElement.getAttribute("data-theme"); if (t) return t; return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
  function redraw() {
    var cv = drawShareImage(last, imgPal, imgTitle || autoTitle(last));
    $("lpImg").src = cv.toDataURL("image/png");
    imgBlob = null; cv.toBlob(function (b) { imgBlob = b; });
    document.querySelectorAll("[data-pal]").forEach(function (b) { b.setAttribute("aria-checked", b.getAttribute("data-pal") === imgPal ? "true" : "false"); });
  }
  $("lpImgBtn").addEventListener("click", function () {
    if (!last || !last.plan.length) { say("Nothing to share yet."); return; }
    var dlg = $("lpShareDlg");
    imgPal = currentTheme() === "dark" ? "dark" : "blue";
    imgTitle = ""; $("lpImgTitle").value = autoTitle(last);
    (document.fonts && document.fonts.load ? Promise.all([document.fonts.load('800 40px "Plus Jakarta Sans"'), document.fonts.load('700 40px "Plus Jakarta Sans"'), document.fonts.load('600 40px "Plus Jakarta Sans"')]) : Promise.resolve())
      .catch(function () {}).then(function () {
        redraw(); $("lpImgStatus").textContent = "";
        if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
      });
  });
  document.querySelectorAll("[data-pal]").forEach(function (b) { b.addEventListener("click", function () { imgPal = b.getAttribute("data-pal"); redraw(); }); });
  $("lpImgTitle").addEventListener("input", function () { imgTitle = this.value.trim().slice(0, 70); clearTimeout(redrawT); redrawT = setTimeout(redraw, 150); });
  $("lpImgTitleReset").addEventListener("click", function () { imgTitle = ""; $("lpImgTitle").value = autoTitle(last); redraw(); });
  function dlImage() {
    if (!imgBlob) return;
    var url = URL.createObjectURL(imgBlob), a = document.createElement("a");
    a.href = url; a.download = "salarist-leave-plan-" + YEAR + ".png"; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
    $("lpImgStatus").textContent = "Image saved. Share it from your gallery or downloads.";
  }
  $("lpImgShare").addEventListener("click", function () {
    if (!imgBlob) return;
    var file = new File([imgBlob], "salarist-leave-plan-" + YEAR + ".png", { type: "image/png" }), text = shareText(last);
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], text: text, title: "My " + YEAR + " leave plan" }).catch(function () {});
    } else { dlImage(); copy(text, "Image saved, and a message to go with it is copied."); }
  });
  $("lpImgDl").addEventListener("click", dlImage);
  $("lpImgClose").addEventListener("click", function () { var d = $("lpShareDlg"); if (d.close) d.close(); else d.removeAttribute("open"); });

  renderEditors();
  render();
})(this);
