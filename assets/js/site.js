/* Theme toggle. The choice lasts for this browser tab only (sessionStorage), never across visits. */
(function () {
  var root = document.documentElement, btn = document.getElementById("themeBtn");
  if (!btn) return;
  function isDark() {
    var t = root.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  }
  btn.addEventListener("click", function () {
    var n = isDark() ? "light" : "dark";
    root.setAttribute("data-theme", n);
    try { sessionStorage.setItem("salarist-theme", n); } catch (e) {}
  });
})();
/* Phone menu */
(function () {
  var btn = document.getElementById("menuBtn"), panel = document.getElementById("menuPanel");
  if (!btn || !panel) return;
  var top = btn.closest(".top") || btn.closest("header");
  function set(open) {
    btn.setAttribute("aria-expanded", open ? "true" : "false"); btn.setAttribute("aria-label", open ? "Close menu" : "Menu");
    if (open) { var sp = document.getElementById("searchPanel"), sb = document.getElementById("searchBtn"); if (sp && !sp.hidden) { sp.hidden = true; sb.setAttribute("aria-expanded", "false"); } }
    document.documentElement.classList.toggle("menu-open", open); panel.hidden = !open;   /* header pinned to the top, panel fills the rest */
    if (open && top) document.documentElement.style.setProperty("--menu-top", Math.round(top.getBoundingClientRect().bottom) + "px");   /* full-screen panel; the page behind doesn't scroll */
  }
  btn.addEventListener("click", function () { set(panel.hidden); });
  panel.addEventListener("click", function (e) { if (e.target.closest("a")) set(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) { set(false); btn.focus(); } });
  document.addEventListener("click", function (e) { if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) set(false); });
  window.addEventListener("resize", function () { if (window.innerWidth > 720 && !panel.hidden) set(false); });
})();
/* Info tips: tap to open, tap again, tap elsewhere or press Escape to close */
(function () {
  var open = null;
  function close() { if (!open) return; open.setAttribute("aria-expanded", "false"); document.getElementById(open.getAttribute("aria-controls")).hidden = true; open = null; }
  function place(b) {
    var p = b.parentNode.querySelector(".tipb"); p.style.left = "-10px";
    var r = p.getBoundingClientRect(), over = r.right - (window.innerWidth - 12);
    if (over > 0) p.style.left = (-10 - over) + "px";
    r = p.getBoundingClientRect(); if (r.left < 12) p.style.left = (parseFloat(p.style.left) + 12 - r.left) + "px";
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".tip");
    if (b) { e.preventDefault(); var was = b === open; close(); if (!was) { open = b; b.setAttribute("aria-expanded", "true"); document.getElementById(b.getAttribute("aria-controls")).hidden = false; place(b); } return; }
    if (open && !e.target.closest(".tipb")) close();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && open) { var b = open; close(); b.focus(); } });
})();
/* Site search: header button, panel and the home page box. Data from /assets/search.json, loaded on first use. */
(function () {
  var btn = document.getElementById("searchBtn"), panel = document.getElementById("searchPanel"), q = document.getElementById("siteQ"), out = document.getElementById("siteR");
  if (!btn || !panel) return;
  var data = window.SALARIST_SEARCH || null, loading = false, top = btn.closest(".top");
  function load(cb) {
    if (data) return cb(); if (loading) return; loading = true;
    fetch("/assets/search.json").then(function (r) { return r.json(); }).then(function (d) { data = d; cb(); }, function () { out.innerHTML = "<p>Search isn't available right now. <a href=\"/tools/\">Browse all tools</a> or <a href=\"/guides/\">all guides</a>.</p>"; });
  }
  function set(open) {
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    document.documentElement.classList.toggle("menu-open", open && window.innerWidth <= 720); panel.hidden = !open;
    if (open && top) document.documentElement.style.setProperty("--menu-top", Math.round(top.getBoundingClientRect().bottom) + "px");
    if (open) { var mb = document.getElementById("menuBtn"), mp = document.getElementById("menuPanel"); if (mp && !mp.hidden) { mp.hidden = true; mb.setAttribute("aria-expanded", "false"); } load(run); setTimeout(function () { q.focus(); }, 30); }
  }
  function norm(s) { return (s || "").toLowerCase().replace(/[^a-z0-9₹ ]+/g, " ").replace(/\s+/g, " ").trim(); }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function run() {
    if (!data) return;
    var words = norm(q.value).split(" ").filter(Boolean);
    if (!words.length) { out.innerHTML = '<p>Type a word or two: <i>gratuity</i>, <i>RSU</i>, <i>home loan</i>, <i>NPS</i>, <i>resign</i>.</p>'; return; }
    var hits = data.map(function (x) {
      var t = norm(x.t), all = t + " " + norm(x.d) + " " + norm(x.g);
      if (!words.every(function (w) { return all.indexOf(w) > -1; })) return null;
      var sc = words.reduce(function (s, w) { return s + (t.indexOf(w) > -1 ? 3 : 1); }, 0) + (x.k === "tool" ? 2 : 0);
      return { x: x, sc: sc };
    }).filter(Boolean).sort(function (a, b) { return b.sc - a.sc || String(b.x.p || "").localeCompare(String(a.x.p || "")); });
    var tools = hits.filter(function (h) { return h.x.k === "tool"; }).slice(0, 5), guides = hits.filter(function (h) { return h.x.k === "guide"; }), ng = guides.length;
    function row(h) { return '<a href="' + h.x.u + '"><b>' + esc(h.x.t) + "</b><span><i>" + (h.x.k === "tool" ? "Tool" : "Guide") + "</i> · " + esc(h.x.g) + "</span></a>"; }
    out.innerHTML = !hits.length ? '<p>Nothing matches yet. Try a shorter word, or <a href="/tools/">browse all tools</a>.</p>'
      : (tools.length ? "<h3>Tools</h3>" + tools.map(row).join("") : "") + (ng ? "<h3>Guides</h3>" + guides.slice(0, 8).map(row).join("") +
        (ng > 8 ? '<a href="/guides/?q=' + encodeURIComponent(q.value) + '&amp;sort=new"><b>See all ' + ng + " matching guides →</b></a>" : "") : "");
  }
  btn.addEventListener("click", function () { set(panel.hidden); });
  q.addEventListener("input", function () { load(run); });
  q.addEventListener("keydown", function (e) { if (e.key === "Enter") { var a = out.querySelector("a"); if (a) location.href = a.href; } });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !panel.hidden) { set(false); btn.focus(); }
    if (e.key === "/" && panel.hidden && !/input|textarea|select/i.test((document.activeElement || {}).tagName || "")) { e.preventDefault(); set(true); }
  });
  document.addEventListener("click", function (e) { if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target) && e.target.id !== "homeQ") set(false); });
  var hq = document.getElementById("homeQ");
  if (hq) hq.addEventListener("input", function () { q.value = hq.value; hq.value = ""; set(true); load(run); });
})();
/* Tools page: guide lists folded on phones */
(function () {
  if (!window.matchMedia || !window.matchMedia("(max-width:720px)").matches) return;
  document.querySelectorAll("details.tl-g[open]").forEach(function (d) { d.removeAttribute("open"); });
})();
