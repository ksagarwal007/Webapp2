/* Numbers for "Already investing? How to check if your SIPs are on track", from the SIP calculator's own code.
   Karan's plan (made 3 years ago): ₹1 crore in 15 years, 12% a year, SIP stepped up 10% a year. Usage: node tools/guide_sip_track_numbers.js -> JSON */
const S = require("../src/assets/js/sip.js");
const base = { start: 0, startCost: 0, sip: 0, step: 10, years: 15, ret: 12, kind: "equity", slab: 30, infl: 6 };
const GOAL = 10000000;
const planSip = Math.ceil(S.sipFor(base, GOAL) / 100) * 100;                       /* the SIP he started with, rounded up to ₹100 */
const plan3 = S.simulate(Object.assign({}, base, { sip: planSip, years: 3 }));      /* where the plan expected him to be after 3 years */
const sipNow = planSip * Math.pow(1.1, 3);                                          /* his SIP from year 4, after three step-ups */
const check = (value, cost) => {
  const o = Object.assign({}, base, { start: value, startCost: cost, years: 12 });
  const keep = S.simulate(Object.assign({}, o, { sip: sipNow }));                  /* carry on as planned */
  const need = S.sipFor(o, GOAL);                                                   /* the SIP needed from now, still stepping up 10% */
  const extra = Math.max(0, need - sipNow);
  const yrs13 = S.simulate(Object.assign({}, o, { sip: sipNow, years: 13 }));       /* or wait one more year */
  const step15 = S.sipFor(Object.assign({}, o, { step: 15 }), GOAL);                /* or step up faster */
  return { value, cost, keep: keep.value, need, extra, yrs13: yrs13.value, step15 };
};
const invested = plan3.invested;
const out = { GOAL, planSip, sipNow, plan3: plan3.value, invested,
  behind: check(Math.round(invested * 0.88 / 1000) * 1000, invested),               /* markets fell: portfolio 12% below what he put in */
  onTrack: check(Math.round(plan3.value / 1000) * 1000, invested),
  ahead: check(Math.round(invested * 1.30 / 1000) * 1000, invested) };
process.stdout.write(JSON.stringify(out));
