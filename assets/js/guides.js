/* Salarist guides page: search, topic filter, sort and "show all" per tool. Without JavaScript every guide is listed by tool. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var q = $("gxQ"), sort = $("gxSort"), flat = $("gxFlat"), tools = $("gxTools"), none = $("gxNone"), count = $("gxCount");
  var cards = Array.prototype.slice.call(tools.querySelectorAll(".g-card")), secs = Array.prototype.slice.call(tools.querySelectorAll(".gx-sec"));
  var S = { q: "", t: "all", sort: "tool" }, open = {};
  (function fromUrl() {
    var u = new URLSearchParams(location.search);
    if (u.get("q")) S.q = u.get("q"); if (u.get("topic")) S.t = u.get("topic"); if (["new", "main"].indexOf(u.get("sort")) > -1) S.sort = u.get("sort");
    q.value = S.q; sort.value = S.sort;
  })();
  function norm(s) { return s.toLowerCase().replace(/[^a-z0-9₹ ]+/g, " ").replace(/\s+/g, " ").trim(); }
  function match(c) {
    if (S.t !== "all" && (" " + c.getAttribute("data-topics") + " ").indexOf(" " + S.t + " ") < 0) return false;
    if (S.sort === "main" && c.getAttribute("data-main") !== "1") return false;
    var words = norm(S.q).split(" ").filter(Boolean), txt = norm(c.getAttribute("data-text"));
    return words.every(function (w) { return txt.indexOf(w) > -1; });
  }
  function render() {
    document.querySelectorAll(".gx-chip").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-t") === S.t ? "true" : "false"); });
    var hits = cards.filter(match), filtering = S.q || S.t !== "all" || S.sort === "main";
    if (S.sort === "new") {
      tools.hidden = true; flat.hidden = false; flat.innerHTML = "";
      hits.slice().sort(function (a, b) { return b.getAttribute("data-date").localeCompare(a.getAttribute("data-date")); })
        .forEach(function (c) { flat.appendChild(c.cloneNode(true)); });
    } else {
      tools.hidden = false; flat.hidden = true; flat.innerHTML = "";
      secs.forEach(function (sec, i) {
        var cs = Array.prototype.slice.call(sec.querySelectorAll(".g-card")), shown = 0, more = sec.querySelector(".gx-more");
        cs.forEach(function (c) {
          var ok = hits.indexOf(c) > -1, cut = !filtering && !open[i] && shown >= 3;
          c.hidden = !ok || cut; if (ok) shown++;
        });
        sec.hidden = shown === 0;
        if (more) more.hidden = filtering || open[i] || shown <= 3;
      });
    }
    none.hidden = hits.length > 0;
    count.textContent = hits.length + (hits.length === 1 ? " guide" : " guides") + (filtering ? " match" : "");
    var u = new URL(location.href);
    [["q", S.q], ["topic", S.t === "all" ? "" : S.t], ["sort", S.sort === "tool" ? "" : S.sort]].forEach(function (x) { if (x[1]) u.searchParams.set(x[0], x[1]); else u.searchParams.delete(x[0]); });
    history.replaceState(null, "", u.pathname + u.search + location.hash);
  }
  q.addEventListener("input", function () { S.q = this.value; render(); });
  sort.addEventListener("change", function () { S.sort = this.value; render(); });
  document.querySelectorAll(".gx-chip").forEach(function (b) { b.addEventListener("click", function () { S.t = b.getAttribute("data-t"); render(); }); });
  secs.forEach(function (sec, i) { var m = sec.querySelector(".gx-more"); if (m) m.addEventListener("click", function () { open[i] = true; render(); }); });
  /* A link to a tool's section (/guides/#epf-calculator) opens that section in full. */
  if (location.hash) secs.forEach(function (sec, i) { if (sec.querySelector("h2[id='" + location.hash.slice(1) + "']")) open[i] = true; });
  render();
})();
