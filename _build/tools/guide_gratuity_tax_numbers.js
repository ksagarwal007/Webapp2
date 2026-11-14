/* Numbers for "Is gratuity taxable? The ₹20 lakh lifetime limit for job-hoppers", from the gratuity calculator's own code.
   Usage: node tools/guide_gratuity_tax_numbers.js -> JSON */
const G = require("../src/assets/js/gratuity.js");
const R = { type: "permanent", reason: "leave", employer: "covered", basic: 140000, total: 350000, avg10: 140000, join: "2018-11-01", leave: "2026-11-30", earlier: 0 };
const run = o => { const r = G.calc(Object.assign({}, R, o)); return { yrs: r.yrs, wages: r.wages, grat: r.grat, room: r.room, exempt: r.exempt, taxable: r.taxable, eligible: r.eligible }; };
const out = { R, first: run({}), hopper: run({ earlier: 1400000 }), hopperTax30: run({ earlier: 1400000 }).taxable * 0.3 * 1.04,
  short: run({ join: "2022-03-01", leave: "2026-11-30" }), govt: run({ employer: "govt", earlier: 1400000 }),
  earlierJobs: [["First job", 300000], ["Second job", 500000], ["Third job", 600000]] };
process.stdout.write(JSON.stringify(out));
