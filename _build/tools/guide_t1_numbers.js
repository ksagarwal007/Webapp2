/* Numbers for the batch T1 guides (labour codes salary calculator), from the tool's own code.
   Usage: node tools/guide_t1_numbers.js -> JSON */
const L = require("../src/assets/js/lc.js");
const base = { basic: 40000, hra: 20000, other: 60000, pfNow: "full", gratCtc: true, regime: "new", rent: 20000, metro: true, ded: 0, years: 10, age: 30, hike: 7 };
const pick = x => ({ B: x.B, hra: x.hra, other: x.other, gross: x.gross, emp: x.emp, own: x.own, gratP: x.gratP, ctc: x.ctc, tax: x.tax, takeHome: x.takeHome,
  gratYear: x.gratYear, gratExit: x.gratExit, epf: x.epf, epfReal: x.epfReal, hraEx: x.hraEx, ded: x.ded });
function run(o) { const r = L.calc(o); return { test: r.test, ctc: r.ctc, ok: r.ok, now: pick(r.now), full: pick(r.plans.full), capped: pick(r.plans.capped), absorb: pick(r.plans.absorb) }; }
const out = { base, neww: run(base), old: run({ ...base, regime: "old" }), cappedNow: run({ ...base, pfNow: "capped" }),
  compliant: run({ ...base, basic: 50000, hra: 20000, other: 20000 }), noGratCtc: run({ ...base, gratCtc: false }) };
console.log(JSON.stringify(out));
