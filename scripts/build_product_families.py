#!/usr/bin/env python3
"""
Product Family Deduplication Engine
Samsung Branch Operations System - Ayutthaya City Park

Groups individual stock P/Ns into canonical Product Families:
1. Samsung Adapter Families (e.g. EP-T2510 Family, EP-T4511 Family)
2. Third-Party Charger Families (e.g. UGREEN GaN Fast Charger Family)
3. Screen / Lens Protector Families by Brand & Target Device (Focus TG FF, Hi-Shield 2.5D/3D)
4. Case Families by Target Device & Style (Flip8, Fold8, S26, A57, Clear/Silicone/Magnet)
5. Data Cable Families (C-to-C, A-to-C, 100W, 60W)

Generates reports/product_family_map.json containing:
- Family ID & Family Name
- Base Model / Target Device
- Product Type
- Shared Core Technical Attributes (Wattage, Ports, Form Factor, Material)
- Aggregated F1 and Total Inventory
- List of Variant P/Ns (Color, Length, Bundle options)
"""

import json
import os
import re
import sys
from datetime import datetime

sys.stdout.reconfigure(encoding="utf-8")

def extract_base_family_key(item):
    pn = item.get("pn", "").strip()
    brand = (item.get("brand") or "").strip().upper()
    cat = (item.get("category") or "").strip()
    c1 = (item.get("category1") or "").strip().upper()
    c2 = (item.get("category2") or "").strip().upper()
    c3 = (item.get("category3") or "").strip().upper()
    desc = (item.get("description") or "").strip()
    
    # 1. Samsung Wall Chargers / Adapters (EP-T2510, EP-T4511, EP-T6010, EP-TA800, etc.)
    m_samsung_adapter = re.search(r'(EP-[A-Za-z0-9]{5})', pn)
    if not m_samsung_adapter:
        m_samsung_adapter = re.search(r'(EP-[A-Za-z0-9]{5})', desc)
    if m_samsung_adapter and "SAMSUNG" in brand:
        base_code = m_samsung_adapter.group(1).upper()
        # Wattage determination
        watt = "25W" if "2510" in base_code or "800" in base_code else "45W" if "4511" in base_code or "4510" in base_code else "60W" if "6010" in base_code else "15W"
        return f"FAM-SAMSUNG-ADAPTER-{base_code}", f"Samsung {watt} Power Adapter ({base_code})", "SAMSUNG", "WALL_CHARGER", base_code, watt
        
    # 2. UGREEN Chargers
    if "UGREEN" in brand and ("CHARGER" in c2 or "WALL CHAR" in desc.upper()):
        watt_m = re.search(r'(\d+)\s*[wW]', desc)
        watt = f"{watt_m.group(1)}W" if watt_m else "Fast Charge"
        return f"FAM-UGREEN-CHARGER-{watt}", f"UGREEN {watt} Wall Charger Family", "[CS]UGREEN", "WALL_CHARGER", None, watt
        
    # 3. Focus Screen Protectors (Focus TG FF / 3D)
    if "FOCUS" in brand and "SCREEN PROTECTOR" in c2:
        dev_match = re.search(r'(Galaxy\s+[A-Za-z0-9\s]+(?:Ultra|Plus|FE|5G|4G)?)', desc, re.IGNORECASE)
        dev = dev_match.group(1).strip() if dev_match else c3.replace("SAMSUNG GALAXY", "").replace("GALAXY", "").strip()
        return f"FAM-FOCUS-SP-{dev.replace(' ', '')}", f"Focus Tempered Glass Screen Protector for {dev}", "FOCUS", "SCREEN_PROTECTOR", None, dev
        
    # 4. Hi-Shield Screen Protectors
    if "HISHIELD" in brand and "SCREEN PROTECTOR" in c2:
        dev_match = re.search(r'(Galaxy\s+[A-Za-z0-9\s]+(?:Ultra|Plus|FE|5G|4G)?)', desc, re.IGNORECASE)
        dev = dev_match.group(1).strip() if dev_match else c3.replace("SAMSUNG GALAXY", "").replace("GALAXY", "").strip()
        return f"FAM-HISHIELD-SP-{dev.replace(' ', '')}", f"Hi-Shield Screen Protector for {dev}", "HISHIELD", "SCREEN_PROTECTOR", None, dev
        
    # 5. Phone Cases by Target Device & Brand
    if "CASE" in c2:
        target_dev = c3 if c3 else "Galaxy Phone"
        is_tab = "TAB" in c2 or "TAB" in target_dev
        pt = "TABLET_CASE" if is_tab else "PHONE_CASE"
        clean_brand = brand if brand in ["SAMSUNG", "FOCUS", "ITSKINS"] else "GENERIC"
        return f"FAM-CASE-{clean_brand}-{target_dev.replace(' ', '')}", f"{clean_brand.capitalize()} Protective Case for {target_dev}", brand, pt, None, target_dev
        
    # 6. Watch Bands
    if "WATCH BANDS" in c2:
        target_watch = c3 if c3 else "Galaxy Watch"
        return f"FAM-WATCHBAND-{target_watch.replace(' ', '')}", f"Galaxy Watch Band for {target_watch}", brand, "WATCH_BAND", None, target_watch
        
    # 7. Audio & Speakers
    if c1 == "AUDIO":
        pt = "BLUETOOTH_SPEAKER" if "SPEAKER" in c2 else "EARBUDS"
        return f"FAM-AUDIO-{brand}-{pn[:8]}", f"{brand} Audio Device", brand, pt, None, None
        
    # Default fallback: Single item family
    return f"FAM-SINGLE-{pn}", desc if desc else pn, brand, "UNKNOWN_ACCESSORY", None, None

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    snapshot_path = os.path.join(root, "assets", "js", "pilot-stock-snapshot.js")
    output_path = os.path.join(root, "reports", "product_family_map.json")
    
    with open(snapshot_path, "r", encoding="utf-8") as f:
        content = f.read()
    arr_str = content.split("window.LATEST_STOCK_SNAPSHOT =")[1].split("];")[0].strip() + "]"
    items = json.loads(arr_str)
    
    # Filter accessory / premium / unverified items
    accessory_items = [it for it in items if it.get("category") in ["Accessory", "Premium", "Other"]]
    
    families = {}
    
    for item in accessory_items:
        fam_id, fam_name, brand, product_type, base_code, extra = extract_base_family_key(item)
        pn = item.get("pn", "").strip()
        barcode = item.get("barcode", "").strip()
        f1 = int(item.get("f1", 0))
        f2 = int(item.get("f2", 0))
        tot = int(item.get("total", 0))
        desc = item.get("description", "")
        color = item.get("color", "")
        
        if fam_id not in families:
            families[fam_id] = {
                "familyId": fam_id,
                "familyName": fam_name,
                "brand": brand,
                "productType": product_type,
                "baseModel": base_code,
                "extraContext": extra,
                "aggregatedF1": 0,
                "aggregatedF2": 0,
                "aggregatedTotal": 0,
                "variantCount": 0,
                "variants": []
            }
            
        fam = families[fam_id]
        fam["aggregatedF1"] += f1
        fam["aggregatedF2"] += f2
        fam["aggregatedTotal"] += tot
        fam["variantCount"] += 1
        fam["variants"].append({
            "inventoryPn": pn,
            "barcode": barcode if barcode else None,
            "erpDescription": desc,
            "color": color,
            "f1": f1,
            "f2": f2,
            "total": tot
        })
        
    family_list = list(families.values())
    family_list.sort(key=lambda x: x["aggregatedF1"], reverse=True)
    
    report = {
        "generatedAt": datetime.now().isoformat(),
        "totalAccessoryItemsAnalyzed": len(accessory_items),
        "totalProductFamiliesFormed": len(family_list),
        "totalAggregatedF1": sum(f["aggregatedF1"] for f in family_list),
        "multiVariantFamiliesCount": len([f for f in family_list if f["variantCount"] > 1]),
        "topFamilies": family_list[:15],
        "families": family_list
    }
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        
    print("================================================================================")
    print("PRODUCT FAMILY DEDUPLICATION COMPLETE")
    print("================================================================================")
    print(f"Total Accessory Items Ingested   : {report['totalAccessoryItemsAnalyzed']}")
    print(f"Canonical Families Formed        : {report['totalProductFamiliesFormed']}")
    print(f"Multi-Variant Deduplicated       : {report['multiVariantFamiliesCount']} families")
    print(f"Aggregated F1 Stock in Families  : {report['totalAggregatedF1']} ชิ้น")
    print("\nTop 5 Product Families by F1 Stock:")
    for i, fam in enumerate(family_list[:5], 1):
        print(f"  {i}. [F1={fam['aggregatedF1']:3}] {fam['familyId']:32} | Variants={fam['variantCount']:2} | {fam['familyName']}")
    print("================================================================================")
    print(f"Saved product family map to: {output_path}")

if __name__ == "__main__":
    main()
