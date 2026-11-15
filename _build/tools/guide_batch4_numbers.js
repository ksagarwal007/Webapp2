/* Numbers for four short guides (15 Nov), from the tools' own code: sip.js, gratuity.js, deposits.js, eps.js.
   Usage: node tools/guide_batch4_numbers.js -> JSON */
const SIP = require("../src/assets/js/sip.js"), G = require("../src/assets/js/gratuity.js"), D = require("../src/assets/js/deposits.js"), E = require("../src/assets/js/eps.js");
const out = {};
/* 1. SIP: ₹15,000 a month, 10% step-up, 15 years, goal ₹1 crore */
const b = { start: 0, startCost: 0, sip: 15000, step: 10, years: 15, ret: 12, kind: "equity", slab: 20, infl: 6 };
out.sip = {}; [12, 11, 10].forEach(r => { const s = SIP.simulate({ ...b, ret: r }); out.sip[r] = { value: s.value, invested: s.invested }; });
out.sipNeed = {}; [12, 11, 10].forEach(r => { out.sipNeed[r] = SIP.sipFor({ ...b, ret: r }, 10000000); });
out.sipYears = {}; [12, 10].forEach(r => { let y = 1; while (SIP.simulate({ ...b, ret: r, years: y }).value < 10000000 && y < 40) y++; out.sipYears[r] = y; });
/* 2. Gratuity: total pay ₹1,20,000, basic + DA ₹30,000 vs ₹60,000, 8 years */
const g = { type: "permanent", reason: "leave", employer: "covered", total: 120000, join: "2018-11-01", leave: "2026-11-15", earlier: 0 };
out.grat = [30000, 45000, 60000, 72000].map(bs => { const r = G.calc({ ...g, basic: bs, avg10: bs }); return { basic: bs, wages: r.wages, grat: r.grat, old: r.gratOld, yrs: r.yrs }; });
/* 3. FD: ₹10 lakh for 5 years at 7.25% */
const f = { amt: 1000000, rate: 7.25, months: 60 };
const cum = D.fd({ ...f, payout: "reinvest" }), q = D.fd({ ...f, payout: "quarterly" }), mo = D.fd({ ...f, payout: "monthly" });
out.fd = { cum: cum.maturity, cumInt: cum.interest, q: q.payout, qInt: q.interest, mo: mo.payout, moInt: mo.interest, yr1Cum: cum.years[0], yr5Cum: cum.years[4] };
out.fdTax = {}; [0, 20, 30].forEach(sl => { out.fdTax[sl] = { cum: D.tax(cum.years, { slab: sl, regime: "new", senior: false }).tax, mo: D.tax(mo.years, { slab: sl, regime: "new", senior: false }).tax }; });
/* 4. EPS start age: Ravi (from the EPS main guide) */
const R = E.calc({ p1: 4, p2: 12, p3: 18, wage: 60000, higher: false, start: 58 });
out.eps = {}; [50, 52, 55, 57, 58, 59, 60].forEach(a => { out.eps[a] = R.at(a); });
function be(a1, a2) { const p1 = R.at(a1), p2 = R.at(a2); return (p2 * a2 - p1 * a1) / (p2 - p1); }
out.epsBe = { "50-58": be(50, 58), "55-58": be(55, 58), "58-60": be(58, 60) };
const R15 = E.calc({ p1: 0, p2: 8, p3: 7, wage: 40000, higher: false, start: 58 });   /* 15 years, no added years either way */
out.eps15 = { 50: R15.at(50), 58: R15.at(58), 60: R15.at(60) };
console.log(JSON.stringify(out));
