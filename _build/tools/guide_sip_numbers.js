/* Numbers for the SIP guides, from the SIP calculator's own code. Usage: node tools/guide_sip_numbers.js -> JSON */
const S = require("../src/assets/js/sip.js");
const base = { start: 0, startCost: 0, sip: 10000, step: 0, years: 15, ret: 12, kind: "equity", slab: 30, infl: 6 };
const sim = o => { const r = S.simulate(Object.assign({}, base, o)); return { value: r.value, invested: r.invested, gain: r.gain, tax: r.tax, after: r.after, real: r.realAfter, lastSip: r.lastSip }; };
/* Main guide: Priya, goal ₹50 lakh in today's money in 15 years for her daughter's education */
const goalToday = 5000000, years = 15, infl = 6, goal = goalToday * Math.pow(1 + infl / 100, years);
const g = o => S.sipFor(Object.assign({}, base, { years }, o), goal);
const main = { goalToday, goal, years,
  flat: g({ step: 0 }), step10: g({ step: 10 }),
  existing: g({ step: 10, start: 500000, startCost: 400000 }), existingFlat: g({ step: 0, start: 500000, startCost: 400000 }),
  r10: g({ step: 10, ret: 10 }), r14: g({ step: 10, ret: 14 }),
  late5: S.sipFor(Object.assign({}, base, { years: 10, step: 10 }), goal) };
main.step10Sim = sim({ years, step: 10, sip: main.step10 }); main.flatSim = sim({ years, step: 0, sip: main.flat });
/* Step-up article: ₹10,000 a month for 20 years at 12% */
const steps = [0, 5, 10, 15].map(st => Object.assign({ step: st }, sim({ years: 20, step: st })));
const stepSame = S.sipFor(Object.assign({}, base, { years: 20, step: 0 }), steps[2].value);   /* flat SIP needed to match a 10% step-up */
/* Tax article: ₹10,000 a month for 10 years at 12% */
const eq = sim({ years: 10 }), debt = sim({ years: 10, kind: "debt", ret: 7, slab: 30 });
process.stdout.write(JSON.stringify({ main, steps, stepSame, eq, debt }));
