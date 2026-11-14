/* Numbers for the four NPS guides, from the NPS calculator's own code (nps.js), plus deposits.js for PPF and the EPF comparison.
   Usage: node tools/guide_nps_numbers.js -> JSON */
const N = require("../src/assets/js/nps.js"), D = require("../src/assets/js/deposits.js");
const P = { sector: "private", choice: "max", regime: "new", slab: 20, age: 30, exitAge: 60, balance: 0, own: 5000, emp: 5000, step: 5, ret: 10, annuity: 6.5, infl: 6 };
const pick = p => ({ corpus: p.corpus, lump: p.ex.lump, taxable: p.ex.taxable, lumpTax: p.lumpTax, annuity: p.ex.annuity, pension: p.pension, put: p.put, realCorpus: p.realCorpus, realPension: p.realPension, penTax: p.penTax });
const out = {};
/* Main guide: Kavya, 30, ₹5,000 a month + ₹5,000 from employer, rising 5% a year, 10% return */
out.main = { max: pick(N.plan(P)), free: pick(N.plan(Object.assign({}, P, { choice: "free" }))), govt: pick(N.plan(Object.assign({}, P, { sector: "govt" }))),
  r8: pick(N.plan(Object.assign({}, P, { ret: 8 }))), r12: pick(N.plan(Object.assign({}, P, { ret: 12 }))) };
out.slabs = [500000, 1000000, 5000000].map(c => ({ c, priv: N.maxLump(c, "private"), govt: N.maxLump(c, "govt") }));
/* Employer NPS: basic + DA ₹75,000 a month, new regime, private, from 0% to 14%, at different slabs; and the ₹7.5 lakh cap */
const E0 = { basic: 75000, nowPct: 0, newPct: 14, regime: "new", sector: "private", slab: 20, pf: 75000 * 12 * 0.12, yrs: 25, ret: 10 };
out.emp = [10, 20, 30].map(sl => { const e = N.employer(Object.assign({}, E0, { slab: sl })); return { slab: sl, extra: e.extra, saved: e.saved, takeHome: e.takeHome, cost: e.costPerRupee, fv: e.fv }; });
out.empOld = N.employer(Object.assign({}, E0, { regime: "old", slab: 30 }));
out.empNew30 = N.employer(Object.assign({}, E0, { slab: 30 }));
out.cap = N.employer({ basic: 300000, nowPct: 0, newPct: 14, regime: "new", sector: "private", slab: 30, pf: 300000 * 12 * 0.12, yrs: 20, ret: 10 });
out.capInputs = { basic: 300000, pf: 300000 * 12 * 0.12, nps: 300000 * 12 * 0.14 };
/* Tax gap: corpus of ₹50 lakh, ₹1 crore and ₹2 crore, with a 6.5% annuity on the rest */
out.gap = [5000000, 10000000, 20000000].map(c => {
  const lump80 = 0.8 * c, taxable = lump80 - 0.6 * c, pen80 = 0.2 * c * 0.065, pen60 = 0.4 * c * 0.065;
  return { c, lump80, taxable, tax: N.newTax(taxable + pen80) - N.newTax(pen80), pen80: pen80 / 12, pen60: pen60 / 12, penTax80: N.newTax(pen80), penTax60: N.newTax(pen60) };
});
/* NPS vs PPF vs EPF: ₹1.5 lakh a year (₹12,500 a month) for 25 years */
const Y = 25;
out.cmp = {
  ppf: D.ppf({ yearly: 150000, rate: 7.1, years: Y, when: "monthly", stopAfter15: false }).maturity,
  epf: D.ppf({ yearly: 150000, rate: 8.25, years: Y, when: "monthly", stopAfter15: false }).maturity,
  nps10: N.grow({ age: 35, exitAge: 60, balance: 0, own: 12500, emp: 0, step: 0, ret: 10 }).corpus,
  nps8: N.grow({ age: 35, exitAge: 60, balance: 0, own: 12500, emp: 0, step: 0, ret: 8 }).corpus,
  put: 150000 * Y };
const ex10 = N.exit(out.cmp.nps10, "private", "max");
out.cmp.nps10Lump = ex10.lump; out.cmp.nps10Taxable = ex10.taxable; out.cmp.nps10Annuity = ex10.annuity;
out.cmp.nps10Tax = N.newTax(ex10.taxable + ex10.annuity * 0.065) - N.newTax(ex10.annuity * 0.065);
out.cmp.nps10Free = 0.6 * out.cmp.nps10;
process.stdout.write(JSON.stringify(out));
