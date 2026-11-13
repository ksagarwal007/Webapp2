/* Numbers for two leave articles: best months for a week-long break, and long weekends for six-day-week workers.
   Runs the Leave Planner engine on the central 2027 list. Usage: node tools/guide_leave_more_numbers.js -> JSON */
const c = require("../src/assets/js/leave-planner.js");
const D = require("../src/data/holidays-2027.json");
const h = {}; D.gazetted.forEach(x => { (h[x[0]] = h[x[0]] || []).push(x[1]); });
function fmt(days, b) { const lv = [], hol = []; for (let i = b.a; i <= b.b; i++) { if (!days[i].off) lv.push(days[i].iso); if (days[i].hol) hol.push(...days[i].hol); }
  return { from: days[b.a].iso, to: days[b.b].iso, len: b.b - b.a + 1, leave: lv.length, leaveDays: lv, holidays: hol }; }
const MON = ["January","February","March","April","May","June","July","August","September","October","November","December"];
/* Best months: for each month, the 9-day break (two weekends and the week between) that needs the least leave, Mon-Fri week. */
const d5 = c.buildDays(D.year, "ss", h);
const months = MON.map((name, m) => { const w = c.bestWindows(d5, 9, m, 1)[0]; return Object.assign({ month: name }, fmt(d5, w)); });
/* Six-day weeks */
function pattern(pat) {
  const ds = c.buildDays(D.year, pat, h);
  const plan = b => { const p = c.bestPlan(c.candidates(ds, b), b); return { used: p.reduce((s, x) => s + x.leave, 0), daysOff: p.reduce((s, x) => s + x.len, 0), breaks: p.map(x => fmt(ds, x)) }; };
  return { long: c.longWeekends(ds).map(x => fmt(ds, x)), value: c.bestValue(c.candidates(ds, 3), 3, 6).map(x => fmt(ds, x)), plan8: plan(8), plan12: plan(12),
           week: c.bestWindows(ds, 9, -1, 3).map(x => fmt(ds, x)) };
}
const out = { months, five: pattern("ss"), sunOnly: pattern("s"), alt: pattern("s24") };
process.stdout.write(JSON.stringify(out));
