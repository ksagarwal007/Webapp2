/* Restricted holidays 2027: which two to pick. Runs the Leave Planner engine with each restricted holiday added,
   so the article always matches the tool. Usage: node tools/guide_rh_numbers.js  ->  JSON on stdout */
const c = require("../src/assets/js/leave-planner.js");
const D = require("../src/data/holidays-2027.json");
const gaz = {}; D.gazetted.forEach(x => (gaz[x[0]] = gaz[x[0]] || []).push(x[1]));
function days(extra) { const h = {}; for (const k in gaz) h[k] = gaz[k].slice(); extra.forEach(e => (h[e[0]] = h[e[0]] || []).push(e[1])); return c.buildDays(D.year, "ss", h); }
const idx = (ds, iso) => ds.findIndex(d => d.iso === iso);
function freeAround(ds, i) { let a = i, b = i; while (a > 0 && ds[a - 1].off) a--; while (b < ds.length - 1 && ds[b + 1].off) b++; return { from: ds[a].iso, to: ds[b].iso, len: b - a + 1 }; }
function fmt(ds, x) { const lv = []; for (let i = x.a; i <= x.b; i++) if (!ds[i].off) lv.push(ds[i].iso); return { from: ds[x.a].iso, to: ds[x.b].iso, len: x.len, leave: x.leave, leaveDays: lv }; }
/* Longest break that includes all the given days, using at most maxLeave leave days (ties: less leave). */
function bestWith(ds, isos, maxLeave) {
  const ii = isos.map(k => idx(ds, k));
  const cs = c.candidates(ds, maxLeave).filter(x => ii.every(i => x.a <= i && x.b >= i)).sort((x, y) => y.len - x.len || x.leave - y.leave);
  return cs[0] ? fmt(ds, cs[0]) : null;
}
/* Same window without the restricted holiday: how much leave it would take. */
function leaveWithout(br) { const ds = days([]); let n = 0; for (let i = idx(ds, br.from); i <= idx(ds, br.to); i++) if (!ds[i].off) n++; return n; }
const list = D.restricted.map(r => {
  const w = c.parseIso(r[0]).getDay(), dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][w];
  if (w === 0 || w === 6) return { date: r[0], name: r[1], dow, kind: "weekend" };
  if (gaz[r[0]]) return { date: r[0], name: r[1], dow, kind: "clash", with: gaz[r[0]].join(" and ") };
  const ds = days([r]), free = freeAround(ds, idx(ds, r[0])), best = bestWith(ds, [r[0]], 3);
  if (best) best.leaveWithout = leaveWithout(best);
  const best1 = bestWith(ds, [r[0]], 1);
  return { date: r[0], name: r[1], dow, kind: free.len >= 3 ? "free" : "bridge", free, best, best1 };
});
const R = k => D.restricted.find(r => r[0] === k);
function pair(a, b, maxLeave) {
  const ds = days([R(a), R(b)]);
  const fa = freeAround(ds, idx(ds, a)), fb = freeAround(ds, idx(ds, b));
  const same = fa.from === fb.from;
  const brk = same ? [bestWith(ds, [a, b], maxLeave)] : [bestWith(ds, [a], maxLeave), bestWith(ds, [b], maxLeave)];
  brk.forEach(x => { if (x) x.leaveWithout = leaveWithout(x); });
  return { a, b, free: same ? [fa] : [fa, fb], breaks: brk };
}
const usable = list.filter(x => x.kind === "free" || x.kind === "bridge");
process.stdout.write(JSON.stringify({
  year: D.year, count: D.restricted.length, list,
  weekend: list.filter(x => x.kind === "weekend").length, clash: list.filter(x => x.kind === "clash").length, usable: usable.length,
  freeCount: list.filter(x => x.kind === "free").length,
  picks: { holiNaraka: pair("2027-03-22", "2027-10-28", 3), holiVaisakhi: pair("2027-03-22", "2027-04-14", 3), dussehra: pair("2027-10-07", "2027-10-08", 3) }
}));
