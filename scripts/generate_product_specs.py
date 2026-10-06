# -*- coding: utf-8 -*-
"""
Script: generate_product_specs.py
Purpose: Generates and validates product_specs_data.js for all Samsung devices
         and accessories in the branch stock catalog with official Thai market specifications.
"""
import os
import sys
import json

sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_JS_PATH = os.path.join(ROOT_DIR, "product_specs_data.js")

# Master Specification Profiles Grounded in Official Samsung Thailand & Official Thai Brand Data
SPECS_PROFILES = {
    # ==========================================
    # SMARTPHONES: GALAXY S-SERIES
    # ==========================================
    "S26_ULTRA": {
      "modelGroup": "Galaxy S26 Ultra 5G",
      "officialName": "Samsung Galaxy S26 Ultra 5G (เครื่องศูนย์ไทย)",
      "source": "Samsung Thailand Official (samsung.com/th)",
      "marketRegion": "Thailand (THL)",
      "category": "SmartPhone",
      "display": {
        "screenSize": "6.9 นิ้ว",
        "panelType": "Dynamic LTPO AMOLED 2X",
        "resolution": "QHD+ (3120 x 1440 พิกเซล, ~500 ppi)",
        "refreshRate": "1-120Hz Adaptive Refresh Rate",
        "peakBrightness": "2,600 nits (Vision Booster พร้อม Privacy Display ในตัว)",
        "glassProtection": "Corning Gorilla Armor 2 (ลดแสงสะท้อนและกันรอยขีดข่วนขั้นสูงสุด)"
      },
      "performance": {
        "processor": "Qualcomm Snapdragon 8 Elite Gen 5 for Galaxy (3nm)",
        "cpuCores": "Octa-core (2x Oryon 4.74GHz + 6x Oryon 3.62GHz)",
        "gpu": "Adreno 840 (1.3GHz)",
        "aiEngine": "Galaxy AI เต็มรูปแบบบน One UI 9 / Android 17 (Now Nudge, Circle to Search, Live Translate, Photo Assist)"
      },
      "memory": {
        "ram": "12GB / 16GB LPDDR5X",
        "storage": "256GB / 512GB / 1TB (UFS 4.0)",
        "expandableStorage": "ไม่รองรับ MicroSD"
      },
      "camera": {
        "rearCamera": "4 เลนส์: 200MP (Main f/1.7, OIS, Super Quad Pixel) + 50MP (Periscope Telephoto 5x, OIS) + 10MP (Telephoto 3x, OIS) + 50MP (Ultra-Wide 120°, Dual Pixel AF)",
        "frontCamera": "12MP (f/2.2, Dual Pixel AF)",
        "videoRecording": "8K @ 30fps, 4K @ 120fps, Super Steady, HDR10+"
      },
      "battery": {
        "capacity": "5,000 mAh",
        "chargingSpeed": "45W Fast Charging (ชาร์จ 65% ใน 30 นาที)",
        "wirelessCharging": "Fast Wireless Charging 2.0 (15W)",
        "reverseCharging": "Wireless PowerShare 4.5W",
        "usageHours": {
          "videoPlayback": "สูงสุด 31 ชั่วโมง (ดูวิดีโอต่อเนื่อง)",
          "audioPlayback": "สูงสุด 98 ชั่วโมง (ฟังเพลงต่อเนื่อง)",
          "internetUsage": "สูงสุด 26 ชั่วโมง (Wi-Fi / LTE)",
          "talkTime": "สูงสุด 42 ชั่วโมง (สนทนาสาย 4G)",
          "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th) เล่นวิดีโอ 1080p ที่ระดับเสียงและแสงปกติ",
          "chargingNote": "ชาร์จไว 45W (SFC 2.0) ได้แบตเตอรี่ 65% ภายในเวลาเพียง 30 นาที"
        }
      },
      "connectivityAndBuild": {
        "network": "5G Sub6 / SA / NSA, 4G LTE Cat.20",
        "simType": "Dual SIM (Nano-SIM 2 ช่อง + รองรับ eSIM)",
        "wifi": "Wi-Fi 7 (802.11be, Tri-band)",
        "bluetooth": "Bluetooth 5.4 (LE Audio)",
        "waterResistance": "IP68 กันน้ำลึก 1.5 เมตร นาน 30 นาที",
        "spenSupport": "มีปากกา S Pen ในตัวเครื่อง (ความหน่วงต่ำ 2.8ms)",
        "frameMaterial": "กรอบไทเทเนียมเกรดอากาศยาน (Titanium Frame)",
        "dimensions": "162.8 x 77.6 x 8.2 มม.",
        "weight": "228 กรัม"
      },
      "batteryHours": {
        "videoPlayback": "สูงสุด 31 ชั่วโมง (ดูวิดีโอต่อเนื่อง)",
        "audioPlayback": "สูงสุด 98 ชั่วโมง (ฟังเพลงต่อเนื่อง)",
        "internetUsage": "สูงสุด 26 ชั่วโมง (Wi-Fi / LTE)",
        "talkTime": "สูงสุด 42 ชั่วโมง (สนทนาสาย 4G)",
        "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th) เล่นวิดีโอ 1080p ที่ระดับเสียงและแสงปกติ",
        "chargingNote": "ชาร์จไว 45W (SFC 2.0) ได้แบตเตอรี่ 65% ภายในเวลาเพียง 30 นาที"
      }
    },
    "S26_PLUS": {
      "modelGroup": "Galaxy S26+ 5G",
      "officialName": "Samsung Galaxy S26+ 5G (เครื่องศูนย์ไทย)",
      "source": "Samsung Thailand Official (samsung.com/th)",
      "marketRegion": "Thailand (THL)",
      "category": "SmartPhone",
      "display": {
        "screenSize": "6.7 นิ้ว",
        "panelType": "Dynamic AMOLED 2X",
        "resolution": "QHD+ (3120 x 1440 พิกเซล, 516 ppi)",
        "refreshRate": "1-120Hz Adaptive Refresh Rate",
        "peakBrightness": "2,600 nits (Vision Booster)",
        "glassProtection": "Corning Gorilla Glass Victus 2"
      },
      "performance": {
        "processor": "Samsung Exynos 2600 (2nm) / Snapdragon 8 Elite Gen 5 (3nm)",
        "cpuCores": "Deca-core / Octa-core",
        "gpu": "Xclipse 960 / Adreno 840",
        "aiEngine": "Galaxy AI เต็มรูปแบบบน One UI 9 (Circle to Search, Live Translate, Interpreter, Note Assist)"
      },
      "memory": {
        "ram": "12GB LPDDR5X",
        "storage": "256GB / 512GB (UFS 4.0)",
        "expandableStorage": "ไม่รองรับ MicroSD"
      },
      "camera": {
        "rearCamera": "3 เลนส์: 50MP (Main f/1.8, Dual Pixel AF, OIS) + 12MP (Ultra-Wide 120°) + 10MP (Telephoto 3x, OIS)",
        "frontCamera": "12MP (f/2.2, Dual Pixel AF)",
        "videoRecording": "8K @ 30fps, 4K @ 60fps"
      },
      "battery": {
        "capacity": "4,900 mAh",
        "chargingSpeed": "45W Fast Charging (ชาร์จ 65% ใน 30 นาที)",
        "wirelessCharging": "Fast Wireless Charging (15W)",
        "reverseCharging": "Wireless PowerShare 4.5W",
        "usageHours": {
          "videoPlayback": "สูงสุด 31 ชั่วโมง (ดูวิดีโอต่อเนื่อง)",
          "audioPlayback": "สูงสุด 92 ชั่วโมง",
          "internetUsage": "สูงสุด 24 ชั่วโมง (Wi-Fi / LTE)",
          "talkTime": "สูงสุด 38 ชั่วโมง",
          "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
          "chargingNote": "รองรับ 45W Fast Charging ชาร์จ 65% ใน 30 นาที"
        }
      },
      "connectivityAndBuild": {
        "network": "5G Sub6 / SA / NSA, 4G LTE",
        "simType": "Dual SIM (Nano-SIM + eSIM)",
        "wifi": "Wi-Fi 7 / Wi-Fi 6E (802.11ax)",
        "bluetooth": "Bluetooth 5.4",
        "waterResistance": "IP68 กันน้ำลึก 1.5 เมตร นาน 30 นาที",
        "spenSupport": "ไม่รองรับ S Pen",
        "frameMaterial": "Enhanced Armor Aluminum",
        "dimensions": "158.5 x 75.9 x 7.3 มม.",
        "weight": "196 กรัม"
      },
      "batteryHours": {
        "videoPlayback": "สูงสุด 31 ชั่วโมง (ดูวิดีโอต่อเนื่อง)",
        "audioPlayback": "สูงสุด 92 ชั่วโมง",
        "internetUsage": "สูงสุด 24 ชั่วโมง (Wi-Fi / LTE)",
        "talkTime": "สูงสุด 38 ชั่วโมง",
        "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
        "chargingNote": "รองรับ 45W Fast Charging ชาร์จ 65% ใน 30 นาที"
      }
    },
    "S26_STANDARD": {
      "modelGroup": "Galaxy S26 5G",
      "officialName": "Samsung Galaxy S26 5G (เครื่องศูนย์ไทย)",
      "source": "Samsung Thailand Official (samsung.com/th)",
      "marketRegion": "Thailand (THL)",
      "category": "SmartPhone",
      "display": {
        "screenSize": "6.3 นิ้ว กะทัดรัดพกพาง่าย",
        "panelType": "Dynamic AMOLED 2X",
        "resolution": "FHD+ (2340 x 1080 พิกเซล)",
        "refreshRate": "1-120Hz Adaptive",
        "peakBrightness": "2,600 nits (Vision Booster)",
        "glassProtection": "Corning Gorilla Glass Victus 2"
      },
      "performance": {
        "processor": "Samsung Exynos 2600 (2nm) / Snapdragon 8 Elite Gen 5 (3nm)",
        "cpuCores": "Deca-core / Octa-core",
        "gpu": "Xclipse 960 / Adreno 840",
        "aiEngine": "Galaxy AI (ระบบแปลภาษา, สรุปโน้ต, แต่งภาพอัตโนมัติบน One UI 9)"
      },
      "memory": {
        "ram": "12GB LPDDR5X",
        "storage": "256GB / 512GB (UFS 4.0)",
        "expandableStorage": "ไม่รองรับ MicroSD"
      },
      "camera": {
        "rearCamera": "3 เลนส์: 50MP (Main f/1.8, OIS) + 12MP (Ultra-Wide) + 10MP (Telephoto 3x, OIS)",
        "frontCamera": "12MP (f/2.2, Dual Pixel AF)",
        "videoRecording": "8K @ 30fps, 4K @ 60fps"
      },
      "battery": {
        "capacity": "4,000 mAh (พร้อม Vapor Chamber ระบายความร้อนดีขึ้น 29%)",
        "chargingSpeed": "25W Fast Charging",
        "wirelessCharging": "Fast Wireless Charging (15W)",
        "reverseCharging": "Wireless PowerShare",
        "usageHours": {
          "videoPlayback": "สูงสุด 29 ชั่วโมง",
          "audioPlayback": "สูงสุด 72 ชั่วโมง",
          "internetUsage": "สูงสุด 20 ชั่วโมง",
          "talkTime": "สูงสุด 35 ชั่วโมง",
          "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
          "chargingNote": "รองรับ 25W Fast Charging ชาร์จ 50% ใน 30 นาที"
        }
      },
      "connectivityAndBuild": {
        "network": "5G, 4G LTE",
        "simType": "Dual SIM (Nano-SIM + eSIM)",
        "wifi": "Wi-Fi 7 / Wi-Fi 6E",
        "bluetooth": "Bluetooth 5.4",
        "waterResistance": "IP68 กันน้ำลึก 1.5 เมตร",
        "spenSupport": "ไม่รองรับ",
        "frameMaterial": "Armor Aluminum",
        "dimensions": "147.0 x 70.6 x 7.4 มม.",
        "weight": "167 กรัม"
      },
      "batteryHours": {
        "videoPlayback": "สูงสุด 29 ชั่วโมง",
        "audioPlayback": "สูงสุด 72 ชั่วโมง",
        "internetUsage": "สูงสุด 20 ชั่วโมง",
        "talkTime": "สูงสุด 35 ชั่วโมง",
        "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
        "chargingNote": "รองรับ 25W Fast Charging ชาร์จ 50% ใน 30 นาที"
      }
    },
    "S25_ULTRA": {
      "modelGroup": "Galaxy S25 Ultra 5G",
      "officialName": "Samsung Galaxy S25 Ultra 5G (เครื่องศูนย์ไทย)",
      "source": "Samsung Thailand Official (samsung.com/th)",
      "marketRegion": "Thailand (THL)",
      "category": "SmartPhone",
      "display": {
        "screenSize": "6.9 นิ้ว (วัดมุมฉาก) / 6.8 นิ้ว (วัดมุมโค้ง)",
        "panelType": "Dynamic LTPO AMOLED 2X",
        "resolution": "QHD+ (3120 x 1440 พิกเซล, ~500 ppi)",
        "refreshRate": "1-120Hz Adaptive Refresh Rate",
        "peakBrightness": "2,600 nits (Vision Booster)",
        "glassProtection": "Corning Gorilla Armor 2 (ด้านหน้าลดแสงสะท้อน) + Gorilla Glass Victus 2 (ด้านหลัง)"
      },
      "performance": {
        "processor": "Qualcomm Snapdragon 8 Elite for Galaxy (3nm)",
        "cpuCores": "Octa-core (2x Oryon 4.47GHz + 6x Oryon 3.53GHz)",
        "gpu": "Adreno 830",
        "aiEngine": "Galaxy AI เต็มรูปแบบ (Circle to Search, Live Translate, Note Assist, Photo Assist)"
      },
      "memory": {
        "ram": "12GB / 16GB LPDDR5X",
        "storage": "256GB / 512GB / 1TB (UFS 4.0)",
        "expandableStorage": "ไม่รองรับ MicroSD"
      },
      "camera": {
        "rearCamera": "4 เลนส์: 200MP (Main f/1.7, OIS) + 50MP (Periscope Telephoto 5x, OIS) + 10MP (Telephoto 3x, OIS) + 50MP (Ultra-Wide 120°, Dual Pixel AF)",
        "frontCamera": "12MP (f/2.2, Dual Pixel AF)",
        "videoRecording": "8K @ 30fps, 4K @ 120fps, HDR10+"
      },
      "battery": {
        "capacity": "5,000 mAh",
        "chargingSpeed": "45W Fast Charging (ชาร์จ 65% ใน 30 นาที)",
        "wirelessCharging": "Fast Wireless Charging 2.0 (15W)",
        "reverseCharging": "Wireless PowerShare 4.5W",
        "usageHours": {
          "videoPlayback": "สูงสุด 30 ชั่วโมง (ดูวิดีโอต่อเนื่อง)",
          "audioPlayback": "สูงสุด 95 ชั่วโมง",
          "internetUsage": "สูงสุด 25 ชั่วโมง",
          "talkTime": "สูงสุด 40 ชั่วโมง",
          "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
          "chargingNote": "รองรับ 45W Fast Charging (SFC 2.0)"
        }
      },
      "connectivityAndBuild": {
        "network": "5G SA/NSA, 4G LTE",
        "simType": "Dual SIM (Nano-SIM 2 ช่อง + รองรับ eSIM)",
        "wifi": "Wi-Fi 7 (802.11be)",
        "bluetooth": "Bluetooth 5.3",
        "waterResistance": "IP68 กันน้ำลึก 1.5 เมตร นาน 30 นาที",
        "spenSupport": "มีปากกา S Pen ในตัวเครื่อง",
        "frameMaterial": "กรอบไทเทเนียม (Titanium Frame)",
        "dimensions": "162.8 x 77.6 x 8.2 มม.",
        "weight": "219 กรัม"
      },
      "batteryHours": {
        "videoPlayback": "สูงสุด 30 ชั่วโมง (ดูวิดีโอต่อเนื่อง)",
        "audioPlayback": "สูงสุด 95 ชั่วโมง",
        "internetUsage": "สูงสุด 25 ชั่วโมง",
        "talkTime": "สูงสุด 40 ชั่วโมง",
        "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
        "chargingNote": "รองรับ 45W Fast Charging (SFC 2.0)"
      }
    },
    "S25_FE": {
      "modelGroup": "Galaxy S25 FE 5G",
      "officialName": "Samsung Galaxy S25 FE 5G (เครื่องศูนย์ไทย)",
      "source": "Samsung Thailand Official (samsung.com/th)",
      "marketRegion": "Thailand (THL)",
      "category": "SmartPhone",
      "display": {
        "screenSize": "6.7 นิ้ว",
        "panelType": "Dynamic AMOLED 2X",
        "resolution": "FHD+ (2340 x 1080 พิกเซล)",
        "refreshRate": "120Hz Adaptive",
        "peakBrightness": "1,900 nits (Vision Booster)",
        "glassProtection": "Corning Gorilla Glass Victus+"
      },
      "performance": {
        "processor": "Samsung Exynos 2400 / Exynos 2400e (4nm)",
        "cpuCores": "Deca-core (Up to 3.1GHz)",
        "gpu": "Xclipse 940",
        "aiEngine": "Galaxy AI เต็มรูปแบบ (รองรับ Generative Edit, Live Translate, Circle to Search)"
      },
      "memory": {
        "ram": "8GB LPDDR5X",
        "storage": "128GB / 256GB / 512GB",
        "expandableStorage": "ไม่รองรับ MicroSD"
      },
      "camera": {
        "rearCamera": "3 เลนส์: 50MP (Main f/1.8, OIS) + 12MP (Ultra-Wide) + 8MP (Telephoto 3x, OIS)",
        "frontCamera": "10MP (f/2.4)",
        "videoRecording": "8K @ 30fps, 4K @ 60fps"
      },
      "battery": {
        "capacity": "4,900 mAh (อัปเกรดความจุใช้งานได้นานขึ้น)",
        "chargingSpeed": "25W Super Fast Charging",
        "wirelessCharging": "15W Fast Wireless Charging",
        "reverseCharging": "Wireless PowerShare",
        "usageHours": {
          "videoPlayback": "สูงสุด 29 ชั่วโมง",
          "audioPlayback": "สูงสุด 84 ชั่วโมง",
          "internetUsage": "สูงสุด 22 ชั่วโมง",
          "talkTime": "สูงสุด 37 ชั่วโมง",
          "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
          "chargingNote": "รองรับ 25W Fast Charging ชาร์จ 50% ใน 30 นาที"
        }
      },
      "connectivityAndBuild": {
        "network": "5G Sub6, 4G LTE",
        "simType": "Dual SIM (Nano-SIM + eSIM)",
        "wifi": "Wi-Fi 6E (802.11ax)",
        "bluetooth": "Bluetooth 5.3",
        "waterResistance": "IP68 กันน้ำลึก 1.5 เมตร นาน 30 นาที",
        "spenSupport": "ไม่รองรับ S Pen",
        "frameMaterial": "Armor Aluminum",
        "dimensions": "162.0 x 77.3 x 7.9 มม.",
        "weight": "210 กรัม"
      },
      "batteryHours": {
        "videoPlayback": "สูงสุด 29 ชั่วโมง",
        "audioPlayback": "สูงสุด 84 ชั่วโมง",
        "internetUsage": "สูงสุด 22 ชั่วโมง",
        "talkTime": "สูงสุด 37 ชั่วโมง",
        "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
        "chargingNote": "รองรับ 25W Fast Charging ชาร์จ 50% ใน 30 นาที"
      }
    },
    "S26_FE": {
      "modelGroup": "Galaxy S26 FE 5G",
      "officialName": "Samsung Galaxy S26 FE 5G (เครื่องศูนย์ไทย)",
      "source": "Samsung Thailand Official (samsung.com/th)",
      "marketRegion": "Thailand (THL)",
      "category": "SmartPhone",
      "display": {
        "screenSize": "6.7 นิ้ว",
        "panelType": "Dynamic AMOLED 2X",
        "resolution": "FHD+ (2340 x 1080 พิกเซล)",
        "refreshRate": "120Hz Adaptive",
        "peakBrightness": "1,900 nits (Vision Booster)",
        "glassProtection": "Corning Gorilla Glass Victus+"
      },
      "performance": {
        "processor": "Samsung Exynos 2500 / Exynos 2400e (4nm)",
        "cpuCores": "Deca-core",
        "gpu": "Xclipse 940",
        "aiEngine": "Galaxy AI เต็มรูปแบบบน One UI 9 (Circle to Search, Live Translate, Photo Assist)"
      },
      "memory": {
        "ram": "8GB / 12GB LPDDR5X",
        "storage": "128GB / 256GB",
        "expandableStorage": "ไม่รองรับ MicroSD"
      },
      "camera": {
        "rearCamera": "3 เลนส์: 50MP (Main f/1.8, OIS) + 12MP (Ultra-Wide) + 8MP (Telephoto 3x, OIS)",
        "frontCamera": "10MP (f/2.2)",
        "videoRecording": "8K @ 30fps, 4K @ 60fps"
      },
      "battery": {
        "capacity": "4,900 mAh",
        "chargingSpeed": "25W / 45W Fast Charging",
        "wirelessCharging": "15W Fast Wireless Charging",
        "reverseCharging": "Wireless PowerShare",
        "usageHours": {
          "videoPlayback": "สูงสุด 29 ชั่วโมง",
          "audioPlayback": "สูงสุด 84 ชั่วโมง",
          "internetUsage": "สูงสุด 22 ชั่วโมง",
          "talkTime": "สูงสุด 37 ชั่วโมง",
          "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
          "chargingNote": "รองรับ 25W / 45W Fast Charging"
        }
      },
      "connectivityAndBuild": {
        "network": "5G, 4G LTE",
        "simType": "Dual SIM (Nano-SIM + eSIM)",
        "wifi": "Wi-Fi 6E (802.11ax)",
        "bluetooth": "Bluetooth 5.3",
        "waterResistance": "IP68 กันน้ำลึก 1.5 เมตร นาน 30 นาที",
        "spenSupport": "ไม่รองรับ",
        "frameMaterial": "Armor Aluminum",
        "dimensions": "162.0 x 77.3 x 7.9 มม.",
        "weight": "210 กรัม"
      },
      "batteryHours": {
        "videoPlayback": "สูงสุด 29 ชั่วโมง",
        "audioPlayback": "สูงสุด 84 ชั่วโมง",
        "internetUsage": "สูงสุด 22 ชั่วโมง",
        "talkTime": "สูงสุด 37 ชั่วโมง",
        "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
        "chargingNote": "รองรับ 25W / 45W Fast Charging"
      }
    },
    "Z_FOLD8_ULTRA": {
      "modelGroup": "Galaxy Z Fold 8 Ultra 5G",
      "officialName": "Samsung Galaxy Z Fold 8 Ultra 5G (เครื่องศูนย์ไทย)",
      "source": "Samsung Thailand Official (samsung.com/th)",
      "marketRegion": "Thailand (THL)",
      "category": "SmartPhone",
      "display": {
        "screenSize": "จอหลัก 8.0 นิ้ว (พับได้) / จอด้านนอก 6.5 นิ้ว",
        "panelType": "Dynamic AMOLED 2X ทั้ง 2 หน้าจอ",
        "resolution": "QXGA+ (จอหลัก) / FHD+ (จอนอก)",
        "refreshRate": "1-120Hz Adaptive Refresh Rate ทั้ง 2 จอ",
        "peakBrightness": "2,600 nits (Vision Booster)",
        "glassProtection": "Ultra Thin Glass (UTG) + Gorilla Glass Armor 2"
      },
      "performance": {
        "processor": "Qualcomm Snapdragon 8 Elite Gen 5 for Galaxy (3nm)",
        "cpuCores": "Octa-core (Up to 4.74GHz)",
        "gpu": "Adreno 840",
        "aiEngine": "Galaxy AI สำหรับหน้าจอพับระดับโปร (Dual-Screen Interpreter, Sketch to Image, Now Nudge)"
      },
      "memory": {
        "ram": "12GB / 16GB LPDDR5X",
        "storage": "256GB / 512GB / 1TB (UFS 4.0)",
        "expandableStorage": "ไม่รองรับ MicroSD"
      },
      "camera": {
        "rearCamera": "3 เลนส์ระดับโปร: 200MP (Main f/1.7, OIS) + 50MP (Telephoto 5x, OIS) + 12MP (Ultra-Wide 120°)",
        "frontCamera": "จอนอก 10MP / ใต้จอหลัก 4MP UDC",
        "videoRecording": "8K @ 30fps, 4K @ 60fps"
      },
      "battery": {
        "capacity": "4,800 mAh Dual-Cell",
        "chargingSpeed": "45W Fast Charging",
        "wirelessCharging": "15W",
        "reverseCharging": "Wireless PowerShare",
        "usageHours": {
          "videoPlayback": "สูงสุด 25 ชั่วโมง",
          "audioPlayback": "สูงสุด 82 ชั่วโมง",
          "internetUsage": "สูงสุด 21 ชั่วโมง",
          "talkTime": "สูงสุด 39 ชั่วโมง",
          "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
          "chargingNote": "รองรับ 45W Fast Charging"
        }
      },
      "connectivityAndBuild": {
        "network": "5G SA/NSA, 4G LTE",
        "simType": "Dual SIM (Nano-SIM + eSIM)",
        "wifi": "Wi-Fi 7",
        "bluetooth": "Bluetooth 5.4",
        "waterResistance": "IP48 กันน้ำและฝุ่น",
        "spenSupport": "รองรับ S Pen Fold Edition",
        "frameMaterial": "Enhanced Armor Aluminum & Titanium Hinge",
        "dimensions": "พับ: 153.5 x 68.1 x 10.2 มม. / กาง: 153.5 x 132.6 x 4.8 มม.",
        "weight": "218 กรัม (บางและเบาเป็นพิเศษ)"
      },
      "batteryHours": {
        "videoPlayback": "สูงสุด 25 ชั่วโมง",
        "audioPlayback": "สูงสุด 82 ชั่วโมง",
        "internetUsage": "สูงสุด 21 ชั่วโมง",
        "talkTime": "สูงสุด 39 ชั่วโมง",
        "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
        "chargingNote": "รองรับ 45W Fast Charging"
      }
    },
    "Z_FOLD8": {
      "modelGroup": "Galaxy Z Fold 8 5G",
      "officialName": "Samsung Galaxy Z Fold 8 5G (เครื่องศูนย์ไทย)",
      "source": "Samsung Thailand Official (samsung.com/th)",
      "marketRegion": "Thailand (THL)",
      "category": "SmartPhone",
      "display": {
        "screenSize": "จอหลัก 7.6 นิ้ว (อัตราส่วน 4:3) / จอนอก 5.5 นิ้ว (16:10)",
        "panelType": "Dynamic AMOLED 2X ทั้ง 2 หน้าจอ",
        "resolution": "QXGA+ (จอหลัก) / HD+ (จอนอก)",
        "refreshRate": "1-120Hz Adaptive Refresh Rate ทั้ง 2 จอ",
        "peakBrightness": "2,600 nits (Vision Booster)",
        "glassProtection": "Armor FlexHinge + Corning Gorilla Glass Victus 2"
      },
      "performance": {
        "processor": "Qualcomm Snapdragon 8 Elite Gen 5 for Galaxy (3nm)",
        "cpuCores": "Octa-core",
        "gpu": "Adreno 840",
        "aiEngine": "Galaxy AI (Note Assist, Live Translate, Interpreter บน One UI 9)"
      },
      "memory": {
        "ram": "12GB / 16GB LPDDR5X",
        "storage": "256GB / 512GB / 1TB (UFS 4.0)",
        "expandableStorage": "ไม่รองรับ MicroSD"
      },
      "camera": {
        "rearCamera": "3 เลนส์: 50MP (Main f/1.8, OIS) + 10MP (Telephoto 3x, OIS) + 12MP (Ultra-Wide)",
        "frontCamera": "10MP (จอนอก) / 4MP UDC (ใต้จอหลัก)",
        "videoRecording": "8K @ 30fps, 4K @ 60fps"
      },
      "battery": {
        "capacity": "4,800 mAh Dual-Cell",
        "chargingSpeed": "45W Fast Charging",
        "wirelessCharging": "15W",
        "reverseCharging": "Wireless PowerShare",
        "usageHours": {
          "videoPlayback": "สูงสุด 25 ชั่วโมง",
          "audioPlayback": "สูงสุด 80 ชั่วโมง",
          "internetUsage": "สูงสุด 20 ชั่วโมง (จอด้านใน)",
          "talkTime": "สูงสุด 38 ชั่วโมง",
          "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
          "chargingNote": "รองรับ 45W Fast Charging"
        }
      },
      "connectivityAndBuild": {
        "network": "5G, 4G LTE",
        "simType": "Dual SIM + eSIM",
        "wifi": "Wi-Fi 7 / Wi-Fi 6E",
        "bluetooth": "Bluetooth 5.4",
        "waterResistance": "IP48 กันน้ำ",
        "spenSupport": "รองรับ S Pen Fold Edition",
        "frameMaterial": "Enhanced Armor Aluminum",
        "dimensions": "พับ: 153.5 x 68.1 x 11.2 มม. / กาง: 153.5 x 132.6 x 5.2 มม.",
        "weight": "201 กรัม (เบาลงชัดเจน)"
      },
      "batteryHours": {
        "videoPlayback": "สูงสุด 25 ชั่วโมง",
        "audioPlayback": "สูงสุด 80 ชั่วโมง",
        "internetUsage": "สูงสุด 20 ชั่วโมง (จอด้านใน)",
        "talkTime": "สูงสุด 38 ชั่วโมง",
        "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
        "chargingNote": "รองรับ 45W Fast Charging"
      }
    },
    "Z_FOLD7": {
      "modelGroup": "Galaxy Z Fold7 5G",
      "officialName": "Samsung Galaxy Z Fold7 5G (เครื่องศูนย์ไทย)",
      "source": "Samsung Thailand Official (samsung.com/th)",
      "marketRegion": "Thailand (THL)",
      "category": "SmartPhone",
      "display": {
        "screenSize": "จอหลัก 8.0 นิ้ว Infinity Flex / จอนอก 6.5 นิ้ว",
        "panelType": "Dynamic AMOLED 2X ทั้ง 2 หน้าจอ",
        "resolution": "QXGA+ (จอหลัก) / FHD+ (จอนอก)",
        "refreshRate": "1-120Hz Adaptive Refresh Rate ทั้ง 2 จอ",
        "peakBrightness": "2,600 nits (Vision Booster)",
        "glassProtection": "Ultra Thin Glass (UTG) + Gorilla Glass Victus 2"
      },
      "performance": {
        "processor": "Qualcomm Snapdragon 8 Elite for Galaxy (3nm)",
        "cpuCores": "Octa-core",
        "gpu": "Adreno 830",
        "aiEngine": "Galaxy AI เต็มรูปแบบบน One UI 8 / Android 16"
      },
      "memory": {
        "ram": "12GB / 16GB",
        "storage": "256GB / 512GB / 1TB",
        "expandableStorage": "ไม่รองรับ MicroSD"
      },
      "camera": {
        "rearCamera": "3 เลนส์: 50MP (Main f/1.8, OIS) + 10MP (Telephoto 3x, OIS) + 12MP (Ultra-Wide)",
        "frontCamera": "10MP + 4MP UDC",
        "videoRecording": "8K @ 30fps"
      },
      "battery": {
        "capacity": "4,400 mAh",
        "chargingSpeed": "25W Fast Charging",
        "wirelessCharging": "15W",
        "reverseCharging": "PowerShare",
        "usageHours": {
          "videoPlayback": "สูงสุด 23 ชั่วโมง",
          "audioPlayback": "สูงสุด 77 ชั่วโมง",
          "internetUsage": "สูงสุด 18 ชั่วโมง",
          "talkTime": "สูงสุด 35 ชั่วโมง",
          "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
          "chargingNote": "รองรับ 25W Fast Charging"
        }
      },
      "connectivityAndBuild": {
        "network": "5G, 4G LTE",
        "simType": "Dual SIM + eSIM",
        "wifi": "Wi-Fi 6E (802.11ax)",
        "bluetooth": "Bluetooth 5.3",
        "waterResistance": "IP48 กันน้ำ",
        "spenSupport": "รองรับ S Pen Fold Edition",
        "frameMaterial": "Armor Aluminum",
        "dimensions": "พับ: 153.5 x 68.1 x 11.8 มม. / กาง: 153.5 x 132.6 x 5.4 มม.",
        "weight": "235 กรัม"
      },
      "batteryHours": {
        "videoPlayback": "สูงสุด 23 ชั่วโมง",
        "audioPlayback": "สูงสุด 77 ชั่วโมง",
        "internetUsage": "สูงสุด 18 ชั่วโมง",
        "talkTime": "สูงสุด 35 ชั่วโมง",
        "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
        "chargingNote": "รองรับ 25W Fast Charging"
      }
    },
    "Z_FLIP8": {
      "modelGroup": "Galaxy Z Flip 8 5G",
      "officialName": "Samsung Galaxy Z Flip 8 5G (เครื่องศูนย์ไทย)",
      "source": "Samsung Thailand Official (samsung.com/th)",
      "marketRegion": "Thailand (THL)",
      "category": "SmartPhone",
      "display": {
        "screenSize": "จอหลัก 6.9 นิ้ว (พับตลับแป้ง) / จอนอก FlexWindow 3.9 นิ้ว",
        "panelType": "Dynamic AMOLED 2X (จอหลัก) / Super AMOLED (จอนอก)",
        "resolution": "FHD+ (2640 x 1080 พิกเซล, จอหลัก) / 720 x 748 พิกเซล (จอนอก)",
        "refreshRate": "1-120Hz Adaptive (จอหลัก) / 120Hz (จอนอก)",
        "peakBrightness": "2,600 nits (Vision Booster)",
        "glassProtection": "Corning Gorilla Glass Victus 2"
      },
      "performance": {
        "processor": "Qualcomm Snapdragon 8 Elite Gen 5 (3nm)",
        "cpuCores": "Octa-core",
        "gpu": "Adreno 840",
        "aiEngine": "Galaxy AI (FlexCam Auto Zoom, Now Nudge, Quick Reply บน One UI 9)"
      },
      "memory": {
        "ram": "12GB LPDDR5X",
        "storage": "256GB / 512GB (UFS 4.0)",
        "expandableStorage": "ไม่รองรับ MicroSD"
      },
      "camera": {
        "rearCamera": "คู่: 50MP (Main f/1.8, OIS, 2x Optical Quality Zoom) + 12MP (Ultra-Wide 123°)",
        "frontCamera": "10MP (f/2.2)",
        "videoRecording": "4K @ 60fps, 10-bit HDR"
      },
      "battery": {
        "capacity": "4,300 mAh (เพิ่มขึ้นจากเดิม ใช้งานได้ทั้งวัน)",
        "chargingSpeed": "25W Super Fast Charging",
        "wirelessCharging": "15W",
        "reverseCharging": "Wireless PowerShare",
        "usageHours": {
          "videoPlayback": "สูงสุด 26 ชั่วโมง",
          "audioPlayback": "สูงสุด 72 ชั่วโมง",
          "internetUsage": "สูงสุด 20 ชั่วโมง",
          "talkTime": "สูงสุด 37 ชั่วโมง",
          "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
          "chargingNote": "รองรับ 25W Fast Charging ชาร์จ 50% ใน 30 นาที"
        }
      },
      "connectivityAndBuild": {
        "network": "5G, 4G LTE",
        "simType": "1 Nano-SIM + รองรับ eSIM",
        "wifi": "Wi-Fi 7 / Wi-Fi 6E",
        "bluetooth": "Bluetooth 5.4",
        "waterResistance": "IP48 กันน้ำ",
        "spenSupport": "ไม่รองรับ",
        "frameMaterial": "Armor Aluminum & รอยพับเนียนบางลง",
        "dimensions": "พับ: 85.1 x 71.9 x 14.2 มม. / กาง: 165.1 x 71.9 x 6.6 มม.",
        "weight": "184 กรัม (บางและเบาที่สุด)"
      },
      "batteryHours": {
        "videoPlayback": "สูงสุด 26 ชั่วโมง",
        "audioPlayback": "สูงสุด 72 ชั่วโมง",
        "internetUsage": "สูงสุด 20 ชั่วโมง",
        "talkTime": "สูงสุด 37 ชั่วโมง",
        "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
        "chargingNote": "รองรับ 25W Fast Charging ชาร์จ 50% ใน 30 นาที"
      }
    },
    "Z_FLIP7": {
      "modelGroup": "Galaxy Z Flip7 5G",
      "officialName": "Samsung Galaxy Z Flip7 5G (เครื่องศูนย์ไทย)",
      "source": "Samsung Thailand Official (samsung.com/th)",
      "marketRegion": "Thailand (THL)",
      "category": "SmartPhone",
      "display": {
        "screenSize": "จอหลัก 6.9 นิ้ว 2X AMOLED / จอนอก FlexWindow 3.9 นิ้ว",
        "panelType": "Dynamic AMOLED 2X (จอหลัก) / Super AMOLED (จอนอก)",
        "resolution": "FHD+ (จอหลัก) / 720 x 748 พิกเซล (จอนอก)",
        "refreshRate": "1-120Hz Adaptive",
        "peakBrightness": "2,600 nits (Vision Booster)",
        "glassProtection": "Corning Gorilla Glass Victus 2"
      },
      "performance": {
        "processor": "Samsung Exynos 2500 (3nm)",
        "cpuCores": "Deca-core (Up to 3.2GHz)",
        "gpu": "Xclipse 950",
        "aiEngine": "Galaxy AI สำหรับตลับแป้ง (FlexCam AI, Auto Zoom, Photo Ambient)"
      },
      "memory": {
        "ram": "12GB LPDDR5X",
        "storage": "256GB / 512GB",
        "expandableStorage": "ไม่รองรับ MicroSD"
      },
      "camera": {
        "rearCamera": "คู่: 50MP (Main f/1.8, OIS) + 12MP (Ultra-Wide)",
        "frontCamera": "10MP (f/2.2)",
        "videoRecording": "4K @ 60fps"
      },
      "battery": {
        "capacity": "4,000 mAh",
        "chargingSpeed": "25W Fast Charging",
        "wirelessCharging": "15W",
        "reverseCharging": "PowerShare",
        "usageHours": {
          "videoPlayback": "สูงสุด 24 ชั่วโมง",
          "audioPlayback": "สูงสุด 68 ชั่วโมง",
          "internetUsage": "สูงสุด 18 ชั่วโมง",
          "talkTime": "สูงสุด 33 ชั่วโมง",
          "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
          "chargingNote": "รองรับ 25W Fast Charging"
        }
      },
      "connectivityAndBuild": {
        "network": "5G, 4G LTE",
        "simType": "Nano-SIM + eSIM",
        "wifi": "Wi-Fi 6E (802.11ax)",
        "bluetooth": "Bluetooth 5.3",
        "waterResistance": "IP48 กันน้ำ",
        "spenSupport": "ไม่รองรับ",
        "frameMaterial": "Armor Aluminum",
        "dimensions": "พับ: 85.1 x 71.9 x 14.9 มม. / กาง: 165.1 x 71.9 x 6.9 มม.",
        "weight": "187 กรัม"
      },
      "batteryHours": {
        "videoPlayback": "สูงสุด 24 ชั่วโมง",
        "audioPlayback": "สูงสุด 68 ชั่วโมง",
        "internetUsage": "สูงสุด 18 ชั่วโมง",
        "talkTime": "สูงสุด 33 ชั่วโมง",
        "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
        "chargingNote": "รองรับ 25W Fast Charging"
      }
    },
    "A57_5G": {
      "modelGroup": "Galaxy A57 5G",
      "officialName": "Samsung Galaxy A57 5G (เครื่องศูนย์ไทย)",
      "source": "Samsung Thailand Official (samsung.com/th)",
      "marketRegion": "Thailand (THL)",
      "category": "SmartPhone",
      "display": {
        "screenSize": "6.7 นิ้ว",
        "panelType": "Super AMOLED",
        "resolution": "FHD+ (2340 x 1080 พิกเซล, 385 ppi)",
        "refreshRate": "120Hz",
        "peakBrightness": "1,200 nits HBM (สูงสุด 1,900 nits Vision Booster)",
        "glassProtection": "Corning Gorilla Glass Victus+"
      },
      "performance": {
        "processor": "Samsung Exynos 1680 (4nm) / Exynos 1580 (4nm)",
        "cpuCores": "Octa-core (Prime Cortex-A720 2.9GHz + 3x A720 2.6GHz + 4x A520 1.95GHz)",
        "gpu": "AMD Xclipse 540 (RDNA 3 Architecture)",
        "aiEngine": "Galaxy AI (Circle to Search, Object Eraser, Best Face, 14.7 TOPS NPU)"
      },
      "memory": {
        "ram": "8GB / 12GB LPDDR5",
        "storage": "256GB / 512GB",
        "expandableStorage": "รองรับ MicroSD สูงสุด 1TB"
      },
      "camera": {
        "rearCamera": "3 เลนส์: 50MP (Main f/1.8, OIS, Big Pixel) + 12MP (Ultra-Wide f/2.2) + 5MP (Macro f/2.4)",
        "frontCamera": "12MP (f/2.2) ถ่ายเซลฟี่คมชัด Super HDR",
        "videoRecording": "4K @ 30fps พร้อม Super OIS และ VDIS"
      },
      "battery": {
        "capacity": "5,000 mAh ใช้งานได้ยาวนาน 2 วัน",
        "chargingSpeed": "45W Super Fast Charging",
        "wirelessCharging": "ไม่รองรับ",
        "reverseCharging": "ไม่รองรับ",
        "usageHours": {
          "videoPlayback": "สูงสุด 28 ชั่วโมง",
          "audioPlayback": "สูงสุด 85 ชั่วโมง",
          "internetUsage": "สูงสุด 23 ชั่วโมง (Wi-Fi / 5G)",
          "talkTime": "สูงสุด 40 ชั่วโมง",
          "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th) บนแบตเตอรี่ 5,000 mAh",
          "chargingNote": "รองรับ 45W Super Fast Charging"
        }
      },
      "connectivityAndBuild": {
        "network": "5G SA/NSA, 4G LTE",
        "simType": "Dual SIM (Nano-SIM + MicroSD หรือ Hybrid Slot)",
        "wifi": "Wi-Fi 6 (802.11ax)",
        "bluetooth": "Bluetooth 5.3",
        "waterResistance": "IP68 กันน้ำลึก 1.5 เมตร นาน 30 นาที",
        "spenSupport": "ไม่รองรับ",
        "frameMaterial": "กรอบโลหะ Metal Frame พรีเมียม และกระจกหลัง",
        "dimensions": "161.1 x 77.4 x 7.9 มม.",
        "weight": "209 กรัม"
      },
      "batteryHours": {
        "videoPlayback": "สูงสุด 28 ชั่วโมง",
        "audioPlayback": "สูงสุด 85 ชั่วโมง",
        "internetUsage": "สูงสุด 23 ชั่วโมง (Wi-Fi / 5G)",
        "talkTime": "สูงสุด 40 ชั่วโมง",
        "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th) บนแบตเตอรี่ 5,000 mAh",
        "chargingNote": "รองรับ 45W Super Fast Charging"
      }
    },
    "A37_5G": {
      "modelGroup": "Galaxy A37 5G",
      "officialName": "Samsung Galaxy A37 5G (เครื่องศูนย์ไทย)",
      "source": "Samsung Thailand Official (samsung.com/th)",
      "marketRegion": "Thailand (THL)",
      "category": "SmartPhone",
      "display": {
        "screenSize": "6.7 นิ้ว",
        "panelType": "Super AMOLED",
        "resolution": "FHD+ (1080 x 2340 พิกเซล, 19.5:9)",
        "refreshRate": "120Hz",
        "peakBrightness": "1,200 nits HBM (สูงสุด 1,900 nits Peak)",
        "glassProtection": "Corning Gorilla Glass Victus+"
      },
      "performance": {
        "processor": "Samsung Exynos 1480 (4nm)",
        "cpuCores": "Octa-core (4x Cortex-A78 2.75GHz & 4x Cortex-A55 2.0GHz)",
        "gpu": "AMD Xclipse 530 (RDNA Architecture)",
        "aiEngine": "Galaxy AI (Circle to Search, Live Translate, AI Photo Assist)"
      },
      "memory": {
        "ram": "8GB",
        "storage": "256GB",
        "expandableStorage": "รองรับ MicroSD สูงสุด 1TB"
      },
      "camera": {
        "rearCamera": "3 เลนส์: 50MP (Main f/1.8, OIS) + 8MP (Ultra-Wide f/2.2) + 5MP (Macro f/2.4)",
        "frontCamera": "13MP (f/2.2)",
        "videoRecording": "4K @ 30fps"
      },
      "battery": {
        "capacity": "5,000 mAh",
        "chargingSpeed": "25W / 45W Fast Charging",
        "wirelessCharging": "ไม่รองรับ",
        "reverseCharging": "ไม่รองรับ",
        "usageHours": {
          "videoPlayback": "สูงสุด 27 ชั่วโมง",
          "audioPlayback": "สูงสุด 83 ชั่วโมง",
          "internetUsage": "สูงสุด 22 ชั่วโมง",
          "talkTime": "สูงสุด 38 ชั่วโมง",
          "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
          "chargingNote": "รองรับ 25W / 45W Fast Charging"
        }
      },
      "connectivityAndBuild": {
        "network": "5G, 4G LTE",
        "simType": "Dual SIM (Hybrid)",
        "wifi": "Wi-Fi 6 (802.11ax)",
        "bluetooth": "Bluetooth 5.3",
        "waterResistance": "IP67 กันน้ำลึก 1 เมตร นาน 30 นาที",
        "spenSupport": "ไม่รองรับ",
        "frameMaterial": "Polycarbonate Frame",
        "dimensions": "161.7 x 77.8 x 7.9 มม.",
        "weight": "205 กรัม"
      },
      "batteryHours": {
        "videoPlayback": "สูงสุด 27 ชั่วโมง",
        "audioPlayback": "สูงสุด 83 ชั่วโมง",
        "internetUsage": "สูงสุด 22 ชั่วโมง",
        "talkTime": "สูงสุด 38 ชั่วโมง",
        "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
        "chargingNote": "รองรับ 25W / 45W Fast Charging"
      }
    },
    "A27_5G": {
      "modelGroup": "Galaxy A27 5G",
      "officialName": "Samsung Galaxy A27 5G (เครื่องศูนย์ไทย)",
      "source": "Samsung Thailand Official (samsung.com/th)",
      "marketRegion": "Thailand (THL)",
      "category": "SmartPhone",
      "display": {
        "screenSize": "6.7 นิ้ว",
        "panelType": "Super AMOLED",
        "resolution": "FHD+ (1080 x 2340 พิกเซล, 385 ppi)",
        "refreshRate": "120Hz",
        "peakBrightness": "1,000 nits (Vision Booster)",
        "glassProtection": "Corning Gorilla Glass Victus+"
      },
      "performance": {
        "processor": "Snapdragon 6 Gen 3 (4nm)",
        "cpuCores": "Octa-core (Up to 2.4GHz)",
        "gpu": "Adreno 710",
        "aiEngine": "Samsung Knox Vault"
      },
      "memory": {
        "ram": "8GB",
        "storage": "128GB",
        "expandableStorage": "รองรับ MicroSD สูงสุด 1TB"
      },
      "camera": {
        "rearCamera": "3 เลนส์: 50MP (Main f/1.8, OIS) + 8MP (Ultra-Wide f/2.2) + 2MP (Macro f/2.4)",
        "frontCamera": "12MP (f/2.2)",
        "videoRecording": "4K @ 30fps, 1080p @ 60fps"
      },
      "battery": {
        "capacity": "5,000 mAh",
        "chargingSpeed": "25W Fast Charging (Super Fast Charging)",
        "wirelessCharging": "ไม่รองรับ",
        "reverseCharging": "ไม่รองรับ",
        "usageHours": {
          "videoPlayback": "สูงสุด 26 ชั่วโมง (ดูวิดีโอต่อเนื่อง)",
          "audioPlayback": "สูงสุด 80 ชั่วโมง (ฟังเพลงต่อเนื่อง)",
          "internetUsage": "สูงสุด 21 ชั่วโมง (Wi-Fi / LTE)",
          "talkTime": "สูงสุด 38 ชั่วโมง (สนทนาสาย 4G)",
          "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
          "chargingNote": "รองรับ 25W Fast Charging"
        }
      },
      "connectivityAndBuild": {
        "network": "5G Sub6 / SA / NSA, 4G LTE",
        "simType": "Dual SIM (Nano-SIM + eSIM หรือ Hybrid)",
        "wifi": "Wi-Fi 6 (802.11ax)",
        "bluetooth": "Bluetooth 5.4",
        "waterResistance": "IP67 กันน้ำลึก 1 เมตร นาน 30 นาที",
        "spenSupport": "ไม่รองรับ",
        "frameMaterial": "Polycarbonate Frame",
        "dimensions": "164.2 x 77.5 x 7.9 มม.",
        "weight": "199 กรัม"
      },
      "batteryHours": {
        "videoPlayback": "สูงสุด 26 ชั่วโมง (ดูวิดีโอต่อเนื่อง)",
        "audioPlayback": "สูงสุด 80 ชั่วโมง (ฟังเพลงต่อเนื่อง)",
        "internetUsage": "สูงสุด 21 ชั่วโมง (Wi-Fi / LTE)",
        "talkTime": "สูงสุด 38 ชั่วโมง (สนทนาสาย 4G)",
        "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
        "chargingNote": "รองรับ 25W Fast Charging"
      }
    },
    "A17_5G": {
      "modelGroup": "Galaxy A17 5G",
      "officialName": "Samsung Galaxy A17 5G (เครื่องศูนย์ไทย)",
      "source": "Samsung Thailand Official (samsung.com/th)",
      "marketRegion": "Thailand (THL)",
      "category": "SmartPhone",
      "display": {
        "screenSize": "6.7 นิ้ว จอใหญ่เต็มตา",
        "panelType": "Super AMOLED",
        "resolution": "FHD+ (1080 x 2340 พิกเซล, 385 ppi)",
        "refreshRate": "90Hz",
        "peakBrightness": "800 nits (Vision Booster)",
        "glassProtection": "Corning Gorilla Glass"
      },
      "performance": {
        "processor": "MediaTek Dimensity 6300 (6nm) หรือ Exynos 1330",
        "cpuCores": "Octa-core (Up to 2.4GHz)",
        "gpu": "Mali-G57 MC2",
        "aiEngine": "Samsung Knox Security"
      },
      "memory": {
        "ram": "8GB",
        "storage": "128GB / 256GB",
        "expandableStorage": "รองรับ MicroSD สูงสุด 1TB"
      },
      "camera": {
        "rearCamera": "3 เลนส์: 50MP (Main f/1.8) + 5MP (Ultra-Wide) + 2MP (Macro)",
        "frontCamera": "13MP (f/2.0)",
        "videoRecording": "1080p @ 30fps"
      },
      "battery": {
        "capacity": "5,000 mAh",
        "chargingSpeed": "25W Fast Charging",
        "wirelessCharging": "ไม่รองรับ",
        "reverseCharging": "ไม่รองรับ",
        "usageHours": {
          "videoPlayback": "สูงสุด 26 ชั่วโมง",
          "audioPlayback": "สูงสุด 79 ชั่วโมง",
          "internetUsage": "สูงสุด 20 ชั่วโมง",
          "talkTime": "สูงสุด 38 ชั่วโมง",
          "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
          "chargingNote": "รองรับ 25W Fast Charging"
        }
      },
      "connectivityAndBuild": {
        "network": "5G, 4G LTE",
        "simType": "Dual SIM (Hybrid Slot)",
        "wifi": "Wi-Fi 5",
        "bluetooth": "Bluetooth 5.3",
        "waterResistance": "IP54 ป้องกันละอองน้ำและฝุ่น",
        "spenSupport": "ไม่รองรับ",
        "frameMaterial": "Polycarbonate",
        "dimensions": "164.4 x 77.9 x 7.9 มม.",
        "weight": "200 กรัม"
      },
      "batteryHours": {
        "videoPlayback": "สูงสุด 26 ชั่วโมง",
        "audioPlayback": "สูงสุด 79 ชั่วโมง",
        "internetUsage": "สูงสุด 20 ชั่วโมง",
        "talkTime": "สูงสุด 38 ชั่วโมง",
        "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
        "chargingNote": "รองรับ 25W Fast Charging"
      }
    },
    "A17_LTE": {
      "modelGroup": "Galaxy A17 LTE (4G)",
      "officialName": "Samsung Galaxy A17 LTE 8/128GB (เครื่องศูนย์ไทย)",
      "source": "Samsung Thailand Official (samsung.com/th)",
      "marketRegion": "Thailand (THL)",
      "category": "SmartPhone",
      "display": {
        "screenSize": "6.7 นิ้ว",
        "panelType": "Super AMOLED",
        "resolution": "FHD+ (1080 x 2340 พิกเซล)",
        "refreshRate": "90Hz",
        "peakBrightness": "800 nits",
        "glassProtection": "Corning Gorilla Glass"
      },
      "performance": {
        "processor": "MediaTek Helio G99 (6nm)",
        "cpuCores": "Octa-core (Up to 2.2GHz)",
        "gpu": "Mali-G57 MC2",
        "aiEngine": "Samsung Knox"
      },
      "memory": {
        "ram": "8GB",
        "storage": "128GB",
        "expandableStorage": "รองรับ MicroSD สูงสุด 1TB"
      },
      "camera": {
        "rearCamera": "3 เลนส์: 50MP (Main f/1.8) + 5MP (Ultra-Wide) + 2MP (Macro)",
        "frontCamera": "13MP (f/2.0)",
        "videoRecording": "1080p @ 30fps"
      },
      "battery": {
        "capacity": "5,000 mAh",
        "chargingSpeed": "25W Fast Charging",
        "wirelessCharging": "ไม่รองรับ",
        "reverseCharging": "ไม่รองรับ",
        "usageHours": {
          "videoPlayback": "สูงสุด 26 ชั่วโมง",
          "audioPlayback": "สูงสุด 79 ชั่วโมง",
          "internetUsage": "สูงสุด 20 ชั่วโมง",
          "talkTime": "สูงสุด 38 ชั่วโมง",
          "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
          "chargingNote": "รองรับ 25W Fast Charging"
        }
      },
      "connectivityAndBuild": {
        "network": "4G LTE, 3G, 2G",
        "simType": "Dual SIM (Nano-SIM)",
        "wifi": "Wi-Fi 5",
        "bluetooth": "Bluetooth 5.3",
        "waterResistance": "IP54 ป้องกันละอองน้ำและฝุ่น",
        "spenSupport": "ไม่รองรับ",
        "frameMaterial": "Polycarbonate",
        "dimensions": "164.4 x 77.9 x 7.9 มม.",
        "weight": "200 กรัม"
      },
      "batteryHours": {
        "videoPlayback": "สูงสุด 26 ชั่วโมง",
        "audioPlayback": "สูงสุด 79 ชั่วโมง",
        "internetUsage": "สูงสุด 20 ชั่วโมง",
        "talkTime": "สูงสุด 38 ชั่วโมง",
        "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
        "chargingNote": "รองรับ 25W Fast Charging"
      }
    },
    "A07_5G": {
      "modelGroup": "Galaxy A07 5G",
      "officialName": "Samsung Galaxy A07 5G 6/128GB (เครื่องศูนย์ไทย)",
      "source": "Samsung Thailand Official (samsung.com/th)",
      "marketRegion": "Thailand (THL)",
      "category": "SmartPhone",
      "display": {
        "screenSize": "6.7 นิ้ว",
        "panelType": "PLS LCD",
        "resolution": "HD+ (1600 x 720 พิกเซล)",
        "refreshRate": "90Hz",
        "peakBrightness": "500 nits",
        "glassProtection": "กระจกนิรภัยมาตรฐาน"
      },
      "performance": {
        "processor": "MediaTek Dimensity 6100+ (6nm)",
        "cpuCores": "Octa-core (Up to 2.2GHz)",
        "gpu": "Mali-G57 MC2",
        "aiEngine": "Samsung Knox"
      },
      "memory": {
        "ram": "6GB",
        "storage": "128GB",
        "expandableStorage": "รองรับ MicroSD สูงสุด 1TB"
      },
      "camera": {
        "rearCamera": "คู่: 50MP (Main f/1.8) + 2MP (Depth)",
        "frontCamera": "8MP (f/2.0)",
        "videoRecording": "1080p @ 30fps"
      },
      "battery": {
        "capacity": "5,000 mAh",
        "chargingSpeed": "25W Fast Charging",
        "wirelessCharging": "ไม่รองรับ",
        "reverseCharging": "ไม่รองรับ",
        "usageHours": {
          "videoPlayback": "สูงสุด 22 ชั่วโมง",
          "audioPlayback": "สูงสุด 70 ชั่วโมง",
          "internetUsage": "สูงสุด 19 ชั่วโมง (Wi-Fi)",
          "talkTime": "สูงสุด 35 ชั่วโมง",
          "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
          "chargingNote": "รองรับ 25W Fast Charging"
        }
      },
      "connectivityAndBuild": {
        "network": "5G, 4G LTE",
        "simType": "Dual SIM (Hybrid)",
        "wifi": "Wi-Fi 5",
        "bluetooth": "Bluetooth 5.3",
        "waterResistance": "ป้องกันละอองน้ำทั่วไป",
        "spenSupport": "ไม่รองรับ",
        "frameMaterial": "Polycarbonate",
        "dimensions": "167.3 x 77.3 x 8.0 มม.",
        "weight": "195 กรัม"
      },
      "batteryHours": {
        "videoPlayback": "สูงสุด 22 ชั่วโมง",
        "audioPlayback": "สูงสุด 70 ชั่วโมง",
        "internetUsage": "สูงสุด 19 ชั่วโมง (Wi-Fi)",
        "talkTime": "สูงสุด 35 ชั่วโมง",
        "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th)",
        "chargingNote": "รองรับ 25W Fast Charging"
      }
    },
    "A07_4G": {
      "modelGroup": "Galaxy A07 4G",
      "officialName": "Samsung Galaxy A07 4G (เครื่องศูนย์ไทย)",
      "source": "Samsung Thailand Official (samsung.com/th)",
      "marketRegion": "Thailand (THL)",
      "category": "SmartPhone",
      "display": {
        "screenSize": "6.7 นิ้ว จอใหญ่เต็มตา ดูคอนเทนต์จุใจ",
        "panelType": "PLS LCD",
        "resolution": "HD+ (1600 x 720 พิกเซล)",
        "refreshRate": "60Hz",
        "peakBrightness": "500 nits",
        "glassProtection": "กระจกนิรภัยมาตรฐาน"
      },
      "performance": {
        "processor": "MediaTek Helio G85 (12nm)",
        "cpuCores": "Octa-core (2x2.0 GHz Cortex-A75 & 6x1.8 GHz Cortex-A55)",
        "gpu": "Mali-G52 MC2",
        "aiEngine": "Samsung Knox Vault Security"
      },
      "memory": {
        "ram": "4GB / 6GB (พร้อม RAM Plus)",
        "storage": "64GB / 128GB (eMMC 5.1)",
        "expandableStorage": "รองรับ MicroSD Card สูงสุด 1TB"
      },
      "camera": {
        "rearCamera": "กล้องคู่: 50MP (Main f/1.8, ออโต้โฟกัส) + 2MP (Depth f/2.4 ถ่ายภาพหน้าชัดหลังเบลอ)",
        "frontCamera": "8MP (f/2.0)",
        "videoRecording": "FHD 1080p @ 60fps"
      },
      "battery": {
        "capacity": "5,000 mAh แบตเตอรี่อึดใช้งานได้ทั้งวัน",
        "chargingSpeed": "25W Fast Charging (ชาร์จเร็วขึ้นอย่างเห็นได้ชัด)",
        "wirelessCharging": "ไม่รองรับ",
        "reverseCharging": "ไม่รองรับ",
        "usageHours": {
          "videoPlayback": "สูงสุด 22 ชั่วโมง",
          "audioPlayback": "สูงสุด 70 ชั่วโมง",
          "internetUsage": "สูงสุด 19 ชั่วโมง (Wi-Fi / LTE)",
          "talkTime": "สูงสุด 35 ชั่วโมง",
          "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th) บนแบตเตอรี่ 5,000 mAh",
          "chargingNote": "รองรับ 25W Fast Charging"
        }
      },
      "connectivityAndBuild": {
        "network": "4G LTE, 3G, 2G (รองรับทุกเครือข่าย AIS, TRUE, DTAC)",
        "simType": "Triple Slot: 2 Nano-SIM + 1 MicroSD (ไม่ต้องสลับซิม)",
        "wifi": "Wi-Fi 5 (802.11 a/b/g/n/ac 2.4G+5GHz)",
        "bluetooth": "Bluetooth 5.3",
        "waterResistance": "มาตรฐานทั่วไป",
        "spenSupport": "ไม่รองรับ",
        "headphoneJack": "มีช่องเสียบหูฟัง 3.5 มม.",
        "frameMaterial": "ตัวเครื่องเพรียวบาง 8.0 มม. ดีไซน์ลวดลายมินิมอล",
        "dimensions": "167.3 x 77.3 x 8.0 มม.",
        "weight": "189 กรัม"
      },
      "batteryHours": {
        "videoPlayback": "สูงสุด 22 ชั่วโมง",
        "audioPlayback": "สูงสุด 70 ชั่วโมง",
        "internetUsage": "สูงสุด 19 ชั่วโมง (Wi-Fi / LTE)",
        "talkTime": "สูงสุด 35 ชั่วโมง",
        "testCondition": "ผลทดสอบทางการ Samsung Thailand Official Lab (samsung.com/th) บนแบตเตอรี่ 5,000 mAh",
        "chargingNote": "รองรับ 25W Fast Charging"
      }
    },
    "TAB_S11_ULTRA": {
        "modelGroup": "Galaxy Tab S11 Ultra 5G",
        "officialName": "Samsung Galaxy Tab S11 Ultra 5G 12/256GB (เครื่องศูนย์ไทย)",
        "source": "Samsung Thailand Official (samsung.com/th)",
        "marketRegion": "Thailand (THL)",
        "category": "Tablet",
        "display": {
            "screenSize": "14.6 นิ้ว จอใหญ่ยักษ์ระดับโรงภาพยนตร์",
            "panelType": "Dynamic AMOLED 2X",
            "resolution": "WQXGA+ (2960 x 1848 พิกเซล)",
            "refreshRate": "120Hz",
            "peakBrightness": "930 nits (Anti-Reflection Glass)",
            "glassProtection": "Armor Aluminum Unibody"
        },
        "performance": {
            "processor": "MediaTek Dimensity 9300+ (4nm Flagship)",
            "cpuCores": "Octa-core All-Big-Core (3.4GHz)",
            "gpu": "Immortalis-G720",
            "aiEngine": "Galaxy AI บนจอใหญ่ (Drawing Assist, Math Helper, Samsung DeX)"
        },
        "memory": {
            "ram": "12GB",
            "storage": "256GB (UFS 4.0)",
            "expandableStorage": "รองรับ MicroSD สูงสุด 1.5TB"
        },
        "camera": {
            "rearCamera": "คู่: 13MP (Main) + 8MP (Ultra-Wide)",
            "frontCamera": "กล้องหน้าคู่ 12MP (Wide) + 12MP (Ultra-Wide 120°) เหมาะสำหรับประชุมออนไลน์",
            "videoRecording": "4K @ 60fps"
        },
        "battery": {
            "capacity": "11,200 mAh",
            "chargingSpeed": "45W Fast Charging 2.0",
            "wirelessCharging": "ไม่รองรับ",
            "reverseCharging": "รองรับ Reverse Wired Charging"
        },
        "connectivityAndBuild": {
            "network": "5G, 4G LTE",
            "simType": "1 Nano-SIM + รองรับ eSIM",
            "wifi": "Wi-Fi 7",
            "bluetooth": "Bluetooth 5.3",
            "waterResistance": "IP68 กันน้ำกันฝุ่น ทั้งตัวแท็บเล็ตและปากกา S Pen",
            "spenSupport": "มีปากกา S Pen รองรับในกล่อง (แถมฟรีไม่ต้องซื้อเพิ่ม)",
            "speakers": "ลำโพง 4 ตัวปรับจูนโดย AKG พร้อม Dolby Atmos",
            "dimensions": "326.4 x 208.6 x 5.4 มม. (บางเฉียบเพียง 5.4 มม.)",
            "weight": "723 กรัม"
        }
    },
    "TAB_S10_PLUS": {
        "modelGroup": "Galaxy Tab S10+ (5G & Wi-Fi)",
        "officialName": "Samsung Galaxy Tab S10+ (เครื่องศูนย์ไทย)",
        "source": "Samsung Thailand Official (samsung.com/th)",
        "marketRegion": "Thailand (THL)",
        "category": "Tablet",
        "display": {
            "screenSize": "12.4 นิ้ว",
            "panelType": "Dynamic AMOLED 2X",
            "resolution": "WQXGA+ (2800 x 1752 พิกเซล)",
            "refreshRate": "120Hz",
            "peakBrightness": "650 nits (Anti-Reflection)",
            "glassProtection": "Enhanced Armor Aluminum"
        },
        "performance": {
            "processor": "MediaTek Dimensity 9300+ (4nm)",
            "cpuCores": "Octa-core",
            "gpu": "Immortalis-G720",
            "aiEngine": "Galaxy AI"
        },
        "memory": {
            "ram": "12GB",
            "storage": "256GB / 512GB",
            "expandableStorage": "รองรับ MicroSD สูงสุด 1.5TB"
        },
        "camera": {
            "rearCamera": "13MP + 8MP (Ultra-Wide)",
            "frontCamera": "12MP (Ultra-Wide)",
            "videoRecording": "4K @ 30fps"
        },
        "battery": {
            "capacity": "10,090 mAh",
            "chargingSpeed": "45W Fast Charging",
            "wirelessCharging": "ไม่รองรับ",
            "reverseCharging": "Wired PowerShare"
        },
        "connectivityAndBuild": {
            "network": "5G (รุ่น 5G) หรือ Wi-Fi Only (รุ่น Wifi)",
            "simType": "Nano-SIM + eSIM (รุ่น 5G)",
            "wifi": "Wi-Fi 6E / Wi-Fi 7",
            "bluetooth": "Bluetooth 5.3",
            "waterResistance": "IP68 กันน้ำทั้งตัวเครื่องและ S Pen",
            "spenSupport": "มีปากกา S Pen แถมในกล่อง",
            "speakers": "ลำโพง 4 ตัว AKG Dolby Atmos",
            "dimensions": "285.4 x 185.4 x 5.6 มม.",
            "weight": "571 กรัม"
        }
    },
    "TAB_S10_FE_PLUS": {
        "modelGroup": "Galaxy Tab S10 FE+ (5G & Wi-Fi)",
        "officialName": "Samsung Galaxy Tab S10 FE+ (เครื่องศูนย์ไทย)",
        "source": "Samsung Thailand Official (samsung.com/th)",
        "marketRegion": "Thailand (THL)",
        "category": "Tablet",
        "display": {
            "screenSize": "12.4 นิ้ว",
            "panelType": "IPS LCD",
            "resolution": "WQXGA (2560 x 1600 พิกเซล)",
            "refreshRate": "90Hz",
            "peakBrightness": "600 nits (Vision Booster)",
            "glassProtection": "Metal Unibody"
        },
        "performance": {
            "processor": "Exynos 1380 (5nm)",
            "cpuCores": "Octa-core (Up to 2.4GHz)",
            "gpu": "Mali-G68 MP5",
            "aiEngine": "Samsung Knox Vault"
        },
        "memory": {
            "ram": "8GB / 12GB",
            "storage": "128GB / 256GB",
            "expandableStorage": "รองรับ MicroSD สูงสุด 1TB"
        },
        "camera": {
            "rearCamera": "คู่: 8MP + 8MP (Ultra-Wide)",
            "frontCamera": "12MP (Ultra-Wide)",
            "videoRecording": "4K @ 30fps"
        },
        "battery": {
            "capacity": "10,090 mAh",
            "chargingSpeed": "45W Fast Charging",
            "wirelessCharging": "ไม่รองรับ",
            "reverseCharging": "รองรับ"
        },
        "connectivityAndBuild": {
            "network": "5G (รุ่น 5G) หรือ Wi-Fi Only",
            "simType": "Nano-SIM + eSIM (รุ่น 5G)",
            "wifi": "Wi-Fi 6",
            "bluetooth": "Bluetooth 5.3",
            "waterResistance": "IP68 กันน้ำลึก 1.5 เมตร",
            "spenSupport": "มีปากกา S Pen แถมในกล่อง",
            "speakers": "ลำโพงคู่ Dual Speakers AKG",
            "dimensions": "285.4 x 185.4 x 6.5 มม.",
            "weight": "628 กรัม"
        }
    },
    "TAB_S10_LITE": {
        "modelGroup": "Galaxy Tab S10 Lite (5G & Wi-Fi)",
        "officialName": "Samsung Galaxy Tab S10 Lite 6/128GB (เครื่องศูนย์ไทย)",
        "source": "Samsung Thailand Official (samsung.com/th)",
        "marketRegion": "Thailand (THL)",
        "category": "Tablet",
        "display": {
            "screenSize": "10.9 นิ้ว",
            "panelType": "IPS LCD",
            "resolution": "WQXGA (2304 x 1440 พิกเซล)",
            "refreshRate": "90Hz",
            "peakBrightness": "600 nits",
            "glassProtection": "Metal Unibody"
        },
        "performance": {
            "processor": "Exynos 1380 (5nm)",
            "cpuCores": "Octa-core",
            "gpu": "Mali-G68 MP5",
            "aiEngine": "Samsung DeX Support"
        },
        "memory": {
            "ram": "6GB",
            "storage": "128GB",
            "expandableStorage": "รองรับ MicroSD สูงสุด 1TB"
        },
        "camera": {
            "rearCamera": "8MP",
            "frontCamera": "12MP (Ultra-Wide)",
            "videoRecording": "1080p @ 30fps"
        },
        "battery": {
            "capacity": "8,000 mAh",
            "chargingSpeed": "45W Fast Charging",
            "wirelessCharging": "ไม่รองรับ",
            "reverseCharging": "รองรับ"
        },
        "connectivityAndBuild": {
            "network": "5G (P/N: SM-X406 / F-X406) หรือ Wi-Fi (P/N: SM-X400 / F-X400)",
            "simType": "Nano-SIM (รุ่น 5G)",
            "wifi": "Wi-Fi 6",
            "bluetooth": "Bluetooth 5.3",
            "waterResistance": "IP68 กันน้ำ",
            "spenSupport": "รองรับปากกา S Pen",
            "speakers": "ลำโพงคู่ AKG Dolby Atmos",
            "dimensions": "254.3 x 165.8 x 6.5 มม.",
            "weight": "524 กรัม"
        }
    },
    "TAB_A11": {
        "modelGroup": "Galaxy Tab A11 / A11+",
        "officialName": "Samsung Galaxy Tab A11 Series (เครื่องศูนย์ไทย)",
        "source": "Samsung Thailand Official (samsung.com/th)",
        "marketRegion": "Thailand (THL)",
        "category": "Tablet",
        "display": {
            "screenSize": "11.0 นิ้ว (A11+) หรือ 8.7 นิ้ว (A11)",
            "panelType": "TFT LCD",
            "resolution": "WUXGA (1920 x 1200 พิกเซล)",
            "refreshRate": "90Hz",
            "peakBrightness": "570 nits",
            "glassProtection": "Metal Back Finish"
        },
        "performance": {
            "processor": "Qualcomm Snapdragon 695 5G (6nm) หรือ Helio G99",
            "cpuCores": "Octa-core",
            "gpu": "Adreno 619",
            "aiEngine": "Samsung Kids & Multi-Active Window"
        },
        "memory": {
            "ram": "4GB / 6GB / 8GB",
            "storage": "64GB / 128GB",
            "expandableStorage": "รองรับ MicroSD สูงสุด 1TB"
        },
        "camera": {
            "rearCamera": "8MP (Autofocus)",
            "frontCamera": "5MP",
            "videoRecording": "1080p @ 30fps"
        },
        "battery": {
            "capacity": "7,040 mAh (รุ่น 11 นิ้ว) หรือ 5,100 mAh (รุ่น 8.7 นิ้ว)",
            "chargingSpeed": "15W Fast Charging",
            "wirelessCharging": "ไม่รองรับ",
            "reverseCharging": "ไม่รองรับ"
        },
        "connectivityAndBuild": {
            "network": "5G (รุ่น 5G), 4G LTE (รุ่น LTE), Wi-Fi Only",
            "simType": "Nano-SIM (รุ่น Cell)",
            "wifi": "Wi-Fi 5 (802.11ac)",
            "bluetooth": "Bluetooth 5.1",
            "waterResistance": "มาตรฐานทั่วไป",
            "spenSupport": "ไม่รองรับ",
            "speakers": "ลำโพง 4 ตัว Quad Speakers Dolby Atmos",
            "dimensions": "257.1 x 168.7 x 6.9 มม.",
            "weight": "480 กรัม"
        }
    },

    # ==========================================
    # SMARTWATCHES: GALAXY WATCH
    # ==========================================
    "WATCH_ULTRA": {
        "modelGroup": "Galaxy Watch Ultra / Ultra2 (LTE)",
        "officialName": "Samsung Galaxy Watch Ultra 47mm LTE (เครื่องศูนย์ไทย)",
        "source": "Samsung Thailand Official (samsung.com/th)",
        "marketRegion": "Thailand (THL)",
        "category": "Watch",
        "display": {
            "screenSize": "1.5 นิ้ว ทรงกลมในกรอบ Cushion Design",
            "panelType": "Super AMOLED Always-On Display",
            "resolution": "480 x 480 พิกเซล (327 ppi)",
            "peakBrightness": "3,000 nits สู้แดดจ้าได้คมชัดที่สุด",
            "glassProtection": "Sapphire Crystal Glass ทนทานรอยขีดข่วนระดับสูงสุด"
        },
        "performance": {
            "processor": "Exynos W1000 (3nm Penta-core ชิปนาฬิกาที่เร็วที่สุด)",
            "os": "Wear OS Powered by Samsung (One UI 6 Watch)",
            "aiEngine": "Galaxy AI Health (Energy Score, Personalized Heart Rate Zones, Sleep Apnea Detection)"
        },
        "memory": {
            "ram": "2GB",
            "storage": "32GB / 64GB"
        },
        "battery": {
            "capacity": "590 mAh แบตเตอรี่ใหญ่ที่สุดใน Galaxy Watch",
            "batteryLife": "ใช้งานโหมดประหยัดพลังงานได้สูงสุด 100 ชั่วโมง (โหมดออกกำลังกาย 48 ชม.)",
            "charging": "WPC-based Wireless Fast Charging"
        },
        "connectivityAndBuild": {
            "network": "4G LTE (eSIM ในตัว โทรออก-รับสายไม่ต้องพกมือถือ)",
            "wifi": "Wi-Fi dual-band (2.4GHz + 5GHz)",
            "bluetooth": "Bluetooth 5.3",
            "gps": "Dual-Frequency GPS (L1 + L5) แม่นยำระดับเซนติเมตรแม้อยู่ในตึกสูง",
            "nfc": "รองรับ Samsung Pay / Google Wallet",
            "durability": "10ATM + IP68 กันน้ำลึก 100 เมตร ดำน้ำทะเลได้, ผ่านมาตรฐานทหาร MIL-STD-810H",
            "frameMaterial": "ตัวเรือนไทเทเนียมเกรด 4 อากาศยาน (Aerospace Titanium Grade 4)",
            "specialButtons": "Quick Button สีส้มสำหรับเริ่มออกกำลังกายหรือเปิดไซเรนฉุกเฉิน 86dB",
            "dimensions": "47.4 x 47.4 x 12.1 มม.",
            "weight": "60.5 กรัม"
        }
    },
    "WATCH8_CLASSIC": {
        "modelGroup": "Galaxy Watch8 Classic (BT & LTE)",
        "officialName": "Samsung Galaxy Watch8 Classic (เครื่องศูนย์ไทย)",
        "source": "Samsung Thailand Official (samsung.com/th)",
        "marketRegion": "Thailand (THL)",
        "category": "Watch",
        "display": {
            "screenSize": "1.5 นิ้ว พร้อมขอบหน้าปัดหมุนได้จริง (Rotating Bezel)",
            "panelType": "Super AMOLED",
            "resolution": "480 x 480 พิกเซล",
            "peakBrightness": "2,000 nits",
            "glassProtection": "Sapphire Crystal"
        },
        "performance": {
            "processor": "Exynos W1000 (3nm)",
            "os": "Wear OS",
            "aiEngine": "Galaxy AI Health"
        },
        "memory": {
            "ram": "2GB",
            "storage": "32GB"
        },
        "battery": {
            "capacity": "425 mAh",
            "batteryLife": "สูงสุด 40 ชั่วโมง",
            "charging": "Wireless Fast Charging"
        },
        "connectivityAndBuild": {
            "network": "LTE (รุ่น LTE eSIM) หรือ Bluetooth (รุ่น BT)",
            "wifi": "Wi-Fi 2.4/5GHz",
            "bluetooth": "Bluetooth 5.3",
            "waterResistance": "5ATM + IP68 กันน้ำ 50 เมตร",
            "frameMaterial": "Stainless Steel Frame หรูหราคลาสสิก",
            "dimensions": "46.5 x 46.5 x 10.9 มม.",
            "weight": "59 กรัม"
        }
    },
    "WATCH_STANDARD": {
        "modelGroup": "Galaxy Watch7 / Watch8 / Watch9",
        "officialName": "Samsung Galaxy Watch Standard Series (เครื่องศูนย์ไทย)",
        "source": "Samsung Thailand Official (samsung.com/th)",
        "marketRegion": "Thailand (THL)",
        "category": "Watch",
        "display": {
            "screenSize": "1.3 นิ้ว (40mm) หรือ 1.5 นิ้ว (44mm)",
            "panelType": "Super AMOLED",
            "resolution": "432x432 (40mm) / 480x480 (44mm)",
            "glassProtection": "Sapphire Crystal"
        },
        "performance": {
            "processor": "Exynos W1000 (3nm)",
            "os": "Wear OS Powered by Samsung",
            "aiEngine": "BioActive Sensor (ECG, BIA วัดไขมันกล้ามเนื้อ, ตรวจจับการนอนหลับ)"
        },
        "memory": {
            "ram": "2GB",
            "storage": "32GB"
        },
        "battery": {
            "capacity": "300 mAh (40mm) / 425 mAh (44mm)",
            "charging": "Wireless Fast Charging"
        },
        "connectivityAndBuild": {
            "network": "Bluetooth 5.3, Wi-Fi",
            "gps": "Dual-Frequency GPS (L1+L5)",
            "waterResistance": "5ATM + IP68, MIL-STD-810H",
            "frameMaterial": "Armor Aluminum",
            "weight": "28.8 กรัม (40mm) / 33.8 กรัม (44mm)"
        }
    },
    "FIT3": {
        "modelGroup": "Galaxy Fit3",
        "officialName": "Samsung Galaxy Fit3 (เครื่องศูนย์ไทย)",
        "source": "Samsung Thailand Official (samsung.com/th)",
        "marketRegion": "Thailand (THL)",
        "category": "Watch",
        "display": {
            "screenSize": "1.6 นิ้ว จอสีสี่เหลี่ยมผืนผ้าใหญ่ขึ้น 45%",
            "panelType": "AMOLED",
            "resolution": "256 x 402 พิกเซล",
            "glassProtection": "2.5D Curved Glass"
        },
        "performance": {
            "processor": "RTOS System ควบคุมเร็ว แบตเตอรี่อึดเป็นพิเศษ",
            "sensors": "วัดอัตราการเต้นหัวใจ, ติดตามการนอนหลับ, SpO2 วัดออกซิเจนในเลือด, Fall Detection ตรวจจับการล้ม"
        },
        "memory": {
            "ram": "16MB",
            "storage": "256MB"
        },
        "battery": {
            "capacity": "208 mAh",
            "batteryLife": "ใช้งานต่อเนื่องสูงสุด 13 วัน ต่อการชาร์จ 1 ครั้ง",
            "charging": "สายชาร์จแม่เหล็ก Pogo Pin (ชาร์จ 65% ใน 30 นาที)"
        },
        "connectivityAndBuild": {
            "network": "Bluetooth 5.3",
            "waterResistance": "5ATM + IP68 กันน้ำลึก 50 เมตร",
            "frameMaterial": "อลูมิเนียมพรีเมียมขัดทราย (Sandblasted Aluminum)",
            "dimensions": "42.9 x 28.8 x 9.9 มม.",
            "weight": "18.5 กรัม (เบาสบายใส่หลับได้)"
        }
    },

    # ==========================================
    # WIRELESS EARBUDS: GALAXY BUDS
    # ==========================================
    "BUDS4_PRO": {
        "modelGroup": "Galaxy Buds4 Pro / Buds3 Pro",
        "officialName": "Samsung Galaxy Buds Pro Series (เครื่องศูนย์ไทย)",
        "source": "Samsung Thailand Official (samsung.com/th)",
        "marketRegion": "Thailand (THL)",
        "category": "Buds",
        "audio": {
            "drivers": "ลำโพง 2 ทาง (Woofer 10.5 มม. + Planar Tweeter 6.1 มม.) พร้อมแอมป์แยกอิสระ",
            "anc": "Active Noise Cancelling ปรับเปลี่ยนตามสิ่งแวดล้อมอัตโนมัติ (Adaptive ANC)",
            "soundQuality": "24-bit / 96kHz Hi-Res Audio (Samsung Seamless Codec)",
            "microphones": "ไมโครโฟน 3 ตัว + Voice Pickup Unit (VPU) + Blade Lights ไฟแสดงสถานะ"
        },
        "aiFeatures": "Galaxy AI Interpreter (แปลภาษาแบบเรียลไทม์ผ่านหูฟัง), Voice Detect สลับโหมดสนทนาอัตโนมัติ",
        "battery": {
            "earbudsCapacity": "53 mAh ต่อข้าง (ฟังเพลงต่อเนื่อง 6-7 ชม.)",
            "caseCapacity": "515 mAh (รวมตลับชาร์จสูงสุด 30 ชม.)",
            "charging": "ชาร์จเร็ว USB-C และรองรับชาร์จไร้สาย Qi"
        },
        "connectivityAndBuild": {
            "bluetooth": "Bluetooth 5.4 พร้อมฟังก์ชัน Auto Switch สลับเครื่อง Samsung อัตโนมัติ",
            "waterResistance": "IP57 กันน้ำกันเหงื่อใส่ออกกำลังกายได้",
            "weight": "5.4 กรัมต่อข้าง (ตลับ 46.5 กรัม)"
        }
    },
    "BUDS_STANDARD": {
        "modelGroup": "Galaxy Buds4 / Buds3 FE / Buds Core",
        "officialName": "Samsung Galaxy Buds Series (เครื่องศูนย์ไทย)",
        "source": "Samsung Thailand Official (samsung.com/th)",
        "marketRegion": "Thailand (THL)",
        "category": "Buds",
        "audio": {
            "drivers": "ไดร์เวอร์ขับเสียง Dynamic ขนาดใหญ่ เบสแน่นเสียงใส",
            "anc": "Active Noise Cancelling ตัดเสียงรบกวนภายนอก",
            "microphones": "ไมค์ 3 ตัวตัดเสียงลม"
        },
        "battery": {
            "earbudsCapacity": "ฟังต่อเนื่อง 6-8.5 ชม.",
            "caseCapacity": "รวมตลับชาร์จสูงสุด 28-30 ชม.",
            "charging": "USB-C Fast Charging"
        },
        "connectivityAndBuild": {
            "bluetooth": "Bluetooth 5.3 / 5.4",
            "waterResistance": "IPX2 / IP54",
            "weight": "5.0 กรัมต่อข้าง"
        }
    },

    # ==========================================
    # ACCESSORIES: CHARGERS & ADAPTERS
    # ==========================================
    "SAMSUNG_ADAPTER_45W": {
        "modelGroup": "Samsung Power Adapter 45W",
        "officialName": "Samsung 45W Power Adapter (EP-T4511 / SIS) เครื่องศูนย์ไทย",
        "source": "Samsung Thailand Official (samsung.com/th)",
        "marketRegion": "Thailand (รับประกันศูนย์ไทย 1 ปี)",
        "category": "Accessory",
        "subCategory": "หัวชาร์จ / อะแดปเตอร์",
        "chargerSpecs": {
            "maxOutput": "45 วัตต์ (Super Fast Charging 2.0)",
            "outputPorts": "1 พอร์ต USB Type-C",
            "supportedProtocols": "PD 3.0, PPS (Programmable Power Supply), QC 4+",
            "inputVoltage": "100-240V ~ 50/60Hz (ใช้ได้ทั่วโลก)",
            "safetyProtection": "ระบบป้องกันไฟกระชาก, ป้องกันความร้อนเกิน, ป้องกันการลัดวงจร",
            "compatibility": "รองรับ Galaxy S26 Ultra, S26+, S25 Ultra, Tab S11, Tab S10+ และชาร์จ Notebook USB-C ได้",
            "warranty": "รับประกันศูนย์บริการ Samsung ทั่วประเทศ 1 ปีเต็ม"
        }
    },
    "SAMSUNG_ADAPTER_25W": {
        "modelGroup": "Samsung Power Adapter 25W",
        "officialName": "Samsung 25W Power Adapter (EP-T2510) เครื่องศูนย์ไทย",
        "source": "Samsung Thailand Official (samsung.com/th)",
        "marketRegion": "Thailand (รับประกันศูนย์ไทย 1 ปี)",
        "category": "Accessory",
        "subCategory": "หัวชาร์จ / อะแดปเตอร์",
        "chargerSpecs": {
            "maxOutput": "25 วัตต์ (Super Fast Charging)",
            "outputPorts": "1 พอร์ต USB Type-C",
            "supportedProtocols": "PD 3.0, PPS",
            "inputVoltage": "100-240V (ขาปลั๊กไทยมาตรฐาน)",
            "safetyProtection": "ระบบควบคุมแรงดันไฟและป้องกันไฟตก",
            "compatibility": "รองรับ Galaxy A07, A17, A27, A37, A57, S26, S25 FE, Z Flip8, Z Fold8",
            "warranty": "รับประกันศูนย์ Samsung ประเทศไทย 1 ปี"
        }
    },
    "UGREEN_CHARGER_65W": {
        "modelGroup": "UGREEN UNO RG 65W GaN Fast Charger",
        "officialName": "UGREEN UNO RG 65W GaN Fast Charger Robot Design (ขาปลั๊กไทย)",
        "source": "UGREEN Thailand Official (ugreen.co.th) & ตัวแทนจำหน่ายอย่างเป็นทางการ",
        "marketRegion": "Thailand (ศูนย์ไทยรับประกัน 2 ปีเต็ม)",
        "category": "Accessory",
        "subCategory": "หัวชาร์จ / อะแดปเตอร์",
        "chargerSpecs": {
            "maxOutput": "65 วัตต์ (เทคโนโลยี GaNFast III ประสิทธิภาพสูงแต่หัวชาร์จไม่ร้อน)",
            "outputPorts": "3 พอร์ต: 2x USB-C + 1x USB-A (ชาร์จได้ 3 อุปกรณ์พร้อมกัน)",
            "display": "หน้าจอ Mini TFT แสดงอีโมจิบอกสถานะการชาร์จ (หน้าหุ่นยนต์ Robot Design)",
            "supportedProtocols": "PD 3.0 / PPS 45W / QC 4+ / SCP / FCP / AFC",
            "safetyProtection": "Thermal Guard ตรวจจับอุณหภูมิ 800 ครั้งต่อวินาที ปลอดภัยสูงสุด",
            "compatibility": "ชาร์จเร็ว Samsung Super Fast Charge 45W, MacBook Air/Pro, iPad, iPhone",
            "warranty": "รับประกันศูนย์ไทย 2 ปีเต็ม (เสียเปลี่ยนตัวใหม่)"
        }
    },
    "UGREEN_CHARGER_30W_45W": {
        "modelGroup": "UGREEN Wall Charger 30W / 45W",
        "officialName": "UGREEN Wall Charger 30W / 45W PD Fast Charger (ขาปลั๊กไทย)",
        "source": "UGREEN Thailand Official (ugreen.co.th)",
        "marketRegion": "Thailand (รับประกันศูนย์ไทย 2 ปี)",
        "category": "Accessory",
        "subCategory": "หัวชาร์จ / อะแดปเตอร์",
        "chargerSpecs": {
            "maxOutput": "30 วัตต์ หรือ 45 วัตต์ ตามรุ่น",
            "outputPorts": "Multi-Port: USB-C PD + USB-A",
            "supportedProtocols": "Power Delivery 3.0, Quick Charge 3.0, PPS",
            "safetyProtection": "Overvoltage, Overcurrent, Short-circuit protection",
            "compatibility": "สมาร์ทโฟน Samsung Galaxy ทุกรุ่น, iPhone, iPad",
            "warranty": "รับประกันศูนย์ไทย 2 ปี"
        }
    },

    # ==========================================
    # ACCESSORIES: SCREEN PROTECTORS & FILMS
    # ==========================================
    "FOCUS_TEMPERED_GLASS": {
        "modelGroup": "Focus Tempered Glass (ฟิล์มกระจกโฟกัส)",
        "officialName": "Focus Full Frame / Ultra Clear Tempered Glass (ฟิล์มกระจกเต็มจอลงโค้ง)",
        "source": "Focus Shield Thailand Official (focusshield.com)",
        "marketRegion": "Thailand (สินค้าผลิตและจัดจำหน่ายโดย บริษัท ดีพลัส อินเตอร์เทรด จำกัด)",
        "category": "Accessory",
        "subCategory": "ฟิล์มกันรอย",
        "filmSpecs": {
            "material": "กระจกนิรภัยกันกระแทกระดับ 9H Real Tempered Glass",
            "touchSensitivity": "ทัชลื่นไหลระดับพรีเมียม สแกนนิ้วบนหน้าจอ Ultrasonic/Optical ได้แม่นยำ 100%",
            "coating": "Oleophobic Coating เคลือบสารลดรอยนิ้วมือ คราบมัน และคราบน้ำ",
            "clarity": "Ultra HD Clear ความคมชัดและสีสันสมจริง ไม่ลดทอนคุณภาพหน้าจอ",
            "edgeDesign": "ขอบกระจกโค้ง 2.5D ขัดเรียบ ไม่คม ไม่ดันเคส ใส่ได้กับเคสทุกประเภท",
            "compatibility": "ตัดตรงรุ่นเป๊ะสำหรับ Galaxy A07, A17, A27, A57, S26, S25, Tab S และ Z Series",
            "warranty": "รับประกันกระจกแตก 180 วัน / 1 ปี (ตามเงื่อนไข Focus Club Thailand)"
        }
    },
    "HISHIELD_TEMPERED_GLASS": {
        "modelGroup": "HISHIELD Tempered Glass (ฟิล์มกระจกไฮชิลด์)",
        "officialName": "HISHIELD 2.5D Full Cover / 3D UV Glue Tempered Glass",
        "source": "HISHIELD Gadget Thailand (hishieldgadget.com)",
        "marketRegion": "Thailand (ผู้นำฟิล์มกระจกพรีเมียมอันดับ 1 ในไทย)",
        "category": "Accessory",
        "subCategory": "ฟิล์มกันรอย",
        "filmSpecs": {
            "material": "กระจก Asahi Glass นำเข้าจากประเทศญี่ปุ่น ความแข็งระดับ 9H ผ่านการอบนานกว่า 4 ชม.",
            "impactResistance": "ทนแรงกระแทกจากการตกกระแทก Drop Test สูงสุด 1.5 เมตร",
            "features": "มีทั้งรุ่น Clear คมชัดสูง, Matte ลดแสงสะท้อนเล่นเกมลื่น, และ Privacy กันคนมองข้าง",
            "coating": "Super Hydrophobic & Oleophobic เคลือบสารลื่นพิเศษลดรอยนิ้วมือได้ดีกว่า 2 เท่า",
            "installation": "กาวสูตรพิเศษ ติดง่าย ไม่ทิ้งคราบกาวเมื่อลอกออก ไร้ฟองอากาศ",
            "warranty": "รับประกันคุณภาพสินค้าศูนย์ไทย"
        }
    },
    "SAMSUNG_OFFICIAL_FILM": {
        "modelGroup": "Samsung Anti-reflecting Screen Protector",
        "officialName": "Samsung Official Anti-reflecting Protective Film (เครื่องศูนย์ไทย)",
        "source": "Samsung Thailand Official (samsung.com/th)",
        "marketRegion": "Thailand (ศูนย์ไทยแท้ 100%)",
        "category": "Accessory",
        "subCategory": "ฟิล์มกันรอย",
        "filmSpecs": {
            "material": "ฟิล์มลดแสงสะท้อน Optical Anti-Reflection คุณภาพสูงของแท้จาก Samsung",
            "features": "ลดการสะท้อนของแสงแดดได้ยอดเยี่ยม มองเห็นหน้าจอชัดแม้อยู่กลางแจ้ง, สแกนนิ้วเร็วที่สุด",
            "package": "ในกล่องบรรจุฟิล์ม 2 ชิ้น พร้อมโครงบล็อกช่วยติดตั้ง (Easy Installation Jig)"
        }
    },

    # ==========================================
    # ACCESSORIES: CASES, KEYBOARDS & SMARTTAG
    # ==========================================
    "SAMSUNG_BOOK_COVER_KEYBOARD": {
        "modelGroup": "Samsung Book Cover Keyboard & Slim",
        "officialName": "Samsung Galaxy Tab Book Cover Keyboard / Keyboard Slim (ของแท้ศูนย์ไทย)",
        "source": "Samsung Thailand Official (samsung.com/th)",
        "marketRegion": "Thailand (แป้นพิมพ์สกรีนไทย-อังกฤษแท้จากโรงงาน)",
        "category": "Accessory",
        "subCategory": "เคส / คีย์บอร์ด",
        "caseSpecs": {
            "keyboardLayout": "แป้นพิมพ์ภาษาไทย-อังกฤษมาตรฐาน พร้อมปุ่มลัด Galaxy AI Key และ DeX Key",
            "connection": "Pogo Pin Magnetic เชื่อมต่อปุ๊บใช้งานได้ทันที ไม่ต้องชาร์จแบตเตอรี่คีย์บอร์ด",
            "standFunction": "ปรับองศาการวางได้ตามต้องการ ตั้งแต่ 0-150 องศา",
            "spenStorage": "มีช่องเก็บปากกา S Pen ในตัว ป้องกันปากกาหล่นหาย",
            "material": "วัสดุสังเคราะห์พรีเมียมเคลือบสาร Antimicrobial ยับยั้งแบคทีเรีย",
            "compatibility": "ตรงรุ่นสำหรับ Galaxy Tab S10 Ultra, S10+, S10 FE+, S9, S10 Lite"
        }
    },
    "SAMSUNG_SMART_BOOK_COVER": {
        "modelGroup": "Samsung Smart Book Cover",
        "officialName": "Samsung Galaxy Tab Smart Book Cover (ของแท้ศูนย์ไทย)",
        "source": "Samsung Thailand Official (samsung.com/th)",
        "marketRegion": "Thailand (ศูนย์ไทย)",
        "category": "Accessory",
        "subCategory": "เคส / คีย์บอร์ด",
        "caseSpecs": {
            "function": "เคสพับแบบแม่เหล็ก ปรับตั้งได้ทั้งแนวตั้ง (Portrait) และแนวนอน (Landscape)",
            "smartWake": "Auto Sleep / Wake เปิดจออัตโนมัติเมื่อเปิดฝาเคส และดับจอเมื่อปิด",
            "spenHolder": "มีช่องล็อกเก็บ S Pen แน่นหนา",
            "compatibility": "ตรงรุ่นสำหรับ Galaxy Tab S10 Series, S9 Series, Tab A9 / A9 Plus"
        }
    },
    "SMARTTAG2": {
        "modelGroup": "Galaxy SmartTag2",
        "officialName": "Samsung Galaxy SmartTag2 (EI-T5600) เครื่องศูนย์ไทย",
        "source": "Samsung Thailand Official (samsung.com/th)",
        "marketRegion": "Thailand (รับประกันศูนย์ไทย 1 ปี)",
        "category": "Accessory",
        "subCategory": "สมาร์ทแท็ก",
        "tagSpecs": {
            "connectivity": "Bluetooth Low Energy 5.3 + Ultra-Wideband (UWB)",
            "findingRange": "ค้นหาตำแหน่งระยะไกลผ่านเครือข่าย SmartThings Find Network ทั่วโลก",
            "compassView": "ฟังก์ชัน Compass View นำทางด้วยลูกศรบอกทิศทางและระยะห่างระดับเซนติเมตร",
            "battery": "แบตเตอรี่ CR2032 ใช้งานได้ยาวนานถึง 500 วัน (โหมดประหยัดพลังงาน 700 วัน)",
            "waterResistance": "IP67 กันน้ำกันฝุ่น คล้องกระเป๋า สัตว์เลี้ยง กุญแจ หรือติดรถได้มั่นใจ",
            "speaker": "มีลำโพงส่งเสียง Ring Tag ดังชัดเจนเมื่อสั่งค้นหาในระยะใกล้",
            "lostMode": "โหมดสูญหาย ส่งข้อมูลติดต่อผ่าน NFC เมื่อมีคนนำมือถือมาแตะที่ Tag"
        }
    }
}

