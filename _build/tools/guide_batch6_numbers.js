/* Numbers for five guides (15 Nov): emi.js, car-own.js, ssy.js + sip.js, retirement.js, term.js. Usage: node tools/guide_batch6_numbers.js -> JSON */
const EMI = require("../src/assets/js/emi.js"), C = require("../src/assets/js/car-own.js"), SSY = require("../src/assets/js/ssy.js"), SIP = require("../src/assets/js/sip.js"),
  R = require("../src/assets/js/retirement.js"), T = require("../src/assets/js/term.js");
const out = {};
/* 1. Home loan ₹50 lakh, 20 years, 8.5% → 9.0% */
const P = 5000000, n = 240, e0 = EMI.emiOf(P, 8.5, n), e1 = EMI.emiOf(P, 9, n);
const m1 = EMI.nper(P, 9, e0);   /* same EMI at 9%: months */
const bal5 = (function () { let b = P, r = 8.5 / 1200; for (let i = 0; i < 60; i++) b = b * (1 + r) - e0; return b; })();   /* rise after 5 years */
const m5 = EMI.nper(bal5, 9, e0), e5 = EMI.emiOf(bal5, 9, 180);
out.emi = { e0, e1, int0: e0 * n - P, int1: e1 * n - P, m1, intT: e0 * m1 - P, bal5, m5, e5, intT5: e0 * (60 + m5) - P, int5emi: e0 * 60 + e5 * 180 - P };
/* 2. EV at 1,000 km a month: same cars as the car cost guide */
const F = C.FUEL, mk = (fuel, price, ins1, ins2, res) => ({ fuel, price, mileage: F[fuel].mileage, fuelPrice: F[fuel].price, insFirst: ins1, insLater: ins2, service: F[fuel].service, resalePct: res, loan: Math.round(price * 0.8), rate: 9, tenure: 5 });
const pet = mk("petrol", 1000000, 35000, 22000, 40), ev = mk("ev", 1400000, 45000, 30000, 35);
out.ev = {}; [500, 1000, 1500, 2000].forEach(km => { const a = C.car(pet, { kmMonth: km, years: 7, rise: 3 }), b = C.car(ev, { kmMonth: km, years: 7, rise: 3 }); out.ev[km] = { pet: a.total, ev: b.total, petKm: a.perKm, evKm: b.perKm }; });
[5, 10].forEach(y => { const a = C.car(pet, { kmMonth: 1000, years: y, rise: 3 }), b = C.car(ev, { kmMonth: 1000, years: y, rise: 3 }); out.ev["y" + y] = { pet: a.total, ev: b.total }; });
out.evBe = C.breakEvenKm(pet, ev, { years: 7, rise: 3 }); out.evFuel = { pet: C.car(pet, { kmMonth: 1000, years: 7, rise: 3 }).fuelPerKm, ev: C.car(ev, { kmMonth: 1000, years: 7, rise: 3 }).fuelPerKm };
out.evCars = { pet, ev };
/* 3. Sukanya Samriddhi vs SIP: ₹12,500 a month (₹1.5 lakh a year) for 15 years, daughter aged 2; value at 18 and at 23 */
const ssy = SSY.calc({ age: 2, yearly: 150000, when: "april", rate: 8.2, ppfRate: 7.1, edu: 0, regime: "new", slab: 20 });
const ssyAt18 = ssy.s.rows.find(r => r.age === 18).bal;
const sipOpts = r => ({ start: 0, startCost: 0, sip: 12500, step: 0, years: 15, ret: r, kind: "equity", slab: 0, infl: 6 });
const grow = (v, r, y) => v * Math.pow(1 + r / 100, y);
out.ssyVsSip = { ssy23: ssy.s.maturity, ssy18: ssyAt18, put: ssy.s.deposits };
[10, 12].forEach(r => { const s = SIP.simulate(sipOpts(r)); out.ssyVsSip["sip" + r] = { at17: s.value, at17after: s.after, at18: grow(s.value, r, 1), at23: grow(s.value, r, 6) }; });
const s8 = SIP.simulate(sipOpts(8)); out.ssyVsSip.sip8 = { at17: s8.value, at23: grow(s8.value, 8, 6) };
/* 4. Retire at 50, 55 or 60 (the retirement guide's Meera, 35) */
const M = { age: 35, retireAge: 60, lifeTo: 85, spend: 60000, infl: 6, retRet: 7, epfBal: 600000, wage: 50000, hike: 6, epfRate: 8.25, eps: true, epsYears: 8, npsBal: 0, npsMonthly: 0, npsRet: 10, mfBal: 800000, sip: 10000, step: 5, mfRet: 11, fdBal: 300000, fdRet: 7, other: 0 };
out.retire = {}; [50, 55, 60].forEach(a => { const p = R.plan({ ...M, retireAge: a }); out.retire[a] = { need: p.need, have: p.have, gap: p.gap, sip: p.extraSip, runsOut: p.runsOut, spendAt: p.spendAt, eps: p.epsM, years: 85 - a }; });
/* 5. Term cover until 60 or 70 (the calculator's default family) */
const TB = { age: 32, years: 28, expenses: 50000, spouse: 0, infl: 6, ret: 7, edu: 2000000, eduIn: 15, wed: 1000000, wedIn: 23, goalInfl: 8, loans: 4000000, loanYears: 18, buffer: true, savings: 500000, cover: 0, income: 1500000 };
const t = T.calc(TB); const at = a => t.path.find(x => x.age === a);
out.term = { rounded: t.rounded, until: t.until, at50: at(50).cover, at55: at(55).cover, at58: at(58).cover, longer: T.calc({ ...TB, years: 38 }).rounded, longerUntil: T.calc({ ...TB, years: 38 }).until };
console.log(JSON.stringify(out));
