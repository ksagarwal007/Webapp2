/* Numbers for the FD, PPF and RD guides, from the calculator's own code. Usage: node tools/guide_fd_numbers.js -> JSON */
const D = require("../src/assets/js/deposits.js");
const out = {};
/* Main guide: Neha saves ₹1.5 lakh a year for 15 years */
out.slabs = [0, 20, 30].map(s => { const c = D.compare({ yearly: 150000, years: 15, fdRate: 7, rdRate: 6.8, ppfRate: 7.1, slab: s, infl: 6 }); return { slab: s, fd: c.fd, rd: c.rd, ppf: c.ppf, realPpf: c.real.ppf, put: c.put }; });
/* Short goal: ₹5 lakh for 3 years in an FD at 7%, 30% slab */
const f3 = D.fd({ amt: 500000, rate: 7, months: 36, payout: "reinvest" }); out.fd3 = { maturity: f3.maturity, interest: f3.interest, tax: D.tax(f3.years, { slab: 30, regime: "new", senior: false, otherSameBank: 0 }).tax };
/* TDS article: ₹6 lakh and ₹9 lakh in a one-year FD at 7%, 20% slab */
out.tds = [600000, 900000].map(a => { const f = D.fd({ amt: a, rate: 7, months: 12, payout: "reinvest" }), t = D.tax(f.years, { slab: 20, regime: "new", senior: false, otherSameBank: 0 }); return { amt: a, interest: f.interest, tax: t.tax, tds: t.tds, more: t.tax - t.tds }; });
/* Two banks: ₹6 lakh in each of two banks: no TDS at either, tax on both */
const two = D.fd({ amt: 600000, rate: 7, months: 12, payout: "reinvest" }); out.twoBanks = { each: two.interest, total: two.interest * 2, tax: D.tax([two.interest * 2], { slab: 20, regime: "new" }).tax };
/* PPF timing: ₹1.5 lakh a year for 15 years at 7.1% */
const r = 0.071, ap = D.ppf({ yearly: 150000, rate: 7.1, years: 15, when: "april" }), mo = D.ppf({ yearly: 150000, rate: 7.1, years: 15, when: "monthly" });
let late = 0; for (let y = 0; y < 15; y++) { const i = late * r; late += 150000 + i; }           /* paid in March, after the 5th: earns nothing in the year it goes in */
out.ppf = { april: ap.maturity, monthly: mo.maturity, late, put: 150000 * 15, y1april: 150000 * r, y1late: 0 };
/* One month late: deposit on 6 April instead of 5 April loses April's interest on ₹1.5 lakh */
out.ppf.oneMonth = 150000 * r / 12;
process.stdout.write(JSON.stringify(out));