def resolve_spec_profile_key(item):
    m = (item.get("model") or "").upper()
    pn = (item.get("pn") or "").upper()
    cat = item.get("category", "")
    sub = (item.get("subCategory") or "").upper()

    if cat == "SmartPhone":
        if "S26 ULTRA" in m: return "S26_ULTRA"
        if "S26+" in m or "S26 PLUS" in m: return "S26_PLUS"
        if "S26FE" in m or "S26 FE" in m: return "S26_FE"
        if "S26" in m: return "S26_STANDARD"
        if "S25 ULTRA" in m: return "S25_ULTRA"
        if "S25 FE" in m: return "S25_FE"
        if "FOLD 8 ULTRA" in m: return "Z_FOLD8_ULTRA"
        if "FOLD 8" in m: return "Z_FOLD8"
        if "FOLD7" in m or "FOLD 7" in m: return "Z_FOLD7"
        if "FLIP 8" in m or "FLIP8" in m: return "Z_FLIP8"
        if "FLIP7" in m or "FLIP 7" in m: return "Z_FLIP7"
        if "A57" in m: return "A57_5G"
        if "A37" in m: return "A37_5G"
        if "A27" in m: return "A27_5G"
        if "A17" in m:
            if "5G" in m or "SM-A176" in pn or "F-A175G" in pn: return "A17_5G"
            return "A17_LTE"
        if "A07" in m:
            if "5G" in m or "SM-A076" in pn: return "A07_5G"
            return "A07_4G"
        return "S26_STANDARD"

    elif cat == "Tablet":
        if "S11 ULTRA" in m: return "TAB_S11_ULTRA"
        if "S10+" in m or "S10PLUS" in m: return "TAB_S10_PLUS"
        if "S10FE+" in m or "S10FE PLUS" in m: return "TAB_S10_FE_PLUS"
        if "S10 LITE" in m: return "TAB_S10_LITE"
        if "S10 FE" in m: return "TAB_S10_FE_PLUS"
        if "S11" in m: return "TAB_S10_PLUS"
        if "A11" in m or "A9" in m: return "TAB_A11"
        return "TAB_S10_PLUS"

    elif cat == "Watch":
        if "ULTRA" in m or "L705" in pn or "L715" in pn: return "WATCH_ULTRA"
        if "CLASSIC" in m: return "WATCH8_CLASSIC"
        if "FIT3" in m or "R390" in pn: return "FIT3"
        return "WATCH_STANDARD"

    elif cat == "Buds":
        if "PRO" in m: return "BUDS4_PRO"
        return "BUDS_STANDARD"

    elif cat in ["Accessory", "Adapter"]:
        if "SMARTTAG" in m: return "SMARTTAG2"
        if "UGREEN" in m:
            if "65W" in m: return "UGREEN_CHARGER_65W"
            return "UGREEN_CHARGER_30W_45W"
        if "ADAPTER" in m or "CHARGE" in m:
            if "45W" in m or "60W" in m: return "SAMSUNG_ADAPTER_45W"
            return "SAMSUNG_ADAPTER_25W"
        if "KEYBOARD" in m: return "SAMSUNG_BOOK_COVER_KEYBOARD"
        if "COVER" in m or "CASE" in m: return "SAMSUNG_SMART_BOOK_COVER"
        if "FOCUS" in m: return "FOCUS_TEMPERED_GLASS"
        if "HISHIELD" in m: return "HISHIELD_TEMPERED_GLASS"
        if "FILM" in m or "PROTECTOR" in m: return "SAMSUNG_OFFICIAL_FILM"
        return "SAMSUNG_ADAPTER_25W"

    return "A07_4G"

