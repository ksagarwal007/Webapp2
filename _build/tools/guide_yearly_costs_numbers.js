/* Numbers for "How to plan for school fees and other yearly costs", using the Budget Planner engine for the set-aside.
   Usage: node tools/guide_yearly_costs_numbers.js -> JSON */
const B = require("../src/assets/js/budget.js");
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
/* [name, amount a year, [month index, share] ...] months 0-11 */
const items = [
  ["School fees", 140000, [[3, 0.5], [9, 0.5]]],
  ["Books, uniforms and school transport deposit", 20000, [[5, 1]]],
  ["Health insurance premium", 28000, [[7, 1]]],
  ["Car insurance and servicing", 18000, [[0, 1]]],
  ["Term life insurance premium", 15000, [[2, 1]]],
  ["Festivals and gifts (Diwali)", 40000, [[9, 1]]],
  ["Summer holiday", 60000, [[4, 1]]],
];
const lines = items.map(i => ({ sec: "Occasions", name: i[0], freq: "y", amt: i[1], type: "need" }));
const setAside = B.summarise({ lines, ef: 0 }).setAside;
const yearly = items.reduce((a, i) => a + i[1], 0);
const bills = Array(12).fill(0); const billNames = Array.from({ length: 12 }, () => []);
items.forEach(i => i[2].forEach(([m, s]) => { bills[m] += i[1] * s; billNames[m].push(i[0]); }));
/* Running balance of a separate account, putting aside setAside each month from startMonth (index into a Dec-start year). */
function run(startOffset, buffer) {
  const order = [11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];  /* Dec 2026 to Nov 2027 */
  let bal = buffer, low = Infinity, rows = [];
  order.forEach((m, i) => { const dep = i >= startOffset ? setAside : 0; bal += dep - bills[m]; low = Math.min(low, bal); rows.push({ month: MON[m] + (m === 11 ? " 2026" : " 2027"), dep, bill: bills[m], bal, what: billNames[m] }); });
  return { rows, low };
}
const now = run(0, 0);
const buffer = Math.max(0, -now.low);              /* one-time amount needed at the start so the account never goes negative */
const withBuf = run(0, buffer);
const late = run(4, 0);                             /* start in April instead of December */
/* Without a set-aside: the months where yearly bills land on one salary */
const big = bills.map((b, m) => ({ month: MON[m], bill: b })).filter(x => x.bill >= 40000).sort((a, b) => b.bill - a.bill);
process.stdout.write(JSON.stringify({ items: items.map(i => ({ name: i[0], amt: i[1], when: i[2].map(([m, s]) => MON[m] + (s < 1 ? " (" + Math.round(s * 100) + "%)" : "")).join(", ") })), yearly, setAside, now, buffer, withBuf, late, big }));
