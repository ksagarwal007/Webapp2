/* Numbers for five guides (15 Nov, batch 8): EPF withdrawals, EPS higher pension, FD for senior citizens.
   Usage: node tools/guide_batch8_numbers.js -> JSON */
const EPS = require("../src/assets/js/eps.js"), NPS = require("../src/assets/js/nps.js"), D = require("../src/assets/js/deposits.js");
const out = {};
/* 1. EPF withdrawals: Asha, 30, ₹6 lakh balance. 25% minimum balance; cost of taking ₹3 lakh out now, at 8.25% to 58 */
const bal = 600000, r = 0.0825;
out.epf = { bal, min: bal * 0.25, eligible: bal * 0.75, take: 300000, lost58: 300000 * Math.pow(1 + r, 28), lost58all: bal * 0.75 * Math.pow(1 + r, 28) };
/* 2. EPS higher pension: Suresh joined Sep 2004, PF wages ₹20,000 in 2004 rising 7% a year; retires at 58 in Sep 2032 (28 years of service).
   Standard: ₹6,500 to Aug 2014, ₹15,000 to 16 Sep 2026, ₹25,000 after (pro rata, eps.js).
   Higher (pro rata, EPFO method under para 12 of EPS 2026): service to 31 Aug 2014 on the average actual wage of the 60 months before 1 Sep 2014; service after on the average of the last 60 months. */
const w0 = 20000, g = 0.07, wageAt = m => w0 * Math.pow(1 + g, Math.floor(m / 12));   /* m = months since Sep 2004 */
const avg = (a, b) => { let s = 0; for (let m = a; m < b; m++) s += wageAt(m); return s / (b - a); };
const M14 = 120, M26 = 264, END = 336;   /* Sep 2014, Sep 2026, Sep 2032 */
const avgPre = avg(M14 - 60, M14), avgLast = avg(END - 60, END);
const std = EPS.calc({ p1: 10, p2: 12, p3: 6, wage: avgLast, higher: false, start: 58 });
const hi = { pre: avgPre * 10 / 70, post: avgLast * (18 + 2) / 70 }; hi.total = hi.pre + hi.post;
/* Cost: extra going to EPS instead of EPF. Before Sep 2014: 8.33% on wages above ₹6,500; after: 9.49% (8.33% + 1.16%) on wages above ₹15,000 (₹25,000 from Sep 2026). Grows at 8.25% to Sep 2032. */
let lost = 0; for (let m = 0; m < END; m++) { const w = wageAt(m), c = m < M14 ? 0.0833 * Math.max(0, w - 6500) : 0.0949 * Math.max(0, w - (m < M26 ? 15000 : 25000)); lost = lost * (1 + r / 12) + c; }
const extraPen = hi.total - std.monthly;
/* Years until the extra pension adds up to the EPF given up (no interest), and with the EPF invested at 7% instead */
let yrs = lost / (extraPen * 12), pot = lost, y7 = 0; while (pot > 0 && y7 < 60) { pot = pot * 1.07 - extraPen * 12; y7++; }
out.eps = { avgPre, avgLast, wageEnd: wageAt(END - 1), std: std.monthly, hiPre: hi.pre, hiPost: hi.post, hi: hi.total, extra: extraPen, lost, payback: yrs, payback7: y7 };
/* 3. FD for senior citizens: two cases, tax in each regime. Old regime for 60-79: nil to ₹3 lakh, 5% to ₹5 lakh, 20% to ₹10 lakh, 30% above; rebate up to ₹12,500 if income ≤ ₹5 lakh; 4% cess. */
function oldSenior(inc) { let t = 0; if (inc > 300000) t += (Math.min(inc, 500000) - 300000) * 0.05; if (inc > 500000) t += (Math.min(inc, 1000000) - 500000) * 0.2; if (inc > 1000000) t += (inc - 1000000) * 0.3; if (inc <= 500000) t = Math.max(0, t - 12500); return t * 1.04; }
function cases(pension, fd, rate) {
  const int = fd * rate / 100, newInc = Math.max(0, pension - 75000) + int, oldInc = Math.max(0, pension - 50000) + int - Math.min(50000, int);
  return { pension, fd, rate, int, tds: int > 100000 ? int * 0.1 : 0, newInc, oldInc, newTax: NPS.newTax(newInc), oldTax: oldSenior(oldInc) };
}
out.sr = { a: cases(400000, 2500000, 7.5), b: cases(900000, 4000000, 7.5), c: cases(1500000, 6000000, 7.5) };
/* TDS threshold: how much FD at one bank before TDS starts, at 7.5% */
out.sr.fdLimitSenior = 100000 / 0.075; out.sr.fdLimitOther = 50000 / 0.075;
console.log(JSON.stringify(out));
