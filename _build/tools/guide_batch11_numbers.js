/* Numbers for the government-EV guide (15 Nov): ₹20 lakh EV vs ₹10 lakh petrol, paid in cash, car-own.js.
   Usage: node tools/guide_batch11_numbers.js -> JSON */
const C = require("../src/assets/js/car-own.js"), F = C.FUEL;
const ev = (res) => ({ fuel: "ev", price: 2000000, mileage: F.ev.mileage, fuelPrice: F.ev.price, insFirst: 60000, insLater: 40000, service: F.ev.service, resalePct: res, loan: 0, rate: 9, tenure: 5 });
const pe = (res) => ({ fuel: "petrol", price: 1000000, mileage: F.petrol.mileage, fuelPrice: F.petrol.price, insFirst: 35000, insLater: 22000, service: F.petrol.service, resalePct: res, loan: 0, rate: 9, tenure: 5 });
const RES = { 7: { ev: 35, pe: 40 }, 10: { ev: 20, pe: 25 } };
const out = { table: {}, breakEven: {} };
for (const y of [7, 10]) {
  out.table[y] = {};
  for (const km of [1000, 1500, 2000, 3000]) { const K = { kmMonth: km, years: y, rise: 3 }; out.table[y][km] = { ev: C.car(ev(RES[y].ev), K).total, pe: C.car(pe(RES[y].pe), K).total }; }
  let lo = 100, hi = 6000; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, K = { kmMonth: m, years: y, rise: 3 }; if (C.car(ev(RES[y].ev), K).total > C.car(pe(RES[y].pe), K).total) lo = m; else hi = m; }
  out.breakEven[y] = lo;
}
const parts = (c, K) => { const x = C.car(c, K); return { price: c.price, fuel: x.parts.fuel, ins: x.parts.ins, service: x.parts.service, resale: x.resale, total: x.total }; };
out.parts = {}; for (const km of [1000, 2000]) { const K = { kmMonth: km, years: 7, rise: 3 }; out.parts[km] = { ev: parts(ev(35), K), pe: parts(pe(40), K) }; }
out.perKm = { ev: F.ev.price / F.ev.mileage, pe: F.petrol.price / F.petrol.mileage };
console.log(JSON.stringify(out));
