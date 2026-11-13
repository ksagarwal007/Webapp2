/* Numbers for the two short Rent vs Buy articles, from the Rent vs Buy engine.
   Usage: node tools/guide_rvb_articles_numbers.js  ->  JSON on stdout */
const R = require("../src/assets/js/rent-buy.js");
const A = { price: 9000000, down: 1800000, stamp: 630000, reg: 30000, other: 150000, rate: 8.5, tenure: 20, rent: 24000, rentUp: 5,
  deposit: 100000, depUp: false, own: 48000, ownUp: 5, stay: 12, grow: 6, ret: 12, kind: "equity", sell: 1, keep: false, reinvest: false,
  possess: 0, uc: false, regime: "new", slab: 20, claimInt: true, room: 0, claimHra: true, basic: 60000, hra: 30000, metro: true };
const sim = o => R.simulate(Object.assign({}, A, o));
/* Under construction vs ready */
const ready = sim({});
const uc = {};
for (const y of [2, 3, 4, 5]) {
  const s = sim({ possess: y, uc: true }), P = y * 12, rows = s.rows.slice(0, P);
  uc[y] = { buy: s.buy.final, gap: ready.buy.final - s.buy.final, rentDuring: rows.reduce((a, r) => a + r.rentB, 0), interestDuring: rows.reduce((a, r) => a + r.interest, 0) };
}
/* price at which a 3-year under-construction flat ends level with the ready one (same down % and stamp duty %) */
/* level = renting's lead over buying is the same for both, i.e. the under-construction flat is as good a buy as the ready one */
function ucAt(price) { return sim({ possess: 3, uc: true, price, down: price * 0.2, stamp: price * 0.07 }).diff; }
let lo = 5e6, hi = 9e6; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (ucAt(m) > ready.diff) hi = m; else lo = m; }
const evenPrice = (lo + hi) / 2;
/* HRA vs home loan, old regime */
function yr1(o) { const s = sim(Object.assign({ regime: "old" }, o)); return { buyRefund1: s.rows[11].refB, rentRefund1: s.rows[11].refR, buyRefunds: s.buy.refunds, rentRefunds: s.rent.refunds, diff: s.diff, int1: s.rows.slice(0, 12).reduce((a, r) => a + r.interest, 0), prin1: s.rows.slice(0, 12).reduce((a, r) => a + r.emi - r.interest, 0) }; }
const hra = { room0: yr1({}), room150: yr1({ room: 150000 }), nonMetro: yr1({ metro: false }), slab30: yr1({ slab: 30 }), newRegime: sim({}).diff, oldRegime: sim({ regime: "old" }).diff };
const hraExempt1 = Math.min(30000, 24000 - 6000, 30000) * 12;
process.stdout.write(JSON.stringify({ arjun: A, ready: { buy: ready.buy.final, rent: ready.rent.final, diff: ready.diff }, uc, evenPrice, hra, hraExempt1 }));
