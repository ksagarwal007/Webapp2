/* Numbers for the batch T3 guides (FIRE calculator), from the tool's own code. Usage: node tools/guide_t3_numbers.js -> JSON */
const F = require("../src/assets/js/fire.js"), SWP = require("../src/assets/js/swp.js");
const base = { age: 30, spend: 60000, infl: 6, save: 50000, step: 7, liquid: 1500000, preRet: 11, postRet: 8, epf: 600000, epfM: 12000, epfRate: 8.25,
  nps: 200000, npsM: 5000, npsRet: 10, planTo: 85, epfMode: "58", target: 42 };
const pick = r => ({ fi: r.fi && r.fi.age, number: r.number, numberToday: r.numberToday, multiple: r.multiple, needL: r.needL, L: r.fi && r.fi.st.L, E: r.fi && r.fi.st.E, N: r.fi && r.fi.st.N,
  lean: r.lean && r.lean.age, fat: r.fat && r.fat.age, rate: r.rate, extra: r.extra, coast: r.coast, coasted: r.coasted, endL: r.endL,
  spend: r.p && r.p.spend, epfOut: r.p && r.p.epfOut, npsLump: r.p && r.p.npsLump, pension: r.p && r.p.pension });
const out = { base, main: pick(F.calc(base)) };
/* What you'd need at each stopping age: pot outside EPF/NPS, EPF, NPS (balances as they'd be with this saving) */
const rows = F.accumulate(base, 0);
out.byAge = [40, 45, 50, 55, 60].map(A => { const st = rows[A - base.age], p = F.after(base, A, st, 1);
  const needL = SWP.needed({ withdraw: p.spend, step: base.infl, ret: base.postRet, months: p.months, flow: p.flow });
  return { A, needL, E: st.E, N: st.N, total: needL + st.E + st.N, spendYear: p.spend * 12, liquidShare: needL / (needL + st.E + st.N), have: st.L }; });
/* Multiples of a year's spending needed, with no EPF/NPS: by years to fund and return after FI (6% inflation) */
out.mult = [7, 8, 9].map(ret => ({ ret, m: [30, 35, 40, 45, 50].map(Y => SWP.needed({ withdraw: 1 / 12, step: 6, ret, months: Y * 12 })) }));
/* Lean / regular / Fat numbers at their own FI ages */
out.types = [0.7, 1, 1.5].map(mult => { let A = null, st;
  for (const r of rows) { if (r.age >= base.planTo) break; const p = F.after(base, r.age, r, mult);
    if (SWP.run({ corpus: r.L, withdraw: p.spend, step: base.infl, ret: base.postRet, months: p.months, flow: p.flow }).ok) { A = r.age; st = r; break; } }
  const p = F.after(base, A, st, mult), needL = SWP.needed({ withdraw: p.spend, step: base.infl, ret: base.postRet, months: p.months, flow: p.flow });
  return { mult, A, number: needL + st.E + st.N, today: (needL + st.E + st.N) / Math.pow(1.06, A - base.age), spendNow: base.spend * mult }; });
/* Coast FIRE: first age at which what's invested outside EPF/NPS covers the coast number for that age */
out.coastAge = null;
for (const r of rows) { if (r.age >= 60) break; const k = 60 - r.age, st60 = { E: r.E * Math.pow(1.0825, k), N: r.N * Math.pow(1.10, k) };
  const p = F.after(base, 60, st60, 1), need = SWP.needed({ withdraw: p.spend, step: base.infl, ret: base.postRet, months: p.months, flow: p.flow }) / Math.pow(1.11, k);
  if (r.L >= need) { out.coastAge = { age: r.age, need, have: r.L }; break; } }
/* Savings rate: take-home ₹1.1 lakh a month split between spending and saving */
out.rates = [0.2, 0.3, 0.4, 0.5, 0.6].map(rate => { const r = F.calc({ ...base, spend: 110000 * (1 - rate), save: 110000 * rate });
  return { rate, spend: 110000 * (1 - rate), save: 110000 * rate, fi: r.fi && r.fi.age, number: r.number }; });
/* EPF: keep to 58 vs take a year after stopping */
out.early = pick(F.calc({ ...base, epfMode: "early" }));
out.noEpfNps = pick(F.calc({ ...base, epf: 0, epfM: 0, nps: 0, npsM: 0, save: base.save + 17000 }));
console.log(JSON.stringify(out));
