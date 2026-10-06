import json
import re

# Read template / new blocks
UPDATED_PHONE_PROFILES_JS = """  "S26_ULTRA": {
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
  },"""

def update_file(path):
    print(f"Updating {path}...")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Locate from "S26_ULTRA": { to "TAB_S11_ULTRA": {
    pattern = r'  "S26_ULTRA": \{.*?\n  "TAB_S11_ULTRA": \{'
    replacement = UPDATED_PHONE_PROFILES_JS + '\n  "TAB_S11_ULTRA": {'
    
    new_content, count = re.subn(pattern, replacement, content, count=1, flags=re.DOTALL)
    if count == 0:
        print(f"FAILED to match pattern in {path}")
        return False
        
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"SUCCESS: {path} updated ({count} replacement)")
    return True

target_files = [
    "product_specs_data.js",
    "dist/product_specs_data.js",
    "deploy_preview/product_specs_data.js",
    ".pilot-deploy/product_specs_data.js"
]

for p in target_files:
    update_file(p)

print("\nAll files successfully processed.")
