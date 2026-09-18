const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '..', '.env.feedback-pilot.server.local'), 'utf8');
const url = env.match(/SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SECRET_KEY=(.*)/)[1].trim();
const { normalizeSamsungModelFamily, normalizeCapacity, validatePromotionTarget } = require('../assets/js/promotion-calculator.js');

async function test() {
  const cRes = await fetch(url + '/rest/v1/promotion_offers?campaign_id=eq.07363cc4-49ed-436e-afea-6ddcfcfa1426&select=id,inventory_pn,model_name,capacity,promotion_type', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const offers = await cRes.json();
  
  const pns = [...new Set(offers.map(o => o.inventory_pn))];
  const sRes = await fetch(url + '/rest/v1/stock_snapshot_items?batch_id=eq.9ea77b41-ae5a-46d6-8340-75b0762c3a1f&inventory_pn=in.(' + pns.join(',') + ')&select=inventory_pn,description,category,cat1', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const stockItems = await sRes.json();
  const stockMap = new Map(stockItems.map(s => [s.inventory_pn, s]));

  console.log('--- EVALUATION OF CAMPAIGN 07363cc4-49ed-436e-afea-6ddcfcfa1426 ---');
  let modelMismatches = 0;
  offers.forEach(o => {
    const stock = stockMap.get(o.inventory_pn);
    const res = validatePromotionTarget(o, stock);
    console.log(`Offer: ${o.model_name} ${o.capacity} | PN: ${o.inventory_pn}`);
    console.log(`Stock: ${stock?.description || 'NOT FOUND'}`);
    console.log(`Result: ${res.code} (Allowed: ${res.allowed})`);
    if (!res.allowed) modelMismatches++;
    console.log('----------------------------------------------------');
  });
  console.log(`Total offers: ${offers.length}, Mismatches: ${modelMismatches}`);
}

test();
