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
