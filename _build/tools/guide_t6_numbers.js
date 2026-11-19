/* Numbers for the T6 guides (did your hike beat inflation?). One example throughout: Meghna, 29, ₹12 lakh a year before her hike,
   ₹12.84 lakh (7%) from April 2026, last hike April 2025; ₹6 lakh a year in 2019-20, her first job. Usage: node tools/guide_t6_numbers.js -> JSON */
const H = require("../src/assets/js/hike.js");
const base = { before: 1200000, after: 1284000, start: "2026-04", gap: 12, since: "2019-20", startPay: 600000, personal: null };
const SP = { rent: 25000, school: 8000, food: 15000, transport: 6000, health: 2000, emi: 20000, other: 14000 };
const ORDER = ["rent", "school", "food", "transport", "health", "emi", "other"];
const rows = (amt, rise) => ORDER.map(k => ({ amt: amt[k], rise: rise[k] }));
const cpiRise = { ...H.DIV };
const out = {};
const r = H.calc(base); out.main = r;
out.hikes = [3, 5, 7, 10, 12, 15].map(h => { const x = H.calc({ ...base, after: base.before * (1 + h / 100) }); return { h, real: x.real, left: x.left, realTax: x.realTax }; });
out.at6 = (1.07 / (1 + H.LATEST_YOY / 100) - 1);
/* Your own prices */
out.spend = SP;
out.own = H.calc({ ...base, personal: rows(SP, cpiRise) }).pers;
out.ownRenter = H.calc({ ...base, personal: rows(SP, { ...cpiRise, rent: 10, school: 10 }) }).pers;
const owner = { ...SP, rent: 0, emi: 45000 };
out.ownOwner = H.calc({ ...base, personal: rows(owner, cpiRise) }).pers; out.owner = owner;
out.div = cpiRise;
/* Tax: the same 7% at other pay levels */
out.tax = [800000, 1200000, 2000000, 3000000].map(p => { const a = p * 1.07, tb = p - H.tax(p), ta = a - H.tax(a); return { p, a, taxB: H.tax(p), taxA: H.tax(a), tb, ta, hikeTax: ta / tb - 1, realTax: (ta / tb) / (1 + r.infl) - 1 }; });
/* Ask: next April */
out.ask = { keep: r.needNext, real3: (1 + r.needNext) * 1.03 - 1, real5: (1 + r.needNext) * 1.05 - 1, lateCost: (base.after - base.before) / 12 * 3 };
const july = H.calc({ ...base, start: "2026-07", gap: 15 }); out.july = { infl: july.infl, real: july.real };
/* Long view */
out.long = r.long; out.fy = H.FY;
out.slow = H.calc({ ...base, startPay: 1284000 / Math.pow(1.05, 7) }).long;
console.log(JSON.stringify(out));
