/* Numbers for the gratuity main guide, from the gratuity calculator's own code. Usage: node tools/guide_gratuity_numbers.js -> JSON */
const G = require("../src/assets/js/gratuity.js");
const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const NEHA = { type: "permanent", reason: "leave", employer: "covered", basic: 50000, total: 120000, avg10: 50000, join: "2019-03-01", leave: "2026-11-14", earlier: 0 };
const run = o => { const r = G.calc(Object.assign({}, NEHA, o)); return { sv: r.sv, yrs: r.yrs, wages: r.wages, grat: r.grat, gratOld: r.gratOld, exempt: r.exempt, taxable: r.taxable, room: r.room, eligible: r.eligible, eligibleOn: r.eligibleOn && iso(r.eligibleOn) }; };
const ns = G.nextStep(NEHA);
const out = {
  neha: NEHA, base: run({}),
  next: { date: iso(ns.date), days: ns.days, gain: ns.gain, after: ns.after.grat },
  sep1: run({ leave: "2026-09-01" }), sep2: run({ leave: "2026-09-02" }),
  earlier6: run({ earlier: 600000 }), earlier19: run({ earlier: 1900000 }),
  basic60: run({ basic: 72000 }),                       /* basic is 60% of pay: the 50% rule changes nothing */
  fixed: run({ type: "fixed", join: "2025-03-01" }), perm4: run({ join: "2022-03-01" }),
  big: run({ basic: 200000, total: 450000, join: "2000-03-01" }),
  table: [30, 40, 50, 60].map(pct => { const b = 120000 * pct / 100, r = G.calc(Object.assign({}, NEHA, { basic: b })); return { pct, basic: b, old: r.gratOld, now: r.grat }; })
};
process.stdout.write(JSON.stringify(out));
