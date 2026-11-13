/* Numbers for "Is rent really dead money?", from the Rent or Buy calculator's own code (Arjun's example from the main guide).
   Usage: node tools/guide_rent_dead_numbers.js -> JSON */
const R = require("../src/assets/js/rent-buy.js");
const A = { price: 9000000, down: 1800000, stamp: 630000, reg: 30000, other: 150000, rate: 8.5, tenure: 20, rent: 24000, rentUp: 5,
  deposit: 100000, depUp: false, own: 48000, ownUp: 5, stay: 12, grow: 6, ret: 12, kind: "equity", sell: 1, keep: false, reinvest: false,
  possess: 0, uc: false, regime: "new", slab: 20, claimInt: true, room: 0, claimHra: true, basic: 60000, hra: 30000, metro: true };
function sunk(o) {
  const s = R.simulate(o), b = s.buy, H = s.H;
  const y1 = s.rows.slice(0, 12), y1i = y1.reduce((a, r) => a + r.interest, 0), y1e = y1.reduce((a, r) => a + r.emi, 0);
  const sellCost = o.keep ? 0 : b.home - b.saleNet;
  const buySunk = b.interest + o.stamp + o.reg + o.other + b.own + sellCost + b.propTax;
  return { diff: s.diff, buyFinal: b.final, rentFinal: s.rent.final, rentPaid: s.rent.rent, interest: b.interest, upfrontCosts: o.stamp + o.reg + o.other, own: b.own,
    sellCost, propTax: b.propTax, buySunk, home: b.home, gainOnHome: b.home - o.price, y1Interest: y1i, y1Emi: y1e, emi: s.emi, rent1: o.rent,
    rentInvested: s.rent.invested, be: R.breakeven(o) };
}
const out = { A, base: sunk(A), grow8: sunk(Object.assign({}, A, { grow: 8 })), stay20: sunk(Object.assign({}, A, { stay: 20 })),
  fd: sunk(Object.assign({}, A, { kind: "fd" })), buyWins: sunk(Object.assign({}, A, { grow: 8, ret: 10, stay: 15, keep: true })) };
process.stdout.write(JSON.stringify(out));
