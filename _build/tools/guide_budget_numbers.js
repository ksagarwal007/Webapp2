/* Runs the Budget Planner engine on the guide's example household, so the guide always matches the tool.
   Usage: node tools/guide_budget_numbers.js  ->  JSON on stdout */
const B = require("../src/assets/js/budget.js");
const L = (sec, name, freq, amt, type, x) => Object.assign({ sec, name, freq, amt, type: type || "need" }, x || {});
const lines = [
  L("Income", "In-hand salary", "m", 110000, "need", { salary: true }), L("Income", "Bonus or variable pay", "y", 120000),
  L("Home", "Rent", "m", 24000), L("Home", "Society maintenance", "m", 3500), L("Home", "Electricity", "m", 2500),
  L("Home", "Internet and mobile", "m", 1500), L("Home", "Domestic help", "m", 6000),
  L("Family", "Groceries", "m", 12000), L("Family", "Milk, bread and daily needs", "d", 120), L("Family", "School fees", "y", 90000),
  L("Getting around", "Fuel", "m", 4000), L("Getting around", "Car or bike EMI", "m", 12000, "need", { emi: true }),
  L("EMIs and insurance", "Health insurance premium", "y", 25000),
  L("Lifestyle", "Eating out and ordering in", "m", 6000, "want"), L("Lifestyle", "Shopping and clothes", "m", 4000, "want"),
  L("Occasions", "Festivals and gifts", "y", 40000, "want"), L("Occasions", "Travel and holidays", "y", 60000, "want"),
  L("Savings", "SIPs and mutual funds", "m", 15000, "save")
];
const ef = 200000, st = { lines, ef };
const r = B.summarise(st);
const trim = B.summarise({ ef, lines: lines.map(l => l.name === "Eating out and ordering in" ? Object.assign({}, l, { amt: 4000 }) : l.name === "Shopping and clothes" ? Object.assign({}, l, { amt: 3000 }) : l) });
const efTarget = r.need * 6, efGap = Math.max(0, efTarget - ef);
const rows = lines.map(l => ({ sec: l.sec, name: l.name, freq: l.freq, amt: l.amt, type: l.type, monthly: B.monthly(l) }));
console.log(JSON.stringify({ lines: rows, ef, r, trim, efTarget, efGap, efMonthsAtLeft: r.left > 0 ? efGap / r.left : null, efMonthsAtTrim: trim.left > 0 ? efGap / trim.left : null }));
