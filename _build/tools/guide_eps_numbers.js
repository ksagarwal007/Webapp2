/* Numbers for the EPS calculator guides and the VPF guide, from the tools' own code (eps.js, epf.js).
   Usage: node tools/guide_eps_numbers.js -> JSON */
const E = require("../src/assets/js/eps.js"), F = require("../src/assets/js/epf.js");
const out = {};
/* Main guide: Ravi, 40, in EPS since 2010: 4 years before Sep 2014, 12 years to Sep 2026, 18 more years to 58; wages ₹60,000 */
const R = { p1: 4, p2: 12, p3: 18, wage: 60000, higher: false, start: 58 };
const r = E.calc(R);
out.ravi = { rows: r.rows.map(x => ({ name: x.name, years: x.years, plus: x.plus, wage: x.wage, pension: x.pension })), monthly: r.monthly, years: r.years,
  at: { 50: r.at(50), 55: r.at(55), 58: r.at(58), 59: r.at(59), 60: r.at(60) } };
const rh = E.calc({ ...R, higher: true }); out.raviHigh = rh.monthly;
const rOld = E.calc({ p1: 4, p2: 30, p3: 0, wage: 60000, higher: false, start: 58 }); out.raviOld = rOld.monthly;   /* had the ceiling stayed at ₹15,000 */
/* break-even: starting at 50 vs 58 */
out.be5058 = (r.at(58) * 58 - r.at(50) * 50) / (r.at(58) - r.at(50));
out.be5860 = (r.at(60) * 60 - r.at(58) * 58) / (r.at(60) - r.at(58));
/* Withdrawal vs scheme certificate: Neha, 4 years (48 months), all before 17 Sep 2026, wages ₹20,000 */
const n = E.calc({ p1: 0, p2: 4, p3: 0, wage: 20000, higher: false, start: 58 });
out.neha = { wb: n.wb, factor: n.wbFactor, pw: n.pw, months: n.months };
const n10 = E.calc({ p1: 0, p2: 4, p3: 6, wage: 30000, higher: false, start: 58 }); out.neha10 = n10.monthly;   /* rejoins and completes 10 years */
const n25 = E.calc({ p1: 0, p2: 4, p3: 21, wage: 30000, higher: false, start: 58 }); out.neha25 = n25.monthly;
const n25w = E.calc({ p1: 0, p2: 0, p3: 21, wage: 30000, higher: false, start: 58 }); out.neha25w = n25w.monthly;   /* if she had withdrawn: service restarts */
out.factors = { 12: E.factor(12), 24: E.factor(24), 36: E.factor(36), 48: E.factor(48), 60: E.factor(60), 84: E.factor(84), 108: E.factor(108) };
/* VPF: 32-year-old, PF wages ₹50,000, 26 years to 58, pay rise 6% */
const V = { age: 32, retireAge: 58, balance: 400000, wage: 50000, basis: "full", eps: true, epsYears: 6, hike: 6, rate: 8.25, infl: 6, slab: 30 };
const v0 = F.plan({ ...V, vpf: 0 }), v10 = F.plan({ ...V, vpf: 10 }), v20 = F.plan({ ...V, vpf: 20 }), v100 = F.plan({ ...V, vpf: 100, wage: 150000 });
const pick = p => ({ corpus: p.corpus, putOwn: p.putOwn, taxInt: p.taxInt, taxOnInt: p.taxOnInt });
out.vpf = { v0: pick(v0), v10: pick(v10), v20: pick(v20), v100: pick(v100) };
/* ₹5,000 a month for 20 years: VPF at 8.25% (tax-free), PPF at 7.1% (tax-free, yearly), FD at 7% taxed at 30% + cess */
function monthly(rateYr, years, credit) { let bal = 0, acc = 0; for (let m = 1; m <= years * 12; m++) { bal += 5000; acc += bal * rateYr / 12; if (m % 12 === 0) { bal += acc; acc = 0; } } return bal; }
const fdNet = 7 * (1 - 0.312);
out.compare = { vpf: monthly(0.0825, 20), ppf: monthly(0.071, 20), fd: monthly(fdNet / 100, 20), fdNet: fdNet, put: 5000 * 240 };
console.log(JSON.stringify(out));
