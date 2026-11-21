/* Numbers for the T8 guides (health insurance cover). One example throughout: Aditya, 32, and Kavya, Bengaluru (metro), daughter Ira;
   Aditya's parents, 62 and 59, live with them. Own family policy ₹5 lakh, employer group cover ₹5 lakh, parents have no cover.
   Variations change one thing. Usage: node tools/guide_t8_numbers.js -> JSON */
const H = require("../src/assets/js/health.js");
const base = { city: "metro", adults: 2, kids: 1, age: 32, years: 10, infl: 10, bill: 1500000, stay: 100000, base: 500000, topup: 0, group: 500000, parents: 2, pAge: 62, pCover: 0, regime: "new", slab: 30, prem: 0, pPrem: 0 };
const run = x => { const r = H.calc({ ...base, ...x }); const Y = r.you; return { need0: Y.need0, target: Y.target, buy: Y.buy, base: Y.base, ded: Y.ded, top: Y.top, mine: Y.mine, gap: Y.gap, withJob: r.withJob,
  gapJob: Math.max(0, Y.buy - r.withJob), yrs: Y.yrs, par: r.par && { need0: r.par.need0, target: r.par.target, buy: r.par.buy, base: r.par.base, ded: r.par.ded, top: r.par.top, gap: r.par.gap }, taxSaved: r.taxSaved, dSelf: r.dSelf, dPar: r.dPar }; };
const out = {};
out.main = run({});
out.infl = [6, 8, 10, 12].map(i => ({ i, buy: run({ infl: i }).buy, target: run({ infl: i }).target }));
out.years = [5, 10, 15, 20].map(y => ({ y, buy: run({ years: y }).buy, target: run({ years: y }).target }));
out.cities = ["metro", "big", "small"].map(c => { const C = H.CITY[c]; const r = run({ city: c, bill: C.bill, stay: C.stay }); return { c, bill: C.bill, stay: C.stay, need0: r.need0, buy: r.buy }; });
/* What ₹5 lakh is worth against medical inflation */
out.fiveReal = [0, 5, 10, 15].map(t => ({ t, real: 500000 / Math.pow(1.1, t), bad: out.main.yrs[Math.min(t, 10)] || 1600000 * Math.pow(1.1, t) }));
out.badAt = t => 0;
out.bad5 = 1600000 * Math.pow(1.1, 5); out.bad10 = 1600000 * Math.pow(1.1, 10); out.serious5 = 1500000 * Math.pow(1.1, 5);
/* Super top-up at work: Kavya's cancer treatment in year 5 (₹15 lakh today grown 5 years) */
const bill5 = out.serious5; out.claim = { bill: bill5, base: Math.min(bill5, 500000), top: Math.min(Math.max(0, bill5 - 500000), 4000000) };
/* Two smaller stays in a year: ₹4 lakh and ₹3 lakh, ₹5 lakh deductible */
out.two = { a: 400000, b: 300000, ded: 500000, topUpPays: 0, superPays: 700000 - 500000 };
/* Employer cover: laid off or leaving in year 5 */
out.leave5 = { bad: out.bad5, own: 500000, short: out.bad5 - 500000 };
/* Parents on one floater vs separate: a ₹15 lakh illness for Aditya's father in year 10 = 38.9 lakh on a ₹45 lakh floater */
const fatherBill = 1500000 * Math.pow(1.1, 10); out.floater = { size: out.main.buy, father: fatherBill, left: out.main.buy - fatherBill };
out.solo = run({ parents: 0 });
/* Old regime: say ₹25,000 for the family, ₹50,000 for parents (illustrative premiums) */
out.tax30 = run({ regime: "old", slab: 30, prem: 25000, pPrem: 50000 });
out.tax20 = run({ regime: "old", slab: 20, prem: 25000, pPrem: 50000 });
/* Room rent cap: ₹5 lakh policy, 1% a day = ₹5,000; room ₹8,000 for 4 days; associated bills (room, doctor, surgery, nursing) ₹2.4 lakh; medicines, implants, tests ₹1 lakh */
const cap = 5000, room = 8000, days = 4, assoc = 240000, other = 100000, ratio = cap / room;
out.room = { cap, room, days, assoc, other, ratio, pays: assoc * ratio + other, you: assoc * (1 - ratio), bill: assoc + other };
/* Cataract: ₹25,000 cap a eye, ₹60,000 bill a eye */
out.cat = { cap: 25000, bill: 60000, you: 35000 };
delete out.badAt;
console.log(JSON.stringify(out));
