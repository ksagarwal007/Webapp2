/* Numbers for the batch T5 guides (job offer comparator), from the tool's own code. Example: Nikhil, 31, 4.5 years at his job, ₹1.2 lakh a month gross;
   offer of ₹1.5 lakh. Usage: node tools/guide_t5_numbers.js -> JSON */
const J = require("../src/assets/js/jo.js");
const base = { years: 3, done: 4.5, claw: 0, notice: 0, timeValue: 0,
  a: { basic: 50000, hra: 25000, other: 45000, pf: "full", variable: 150000, payout: 80, bonus: 0, stock: 0, hike: 8, office: 2, commute: 400, hours: 1.5, wfhAllow: 0, wfhCost: 1500 },
  b: { basic: 60000, hra: 30000, other: 60000, pf: "capped", variable: 200000, payout: 70, bonus: 150000, stock: 100000, hike: 7, office: 5, commute: 600, hours: 2, wfhAllow: 0, wfhCost: 0 } };
const C = (o, ch) => { const x = JSON.parse(JSON.stringify(o)); ch(x); return x; };
const pick = r => ({ diff: r.diff, stay: r.stay, sw: r.sw, A1: r.A[0], B1: r.B[0], gNow: r.gNow, gStay: r.gStay, gAt5: r.gAt5, toFive: r.toFive });
function ctc(j) { const gross = j.basic + j.hra + j.other, emp = 0.12 * (j.pf === "capped" ? Math.min(j.basic, 25000) : j.basic);
  return 12 * (gross + emp) + j.variable + 12 * 15 / 26 / 12 * Math.max(j.basic, gross / 2) * 1; }
const out = { base, main: pick(J.calc(base)), ctcA: ctc(base.a), ctcB: ctc(base.b) };
/* A differently built offer: same gross as now, PF on a bigger basic, big variable */
const alt = C(base, x => { x.b = { ...x.b, basic: 70000, hra: 28000, other: 22000, pf: "full", variable: 400000, payout: 60, bonus: 0, stock: 0 }; });
out.alt = pick(J.calc(alt)); out.ctcAlt = ctc(alt.b);
/* Variable pay payouts at the new job */
out.payout = [100, 70, 50].map(p => ({ p, diff: J.calc(C(base, x => { x.b.payout = p; })).diff }));
out.var50both = J.calc(C(base, x => { x.a.payout = 50; x.b.payout = 50; })).diff;
/* Commute: value of time */
out.time500 = J.calc(C(base, x => { x.timeValue = 500; })).diff;
let lo = 0, hi = 5000; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (J.calc(C(base, x => { x.timeValue = m; })).diff > 0) lo = m; else hi = m; } out.timeBE = lo;
out.sameOffice = J.calc(C(base, x => { x.b.office = 2; x.b.commute = 600; x.b.hours = 2; })).diff;
/* Joining bonus and stock */
out.noBonus = J.calc(C(base, x => { x.b.bonus = 0; })).diff; out.noStock = J.calc(C(base, x => { x.b.stock = 0; })).diff; out.neither = J.calc(C(base, x => { x.b.bonus = 0; x.b.stock = 0; })).diff;
out.claw = J.calc(C(base, x => { x.claw = 150000; })).diff;   /* if he had to repay a ₹1.5 lakh joining bonus now */
/* Waiting 6 months for gratuity: extra pay given up = 6 months of the year-1 difference (cash + PF), vs gratuity at 5 years */
const r = J.calc(base); out.wait = { gratuity: r.gAt5, missed: (r.B[0].cash + r.B[0].pf - r.A[0].cash - r.A[0].pf) / 2, missedNoStockBonus: (r.B[0].cash - r.B[0].stock - r.B[0].bonus * 0.7 + r.B[0].pf - r.A[0].cash - r.A[0].pf) / 2 };
out.over5 = J.calc(C(base, x => { x.years = 5; })).diff;
console.log(JSON.stringify(out));
