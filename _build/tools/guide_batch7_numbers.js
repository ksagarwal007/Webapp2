/* Numbers for five guides (15 Nov): emi.js, car-own.js, retirement.js (+ plain withdrawal maths). Usage: node tools/guide_batch7_numbers.js -> JSON */
const EMI = require("../src/assets/js/emi.js"), C = require("../src/assets/js/car-own.js"), R = require("../src/assets/js/retirement.js");
const out = {};
/* 1. Down payment on an ₹80 lakh home: 10/20/30% down, 20 years at 8.5%. The money not put down is invested at 7% after tax (FD/debt) or 10% (equity) for 20 years. */
const price = 8000000; out.down = {};
[10, 20, 30].forEach(pc => { const d = price * pc / 100, L = price - d, e = EMI.emiOf(L, 8.5, 240); out.down[pc] = { down: d, loan: L, emi: e, interest: e * 240 - L }; });
const extra = price * 0.2 - price * 0.1;   /* ₹8 lakh more down (20% vs 10%) */
out.downCmp = { extra, emiSaved: out.down[10].emi - out.down[20].emi, intSaved: out.down[10].interest - out.down[20].interest,
  inv7: extra * Math.pow(1.07, 20), inv10: extra * Math.pow(1.10, 20) };
/* EMI saved each month, invested at 7% for 20 years (to compare like with like) */
(function () { const s = out.downCmp.emiSaved; let v7 = 0, v10 = 0; for (let m = 0; m < 240; m++) { v7 = (v7 + s) * (1 + 0.07 / 12); v10 = (v10 + s) * (1 + 0.10 / 12); } out.downCmp.emiInv7 = v7; out.downCmp.emiInv10 = v10; })();
/* 2. Car loan or cash: ₹10 lakh petrol car, 1,200 km a month, 7 years; loan 80% at 9% for 5 years vs cash; cash alternative invested in FD 7% taxed at 30% */
const F = C.FUEL, pet = { fuel: "petrol", price: 1000000, mileage: F.petrol.mileage, fuelPrice: F.petrol.price, insFirst: 35000, insLater: 22000, service: F.petrol.service, resalePct: 40, loan: 800000, rate: 9, tenure: 5 };
const K = { kmMonth: 1200, years: 7, rise: 3 }, withLoan = C.car(pet, K), cash = C.car({ ...pet, loan: 0 }, K);
const fdNet = 0.07 * (1 - 0.312);
/* If you pay cash, ₹8 lakh is no longer invested; with the loan, you keep it invested but pay EMIs. Value of keeping ₹8 lakh invested for 5 years less the EMIs (as if paid from it) */
(function () { let bal = 800000; const emi = withLoan.emi; for (let m = 0; m < 60; m++) { bal = bal * (1 + fdNet / 12) - emi; } out.carLoan = { emi, interest: withLoan.parts.interest, totalLoan: withLoan.total, totalCash: cash.total, leftAfter5: bal, fdNet: fdNet * 100 };
  let bal2 = 800000; const r10 = 0.10 * (1 - 0.125 * 0.5); for (let m = 0; m < 60; m++) bal2 = bal2 * (1 + 0.10 / 12) - emi; out.carLoan.leftEq = bal2; })();
/* 3. Part-paying a personal loan: ₹5 lakh, 14%, 5 years; ₹1 lakh part-payment after 12 months; prepayment charge 3% */
(function () { const P = 500000, r = 14, n = 60, e = EMI.emiOf(P, r, n); let b = P; for (let m = 0; m < 12; m++) b = b * (1 + r / 1200) - e; const intAll = e * n - P;
  const b2 = b - 100000, m2 = EMI.nper(b2, r, e), intT = e * 12 + 100000 + e * m2 - P, e2 = EMI.emiOf(b2, r, 48), intE = e * 12 + 100000 + e2 * 48 - P;   /* the part-payment is money paid too */
  out.pl = { emi: e, int: intAll, bal12: b, monthsLeft: m2, savedT: intAll - intT, savedE: intAll - intE, newEmi: e2, charge: 3000, fdGain: 100000 * (Math.pow(1 + fdNet / 12, 48) - 1) };
  const cP = 800000, cr = 9.5, cn = 60, ce = EMI.emiOf(cP, cr, cn); let cb = cP; for (let m = 0; m < 12; m++) cb = cb * (1 + cr / 1200) - ce; const cm = EMI.nper(cb - 100000, cr, ce);
  out.car = { emi: ce, saved: (ce * cn - cP) - (ce * 12 + 100000 + ce * cm - cP), monthsLeft: cm, fdGain: 100000 * (Math.pow(1 + fdNet / 12, 48) - 1), eqGain: 100000 * (Math.pow(1.10, 4) - 1) };
})();
/* 4. How long savings last: first-year withdrawal as % of savings, rising 6% a year */
function lasts(pct, ret, infl) { let pot = 100, w = pct; for (let y = 0; y < 100; y++) { pot -= w; if (pot < 0) return y; pot *= 1 + ret / 100; w *= 1 + infl / 100; } return 100; }
out.lasts = {}; [3, 3.5, 4, 5, 6].forEach(p => { out.lasts[p] = {}; [6, 7, 8, 9].forEach(r => out.lasts[p][r] = lasts(p, r, 6)); });
/* 5. Started late: Ravi, 42 */
const B = { age: 42, retireAge: 60, lifeTo: 85, spend: 70000, infl: 6, retRet: 7, epfBal: 1500000, wage: 80000, hike: 5, epfRate: 8.25, eps: true, epsYears: 15, npsBal: 0, npsMonthly: 0, npsRet: 10, mfBal: 1000000, sip: 15000, step: 5, mfRet: 11, fdBal: 500000, fdRet: 7, other: 0 };
const p = R.plan(B), p62 = R.plan({ ...B, retireAge: 62 }), pnps = R.plan({ ...B, npsMonthly: 15000 }), psp = R.plan({ ...B, spend: 60000 }), pstep = R.plan({ ...B, step: 10 });
const pk = x => ({ need: x.need, have: x.have, gap: x.gap, sip: x.extraSip, runsOut: x.runsOut, epf: x.epf, mf: x.mf, eps: x.epsM, spendAt: x.spendAt });
out.late = { base: pk(p), r62: pk(p62), nps: pk(pnps), spend60: pk(psp), step10: pk(pstep) };
console.log(JSON.stringify(out));
