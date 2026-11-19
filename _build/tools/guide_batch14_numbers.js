/* Numbers for four guides (19 Nov, batch 14): EPS family pension, budgeting a bonus, prepay a bonus, laddering term cover.
   Usage: node tools/guide_batch14_numbers.js -> JSON */
const NPS = require("../src/assets/js/nps.js"), P = require("../src/assets/js/prepay.js"), T = require("../src/assets/js/term.js");
const out = {};
/* 1. EPS family pension (EPS 2026, para 15). Member dies in service in 2028 at 45 after 20 years: 8 years before Sep 2014 (₹6,500), 12 to Sep 2026 (₹15,000), 2 after (₹25,000).
   Widow pension = pension the member would have got on retiring that day (formula on service so far), min ₹1,000. Children 25% each (two, to 25). Orphans 75% each. */
const mem = 6500 * 8 / 70 + 15000 * 12 / 70 + 25000 * 2 / 70;
out.fam = { member: mem, widow: Math.max(1000, mem), child: Math.max(250, mem * 0.25), orphan: Math.max(750, mem * 0.75) };
out.fam.family = out.fam.widow + 2 * out.fam.child;
/* Pensioner dies: member drawing ₹10,086 (the EPS main guide's Ravi) → spouse 50% */
out.fam.pensioner = 10086; out.fam.spouseAfter = Math.max(1000, 10086 * 0.5);
/* 2. Budgeting a bonus: ₹18 lakh fixed pay + ₹3 lakh bonus, new regime */
const tN = x => NPS.newTax(Math.max(0, x));
out.bonus = { fixed: 1800000, bonus: 300000, taxBonus: tN(2100000 - 75000) - tN(1800000 - 75000) };
out.bonus.net = out.bonus.bonus - out.bonus.taxBonus; out.bonus.rate = out.bonus.taxBonus / out.bonus.bonus * 100;
out.bonus.split = { goals: out.bonus.net * 0.5, invest: out.bonus.net * 0.3, enjoy: out.bonus.net * 0.2 };
/* 3. Prepay a bonus or invest it: Rohan's loan from the prepay guide (₹40 lakh, 8.5%, 15 years) */
const R = { P: 4000000, rate: 8.5, years: 15, extra: 0, lump: 300000, ret: 12, kind: "equity", regime: "new", slab: 30, claim: true };
const run = o => { const s = P.simulate(o), b = P.breakeven(o); return { diff: s.diff, prepay: s.prepay.final, invest: s.invest.final, saved: s.invest.interest - s.prepay.interest, monthsCut: s.N - s.prepay.payoff, be: b.kind === "rate" ? b.rate : b.kind }; };
out.prepay = { once: run(R), onceFd: run({ ...R, kind: "fd", ret: 7 }), yearly: run({ ...R, lump: 0, extra: 25000 }), yearlyFd: run({ ...R, lump: 0, extra: 25000, kind: "fd", ret: 7 }) };
/* 4. Laddering: the term calculator's default family (age 32) */
const TB = { age: 32, years: 28, expenses: 50000, spouse: 0, infl: 6, ret: 7, edu: 2000000, eduIn: 15, wed: 1000000, wedIn: 23, goalInfl: 8, loans: 4000000, loanYears: 18, buffer: true, savings: 500000, cover: 0, income: 1500000 };
const t = T.calc(TB), path = t.path, endAge = t.until;
const single = { cover: t.rounded, years: endAge - TB.age };
/* Ladder split at age X: policy A covers the highest need from X to the end, to the end; policy B covers the rest of the peak until X */
function ladder(X) { const after = path.filter(p => p.age >= X).reduce((m, p) => Math.max(m, p.cover), 0); const A = T.round(after), B = Math.max(0, T.round(t.peak) - A);
  return { X, A, B, cy: A * (endAge - TB.age) + B * (X - TB.age) }; }
const L = [45, 48, 50, 55].map(ladder);
out.ladder = { single, singleCy: single.cover * single.years, options: L, needAt: [32, 40, 45, 47, 50, 55, 59].map(a => ({ age: a, cover: (path.find(p => p.age === a) || {}).cover })) };
console.log(JSON.stringify(out));
