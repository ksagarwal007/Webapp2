/* Runs the Prepay or Invest engine for the guide's worked example, so the guide always matches the tool.
   Usage: node tools/guide_prepay_numbers.js  ->  JSON on stdout */
const P = require("../src/assets/js/prepay.js");
const ROHAN = { P: 4000000, rate: 8.5, years: 15, extra: 15000, lump: 0, ret: 12, kind: "equity", regime: "new", slab: 30, claim: true };
function run(o) {
  const s = P.simulate(o), b = P.breakeven(o);
  return { diff: s.diff, emi: s.emi, prepayFinal: s.prepay.final, investFinal: s.invest.final, prepayInterest: s.prepay.interest, investInterest: s.invest.interest,
    saved: s.invest.interest - s.prepay.interest, payoffMonths: s.prepay.payoff, N: s.N, investTax: s.invest.tax, prepayTax: s.prepay.tax,
    be: b.kind === "rate" ? b.rate : null, beKind: b.kind };
}
const V = { base: {}, fd: { kind: "fd", ret: 7 }, debt: { kind: "debt", ret: 7.5 }, ret10: { ret: 10 }, ret8: { ret: 8 }, rate95: { rate: 9.5 },
  old: { regime: "old" }, lump: { lump: 500000, extra: 0 }, short: { years: 5, P: 1500000 }, extra30: { extra: 30000 } };
const out = { rohan: ROHAN, results: {} };
for (const k in V) out.results[k] = run(Object.assign({}, ROHAN, V[k]));
process.stdout.write(JSON.stringify(out));
