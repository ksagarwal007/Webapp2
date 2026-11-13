/* Runs the Leave Planner engine on the central 2027 list for the leave guide, so the guide always matches the tool.
   Usage: node tools/guide_leave_numbers.js  ->  JSON on stdout */
const c = require("../src/assets/js/leave-planner.js");
const D = require("../src/data/holidays-2027.json");
const h = {}; D.gazetted.forEach(x => { (h[x[0]] = h[x[0]] || []).push(x[1]); });
const days = c.buildDays(D.year, "ss", h);
const fmt = b => {
  const lv = [], hol = [];
  for (let i = b.a; i <= b.b; i++) { if (!days[i].off) lv.push(days[i].iso); if (days[i].hol) hol.push(...days[i].hol); }
  return { from: days[b.a].iso, to: days[b.b].iso, len: b.len, leave: b.leave, leaveDays: lv, holidays: hol };
};
const dates = [...new Set(D.gazetted.map(x => x[0]))];
const wd = dates.filter(d => { const x = c.parseIso(d).getDay(); return x >= 1 && x <= 5; });
const cand5 = c.candidates(days, 5);
const longestBy = {};
for (let l = 1; l <= 5; l++) { const best = cand5.filter(x => x.leave === l).sort((x, y) => y.len - x.len || x.a - y.a)[0]; if (best) longestBy[l] = fmt(best); }
const plan = budget => { const p = c.bestPlan(c.candidates(days, budget), budget); return { budget, used: p.reduce((s, x) => s + x.leave, 0), daysOff: p.reduce((s, x) => s + x.len, 0), breaks: p.map(fmt) }; };
const pattern = pat => { const ds = c.buildDays(D.year, pat, h); return { long: c.longWeekends(ds).length, value: c.bestValue(c.candidates(ds, 3), 3, 8).map(b => ({ from: ds[b.a].iso, to: ds[b.b].iso, len: b.len, leave: b.leave })) }; };
console.log(JSON.stringify({
  year: D.year, source: D.source, holidays: D.gazetted, distinct: dates.length, weekday: wd.length, restricted: D.restricted.length,
  long: c.longWeekends(days).map(fmt), value: c.bestValue(c.candidates(days, 3), 3, 8).map(fmt), longestBy,
  plan8: plan(8), plan12: plan(12), sixDay: pattern("s")
}));
