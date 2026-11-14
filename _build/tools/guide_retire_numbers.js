/* Numbers for the retirement planner guides, from the planner's own code (retirement.js, which uses epf.js and nps.js).
   Usage: node tools/guide_retire_numbers.js -> JSON */
const R = require("../src/assets/js/retirement.js");
const B = { age: 35, retireAge: 60, lifeTo: 85, spend: 60000, infl: 6, retRet: 7, epfBal: 600000, wage: 50000, hike: 6, epfRate: 8.25, eps: true, epsYears: 8,
  npsBal: 0, npsMonthly: 0, npsRet: 10, mfBal: 800000, sip: 10000, step: 5, mfRet: 11, fdBal: 300000, fdRet: 7, other: 0 };
const pick = p => ({ need: p.need, needReal: p.needReal, have: p.have, gap: p.gap, sip: p.extraSip, runsOut: p.runsOut, spendAt: p.spendAt, epf: p.epf, mf: p.mf, fd: p.fd, eps: p.epsM, nps: p.nps, npsLump: p.npsLump, npsPen: p.npsPen });
const out = { B, base: pick(R.plan(B)), late62: pick(R.plan({ ...B, retireAge: 62 })), ret6: pick(R.plan({ ...B, retRet: 6, mfRet: 10, fdRet: 6 })),
  infl7: pick(R.plan({ ...B, infl: 7 })), to90: pick(R.plan({ ...B, lifeTo: 90 })), spend50: pick(R.plan({ ...B, spend: 50000 })),
  nps: pick(R.plan({ ...B, npsMonthly: 5000 })) };
const p = R.plan(B); out.withSip = pick(R.plan({ ...B, extra: p.extraSip }));
/* 25x rule: what you need at retirement, as a multiple of the first year's spending, by years in retirement and return after retiring (6% inflation, no pensions). */
function multiple(years, ret, infl) { let s = 0; for (let k = 0; k < years; k++) s += Math.pow((1 + infl / 100) / (1 + ret / 100), k); return s; }
out.mult = {}; [25, 30, 35].forEach(y => { out.mult[y] = {}; [6, 7, 8, 9].forEach(r => { out.mult[y][r] = multiple(y, r, 6); }); });
/* 25x example: ₹50,000 a month today, retiring in 25 years at 6% inflation */
const sp = 50000 * Math.pow(1.06, 25) * 12; out.x25 = { firstYear: sp, rule: sp * 25, need25: sp * multiple(25, 7, 6), need30: sp * multiple(30, 7, 6), need35: sp * multiple(35, 7, 6) };
/* how long 25x lasts at each return */
function lasts(ret, infl) { let pot = 25, w = 1; for (let k = 0; k < 80; k++) { pot -= w; if (pot < 0) return k; pot *= 1 + ret / 100; w *= 1 + infl / 100; } return 80; }
out.lasts = {}; [6, 7, 8, 9].forEach(r => { out.lasts[r] = lasts(r, 6); });
/* PF withdrawn at a job change: what it would have grown to by 58 at 8.25% */
out.pfGrow = { at28: 300000 * Math.pow(1.0825, 30), at32: 300000 * Math.pow(1.0825, 26) };
console.log(JSON.stringify(out));
