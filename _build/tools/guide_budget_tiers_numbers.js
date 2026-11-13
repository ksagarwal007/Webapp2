/* Three example budgets (₹50,000, ₹1 lakh, ₹2 lakh a month in hand) run through the Budget Planner engine,
   for the short article "Budgeting on ₹50,000, ₹1 lakh or ₹2 lakh a month".
   Usage: node tools/guide_budget_tiers_numbers.js  ->  JSON on stdout */
const B = require("../src/assets/js/budget.js");
const L = (sec, name, freq, amt, type, x) => Object.assign({ sec, name, freq, amt, type: type || "need" }, x || {});
const T = {
  "50k": { who: "Rohan", ef: 60000, lines: [
    L("Income", "In-hand salary", "m", 50000, "need", { salary: true }),
    L("Home", "Rent (his share of a 2BHK)", "m", 11000), L("Home", "Electricity", "m", 800), L("Home", "Internet and mobile", "m", 700), L("Home", "Cook (his share)", "m", 2000),
    L("Family", "Groceries", "m", 4000), L("Family", "Support for parents", "m", 4000), L("Family", "Medicines and doctor visits", "m", 500),
    L("Getting around", "Fuel", "m", 1500), L("Getting around", "Cabs, autos and metro", "m", 1200), L("Getting around", "Bike insurance and servicing", "y", 6000),
    L("EMIs and insurance", "Health insurance top-up", "y", 6000),
    L("Lifestyle", "Eating out and ordering in", "m", 3500, "want"), L("Lifestyle", "Shopping and clothes", "m", 2000, "want"), L("Lifestyle", "OTT and subscriptions", "m", 400, "want"), L("Lifestyle", "Gym and personal care", "m", 1200, "want"),
    L("Occasions", "Festivals and gifts", "y", 12000, "want"), L("Occasions", "Travel and holidays", "y", 24000, "want"),
    L("Savings", "SIPs and mutual funds", "m", 6000, "save"), L("Savings", "Emergency fund top-up", "m", 4000, "save") ] },
  "1L": { who: "Ananya and Vikram", ef: 150000, lines: [
    L("Income", "In-hand salary", "m", 100000, "need", { salary: true }),
    L("Home", "Rent", "m", 20000), L("Home", "Society maintenance", "m", 2500), L("Home", "Electricity", "m", 1800), L("Home", "Cooking gas", "m", 1000), L("Home", "Internet and mobile", "m", 1300), L("Home", "Domestic help", "m", 3000),
    L("Family", "Groceries", "m", 8000), L("Family", "Milk, bread and daily needs", "d", 80), L("Family", "Playschool fees", "y", 48000), L("Family", "Support for parents", "m", 3000), L("Family", "Medicines and doctor visits", "m", 1500),
    L("Getting around", "Fuel", "m", 3000), L("Getting around", "Cabs, autos and metro", "m", 1500), L("Getting around", "Car insurance and servicing", "y", 15000),
    L("EMIs and insurance", "Health insurance premium", "y", 22000), L("EMIs and insurance", "Term life insurance premium", "y", 18000),
    L("Lifestyle", "Eating out and ordering in", "m", 4000, "want"), L("Lifestyle", "Shopping and clothes", "m", 3000, "want"), L("Lifestyle", "OTT and subscriptions", "m", 600, "want"), L("Lifestyle", "Gym, hobbies and personal care", "m", 1500, "want"),
    L("Occasions", "Festivals and gifts", "y", 30000, "want"), L("Occasions", "Weddings and family functions", "y", 20000, "want"), L("Occasions", "Travel and holidays", "y", 50000, "want"),
    L("Savings", "SIPs and mutual funds", "m", 12000, "save"), L("Savings", "PPF", "m", 3000, "save"), L("Savings", "Emergency fund top-up", "m", 3000, "save") ] },
  "2L": { who: "the Iyers", ef: 500000, lines: [
    L("Income", "In-hand salary", "m", 200000, "need", { salary: true }),
    L("Home", "Home loan EMI", "m", 50000, "need", { emi: true }), L("Home", "Society maintenance", "m", 5000), L("Home", "Electricity", "m", 3500), L("Home", "Cooking gas", "m", 1200), L("Home", "Internet and mobile", "m", 2000), L("Home", "Domestic help", "m", 8000),
    L("Family", "Groceries", "m", 14000), L("Family", "Milk, bread and daily needs", "d", 150), L("Family", "School fees (two children)", "y", 180000), L("Family", "Support for parents", "m", 8000), L("Family", "Medicines and doctor visits", "m", 2500),
    L("Getting around", "Fuel", "m", 6000), L("Getting around", "Cabs, autos and metro", "m", 2000), L("Getting around", "Car insurance and servicing", "y", 30000),
    L("EMIs and insurance", "Health insurance premium", "y", 35000), L("EMIs and insurance", "Term life insurance premium", "y", 30000),
    L("Lifestyle", "Eating out and ordering in", "m", 6000, "want"), L("Lifestyle", "Shopping and clothes", "m", 4000, "want"), L("Lifestyle", "OTT and subscriptions", "m", 1000, "want"), L("Lifestyle", "Gym, hobbies and personal care", "m", 3000, "want"),
    L("Occasions", "Festivals and gifts", "y", 50000, "want"), L("Occasions", "Weddings and family functions", "y", 30000, "want"), L("Occasions", "Travel and holidays", "y", 100000, "want"), L("Occasions", "Gadgets and appliances", "y", 18000, "want"),
    L("Savings", "SIPs and mutual funds", "m", 25000, "save"), L("Savings", "PPF", "m", 5000, "save"), L("Savings", "NPS", "m", 5000, "save") ] }
};
const out = {};
for (const k in T) {
  const t = T[k], r = B.summarise({ lines: t.lines, ef: t.ef });
  out[k] = { who: t.who, ef: t.ef, r, efTarget: r.need * 6,
    lines: t.lines.map(l => ({ sec: l.sec, name: l.name, freq: l.freq, amt: l.amt, type: l.type, monthly: B.monthly(l) })) };
}
process.stdout.write(JSON.stringify(out));
