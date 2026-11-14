/* Numbers for "Petrol, CNG or EV: what a car really costs per km", from the car ownership cost calculator's own code.
   Usage: node tools/guide_car_cost_numbers.js -> JSON */
const C = require("../src/assets/js/car-own.js"), F = C.FUEL;
const mk = (fuel, price, ins1, ins2, res) => ({ fuel, price, mileage: F[fuel].mileage, fuelPrice: F[fuel].price, insFirst: ins1, insLater: ins2, service: F[fuel].service, resalePct: res, loan: Math.round(price * 0.8), rate: 9, tenure: 5 });
const cars = { petrol: mk("petrol", 1000000, 35000, 22000, 40), cng: mk("cng", 1090000, 36000, 23000, 38), ev: mk("ev", 1400000, 45000, 30000, 35) };
const K = km => ({ kmMonth: km, years: 7, rise: 3 });
const out = { cars, base: {}, dist: {}, be: {}, cash: {} };
for (const k in cars) { const r = C.car(cars[k], K(1200)); out.base[k] = { total: r.total, perKm: r.perKm, perMonth: r.perMonth, runPerKm: r.runPerKm, fuelPerKm: r.fuelPerKm, parts: r.parts, emi: r.emi }; }
for (const km of [500, 1000, 1500, 2000, 3000]) { out.dist[km] = {}; for (const k in cars) { const r = C.car(cars[k], K(km)); out.dist[km][k] = { total: r.total, perKm: r.perKm }; } }
out.be.petrolCng = C.breakEvenKm(cars.petrol, cars.cng, { years: 7, rise: 3 });
out.be.petrolEv = C.breakEvenKm(cars.petrol, cars.ev, { years: 7, rise: 3 });
out.be.cngEv = C.breakEvenKm(cars.cng, cars.ev, { years: 7, rise: 3 });
out.be.evYear = C.breakEvenYear(C.car(cars.petrol, K(1200)), C.car(cars.ev, K(1200)));
for (const k in cars) out.cash[k] = C.car(Object.assign({}, cars[k], { loan: 0 }), K(1200)).total;
process.stdout.write(JSON.stringify(out));
