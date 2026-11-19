/* Numbers for the news guide on the EPF withdrawal changes approved by the CBT on 19 Nov 2026 (not yet notified).
   Same example as the EPF withdrawals guide: Asha, 30, ₹6 lakh in EPF; 8.25% a year (2025-26 rate). Usage: node tools/guide_epfnews_numbers.js -> JSON */
const bal = 600000, r = 0.0825, yrs = 28;
const out = { bal, now: { min: bal * 0.25, eligible: bal * 0.75 }, next: { min: bal * 0.10, eligible: bal * 0.90 } };
out.extra = out.next.eligible - out.now.eligible;
out.cost = { now: out.now.eligible * Math.pow(1 + r, yrs), next: out.next.eligible * Math.pow(1 + r, yrs), extra: out.extra * Math.pow(1 + r, yrs) };
/* If she leaves it until 58, with no further contributions */
const at58 = bal * Math.pow(1 + r, yrs); out.at58 = at58;
/* Illustrative SWP from EPF: monthly payouts, the rest earning 8.25% a year (compounded monthly as an approximation) */
const m = Math.pow(1 + r, 1 / 12) - 1;
const pay = n => at58 * m / (1 - Math.pow(1 + m, -n));
out.swp = { m20: pay(240), m25: pay(300), interestOnly: at58 * m };
function lasts(w) { let b = at58, k = 0; while (b > 0 && k < 1200) { b = b * (1 + m) - w; k++; } return k; }
out.swp.w40 = { w: 40000, months: lasts(40000) };
console.log(JSON.stringify(out));
