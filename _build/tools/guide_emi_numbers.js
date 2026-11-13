/* Numbers for the EMI main guide, from the EMI calculator's own code. Usage: node tools/guide_emi_numbers.js -> JSON */
const E = require("../src/assets/js/emi.js");
const start = E.ym("2026-12");
const B = { bal: 5000000, rate: 8.5, n: 240, start, effect: "tenure" };
const sim = (events, o) => { const s = E.simulate(Object.assign({}, B, { events: events || [], extra: 0 }, o || {}));
  return { emi0: s.emi0, emiLast: s.emiLast, totInt: s.totInt, months: s.months, end: E.ymTxt(s.end), first: s.rows[0], y1: s.rows.slice(0, 12).reduce((a, r) => ({ i: a.i + r.interest, p: a.p + r.principal }), { i: 0, p: 0 }) }; };
const pay = (at, amount, x) => Object.assign({ kind: "pay", at: E.ym(at), amount }, x || {});
const base = sim();
const one_t = sim([pay("2026-12", 100000)]);
const one_e = sim([pay("2026-12", 100000, { effect: "emi" })]);
const yr1 = sim([pay("2027-04", 200000)]), yr10 = sim([pay("2036-04", 200000)]);
const bonus = sim([pay("2027-04", 200000, { repeat: true })]);
const bonus_e = sim([pay("2027-04", 200000, { repeat: true, effect: "emi" })]);
const plan = sim([pay("2026-12", 100000), pay("2027-04", 200000, { repeat: true })]);
const rate = [{ kind: "rate", at: E.ym("2027-06"), rate: 9.25, effect: "tenure" }];
const rate_t = sim(rate), rate_e = sim([Object.assign({}, rate[0], { effect: "emi" })]);
const planRate = sim([pay("2026-12", 100000), pay("2027-04", 200000, { repeat: true })].concat(rate));
process.stdout.write(JSON.stringify({ B, base, one_t, one_e, yr1, yr10, bonus, bonus_e, plan, rate_t, rate_e, planRate }));
