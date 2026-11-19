/* Numbers for five guides (17 Nov, batch 13): rent or buy by age, keep or sell, double income, two car lease guides.
   Usage: node tools/guide_batch13_numbers.js -> JSON */
const R = require("../src/assets/js/rent-buy.js"), CL = require("../src/assets/js/car-lease.js"), NPS = require("../src/assets/js/nps.js");
const out = {};
/* 1. Rent or buy by age: Arjun's example from the main guide (₹90 lakh home, 20% down, 20 years at 8.5%, rent ₹24,000, home price +6%, savings in equity at 12%). */
const A = { price: 9000000, down: 1800000, stamp: 630000, reg: 30000, other: 150000, rate: 8.5, tenure: 20, rent: 24000, rentUp: 5,
  deposit: 100000, depUp: false, own: 48000, ownUp: 5, stay: 12, grow: 6, ret: 12, kind: "equity", sell: 1, keep: false, reinvest: false,
  possess: 0, uc: false, regime: "new", slab: 20, claimInt: true, room: 0, claimHra: true, basic: 60000, hra: 30000, metro: true };
const s = R.simulate(Object.assign({}, A, { stay: 30 })); const pay = R.payoff(R.simulate(A));
out.age = { payoffYears: pay / 12, emi: R.simulate(A).emi, stays: {} };
for (const y of [3, 5, 8, 12, 20]) { const x = R.simulate(Object.assign({}, A, { stay: y })); out.age.stays[y] = { buy: x.buy.final, rent: x.rent.final, diff: x.diff }; }
out.age.be = {}; for (const y of [3, 5, 8, 12, 20]) { const b = R.breakeven(Object.assign({}, A, { stay: y })); out.age.be[y] = b.kind === 'rate' ? b.rate : b.kind; }
out.age.beFd = {}; for (const y of [5, 12, 20]) { const b = R.breakeven(Object.assign({}, A, { stay: y, kind: 'fd', ret: 7 })); out.age.beFd[y] = b.kind === 'rate' ? b.rate : b.kind; }
/* 40s: same home, 15-year loan so it ends by 60, stay 20 years and keep it */
const f = R.simulate(Object.assign({}, A, { tenure: 15, stay: 20, keep: true })); const fb = R.breakeven(Object.assign({}, A, { tenure: 15, stay: 20, keep: true })); out.age.forties = { emi: f.emi, buy: f.buy.final, rent: f.rent.final, diff: f.diff, be: fb.kind === 'rate' ? fb.rate : fb.kind };
/* 2. Keep or sell after moving at year 8: from the same simulation, loan left and home value at month 96 */
const row = s.rows[95], V8 = row.home, bal8 = row.bal, emi = s.emi;
const cost = A.price + A.stamp + A.reg + A.other, saleNet = V8 * 0.99, ltcg = Math.max(0, saleNet - cost) * 0.125 * 1.04;
function keepSell(RET) {
const g = Math.pow(1 + RET / 100, 1 / 12) - 1, years = 10;
/* Sell: pay off the loan, invest the rest at 12%; keep investing what the EMI would have been (until the loan would have ended) */
let sell = saleNet - ltcg - bal8; let b = bal8, r = A.rate / 1200;
for (let m = 1; m <= years * 12; m++) { sell = sell * (1 + g); if (b > 0.5) { const it = b * r, pr = Math.min(emi - it, b); b -= pr; sell += emi; } }
/* Keep: rent it out at 2.5% of value a year, rising with the home; pay the EMI as before; maintenance and property tax ₹48,000 a year rising 5%;
   rent taxed at 20% (+cess) after the 30% standard deduction; net rent invested at 12%. */
let keepInv = 0, V = V8, b2 = bal8, own = 48000 * Math.pow(1.05, 8);
for (let y = 0; y < years; y++) { const rent = V * 0.025, tax = rent * 0.7 * 0.2 * 1.04, net = rent - tax - own; for (let m = 0; m < 12; m++) { keepInv = keepInv * (1 + g) + net / 12; if (b2 > 0.5) { const it = b2 * r, pr = Math.min(emi - it, b2); b2 -= pr; } } V *= 1.06; own *= 1.05; }
const keepHome = V - Math.max(0, b2), keepSaleLater = V * 0.99, keepLtcg = Math.max(0, keepSaleLater - cost) * 0.125 * 1.04;
return { V8, bal8, saleNet, ltcg, sellAfter10: sell, keepHome, keepInv, keepTotal: keepHome + keepInv, keepIfSold: keepSaleLater - keepLtcg - Math.max(0, b2) + keepInv, rent1: V8 * 0.025 / 12, V18: V };
}
out.keep = keepSell(12); out.keep8 = keepSell(8);
/* section 82 */
out.keep.reinvestSaves = ltcg;
/* 3. Double income: ₹1.2 lakh and ₹80,000 take-home */
const p1 = 120000, p2 = 80000, joint = 90000; out.dual = { p1, p2, total: p1 + p2, joint, share1: joint * p1 / (p1 + p2), share2: joint * p2 / (p1 + p2), half: joint / 2, ef6: joint * 6 };
/* 4. Car lease in the 20% slab, and EVs: the guide's standard example (₹12 lakh car, 4 years, ₹30,000 rental incl. insurance and maintenance, employer pays running costs) */
const S = { price: 1200000, engine: "small", years: 4, rental: 30000, insInc: true, maintInc: true, runCo: true, driver: false, driverCost: 15000,
  end: "buy", buyback: 240000, down: 240000, rate: 9, loanYrs: 4, ins: 30000, maint: 15000, fuel: 6000, dep: 15, slab: 30, ret: 7,
  exitYrs: 2, exitCharge: 50000, exitEnd: "buy", exitPrice: 650000 };
const pick = x => ({ diff: x.diff, outL: x.outL, outB: x.outB, taxNet: (x.lease.taxSaved - x.lease.perkTax) / x.N });
out.lease = { s30: pick(CL.simulate(S)), s20: pick(CL.simulate(Object.assign({}, S, { slab: 20 }))), s5: pick(CL.simulate(Object.assign({}, S, { slab: 5 }))),
  be30: CL.breakeven(S), be20: CL.breakeven(Object.assign({}, S, { slab: 20 })) };
/* EV: ₹20 lakh EV, rental ₹48,000, charging ₹2,000 a month, buyback 20% */
const E = Object.assign({}, S, { price: 2000000, rental: 48000, fuel: 2000, buyback: 400000, down: 400000, ins: 50000, maint: 8000 });
out.lease.ev30 = pick(CL.simulate(E)); out.lease.ev20 = pick(CL.simulate(Object.assign({}, E, { slab: 20 }))); out.lease.evPerk = CL.perkOf(E);
out.lease.bigPerk = CL.perkOf(Object.assign({}, S, { engine: "big" }));
/* 5. Changing jobs mid-lease, and the end of the lease */
const xb = CL.exitSim(S), xr = CL.exitSim(Object.assign({}, S, { exitEnd: "return" })), eb = CL.simulate(S), er = CL.simulate(Object.assign({}, S, { end: "return" }));
out.exit = { buy: xb.endL, ret: xr.endL, loan: xb.endB, carAt2: xb.carEnd, exitPrice: S.exitPrice, exitCharge: S.exitCharge,
  endBuy: eb.endL, endRet: er.endL, carAt4: eb.carEnd, buyback: S.buyback };
console.log(JSON.stringify(out));
