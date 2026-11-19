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
/* Indicative premiums (healthy non-smoking man, level annual premium, regular pay). Built from published ratios, not a quote:
   - ₹1 Cr to 60: ICICI Pru iProtect Smart Plus via Ditto (age 30 ₹12,683, age 35 ₹16,382), straight line to age 32
   - policy end age: Axis Max Life Smart Term Plan Plus via Ditto (to 65 +15.8%, to 70 +27.9%, to 75 +44.3% over 60);
     to 50 costs 1/1.4 of to 60 (Tata AIA: to 60 about 40% more than to 50); 48 and 55 on the straight line through 50 and 60
   - cover size: HDFC Life Click 2 Protect Supreme via Ditto, age 32 (₹50 L 13,595, ₹1 Cr 20,950, ₹2 Cr 36,359, ₹3 Cr 51,482), straight lines between */
const base60 = 12683 + (16382 - 12683) * (TB.age - 30) / 5;
const END = { 48: 1 / 1.4 - 2 * (1 - 1 / 1.4) / 10, 50: 1 / 1.4, 55: (1 / 1.4 + 1) / 2, 60: 1, 65: 1.158, 70: 1.279, 75: 1.443 };
const SZ = [[0.5, 13595], [1, 20950], [2, 36359], [3, 51482]];
function size(cr) { for (let i = 0; i < SZ.length - 1; i++) { const [a, pa] = SZ[i], [b, pb] = SZ[i + 1]; if (cr <= b || i === SZ.length - 2) return (pa + (pb - pa) * (cr - a) / (b - a)) / 20950; } }
const prem = (cover, end) => Math.round(base60 * END[end] * size(cover / 1e7) / 10) * 10;
function plan(name, pols) {
  let total = 0, pv = 0; const yr1 = pols.reduce((s, p) => s + prem(p.cover, p.end), 0);
  for (let a = TB.age; a < 75; a++) { const y = pols.filter(p => a < p.end).reduce((s, p) => s + prem(p.cover, p.end), 0); total += y; pv += y / Math.pow(1 + TB.ret / 100, a - TB.age); }
  const gap = path.filter(p => p.age >= TB.age && p.age < endAge).reduce((m, p) => { const c = pols.filter(q => p.age < q.end).reduce((s, q) => s + q.cover, 0); return Math.max(m, p.cover - c); }, 0);
  const gapAt = path.filter(p => p.age >= TB.age && p.age < endAge).map(p => ({ age: p.age, short: p.cover - pols.filter(q => p.age < q.end).reduce((s, q) => s + q.cover, 0) })).filter(x => x.short > 0);
  return { name, pols: pols.map(p => ({ ...p, prem: prem(p.cover, p.end) })), yr1, total, pv, gap: Math.max(0, gap), gapFrom: gapAt.length ? gapAt[0].age : null };
}
const O = Object.fromEntries(L.map(o => [o.X, o])), b50 = O[50];
out.ladder.prem = {
  base60, single: plan("single", [{ cover: single.cover, end: 60 }]),
  splits: [48, 50, 55].map(x => plan("split" + x, [{ cover: O[x].A, end: 60 }, { cover: O[x].B, end: x }])),
  flipped: plan("flipped", [{ cover: b50.A, end: 50 }, { cover: b50.B, end: 60 }]),
  flipped70: plan("flipped70", [{ cover: b50.A, end: 50 }, { cover: b50.B, end: 70 }]),
  single70: plan("single70", [{ cover: single.cover, end: 70 }]),
  split50to70: plan("split50to70", [{ cover: b50.A, end: 70 }, { cover: b50.B, end: 50 }])
};
console.log(JSON.stringify(out));
