/* Numbers for five guides (15 Nov): term.js, deposits.js, fnf.js, sip.js. Usage: node tools/guide_batch5_numbers.js -> JSON */
const T = require("../src/assets/js/term.js"), D = require("../src/assets/js/deposits.js"), F = require("../src/assets/js/fnf.js"), SIP = require("../src/assets/js/sip.js");
const out = {};
/* Term: the calculator's default family */
const TB = { age: 32, years: 28, expenses: 50000, spouse: 0, infl: 6, ret: 7, edu: 2000000, eduIn: 15, wed: 1000000, wedIn: 23, goalInfl: 8, loans: 4000000, loanYears: 18, buffer: true, savings: 500000, cover: 0, income: 1500000 };
const t = T.calc(TB);
out.term = { cover: t.cover, peak: t.peak, peakAge: t.peakAge, rounded: t.rounded, until: t.until, income: t.now.income, goals: t.now.goals, loans: t.now.loans, buffer: t.now.buffer, gross: t.now.gross,
  ret6: T.calc({ ...TB, ret: 6 }).rounded, exp60: T.calc({ ...TB, expenses: 60000 }).rounded, spouse: T.calc({ ...TB, spouse: 30000 }).rounded, noLoan: T.calc({ ...TB, loans: 0 }).rounded,
  group: T.calc({ ...TB, cover: 4500000 }).rounded, events: t.events.map(e => ({ label: e.label, drop: e.before - e.cover })) };
/* PPF after 15 years: ₹1.5 lakh a year by 5 April at 7.1% */
const p15 = D.ppf({ yearly: 150000, rate: 7.1, years: 15, when: "april", stopAfter15: true });
const p20no = D.ppf({ yearly: 150000, rate: 7.1, years: 20, when: "april", stopAfter15: true });
const p20yes = D.ppf({ yearly: 150000, rate: 7.1, years: 20, when: "april", stopAfter15: false });
const p25yes = D.ppf({ yearly: 150000, rate: 7.1, years: 25, when: "april", stopAfter15: false });
out.ppf = { p15: p15.maturity, dep15: p15.deposits, p20no: p20no.maturity, p20yes: p20yes.maturity, dep20: p20yes.deposits, p25yes: p25yes.maturity, dep25: p25yes.deposits };
/* Leave encashment on resigning */
const L = { join: "2011-01-01", leave: "2026-12-31", type: "permanent", employer: "covered", divisor: "month", encashOn: "basic", noticeOn: "gross", pf: false, basic: 100000, total: 200000, avg10: 100000,
  balance: 180, perYear: 30, earlierLeave: 0, noticeReq: 90, noticeServed: 90, bonus: 0, reimb: 0, other: 0, slab: 30, earlierGrat: 0 };
const pick = r => ({ amt: r.leaveAmt, free: r.leaveFree, tax: r.leaveTax, lim: r.lim, unav: r.unavailed, yrs: r.yrsDone });
out.leave = { a: pick(F.calc(L)), b: pick(F.calc({ ...L, balance: 300, perYear: 45 })), c: pick(F.calc({ ...L, balance: 180, earlierLeave: 2300000 })), d: pick(F.calc({ ...L, balance: 300, perYear: 30, avg10: 80000 })) };
/* First SIP on a first salary: ₹4,000 a month, rising 10% a year, 11% return, to 58 from 23 vs from 28 */
const S = { start: 0, startCost: 0, sip: 4000, step: 10, ret: 11, kind: "equity", slab: 0, infl: 6 };
const s35 = SIP.simulate({ ...S, years: 35 }), s30 = SIP.simulate({ ...S, years: 30 }), sFlat = SIP.simulate({ ...S, years: 35, step: 0 }), s2k = SIP.simulate({ ...S, sip: 2000, years: 35 });
out.sip = { s35: s35.value, inv35: s35.invested, s30: s30.value, inv30: s30.invested, flat: sFlat.value, invFlat: sFlat.invested, s2k: s2k.value, last35: s35.lastSip, real35: s35.real };
console.log(JSON.stringify(out));
