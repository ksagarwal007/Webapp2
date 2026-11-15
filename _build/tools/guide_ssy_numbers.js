/* Numbers for the Sukanya Samriddhi guide, from the calculator's own code (ssy.js). Usage: node tools/guide_ssy_numbers.js -> JSON */
const S = require("../src/assets/js/ssy.js");
const B = { age: 2, yearly: 150000, when: "april", rate: 8.2, ppfRate: 7.1, edu: 0, regime: "old", slab: 20 };
const p = r => ({ mat: r.s.maturity, dep: r.s.deposits, int: r.s.interest, wd: r.s.withdrawn, ppf15: r.ppf15.maturity, ppf21: r.ppf21.maturity, age: r.maturityAge, depEnd: r.depEnd, saved: r.taxSavedYear });
const out = { B, base: p(S.calc(B)), monthly: p(S.calc({ ...B, when: "monthly" })), edu: p(S.calc({ ...B, edu: 50 })), r75: p(S.calc({ ...B, rate: 7.5 })),
  at0: p(S.calc({ ...B, age: 0 })), at9: p(S.calc({ ...B, age: 9 })), small: p(S.calc({ ...B, yearly: 12000 })), smallM: p(S.calc({ ...B, yearly: 12000, when: "monthly" })) };
console.log(JSON.stringify(out));
