/* Numbers for the batch T4 guides (SWP calculator), from the tool's own code. Example: Suresh, 60, ₹1 crore of fresh money in an equity-oriented
   hybrid fund at 10% a year, taking ₹50,000 a month rising 5% a year; 20% slab; FD at 7%. Usage: node tools/guide_t4_numbers.js -> JSON */
const T = require("../src/assets/js/swp-tool.js"), SWP = require("../src/assets/js/swp.js");
const base = { corpus: 1e7, gains0: 0, held: false, mode: "last", withdraw: 50000, years: 30, step: 5, ret: 10, kind: "equity", slab: 20, fd: 7 };
const sl = r => ({ w: r.w, lastsY: r.lastsY, end: r.sim.end, tax: r.sim.tax, withdrawn: r.sim.withdrawn, gains: r.sim.gains, rows: r.sim.rows, safe: r.safe, fdGross: r.fdGross, fdNet: r.fdNet, cmp: r.cmp });
const out = { base, main: sl(T.calc(base)) };
out.debt = sl(T.calc({ ...base, kind: "debt" }));
out.fdSame = sl(T.calc({ ...base, withdraw: 58333, step: 0 }));        /* SWP taking the FD's pre-tax interest, flat */
out.fdSameNet = sl(T.calc({ ...base, withdraw: 46200, step: 0 }));
out.safe = [8, 9, 10, 11].map(ret => ({ ret, w: [20, 30, 40].map(y => SWP.sustainable({ corpus: 1e7, step: 5, ret, months: y * 12 })) }));
out.safeStep = [0, 5, 6].map(step => ({ step, w: [20, 30, 40].map(y => SWP.sustainable({ corpus: 1e7, step, ret: 10, months: y * 12 })) }));
out.steps = [0, 5, 6].map(step => { const r = T.calc({ ...base, step }); return { step, lastsY: r.lastsY, end: r.sim.end, y20: r.sim.rows[19] ? r.sim.rows[19].withdrawn / 12 : 0 }; });
out.ret1 = sl(T.calc({ ...base, ret: 9 }));
out.held = sl(T.calc({ ...base, held: true }));
/* Annuity: ₹1 crore at 6.5% a year for life, taxed at slab (20% + cess) */
out.annuity = { gross: 1e7 * 0.065 / 12, net: 1e7 * 0.065 / 12 * (1 - 0.208) };
console.log(JSON.stringify(out));
