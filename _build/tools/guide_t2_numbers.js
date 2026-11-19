/* Numbers for the batch T2 guides (best day to resign), from the tool's own code.
   Usage: node tools/guide_t2_numbers.js -> JSON */
const R = require("../src/assets/js/rd.js");
const T = "2026-11-19";
const base = { today: T, join: "2022-02-19", type: "permanent", basic: 50000, total: 120000, notice: 60, balance: 20, perYear: 18, encashOn: "basic",
  bonus: 200000, bonusDate: "2027-04-15", bonusRule: "rolls", vests: [{ date: "2027-06-15", amt: 150000 }], claw: 0, clawDate: "", extra: 25000 };
const pick = v => ({ L: v.L, resign: v.resign, grat: v.grat, leave: v.leave, leaveDays: v.leaveDays, bonus: v.bonus, vested: v.vested, claw: v.claw, missed: v.missed, total: v.total });
function run(o) { const r = R.calc(o); return { earliest: r.earliest, first: pick(r.first), best: pick(r.best), gain: r.gain, ms: r.ms, last: pick(r.path[r.path.length - 1]) }; }
/* Extra pay a month at which waiting stops paying (best day becomes the earliest) */
function breakEven(o) { let lo = 0, hi = 1e6; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (R.calc({ ...o, extra: m }).best.L === R.addDays(o.today, o.notice)) hi = m; else lo = m; } return hi; }
const out = { main: run(base), mainNotice: run({ ...base, bonusRule: "notice" }), mainHigh: run({ ...base, extra: 60000 }), mainBE: breakEven(base),
  at: { "2027-02-19": pick(R.value(base, "2027-02-19")), "2027-04-15": pick(R.value(base, "2027-04-15")) } };
/* RSU article: 2 years in the job (no gratuity), ₹3 lakh vests in about 4 months, new job +₹40,000 */
const rsu = { ...base, join: "2024-11-01", bonus: 0, balance: 10, vests: [{ date: "2027-05-15", amt: 300000 }], extra: 40000 };
out.rsu = run(rsu); out.rsuBE = breakEven(rsu); out.rsuQ = run({ ...rsu, vests: [{ date: "2027-02-15", amt: 75000 }, { date: "2027-05-15", amt: 75000 }, { date: "2027-08-15", amt: 75000 }] });
/* Clawback: ₹2 lakh joining bonus repayable if you leave before 1 Mar 2027 */
const cl = { ...base, join: "2026-03-01", bonus: 0, balance: 8, vests: [], claw: 200000, clawDate: "2027-03-01", extra: 30000 };
out.claw = run(cl); out.clawBE = breakEven(cl);
/* Notice maths for the main example's gratuity date */
out.notice = [30, 60, 90].map(n => ({ n, resign: R.addDays("2027-02-19", -n) }));
/* Bonus or join now: 2 years in, ₹2 lakh bonus on 15 Apr, notice 60 days */
const bn = { ...base, join: "2024-11-01", balance: 10, vests: [], extra: 25000 };
out.bonusRolls = run(bn); out.bonusRollsBE = breakEven(bn); out.bonusNotice = run({ ...bn, bonusRule: "notice" }); out.bonusNoticeBE = breakEven({ ...bn, bonusRule: "notice" });
console.log(JSON.stringify(out));
