/* Salarist report kit: branded PDF and Excel for any tool, made in the browser with no libraries.
   Loaded only when someone asks for a report. Each tool passes a "spec" describing its content. */
(function () {
  "use strict";
  var FONT = '"Plus Jakarta Sans", system-ui, sans-serif';
  var C = { ink: "#0E1726", muted: "#4F5D70", line: "#CDD6E3", soft: "#EEF2F8", blue: "#1F5FE0", amber: "#E39A1E", green: "#0B7F5A", white: "#FFFFFF" };
  var PW = 1654, PH = 2339, M = 120;   /* A4 at 200 dpi */
  var DISCLAIMER = "This report gives estimates for information only. It is not tax, legal or financial advice. Investment and property returns are not guaranteed. Check important decisions with a qualified adviser.";

  function download(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1000);
  }
  function stamp() { var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; }; return p(d.getDate()) + p(d.getMonth() + 1) + String(d.getFullYear()).slice(2) + "-" + p(d.getHours()) + p(d.getMinutes()); }
  function today() { return new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }); }
  function col(name) { return name === "amber" ? C.amber : name === "green" ? C.green : C.blue; }

  /* ---------- PDF ---------- */
  function newPage() { var c = document.createElement("canvas"); c.width = PW; c.height = PH; var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, PW, PH); return { c: c, x: x }; }
  function T(x, t, X, Y, sz, w, cl, al) { x.font = (w || 400) + " " + sz + "px " + FONT; x.fillStyle = cl || C.ink; x.textAlign = al || "left"; x.textBaseline = "alphabetic"; x.fillText(t, X, Y); return x.measureText(t).width; }
  function R(x, X, Y, W, H, r, fill, stroke) {
    x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath();
    if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = 2; x.stroke(); }
  }
  function wrap(x, text, X, Y, maxW, sz, w, cl, lh) {
    x.font = (w || 400) + " " + sz + "px " + FONT; var words = String(text).split(" "), line = "", y = Y;
    for (var i = 0; i < words.length; i++) { var t = line ? line + " " + words[i] : words[i]; if (x.measureText(t).width > maxW && line) { T(x, line, X, y, sz, w, cl); line = words[i]; y += lh; } else line = t; }
    if (line) { T(x, line, X, y, sz, w, cl); y += lh; }
    return y;
  }
  function fitSize(x, t, sz, w, maxW) { while (sz > 14) { x.font = w + " " + sz + "px " + FONT; if (x.measureText(t).width <= maxW) break; sz -= 1; } return sz; }
  function logo(x, X, Y, h) {
    var svg = document.querySelector(".top .brand svg"); if (!svg) { T(x, "Salarist", X, Y + h * 0.8, h * 0.8, 800, C.ink); return; }
    var vb = svg.getAttribute("viewBox").split(/\s+/).map(Number), k = h / vb[3];
    x.save(); x.translate(X, Y); x.scale(k, k); x.translate(-vb[0], -vb[1]);
    x.fillStyle = C.ink; x.fill(new Path2D(svg.querySelector(".ink").getAttribute("d")));
    var ci = svg.querySelector(".coin"); x.beginPath(); x.arc(+ci.getAttribute("cx"), +ci.getAttribute("cy"), +ci.getAttribute("r"), 0, 7); x.fillStyle = C.blue; x.fill(); x.restore();
  }
  function header(p, sp) {
    var x = p.x; logo(x, M, 80, 60);
    T(x, sp.title, PW - M, 110, 30, 700, C.ink, "right");
    T(x, "Made on " + today() + " · " + sp.path, PW - M, 150, 22, 400, C.muted, "right");
    x.strokeStyle = C.line; x.lineWidth = 2; x.beginPath(); x.moveTo(M, 190); x.lineTo(PW - M, 190); x.stroke();
    return 250;
  }
  function chart(x, sp, X, Y, W, H) {
    var ch = sp.chart, ser = ch.series, n = ser[0].data.length - 1, all = [];
    ser.forEach(function (s) { all = all.concat(s.data); });
    var mx = Math.max.apply(null, all), mn = Math.min.apply(null, all.concat([0])), span = (mx - mn) || 1, pl = 130, pb = 40;
    function px(i) { return X + pl + i / n * (W - pl); } function py(v) { return Y + (mx - v) / span * (H - pb); }
    x.lineWidth = 1.5;
    for (var k = 0; k <= 4; k++) { var v = mn + span * k / 4, yy = py(v); x.strokeStyle = C.line; x.beginPath(); x.moveTo(X + pl, yy); x.lineTo(X + W, yy); x.stroke(); T(x, sp.short(v), X + pl - 14, yy + 8, 20, 600, C.muted, "right"); }
    var yrs = n / 12, step = yrs > 20 ? 5 : yrs > 8 ? 2 : 1;
    for (var t = 0; t <= yrs + 1e-9; t += step) T(x, "Yr " + t, px(t * 12), Y + H, 20, 600, C.muted, "center");
    if (mn < 0 && mx > 0) { x.setLineDash([8, 8]); x.strokeStyle = C.muted; x.beginPath(); x.moveTo(X + pl, py(0)); x.lineTo(X + W, py(0)); x.stroke(); x.setLineDash([]); T(x, "₹0", X + pl + 10, py(0) - 10, 18, 600, C.muted); }
    if (ch.vline && ch.vline.m < n) { var vm = ch.vline.m; x.setLineDash([6, 6]); x.strokeStyle = C.amber; x.beginPath(); x.moveTo(px(vm), Y); x.lineTo(px(vm), Y + H - pb); x.stroke(); x.setLineDash([]); T(x, ch.vline.label, px(vm), Y - 10, 18, 700, C.amber, vm / n > 0.7 ? "right" : "center"); }
    ser.slice().reverse().forEach(function (s) { x.beginPath(); for (var i = 0; i <= n; i++) { if (i) x.lineTo(px(i), py(s.data[i])); else x.moveTo(px(i), py(s.data[i])); } x.strokeStyle = col(s.color); x.lineWidth = 5; x.lineJoin = "round"; x.stroke(); });
    if (ch.cross) { x.beginPath(); x.arc(px(ch.cross.m), py(ser[0].data[ch.cross.m]), 10, 0, 7); x.fillStyle = C.green; x.fill(); }
  }
  function tablePages(pages, sp, tb, startY) {
    var cols = tb.cols, W = PW - 2 * M, cw = W / cols.length, p = pages[pages.length - 1], y = startY, title = tb.title;
    var hs = 20; cols.forEach(function (c) { hs = Math.min(hs, fitSize(p.x, c, 20, 700, cw - 24)); });
    function head() {
      T(p.x, title, M, y, 34, 800, C.ink); y += 30;
      R(p.x, M, y, W, 56, 12, C.blue);
      cols.forEach(function (c, i) { T(p.x, c, i === 0 ? M + 20 : M + cw * (i + 1) - 16, y + 37, hs, 700, C.white, i === 0 ? "left" : "right"); });
      y += 56;
    }
    head();
    tb.rows.forEach(function (r, ri) {
      if (y + 44 > PH - 160) { p = newPage(); pages.push(p); y = header(p, sp); title = tb.title + " (continued)"; head(); }
      if (ri % 2) R(p.x, M, y, W, 44, 0, C.soft);
      r.forEach(function (v, i) { var t = i === 0 ? String(v) : sp.inr(v); T(p.x, t, i === 0 ? M + 20 : M + cw * (i + 1) - 16, y + 30, fitSize(p.x, t, 20, 500, cw - 20), i === 0 ? 700 : 500, C.ink, i === 0 ? "left" : "right"); });
      y += 44;
    });
    return y + 40;
  }
  function makePages(sp) {
    var pages = [], p = newPage(); pages.push(p); var x = p.x, y = header(p, sp), W = PW - 2 * M;
    T(x, sp.question, M, y, 30, 600, C.muted); y += 80;
    var vl = sp.verdictLines;
    if (vl[0]) { T(x, vl[0], M, y - 20, 26, 600, C.muted); y += 76; }
    T(x, vl[1], M, y, fitSize(x, vl[1], 72, 800, W), 800, col(sp.verdictColor)); y += 50;
    if (vl[2]) y = wrap(x, vl[2], M, y, W, 26, 400, C.ink, 38) + 20;
    var inp = sp.inputs, half = W / 2, rowsN = Math.ceil(inp.length / 2), boxH = 90 + rowsN * 44;
    R(x, M, y, W, boxH, 24, C.soft);
    T(x, "Your inputs", M + 30, y + 52, 26, 800, C.ink);
    inp.forEach(function (it, i) { var cx = M + 30 + (i % 2) * half, cy = y + 104 + Math.floor(i / 2) * 44; T(x, it[0], cx, cy, fitSize(x, it[0], 21, 600, half * 0.52), 600, C.muted); T(x, it[1], cx + half - 60, cy, fitSize(x, it[1], 21, 700, half * 0.4), 700, C.ink, "right"); });
    y += boxH + 40;
    var kn = sp.keyNums, bw = (W - 3 * 20) / 4;
    kn.forEach(function (k, i) { var bx = M + i * (bw + 20); R(x, bx, y, bw, 130, 20, null, C.line); wrap(x, k[0], bx + 22, y + 40, bw - 44, 19, 600, C.muted, 26); T(x, k[1], bx + 22, y + 108, fitSize(x, k[1], 28, 800, bw - 44), 800, C.ink); });
    y += 180;
    T(x, sp.sensTitle, M, y, 26, 800, C.ink); y += 24;
    var sw = (W - 2 * 20) / 3;
    sp.sens.forEach(function (s, i) { var bx = M + i * (sw + 20), cur = i === sp.sensCurrent; R(x, bx, y, sw, 96, 18, cur ? C.soft : null, cur ? C.blue : C.line); T(x, s[0], bx + 22, y + 38, 20, 600, C.muted); T(x, s[1], bx + 22, y + 76, fitSize(x, s[1], 26, 800, sw - 44), 800, C.ink); });
    y += 150;
    var chartH = Math.min(560, PH - 220 - y - 120);
    if (chartH < 260) { p = newPage(); pages.push(p); x = p.x; y = header(p, sp); chartH = 560; }
    T(x, sp.chartTitle, M, y, 26, 800, C.ink); y += 16;
    T(x, sp.chartNote, M, y + 22, 20, 400, C.muted); y += 70;
    chart(x, sp, M, y, W, chartH); y += chartH + 40;
    var lx = M; sp.chart.series.map(function (s) { return [col(s.color), s.name]; }).concat(sp.chart.cross ? [[C.green, sp.chart.cross.label]] : [])
      .forEach(function (it) { R(x, lx, y - 20, 24, 24, 6, it[0]); lx += 36; lx += T(x, it[1], lx, y, 20, 600, C.muted) + 36; });
    /* money + tables */
    p = newPage(); pages.push(p); x = p.x; y = header(p, sp);
    T(x, sp.money.title || "Where your money went", M, y, 34, 800, C.ink); y += 40;
    R(x, M, y, W, 56, 12, C.blue); T(x, sp.money.cols[0], M + W * 0.72, y + 37, 21, 700, C.white, "right"); T(x, sp.money.cols[1], M + W - 20, y + 37, 21, 700, C.white, "right"); y += 56;
    sp.money.rows.forEach(function (r, i) {
      if (i % 2) R(x, M, y, W, 46, 0, C.soft);
      var bold = r[3] === "total", sub = r[3] === "sub", head = r[3] === "head";
      T(x, r[0], M + (sub ? 44 : 20), y + 31, 22, bold || head ? 800 : 500, sub ? C.muted : C.ink);
      if (!head) [r[1], r[2]].forEach(function (v, j) { var t = v === null || v === undefined ? "—" : (typeof v === "string" ? v : sp.inr(v)); T(x, t, j ? M + W - 20 : M + W * 0.72, y + 31, 22, bold ? 800 : 600, bold ? C.green : C.ink, "right"); });
      y += 46;
    });
    if (sp.money.note) y = wrap(x, sp.money.note, M, y + 40, W, 21, 400, C.muted, 32);
    y += 40;
    sp.tables.forEach(function (tb) {
      p = pages[pages.length - 1];
      if (y + 300 > PH - 160) { p = newPage(); pages.push(p); y = header(p, sp); }
      y = tablePages(pages, sp, { title: tb.title, cols: tb.cols, rows: tb.yearly }, y);
    });
    p = pages[pages.length - 1]; x = p.x;
    var need = 260 + (sp.notes.length + sp.taxRules.length) * 72;
    if (y + need > PH - 160) { p = newPage(); pages.push(p); x = p.x; y = header(p, sp); }
    T(x, "Assumptions", M, y, 30, 800, C.ink); y += 46;
    sp.notes.forEach(function (n) { y = wrap(x, "•  " + n, M, y, W, 21, 400, C.ink, 32) + 6; });
    y += 20; T(x, "Tax rules used", M, y, 30, 800, C.ink); y += 46;
    sp.taxRules.forEach(function (n) { y = wrap(x, "•  " + n, M, y, W, 21, 400, C.ink, 32) + 6; });
    if (y + 200 > PH - 130) { p = newPage(); pages.push(p); x = p.x; y = header(p, sp); }
    y += 30; R(x, M, y, W, 150, 18, C.soft); wrap(x, DISCLAIMER, M + 30, y + 50, W - 60, 21, 500, C.muted, 32);
    pages.forEach(function (pg, i) {
      pg.x.strokeStyle = C.line; pg.x.lineWidth = 2; pg.x.beginPath(); pg.x.moveTo(M, PH - 110); pg.x.lineTo(PW - M, PH - 110); pg.x.stroke();
      T(pg.x, "Free, private money tools for salaried India · salarist.in", M, PH - 70, 20, 600, C.muted);
      T(pg.x, "Page " + (i + 1) + " of " + pages.length, PW - M, PH - 70, 20, 600, C.muted, "right");
    });
    return pages.map(function (pg) { return pg.c; });
  }
  function b64bytes(dataUrl) { var b = atob(dataUrl.split(",")[1]), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function buildPdf(canvases, title) {
    var enc = function (s) { var u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
    var parts = [], offs = [], len = 0, n = canvases.length;
    function push(u) { parts.push(u); len += u.length; }
    function obj(id, body) { offs[id] = len; push(enc(id + " 0 obj\n")); body.forEach(function (b) { push(typeof b === "string" ? enc(b) : b); }); push(enc("\nendobj\n")); }
    push(enc("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"));
    var kids = []; for (var i = 0; i < n; i++) kids.push((4 + i * 3) + " 0 R");
    obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
    obj(2, ["<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + n + " >>"]);
    obj(3, ["<< /Title (Salarist - " + title.replace(/[()\\]/g, "") + ") /Producer (salarist.in) /Creator (salarist.in) >>"]);
    canvases.forEach(function (cv, i) {
      var pid = 4 + i * 3, cid = pid + 1, iid = pid + 2, jpg = b64bytes(cv.toDataURL("image/jpeg", 0.82)), content = "q 595.28 0 0 841.89 0 0 cm /Im0 Do Q";
      obj(pid, ["<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 " + iid + " 0 R >> >> /Contents " + cid + " 0 R >>"]);
      obj(cid, ["<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream"]);
      obj(iid, ["<< /Type /XObject /Subtype /Image /Width " + cv.width + " /Height " + cv.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpg.length + " >>\nstream\n", jpg, "\nendstream"]);
    });
    var total = 4 + n * 3, xref = len, xr = "xref\n0 " + total + "\n0000000000 65535 f \n";
    for (var k = 1; k < total; k++) xr += String(offs[k]).padStart(10, "0") + " 00000 n \n";
    push(enc(xr + "trailer\n<< /Size " + total + " /Root 1 0 R /Info 3 0 R >>\nstartxref\n" + xref + "\n%%EOF\n"));
    return new Blob(parts, { type: "application/pdf" });
  }
  function pdf(sp) {
    var fl = document.fonts && document.fonts.load ? Promise.all(["400", "500", "600", "700", "800"].map(function (w) { return document.fonts.load(w + ' 40px "Plus Jakarta Sans"'); })) : Promise.resolve();
    return fl.catch(function () {}).then(function () { return new Promise(function (r) { setTimeout(r, 30); }); })
      .then(function () { download(buildPdf(makePages(sp), sp.title), sp.file + "-" + stamp() + ".pdf"); });
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
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(10, time, true); h.setUint16(12, date, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(12, time, true); c.setUint16(14, date, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    });
    var csize = central.reduce(function (s, u) { return s + u.length; }, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function colL(i) { var s = ""; i++; while (i) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - 1 - m) / 26 | 0; } return s; }
  /* styles: 0 normal, 1 header, 2 money, 3 bold, 4 title, 5 section, 6 money bold, 7 muted, 8 right text, 9 section right, 10 header right, 11 2-decimals */
  function sheet(rows, widths, freeze, drawing) {
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
    if (freeze) x += '<sheetViews><sheetView workbookViewId="0"><pane ySplit="' + freeze + '" topLeftCell="A' + (freeze + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
    x += "<cols>" + widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join("") + "</cols><sheetData>";
    rows.forEach(function (r, ri) {
      x += '<row r="' + (ri + 1) + '">';
      (r || []).forEach(function (c, ci) {
        if (c === null || c === undefined || c === "") return;
        var v = typeof c === "object" ? c : { v: c }, ref = colL(ci) + (ri + 1), s = v.s ? ' s="' + v.s + '"' : "";
        x += typeof v.v === "number" ? '<c r="' + ref + '"' + s + "><v>" + Math.round(v.v * 100) / 100 + "</v></c>" : '<c r="' + ref + '" t="inlineStr"' + s + '><is><t xml:space="preserve">' + esc(v.v) + "</t></is></c>";
      });
      x += "</row>";
    });
    return x + "</sheetData>" + (drawing ? '<drawing r:id="rId1"/>' : "") + "</worksheet>";
  }
  function X(n, f, fi, extra, inner) { return '<xf numFmtId="' + n + '" fontId="' + f + '" fillId="' + fi + '" borderId="0" xfId="0"' + (extra || "") + (inner ? ">" + inner + "</xf>" : "/>"); }
  var RIGHT = '<alignment horizontal="right"/>';
  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="1"><numFmt numFmtId="164" formatCode="[&gt;=10000000]&quot;₹&quot;##\\,##\\,##\\,##0;[&gt;=100000]&quot;₹&quot;##\\,##\\,##0;&quot;₹&quot;##,##0"/></numFmts>' +
    '<fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF1F5FE0"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF4F5D70"/><name val="Calibri"/></font></fonts>' +
    '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F5FE0"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF2F8"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="12">' +
    X(0, 0, 0) + X(0, 2, 2, ' applyFont="1" applyFill="1"') + X(164, 0, 0, ' applyNumberFormat="1"') + X(0, 1, 0, ' applyFont="1"') + X(0, 3, 0, ' applyFont="1"') +
    X(0, 1, 3, ' applyFont="1" applyFill="1"') + X(164, 1, 0, ' applyNumberFormat="1" applyFont="1"') + X(0, 4, 0, ' applyFont="1" applyAlignment="1"', '<alignment vertical="top"/>') +
    X(0, 0, 0, ' applyAlignment="1"', RIGHT) + X(0, 1, 3, ' applyFont="1" applyFill="1" applyAlignment="1"', RIGHT) + X(0, 2, 2, ' applyFont="1" applyFill="1" applyAlignment="1"', RIGHT) + X(2, 0, 0, ' applyNumberFormat="1"') +
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  function chartXml(first, last, cats, ser, chTitle) {
    function cache(vals) { return '<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="' + vals.length + '"/>' + vals.map(function (v, i) { return '<c:pt idx="' + i + '"><c:v>' + v + "</c:v></c:pt>"; }).join("") + "</c:numCache>"; }
    function one(idx, L, s) {
      var hex = s.color === "amber" ? "E39A1E" : s.color === "green" ? "0B7F5A" : "1F5FE0";
      return '<c:ser><c:idx val="' + idx + '"/><c:order val="' + idx + '"/><c:tx><c:strRef><c:f>Chart!$' + L + "$" + (first - 1) + '</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>' + esc(s.name) + "</c:v></c:pt></c:strCache></c:strRef></c:tx>" +
        '<c:spPr><a:ln w="38100" cap="rnd"><a:solidFill><a:srgbClr val="' + hex + '"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="none"/></c:marker>' +
        "<c:cat><c:numRef><c:f>Chart!$A$" + first + ":$A$" + last + "</c:f>" + cache(cats) + "</c:numRef></c:cat>" +
        "<c:val><c:numRef><c:f>Chart!$" + L + "$" + first + ":$" + L + "$" + last + "</c:f>" + cache(s.vals) + '</c:numRef></c:val><c:smooth val="0"/></c:ser>';
    }
    function title(t, sz) { return '<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="' + sz + '" b="1"/></a:pPr><a:r><a:rPr lang="en-IN" sz="' + sz + '" b="1"/><a:t>' + esc(t) + '</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>'; }
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<c:roundedCorners val="0"/><c:chart>' + title(chTitle, 1400) + '<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>' +
      ser.map(function (s, i) { return one(i, colL(i + 1), s); }).join("") + '<c:marker val="1"/><c:axId val="50010"/><c:axId val="50020"/></c:lineChart>' +
      '<c:catAx><c:axId val="50010"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>' + title("Year", 1000) + '<c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/><c:crossAx val="50020"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>' +
      '<c:valAx><c:axId val="50020"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="DDE4EF"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="0&quot; L&quot;" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="50010"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>' +
      '</c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>';
  }
  var DRAWING = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    '<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>3</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>7</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>24</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>' +
    '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Net worth chart"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>' +
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>';

  function xlsx(sp) {
    var money = function (v) { return { v: v, s: 2 }; }, sec = function (t, b, c) { return [{ v: t, s: 5 }, { v: b || "", s: b ? 9 : 5 }, { v: c || "", s: c ? 9 : 5 }]; };
    var sum = [[{ v: "Salarist — " + sp.title, s: 4 }], [{ v: "Made on " + today() + " · " + sp.url, s: 7 }], [], sec("Your inputs")];
    sp.inputs.forEach(function (r) { sum.push([r[0], typeof r[2] === "number" ? money(r[2]) : { v: r[1], s: 8 }]); });
    sum.push([], sec("Result"));
    var vl = sp.verdictLines; if (vl[0]) sum.push([{ v: vl[0], s: 7 }]); sum.push([{ v: vl[1], s: 3 }]); if (vl[2]) sum.push([{ v: vl[2], s: 7 }]);
    sp.keyNums.forEach(function (k) { sum.push([k[0], typeof k[2] === "number" ? money(k[2]) : { v: k[1], s: 8 }]); });
    sum.push([], sec(sp.sensTitle));
    sp.sens.forEach(function (s) { sum.push([s[0], { v: s[1], s: 8 }]); });
    sum.push([], sec(sp.money.title || "Where your money went", sp.money.cols[0], sp.money.cols[1]));
    sp.money.rows.forEach(function (r) {
      var b = r[3] === "total";
      if (r[3] === "head") { sum.push([{ v: r[0], s: 3 }]); return; }
      function cell(v) { return v === null || v === undefined ? { v: "—", s: 8 } : typeof v === "string" ? { v: v, s: 8 } : { v: v, s: b ? 6 : 2 }; }
      sum.push([b ? { v: r[0], s: 3 } : (r[3] === "sub" ? "  " + r[0] : r[0]), cell(r[1]), cell(r[2])]);
    });
    if (sp.money.note) sum.push([{ v: sp.money.note, s: 7 }]);
    sum.push([], sec("Assumptions")); sp.notes.forEach(function (n) { sum.push([{ v: n, s: 7 }]); });
    sum.push([], sec("Tax rules used")); sp.taxRules.forEach(function (n) { sum.push([{ v: n, s: 7 }]); });
    sum.push([], [{ v: DISCLAIMER, s: 7 }], [{ v: "Free, private money tools for salaried India: salarist.in", s: 3 }]);
    var HEAD = 26, cats = sp.chartYears, ch = [[{ v: sp.chartTitle, s: 4 }], [{ v: sp.chartNote + " At each year end, in ₹ lakh.", s: 7 }]];
    while (ch.length < HEAD - 1) ch.push([]);
    ch.push([{ v: "Year", s: 1 }].concat(sp.chart.series.map(function (s) { return { v: s.name, s: 10 }; })));
    var serVals = sp.chart.series.map(function (s) { return cats.map(function (y) { return Math.round(s.data[Math.min(y * 12, s.data.length - 1)] / 1000) / 100; }); });
    cats.forEach(function (c, i) { ch.push([c].concat(serVals.map(function (v) { return { v: v[i], s: 11 }; }))); });
    var names = ["Summary", "Chart"], sheets = [sheet(sum, [46, 26, 22]), sheet(ch, [12, 22, 22], 0, true)];
    function tbl(cols, rows) { return [cols.map(function (t, i) { return { v: t, s: i ? 10 : 1 }; })].concat(rows.map(function (r) { return r.map(function (v, i) { return i ? money(v) : v; }); })); }
    sp.tables.forEach(function (tb) { names.push("Yearly - " + tb.sheet); sheets.push(sheet(tbl(tb.cols, tb.yearly), [10].concat(tb.cols.slice(1).map(function () { return 18; })), 1)); });
    sp.tables.filter(function (tb) { return tb.monthly; }).forEach(function (tb) { names.push("Monthly - " + tb.sheet); sheets.push(sheet(tbl(["Month"].concat(tb.cols.slice(1)), tb.monthly), [10].concat(tb.cols.slice(1).map(function () { return 18; })), 1)); });
    var files = [
      ["[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        names.map(function (n, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join("") +
        '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>'],
      ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ["xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        names.map(function (n, i) { return '<sheet name="' + esc(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join("") + "</sheets></workbook>"],
      ["xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        names.map(function (n, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join("") +
        '<Relationship Id="rId' + (names.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ["xl/styles.xml", STYLES]
    ].concat(sheets.map(function (x, i) { return ["xl/worksheets/sheet" + (i + 1) + ".xml", x]; }), [
      ["xl/worksheets/_rels/sheet2.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>'],
      ["xl/drawings/drawing1.xml", DRAWING],
      ["xl/drawings/_rels/drawing1.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/></Relationships>'],
      ["xl/charts/chart1.xml", chartXml(HEAD + 1, HEAD + cats.length, cats, sp.chart.series.map(function (s, i) { return { name: s.name, color: s.color, vals: serVals[i] }; }), sp.xlsxChartTitle || "Net worth over time (₹ lakh)")]
    ]);
    download(zip(files), sp.file + "-" + stamp() + ".xlsx");
  }

  window.SalaristReportKit = { pdf: pdf, xlsx: xlsx };
})();
