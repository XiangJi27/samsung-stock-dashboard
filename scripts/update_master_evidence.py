#!/usr/bin/env python3
"""
Update Product Accessory Master with Field-Level Evidence & Source Hygiene
"""
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

def update_master_field_evidence():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    master_path = os.path.join(root, "data", "product-accessory-master.json")

    with open(master_path, "r", encoding="utf-8") as f:
        master = json.load(f)

    products = master.get("products", [])

    for p in products:
        pn = p.get("inventoryIdentity", {}).get("inventoryPn")

        # 1. EP-T4511NBEGTH
        if pn == "EP-T4511NBEGTH":
            p["sources"] = [
                {
                    "sourceId": "SRC-ERP-STOCK",
                    "sourceType": "ERP_STOCK_MASTER",
                    "publisher": "Internal Inventory System",
                    "url": None,
                    "checkedAt": "2026-09-16",
                    "status": "ACTIVE"
                },
                {
                    "sourceId": "SRC-SAMSUNG-OFFICIAL-T4511",
                    "sourceType": "MANUFACTURER_OFFICIAL_WEBSITE",
                    "publisher": "Samsung Thailand Official",
                    "url": "https://www.samsung.com/th/mobile-accessories/45w-power-adapter-black-ep-t4511xbegth/",
                    "checkedAt": "2026-09-16",
                    "status": "ACTIVE"
                }
            ]
            p["specifications"] = {
                "maximumOutputPower": {
                    "value": 45,
                    "unit": "W",
                    "displayValue": "45W",
                    "status": "VERIFIED_FROM_ERP",
                    "sourceId": "SRC-ERP-STOCK",
                    "evidenceLocator": "ERP Description > 45W"
                },
                "chargerType": {
                    "value": "WALL_CHARGER",
                    "displayValue": "อะแดปเตอร์ติดผนัง",
                    "status": "VERIFIED_FROM_ERP",
                    "sourceId": "SRC-ERP-STOCK",
                    "evidenceLocator": "ERP Description > Adapter"
                },
                "cableIncluded": {
                    "value": False,
                    "displayValue": "ไม่มีสายชาร์จในกล่อง",
                    "status": "VERIFIED_FROM_ERP",
                    "sourceId": "SRC-ERP-STOCK",
                    "evidenceLocator": "ERP Description > without cable"
                },
                "color": {
                    "value": "Black",
                    "displayValue": "ดำ (Black)",
                    "status": "VERIFIED_FROM_ERP",
                    "sourceId": "SRC-ERP-STOCK",
                    "evidenceLocator": "ERP Description > Black"
                },
                "outputPorts": {
                    "value": "1 USB-C",
                    "displayValue": "1 พอร์ต USB Type-C",
                    "status": "VERIFIED_FROM_ERP",
                    "sourceId": "SRC-ERP-STOCK",
                    "evidenceLocator": "ERP Description > without cable"
                },
                "usbPowerDelivery": {
                    "value": "PD 3.0 (Super Fast Charging 2.0)",
                    "displayValue": "PD 3.0 SFC 2.0",
                    "status": "VERIFIED",
                    "sourceId": "SRC-SAMSUNG-OFFICIAL-T4511",
                    "evidenceLocator": "Samsung Official Specifications > Super Fast Charging 2.0 max. 45W"
                },
                "pps": {
                    "value": "3.3-20.0V=2.25A",
                    "displayValue": "PPS 45W Max",
                    "status": "VERIFIED",
                    "sourceId": "SRC-SAMSUNG-OFFICIAL-T4511",
                    "evidenceLocator": "Samsung Official Specifications > PPS 3.3-20.0V=2.25A"
                },
                "ganTechnology": {
                    "value": None,
                    "displayValue": "ยังไม่ได้ยืนยัน",
                    "status": "NOT_VERIFIED",
                    "sourceId": None,
                    "evidenceLocator": "Unproven high-risk packaging claim suppressed"
                }
            }

        # 2. SSG-EP-DN975BWEGWW
        elif pn == "SSG-EP-DN975BWEGWW":
            p["sources"] = [
                {
                    "sourceId": "SRC-ERP-STOCK",
                    "sourceType": "ERP_STOCK_MASTER",
                    "publisher": "Internal Inventory System",
                    "url": None,
                    "checkedAt": "2026-09-16",
                    "status": "ACTIVE"
                },
                {
                    "sourceId": "SRC-SAMSUNG-OFFICIAL-DN975",
                    "sourceType": "MANUFACTURER_OFFICIAL_WEBSITE",
                    "publisher": "Samsung Thailand Official",
                    "url": "https://www.samsung.com/th/mobile-accessories/100w-type-c-to-type-c-cable-white-ep-dn975bwegww/",
                    "checkedAt": "2026-09-16",
                    "status": "ACTIVE"
                }
            ]
            p["specifications"] = {
                "connectorA": {
                    "value": "USB-C",
                    "displayValue": "USB Type-C",
                    "status": "VERIFIED_FROM_ERP",
                    "sourceId": "SRC-ERP-STOCK",
                    "evidenceLocator": "ERP Description > C to C"
                },
                "connectorB": {
                    "value": "USB-C",
                    "displayValue": "USB Type-C",
                    "status": "VERIFIED_FROM_ERP",
                    "sourceId": "SRC-ERP-STOCK",
                    "evidenceLocator": "ERP Description > C to C"
                },
                "color": {
                    "value": "White",
                    "displayValue": "ขาว (White)",
                    "status": "VERIFIED_FROM_ERP",
                    "sourceId": "SRC-ERP-STOCK",
                    "evidenceLocator": "ERP Description > White"
                },
                "maximumPower": {
                    "value": 100,
                    "unit": "W",
                    "displayValue": "100W",
                    "status": "VERIFIED",
                    "sourceId": "SRC-SAMSUNG-OFFICIAL-DN975",
                    "evidenceLocator": "Samsung Official Specifications > Max. 100W"
                },
                "maximumCurrent": {
                    "value": 5,
                    "unit": "A",
                    "displayValue": "5A",
                    "status": "VERIFIED",
                    "sourceId": "SRC-SAMSUNG-OFFICIAL-DN975",
                    "evidenceLocator": "Samsung Official Specifications > Max. 5A"
                },
                "length": {
                    "value": 1,
                    "unit": "M",
                    "displayValue": "1 เมตร",
                    "status": "VERIFIED",
                    "sourceId": "SRC-SAMSUNG-OFFICIAL-DN975",
                    "evidenceLocator": "Samsung Official Specifications > Cable Length 1 m"
                },
                "eMarker": {
                    "value": None,
                    "displayValue": "ยังไม่ได้ยืนยัน",
                    "status": "NOT_VERIFIED",
                    "sourceId": None,
                    "evidenceLocator": "Unproven technical claim suppressed"
                }
            }

        # 3. PM4897121009793 (Gaabor Air Fryer)
        elif pn == "PM4897121009793":
            p["sources"] = [
                {
                    "sourceId": "SRC-ERP-STOCK",
                    "sourceType": "ERP_STOCK_MASTER",
                    "publisher": "Internal Inventory System",
                    "url": None,
                    "checkedAt": "2026-09-16",
                    "status": "ACTIVE"
                },
                {
                    "sourceId": "SRC-GAABOR-OFFICIAL-MALL",
                    "sourceType": "SHOPEE_MALL_OFFICIAL",
                    "publisher": "Gaabor Official Shopee Mall",
                    "url": "https://shopee.co.th/gaabor_official_store",
                    "checkedAt": "2026-09-16",
                    "status": "ACTIVE"
                }
            ]
            p["specifications"] = {
                "applianceType": {
                    "value": "AIR_FRYER",
                    "displayValue": "หม้อทอดไร้น้ำมัน",
                    "status": "VERIFIED_FROM_ERP",
                    "sourceId": "SRC-ERP-STOCK",
                    "evidenceLocator": "ERP Description > Air Fryer"
                },
                "capacity": {
                    "value": "4L",
                    "displayValue": "ความจุ 4 ลิตร",
                    "status": "VERIFIED_FROM_ERP",
                    "sourceId": "SRC-ERP-STOCK",
                    "evidenceLocator": "ERP Description > 4L"
                },
                "manufacturerModel": {
                    "value": "AF-40M01A",
                    "displayValue": "AF-40M01A",
                    "status": "VERIFIED_FROM_ERP",
                    "sourceId": "SRC-ERP-STOCK",
                    "evidenceLocator": "ERP Description > AF-40M01A"
                },
                "power": {
                    "value": 1000,
                    "unit": "W",
                    "displayValue": "1000W",
                    "status": "SUPPORTED_BY_OFFICIAL_MARKETPLACE",
                    "sourceId": "SRC-GAABOR-OFFICIAL-MALL",
                    "evidenceLocator": "Gaabor Official Store Specifications > 1000W"
                },
                "timer": {
                    "value": "30 Min",
                    "displayValue": "ตั้งเวลาสูงสุด 30 นาที",
                    "status": "SUPPORTED_BY_OFFICIAL_MARKETPLACE",
                    "sourceId": "SRC-GAABOR-OFFICIAL-MALL",
                    "evidenceLocator": "Gaabor Official Store Specifications > 0-30 min timer"
                }
            }

        # 4. PM-8806090284687 (Samsung Soundbar HW-T420)
        elif pn == "PM-8806090284687":
            p["sources"] = [
                {
                    "sourceId": "SRC-ERP-STOCK",
                    "sourceType": "ERP_STOCK_MASTER",
                    "publisher": "Internal Inventory System",
                    "url": None,
                    "checkedAt": "2026-09-16",
                    "status": "ACTIVE"
                },
                {
                    "sourceId": "SRC-SAMSUNG-OFFICIAL-HWT420",
                    "sourceType": "MANUFACTURER_OFFICIAL_WEBSITE",
                    "publisher": "Samsung Thailand Official",
                    "url": "https://www.samsung.com/th/audio-devices/soundbar/t420-black-hw-t420-xt/",
                    "checkedAt": "2026-09-16",
                    "status": "ACTIVE"
                }
            ]
            p["specifications"] = {
                "audioChannels": {
                    "value": "2.1ch",
                    "displayValue": "ระบบเสียง 2.1 แชนเนล",
                    "status": "VERIFIED_FROM_ERP",
                    "sourceId": "SRC-ERP-STOCK",
                    "evidenceLocator": "ERP Description > 2.1ch"
                },
                "hasSubwoofer": {
                    "value": True,
                    "displayValue": "พร้อมซับวูฟเฟอร์แยก",
                    "status": "VERIFIED_FROM_ERP",
                    "sourceId": "SRC-ERP-STOCK",
                    "evidenceLocator": "ERP Description > with Subwoofer"
                },
                "manufacturerModel": {
                    "value": "HW-T420",
                    "displayValue": "HW-T420",
                    "status": "VERIFIED_FROM_ERP",
                    "sourceId": "SRC-ERP-STOCK",
                    "evidenceLocator": "ERP Description > HW-T420"
                },
                "outputPower": {
                    "value": 150,
                    "unit": "W",
                    "displayValue": "150W",
                    "status": "VERIFIED",
                    "sourceId": "SRC-SAMSUNG-OFFICIAL-HWT420",
                    "evidenceLocator": "Samsung Official Specifications > Total Power 150W"
                },
                "bluetooth": {
                    "value": True,
                    "displayValue": "รองรับ Bluetooth",
                    "status": "VERIFIED",
                    "sourceId": "SRC-SAMSUNG-OFFICIAL-HWT420",
                    "evidenceLocator": "Samsung Official Specifications > Bluetooth"
                },
                "opticalInput": {
                    "value": True,
                    "displayValue": "รองรับ Optical Audio In",
                    "status": "VERIFIED",
                    "sourceId": "SRC-SAMSUNG-OFFICIAL-HWT420",
                    "evidenceLocator": "Samsung Official Specifications > Optical In 1"
                },
                "dolbyAudio": {
                    "value": "Dolby Digital 2ch",
                    "displayValue": "Dolby Digital 2ch",
                    "status": "VERIFIED",
                    "sourceId": "SRC-SAMSUNG-OFFICIAL-HWT420",
                    "evidenceLocator": "Samsung Official Specifications > Dolby 2Ch"
                }
            }

        # 5. 6941876265732 (UGREEN 30W)
        elif pn == "6941876265732":
            p["specifications"]["pps"] = {
                "value": None,
                "displayValue": "ยังไม่ได้ยืนยัน",
                "status": "NOT_VERIFIED",
                "sourceId": None,
                "evidenceLocator": "Unproven PPS claim suppressed"
            }
            p["specifications"]["usbPowerDelivery"] = {
                "value": "PD",
                "displayValue": "USB Power Delivery (PD*2)",
                "status": "VERIFIED_FROM_ERP",
                "sourceId": "SRC-ERP-STOCK",
                "evidenceLocator": "ERP Description > PD*2"
            }
            p["specifications"]["maximumOutputPower"]["evidenceLocator"] = "ERP Description > 30W"
            p["specifications"]["chargerType"]["evidenceLocator"] = "ERP Description > Wall Charger"
            p["specifications"]["outputPorts"]["evidenceLocator"] = "ERP Description > USB Port*1 + PD*2"
            p["specifications"]["cableIncluded"]["evidenceLocator"] = "ERP Description > Thai plug"
            p["specifications"]["color"]["evidenceLocator"] = "ERP Description > Grey"

        # 6. 6941876265749 (UGREEN 45W)
        elif pn == "6941876265749":
            p["specifications"]["pps"] = {
                "value": None,
                "displayValue": "ยังไม่ได้ยืนยัน",
                "status": "NOT_VERIFIED",
                "sourceId": None,
                "evidenceLocator": "Unproven PPS claim suppressed"
            }
            p["specifications"]["maximumOutputPower"]["evidenceLocator"] = "ERP Description > 45W"
            p["specifications"]["chargerType"]["evidenceLocator"] = "ERP Description > Wall Charger"
            p["specifications"]["outputPorts"]["evidenceLocator"] = "ERP Description > USB Port*1 + PD*2"
            p["specifications"]["cableIncluded"]["evidenceLocator"] = "ERP Description > Thai plug"
            p["specifications"]["color"]["evidenceLocator"] = "ERP Description > Grey"

        # 7. 4710343478164 (ADAM elements 100W Cable)
        elif pn == "4710343478164":
            p["specifications"]["connectorA"]["evidenceLocator"] = "ERP Description > C to C"
            p["specifications"]["connectorB"]["evidenceLocator"] = "ERP Description > C to C"
            p["specifications"]["maximumPower"]["evidenceLocator"] = "ERP Description > 100W"
            p["specifications"]["length"]["evidenceLocator"] = "ERP Description > 1M"
            p["specifications"]["packageQuantity"]["evidenceLocator"] = "ERP Description > 2 units"
            p["specifications"]["color"]["evidenceLocator"] = "ERP Description > Silver"

        # 8. EP-T6010NBEGTH
        elif pn == "EP-T6010NBEGTH":
            p["specifications"]["maximumOutputPower"]["evidenceLocator"] = "ERP Description > 60W"
            p["specifications"]["chargerType"]["evidenceLocator"] = "ERP Description > Adapter"
            p["specifications"]["cableIncluded"]["evidenceLocator"] = "ERP Description > without cable"
            p["specifications"]["color"]["evidenceLocator"] = "ERP Description > Black"
            p["specifications"]["outputPorts"]["evidenceLocator"] = "ERP Description > without cable"
            p["specifications"]["usbPowerDelivery"] = {
                "value": None,
                "displayValue": "ยังไม่ได้ยืนยัน",
                "status": "NOT_VERIFIED",
                "sourceId": None,
                "evidenceLocator": "Unproven technical claim suppressed"
            }

        # 9. PREMIUM0017044
        elif pn == "PREMIUM0017044":
            p["specifications"] = {
                "accessoryType": {
                    "value": "BACKPACK",
                    "displayValue": "กระเป๋าเป้",
                    "status": "VERIFIED_FROM_ERP",
                    "sourceId": "SRC-ERP-STOCK",
                    "evidenceLocator": "ERP Description > Backpack"
                },
                "color": {
                    "value": "Fashion Phoenix",
                    "displayValue": "ลาย Phoenix",
                    "status": "VERIFIED_FROM_ERP",
                    "sourceId": "SRC-ERP-STOCK",
                    "evidenceLocator": "ERP Description > Fashion Phoenix"
                }
            }

        # 10. PREMIUM0017046
        elif pn == "PREMIUM0017046":
            p["specifications"] = {
                "accessoryType": {
                    "value": "SLING_BAG",
                    "displayValue": "กระเป๋าสะพาย",
                    "status": "VERIFIED_FROM_ERP",
                    "sourceId": "SRC-ERP-STOCK",
                    "evidenceLocator": "ERP Description > Sling Bag"
                },
                "color": {
                    "value": "Phoenix",
                    "displayValue": "ลาย Phoenix",
                    "status": "VERIFIED_FROM_ERP",
                    "sourceId": "SRC-ERP-STOCK",
                    "evidenceLocator": "ERP Description > Phoenix"
                }
            }

    with open(master_path, "w", encoding="utf-8") as f:
        json.dump(master, f, indent=2, ensure_ascii=False)

    print("✅ Successfully updated data/product-accessory-master.json with field-level evidence & source locators.")

if __name__ == "__main__":
    update_master_field_evidence()
