// Builds the static "long weekends" and "best value" lists for the page text, using the same code as the live tool.
const c = require("../src/assets/js/leave-planner.js");
const D = require("../src/data/holidays-2027.json");
const h = {}; D.gazetted.forEach(x => { (h[x[0]] = h[x[0]] || []).push(x[1]); });
const days = c.buildDays(D.year, "ss", h);
const fmt = b => {
  const lv = [], hol = [];
  for (let i = b.a; i <= b.b; i++) { if (!days[i].off) lv.push(days[i].iso); if (days[i].hol) hol.push(...days[i].hol); }
  return { from: days[b.a].iso, to: days[b.b].iso, len: b.len, leave: b.leave, leaveDays: lv, holidays: hol };
};
console.log(JSON.stringify({
  long: c.longWeekends(days).map(fmt),
  value: c.bestValue(c.candidates(days, 3), 3, 8).map(fmt)
}));
