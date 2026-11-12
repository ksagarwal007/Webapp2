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
