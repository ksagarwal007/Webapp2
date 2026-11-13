/* Numbers for "Prepay now or after the interest-heavy years?", from the EMI calculator's own code.
   Usage: node tools/guide_prepay_timing_numbers.js -> JSON */
const E = require("../src/assets/js/emi.js");
const start = E.ym("2026-12");
const B = { bal: 5000000, rate: 8.5, n: 240, start, effect: "tenure", extra: 0 };
const sim = (events, o) => E.simulate(Object.assign({}, B, { events: events || [] }, o || {}));
const base = sim();
const share = [1, 5, 10, 15, 20].map(y => { const r = base.rows.slice((y - 1) * 12, y * 12); const i = r.reduce((a, x) => a + x.interest, 0), p = r.reduce((a, x) => a + x.principal, 0); return { y, interest: i, principal: p, pct: i / (i + p) }; });
const when = [1, 3, 5, 8, 12, 16].map(y => {
  const s = sim([{ kind: "pay", at: start + (y - 1) * 12, amount: 200000 }]);
  const e = sim([{ kind: "pay", at: start + (y - 1) * 12, amount: 200000, effect: "emi" }]);
  return { y, saved: base.totInt - s.totInt, months: base.months - s.months, savedEmi: base.totInt - e.totInt, emiAfter: e.rows[(y - 1) * 12 + 1] ? e.rows[(y - 1) * 12 + 1].emi : null, perRupee: (base.totInt - s.totInt) / 200000 };
});
const wait = { now: when[0], later: when[3] };   /* year 1 against year 8 */
process.stdout.write(JSON.stringify({ B, emi: base.emi0, totInt: base.totInt, months: base.months, share, when, wait }));
