/* Numbers for the EPF guides, from the EPF calculator's own code (epf.js).
   Usage: node tools/guide_epf_numbers.js -> JSON */
const E = require("../src/assets/js/epf.js");
const B = { basis: "full", eps: true, slab: 20, age: 28, retireAge: 58, balance: 200000, wage: 40000, epsYears: 4, vpf: 0, hike: 7, rate: 8.25, infl: 6 };
const pick = r => ({ corpus: r.corpus, real: r.real, putOwn: r.putOwn, putEmp: r.putEmp, putEps: r.putEps, interest: r.interest, taxInt: r.taxInt, pension: r.pension.monthly || 0, service: r.pension.service || 0 });
const out = { B, base: pick(E.plan(B)), r75: pick(E.plan({ ...B, rate: 7.5 })), r9: pick(E.plan({ ...B, rate: 9 })),
  vpf10: pick(E.plan({ ...B, vpf: 10 })), capped: pick(E.plan({ ...B, basis: "capped" })), noEps: pick(E.plan({ ...B, eps: false })),
  first: E.plan(B).rows[0] };
/* Wage ceiling: contributions on ₹15,000 vs ₹25,000 (for someone whose PF is worked out on capped wages) */
const m = w => ({ own: w * 0.12, eps: Math.min(w, 25000) * 0.0833, empTotal: w * 0.12 });
out.ceil = { old: { own: 1800, eps: 1250, emp: 1800 - 1250 }, now: { own: 3000, eps: 25000 * 0.0833, emp: 3000 - 25000 * 0.0833 } };
/* EPS pension for 30 years: all at ₹15,000 vs 10 years past + 20 years at ₹25,000 */
out.pen = { allOld: 15000 * 32 / 70, mixed: (15000 * 10 + 25000 * 22) / 70, allNew: 25000 * 32 / 70, ten: (15000 * 2 + 25000 * 8) / 70, minimum: 1000 };
/* Capped-PF employee at age 30, 28 years to go: corpus with PF on ₹25,000 vs (old) ₹15,000 */
const C = { basis: "full", eps: true, slab: 20, age: 30, retireAge: 58, balance: 150000, vpf: 0, hike: 0, rate: 8.25, infl: 6, epsYears: 6 };
out.cap25 = pick(E.plan({ ...C, wage: 25000 })); out.cap15 = pick(E.plan({ ...C, wage: 15000, eps: true }));
/* pension check from pension() for the main example */
out.basePension = E.plan(B).pension;
process.stdout.write(JSON.stringify(out));