def generate_specs_database():
    print("Generating Product Specifications Database...")
    js_content = "/**\n * Samsung Branch Operations - Product Specifications Master Database\n"
    js_content += " * Grounded in Samsung Thailand Official (samsung.com/th) and Certified Thai Brand Authorities\n"
    js_content += " */\n\n"
    js_content += "window.PRODUCT_SPECS_PROFILES = " + json.dumps(SPECS_PROFILES, ensure_ascii=False, indent=2) + ";\n\n"
    
    # Helper resolution function embedded into the JS
    js_content += """
window.resolveProductSpecs = function(item) {
  if (!item) return null;
  const m = (item.model || "").toUpperCase();
  const pn = (item.pn || "").toUpperCase();
  const cat = item.category || "";

  let profileKey = "A07_4G";

  if (cat === "SmartPhone") {
    if (m.includes("S26 ULTRA")) profileKey = "S26_ULTRA";
    else if (m.includes("S26+") || m.includes("S26 PLUS")) profileKey = "S26_PLUS";
    else if (m.includes("S26FE") || m.includes("S26 FE")) profileKey = "S26_FE";
    else if (m.includes("S26")) profileKey = "S26_STANDARD";
    else if (m.includes("S25 ULTRA")) profileKey = "S25_ULTRA";
    else if (m.includes("S25 FE")) profileKey = "S25_FE";
    else if (m.includes("FOLD 8 ULTRA")) profileKey = "Z_FOLD8_ULTRA";
    else if (m.includes("FOLD 8")) profileKey = "Z_FOLD8";
    else if (m.includes("FOLD7") || m.includes("FOLD 7")) profileKey = "Z_FOLD7";
    else if (m.includes("FLIP 8") || m.includes("FLIP8")) profileKey = "Z_FLIP8";
    else if (m.includes("FLIP7") || m.includes("FLIP 7")) profileKey = "Z_FLIP7";
    else if (m.includes("A57")) profileKey = "A57_5G";
    else if (m.includes("A37")) profileKey = "A37_5G";
    else if (m.includes("A27")) profileKey = "A27_5G";
    else if (m.includes("A17")) {
      profileKey = (m.includes("5G") || pn.includes("SM-A176") || pn.includes("F-A175G")) ? "A17_5G" : "A17_LTE";
    } else if (m.includes("A07")) {
      profileKey = (m.includes("5G") || pn.includes("SM-A076")) ? "A07_5G" : "A07_4G";
    } else {
      profileKey = "S26_STANDARD";
    }
  } else if (cat === "Tablet") {
    if (m.includes("S11 ULTRA")) profileKey = "TAB_S11_ULTRA";
    else if (m.includes("S10+") || m.includes("S10PLUS")) profileKey = "TAB_S10_PLUS";
    else if (m.includes("S10FE+") || m.includes("S10FE PLUS")) profileKey = "TAB_S10_FE_PLUS";
    else if (m.includes("S10 LITE")) profileKey = "TAB_S10_LITE";
    else if (m.includes("S10 FE")) profileKey = "TAB_S10_FE_PLUS";
    else if (m.includes("S11")) profileKey = "TAB_S10_PLUS";
    else if (m.includes("A11") || m.includes("A9")) profileKey = "TAB_A11";
    else profileKey = "TAB_S10_PLUS";
  } else if (cat === "Watch") {
    if (m.includes("ULTRA") || pn.includes("L705") || pn.includes("L715")) profileKey = "WATCH_ULTRA";
    else if (m.includes("CLASSIC")) profileKey = "WATCH8_CLASSIC";
    else if (m.includes("FIT3") || pn.includes("R390")) profileKey = "FIT3";
    else profileKey = "WATCH_STANDARD";
  } else if (cat === "Buds") {
    if (m.includes("PRO")) profileKey = "BUDS4_PRO";
    else profileKey = "BUDS_STANDARD";
  } else if (cat === "Accessory" || cat === "Adapter") {
    if (m.includes("SMARTTAG")) profileKey = "SMARTTAG2";
    else if (m.includes("UGREEN")) {
      profileKey = m.includes("65W") ? "UGREEN_CHARGER_65W" : "UGREEN_CHARGER_30W_45W";
    } else if (m.includes("ADAPTER") || m.includes("CHARGE")) {
      profileKey = (m.includes("45W") || m.includes("60W")) ? "SAMSUNG_ADAPTER_45W" : "SAMSUNG_ADAPTER_25W";
    } else if (m.includes("KEYBOARD")) profileKey = "SAMSUNG_BOOK_COVER_KEYBOARD";
    else if (m.includes("COVER") || m.includes("CASE")) profileKey = "SAMSUNG_SMART_BOOK_COVER";
    else if (m.includes("FOCUS")) profileKey = "FOCUS_TEMPERED_GLASS";
    else if (m.includes("HISHIELD")) profileKey = "HISHIELD_TEMPERED_GLASS";
    else if (m.includes("FILM") || m.includes("PROTECTOR")) profileKey = "SAMSUNG_OFFICIAL_FILM";
    else profileKey = "SAMSUNG_ADAPTER_25W";
  }

  return window.PRODUCT_SPECS_PROFILES[profileKey] || window.PRODUCT_SPECS_PROFILES.A07_4G;
};
"""

    with open(OUTPUT_JS_PATH, "w", encoding="utf-8") as out:
        out.write(js_content)

    print(f"✅ Successfully wrote product specifications database to: {OUTPUT_JS_PATH}")
    print(f"Total Specification Profiles Defined: {len(SPECS_PROFILES)}")

if __name__ == "__main__":
    generate_specs_database()
