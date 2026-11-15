/* Numbers for five guides (15 Nov, batch 9): notice buyout, two employers, term insurance tax, Sukanya at maturity, floating or fixed.
   Usage: node tools/guide_batch9_numbers.js -> JSON */
const NPS = require("../src/assets/js/nps.js"), EMI = require("../src/assets/js/emi.js"), SSY = require("../src/assets/js/ssy.js");
const out = {};
const tN = inc => NPS.newTax(Math.max(0, inc));
/* 1. Notice buyout: ₹18 lakh a year (₹1.5 lakh a month gross), 90-day notice, serves 30: 60 days short. Daily rate on gross ÷ 30. */
const gross = 150000, short = 60, buy = gross / 30 * short;
out.notice = { gross, short, buy, newJoin: 30 * 6000 / 30 };
/* The buyout is ₹3 lakh. If the new employer reimburses it, it's taxed as salary: tax on it at the margin (new regime, total ₹24 lakh) */
out.notice.taxOnReimb = tN(2400000 - 75000 + buy) - tN(2400000 - 75000);
/* If the old employer recovers it and the court view (only salary received is taxed) is applied: tax difference on ₹3 lakh */
out.notice.taxIfNotDeducted = out.notice.taxOnReimb;
/* 2. Two employers: A ₹1.2 lakh a month Apr–Sep (₹7.2 lakh), B ₹1.5 lakh a month Oct–Mar (₹9 lakh). New regime. */
const A = 720000, B = 900000;
out.two = { A, B, tdsA: tN(A - 75000), tdsB: tN(B - 75000), total: tN(A + B - 75000) };
out.two.due = out.two.total - out.two.tdsA - out.two.tdsB;
/* If B is told about A (Form 122), B deducts the whole year's tax in its 6 months */
out.two.perMonthB = out.two.total / 6;
/* 3. Term insurance: ₹1 crore cover, premium ₹15,000 a year. Old regime saving at 30%, 20%, 5% (with 4% cess), only if the ₹1.5 lakh limit isn't already used. */
const prem = 15000; out.term = { prem, s30: prem * 0.312, s20: prem * 0.208, s5: prem * 0.052, over25: prem * 0.312 * 25 };
/* 4. Sukanya at maturity: ₹1.5 lakh a year from age 2, 8.2%, by 5 April */
const s = SSY.calc({ age: 2, yearly: 150000, when: "april", rate: 8.2, ppfRate: 7.1, edu: 0, regime: "new", slab: 30 }).s;
out.ssy = { maturity: s.maturity, deposits: s.deposits, at18: s.rows[15].bal, idle1: s.maturity * 0.07, half18: s.rows[15].bal * 0.5 };
/* 5. Floating or fixed: ₹50 lakh, 20 years. Floating 7.75% (repo-linked); fixed 9.25%. Scenarios for the floating rate: steady; +1% from year 2 for good; +2% from year 2; -1% from year 2. Rate changes keep the end date and change the EMI, so the comparison is like for like. */
const P = 5000000, n = 240, fl = 7.75, fx = 9.25;
const run = (rate, ev) => EMI.simulate({ bal: P, rate, n, start: 0, events: ev || [], effect: "tenure", extra: 0 });
const fix = run(fx), sc = { steady: run(fl), up1: run(fl, [{ kind: "rate", at: 24, rate: fl + 1, effect: "emi" }]), up2: run(fl, [{ kind: "rate", at: 24, rate: fl + 2, effect: "emi" }]), down1: run(fl, [{ kind: "rate", at: 24, rate: fl - 1, effect: "emi" }]) };
const pk = x => ({ emi: x.emi0, int: x.totInt, months: x.months, emiLast: x.emiLast });
out.ff = { P, fl, fx, fixed: pk(fix), steady: pk(sc.steady), up1: pk(sc.up1), up2: pk(sc.up2), down1: pk(sc.down1) };
/* Break-even: how big a lasting rise (from year 2) makes floating cost as much as fixed */
let lo = 0, hi = 4; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, x = run(fl, [{ kind: "rate", at: 24, rate: fl + m, effect: "emi" }]); if (x.totInt < fix.totInt) lo = m; else hi = m; }
out.ff.breakEven = lo;
console.log(JSON.stringify(out));
