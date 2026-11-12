/* Salarist reports: branded PDF and Excel, made in the browser with no libraries. Loaded only when someone asks for a report. */
(function () {
  "use strict";
  var FONT = '"Plus Jakarta Sans", system-ui, sans-serif';
  var C = { ink: "#0E1726", muted: "#4F5D70", line: "#CDD6E3", soft: "#EEF2F8", blue: "#1F5FE0", amber: "#E39A1E", green: "#0B7F5A", white: "#FFFFFF" };
  var PW = 1654, PH = 2339, M = 120;   /* A4 at 200 dpi */

  function download(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1000);
  }
  function stamp() { var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; }; return p(d.getDate()) + p(d.getMonth() + 1) + String(d.getFullYear()).slice(2) + "-" + p(d.getHours()) + p(d.getMinutes()); }
  function today() { return new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }); }
  function kindName(k) { return k === "equity" ? "Equity mutual funds" : k === "debt" ? "Debt fund" : "Fixed deposit"; }
  function inputs(d) {
    var S = d.S;
    return [["Loan outstanding", d.inr(S.P)], ["Interest rate", S.rate + "% a year"], ["Years left", S.years + " years"],
      ["Extra each month", d.inr(S.extra)], ["One-time amount today", d.inr(S.lump)], ["Expected return", S.ret + "% a year"],
      ["Invest in", kindName(S.kind)], ["Tax regime", S.regime === "old" ? "Old regime" : "New regime"], ["Income tax slab", S.slab + "%"],
      ["Home loan interest deduction", S.regime === "old" ? (S.claim ? "Claimed (up to ₹2,00,000 a year)" : "Not claimed") : "Not available (new regime)"]];
  }
  function verdict(d) {
    var x = d.sim.diff;
    if (Math.abs(x) < Math.max(d.sim.prepay.final, d.sim.invest.final) * 0.01) return "It's a near tie";
    return (x > 0 ? "Investing wins by " : "Prepaying wins by ") + d.short(Math.abs(x));
  }
  function keyNums(d) {
    var s = d.sim, be = d.be, early = (s.N - s.prepay.payoff) / 12;
    return [["Interest saved by prepaying", d.short(s.invest.interest - s.prepay.interest)],
      ["Loan closes", early >= 0.05 ? early.toFixed(1).replace(/\.0$/, "") + " years sooner" : "No change"],
      ["Investing wins above", be.kind === "rate" ? be.rate.toFixed(1) + "% a year" : be.kind === "invest-always" ? "Any return" : "Above 30% a year"],
      ["Your EMI", d.inr(s.emi)]];
  }
  var DISCLAIMER = "This report gives estimates for information only. It is not tax, legal or financial advice. Investment returns are not guaranteed. Check important decisions with a qualified adviser.";
  var TAXRULES = ["Old regime: home loan interest on a self-occupied home is deductible up to ₹2,00,000 a year (section 22 of the Income-tax Act, 2025; section 24(b) of the 1961 Act). New regime: no deduction.",
    "Equity mutual funds: long-term gains taxed at 12.5% above ₹1,25,000, plus 4% cess. Debt funds (units bought on or after 1 April 2023) and FDs: taxed at your slab rate, plus 4% cess.",
    "Rules for tax year 2026-27, verified on 12 Nov 2026."];

  /* ---------- PDF ---------- */
  function newPage() { var c = document.createElement("canvas"); c.width = PW; c.height = PH; var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, PW, PH); return { c: c, x: x }; }
  function T(x, t, X, Y, sz, w, col, al) { x.font = (w || 400) + " " + sz + "px " + FONT; x.fillStyle = col || C.ink; x.textAlign = al || "left"; x.textBaseline = "alphabetic"; x.fillText(t, X, Y); return x.measureText(t).width; }
  function R(x, X, Y, W, H, r, fill, stroke) {
    x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath();
    if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = 2; x.stroke(); }
  }
  function wrap(x, text, X, Y, maxW, sz, w, col, lh) {
    x.font = (w || 400) + " " + sz + "px " + FONT; var words = text.split(" "), line = "", y = Y;
    for (var i = 0; i < words.length; i++) {
      var t = line ? line + " " + words[i] : words[i];
      if (x.measureText(t).width > maxW && line) { T(x, line, X, y, sz, w, col); line = words[i]; y += lh; } else line = t;
    }
    if (line) { T(x, line, X, y, sz, w, col); y += lh; }
    return y;
  }
  function logo(x, X, Y, h) {
    var svg = document.querySelector(".top .brand svg"); if (!svg) { T(x, "Salarist", X, Y + h * 0.8, h * 0.8, 800, C.ink); return; }
    var vb = svg.getAttribute("viewBox").split(/\s+/).map(Number), k = h / vb[3];
    x.save(); x.translate(X, Y); x.scale(k, k); x.translate(-vb[0], -vb[1]);
    x.fillStyle = C.ink; x.fill(new Path2D(svg.querySelector(".ink").getAttribute("d")));
    var ci = svg.querySelector(".coin"); x.beginPath(); x.arc(+ci.getAttribute("cx"), +ci.getAttribute("cy"), +ci.getAttribute("r"), 0, 7); x.fillStyle = C.blue; x.fill(); x.restore();
  }
  function header(p, d, title) {
    var x = p.x; logo(x, M, 80, 60);
    T(x, title, PW - M, 110, 30, 700, C.ink, "right");
    T(x, "Made on " + today() + " · salarist.in/prepay-vs-invest", PW - M, 150, 22, 400, C.muted, "right");
    x.strokeStyle = C.line; x.lineWidth = 2; x.beginPath(); x.moveTo(M, 190); x.lineTo(PW - M, 190); x.stroke();
    return 250;
  }
  function chart(x, d, X, Y, W, H) {
    var A = d.sim.prepay.net, B = d.sim.invest.net, n = A.length - 1, all = A.concat(B), mx = Math.max.apply(null, all), mn = Math.min.apply(null, all.concat([0])), sp = (mx - mn) || 1, pl = 130, pb = 40;
    function px(i) { return X + pl + i / n * (W - pl); } function py(v) { return Y + (mx - v) / sp * (H - pb); }
    x.lineWidth = 1.5;
    for (var k = 0; k <= 4; k++) { var v = mn + sp * k / 4, yy = py(v); x.strokeStyle = C.line; x.beginPath(); x.moveTo(X + pl, yy); x.lineTo(X + W, yy); x.stroke(); T(x, d.short(v), X + pl - 14, yy + 8, 20, 600, C.muted, "right"); }
    var yrs = n / 12, step = yrs > 20 ? 5 : yrs > 8 ? 2 : 1;
    for (var t = 0; t <= yrs; t += step) T(x, "Yr " + t, px(t * 12), Y + H, 20, 600, C.muted, "center");
    if (mn < 0 && mx > 0) { x.setLineDash([8, 8]); x.strokeStyle = C.muted; x.beginPath(); x.moveTo(X + pl, py(0)); x.lineTo(X + W, py(0)); x.stroke(); x.setLineDash([]); T(x, "₹0: above this you own more than you owe", X + pl + 10, py(0) - 10, 18, 600, C.muted); }
    var pm = d.sim.prepay.payoff;
    if (pm < n) { x.setLineDash([6, 6]); x.strokeStyle = C.amber; x.beginPath(); x.moveTo(px(pm), Y); x.lineTo(px(pm), Y + H - pb); x.stroke(); x.setLineDash([]); T(x, "Loan closed (prepay), yr " + (pm / 12).toFixed(1).replace(/\.0$/, ""), px(pm), Y - 10, 18, 700, C.amber, pm / n > 0.7 ? "right" : "center"); }
    [[B, C.blue], [A, C.amber]].forEach(function (s) { x.beginPath(); for (var i = 0; i <= n; i++) { if (i) x.lineTo(px(i), py(s[0][i])); else x.moveTo(px(i), py(s[0][i])); } x.strokeStyle = s[1]; x.lineWidth = 5; x.lineJoin = "round"; x.stroke(); });
    if (d.cross) { x.beginPath(); x.arc(px(d.cross.m), py(B[d.cross.m]), 10, 0, 7); x.fillStyle = C.green; x.fill(); }
  }
  function tablePages(pages, d, title, rows, prepay, startY) {
    var cols = prepay ? ["Year", "EMI paid", "Extra into loan", "Interest", "Loan left", "Invested", "Investments value"] : ["Year", "EMI paid", "Interest", "Loan left", "Invested", "Investments value"];
    var W = PW - 2 * M, cw = W / cols.length, p = pages[pages.length - 1], y = startY;
    function head() {
      T(p.x, title, M, y, 34, 800, C.ink); y += 30;
      R(p.x, M, y, W, 56, 12, C.blue);
      cols.forEach(function (c, i) { T(p.x, c, i === 0 ? M + 20 : M + cw * (i + 1) - 20, y + 37, 20, 700, C.white, i === 0 ? "left" : "right"); });
      y += 56;
    }
    head();
    rows.forEach(function (r, ri) {
      if (y + 44 > PH - 160) { p = newPage(); pages.push(p); y = header(p, d, "Prepay vs Invest report"); title = title.replace(/ \(continued\)$/, "") + " (continued)"; head(); }
      if (ri % 2) R(p.x, M, y, W, 44, 0, C.soft);
      var vals = prepay ? [r.y, r.emi, r.extra, r.interest, r.bal, r.invest, r.corpus] : [r.y, r.emi, r.interest, r.bal, r.invest, r.corpus];
      vals.forEach(function (v, i) { T(p.x, i === 0 ? "Year " + v : d.inr(v), i === 0 ? M + 20 : M + cw * (i + 1) - 20, y + 30, 21, i === 0 ? 700 : 500, C.ink, i === 0 ? "left" : "right"); });
      y += 44;
    });
    return y + 40;
  }
  function makePages(d) {
    var pages = [], p = newPage(); pages.push(p); var x = p.x, y = header(p, d, "Prepay vs Invest report"), W = PW - 2 * M;
    T(x, "Should you prepay your home loan or invest the extra?", M, y, 30, 600, C.muted); y += 80;
    var vl = d.verdictLines || [], win = d.sim.diff >= 0;
    if (vl[0]) { T(x, vl[0], M, y - 20, 26, 600, C.muted); y += 76; }
    T(x, vl[1] || verdict(d), M, y, 72, 800, win ? C.blue : C.amber); y += 50;
    if (vl[2]) y = wrap(x, vl[2], M, y, W, 26, 400, C.ink, 38) + 20;
    /* inputs */
    var inp = inputs(d), half = W / 2;
    R(x, M, y, W, 40 + Math.ceil(inp.length / 2) * 52 + 50, 24, C.soft);
    T(x, "Your inputs", M + 30, y + 52, 26, 800, C.ink);
    inp.forEach(function (it, i) { var cx = M + 30 + (i % 2) * half, cy = y + 104 + Math.floor(i / 2) * 52; T(x, it[0], cx, cy, 21, 600, C.muted); T(x, it[1], cx + half - 60, cy, 21, 700, C.ink, "right"); });
    y += 40 + Math.ceil(inp.length / 2) * 52 + 90;
    /* key numbers */
    var kn = keyNums(d), bw = (W - 3 * 20) / 4;
    kn.forEach(function (k, i) { var bx = M + i * (bw + 20); R(x, bx, y, bw, 130, 20, null, C.line); wrap(x, k[0], bx + 22, y + 40, bw - 44, 19, 600, C.muted, 26); T(x, k[1], bx + 22, y + 108, 28, 800, C.ink); });
    y += 180;
    /* sensitivity */
    T(x, "What if returns are different?", M, y, 26, 800, C.ink); y += 24;
    var sw = (W - 2 * 20) / 3;
    d.sens.forEach(function (s, i) { var bx = M + i * (sw + 20); R(x, bx, y, sw, 96, 18, s.rate === d.S.ret ? C.soft : null, s.rate === d.S.ret ? C.blue : C.line); T(x, "At " + s.rate + "% a year", bx + 22, y + 38, 20, 600, C.muted); T(x, (s.diff > 0 ? "Investing +" : "Prepaying +") + d.short(Math.abs(s.diff)), bx + 22, y + 76, 26, 800, C.ink); });
    y += 150;
    /* chart */
    T(x, "Net worth over time", M, y, 26, 800, C.ink); y += 16;
    T(x, "Your investments minus what you still owe on the loan", M, y + 22, 20, 400, C.muted); y += 70;
    chart(x, d, M, y, W, 520); y += 560;
    var lx = M; [[C.blue, "Invest the extra"], [C.amber, "Prepay, then invest"]].concat(d.cross ? [[C.green, "Year the leader stops changing"]] : []).forEach(function (it) { R(x, lx, y - 20, 24, 24, 6, it[0]); lx += 36; lx += T(x, it[1], lx, y, 20, 600, C.muted) + 36; });
    /* page 2: money + tables */
    p = newPage(); pages.push(p); x = p.x; y = header(p, d, "Prepay vs Invest report");
    T(x, "Where your money went", M, y, 34, 800, C.ink); y += 40;
    var rowsM = [["Paid to the bank", "bank"], ["of which interest", "interest"], ["Put into investments", "invested"], ["Investment growth", "growth"], ["Tax on investments", "tax"], ["You end up with", "final"]];
    R(x, M, y, W, 56, 12, C.blue); T(x, "", M, y, 1); T(x, "Prepay, then invest", M + W * 0.72, y + 37, 21, 700, C.white, "right"); T(x, "Invest the extra", M + W - 20, y + 37, 21, 700, C.white, "right"); y += 56;
    rowsM.forEach(function (r, i) {
      if (i % 2) R(x, M, y, W, 46, 0, C.soft);
      var bold = r[1] === "final";
      T(x, r[0], M + (r[1] === "interest" ? 44 : 20), y + 31, 22, bold ? 800 : 500, r[1] === "interest" ? C.muted : C.ink);
      T(x, (r[1] === "tax" ? "− " : r[1] === "growth" ? "+ " : "") + d.inr(d.sim.prepay[r[1]]), M + W * 0.72, y + 31, 22, bold ? 800 : 600, bold ? C.green : C.ink, "right");
      T(x, (r[1] === "tax" ? "− " : r[1] === "growth" ? "+ " : "") + d.inr(d.sim.invest[r[1]]), M + W - 20, y + 31, 22, bold ? 800 : 600, bold ? C.green : C.ink, "right");
      y += 46;
    });
    y = wrap(x, "Both choices use the same " + d.inr(d.sim.prepay.bank + d.sim.prepay.invested) + " of your money. Prepaying sends less to the bank, and that money is invested once the loan closes, so it is already inside these totals.", M, y + 40, W, 21, 400, C.muted, 32) + 40;
    y = tablePages(pages, d, "Year by year: prepay, then invest", d.yearsPrepay, true, y);
    p = pages[pages.length - 1];
    if (y + 300 > PH - 160) { p = newPage(); pages.push(p); y = header(p, d, "Prepay vs Invest report"); }
    y = tablePages(pages, d, "Year by year: invest the extra", d.yearsInvest, false, y);
    /* assumptions, tax rules, disclaimer */
    p = pages[pages.length - 1]; x = p.x;
    var need = 120 + (d.notes.length + TAXRULES.length + 3) * 70;
    if (y + need > PH - 160) { p = newPage(); pages.push(p); x = p.x; y = header(p, d, "Prepay vs Invest report"); }
    T(x, "Assumptions", M, y, 30, 800, C.ink); y += 46;
    d.notes.forEach(function (n) { y = wrap(x, "•  " + n, M, y, W, 21, 400, C.ink, 32) + 6; });
    y += 20; T(x, "Tax rules used", M, y, 30, 800, C.ink); y += 46;
    TAXRULES.forEach(function (n) { y = wrap(x, "•  " + n, M, y, W, 21, 400, C.ink, 32) + 6; });
    y += 30; R(x, M, y, W, 150, 18, C.soft); wrap(x, DISCLAIMER, M + 30, y + 50, W - 60, 21, 500, C.muted, 32);
    /* footers */
    pages.forEach(function (pg, i) {
      pg.x.strokeStyle = C.line; pg.x.lineWidth = 2; pg.x.beginPath(); pg.x.moveTo(M, PH - 110); pg.x.lineTo(PW - M, PH - 110); pg.x.stroke();
      T(pg.x, "Free, private money tools for salaried India · salarist.in", M, PH - 70, 20, 600, C.muted);
      T(pg.x, "Page " + (i + 1) + " of " + pages.length, PW - M, PH - 70, 20, 600, C.muted, "right");
    });
    return pages.map(function (pg) { return pg.c; });
  }
  function b64bytes(dataUrl) { var b = atob(dataUrl.split(",")[1]), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function buildPdf(canvases) {
    var enc = function (s) { var u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
    var parts = [], offs = [], len = 0, n = canvases.length;
    function push(u) { parts.push(u); len += u.length; }
    function obj(id, bodyParts) { offs[id] = len; push(enc(id + " 0 obj\n")); bodyParts.forEach(function (b) { push(typeof b === "string" ? enc(b) : b); }); push(enc("\nendobj\n")); }
    push(enc("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"));
    var kids = []; for (var i = 0; i < n; i++) kids.push((4 + i * 3) + " 0 R");
    obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
    obj(2, ["<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + n + " >>"]);
    obj(3, ["<< /Title (Salarist - Prepay vs Invest report) /Producer (salarist.in) /Creator (salarist.in) >>"]);
    canvases.forEach(function (cv, i) {
      var pid = 4 + i * 3, cid = pid + 1, iid = pid + 2, jpg = b64bytes(cv.toDataURL("image/jpeg", 0.82));
      var content = "q 595.28 0 0 841.89 0 0 cm /Im0 Do Q";
      obj(pid, ["<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 " + iid + " 0 R >> >> /Contents " + cid + " 0 R >>"]);
      obj(cid, ["<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream"]);
      obj(iid, ["<< /Type /XObject /Subtype /Image /Width " + cv.width + " /Height " + cv.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpg.length + " >>\nstream\n", jpg, "\nendstream"]);
    });
    var total = 4 + n * 3, xref = len, x = "xref\n0 " + total + "\n0000000000 65535 f \n";
    for (var k = 1; k < total; k++) x += String(offs[k]).padStart(10, "0") + " 00000 n \n";
    push(enc(x + "trailer\n<< /Size " + total + " /Root 1 0 R /Info 3 0 R >>\nstartxref\n" + xref + "\n%%EOF\n"));
    return new Blob(parts, { type: "application/pdf" });
  }
  function pdf(d) {
    var fl = document.fonts && document.fonts.load ? Promise.all(["400", "500", "600", "700", "800"].map(function (w) { return document.fonts.load(w + ' 40px "Plus Jakarta Sans"'); })) : Promise.resolve();
    return fl.catch(function () {}).then(function () {
      return new Promise(function (res) { setTimeout(res, 30); });      /* let the "Preparing…" message paint */
    }).then(function () { download(buildPdf(makePages(d)), "salarist-prepay-vs-invest-" + stamp() + ".pdf"); });
  }

  /* ---------- Excel (.xlsx) ---------- */
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u) { var c = 0xFFFFFFFF; for (var i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s) { return new TextEncoder().encode(s); }
  function zip(files) {
    var parts = [], central = [], off = 0, d = new Date();
    var time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    files.forEach(function (f) {
      var name = utf8(f[0]), data = utf8(f[1]), crc = crc32(data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, time, true); h.setUint16(12, date, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, time, true); c.setUint16(14, date, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    });
    var csize = central.reduce(function (s, u) { return s + u.length; }, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function col(i) { var s = ""; i++; while (i) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - 1 - m) / 26 | 0; } return s; }
  /* styles: 0 normal, 1 header, 2 money, 3 bold, 4 title, 5 section, 6 money bold, 7 muted wrap */
  function sheet(rows, widths, freeze, drawing) {
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
    if (freeze) x += '<sheetViews><sheetView workbookViewId="0"><pane ySplit="' + freeze + '" topLeftCell="A' + (freeze + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
    x += "<cols>" + widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join("") + "</cols><sheetData>";
    rows.forEach(function (r, ri) {
      x += '<row r="' + (ri + 1) + '">';
      (r || []).forEach(function (c, ci) {
        if (c === null || c === undefined || c === "") return;
        var v = typeof c === "object" ? c : { v: c }, ref = col(ci) + (ri + 1), s = v.s ? ' s="' + v.s + '"' : "";
        x += typeof v.v === "number" ? '<c r="' + ref + '"' + s + "><v>" + Math.round(v.v * 100) / 100 + "</v></c>" : '<c r="' + ref + '" t="inlineStr"' + s + "><is><t xml:space=\"preserve\">" + esc(v.v) + "</t></is></c>";
      });
      x += "</row>";
    });
    return x + "</sheetData>" + (drawing ? '<drawing r:id="rId1"/>' : "") + "</worksheet>";
  }
  /* Native Excel line chart (DrawingML), written by hand */
  function chartXml(first, last, n, cats, inv, pre) {
    function cache(vals) { return '<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="' + vals.length + '"/>' + vals.map(function (v, i) { return '<c:pt idx="' + i + '"><c:v>' + v + "</c:v></c:pt>"; }).join("") + "</c:numCache>"; }
    function ser(idx, colL, name, vals, color) {
      return '<c:ser><c:idx val="' + idx + '"/><c:order val="' + idx + '"/><c:tx><c:strRef><c:f>Chart!$' + colL + "$" + (first - 1) + '</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>' + esc(name) + "</c:v></c:pt></c:strCache></c:strRef></c:tx>" +
        '<c:spPr><a:ln w="38100" cap="rnd"><a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="none"/></c:marker>' +
        "<c:cat><c:numRef><c:f>Chart!$A$" + first + ":$A$" + last + "</c:f>" + cache(cats) + "</c:numRef></c:cat>" +
        "<c:val><c:numRef><c:f>Chart!$" + colL + "$" + first + ":$" + colL + "$" + last + "</c:f>" + cache(vals) + '</c:numRef></c:val><c:smooth val="0"/></c:ser>';
    }
    function title(t, sz) { return '<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="' + sz + '" b="1"/></a:pPr><a:r><a:rPr lang="en-IN" sz="' + sz + '" b="1"/><a:t>' + esc(t) + '</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>'; }
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<c:roundedCorners val="0"/><c:chart>' + title("Net worth over time (₹ lakh)", 1400) + '<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>' +
      '<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>' + ser(0, "B", "Invest the extra", inv, "1F5FE0") + ser(1, "C", "Prepay, then invest", pre, "E39A1E") +
      '<c:marker val="1"/><c:axId val="50010"/><c:axId val="50020"/></c:lineChart>' +
      '<c:catAx><c:axId val="50010"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>' + title("Year", 1000) + '<c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/><c:crossAx val="50020"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>' +
      '<c:valAx><c:axId val="50020"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="DDE4EF"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="0&quot; L&quot;" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="50010"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>' +
      '</c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>';
  }
  var DRAWING = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    '<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>3</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>7</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>24</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>' +
    '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Net worth chart"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>' +
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>';
  function X(n, f, fi, extra) { return '<xf numFmtId="' + n + '" fontId="' + f + '" fillId="' + fi + '" borderId="0" xfId="0"' + (extra || '') + '/>'; }
  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="1"><numFmt numFmtId="164" formatCode="[&gt;=10000000]&quot;₹&quot;##\\,##\\,##\\,##0;[&gt;=100000]&quot;₹&quot;##\\,##\\,##0;&quot;₹&quot;##,##0"/></numFmts>' +
    '<fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF1F5FE0"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF4F5D70"/><name val="Calibri"/></font></fonts>' +
    '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F5FE0"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF2F8"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="12">' +
    X(0,0,0) + X(0,2,2,' applyFont="1" applyFill="1"') + X(164,0,0,' applyNumberFormat="1"') + X(0,1,0,' applyFont="1"') + X(0,3,0,' applyFont="1"') +
    X(0,1,3,' applyFont="1" applyFill="1"') + X(164,1,0,' applyNumberFormat="1" applyFont="1"') + '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right"/></xf>' +
    '<xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right"/></xf>' +
    '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right"/></xf>' +
    '<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  function xlsx(d) {
    var S = d.S, s = d.sim, money = function (v) { return { v: v, s: 2 }; };
    var sum = [[{ v: "Salarist — Prepay vs Invest report", s: 4 }], [{ v: "Made on " + today() + " · " + d.url, s: 7 }], [],
      [{ v: "Your inputs", s: 5 }, { v: "", s: 5 }, { v: "", s: 5 }]];
    inputs(d).forEach(function (r) { var raw = { "Loan outstanding": S.P, "Extra each month": S.extra, "One-time amount today": S.lump }[r[0]]; sum.push([r[0], raw !== undefined ? money(raw) : { v: r[1], s: 8 }]); });
    var vl = d.verdictLines || [];
    sum.push([], [{ v: "Result", s: 5 }, { v: "", s: 5 }, { v: "", s: 5 }]);
    if (vl[0]) sum.push([{ v: vl[0], s: 7 }]);
    sum.push([{ v: vl[1] || verdict(d), s: 3 }]);
    if (vl[2]) sum.push([{ v: vl[2], s: 7 }]);
    keyNums(d).forEach(function (k) { sum.push([k[0], k[0] === "Your EMI" ? money(s.emi) : k[0] === "Interest saved by prepaying" ? money(s.invest.interest - s.prepay.interest) : { v: k[1], s: 8 }]); });
    sum.push([], [{ v: "What if returns are different?", s: 5 }, { v: "", s: 5 }, { v: "", s: 5 }]);
    d.sens.forEach(function (x) { sum.push(["At " + x.rate + "% a year", { v: x.diff > 0 ? "Investing wins by" : "Prepaying wins by", s: 8 }, money(Math.abs(x.diff))]); });
    sum.push([], [{ v: "Where your money went", s: 5 }, { v: "Prepay, then invest", s: 9 }, { v: "Invest the extra", s: 9 }]);
    [["Paid to the bank", "bank"], ["  of which interest", "interest"], ["Put into investments", "invested"], ["Investment growth", "growth"], ["Tax on investments", "tax"], ["You end up with", "final"]]
      .forEach(function (r) { var b = r[1] === "final"; sum.push([b ? { v: r[0], s: 3 } : r[0], { v: s.prepay[r[1]], s: b ? 6 : 2 }, { v: s.invest[r[1]], s: b ? 6 : 2 }]); });
    sum.push([], [{ v: "Assumptions", s: 5 }, { v: "", s: 5 }, { v: "", s: 5 }]);
    d.notes.forEach(function (n) { sum.push([{ v: n, s: 7 }]); });
    sum.push([], [{ v: "Tax rules used", s: 5 }, { v: "", s: 5 }, { v: "", s: 5 }]);
    TAXRULES.forEach(function (n) { sum.push([{ v: n, s: 7 }]); });
    sum.push([], [{ v: DISCLAIMER, s: 7 }], [{ v: "Free, private money tools for salaried India: salarist.in", s: 3 }]);
    function yearly(rows, P) {
      var h = (P ? ["Year", "EMI paid", "Extra into loan", "Interest", "Loan left", "Invested", "Investments value"] : ["Year", "EMI paid", "Interest", "Loan left", "Invested", "Investments value"]).map(function (t, i) { return { v: t, s: i ? 10 : 1 }; });
      return [h].concat(rows.map(function (r) { return (P ? [r.y, r.emi, r.extra, r.interest, r.bal, r.invest, r.corpus] : [r.y, r.emi, r.interest, r.bal, r.invest, r.corpus]).map(function (v, i) { return i ? money(v) : v; }); }));
    }
    function monthly(rows, P) {
      var h = (P ? ["Month", "EMI paid", "Extra into loan", "Interest", "Loan left", "Invested", "Investments value"] : ["Month", "EMI paid", "Interest", "Loan left", "Invested", "Investments value"]).map(function (t, i) { return { v: t, s: i ? 10 : 1 }; });
      return [h].concat(rows.map(function (r) { return (P ? [r.m, r.emi, r.extra, r.interest, r.bal, r.invest, r.corpus] : [r.m, r.emi, r.interest, r.bal, r.invest, r.corpus]).map(function (v, i) { return i ? money(v) : v; }); }));
    }
    var W7 = [10, 16, 16, 16, 16, 16, 20], W6 = [10, 16, 16, 16, 16, 20];
    /* Chart sheet: chart on top, its data (net worth at each year end, in ₹ lakh) underneath */
    var Y = Math.round(S.years), cats = [], inv = [], pre = [], HEAD = 26;
    for (var yy = 0; yy <= Y; yy++) { var i12 = Math.min(yy * 12, s.invest.net.length - 1); cats.push(yy); inv.push(Math.round(s.invest.net[i12] / 1000) / 100); pre.push(Math.round(s.prepay.net[i12] / 1000) / 100); }
    var ch = [[{ v: "Net worth over time", s: 4 }], [{ v: "Your investments minus what you still owe on the loan, at each year end, in ₹ lakh. Investments are shown before tax at the end.", s: 7 }]];
    while (ch.length < HEAD - 1) ch.push([]);
    ch.push([{ v: "Year", s: 1 }, { v: "Invest the extra", s: 10 }, { v: "Prepay, then invest", s: 10 }]);
    cats.forEach(function (c, i) { ch.push([c, { v: inv[i], s: 11 }, { v: pre[i], s: 11 }]); });
    var names = ["Summary", "Chart", "Yearly - Prepay", "Yearly - Invest", "Monthly - Prepay", "Monthly - Invest"];
    var sheets = [sheet(sum, [44, 26, 22]), sheet(ch, [12, 20, 20], 0, true), sheet(yearly(d.yearsPrepay, true), W7, 1), sheet(yearly(d.yearsInvest, false), W6, 1), sheet(monthly(s.prepay.rows, true), W7, 1), sheet(monthly(s.invest.rows, false), W6, 1)];
    var files = [
      ["[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        names.map(function (n, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join("") +
        '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>'],
      ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ["xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        names.map(function (n, i) { return '<sheet name="' + n + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join("") + "</sheets></workbook>"],
      ["xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        names.map(function (n, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join("") +
        '<Relationship Id="rId' + (names.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ["xl/styles.xml", STYLES]
    ].concat(sheets.map(function (x, i) { return ["xl/worksheets/sheet" + (i + 1) + ".xml", x]; }), [
      ["xl/worksheets/_rels/sheet2.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>'],
      ["xl/drawings/drawing1.xml", DRAWING],
      ["xl/drawings/_rels/drawing1.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/></Relationships>'],
      ["xl/charts/chart1.xml", chartXml(HEAD + 1, HEAD + 1 + Y, Y, cats, inv, pre)]
    ]);
    download(zip(files), "salarist-prepay-vs-invest-" + stamp() + ".xlsx");
  }

  window.SalaristReport = { pdf: pdf, xlsx: xlsx };
})();
