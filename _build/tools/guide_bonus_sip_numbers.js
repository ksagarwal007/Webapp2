/* Numbers for "SIP or lump sum: what to do with your bonus", from the SIP calculator's own code (sip.js simulate).
   Usage: node tools/guide_bonus_sip_numbers.js -> JSON */
const S = require("../src/assets/js/sip.js");
const base = { start: 0, startCost: 0, sip: 0, step: 0, years: 10, ret: 12, kind: "equity", slab: 30, infl: 6 };
const bonus = 200000;
const lump = S.simulate(Object.assign({}, base, { start: bonus, startCost: bonus }));
const spread12 = S.simulate(Object.assign({}, base, { sip: bonus / 12, years: 1 }));
const spreadValue = spread12.value * Math.pow(1.12, 9);
const spread6 = S.simulate(Object.assign({}, base, { sip: bonus / 6, years: 0.5 }));
const spread6Value = spread6.value * Math.pow(1.12, 9.5);
/* Illustration (not the calculator): markets fall 20% over six months, then recover to end the year 12% up. */
const down = Math.pow(0.8, 1 / 6), up = Math.pow(1.12 / 0.8, 1 / 6), path = [];
for (let m = 0; m < 6; m++) path.push(down); for (let m = 0; m < 6; m++) path.push(up);
let units = 0, nav = 1; const lumpUnits = bonus / nav;
for (let m = 0; m < 12; m++) { units += bonus / 12 / nav; nav *= path[m]; }
const dipLumpY1 = lumpUnits * nav, dipSipY1 = units * nav;
/* And the other way: markets rise 25% in the first six months, then give some back to end 12% up. */
const up2 = Math.pow(1.25, 1 / 6), dn2 = Math.pow(1.12 / 1.25, 1 / 6); let u2 = 0, nav2 = 1;
const path2 = []; for (let m = 0; m < 6; m++) path2.push(up2); for (let m = 0; m < 6; m++) path2.push(dn2);
for (let m = 0; m < 12; m++) { u2 += bonus / 12 / nav2; nav2 *= path2[m]; }
const out = { bonus, lump: lump.value, spread12: spreadValue, spread6: spread6Value, gap12: lump.value - spreadValue,
  dip: { lumpY1: dipLumpY1, sipY1: dipSipY1, lowest: Math.pow(0.8, 1) }, rise: { lumpY1: bonus * nav2, sipY1: u2 * nav2 },
  dip10: { lump: dipLumpY1 * Math.pow(1.12, 9), sip: dipSipY1 * Math.pow(1.12, 9) }, rise10: { lump: bonus * nav2 * Math.pow(1.12, 9), sip: u2 * nav2 * Math.pow(1.12, 9) } };
process.stdout.write(JSON.stringify(out));
