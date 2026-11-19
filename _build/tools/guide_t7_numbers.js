/* Numbers for the T7 guides (ESOP and RSU tax). One example throughout: Vikram, 34, Bengaluru, ₹40 lakh a year other taxable pay;
   100 RSUs of his US-listed employer vest at ₹17,500 a share; he sells at ₹21,000. Variations change one thing about him. Usage: node tools/guide_t7_numbers.js -> JSON */
const E = require("../src/assets/js/esop.js"), NPS = require("../src/assets/js/nps.js");
const base = { kind: "rsu", co: "abroad", shares: 100, strike: 0, fmv: 17500, salary: 4000000, sale: 21000, held: 14, used: 0, startup: false, on: "2026-07", saleSalary: 4000000, leave: false, leaveAt: 0 };
/* Vests in July 2026 (tax year 2026-27); a sale 14 months later (Sep 2027) falls in tax year 2027-28, with the same ₹40 lakh pay. */
const run = x => { const r = E.calc({ ...base, ...x }); return { perq: r.perq, perqTax: r.perqTax, perqRate: r.perqRate, gain: r.gain, cg: r.cg.tax, cgType: r.cg.type, other: r.other.tax, kept: r.kept, cover: r.cover, paid: r.paid, proceeds: r.proceeds, defer: r.defer, long: r.long }; };
const out = {};
out.main = run({}); out.long = run({ held: 25 }); out.atVest = run({ sale: 17500, held: 0 });
/* Surcharge: his income crosses ₹50 lakh with the vest */
const b = 4000000 - 75000, slabs = x => { let t = 0, lo = 0; for (const [hi, r] of [[400000, 0], [800000, .05], [1200000, .1], [1600000, .15], [2000000, .2], [2400000, .25], [Infinity, .3]]) { if (x > lo) t += (Math.min(x, hi) - lo) * r; lo = hi; } return t; };
out.taxSalary = NPS.newTax(b); out.taxBoth = NPS.newTax(b + 1750000); out.surcharge = slabs(b + 1750000) * 0.10 * 1.04;
/* Sell at vest or hold: prices */
out.hold = [-30, -10, 0, 20, 30].map(p => ({ p, st: run({ sale: 17500 * (1 + p / 100), held: 14 }).kept, lt: run({ sale: 17500 * (1 + p / 100), held: 25 }).kept }));
/* ESOP instead: 1,000 options at ₹500, worth ₹1,500 on exercise, listed in India; sold at ₹1,800 */
const es = { kind: "esop", co: "in", shares: 1000, strike: 500, fmv: 1500, sale: 1800 };
out.esopLong = run({ ...es, held: 13 }); out.esopShort = run({ ...es, held: 8 }); out.esopUsed = run({ ...es, held: 13, used: 125000 });
/* Start-up: 2,000 options at ₹100, valued ₹600 on exercise in tax year 2026-27 */
out.startup = run({ kind: "esop", co: "unlisted", shares: 2000, strike: 100, fmv: 600, sale: 600, held: 72, startup: true });
out.startupLeave = run({ kind: "esop", co: "unlisted", shares: 2000, strike: 100, fmv: 600, sale: 600, held: 30, startup: true, leave: true, leaveAt: 10 });
/* Price falls 30% after vesting */
out.fall = run({ sale: 12250 }); out.fallLong = run({ sale: 12250, held: 25 });
console.log(JSON.stringify(out));
