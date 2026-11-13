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
  function set(open) { btn.setAttribute("aria-expanded", open ? "true" : "false"); btn.setAttribute("aria-label", open ? "Close menu" : "Menu"); panel.hidden = !open; }
  btn.addEventListener("click", function () { set(panel.hidden); });
  panel.addEventListener("click", function (e) { if (e.target.closest("a")) set(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) { set(false); btn.focus(); } });
  document.addEventListener("click", function (e) { if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) set(false); });
  window.addEventListener("resize", function () { if (window.innerWidth > 720 && !panel.hidden) set(false); });
})();
