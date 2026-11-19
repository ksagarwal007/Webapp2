/* Numbers for five guides (17 Nov, batch 12): two daughters, reviving Sukanya, first salary budget, home loan insurance, three buckets.
   Usage: node tools/guide_batch12_numbers.js -> JSON */
const SSY = require("../src/assets/js/ssy.js"), EMI = require("../src/assets/js/emi.js");
const out = {};
const ss = (age, yearly) => SSY.calc({ age, yearly, when: "april", rate: 8.2, ppfRate: 7.1, edu: 0, regime: "new", slab: 30 }).s;
/* 1. Two daughters, aged 1 and 5. ₹1.5 lakh each a year (₹3 lakh) vs ₹75,000 each (₹1.5 lakh in all). */
const a1 = ss(1, 150000), a5 = ss(5, 150000), h1 = ss(1, 75000), h5 = ss(5, 75000);
out.two = { y1: { full: a1.maturity, half: h1.maturity, at: 22 }, y5: { full: a5.maturity, half: h5.maturity, at: 26 }, taxOld30: 150000 * 0.312 };
/* 2. Reviving: opened at birth, ₹50,000 a year by 5 April, 8.2%. Misses years 4, 5 and 6, revives in year 7 paying ₹250 + ₹50 for each. */
function sim(deps) { let b = 0; for (let y = 0; y < 21; y++) { b = (b + (y < 15 ? deps[y] : 0)) * 1.082; } return b; }
const full = Array(15).fill(50000), gap = full.slice(); gap[3] = gap[4] = gap[5] = 0; const rev = gap.slice(); rev[6] += 3 * 250;
out.revive = { full: sim(full), gap: sim(gap), revived: sim(rev), penalty: 3 * 50, minDeps: 3 * 250, check: ss(0, 50000).maturity, catchUp: sim(full.map((d, i) => i === 6 ? 150000 : (i >= 3 && i <= 5 ? 0 : d))) };
/* 3. First salary: ₹40,000 take-home */
const pay = 40000; out.first = { pay, needs: pay * 0.5, wants: pay * 0.3, save: pay * 0.2, ef3: pay * 0.5 * 3 };
/* 4. Home loan insurance: ₹1.5 lakh single premium added to a ₹50 lakh loan, 20 years at 7.75% */
const e = EMI.emiOf(150000, 7.75, 240); out.hli = { prem: 150000, emi: e, paid: e * 240, interest: e * 240 - 150000, bal5: (() => { let b = 5000000, em = EMI.emiOf(5000000, 7.75, 240); const r = []; for (let m = 1; m <= 240; m++) { b = b * (1 + 7.75 / 1200) - em; if (m % 60 === 0) r.push(Math.max(0, b)); } return r; })() };
/* 5. Three buckets: ₹2 crore at 60, spending ₹80,000 a month (₹9.6 lakh a year, 4.8%), rising 6% a year.
   Bucket 1: 2 years' spending in FDs/liquid (6%); bucket 2: next 8 years in debt/hybrid (7.5%); bucket 3: the rest in equity (11%).
   Each year: spend from bucket 1, refill it from bucket 2, refill bucket 2 from bucket 3 (only if equity is above where it started that year). */
let B2Y = 5; let SP0 = 720000;
function buckets(eqPath) {
  const sp0 = SP0; let sp = sp0, b1 = 2 * sp0 * 1.03, b2 = 0, b3 = 0; { let s = 0, x = sp0 * 1.06 * 1.06; for (let i = 0; i < B2Y; i++) { s += x; x *= 1.06; } b2 = s; } b3 = 20000000 - b1 - b2;
  const init = { b1, b2, b3 }; let soldInFall = 0;
  for (let y = 0; y < 60; y++) {
    if (b1 + b2 + b3 < sp) return { lasts: y, init, soldInFall };
    b1 -= sp; if (b1 < 0) { b2 += b1; b1 = 0; } if (b2 < 0) { b3 += b2; b2 = 0; }
    const er = eqPath(y); const b3s = b3; b1 *= 1.06; b2 *= 1.075; b3 *= 1 + er;
    sp *= 1.06;
    const need1 = 2 * sp - b1; if (need1 > 0) { const t = Math.min(need1, b2); b2 -= t; b1 += t; }
    const need2 = B2Y * sp - b2; if (need2 > 0 && er >= 0) { const t = Math.min(need2, b3); b3 -= t; b2 += t; } else if (need2 > 0 && b2 < sp) { const t = Math.min(need2, b3); b3 -= t; b2 += t; soldInFall += t; }
  }
  return { lasts: 60, init, soldInFall };
}
function single(rate, path) { let p = 20000000, sp = SP0; for (let y = 0; y < 60; y++) { if (p < sp) return y; p -= sp; p *= 1 + (path ? path(y) : rate); sp *= 1.06; } return 60; }
const steady = () => 0.11, crash = y => (y === 0 ? -0.30 : y === 1 ? -0.10 : 0.11);
/* All in equity, with a crash: */
out.bk = { steady: buckets(steady), crash: buckets(crash), allDebt: single(0.07), allEqCrash: single(0, crash), allEq: single(0.11) };
console.log(JSON.stringify(out));
