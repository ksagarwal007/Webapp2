/* Numbers for the full and final settlement and fixed-term gratuity guides, from the tools' own code (fnf.js, gratuity.js).
   Usage: node tools/guide_fnf_numbers.js -> JSON */
const F = require("../src/assets/js/fnf.js"), G = require("../src/assets/js/gratuity.js");
const P = { join: "2022-02-01", leave: "2026-12-15", type: "permanent", employer: "covered", divisor: "month", encashOn: "basic", noticeOn: "gross", pf: true,
  basic: 60000, total: 120000, avg10: 60000, balance: 25, perYear: 24, earlierLeave: 0, noticeReq: 90, noticeServed: 75, bonus: 0, reimb: 0, other: 0, slab: 20, earlierGrat: 0 };
const pick = r => ({ salary: r.salary, days: r.days, leaveAmt: r.leaveAmt, leaveFree: r.leaveFree, grat: r.g.grat, gratFree: r.g.exempt, eligible: r.g.eligible, short: r.short, notice: r.notice, pf: r.pf, tax: r.tax, gross: r.gross, net: r.net, yrs: r.g.yrs });
const out = { P, base: pick(F.calc(P)), full: pick(F.calc({ ...P, noticeServed: 90 })), feb: pick(F.calc({ ...P, leave: "2027-02-15", noticeServed: 90 })) };
/* fixed-term gratuity: basic + DA ₹40,000, total pay ₹1,00,000 */
const base = { type: "fixed", reason: "leave", employer: "covered", basic: 40000, total: 100000, avg10: 40000, earlier: 0 };
const cases = [["11 months", "2025-12-01", "2026-11-01"], ["1 year 3 months", "2025-08-01", "2026-11-01"], ["1 year 7 months", "2025-04-01", "2026-11-01"], ["2 years 7 months", "2024-04-01", "2026-11-01"]];
out.fixed = cases.map(([lbl, j, l]) => { const r = G.calc({ ...base, join: j, leave: l }); return { lbl, eligible: r.eligible, yrs: r.yrs, wages: r.wages, grat: r.grat }; });
const perm = G.calc({ ...base, type: "permanent", join: "2025-08-01", leave: "2026-11-01" }); out.permSame = { eligible: perm.eligible, grat: perm.grat };
out.oldRule = 40000 * 15 / 26;
console.log(JSON.stringify(out));
