/* Numbers for the Car Lease vs Car Loan guide and the perquisite article, from the calculator's own code.
   Usage: node tools/guide_car_numbers.js -> JSON */
const C = require("../src/assets/js/car-lease.js");
const S = { price: 1200000, engine: "small", years: 4, rental: 30000, insInc: true, maintInc: true, runCo: true, driver: false, driverCost: 15000,
  end: "buy", buyback: 240000, down: 240000, rate: 9, loanYrs: 4, ins: 30000, maint: 15000, fuel: 6000, dep: 15, slab: 30, ret: 7,
  exitYrs: 2, exitCharge: 50000, exitEnd: "buy", exitPrice: 650000 };
const pick = s => ({ diff: s.diff, outL: s.outL, outB: s.outB, emi: s.emi, taxNet: s.lease.taxSaved - s.lease.perkTax, taxSaved: s.lease.taxSaved, perkTax: s.lease.perkTax,
  leasePaid: s.lease.paid, loanPaid: s.loanT.paid + s.balEnd, car: s.carEnd, leaseNet: s.lease.paid - (s.lease.buyback ? s.carEnd : 0), loanNet: s.loanT.paid + s.balEnd - s.carEnd,
  interest: s.loanT.interest, perk: s.perk });
const sim = o => pick(C.simulate(Object.assign({}, S, o)));
const out = { S, base: sim({}), slabs: {}, be: C.breakeven(S), ret: sim({ end: "return" }), self: sim({ runCo: false }), big: sim({ engine: "big" }),
  exit: pick(C.exitSim(S)), exitReturn: pick(C.exitSim(Object.assign({}, S, { exitEnd: "return" }))), PERK: C.PERK };
for (const sl of [0, 5, 10, 15, 20, 25, 30]) out.slabs[sl] = sim({ slab: sl });
/* Old (1962 Rules) values for the perquisite article: employer pays running costs 1,800 / 2,400; employee pays 600 / 900; chauffeur 900. */
out.OLD = { co: { small: 1800, big: 2400 }, self: { small: 600, big: 900 }, driver: 900 };
process.stdout.write(JSON.stringify(out));
