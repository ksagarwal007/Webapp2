/* Runs the Rent vs Buy engine for the guide's worked examples, so the guide always matches the tool.
   Usage: node tools/guide_numbers.js  ->  JSON on stdout */
const R = require("../src/assets/js/rent-buy.js");
const ARJUN = { price: 9000000, down: 1800000, stamp: 630000, reg: 30000, other: 150000, rate: 8.5, tenure: 20, rent: 24000, rentUp: 5,
  deposit: 100000, depUp: false, own: 48000, ownUp: 5, stay: 12, grow: 6, ret: 12, kind: "equity", sell: 1, keep: false, reinvest: false,
  possess: 0, uc: false, regime: "new", slab: 20, claimInt: true, room: 0, claimHra: true, basic: 60000, hra: 30000, metro: true };
function run(o) {
  const s = R.simulate(o), b = R.breakeven(o), p = R.payoff(s);
  return { diff: s.diff, buy: s.buy.final, rent: s.rent.final, emi: s.emi, loan: s.loan, upfront: s.buy.upfront, interest: s.buy.interest,
    emiPaid: s.buy.emi, own: s.buy.own, rentPaid: s.rent.rent, saleNet: s.buy.saleNet, propTax: s.buy.propTax, loanLeft: s.buy.loanLeft, home: s.buy.home,
    rentInvested: s.rent.invested, be: b.kind === "rate" ? b.rate : null, beKind: b.kind, payoff: p === null ? null : p / 12 };
}
const V = {
  base: {}, stay5: { stay: 5 }, stay20: { stay: 20 }, grow8: { grow: 8 }, grow4: { grow: 4 }, uc3: { uc: true, possess: 3 },
  keep: { keep: true }, reinvest: { reinvest: true }, fd: { kind: "fd" }, old: { regime: "old" },
  buyWins: { grow: 8, ret: 10, stay: 15, keep: true }
};
const out = { arjun: ARJUN, results: {} };
for (const k in V) out.results[k] = run(Object.assign({}, ARJUN, V[k]));
process.stdout.write(JSON.stringify(out));
