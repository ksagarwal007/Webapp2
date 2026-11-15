/* Numbers for five guides (15 Nov, batch 10): EPS pension low, new or used car, bonus on resigning.
   Usage: node tools/guide_batch10_numbers.js -> JSON */
const EPS = require("../src/assets/js/eps.js"), C = require("../src/assets/js/car-own.js");
const out = {};
/* 1. Why EPS is low: Anil joined Sep 1998, retires at 58 in Sep 2030 on ₹1.5 lakh a month basic + DA. 16 years before Sep 2014, 12 to Sep 2026, 4 after. */
const base = { p1: 16, p2: 12, p3: 4, wage: 150000, higher: false, start: 58 };
const a = EPS.calc(base), lost = EPS.calc({ ...base, p1: 10 }), at55 = EPS.calc({ ...base, start: 55 }), at60 = EPS.calc({ ...base, start: 60 }), fresh = EPS.calc({ p1: 0, p2: 0, p3: 32, wage: 150000, higher: false, start: 58 });
out.eps = { pension: a.monthly, pctWage: a.monthly / 150000 * 100, lost6: lost.monthly, at55: at55.monthly, at60: at60.monthly, fresh: fresh.monthly,
  rows: a.rows.map(r => ({ years: r.years, plus: r.plus, wage: r.wage, pension: r.pension })) };
/* 2. New or used: same model; new ₹10 lakh vs 3-year-old at ₹6.8 lakh. Both kept 4 years, 1,000 km a month, costs rise 3% a year.
   New: resale after 4 years 62% of price. Used: resale after 4 more years ₹4 lakh (59% of what you paid). Loan 80% for 4 years: new 9%, used 12%. */
const F = C.FUEL.petrol, K = { kmMonth: 1000, years: 4, rise: 3 };
const nw = C.car({ fuel: "petrol", price: 1000000, mileage: F.mileage, fuelPrice: F.price, insFirst: 35000, insLater: 22000, service: F.service, resalePct: 62, loan: 800000, rate: 9, tenure: 4 }, K);
const us = C.car({ fuel: "petrol", price: 680000, mileage: 14, fuelPrice: F.price, insFirst: 16000, insLater: 14000, service: 15000, resalePct: 400000 / 680000 * 100, loan: 544000, rate: 12, tenure: 4 }, K);
const us0 = C.car({ fuel: "petrol", price: 680000, mileage: 14, fuelPrice: F.price, insFirst: 16000, insLater: 14000, service: 15000, resalePct: 400000 / 680000 * 100, loan: 0, rate: 12, tenure: 4 }, K);
const nw0 = C.car({ fuel: "petrol", price: 1000000, mileage: F.mileage, fuelPrice: F.price, insFirst: 35000, insLater: 22000, service: F.service, resalePct: 62, loan: 0, rate: 9, tenure: 4 }, K);
const pk = x => ({ total: x.total, perMonth: x.perMonth, perKm: x.perKm, emi: x.emi, dep: x.parts.depreciation, int: x.parts.interest, fuel: x.parts.fuel, ins: x.parts.ins, service: x.parts.service });
out.car = { nw: pk(nw), us: pk(us), nw0: pk(nw0), us0: pk(us0) };
/* 3. Bonus: statutory minimum on ₹18,000 a month wages (basic + DA), computed on ₹7,000 a month (or the minimum wage if higher), for 7 months worked */
out.bonus = { months: 7, min: 0.0833 * 7000 * 7, max: 0.2 * 7000 * 7, varTarget: 200000, varPro: 200000 * 9 / 12 };
console.log(JSON.stringify(out));
