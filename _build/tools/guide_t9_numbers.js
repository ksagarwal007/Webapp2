/* Numbers for the T9 guides (back to office). One example throughout: Sneha, 29, software engineer in Bengaluru, take-home ₹1.1 lakh a month (20% slab),
   rents in Jayanagar for ₹30,000; office 20 km away, 70 minutes each way by car. Policy moves from 2 to 5 office days a week.
   Variations change one thing about her. Usage: node tools/guide_t9_numbers.js -> JSON */
const R = require("../src/assets/js/rto.js");
const base = { daysNow: 2, daysNew: 5, mode: "car", km: 20, mins: 70, mileage: 15, fuel: 111, wear: 3, park: 100, fare: 50, metroFare: 50, cabFare: 450, food: 150, wfhAllow: 0, other: 0,
  takehome: 110000, valueTime: 50, slab: 20, rentNow: 30000, rentNear: 42000, nearKm: 5, nearMins: 20, moveCost: 60000 };
const run = x => R.calc({ ...base, ...x });
const pick = r => ({ day: r.day, nowM: r.nowM, newM: r.newM, extraMoney: r.extraMoney, extraHours: r.extraHours, extraTime: r.extraTime, extraAll: r.extraAll, raise: r.raise, pct: r.pct, hourly: r.hourly, tv: r.tv,
  yearMoney: r.yearMoney, yearHours: r.yearHours, near: r.near, modes: r.modes, byDays: r.byDays });
const out = {};
out.main = pick(run({}));
/* modes: own figures; metro trip takes 55 min door to door, two-wheeler 50, cab same as car */
out.modeRuns = [["car", {}, 70], ["bike", { mode: "bike", mileage: 45, wear: 1, park: 20, mins: 50 }, 50], ["metro", { mode: "metro", fare: 50, mins: 55 }, 55], ["cab", { mode: "cab", fare: 450 }, 70]]
  .map(([k, x, m]) => { const r = run(x); return { mode: k, perDay: r.day.total, travel: r.day.travel, extra: r.extraMoney, newM: r.newM, hours: r.newH, extraHours: r.extraHours, mins: m }; });
/* metro + last-mile auto: fare ₹50 + auto ₹60 each way */
out.metroAuto = (() => { const r = run({ mode: "metro", fare: 110, mins: 60 }); return { perDay: r.day.total, extra: r.extraMoney, newM: r.newM }; })();
/* time values */
out.time = [0, 50, 100].map(v => { const r = run({ valueTime: v }); return { v, extraTime: r.extraTime, all: r.extraAll, tv: r.tv }; });
out.days = [3, 4, 5].map(d => ({ d, extra: run({ daysNew: d }).extraMoney, hours: run({ daysNew: d }).extraHours }));
/* raise needed by slab */
out.raise = [5, 20, 30].map(sl => ({ sl, raise: run({ slab: sl }).raise }));
/* move closer at different rents */
out.move = [36000, 42000, 48000].map(rn => { const r = run({ rentNear: rn }); return { rent: rn, diff: r.near.diff, net: r.near.net, payback: r.near.payback, saved: r.near.hoursSaved }; });
out.moveFull = (() => { const r = run({ valueTime: 100 }); return { net: r.near.net, payback: r.near.payback }; })();
out.moveNone = (() => { const r = run({ valueTime: 0 }); return { net: r.near.net }; })();
/* meal card: ₹200 a meal, one lunch a day on 22 days, or two meals */
const marg = 0.20 * 1.04;
out.meal = { one: 200 * 22 * 12, two: 200 * 2 * 22 * 12, saveOne: 200 * 22 * 12 * marg, saveTwo: 200 * 2 * 22 * 12 * marg, save30One: 200 * 22 * 12 * 0.312, save30Two: 200 * 2 * 22 * 12 * 0.312,
  officeDays: 5 * 46, oneOffice: 200 * 5 * 46, saveOneOffice: 200 * 5 * 46 * marg };
/* Employer support (one thing at a time): a free company cab (80 min each way), one she part-pays ₹1,500 a month for, a ₹3,000 travel allowance (taxable), lunch paid (₹150 a day) */
out.emp = {};
[["free", { ctype: "free", cmins: 80 }], ["paid", { ctype: "paid", cshare: 1500, cmins: 80 }], ["allow", { allow: 3000 }], ["meal", { mealPaid: 150 }]].forEach(([k, x]) => {
  const r = run(x); out.emp[k] = { extra: r.extraMoney, newM: r.newM, hours: r.extraHours, raise: r.raise, allowNet: r.allowNet, nearDiff: r.near.diff, nearNet: r.near.net }; });
console.log(JSON.stringify(out));
