/* Numbers for "When to resign: how the six-month rule changes your gratuity", from the gratuity calculator's own code.
   Usage: node tools/guide_gratuity_resign_numbers.js -> JSON */
const G = require("../src/assets/js/gratuity.js");
const R = { type: "permanent", reason: "leave", employer: "covered", basic: 40000, total: 100000, avg10: 40000, join: "2020-01-10", leave: "2026-07-10", earlier: 0 };
const run = o => { const r = G.calc(Object.assign({}, R, o)); return { sv: r.sv, yrs: r.yrs, wages: r.wages, grat: r.grat, eligible: r.eligible }; };
const out = { R, perYear: G.wagesNew(R.basic, R.total) * 15 / 26,
  jul10: run({}), jul11: run({ leave: "2026-07-11" }), jan9: run({ leave: "2027-01-09" }), jan10: run({ leave: "2027-01-10" }),
  /* five-year mark: joined 10 Jan 2022 */
  y4m11: run({ join: "2022-01-10", leave: "2026-12-31" }), y5: run({ join: "2022-01-10", leave: "2027-01-10" }),
  notCovered: run({ employer: "notcovered", leave: "2026-12-31" }), covered: run({ leave: "2026-12-31" }) };
process.stdout.write(JSON.stringify(out));
