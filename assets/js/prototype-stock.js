
    // ==========================================================================
    // PROTOTYPE DATA ENGINE & COLOR PALETTE MAPPINGS
    // ==========================================================================
    
    // Exact Color Swatch Map (Hex + Label)
    const COLOR_SWATCHES = {
      "pistachio": "#b8c9a0",
      "graphite": "#4b5563",
      "titanium-silverblue": "#9aaebb",
      "titanium-black": "#34373a",
      "blueberry": "#51528a",
      "light-violet": "#c9b8ff",
      "cobalt-violet": "#6652a3",
      "light-blue": "#a9cfe5",
      "pink-gold": "#d9aaa5",
      "silver": "#c5c9ce",
      "black": "#25282d",
      "white": "#f4f4f2",
      "gray": "#858a90",
      "grey": "#858a90",
      "titanium-gray": "#787c82",
      "titanium-white": "#f1f3f5",
      "blue-violet": "#7c3aed",
      "jetblack": "#0f172a",
      "icyblue": "#bfdbfe",
      "lavender": "#d8b4fe",
      "cream": "#fef08a",
      "pink": "#f472b6",
      "mint": "#6ee7b7",
      "navy": "#1e3a8a",
      "coral-red": "#f87171",
      "dark-green": "#166534",
      "dark-blue": "#1e3a8a",
      "sky-blue": "#38bdf8",
      "blue": "#3b82f6",
      "violet": "#a855f7",
      "yellow": "#facc15",
      "green": "#10b981",
      "gold": "#eab308"
    };

    const KNOWN_COLORS = [
      "Titanium Silverblue",
      "Titanium Black",
      "Titanium Gray",
      "Titanium White",
      "Cobalt Violet",
      "Light Violet",
      "Light Blue",
      "Blue Violet",
      "Pink Gold",
      "Pistachio",
      "Graphite",
      "Blueberry",
      "Jetblack",
      "Icyblue",
      "Silver",
      "White",
      "Black",
      "Gray",
      "Grey",
      "Violet",
      "Lavender",
      "Cream",
      "Pink",
      "Mint",
      "Navy",
      "Coral Red",
      "Dark Green",
      "Dark Blue",
      "Sky Blue"
    ];

    const COLOR_CANONICAL_NAMES = {
      navy: "Navy",
      jetblack: "Jet Black",
      icyblue: "Icy Blue",
      lightviolet: "Light Violet",
      "light violet": "Light Violet",
      titaniumblack: "Titanium Black",
      "titanium black": "Titanium Black",
      titaniumsilverblue: "Titanium Silverblue",
      "titanium silverblue": "Titanium Silverblue",
      graphite: "Graphite",
      pistachio: "Pistachio",
      blueberry: "Blueberry"
    };

    function normalizeColorName(value) {
      const raw = String(value || "").trim();
      if (!raw) return "";
      const key = raw.toLowerCase().replace(/\s+/g, " ");
      return (
        COLOR_CANONICAL_NAMES[key] ||
        COLOR_CANONICAL_NAMES[key.replace(/\s+/g, "")] ||
        raw.toLowerCase().replace(/\b\w/g, char => char.toUpperCase())
      );
    }

    function extractColorFromDescription(description) {
      const text = String(description || "").trim();
      if (!text) return "";
      const match = text.match(/\s*-\s*([^-]+)\s*$/);
      if (!match) return "";
      const candidate = match[1].trim();
      if (!candidate || /^\d/.test(candidate) || /^(5G|4G|LTE|WI-?FI)$/i.test(candidate)) {
        return "";
      }
      return candidate;
    }

    function extractKnownColor(description) {
      const text = String(description || "").trim().toLowerCase();
      const sorted = KNOWN_COLORS.slice().sort((a, b) => b.length - a.length);
      for (const color of sorted) {
        if (text.endsWith(color.toLowerCase())) {
          return color;
        }
      }
      return "";
    }

    function resolveProductColor(item) {
      const existing = String((item && item.color) || "").trim();
      if (existing && existing !== "ไม่ระบุสี") {
        return normalizeColorName(existing);
      }
      const description = (item && (item.description || item.raw_desc || item.model)) || "";
      const extracted = extractColorFromDescription(description) || extractKnownColor(description) || "";
      return normalizeColorName(extracted);
    }

    if (typeof window !== "undefined") {
      window.COLOR_CANONICAL_NAMES = COLOR_CANONICAL_NAMES;
      window.normalizeColorName = normalizeColorName;
      window.extractColorFromDescription = extractColorFromDescription;
      window.resolveProductColor = resolveProductColor;
    }

    function normalizeColorKey(color) {
      return String(color || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");
    }

    function getColorHex(colorName) {
      if (!colorName || colorName === "ไม่ระบุสี") return "#64748b";
      const key = normalizeColorKey(colorName);
      if (COLOR_SWATCHES[key]) return COLOR_SWATCHES[key];
      for (const [k, hex] of Object.entries(COLOR_SWATCHES)) {
        if (key.includes(k) || k.includes(key)) return hex;
      }
      return "#858a90";
    }

    // Default Fallback Dataset (if running completely standalone without stock_data.js)
    const FALLBACK_STOCK = [
      { id: 1, category: "SmartPhone", model: "Galaxy A07 4G (4/64GB)", pn: "SM-A075FLVDTHL", color: "Light Violet", f1: 0, f2: 4, total: 4, srp: 3799, productCodeType: "STANDARD_SM" },
      { id: 2, category: "SmartPhone", model: "Galaxy A07 4G (4/64GB)", pn: "SM-A075FZKDTHL", color: "Black", f1: 2, f2: 5, total: 7, srp: 3799, productCodeType: "STANDARD_SM" },
      { id: 3, category: "SmartPhone", model: "Galaxy A17 5G (8/128GB)", pn: "SM-A176BZKGTHL", color: "Black", f1: 3, f2: 3, total: 6, srp: 8999, productCodeType: "STANDARD_SM" },
      { id: 4, category: "SmartPhone", model: "Galaxy A27 5G (8/128GB)", pn: "SM-A276BLIGTHL", color: "Light Violet", f1: 1, f2: 2, total: 3, srp: 10999, productCodeType: "STANDARD_SM" },
      { id: 5, category: "SmartPhone", model: "Galaxy A37 5G (8/256GB)", pn: "SM-A376BLVTTHL", color: "Light Violet", f1: 2, f2: 1, total: 3, srp: 13999, productCodeType: "STANDARD_SM" },
      { id: 6, category: "SmartPhone", model: "Galaxy S25 FE 5G (8/256GB)", pn: "SM-S721BLBATHL", color: "Blue", f1: 2, f2: 2, total: 4, srp: 26900, productCodeType: "STANDARD_SM" },
      { id: 7, category: "SmartPhone", model: "Galaxy S26 Ultra 5G (12/256GB)", pn: "SM-S928BZTQTHL", color: "Titanium Black", f1: 4, f2: 3, total: 7, srp: 46900, productCodeType: "STANDARD_SM" },
      { id: 8, category: "SmartPhone", model: "Galaxy Z Fold8 5G (12/256GB)", pn: "SM-F956BZKATHL", color: "Silver Shadow", f1: 1, f2: 2, total: 3, srp: 63900, productCodeType: "STANDARD_SM" },
      { id: 9, category: "SmartPhone", model: "Galaxy Z Flip8 5G (8/256GB)", pn: "SM-F741BLBATHL", color: "Blue Shadow", f1: 2, f2: 0, total: 2, srp: 42900, productCodeType: "STANDARD_SM" },
      { id: 10, category: "Tablet", model: "Galaxy Tab S10 FE 5G (8/128GB)", pn: "SM-X526BLBATHL", color: "Gray", f1: 2, f2: 2, total: 4, srp: 30900, productCodeType: "STANDARD_SM" },
      { id: 11, category: "Tablet", model: "Galaxy Tab S10 Lite (6/128GB)", pn: "SM-X406BZAATHL", color: "Gray", f1: 3, f2: 4, total: 7, srp: 16990, productCodeType: "STANDARD_SM" },
      { id: 12, category: "Tablet", model: "Galaxy Tab A11+ 5G (4/64GB)", pn: "SM-X226BZAATHL", color: "Graphite", f1: 5, f2: 2, total: 7, srp: 9990, productCodeType: "STANDARD_SM" },
      { id: 13, category: "Watch", model: "Galaxy Watch8 40mm BT", pn: "SM-R930NZEATHL", color: "Cream", f1: 2, f2: 1, total: 3, srp: 9900, productCodeType: "STANDARD_SM" },
      { id: 14, category: "Watch", model: "Galaxy Watch8 Ultra 47mm LTE", pn: "SM-R965FZKATHL", color: "Titanium Gray", f1: 1, f2: 1, total: 2, srp: 23900, productCodeType: "STANDARD_SM" },
      { id: 15, category: "Buds", model: "Galaxy Buds3 Pro", pn: "SM-R630NZAA", color: "Silver", f1: 0, f2: 0, total: 0, srp: 7490, productCodeType: "STANDARD_SM" },
      { id: 16, category: "Accessory", model: "25W Power Adapter (หัวชาร์จด่วน)", pn: "EP-T2510NBEGTH", color: "Black", f1: 35, f2: 24, total: 59, srp: 490, productCodeType: "STANDARD_SM" },
      { id: 17, category: "Accessory", model: "SmartTag2 Bluetooth Tracker", pn: "EI-T5600BBEGTH", color: "Black", f1: 4, f2: 0, total: 4, srp: 990, productCodeType: "STANDARD_SM" }
    ];

    // Complete 78 Accessories Catalog from Stock.xlsx (Cases, Covers, Chargers, Adapters, Films, SmartTags)
    const ALL_ACCESSORIES = [
  {
    "id": "ACC-0001",
    "category": "Accessory",
    "subCategory": "สมาร์ทแท็ก",
    "model": "SmartTag2",
    "pn": "EI-T5600BWEGWW",
    "color": "White",
    "srp": 1090.0,
    "f1": 0,
    "f2": 0,
    "total": 0,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0002",
    "category": "Accessory",
    "subCategory": "เคส / คีย์บอร์ด",
    "model": "Tab S10Ultra Book Cover Keyboard Slim",
    "pn": "EF-DX920UBEGTH",
    "color": "Black",
    "srp": 6990.0,
    "f1": 0,
    "f2": 0,
    "total": 0,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0003",
    "category": "Accessory",
    "subCategory": "เคส / คีย์บอร์ด",
    "model": "Tab S10Plus Book Cover Keyboard Slim",
    "pn": "EF-DX820UBEGTH",
    "color": "Black",
    "srp": 5990.0,
    "f1": 0,
    "f2": 0,
    "total": 0,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0004",
    "category": "Accessory",
    "subCategory": "เคส / คีย์บอร์ด",
    "model": "Tab S9Plus S10Plus Smart Book Cover",
    "pn": "EF-BX810PBEGWW",
    "color": "Black",
    "srp": 2990.0,
    "f1": 0,
    "f2": 0,
    "total": 0,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0005",
    "category": "Accessory",
    "subCategory": "เคส / คีย์บอร์ด",
    "model": "Tab S9Plus S10Plus Smart Book Cover",
    "pn": "EF-BX810PLEGWW",
    "color": "Blue",
    "srp": 2990.0,
    "f1": 0,
    "f2": 0,
    "total": 0,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0006",
    "category": "Accessory",
    "subCategory": "เคส / คีย์บอร์ด",
    "model": "Tab S10Plus Neos Pogo Keyboard Cover",
    "pn": "GP-FCX828NNABH",
    "color": "Black",
    "srp": 3990.0,
    "f1": 0,
    "f2": 0,
    "total": 0,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0007",
    "category": "Accessory",
    "subCategory": "เคส / คีย์บอร์ด",
    "model": "Tab S10FE Plus (AI) Book Cover Keyboard Slim",
    "pn": "EF-DX620UBEGTH",
    "color": "Black",
    "srp": 5990.0,
    "f1": 0,
    "f2": 0,
    "total": 0,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0008",
    "category": "Accessory",
    "subCategory": "เคส / คีย์บอร์ด",
    "model": "Tab S10FE Plus Neos Keyboard Cover (BT)",
    "pn": "GP-FCX626NNCBH",
    "color": "Black",
    "srp": 2990.0,
    "f1": 1,
    "f2": 0,
    "total": 1,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0009",
    "category": "Accessory",
    "subCategory": "เคส / คีย์บอร์ด",
    "model": "Tab S10FE Plus Smart Book Cover",
    "pn": "EF-BX620PBEGWW",
    "color": "Black",
    "srp": 2990.0,
    "f1": 0,
    "f2": 0,
    "total": 0,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0010",
    "category": "Accessory",
    "subCategory": "เคส / คีย์บอร์ด",
    "model": "Tab S9(AI) Book Cover Keyboard",
    "pn": "EF-DX720UBEGTH",
    "color": "Black",
    "srp": 4990.0,
    "f1": 0,
    "f2": 0,
    "total": 0,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0011",
    "category": "Accessory",
    "subCategory": "เคส / คีย์บอร์ด",
    "model": "Tab S9 Book Cover Keyboard",
    "pn": "EF-DX710UBEGTH",
    "color": "Black",
    "srp": 4990.0,
    "f1": 0,
    "f2": 0,
    "total": 0,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0012",
    "category": "Accessory",
    "subCategory": "เคส / คีย์บอร์ด",
    "model": "Tab S9 Smart Book Cover",
    "pn": "EF-BX710PBEGWW",
    "color": "Black",
    "srp": 2490.0,
    "f1": 0,
    "f2": 0,
    "total": 0,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0013",
    "category": "Accessory",
    "subCategory": "เคส / คีย์บอร์ด",
    "model": "Tab S10FE Neos Keyboard Cover",
    "pn": "GP-FCX526NNBBH",
    "color": "Black",
    "srp": 2990.0,
    "f1": 0,
    "f2": 0,
    "total": 0,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0014",
    "category": "Accessory",
    "subCategory": "เคส / คีย์บอร์ด",
    "model": "Case S25FE",
    "pn": "",
    "color": "Black",
    "srp": 0.0,
    "f1": 0,
    "f2": 0,
    "total": 0,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0015",
    "category": "Accessory",
    "subCategory": "เคส / คีย์บอร์ด",
    "model": "Case Flip7 / Fold7",
    "pn": "",
    "color": "Black",
    "srp": 0.0,
    "f1": 0,
    "f2": 0,
    "total": 0,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0016",
    "category": "Accessory",
    "subCategory": "เคส / คีย์บอร์ด",
    "model": "Case S25 / S25Plus",
    "pn": "",
    "color": "Black",
    "srp": 0.0,
    "f1": 0,
    "f2": 0,
    "total": 0,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0017",
    "category": "Accessory",
    "subCategory": "เคส / คีย์บอร์ด",
    "model": "Case S25 Ultra",
    "pn": "",
    "color": "Black",
    "srp": 0.0,
    "f1": 0,
    "f2": 0,
    "total": 0,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0018",
    "category": "Accessory",
    "subCategory": "เคส / คีย์บอร์ด",
    "model": "Case A57 / A37",
    "pn": "",
    "color": "Black",
    "srp": 0.0,
    "f1": 0,
    "f2": 0,
    "total": 0,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0019",
    "category": "Accessory",
    "subCategory": "หัวชาร์จ / อะแดปเตอร์",
    "model": "[CS]UGREEN UNO RG 65W USB A*1 + USB C*2 GaN Fast Charger THAI PLUG - Gray",
    "pn": "6941876238958",
    "color": "Gray",
    "srp": 999.0,
    "f1": 8,
    "f2": 2,
    "total": 10,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0020",
    "category": "Accessory",
    "subCategory": "หัวชาร์จ / อะแดปเตอร์",
    "model": "[CS]UGREEN Wall Charer 30W USB Port*1 + PD*2 Fast Charger Thai plug - Grey",
    "pn": "6941876265732",
    "color": "Gray",
    "srp": 399.0,
    "f1": 48,
    "f2": 9,
    "total": 57,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0021",
    "category": "Accessory",
    "subCategory": "หัวชาร์จ / อะแดปเตอร์",
    "model": "[CS]UGREEN Wall Charger 45W USB Port*1 + PD*2 Fast Charger Thai plug - Grey",
    "pn": "6941876265749",
    "color": "Gray",
    "srp": 599.0,
    "f1": 9,
    "f2": 10,
    "total": 19,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0022",
    "category": "Accessory",
    "subCategory": "หัวชาร์จ / อะแดปเตอร์",
    "model": "Samsung Adapter 25W No Cable-Black",
    "pn": "EP-T2510NBEGTH",
    "color": "Black",
    "srp": 690.0,
    "f1": 52,
    "f2": 36,
    "total": 88,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0023",
    "category": "Accessory",
    "subCategory": "หัวชาร์จ / อะแดปเตอร์",
    "model": "Samsung Adapter 25W No Cable-White",
    "pn": "EP-T2510NWEGTH",
    "color": "White",
    "srp": 690.0,
    "f1": 42,
    "f2": 31,
    "total": 73,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0024",
    "category": "Accessory",
    "subCategory": "หัวชาร์จ / อะแดปเตอร์",
    "model": "Samsung Adapter 45W Fastcharge with Cable - Black",
    "pn": "EP-T4511XBEGTH",
    "color": "Black",
    "srp": 1290.0,
    "f1": 7,
    "f2": 1,
    "total": 8,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0025",
    "category": "Accessory",
    "subCategory": "หัวชาร์จ / อะแดปเตอร์",
    "model": "Samsung Adapter 45W Fastcharge with Cable (SIS) - Black",
    "pn": "SSG-EP-T4511XBEGTH",
    "color": "Black",
    "srp": 1290.0,
    "f1": 43,
    "f2": 25,
    "total": 68,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0026",
    "category": "Accessory",
    "subCategory": "หัวชาร์จ / อะแดปเตอร์",
    "model": "Samsung Adapter 45W without cable - Black",
    "pn": "EP-T4511NBEGTH",
    "color": "Black",
    "srp": 1090.0,
    "f1": 19,
    "f2": 21,
    "total": 40,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0027",
    "category": "Accessory",
    "subCategory": "หัวชาร์จ / อะแดปเตอร์",
    "model": "Samsung Adapter 60W without cable - Black",
    "pn": "EP-T6010NBEGTH",
    "color": "Black",
    "srp": 1490.0,
    "f1": 26,
    "f2": 9,
    "total": 35,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0028",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG FF Samsung Galaxy A07 Black",
    "pn": "8859703436409",
    "color": "Black",
    "srp": 249.0,
    "f1": 10,
    "f2": 10,
    "total": 20,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0029",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]HISHIELD TemperedGlass FC 2.5D Samsung A07",
    "pn": "8859216804023",
    "color": "Clear",
    "srp": 299.0,
    "f1": 7,
    "f2": 15,
    "total": 22,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0030",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]HISHIELD TemperedGlass FC 2.5D Samsung A17",
    "pn": "8859216803910",
    "color": "Clear",
    "srp": 299.0,
    "f1": 17,
    "f2": 33,
    "total": 50,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0031",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG FF Samsung Galaxy A26 5G/A17 5G Black",
    "pn": "8859703433569",
    "color": "Black",
    "srp": 249.0,
    "f1": 4,
    "f2": 13,
    "total": 17,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0032",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG FF Samsung Galaxy A27 5G Black",
    "pn": "8859703443339",
    "color": "Black",
    "srp": 249.0,
    "f1": 12,
    "f2": 0,
    "total": 12,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0033",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Hishield Tempered Glass FC 2.5D for Samsung A37",
    "pn": "8859216846719",
    "color": "Clear",
    "srp": 299.0,
    "f1": 35,
    "f2": 18,
    "total": 53,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0034",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Hishield Tempered Glass FC 2.5D for Samsung A57",
    "pn": "8859216846726",
    "color": "Clear",
    "srp": 299.0,
    "f1": 10,
    "f2": 29,
    "total": 39,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0035",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG FF Samsung Galaxy A36 5G/A56 5G Black",
    "pn": "8859703433828",
    "color": "Black",
    "srp": 249.0,
    "f1": 9,
    "f2": 12,
    "total": 21,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0036",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG FF Samsung Galaxy A57 5G Black",
    "pn": "8859703437345",
    "color": "Black",
    "srp": 249.0,
    "f1": 36,
    "f2": 17,
    "total": 53,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0037",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "Samsung Galaxy Fold8 Anti-reflecting Film - Transparent",
    "pn": "EF-UF971CTEGWW",
    "color": "Clear",
    "srp": 590.0,
    "f1": 1,
    "f2": 1,
    "total": 2,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0038",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG FF Samsung Galaxy S25 FE Black",
    "pn": "8859703436560",
    "color": "Black",
    "srp": 249.0,
    "f1": 19,
    "f2": 8,
    "total": 27,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0039",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]HISHIELD TemperedGlass FC 2.5D Samsung S25 FE",
    "pn": "8859216804030",
    "color": "Clear",
    "srp": 299.0,
    "f1": 11,
    "f2": 20,
    "total": 31,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0040",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "Samsung Galaxy S26FE Anti-reflecting Film - Transparency",
    "pn": "EF-US741CTEGWW",
    "color": "Clear",
    "srp": 590.0,
    "f1": 2,
    "f2": 2,
    "total": 4,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0041",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Hishield Hydrogel Film/Size S(18x12cm) - Ultra Clear",
    "pn": "8859216623860",
    "color": "Clear",
    "srp": 290.0,
    "f1": 32,
    "f2": 0,
    "total": 32,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0042",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Hishield Hydrogel Film/Size S(18x12cm) - Anti Glare Gray",
    "pn": "8859216623877",
    "color": "Clear",
    "srp": 290.0,
    "f1": 32,
    "f2": 0,
    "total": 32,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0043",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG FF SL Samsung S25 Black",
    "pn": "8859703433576",
    "color": "Black",
    "srp": 490.0,
    "f1": 1,
    "f2": 2,
    "total": 3,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0044",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG FF SL Samsung S25 Ultra Black",
    "pn": "8859703433590",
    "color": "Black",
    "srp": 490.0,
    "f1": 10,
    "f2": 16,
    "total": 26,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0045",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG FF SL PV Samsung S25 Ultra Black",
    "pn": "8859703433606",
    "color": "Black",
    "srp": 690.0,
    "f1": 3,
    "f2": 5,
    "total": 8,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0046",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Hishield Tempered Glass FC 2.5D Samsung S25Ultra - Black",
    "pn": "8859216739264",
    "color": "Black",
    "srp": 590.0,
    "f1": 4,
    "f2": 5,
    "total": 9,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0047",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "Samsung Galaxy S25Plus Screen Protector - Transparent",
    "pn": "EF-US936CTEGWW",
    "color": "Clear",
    "srp": 590.0,
    "f1": 1,
    "f2": 0,
    "total": 1,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0048",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG FF SL Samsung Galaxy S26",
    "pn": "8859703437451",
    "color": "Clear",
    "srp": 490.0,
    "f1": 2,
    "f2": 4,
    "total": 6,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0049",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG FF SL Samsung Galaxy S26 Plus",
    "pn": "8859703437468",
    "color": "Clear",
    "srp": 490.0,
    "f1": 3,
    "f2": 10,
    "total": 13,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0050",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG FF SL Samsung Galaxy S26 Ultra",
    "pn": "8859703437475",
    "color": "Clear",
    "srp": 490.0,
    "f1": 15,
    "f2": 33,
    "total": 48,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0051",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG FF SL PV Samsung Galaxy S26 Ultra",
    "pn": "8859703437482",
    "color": "Clear",
    "srp": 690.0,
    "f1": 5,
    "f2": 10,
    "total": 15,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0052",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG FF SL MT Samsung Galaxy S26 Ultra",
    "pn": "8859703437499",
    "color": "Clear",
    "srp": 690.0,
    "f1": 6,
    "f2": 5,
    "total": 11,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0053",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG FF UG SL Samsung Galaxy S26 Ultra",
    "pn": "8859703437581",
    "color": "Clear",
    "srp": 890.0,
    "f1": 2,
    "f2": 8,
    "total": 10,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0054",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG FF Samsung Galaxy S26 FE Black",
    "pn": "8859703446620",
    "color": "Black",
    "srp": 249.0,
    "f1": 5,
    "f2": 4,
    "total": 9,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0055",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Hishield Tempered Glass FC 2.5D Samsung S26",
    "pn": "8859216829019",
    "color": "Clear",
    "srp": 490.0,
    "f1": 2,
    "f2": 8,
    "total": 10,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0056",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Hishield Tempered Glass FC 2.5D Samsung S26 Plus",
    "pn": "8859216829026",
    "color": "Clear",
    "srp": 490.0,
    "f1": 5,
    "f2": 8,
    "total": 13,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0057",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Hishield Tempered Glass FC 2.5D Samsung S26 Ultra",
    "pn": "8859216829033",
    "color": "Clear",
    "srp": 590.0,
    "f1": 21,
    "f2": 20,
    "total": 41,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0058",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Hishield 2.5D Matte Glass Samsung S26",
    "pn": "8859216829040",
    "color": "Clear",
    "srp": 590.0,
    "f1": 5,
    "f2": 0,
    "total": 5,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0059",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Hishield 2.5D Matte Glass Samsung S26 Plus",
    "pn": "8859216829057",
    "color": "Clear",
    "srp": 590.0,
    "f1": 5,
    "f2": 0,
    "total": 5,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0060",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Hishield 2.5D Matte Glass Samsung S26 Ultra",
    "pn": "8859216829064",
    "color": "Clear",
    "srp": 590.0,
    "f1": 6,
    "f2": 5,
    "total": 11,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0061",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "Samsung Galaxy S26 Anti-reflecting Film - Transparent",
    "pn": "EF-US942CTEGWW",
    "color": "Clear",
    "srp": 590.0,
    "f1": 1,
    "f2": 1,
    "total": 2,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0062",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "Samsung Galaxy S26Plus Anti-reflecting Film - Transparent",
    "pn": "EF-US947CTEGWW",
    "color": "Clear",
    "srp": 590.0,
    "f1": 2,
    "f2": 1,
    "total": 3,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0063",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG UC Samsung Galaxy Z Flip 7 5G",
    "pn": "8859703435532",
    "color": "Clear",
    "srp": 390.0,
    "f1": 7,
    "f2": 3,
    "total": 10,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0064",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG UC Samsung Galaxy Z Flip 8",
    "pn": "8859703443599",
    "color": "Clear",
    "srp": 390.0,
    "f1": 5,
    "f2": 5,
    "total": 10,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0065",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Hishield Tempered Glass 2.5D Clear Samsung Z Flip8",
    "pn": "8859216860241",
    "color": "Clear",
    "srp": 490.0,
    "f1": 28,
    "f2": 0,
    "total": 28,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0066",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG UC Samsung Galaxy Z Fold 8",
    "pn": "8859703443612",
    "color": "Clear",
    "srp": 390.0,
    "f1": 3,
    "f2": 6,
    "total": 9,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0067",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Hishield TemperedGlass 2.5D Clear Samsung Z Fold8",
    "pn": "8859216860401",
    "color": "Clear",
    "srp": 590.0,
    "f1": 7,
    "f2": 0,
    "total": 7,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0068",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG UC Samsung Galaxy Z Fold 8 Ultra",
    "pn": "8859703443605",
    "color": "Clear",
    "srp": 390.0,
    "f1": 3,
    "f2": 3,
    "total": 6,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0069",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Hishield Tempered Glass 2.5D Clear Samsung Z Fold8 Ultra",
    "pn": "8859216860326",
    "color": "Clear",
    "srp": 590.0,
    "f1": 29,
    "f2": 0,
    "total": 29,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0070",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG UC Samsung Galaxy Tab A9 8.7",
    "pn": "8859703426066",
    "color": "Clear",
    "srp": 590.0,
    "f1": 5,
    "f2": 2,
    "total": 7,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0071",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG UC Samsung Galaxy Tab A9 Plus 11",
    "pn": "8859703426073",
    "color": "Clear",
    "srp": 690.0,
    "f1": 6,
    "f2": 4,
    "total": 10,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0072",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG UC Samsung Galaxy Tab S10 FE Plus 13.1",
    "pn": "8859703435204",
    "color": "Clear",
    "srp": 990.0,
    "f1": 6,
    "f2": 2,
    "total": 8,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0073",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]HISHIELD TemperedGlass FC 2.5D Samsung Tab S10 Lite",
    "pn": "8859216804085",
    "color": "Clear",
    "srp": 690.0,
    "f1": 6,
    "f2": 3,
    "total": 9,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0074",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG UC Samsung Galaxy Tab S11",
    "pn": "8859703436669",
    "color": "Clear",
    "srp": 690.0,
    "f1": 10,
    "f2": 7,
    "total": 17,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0075",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]HISHIELD TemperedGlass FC 2.5D Samsung Tab S11",
    "pn": "8859216804108",
    "color": "Clear",
    "srp": 690.0,
    "f1": 4,
    "f2": 8,
    "total": 12,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0076",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG UC Samsung Galaxy Tab S11 Ultra",
    "pn": "8859703436690",
    "color": "Clear",
    "srp": 990.0,
    "f1": 1,
    "f2": 2,
    "total": 3,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0077",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Hishield TemperedGlass 0.33mm Tab S11 Ultra",
    "pn": "8859216804122",
    "color": "Clear",
    "srp": 890.0,
    "f1": 4,
    "f2": 3,
    "total": 7,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  },
  {
    "id": "ACC-0078",
    "category": "Accessory",
    "subCategory": "ฟิล์มกันรอย",
    "model": "[CS]Focus TG UC Samsung Galaxy Tab S8 Plus 12.4",
    "pn": "8859703400226",
    "color": "Clear",
    "srp": 990.0,
    "f1": 1,
    "f2": 4,
    "total": 5,
    "productCodeType": "ACCESSORY",
    "connectivity": ""
  }
];

    // State Variables: Merge core devices (212 items) with full accessories catalog (78 items) = 290 total items
    let rawItems = [];
    let promoVariants = [];

    function renderStockProvenanceBar() {
      const container = document.getElementById("prototypeStockProvenanceBar");
      if (!container) return;

      const meta = (typeof window !== "undefined" && window.STOCK_METADATA) ? window.STOCK_METADATA : {};
      const batchId = meta.stockBatchId || meta.importBatchId || "STOCK-20260914-LATEST";
      const isLegacy = batchId === "IMPORT-20260906-002";

      if (isLegacy && window.PILOT_MODE === true) {
        console.error("[Pilot Stock] Legacy static snapshot selected:", batchId);
        container.innerHTML = `
          <div class="pilot-stock-warning-banner" style="background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; border-radius: 10px; padding: 12px 18px; margin: 12px 0; color: #fca5a5; display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.3rem;">⚠️</span>
              <div>
                <strong>ไม่สามารถโหลด Snapshot ล่าสุดได้:</strong> ระบบกำลังอ้างข้อมูลเก่าวันที่ 6 กันยายน 2026 (Batch: ${batchId})
                <div style="font-size: 0.76rem; color: #cbd5e1; margin-top: 2px;">กรุณานำเข้าไฟล์ stock(1).xlsx ที่เมนู "นำเข้าสต็อกจาก Excel" หรือกดรีเฟรชข้อมูล</div>
              </div>
            </div>
            <button onclick="window.location.hash='#/stock-import'" style="background: #ef4444; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; font-size: 0.78rem;">
              📥 ไปหน้านำเข้า Excel
            </button>
          </div>
        `;
        return;
      }

      const sourceLabel = meta.sourceType || "Imported Excel Snapshot";
      const sourceFile = meta.sourceFilename || meta.sourceFile || "stock(1).xlsx";
      const isConfirmedLocal = meta.storageScope === "LOCAL_BROWSER_ONLY" || meta.storageScope === "CONFIRMED_IMPORT" || (window.CONFIRMED_LOCAL_SNAPSHOT && window.CONFIRMED_LOCAL_SNAPSHOT.batchId === batchId);
      const storageDisplay = isConfirmedLocal ? "Local Browser (Confirmed Import)" : "Pilot Snapshot (stock(1).xlsx)";
      const rawImportedAt = meta.importedAt || "2026-09-14 09:00:00";
      const importedTime = rawImportedAt.replace("T", " ").substring(0, 19);

      container.innerHTML = `
        <div class="pilot-stock-provenance-bar" style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(0, 240, 255, 0.25); border-radius: 10px; padding: 10px 16px; margin: 12px 0 16px 0; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; font-size: 0.82rem; color: #94a3b8; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="color: var(--cyan); font-weight: 600;">แหล่งข้อมูล:</span>
            <span style="color: #f1f5f9; font-weight: 500;">${sourceLabel}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="color: var(--cyan); font-weight: 600;">ไฟล์ต้นทาง:</span>
            <span style="color: #38bdf8; font-weight: 500;">${sourceFile}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="color: var(--cyan); font-weight: 600;">Stock Batch:</span>
            <code style="color: #38bdf8; background: rgba(56, 189, 248, 0.12); padding: 2px 8px; border-radius: 4px; font-weight: 600;">${batchId}</code>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="color: var(--cyan); font-weight: 600;">Storage:</span>
            <span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${storageDisplay}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="color: var(--cyan); font-weight: 600;">อัปโหลดเมื่อ:</span>
            <span style="color: #f1f5f9;">${importedTime}</span>
          </div>
        </div>
      `;
    }

    function refreshPrototypeData() {
      const stockDb = (typeof window !== "undefined" && typeof window.getActiveStockDataset === "function")
        ? window.getActiveStockDataset()
        : ((typeof window !== "undefined" && Array.isArray(window.STOCK_DATABASE) && window.STOCK_DATABASE.length > 0)
            ? (window.LATEST_STOCK_SNAPSHOT || window.STOCK_DATABASE)
            : FALLBACK_STOCK);

      const hasImportedAccessories = stockDb !== FALLBACK_STOCK && (stockDb.length > 250 || stockDb.some(x => {
        const c = String(x.category || x.category1 || '').toUpperCase();
        return c.includes('ACC') || c.includes('ADAPTER');
      }));

      if (hasImportedAccessories) {
        rawItems = stockDb.slice();
      } else {
        const coreDevices = stockDb.filter(x => x.category !== "Accessory" && x.category !== "Adapter");
        rawItems = coreDevices.concat(ALL_ACCESSORIES);
      }

      rawItems.forEach(item => {
        if (!item.connectivity) {
          item.connectivity = resolveConnectivity(item);
        }
        if (!item.color) {
          item.color = resolveProductColor(item);
        }
      });

      if (window.PROMOTION_VARIANTS && window.PROMOTION_VARIANTS.length > 0) {
        promoVariants = window.PROMOTION_VARIANTS;
      }

      renderStockProvenanceBar();
    }

    refreshPrototypeData();
    let currentCategory = "ALL";
    let currentFilter = "all";
    let searchQuery = "";
    let currentViewMode = "table";

    // ==========================================================================
    // CONNECTIVITY & NETWORK TAG RESOLVER (4G, 5G, Wi-Fi, LTE, Bluetooth)
    // ==========================================================================
    function resolveConnectivity(item) {
      if (!item) return "";
      if (item.connectivity) return item.connectivity;
      if (item.tag) return item.tag;

      const m = (item.model || "").toUpperCase();
      const pn = (item.pn || "").toUpperCase();
      const cat = item.category || "";

      if (cat === "SmartPhone") {
        // Specific models requested: Galaxy A07 4/64GB - BOM SET, Galaxy A07 4/128GB - BOM SET, Galaxy A07 4/128GB, Galaxy A07 6/128GB -> 4G
        if (m.includes("A07")) {
          if (m.includes("5G") || pn.includes("SM-A076")) return "5G";
          return "4G";
        }
        if (m.includes("A17")) {
          if (m.includes("5G") || pn.includes("SM-A176") || pn.includes("F-A175G")) return "5G";
          return "4G";
        }
        if (m.includes("4G") || m.includes("LTE") || pn.includes("4G")) return "4G";
        if (m.includes("5G") || pn.includes("5G")) return "5G";

        // Modern Galaxy Flagships / Mid-rangers: S series, Z Flip/Fold, A2x, A3x, A5x are all 5G
        if (m.includes("S25") || m.includes("S26") || m.includes("Z FLIP") || m.includes("Z FOLD") || 
            m.includes("A27") || m.includes("A37") || m.includes("A57")) {
          return "5G";
        }
        if (pn.startsWith("SM-S") || pn.startsWith("SM-F") || pn.startsWith("F-NS") || pn.startsWith("F-N")) {
          return "5G";
        }
        // Samsung phone standard digit numbering: SM-Axx5 = 4G, SM-Axx6 / SM-Sxx1/2/7/8 = 5G
        if (pn.match(/SM-A\d\d5/)) return "4G";
        if (pn.match(/SM-[ASFX]\d\d[678]/)) return "5G";

        return "4G";
      }

      if (cat === "Tablet") {
        if (m.includes("WIFI") || m.includes("WI-FI")) return "Wi-Fi";
        if (m.includes("5G")) return "5G";
        if (m.includes("4G") || m.includes("LTE")) return "4G";

        // Samsung Tablet P/N conventions: SM-X...0 (Wi-Fi), SM-X...6 (5G), SM-X...5 (4G/LTE)
        if (pn.includes("X820") || pn.includes("X730") || pn.includes("X620") || 
            pn.includes("X520") || pn.includes("X400") || pn.includes("X230")) {
          return "Wi-Fi";
        }
        if (pn.includes("X936") || pn.includes("X826") || pn.includes("X736") || 
            pn.includes("X626") || pn.includes("X526") || pn.includes("X406") || pn.includes("X236")) {
          return "5G";
        }
        if (pn.includes("X135")) {
          return "4G";
        }
        return "Wi-Fi";
      }

      if (cat === "Watch") {
        // All Galaxy Watch Ultra (SM-L705, SM-L715) are LTE cellular by hardware specification!
        if (m.includes("ULTRA") || pn.includes("L705") || pn.includes("L715")) return "LTE";
        if (m.includes("LTE") || pn.includes("LTE") || pn.includes("R965") || pn.includes("L505")) return "LTE";
        // Samsung Watch rule: digit '5' indicates LTE (e.g. SM-Lxxx5, SM-Rxxx5)
        if (pn.match(/SM-[LR]\d\d5/i)) return "LTE";
        return "Bluetooth";
      }

      return "";
    }

    function getConnBadgeClass(conn) {
      if (!conn) return "";
      const c = conn.toLowerCase();
      if (c.includes("5g")) return "tag-5g";
      if (c.includes("4g")) return "tag-4g";
      if (c.includes("wi-fi") || c.includes("wifi")) return "tag-wifi";
      if (c.includes("lte")) return "tag-lte";
      if (c.includes("bt") || c.includes("bluetooth")) return "tag-bt";
      return "";
    }

    // Helper: Parse specs from model string & item context
    function parseSpecs(item) {
      const modelStr = (typeof item === 'string') ? item : (item ? (item.model || "") : "");
      let ram = "";
      let storage = "";
      let net = (typeof item === 'object' && item) ? resolveConnectivity(item) : "";

      const capMatch = modelStr.match(/(\d+)\s*\/\s*(\d+\s*(?:GB|TB))/i);
      if (capMatch) {
        ram = capMatch[1] + "GB";
        storage = capMatch[2].toUpperCase().replace(/\s+/g, "");
      } else {
        const singleCap = modelStr.match(/(\d+\s*(?:GB|TB))/i);
        if (singleCap) storage = singleCap[1].toUpperCase().replace(/\s+/g, "");
      }

      if (!net) {
        if (modelStr.match(/\b5G\b/i)) net = "5G";
        else if (modelStr.match(/\b4G\b/i) || modelStr.match(/\bLTE\b/i)) net = "4G";
        else if (modelStr.match(/\bWi-?Fi\b/i)) net = "Wi-Fi";
        else if (modelStr.match(/\bBT\b/i)) net = "Bluetooth";
      }

      return { ram, storage, net };
    }

    // Enrich all rawItems with connectivity tag
    rawItems.forEach(item => {
      item.connectivity = resolveConnectivity(item);
    });

    // Promotion Resolver for P/N
    function resolvePromotion(item) {
      if (!promoVariants || promoVariants.length === 0) {
        return { status: "NORMAL", variants: [], badgeText: "ราคาปกติ (RRP)", badgeClass: "promo-status-normal" };
      }

      // Match by Exact P/N first
      let matched = promoVariants.filter(v => v.pn && item.pn && v.pn.trim().toUpperCase() === item.pn.trim().toUpperCase());
      let isModelScope = false;

      // Fallback: match by Model + Capacity
      if (matched.length === 0 && item.model) {
        const cleanM = item.model.toLowerCase();
        matched = promoVariants.filter(v => v.model && cleanM.includes(v.model.toLowerCase()));
        if (matched.length > 0) isModelScope = true;
      }

      if (matched.length === 0) {
        return { status: "NORMAL", isModelScope: false, variants: [], badgeText: "ราคาปกติ (ไม่มีโปร)", badgeClass: "promo-status-normal" };
      }

      // Check for active vs expired vs review
      const todayISO = "2026-09-13";
      const activeVariants = matched.filter(v => v.startDate <= todayISO && todayISO <= v.endDate && v.validationStatus !== "BLOCKED");
      const reviewVariants = matched.filter(v => v.validationStatus === "WARNING" || v.humanReviewRequired);
      const expiredVariants = matched.filter(v => v.endDate < todayISO);

      if (activeVariants.length > 0) {
        return {
          status: "ACTIVE",
          isModelScope,
          variants: activeVariants,
          badgeText: `มีโปรโมชั่น (${activeVariants.length})`,
          badgeClass: "promo-status-active"
        };
      } else if (reviewVariants.length > 0) {
        return {
          status: "REVIEW",
          isModelScope,
          variants: reviewVariants,
          badgeText: "ต้องตรวจสอบโปรโมชั่น",
          badgeClass: "promo-status-review"
        };
      } else if (expiredVariants.length > 0) {
        return {
          status: "EXPIRED",
          isModelScope,
          variants: expiredVariants,
          badgeText: "โปรโมชั่นหมดอายุ",
          badgeClass: "promo-status-expired"
        };
      }

      return { status: "NORMAL", isModelScope, variants: matched, badgeText: "ราคาปกติ", badgeClass: "promo-status-normal" };
    }

    // ==========================================================================
    // RENDER FUNCTIONS
    // ==========================================================================

    // ==========================================================================
    // CENTRALIZED CATEGORY NORMALIZATION & RECONCILIATION ENGINE
    // ==========================================================================
    const CATEGORY_ALIASES = {
      "SMART_PHONE": "SMARTPHONE",
      "PHONE": "SMARTPHONE",
      "MOBILE": "SMARTPHONE",
      "SMARTPHONE": "SMARTPHONE",
      "SMARTPHONES": "SMARTPHONE",

      "TAB": "TABLET",
      "TABLET": "TABLET",
      "TABLETS": "TABLET",
      "GALAXY_TAB": "TABLET",
      "COMPUTER_AND_TABLET": "TABLET",

      "WATCH": "SMARTWATCH",
      "SMART_WATCH": "SMARTWATCH",
      "SMARTWATCH": "SMARTWATCH",
      "GALAXY_WATCH": "SMARTWATCH",

      "BUDS": "BUDS",
      "GALAXY_BUDS": "BUDS",
      "EARBUDS": "BUDS",
      "AUDIO": "BUDS",
      "WEARABLE_AUDIO": "BUDS",
      "HEADPHONE": "BUDS",

      "ACCESSORIES": "ACCESSORY",
      "ACCESSORY": "ACCESSORY",
      "STANDARD_ACCESSORY": "ACCESSORY",
      "MOBILE_AND_COMPUTER_ACCESSORY": "ACCESSORY",
      "SAMSUNG_ACCESSORY": "ACCESSORY",
      "THIRD_PARTY_ACCESSORY": "ACCESSORY",

      "ADAPTER": "ADAPTER",
      "CHARGER": "ADAPTER",

      "SIM": "SIM",
      "SIM_CARD": "SIM",
      "SIM_SERVICE": "SIM",
      "SERVICE,_INSURANCE_AND_WARRANTY": "SIM",

      "PREMIUM": "PREMIUM",
      "PREMIUM_GIFT": "PREMIUM",
      "GIFT": "PREMIUM",

      "OTHER": "OTHER"
    };

    function normalizeCategory(value) {
      return String(value || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    }

    function anyKeyword(str, keywords) {
      return keywords.some(k => str.includes(k));
    }

    function resolveCanonicalCategory(item) {
      if (!item) return "OTHER";

      const c1 = String(item.cat1 || item.category1 || item.category || "").trim().toUpperCase();
      const c2 = String(item.cat2 || item.category2 || "").trim().toUpperCase();
      const c3 = String(item.cat3 || item.category3 || "").trim().toUpperCase();
      const brand = String(item.brand || "").trim().toUpperCase();
      const pn = String(item.pn || "").trim().toUpperCase();
      const model = String(item.model || item.description || "").trim().toUpperCase();

      // 1. Galaxy Buds (Excel Cat1=Audio, Cat2=Headphone, Cat3=True Wireless + Samsung; or Samsung + SM-R4/5/6 / BUDS)
      // MUST be evaluated before Smartphone to prevent Buds SM-R... misclassification!
      if ((c1 === "AUDIO" && c2 === "HEADPHONE" && c3 === "TRUE WIRELESS" && brand.includes("SAMSUNG")) ||
          (brand.includes("SAMSUNG") && (pn.startsWith("SM-R4") || pn.startsWith("SM-R5") || pn.startsWith("SM-R6") || model.includes("BUDS")))) {
        return "BUDS";
      }

      // 2. Smartphone (Cat1 = SMART PHONES, never Buds/Watch/Tablet/Accessory)
      if (c1 === "SMART PHONES" || c1 === "SMARTPHONES" || c1 === "SMART PHONE" || c1 === "SMART_PHONES" || c1 === "SMART_PHONE") {
        if (!pn.startsWith("SM-R") && !pn.startsWith("SM-L") && !pn.startsWith("SM-X") && !pn.startsWith("EP-") && !pn.startsWith("EF-")) {
          return "SMARTPHONE";
        }
      }

      // 3. Tablet (Cat1 = COMPUTER AND TABLET or SM-X or TAB)
      if (c1 === "COMPUTER AND TABLET" || c1 === "COMPUTER_AND_TABLET" || c1 === "TABLET" || c1 === "TABLETS" || c1 === "TAB" || pn.startsWith("SM-X")) {
        return "TABLET";
      }

      // 4. Smart Watch (Cat1 = SMART WATCH or Watch P/Ns)
      if (c1 === "SMART WATCH" || c1 === "SMART_WATCH" || c1 === "SMARTWATCH" || c1 === "WATCH" ||
          (brand.includes("SAMSUNG") && (pn.startsWith("SM-R8") || pn.startsWith("SM-R9") || pn.startsWith("SM-L3") || pn.startsWith("SM-L7")))) {
        return "SMARTWATCH";
      }

      // 5. Accessories (Cat1 = MOBILE AND COMPUTER ACCESSORY or Accessory prefixes)
      if (c1 === "MOBILE AND COMPUTER ACCESSORY" || c1 === "MOBILE_AND_COMPUTER_ACCESSORY" || c1 === "ACCESSORY" || c1 === "ACCESSORIES" || c1 === "ADAPTER" ||
          pn.startsWith("EP-") || pn.startsWith("EF-") || pn.startsWith("GP-") || pn.startsWith("ET-") || pn.startsWith("EJ-") || pn.startsWith("EE-")) {
        return "ACCESSORY";
      }

      // 6. Premium (Gifts, promotions, premium sets)
      if (c1.includes("PREMIUM") || c2.includes("PREMIUM") || c2.includes("FREE GIFT") || model.includes("PREMIUM") || model.includes("FREE GIFT") || c1.includes("GIFT") || model.includes("GAABOR") || model.includes("STAINLESS STEEL")) {
        return "PREMIUM";
      }

      // 7. SIM (Service, carrier packs, insurance)
      if (c1.includes("SERVICE, INSURANCE AND WARRANTY") || c1.includes("SERVICE,_INSURANCE_AND_WARRANTY") || c1.includes("SIM") || c2.includes("SIM") || c2.includes("CARRIER MOBILE PACKAGE") || model.includes("SIM") || model.startsWith("(AIS)")) {
        return "SIM";
      }

      // Fallback identification by model & P/N conventions
      if (pn.startsWith("SM-R4") || pn.startsWith("SM-R5") || pn.startsWith("SM-R6") || model.includes("BUDS")) return "BUDS";
      if (pn.startsWith("SM-R8") || pn.startsWith("SM-R9") || pn.startsWith("SM-L3") || pn.startsWith("SM-L7") || model.includes("WATCH")) return "SMARTWATCH";
      if (pn.startsWith("SM-X") || model.includes("TAB ") || model.includes("GALAXY TAB")) return "TABLET";
      if ((pn.startsWith("SM-") || pn.startsWith("F-")) && !pn.startsWith("SM-R") && !pn.startsWith("SM-L") && !pn.startsWith("SM-X")) {
        return "SMARTPHONE";
      }

      // If category1 exists from Excel, any item reaching here is definitively OTHER
      if (item.category1 || item.cat1) {
        return "OTHER";
      }

      const rawCat = normalizeCategory(item.category);
      if (CATEGORY_ALIASES[rawCat] && CATEGORY_ALIASES[rawCat] !== "SMARTPHONE") {
        return CATEGORY_ALIASES[rawCat];
      }

      return "OTHER";
    }

    function isSmartphone(item) {
      if (!item) return false;
      const canonical = resolveCanonicalCategory(item);
      if (canonical !== "SMARTPHONE") return false;

      const pn = String(item.pn || "").trim().toUpperCase();
      if (pn.startsWith("SM-R") || pn.startsWith("SM-L") || pn.startsWith("SM-X") || pn.startsWith("EP-") || pn.startsWith("EF-")) {
        return false;
      }
      return true;
    }

    function calculateCategoryCard(items) {
      const uniquePnCount = new Set(
        items
          .filter(item => Number(item.f1 !== undefined ? item.f1 : (item.stock_f1 !== undefined ? item.stock_f1 : 0)) > 0)
          .map(item => String(item.pn || "").trim().toUpperCase())
          .filter(Boolean)
      ).size;

      const floor1Units = items.reduce(
        (sum, item) => sum + Number(item.f1 !== undefined ? item.f1 : (item.stock_f1 !== undefined ? item.stock_f1 : 0)),
        0
      );

      return {
        uniquePnCount,
        floor1Units
      };
    }

    window.calculateCategoryCard = calculateCategoryCard;
    window.normalizeCategory = normalizeCategory;
    window.CATEGORY_ALIASES = CATEGORY_ALIASES;
    window.resolveCanonicalCategory = resolveCanonicalCategory;
    window.isSmartphone = isSmartphone;
    window.resolveProductColor = resolveProductColor;
    window.getColorHex = getColorHex;
    window.COLOR_SWATCHES = COLOR_SWATCHES;
    window.normalizeColorKey = normalizeColorKey;

    function updateCategoryCardCounts() {
      const counts = {
        ALL: { pns: new Set(), stock: 0 },
        SmartPhone: { pns: new Set(), stock: 0 },
        Tablet: { pns: new Set(), stock: 0 },
        Watch: { pns: new Set(), stock: 0 },
        Buds: { pns: new Set(), stock: 0 },
        Accessory: { pns: new Set(), stock: 0 },
        SIM: { pns: new Set(), stock: 0 },
        Premium: { pns: new Set(), stock: 0 },
        Other: { pns: new Set(), stock: 0 }
      };

      rawItems.forEach(item => {
        const pn = String(item.pn || "").trim().toUpperCase();
        const f1 = Number(item.f1 !== undefined ? item.f1 : (item.stock_f1 !== undefined ? item.stock_f1 : 0));

        // Total Sheet1/F1 Stock: SUM(f1) and distinct P/Ns present on Floor 1
        counts.ALL.stock += f1;
        if (f1 > 0 && pn) {
          counts.ALL.pns.add(pn);
        }

        const canonical = resolveCanonicalCategory(item);

        if (canonical === "SMARTPHONE") {
          counts.SmartPhone.stock += f1;
          if (f1 > 0 && pn) counts.SmartPhone.pns.add(pn);
        } else if (canonical === "TABLET") {
          counts.Tablet.stock += f1;
          if (f1 > 0 && pn) counts.Tablet.pns.add(pn);
        } else if (canonical === "SMARTWATCH") {
          counts.Watch.stock += f1;
          if (f1 > 0 && pn) counts.Watch.pns.add(pn);
        } else if (canonical === "BUDS") {
          counts.Buds.stock += f1;
          if (f1 > 0 && pn) counts.Buds.pns.add(pn);
        } else if (canonical === "ACCESSORY" || canonical === "ADAPTER") {
          counts.Accessory.stock += f1;
          if (f1 > 0 && pn) counts.Accessory.pns.add(pn);
        } else if (canonical === "SIM") {
          counts.SIM.stock += f1;
          if (f1 > 0 && pn) counts.SIM.pns.add(pn);
        } else if (canonical === "PREMIUM") {
          counts.Premium.stock += f1;
          if (f1 > 0 && pn) counts.Premium.pns.add(pn);
        } else {
          counts.Other.stock += f1;
          if (f1 > 0 && pn) counts.Other.pns.add(pn);
        }
      });

      const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };

      setTxt("countCatAllModels", `${counts.ALL.pns.size} รายการ`);
      setTxt("countCatAllStock", counts.ALL.stock.toLocaleString('th-TH'));

      setTxt("countCatPhoneModels", `${counts.SmartPhone.pns.size} รุ่น`);
      setTxt("countCatPhoneStock", counts.SmartPhone.stock.toLocaleString('th-TH'));

      setTxt("countCatTabModels", `${counts.Tablet.pns.size} รุ่น`);
      setTxt("countCatTabStock", counts.Tablet.stock.toLocaleString('th-TH'));

      setTxt("countCatWatchModels", `${counts.Watch.pns.size} รุ่น`);
      setTxt("countCatWatchStock", counts.Watch.stock.toLocaleString('th-TH'));

      setTxt("countCatBudsModels", `${counts.Buds.pns.size} รุ่น`);
      setTxt("countCatBudsStock", counts.Buds.stock.toLocaleString('th-TH'));

      setTxt("countCatAccModels", `${counts.Accessory.pns.size} รายการ`);
      setTxt("countCatAccStock", counts.Accessory.stock.toLocaleString('th-TH'));

      setTxt("countCatSimModels", `${counts.SIM.pns.size} รายการ`);
      setTxt("countCatSimStock", counts.SIM.stock.toLocaleString('th-TH'));

      setTxt("countCatPremModels", `${counts.Premium.pns.size} รายการ`);
      setTxt("countCatPremStock", counts.Premium.stock.toLocaleString('th-TH'));

      setTxt("countCatOtherModels", `${counts.Other.pns.size} รายการ`);
      setTxt("countCatOtherStock", counts.Other.stock.toLocaleString('th-TH'));

      const kpiTotalStock = document.getElementById("kpiTotalStock");
      if (kpiTotalStock) {
        kpiTotalStock.textContent = counts.ALL.stock.toLocaleString('th-TH');
      }

      // Mandatory visibility rule: Show 7 cards (Total, Phone, Tablet, Watch, Buds, Accessory, Premium), strictly hide SIM and Other
      const simCard = document.getElementById("catCardSIM");
      if (simCard) simCard.style.cssText = "display: none !important;";
      const otherCard = document.getElementById("catCardOther");
      if (otherCard) otherCard.style.cssText = "display: none !important;";
      const premCard = document.getElementById("catCardPremium");
      if (premCard) premCard.style.cssText = "display: flex !important;";
    }

    function filterItems() {
      return rawItems.filter(item => {
        // 1. Category Filter with Centralized Normalization
        if (currentCategory !== "ALL") {
          const canonical = resolveCanonicalCategory(item);
          if (currentCategory === "SmartPhone") {
            if (!isSmartphone(item)) return false;
          } else if (currentCategory === "Tablet") {
            if (canonical !== "TABLET") return false;
          } else if (currentCategory === "Watch") {
            if (canonical !== "SMARTWATCH") return false;
          } else if (currentCategory === "Buds") {
            if (canonical !== "BUDS") return false;
          } else if (currentCategory === "Accessory") {
            if (canonical !== "ACCESSORY" && canonical !== "ADAPTER") return false;
          } else if (currentCategory === "SIM") {
            if (canonical !== "SIM") return false;
          } else if (currentCategory === "Premium") {
            if (canonical !== "PREMIUM") return false;
          } else if (currentCategory === "Other") {
            if (canonical !== "OTHER") return false;
          }
        }

        // 2. Chip Filters
        const f1 = Number(item.f1 || 0);
        const f2 = Number(item.f2 || 0);
        const total = Number(item.total !== undefined ? item.total : (item.stock_total || 0));
        const isPassF = item.productCodeType === "PASS_F" || (item.model && item.model.includes("พาส F")) || (item.pn && item.pn.startsWith("F-"));

        if (currentFilter === "tag-5g" && item.connectivity !== "5G") return false;
        if (currentFilter === "tag-4g" && item.connectivity !== "4G") return false;
        if (currentFilter === "tag-lte" && item.connectivity !== "LTE") return false;
        if (currentFilter === "tag-bt" && item.connectivity !== "Bluetooth") return false;
        if (currentFilter === "tag-wifi" && item.connectivity !== "Wi-Fi") return false;
        if (currentFilter === "sub-film" && (!item.subCategory || !item.subCategory.includes("ฟิล์ม"))) return false;
        if (currentFilter === "sub-charger" && (!item.subCategory || !item.subCategory.includes("หัวชาร์จ"))) return false;
        if (currentFilter === "sub-case" && (!item.subCategory || !item.subCategory.includes("เคส"))) return false;
        if (currentFilter === "sub-tag" && (!item.subCategory || !item.subCategory.includes("สมาร์ทแท็ก"))) return false;
        if (currentFilter === "instock" && total <= 0) return false;
        if (currentFilter === "f1" && f1 <= 0) return false;
        if (currentFilter === "f2" && f2 <= 0) return false;
        if (currentFilter === "passf" && !isPassF) return false;

        const promo = resolvePromotion(item);
        if (currentFilter === "haspromo" && promo.status !== "ACTIVE" && promo.status !== "REVIEW") return false;

        // 3. Multi-field Smart Search
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const m = (item.model || "").toLowerCase();
          const p = (item.pn || "").toLowerCase();
          const c = (item.color || "").toLowerCase();
          const cat = (item.category || "").toLowerCase();
          const conn = (item.connectivity || "").toLowerCase();
          const sub = (item.subCategory || "").toLowerCase();

          const matchAllWords = q.split(" ").every(word => {
            if (!word) return true;
            return m.includes(word) || p.includes(word) || c.includes(word) || cat.includes(word) || conn.includes(word) || sub.includes(word);
          });
          if (!matchAllWords) return false;
        }

        return true;
      });
    }

    function renderStockList() {
      const items = filterItems();
      const visibleEl = document.getElementById("visibleCountDisplay");
      const totalEl = document.getElementById("totalCountDisplay");
      if (visibleEl) visibleEl.textContent = items.length;
      if (totalEl) totalEl.textContent = rawItems.length;

      const tbody = document.getElementById("stockTableBody");
      const cardContainer = document.getElementById("cardViewContainer");
      if (!tbody || !cardContainer) {
        console.warn("[Stock Prototype] stockTableBody or cardViewContainer not found in DOM");
        return;
      }

      tbody.innerHTML = "";
      cardContainer.innerHTML = "";

      if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">🔍 ไม่พบรายการสินค้าตามเงื่อนไขที่ค้นหา</td></tr>`;
        cardContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">🔍 ไม่พบรายการสินค้าตามเงื่อนไขที่ค้นหา</div>`;
        return;
      }

      console.info("[Stock Prototype] rendering rows:", items.length);

      let renderedRows = 0;
      items.forEach((item, index) => {
        try {
          const specs = parseSpecs(item);
          const resolvedColor = resolveProductColor(item);
          const colorName = resolvedColor || "ไม่ระบุสี";
          const colorHex = getColorHex(resolvedColor);
          const f1 = Number(item.f1 || 0);
          const f2 = Number(item.f2 || 0);
          const total = Number(item.total !== undefined ? item.total : (item.stock_total || 0));
          const promo = resolvePromotion(item);
          const pnText = item.pn || "ไม่มีรหัส P/N";

          // Table Row
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>
              <div class="product-identity-group">
                <div class="product-title-row">
                  <span class="product-model-name">${item.model || "-"}</span>
                  ${pnText !== "ไม่มีรหัส P/N" ? `<span class="badge-pn-pill">${pnText}</span>` : ''}
                </div>
                <div class="product-spec-row">
                  ${item.subCategory ? `<span class="badge-tag-conn tag-subcat">${item.subCategory}</span>` : ''}
                  ${specs.ram || specs.storage ? `<span class="badge-spec-pill">${specs.ram ? specs.ram + ' / ' : ''}${specs.storage}</span>` : ''}
                  ${specs.net ? `<span class="badge-tag-conn ${getConnBadgeClass(specs.net)}">${specs.net}</span>` : ''}
                  ${item.srp ? `<span style="color: var(--text-muted);">RRP: ฿${Number(item.srp).toLocaleString('th-TH')}</span>` : ''}
                </div>
              </div>
            </td>
            <td>
              <div class="color-display-cell">
                <span class="color-swatch-dot" style="background-color: ${colorHex};"></span>
                <span class="color-name-text">${colorName}</span>
              </div>
            </td>
            <td>
              <span style="font-size: 0.8rem; color: var(--text-secondary);">${item.category || "-"}</span>
            </td>
            <td style="text-align: center;">
              <span class="stock-qty-pill stock-f1 ${f1 === 0 ? 'stock-zero' : ''}">${f1}</span>
            </td>
            <td style="text-align: center;">
              <span class="stock-qty-pill stock-f2 ${f2 === 0 ? 'stock-zero' : ''}">${f2}</span>
            </td>
            <td style="text-align: center;">
              <strong class="stock-qty-pill stock-total-badge ${total === 0 ? 'stock-zero' : ''}">${total}</strong>
            </td>
            <td>
              <span class="promo-status-badge ${promo.badgeClass}">${promo.badgeText}</span>
            </td>
            <td style="text-align: right;">
              <div class="action-button-group">
                <button class="btn-spec-drawer" onclick="openProductSpecsDrawer('${item.pn || ''}', '${encodeURIComponent(item.model || '')}')" title="ดูข้อมูลสเปกสินค้าอย่างละเอียด">
                  <span>📋 สเปก</span>
                </button>
                <button class="btn-promo-drawer" onclick="openPromoDrawer('${item.pn || ''}', '${encodeURIComponent(item.model || '')}')" title="ดูโปรโมชั่นและราคา">
                  <span>✨ ดูโปรโมชั่น</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </td>
          `;
          tbody.appendChild(tr);

          // Card Item (Responsive View)
          const card = document.createElement("div");
          card.className = "product-card-item";
          card.innerHTML = `
            <div>
              <div class="card-top-row">
                <div>
                  <strong style="font-size: 1rem; color: #fff;">${item.model || "-"}</strong>
                  <div class="card-meta-row">
                    <span class="badge-pn-pill">${pnText}</span>
                    ${item.subCategory ? `<span class="badge-tag-conn tag-subcat">${item.subCategory}</span>` : ''}
                    ${specs.net ? `<span class="badge-tag-conn ${getConnBadgeClass(specs.net)}">${specs.net}</span>` : ''}
                    <span class="promo-status-badge ${promo.badgeClass}">${promo.badgeText}</span>
                  </div>
                  ${specs.ram || specs.storage ? `<div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px;">${specs.ram ? specs.ram + ' / ' : ''}${specs.storage}</div>` : ''}
                </div>
                <div class="color-display-cell" style="flex-direction: column; align-items: flex-end;">
                  <span class="color-swatch-dot" style="background-color: ${colorHex}; width: 20px; height: 20px;"></span>
                  <span style="font-size: 0.76rem; color: var(--text-secondary); margin-top: 2px;">${colorName}</span>
                </div>
              </div>
            </div>

            <div class="card-stock-row">
              <div class="card-stock-col">
                <div class="card-stock-label">ช1 ร้านเรา</div>
                <span class="stock-qty-pill stock-f1 ${f1 === 0 ? 'stock-zero' : ''}" style="margin-top: 4px;">${f1}</span>
              </div>
              <div class="card-stock-col">
                <div class="card-stock-label">ช2 สาขา</div>
                <span class="stock-qty-pill stock-f2 ${f2 === 0 ? 'stock-zero' : ''}" style="margin-top: 4px;">${f2}</span>
              </div>
              <div class="card-stock-col">
                <div class="card-stock-label">รวมทั้งหมด</div>
                <strong class="stock-qty-pill stock-total-badge ${total === 0 ? 'stock-zero' : ''}" style="margin-top: 4px;">${total}</strong>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; pt-2; gap: 8px;">
              <div style="font-size: 0.82rem; color: var(--text-muted);">
                ราคาปกติ: <strong style="color: #cbd5e1;">฿${Number(item.srp || 0).toLocaleString('th-TH')}</strong>
              </div>
              <div class="action-button-group">
                <button class="btn-spec-drawer" onclick="openProductSpecsDrawer('${item.pn || ''}', '${encodeURIComponent(item.model || '')}')" title="ดูข้อมูลสเปกสินค้า">
                  <span>📋 สเปก</span>
                </button>
                <button class="btn-promo-drawer" onclick="openPromoDrawer('${item.pn || ''}', '${encodeURIComponent(item.model || '')}')">
                  <span>✨ โปรโมชั่น</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>
          `;
          cardContainer.appendChild(card);
          renderedRows++;
        } catch (itemErr) {
          console.error("[Stock Prototype] row render failed:", {
            index,
            productId: item?.id || "UNKNOWN",
            pn: item?.pn || "UNKNOWN",
            error: itemErr
          });
        }
      });

      console.info("[Stock Prototype] rendered DOM rows:", tbody.querySelectorAll("tr").length);
    }

    // ==========================================================================
    // PROMOTION & SPECIFICATIONS SIDE PANEL (DUAL-TAB DRAWER) CONTROLLER
    // ==========================================================================

    let currentDrawerItem = null;
    let currentDrawerTab = "PROMO"; // "PROMO" or "SPECS"

    function openPromoDrawer(targetPn, encodedModel) {
      currentDrawerTab = "PROMO";
      openDualTabDrawer(targetPn, encodedModel);
    }

    function openProductSpecsDrawer(targetPn, encodedModel) {
      currentDrawerTab = "SPECS";
      openDualTabDrawer(targetPn, encodedModel);
    }

    function switchDrawerMainTab(tabName) {
      currentDrawerTab = tabName;
      const tabBtnPromo = document.getElementById("tabBtnPromo");
      const tabBtnSpecs = document.getElementById("tabBtnSpecs");
      
      if (tabName === "PROMO") {
        if (tabBtnPromo) tabBtnPromo.classList.add("active");
        if (tabBtnSpecs) tabBtnSpecs.classList.remove("active");
      } else {
        if (tabBtnPromo) tabBtnPromo.classList.remove("active");
        if (tabBtnSpecs) tabBtnSpecs.classList.add("active");
      }

      renderCurrentDrawerBody();
    }

    function openDualTabDrawer(targetPn, encodedModel) {
      const modelTitle = decodeURIComponent(encodedModel);
      currentDrawerItem = rawItems.find(x => (x.pn && targetPn && x.pn === targetPn) || (x.model === modelTitle));
      if (!currentDrawerItem) {
        currentDrawerItem = { pn: targetPn, model: modelTitle, srp: 0, color: "", f1: 0, f2: 0, total: 0 };
      }

      const item = currentDrawerItem;
      const drawerTitle = document.getElementById("drawerProductTitle");
      const drawerPn = document.getElementById("drawerProductPn");

      const conn = item.connectivity || resolveConnectivity(item);
      drawerTitle.textContent = item.model || modelTitle;
      drawerPn.innerHTML = `${item.pn ? `Exact P/N: ${item.pn}` : "รหัส: ไม่ระบุ P/N เฉพาะเจาะจง"} ${conn ? `<span class="badge-tag-conn ${getConnBadgeClass(conn)}" style="margin-left: 8px;">${conn}</span>` : ''}`;

      switchDrawerMainTab(currentDrawerTab);
      const promoDrawerBackdrop = document.getElementById("promoDrawerBackdrop");
      if (promoDrawerBackdrop) {
        promoDrawerBackdrop.classList.add("open");
      }
      document.body.style.overflow = "hidden";
      const drawerBody = document.getElementById("drawerBody");
      if (drawerBody) {
        drawerBody.scrollTop = 0;
      }
    }

    function renderCurrentDrawerBody() {
      const drawerBody = document.getElementById("drawerBody");
      const item = currentDrawerItem;
      if (!item || !drawerBody) return;

      let f1 = Number(item.f1 || 0);
      let f2 = Number(item.f2 || 0);
      let total = Number(item.total || 0);
      let srp = Number(item.srp || 0);

      // Summary Strip always on top
      const commonHeader = `
        <div class="drawer-summary-strip">
          <div>
            <div style="font-size: 0.74rem; color: var(--text-muted); text-transform: uppercase;">สีของเครื่อง</div>
            <div class="color-display-cell" style="margin-top: 4px;">
              <span class="color-swatch-dot" style="background-color: ${getColorHex(item.color)};"></span>
              <strong>${item.color || 'ไม่ระบุ'}</strong>
            </div>
          </div>
          <div>
            <div style="font-size: 0.74rem; color: var(--text-muted); text-transform: uppercase;">สถานะสต็อก</div>
            <div style="margin-top: 4px; font-size: 0.88rem;">
              ช1: <strong class="${f1 === 0 ? 'text-coral' : 'text-cyan'}">${f1}</strong> • 
              ช2: <strong class="${f2 === 0 ? 'text-coral' : 'text-amber'}">${f2}</strong> • 
              รวม: <strong class="text-emerald">${total}</strong>
            </div>
          </div>
        </div>
      `;

      if (currentDrawerTab === "SPECS") {
        drawerBody.innerHTML = commonHeader + renderDrawerSpecDetails(item);
      } else {
        // PROMO TAB
        const promo = resolvePromotion(item);
        let promoHtml = commonHeader;

        if (promo.isModelScope) {
          promoHtml += `
            <div class="model-scope-notice">
              <span style="font-size: 1.2rem;">⚠️</span>
              <div>
                <strong>โปรโมชั่นระดับรุ่น (Model Scope)</strong>
                <div>ไฟล์โปรโมชั่นไม่มี Exact P/N กรุณาตรวจสอบสีและความจุก่อนขาย</div>
              </div>
            </div>
          `;
        }

        if (!promo.variants || promo.variants.length === 0) {
          promoHtml += `
            <div class="empty-promo-state">
              <div class="empty-promo-icon">🏷️</div>
              <h4 class="empty-promo-title">ยังไม่มีโปรโมชั่นที่ผ่านการตรวจสอบ</h4>
              <p class="empty-promo-desc">
                ระบบตรวจสอบความเสี่ยง 95/5 Risk Guard ไม่พบโปรโมชั่นที่ผ่านเกณฑ์หรือแคมเปญอาจสิ้นสุดลงแล้ว สามารถจำหน่ายได้ในราคาปกติ
              </p>
              <div class="promo-price-card" style="border-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.02);">
                <div class="price-row-item">
                  <span style="color: var(--text-muted);">ราคามาตรฐาน (RRP)</span>
                  <strong style="font-size: 1.2rem; color: #fff;">฿${srp.toLocaleString('th-TH')}</strong>
                </div>
                <div class="price-row-item net">
                  <span>ราคาสุทธิ (Net Price)</span>
                  <span class="net-price-display" style="color: #38bdf8;">฿${srp.toLocaleString('th-TH')}</span>
                </div>
              </div>
            </div>
          `;
        } else {
          const modes = [
            { key: "NORMAL", label: "ซื้อปกติ" },
            { key: "SF_PLUS", label: "Samsung Finance+" },
            { key: "STUDENT", label: "โปร นศ." },
            { key: "TRADE_UP", label: "Trade Up" },
            { key: "BUNDLE", label: "ซื้อพ่วง" }
          ];

          promoHtml += `
            <div class="sale-mode-tabs" id="drawerTabs">
              ${modes.map((m, idx) => `
                <button class="sale-mode-tab ${idx === 0 ? 'active' : ''}" onclick="switchDrawerMode('${m.key}', this)">
                  ${m.label}
                </button>
              `).join("")}
            </div>
            <div id="drawerModeContent">
              ${renderDrawerModeDetails(promo.variants, "NORMAL", srp)}
            </div>
          `;
        }
        drawerBody.innerHTML = promoHtml;
      }
    }

    // Spec Details Renderer with Deterministic Product Identity Gate & 100% ERP Coverage
    function renderDrawerSpecDetails(item) {
      const spec = (typeof window !== "undefined" && window.resolveProductSpecs) ? window.resolveProductSpecs(item) : null;

      // Level 1: Basic ERP Stock Metadata Box (100% Display Coverage)
      const catHierarchy = [item.category1, item.category2, item.category3].filter(Boolean).join(" &rarr; ");
      const erpHtml = `
        <div class="spec-card-container">
          <div class="spec-group-box" style="margin-bottom: 12px; border-color: rgba(255,255,255,0.12); background: rgba(255,255,255,0.02);">
            <div class="spec-group-title" style="color: #94a3b8;">
              <span>📦</span>
              <span>ข้อมูลสินค้าจากระบบสต๊อก (ERP Stock Master)</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; font-size: 0.82rem;">
              <div>
                <span class="spec-label">รหัสสินค้า (ERP P/N):</span>
                <strong style="color: #fff; font-family: monospace;">${item.pn || 'ไม่ระบุ'}</strong>
              </div>
              <div>
                <span class="spec-label">แบรนด์สินค้า:</span>
                <strong style="color: var(--cyan);">${item.brand || (spec && spec.brand) || 'ไม่ระบุ'}</strong>
              </div>
              <div>
                <span class="spec-label">หมวดหมู่สต๊อก:</span>
                <strong style="color: #cbd5e1;">${item.category || item.canonicalCategory || 'Other'}</strong>
              </div>
              <div>
                <span class="spec-label">ราคามาตรฐาน (SRP):</span>
                <strong style="color: #38bdf8;">฿${Number(item.srp || 0).toLocaleString('th-TH')}</strong>
              </div>
            </div>
            ${catHierarchy ? `
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.06); font-size: 0.76rem; color: var(--text-muted);">
                ลำดับหมวดหมู่ ERP: <span style="color: #cbd5e1;">${catHierarchy}</span>
              </div>
            ` : ''}
          </div>
      `;

      if (!spec) {
        // FAIL CLOSED: SPEC_NOT_VERIFIED Banner (No guess, no fallback to Galaxy A07)
        return erpHtml + `
          <div class="empty-promo-state" style="padding: 24px 16px; border: 1px dashed rgba(245, 158, 11, 0.4); background: rgba(245, 158, 11, 0.04); border-radius: 12px; text-align: left;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
              <span style="font-size: 1.4rem;">⚠️</span>
              <strong style="font-size: 0.95rem; color: #fbbf24;">ยังไม่มีข้อมูลสเปกที่ตรวจสอบแล้วสำหรับสินค้านี้ (SPEC_NOT_VERIFIED)</strong>
            </div>
            <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.6; margin: 0;">
              ระบบใช้มาตรฐาน <strong>Deterministic Product Identity Gate</strong> เพื่อป้องกันการแสดงข้อมูลผิดพลาดข้ามแบรนด์หรือข้ามหมวดหมู่<br>
              สินค้าคงคลัง ข้อมูลสี และจำนวนสต๊อกหน้าร้าน (ชั้น 1 / ชั้น 2) ยังคงใช้งานและตรวจสอบยอดขายได้ตามปกติ 100%
            </p>
          </div>
        </div>`;
      }

      // Level 2: Verified Technical Specs with Evidence Status Header
      const isPartiallyVerified = spec.verificationStatus === "PARTIALLY_VERIFIED";
      const statusBadgeClass = isPartiallyVerified ? "warn" : "pass";
      const statusBadgeText = isPartiallyVerified ? "PARTIALLY_VERIFIED" : (spec.verificationStatus || "VERIFIED");
      const statusBadgeStyle = isPartiallyVerified 
        ? "background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);" 
        : "";

      let html = erpHtml + `
          <div class="spec-source-box" style="border-color: ${isPartiallyVerified ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)'}; background: ${isPartiallyVerified ? 'rgba(245, 158, 11, 0.05)' : 'rgba(16, 185, 129, 0.05)'};">
            <span style="font-size: 1.4rem;">${isPartiallyVerified ? '⚠️' : '🛡️'}</span>
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-weight: 700; color: #fff; font-size: 0.95rem;">${spec.officialName || spec.modelGroup || item.model}</span>
                <span class="status-badge-gate ${statusBadgeClass}" style="font-size: 0.7rem; padding: 2px 6px; ${statusBadgeStyle}">${statusBadgeText}</span>
              </div>
              <div style="font-size: 0.78rem; color: var(--cyan); margin-top: 4px;">
                แบรนด์: <strong>${spec.brand || item.brand || 'Samsung'}</strong> • รุ่นผู้ผลิต: <strong>${spec.manufacturerModel || spec.modelGroup || '-'}</strong> • ประเภท: <strong>${spec.productType || item.category || '-'}</strong>
              </div>
              <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 2px;">
                แหล่งข้อมูลอ้างอิง: <strong>${spec.source || 'Official Certified Brand Specifications'}</strong>
              </div>
              ${spec.sourceUrl ? `
                <div style="font-size: 0.72rem; margin-top: 2px;">
                  <a href="${spec.sourceUrl}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: underline;">
                    🔗 เปิดหน้าผลิตภัณฑ์ทางการ (${spec.brand || 'ผู้ผลิต'})
                  </a>
                </div>
              ` : ''}
              ${isPartiallyVerified ? `
                <div style="margin-top: 6px; padding: 6px 10px; background: rgba(245, 158, 11, 0.08); border-radius: 6px; font-size: 0.73rem; border-left: 2px solid #fbbf24;">
                  <div style="color: #fbbf24; font-weight: 600;">⚠️ สถานะการตรวจสอบระดับฟิลด์ (Field-Level Verification):</div>
                  <div style="color: #e2e8f0; margin-top: 2px;">
                    <span style="color: #34d399;">✓ ข้อมูลที่ยืนยันแล้ว:</span> ${(spec.verifiedFields || []).join(', ') || '5W, IP67, 20h, TWS, สายคล้องในตัว'}
                  </div>
                  <div style="color: #cbd5e1; margin-top: 2px;">
                    <span style="color: #fbbf24;">⏳ ข้อมูลที่ยังไม่ได้ยืนยัน:</span> ${(spec.pendingFields || []).join(', ') || 'Bluetooth Version, การรับประกันในไทย'}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
      `;

      function renderSpecGroup(icon, title, fields) {
        const validRows = Object.entries(fields).filter(([k, v]) => v !== undefined && v !== null && v !== "");
        if (validRows.length === 0) return "";
        return `
          <div class="spec-group-box">
            <div class="spec-group-title">
              <span>${icon}</span>
              <span>${title}</span>
            </div>
            ${validRows.map(([label, val]) => `
              <div class="spec-item-row">
                <span class="spec-label">${label}</span>
                <span class="spec-val">${val}</span>
              </div>
            `).join("")}
          </div>
        `;
      }

      // 1. Display
      if (spec.display) {
        html += renderSpecGroup("📱", "หน้าจอแสดงผล (Display)", {
          "ขนาดหน้าจอ": spec.display.screenSize,
          "ชนิดหน้าจอ": spec.display.panelType,
          "ความละเอียด": spec.display.resolution,
          "อัตรารีเฟรช": spec.display.refreshRate,
          "ความสว่างสูงสุด": spec.display.peakBrightness,
          "กระจกกันรอย": spec.display.glassProtection
        });
      }

      // 2. Performance & AI
      if (spec.performance) {
        html += renderSpecGroup("⚡", "ประสิทธิภาพ & Galaxy AI (Performance)", {
          "ชิปเซ็ตประมวลผล": spec.performance.processor,
          "แกนประมวลผล (CPU)": spec.performance.cpuCores,
          "ชิปกราฟิก (GPU)": spec.performance.gpu,
          "ระบบปัญญาประดิษฐ์": spec.performance.aiEngine
        });
      }

      // 3. Memory & Storage
      if (spec.memory) {
        html += renderSpecGroup("💾", "หน่วยความจำ & ความจุ (Memory)", {
          "หน่วยความจำ (RAM)": spec.memory.ram,
          "พื้นที่จัดเก็บ (ROM)": spec.memory.storage,
          "ช่องใส่ MicroSD": spec.memory.expandableStorage
        });
      }

      // 4. Camera
      if (spec.camera) {
        html += renderSpecGroup("📷", "กล้องถ่ายภาพ (Camera System)", {
          "กล้องหลัง (Rear)": spec.camera.rearCamera,
          "กล้องหน้า (Selfie)": spec.camera.frontCamera,
          "ความละเอียดวิดีโอ": spec.camera.videoRecording
        });
      }

      // 5. Battery & Power
      if (spec.battery) {
        html += renderSpecGroup("🔋", "แบตเตอรี่ & ระบบชาร์จ (Battery & Charging)", {
          "ความจุแบตเตอรี่": spec.battery.capacity,
          "การชาร์จไวมีสาย": spec.battery.chargingSpeed,
          "การชาร์จไร้สาย": spec.battery.wirelessCharging,
          "แชร์พลังงานไร้สาย": spec.battery.reverseCharging
        });
      }

      // 5.1 Battery Usage Hours & Endurance (ระยะเวลาการใช้งานแบตเตอรี่อย่างละเอียด พร้อมแหล่งอ้างอิงทางการ)
      const bh = spec.batteryHours || (spec.battery && spec.battery.usageHours);
      if (bh) {
        html += `
          <div class="spec-group-box" style="border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.05);">
            <div class="spec-group-title" style="color: #34d399;">
              <span>⏱️</span>
              <span>ระยะเวลาการใช้งานแบตเตอรี่ (Battery Usage Hours)</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 12px;">
              ${bh.videoPlayback ? `
                <div style="padding: 10px 12px; background: rgba(15, 23, 42, 0.85); border-radius: 8px; border-left: 3px solid #34d399;">
                  <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">🎬 ดูวิดีโอต่อเนื่อง</div>
                  <strong style="color: #fff; font-size: 0.92rem; margin-top: 2px; display: block;">${bh.videoPlayback}</strong>
                </div>
              ` : ''}
              ${bh.audioPlayback ? `
                <div style="padding: 10px 12px; background: rgba(15, 23, 42, 0.85); border-radius: 8px; border-left: 3px solid #38bdf8;">
                  <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">🎵 ฟังเพลงต่อเนื่อง</div>
                  <strong style="color: #fff; font-size: 0.92rem; margin-top: 2px; display: block;">${bh.audioPlayback}</strong>
                </div>
              ` : ''}
              ${bh.internetUsage ? `
                <div style="padding: 10px 12px; background: rgba(15, 23, 42, 0.85); border-radius: 8px; border-left: 3px solid #818cf8;">
                  <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">🌐 เล่นอินเทอร์เน็ต (LTE/Wi-Fi)</div>
                  <strong style="color: #fff; font-size: 0.92rem; margin-top: 2px; display: block;">${bh.internetUsage}</strong>
                </div>
              ` : ''}
              ${bh.talkTime ? `
                <div style="padding: 10px 12px; background: rgba(15, 23, 42, 0.85); border-radius: 8px; border-left: 3px solid #f59e0b;">
                  <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">📞 สนทนาต่อเนื่อง (4G LTE)</div>
                  <strong style="color: #fff; font-size: 0.92rem; margin-top: 2px; display: block;">${bh.talkTime}</strong>
                </div>
              ` : ''}
              ${bh.typicalUsage ? `
                <div style="padding: 10px 12px; background: rgba(15, 23, 42, 0.85); border-radius: 8px; border-left: 3px solid #34d399;">
                  <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">🕒 การใช้งานทั่วไป (Typical)</div>
                  <strong style="color: #fff; font-size: 0.92rem; margin-top: 2px; display: block;">${bh.typicalUsage}</strong>
                </div>
              ` : ''}
              ${bh.powerSavingMode ? `
                <div style="padding: 10px 12px; background: rgba(15, 23, 42, 0.85); border-radius: 8px; border-left: 3px solid #10b981;">
                  <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">🛡️ โหมดประหยัดพลังงาน</div>
                  <strong style="color: #34d399; font-size: 0.92rem; margin-top: 2px; display: block;">${bh.powerSavingMode}</strong>
                </div>
              ` : ''}
              ${bh.exercisePowerSaving ? `
                <div style="padding: 10px 12px; background: rgba(15, 23, 42, 0.85); border-radius: 8px; border-left: 3px solid #06b6d4;">
                  <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">🏃 โหมดออกกำลังกาย GPS</div>
                  <strong style="color: #fff; font-size: 0.92rem; margin-top: 2px; display: block;">${bh.exercisePowerSaving}</strong>
                </div>
              ` : ''}
              ${bh.earbudsMusicANC ? `
                <div style="padding: 10px 12px; background: rgba(15, 23, 42, 0.85); border-radius: 8px; border-left: 3px solid #a855f7;">
                  <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">🎧 ฟังเพลง (ANC เปิด/ปิด)</div>
                  <strong style="color: #fff; font-size: 0.92rem; margin-top: 2px; display: block;">${bh.earbudsMusicANC}</strong>
                </div>
              ` : ''}
              ${bh.totalMusicWithCase ? `
                <div style="padding: 10px 12px; background: rgba(15, 23, 42, 0.85); border-radius: 8px; border-left: 3px solid #ec4899;">
                  <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">🔋 รวมตลับชาร์จสูงสุด</div>
                  <strong style="color: #fff; font-size: 0.92rem; margin-top: 2px; display: block;">${bh.totalMusicWithCase}</strong>
                </div>
              ` : ''}
            </div>

            <div style="padding: 10px 12px; background: rgba(255,255,255,0.03); border-radius: 8px; font-size: 0.78rem; line-height: 1.5; color: var(--text-secondary);">
              ${bh.chargingNote ? `<div>⚡ <strong>การชาร์จไว:</strong> ${bh.chargingNote}</div>` : ''}
              ${bh.testCondition ? `<div style="margin-top: 4px; color: var(--text-muted);">🔬 <strong>เงื่อนไขการทดสอบอ้างอิง:</strong> ${bh.testCondition}</div>` : ''}
              <div style="margin-top: 4px; color: #34d399;">✓ ข้อมูลการใช้งานอ้างอิงตามผลทดสอบทางการ ${(spec.brand && spec.brand.toUpperCase() === 'SAMSUNG') ? 'Samsung Thailand Official Lab (samsung.com/th)' : (spec.source || (spec.brand + ' Official Lab'))}</div>
            </div>
          </div>
        `;
      }

      // 6. Connectivity & Build
      if (spec.connectivityAndBuild) {
        html += renderSpecGroup("📶", "การเชื่อมต่อ & ตัวเครื่อง (Connectivity & Build)", {
          "เครือข่ายสัญญาณ": spec.connectivityAndBuild.network,
          "ช่องใส่ซิม (SIM)": spec.connectivityAndBuild.simType,
          "Wi-Fi": spec.connectivityAndBuild.wifi,
          "Bluetooth": spec.connectivityAndBuild.bluetooth,
          "มาตรฐานกันน้ำกันฝุ่น": spec.connectivityAndBuild.waterResistance,
          "รองรับปากกา S Pen": spec.connectivityAndBuild.spenSupport,
          "วัสดุตัวเครื่อง": spec.connectivityAndBuild.frameMaterial,
          "ขนาดตัวเครื่อง": spec.connectivityAndBuild.dimensions,
          "น้ำหนัก": spec.connectivityAndBuild.weight
        });
      }

      // 7. Audio (Buds)
      if (spec.audioSpecs) {
        html += renderSpecGroup("🎧", "ระบบเสียง & ไมโครโฟน (Audio & Sound)", {
          "ระบบลำโพง": spec.audioSpecs.driver,
          "ระบบตัดเสียงรบกวน (ANC)": spec.audioSpecs.anc,
          "ระบบไมโครโฟน": spec.audioSpecs.microphones,
          "คุณภาพเสียง": spec.audioSpecs.hiResAudio,
          "อายุการใช้งานแบตเตอรี่": spec.audioSpecs.batteryLife,
          "มาตรฐานกันน้ำ": spec.audioSpecs.waterResistance
        });
      }

      // 8. Sensors (Watch)
      if (spec.sensorSpecs) {
        html += renderSpecGroup("🩺", "เซนเซอร์และสุขภาพ (Health & Sensors)", {
          "เซนเซอร์สุขภาพ": spec.sensorSpecs.sensors,
          "ระบบระบุตำแหน่ง GPS": spec.sensorSpecs.gps,
          "ความทนทานทางทหาร": spec.sensorSpecs.militaryStd
        });
      }

      // 9. Chargers / Adapters (ข้อมูลหัวชาร์จ & การจ่ายไฟละเอียด)
      if (spec.powerSpecs) {
        html += `
          <div class="spec-group-box" style="border-color: rgba(245, 158, 11, 0.4); background: rgba(245, 158, 11, 0.05);">
            <div class="spec-group-title" style="color: #fbbf24;">
              <span>🔌</span>
              <span>ระบบจ่ายไฟ & กำลังวัตต์สูงสุด (Power Output Specs)</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px dashed rgba(255,255,255,0.08);">
              <div>
                <div style="font-size: 0.74rem; color: var(--text-muted); text-transform: uppercase;">กำลังไฟจ่ายสูงสุด</div>
                <strong style="font-size: 1.35rem; color: #fbbf24; font-family: var(--font-display);">${spec.powerSpecs.maxOutput || 'ตามมาตรฐาน'}</strong>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 0.74rem; color: var(--text-muted); text-transform: uppercase;">พอร์ตเชื่อมต่อ</div>
                <strong style="color: #fff; font-size: 0.95rem;">${spec.powerSpecs.ports || '1 พอร์ต USB-C'}</strong>
              </div>
            </div>

            ${spec.powerSpecs.smartDisplay ? `
              <div style="margin-bottom: 12px; padding: 10px 14px; background: rgba(0, 240, 255, 0.1); border-radius: 8px; border: 1px solid rgba(0, 240, 255, 0.3); font-size: 0.84rem; color: var(--cyan); display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.2rem;">🤖</span>
                <div><strong>หน้าจอแสดงผลอัจฉริยะ (TFT LED):</strong> ${spec.powerSpecs.smartDisplay}</div>
              </div>
            ` : ''}

            <div style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 10px; font-size: 0.82rem; line-height: 1.6; color: var(--text-secondary); display: flex; flex-direction: column; gap: 8px;">
              <div>⚡ <strong>โปรโตคอลชาร์จไว:</strong> <span style="color: #fff;">${spec.powerSpecs.protocols || '-'}</span></div>
              ${spec.powerSpecs.powerOutputMatrix ? `<div>📊 <strong>แรงดันและกระแสไฟ:</strong> <span style="color: #cbd5e1;">${spec.powerSpecs.powerOutputMatrix}</span></div>` : ''}
              ${spec.powerSpecs.multiPortDistribution ? `
                <div style="padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.08); white-space: pre-line;">
                  <strong>การจ่ายไฟหลายพอร์ต (Power Matrix):</strong>\n<span style="color: #e2e8f0;">${spec.powerSpecs.multiPortDistribution}</span>
                </div>
              ` : ''}
              <div style="padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.08); white-space: pre-line;">
                📱 <strong>อุปกรณ์ที่รองรับการชาร์จ:</strong>\n<span style="color: #38bdf8;">${spec.powerSpecs.compatibility || '-'}</span>
              </div>
              <div>🔌 <strong>มาตรฐานขาปลั๊ก:</strong> <span style="color: #fff;">${spec.powerSpecs.plugType || 'ขาปลั๊กมาตรฐานประเทศไทย มอก.'}</span></div>
              ${spec.powerSpecs.safetyFeatures ? `<div>🛡️ <strong>ระบบความปลอดภัย:</strong> <span>${spec.powerSpecs.safetyFeatures}</span></div>` : ''}
              ${spec.powerSpecs.boxContents ? `<div>📦 <strong>อุปกรณ์ในกล่อง:</strong> <span style="color: #e2e8f0;">${spec.powerSpecs.boxContents}</span></div>` : ''}
            </div>
          </div>
        `;
      }

      // 10. Cases & Keyboards (รุ่นที่รองรับ & ระบบชาร์จแบตเตอรี่)
      if (spec.caseSpecs) {
        const isNoBattery = (spec.caseSpecs.batteryStatus || "").includes("ไม่ต้องชาร์จ") || (spec.caseSpecs.batteryAndCharging || "").includes("ไม่ต้องชาร์จ") || (spec.caseSpecs.batteryStatus || "").includes("ไม่มีแบตเตอรี่");
        const batteryBadgeColor = isNoBattery ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.15)";
        const batteryBorderColor = isNoBattery ? "rgba(16, 185, 129, 0.35)" : "rgba(245, 158, 11, 0.45)";
        const batteryTextColor = isNoBattery ? "#34d399" : "#fbbf24";
        const batteryIcon = isNoBattery ? "⚡" : "🔋";

        html += `
          <div class="spec-group-box" style="border-color: rgba(56, 189, 248, 0.35); background: rgba(56, 189, 248, 0.04);">
            <div class="spec-group-title" style="color: #38bdf8;">
              <span>📱</span>
              <span>รุ่นที่รองรับ (Compatibility) & สถานะแบตเตอรี่</span>
            </div>
            
            <!-- Compatibility Callout Box -->
            <div style="margin-bottom: 12px; padding: 12px 14px; background: rgba(15, 23, 42, 0.8); border-radius: 10px; border-left: 4px solid #38bdf8;">
              <div style="font-size: 0.76rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">
                ใส่กับรุ่นไหนได้บ้าง (Compatibility):
              </div>
              <div style="font-size: 0.92rem; color: #fff; font-weight: 600; margin-top: 4px; line-height: 1.5;">
                ${spec.caseSpecs.compatibleModels || 'ตรงรุ่นสำหรับโมเดลที่ระบุ'}
              </div>
            </div>

            <!-- Battery & Charging Status Callout Box -->
            <div style="padding: 12px 14px; background: ${batteryBadgeColor}; border-radius: 10px; border: 1px solid ${batteryBorderColor};">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.3rem;">${batteryIcon}</span>
                <strong style="color: ${batteryTextColor}; font-size: 0.95rem;">
                  ${spec.caseSpecs.batteryStatus || (isNoBattery ? 'ไม่ต้องชาร์จแบตเตอรี่' : 'ต้องชาร์จแบตเตอรี่')}
                </strong>
              </div>
              <div style="font-size: 0.84rem; color: var(--text-secondary); margin-top: 6px; line-height: 1.5;">
                ${spec.caseSpecs.batteryAndCharging || 'ไม่มีแบตเตอรี่ในตัวเคส ไม่ต้องชาร์จไฟ'}
              </div>
            </div>
          </div>
        `;

        html += renderSpecGroup("📱", "รายละเอียดตัวเคส & ฟังก์ชันการใช้งาน", {
          "ลักษณะตัวเคส": spec.caseSpecs.formFactor,
          "รูปแบบการเชื่อมต่อ": spec.caseSpecs.connection,
          "ปุ่มลัด & แป้นพิมพ์": spec.caseSpecs.keyLayout,
          "การปรับระดับองศา": spec.caseSpecs.standAngles,
          "ช่องเก็บปากกา S Pen": spec.caseSpecs.spenHolder,
          "การรองรับ S Pen มือถือ": spec.caseSpecs.spenCompatibility,
          "การป้องกันตัวเครื่อง": spec.caseSpecs.protection,
          "ฟีเจอร์พิเศษ": spec.caseSpecs.specialFeatures,
          "วัสดุที่ใช้ผลิต": spec.caseSpecs.material
        });
      }

      // 11. Films & Screen Protectors
      if (spec.filmSpecs) {
        html += `
          <div class="spec-group-box" style="border-color: rgba(168, 85, 247, 0.35); background: rgba(168, 85, 247, 0.04);">
            <div class="spec-group-title" style="color: #c084fc;">
              <span>🛡️</span>
              <span>รุ่นอุปกรณ์ที่รองรับ & คุณสมบัติฟิล์ม</span>
            </div>
            <div style="margin-bottom: 12px; padding: 10px 14px; background: rgba(15, 23, 42, 0.8); border-radius: 8px; border-left: 3px solid #c084fc;">
              <div style="font-size: 0.74rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">อุปกรณ์ที่รองรับ:</div>
              <div style="font-size: 0.92rem; color: #fff; font-weight: 600; margin-top: 3px;">
                ${spec.filmSpecs.compatibleDevice || 'ตัดตรงรุ่นสำหรับอุปกรณ์ที่ระบุ'}
              </div>
            </div>
          </div>
        `;

        html += renderSpecGroup("🛡️", "สเปกฟิล์มกันรอย & การปกป้องหน้าจอ", {
          "ประเภทฟิล์ม/กระจก": spec.filmSpecs.glassType,
          "วัสดุและความแข็งแกร่ง": spec.filmSpecs.material,
          "คุณสมบัติเด่น": spec.filmSpecs.features,
          "สารเคลือบผิวหน้าจอ": spec.filmSpecs.coating,
          "การสแกนลายนิ้วมือ": spec.filmSpecs.fingerprintSupport,
          "ความคมชัดและการแสดงผล": spec.filmSpecs.clarity,
          "การตัดขอบกระจก": spec.filmSpecs.edgeDesign,
          "การรับประกันฟิล์ม": spec.filmSpecs.warranty
        });
      }

      // 12. SmartTag
      if (spec.tagSpecs) {
        html += renderSpecGroup("🏷️", "สเปกสมาร์ทแท็ก (SmartTag2 Specs)", {
          "เทคโนโลยีค้นหา": spec.tagSpecs.connectivity,
          "ระยะการค้นหา": spec.tagSpecs.findingRange,
          "ฟังก์ชัน Compass View": spec.tagSpecs.compassView,
          "อายุการใช้งานแบตเตอรี่": spec.tagSpecs.battery,
          "มาตรฐานกันน้ำกันฝุ่น": spec.tagSpecs.waterResistance,
          "ลำโพงส่งเสียง": spec.tagSpecs.speaker,
          "โหมดสูญหาย NFC": spec.tagSpecs.lostMode
        });
      }

      // 13. Bluetooth Speakers (Soundcore / Anker, etc.)
      if (spec.speakerSpecs) {
        html += `
          <div class="spec-group-box" style="border-color: rgba(56, 189, 248, 0.4); background: rgba(56, 189, 248, 0.05);">
            <div class="spec-group-title" style="color: #38bdf8;">
              <span>🔊</span>
              <span>คุณสมบัติลำโพง & พลังเสียง (Portable Speaker Specs)</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 12px;">
              ${spec.speakerSpecs.outputPower ? `
                <div style="padding: 10px 12px; background: rgba(15, 23, 42, 0.85); border-radius: 8px; border-left: 3px solid #38bdf8;">
                  <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">⚡ กำลังขับเสียง (Output)</div>
                  <strong style="color: #fff; font-size: 0.95rem; margin-top: 2px; display: block;">${spec.speakerSpecs.outputPower}</strong>
                </div>
              ` : ''}
              ${spec.speakerSpecs.waterproofRating ? `
                <div style="padding: 10px 12px; background: rgba(15, 23, 42, 0.85); border-radius: 8px; border-left: 3px solid #06b6d4;">
                  <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">🌊 มาตรฐานการกันน้ำ</div>
                  <strong style="color: #fff; font-size: 0.95rem; margin-top: 2px; display: block;">${spec.speakerSpecs.waterproofRating}</strong>
                </div>
              ` : ''}
              ${spec.speakerSpecs.batteryPlaytime ? `
                <div style="padding: 10px 12px; background: rgba(15, 23, 42, 0.85); border-radius: 8px; border-left: 3px solid #34d399;">
                  <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">🔋 เล่นเพลงต่อเนื่อง</div>
                  <strong style="color: #fff; font-size: 0.95rem; margin-top: 2px; display: block;">${spec.speakerSpecs.batteryPlaytime}</strong>
                </div>
              ` : ''}
              ${spec.speakerSpecs.bluetoothVersion ? `
                <div style="padding: 10px 12px; background: rgba(15, 23, 42, 0.85); border-radius: 8px; border-left: 3px solid ${spec.speakerSpecs.bluetoothVersion.includes('ยังไม่ได้ยืนยัน') ? '#fbbf24' : '#818cf8'};">
                  <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">📶 การเชื่อมต่อ Bluetooth</div>
                  <strong style="color: ${spec.speakerSpecs.bluetoothVersion.includes('ยังไม่ได้ยืนยัน') ? '#38bdf8' : '#fff'}; font-size: 0.88rem; margin-top: 2px; display: block;">
                    ${spec.speakerSpecs.bluetoothVersion.includes('ยังไม่ได้ยืนยัน') ? 'Bluetooth: รองรับ' : spec.speakerSpecs.bluetoothVersion}
                  </strong>
                  ${spec.speakerSpecs.bluetoothVersion.includes('ยังไม่ได้ยืนยัน') ? `
                    <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 2px;">เวอร์ชัน Bluetooth: <span style="color: #fbbf24; font-weight: 600;">ยังไม่ได้ยืนยัน</span></div>
                  ` : ''}
                </div>
              ` : ''}
            </div>
            
            <div style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 10px; font-size: 0.82rem; line-height: 1.6; color: var(--text-secondary); display: flex; flex-direction: column; gap: 8px;">
              ${spec.speakerSpecs.wirelessStereo ? `<div>📻 <strong>ระบบเสียงสเตอริโอ (TWS):</strong> <span style="color: #38bdf8;">${spec.speakerSpecs.wirelessStereo}</span></div>` : ''}
              ${spec.speakerSpecs.portability ? `<div>🎒 <strong>การพกพา:</strong> <span style="color: #fff;">${spec.speakerSpecs.portability}</span></div>` : ''}
              ${spec.speakerSpecs.chargingPort ? `<div>🔌 <strong>พอร์ตชาร์จ:</strong> <span style="color: #cbd5e1;">${spec.speakerSpecs.chargingPort}</span></div>` : ''}
            </div>
          </div>
        `;
      }

      // Thai Warranty & Service Centers (Brand-Aware & Evidence-Dependent)
      const isSoundcore = (spec.brand && spec.brand.toUpperCase().includes("SOUNDCORE")) || (item.brand && item.brand.toUpperCase().includes("SOUNDCORE"));
      const isWarrantyPending = isSoundcore || (spec.fieldVerification && spec.fieldVerification.thailandWarrantyPeriod && spec.fieldVerification.thailandWarrantyPeriod.status === "NOT_VERIFIED");
      const warrantyText = isWarrantyPending
        ? 'ตรวจสอบตามใบรับประกันหรือผู้จัดจำหน่ายของสินค้ารายการนี้'
        : (spec.category === 'Accessory' ? (spec.powerSpecs && spec.powerSpecs.warranty ? spec.powerSpecs.warranty : 'รับประกันศูนย์ไทย 6 เดือน - 1 ปี') : 'รับประกันศูนย์ไทย 1 ปีเต็ม จากศูนย์บริการทางการ');
      const serviceCenterText = isWarrantyPending
        ? 'ตรวจสอบเงื่อนไขการรับประกันและศูนย์บริการจากใบรับประกันในกล่องหรือเอกสารจัดซื้อ'
        : (isSoundcore
          ? 'รองรับบริการเคลมและเปลี่ยนสินค้าตามเงื่อนไขศูนย์บริการ Soundcore / Anker Thailand ทั่วประเทศ'
          : 'รองรับบริการที่ศูนย์บริการซัมซุง (Samsung Service Center) ทั่วประเทศไทย หรือศูนย์บริการตัวแทนจำหน่ายทางการ');

      html += `
        <div class="spec-group-box" style="border-color: rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.05);">
          <div class="spec-group-title" style="color: var(--emerald);">
            <span>🇹🇭</span>
            <span>การรับประกันและมาตรฐานศูนย์ไทย</span>
          </div>
          <div style="font-size: 0.84rem; color: var(--text-secondary); line-height: 1.6;">
            <div>✓ <strong>การรับประกัน:</strong> ${warrantyText}</div>
            <div>✓ <strong>บริการหลังการขาย:</strong> ${serviceCenterText}</div>
            <div>✓ <strong>เครื่องแท้ 100%:</strong> สินค้าที่จัดจำหน่ายในสาขาเป็นโมเดลจำหน่ายในประเทศไทย ผ่านการรับรอง กสทช. ถูกต้องตามกฎหมาย</div>
          </div>
        </div>
      </div>
      `;

      return html;
    }

    function renderDrawerModeDetails(variants, selectedMode, srp) {
      const match = variants.find(v => v.saleMode === selectedMode);
      
      if (!match && selectedMode === "NORMAL") {
        return `
          <div class="promo-price-card">
            <div class="price-row-item">
              <span style="color: var(--text-muted);">ราคาปกติ (RRP)</span>
              <strong>฿${srp.toLocaleString('th-TH')}</strong>
            </div>
            <div class="price-row-item">
              <span style="color: var(--text-muted);">ส่วนลดแคมเปญ</span>
              <span style="color: var(--text-muted);">-฿0</span>
            </div>
            <div class="price-row-item net">
              <span>ราคาชำระสุทธิ</span>
              <span class="net-price-display">฿${srp.toLocaleString('th-TH')}</span>
            </div>
          </div>
          <div style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">
            <div>💳 <strong>เงื่อนไขการชำระ:</strong> เงินสด, โอนเงิน, หรือรูดบัตรเครดิตเต็มจำนวน</div>
            <div style="margin-top: 6px;">🛡️ รับประกันศูนย์ไทย Samsung Thailand 1 ปีเต็ม</div>
          </div>
        `;
      }

      if (!match) {
        return `
          <div style="text-align: center; padding: 30px; background: rgba(255,255,255,0.02); border-radius: 10px; color: var(--text-muted); font-size: 0.85rem;">
            ไม่พบโปรโมชั่นในหมวดนี้สำหรับสินค้านี้
          </div>
        `;
      }

      const disc = Number(match.discountValue || match.discount || 0);
      const net = Number(match.netPrice || (srp - disc));

      return `
        <div class="promo-price-card">
          <div class="price-row-item">
            <span style="color: var(--text-muted);">ราคาปกติ (RRP)</span>
            <span style="text-decoration: line-through; color: var(--text-muted);">฿${srp.toLocaleString('th-TH')}</span>
          </div>
          <div class="price-row-item">
            <span style="color: var(--emerald);">ส่วนลดโปรโมชั่น</span>
            <strong style="color: var(--emerald); font-size: 1.05rem;">-฿${disc.toLocaleString('th-TH')}</strong>
          </div>
          ${match.couponCode ? `
            <div class="price-row-item">
              <span style="color: var(--cyan);">คูปองโค้ด</span>
              <span class="badge-pn-pill" style="font-size: 0.85rem;">${match.couponCode}</span>
            </div>
          ` : ''}
          <div class="price-row-item net">
            <span>ราคาสุทธิ (Net Price)</span>
            <span class="net-price-display">฿${net.toLocaleString('th-TH')}</span>
          </div>
        </div>

        <div style="font-size: 0.84rem; color: var(--text-secondary); line-height: 1.6;">
          <div style="margin-bottom: 8px;">
            📅 <strong>ระยะเวลาแคมเปญ:</strong> ${match.startDate || '28 ส.ค.'} - ${match.endDate || '6 ก.ย. 2026'}
          </div>
          <div style="margin-bottom: 8px;">
            📝 <strong>เงื่อนไข:</strong> ${(match.conditions && match.conditions.length) ? match.conditions.join(', ') : 'ตามเงื่อนไขแคมเปญหน้าร้าน'}
          </div>
          ${match.gift ? `
            <div style="color: var(--coral);">
              🎁 <strong>ของแถม Premium:</strong> ${match.gift}
            </div>
          ` : ''}
        </div>
      `;
    }

    function switchDrawerMode(mode, btnElement) {
      document.querySelectorAll(".sale-mode-tab").forEach(tab => tab.classList.remove("active"));
      btnElement.classList.add("active");
      
      const pnTag = document.getElementById("drawerProductPn").textContent.replace("Exact P/N: ", "").trim();
      const modelTitle = document.getElementById("drawerProductTitle").textContent;
      const item = rawItems.find(x => (x.pn && x.pn === pnTag) || (x.model === modelTitle));
      const promo = resolvePromotion(item || { pn: pnTag, model: modelTitle });

      document.getElementById("drawerModeContent").innerHTML = renderDrawerModeDetails(promo.variants, mode, item ? item.srp : 0);
    }

    // Drawer Close listeners are registered in setupPrototypeStockControls()


    // ==========================================================================
    // EVENT LISTENERS & INITIALIZATION
    // ==========================================================================

    // ==========================================================================
    // DYNAMIC CONTEXT-AWARE FILTER CHIPS PER CATEGORY
    // ==========================================================================
    const CATEGORY_FILTER_CONFIG = {
      ALL: [
        { key: "all", label: "ทั้งหมด" },
        { key: "tag-5g", label: "📶 5G" },
        { key: "tag-4g", label: "📶 4G" },
        { key: "tag-lte", label: "⌚ LTE" },
        { key: "tag-wifi", label: "🌐 Wi-Fi" },
        { key: "sub-film", label: "🛡️ ฟิล์ม" },
        { key: "sub-charger", label: "🔌 หัวชาร์จ" },
        { key: "sub-case", label: "📱 เคส/คีย์บอร์ด" },
        { key: "instock", label: "📦 มีของพร้อมขาย (Stock > 0)" },
        { key: "haspromo", label: "✨ มีโปรโมชั่น" },
        { key: "f1", label: "ช1 ร้านเรา" },
        { key: "f2", label: "ช2 สาขา" },
        { key: "passf", label: "🏷️ พาส F" }
      ],
      SmartPhone: [
        { key: "all", label: "ทั้งหมด (มือถือ)" },
        { key: "tag-5g", label: "📶 5G" },
        { key: "tag-4g", label: "📶 4G" },
        { key: "instock", label: "📦 มีของพร้อมขาย" },
        { key: "haspromo", label: "✨ มีโปรโมชั่น" },
        { key: "f1", label: "ช1 ร้านเรา" },
        { key: "f2", label: "ช2 สาขา" },
        { key: "passf", label: "🏷️ พาส F" }
      ],
      Tablet: [
        { key: "all", label: "ทั้งหมด (แท็บเล็ต)" },
        { key: "tag-wifi", label: "🌐 Wi-Fi" },
        { key: "tag-5g", label: "📶 5G" },
        { key: "tag-4g", label: "📶 4G (LTE)" },
        { key: "instock", label: "📦 มีของพร้อมขาย" },
        { key: "haspromo", label: "✨ มีโปรโมชั่น" },
        { key: "f1", label: "ช1 ร้านเรา" },
        { key: "f2", label: "ช2 สาขา" },
        { key: "passf", label: "🏷️ พาส F" }
      ],
      Watch: [
        { key: "all", label: "ทั้งหมด (นาฬิกา)" },
        { key: "tag-lte", label: "⌚ LTE (ใส่ซิม/eSIM)" },
        { key: "tag-bt", label: "📶 Bluetooth" },
        { key: "instock", label: "📦 มีของพร้อมขาย" },
        { key: "haspromo", label: "✨ มีโปรโมชั่น" },
        { key: "f1", label: "ช1 ร้านเรา" },
        { key: "f2", label: "ช2 สาขา" }
      ],
      Buds: [
        { key: "all", label: "ทั้งหมด (หูฟัง)" },
        { key: "instock", label: "📦 มีของพร้อมขาย" },
        { key: "haspromo", label: "✨ มีโปรโมชั่น" },
        { key: "f1", label: "ช1 ร้านเรา" },
        { key: "f2", label: "ช2 สาขา" }
      ],
      Accessory: [
        { key: "all", label: "ทั้งหมด (อุปกรณ์เสริม)" },
        { key: "sub-film", label: "🛡️ ฟิล์มกันรอย" },
        { key: "sub-charger", label: "🔌 หัวชาร์จ & สาย" },
        { key: "sub-case", label: "📱 เคส & คีย์บอร์ด" },
        { key: "sub-tag", label: "🏷️ SmartTag" },
        { key: "instock", label: "📦 มีของพร้อมขาย" },
        { key: "f1", label: "ช1 ร้านเรา" },
        { key: "f2", label: "ช2 สาขา" }
      ],
      SIM: [
        { key: "all", label: "ทั้งหมด (ซิมการ์ด)" },
        { key: "instock", label: "📦 มีของพร้อมขาย" },
        { key: "f1", label: "ช1 ร้านเรา" },
        { key: "f2", label: "ช2 สาขา" }
      ],
      Premium: [
        { key: "all", label: "ทั้งหมด (ของแถม/พรีเมียม)" },
        { key: "instock", label: "📦 มีของพร้อมขาย" },
        { key: "f1", label: "ช1 ร้านเรา" },
        { key: "f2", label: "ช2 สาขา" }
      ],
      Other: [
        { key: "all", label: "ทั้งหมด (สินค้าอื่นๆ)" },
        { key: "instock", label: "📦 มีของพร้อมขาย" },
        { key: "f1", label: "ช1 ร้านเรา" },
        { key: "f2", label: "ช2 สาขา" }
      ]
    };

    function renderFilterChips() {
      const container = document.getElementById("filterChipsContainer");
      if (!container) return;
      const chips = CATEGORY_FILTER_CONFIG[currentCategory] || CATEGORY_FILTER_CONFIG.ALL;

      const hasFilter = chips.some(c => c.key === currentFilter);
      if (!hasFilter) currentFilter = "all";

      container.innerHTML = chips.map(c => `
        <button class="filter-chip ${c.key === currentFilter ? 'active' : ''}" data-filter="${c.key}">
          ${c.label}
        </button>
      `).join("");

      container.querySelectorAll(".filter-chip").forEach(btn => {
        btn.addEventListener("click", () => {
          container.querySelectorAll(".filter-chip").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          currentFilter = btn.getAttribute("data-filter");
          renderStockList();
        });
      });
    }

    function closeDrawer() {
      const promoDrawerBackdrop = document.getElementById("promoDrawerBackdrop");
      if (promoDrawerBackdrop) {
        promoDrawerBackdrop.classList.remove("open");
      }
      document.body.style.overflow = "";
    }
    window.closeDrawer = closeDrawer;

    function setupPrototypeStockControls() {
      // Close Drawer
      const btnCloseDrawer = document.getElementById("btnCloseDrawer");
      const promoDrawerBackdrop = document.getElementById("promoDrawerBackdrop");
      if (btnCloseDrawer && promoDrawerBackdrop) {
        btnCloseDrawer.onclick = () => closeDrawer();
        promoDrawerBackdrop.onclick = (e) => {
          if (e.target === promoDrawerBackdrop) closeDrawer();
        };
      }

      window.onkeydown = (e) => {
        if (e.key === "Escape") closeDrawer();
      };

      // Category Card Click
      document.querySelectorAll(".category-card").forEach(card => {
        card.onclick = () => {
          document.querySelectorAll(".category-card").forEach(c => c.classList.remove("active"));
          card.classList.add("active");
          currentCategory = card.getAttribute("data-cat");
          currentFilter = "all";
          renderFilterChips();
          renderStockList();
        };
      });

      // Search Input
      const searchInput = document.getElementById("searchInput");
      const btnClearSearch = document.getElementById("btnClearSearch");
      if (searchInput && btnClearSearch) {
        searchInput.oninput = (e) => {
          searchQuery = e.target.value.trim();
          btnClearSearch.style.display = searchQuery ? "block" : "none";
          renderStockList();
        };

        btnClearSearch.onclick = () => {
          searchInput.value = "";
          searchQuery = "";
          btnClearSearch.style.display = "none";
          renderStockList();
        };
      }

      // View Switcher
      const btnViewTable = document.getElementById("btnViewTable");
      const btnViewCards = document.getElementById("btnViewCards");
      const tableContainer = document.getElementById("tableViewContainer");
      const cardContainer = document.getElementById("cardViewContainer");

      if (btnViewTable && btnViewCards && tableContainer && cardContainer) {
        btnViewTable.onclick = () => {
          btnViewTable.classList.add("active");
          btnViewCards.classList.remove("active");
          tableContainer.style.display = "block";
          cardContainer.style.display = "none";
        };

        btnViewCards.onclick = () => {
          btnViewCards.classList.add("active");
          btnViewTable.classList.remove("active");
          tableContainer.style.display = "none";
          cardContainer.style.display = "grid";
        };
      }
    }

    // Dynamic Initialization & Route Lifecycle
    function initPrototypeStock() {
      console.info("[Stock Prototype] initialization started");
      console.info("[Stock Prototype] data sources", {
        stock: (typeof window !== "undefined" && Array.isArray(window.STOCK_DATABASE)) ? window.STOCK_DATABASE.length : "FALLBACK",
        specs: (typeof window !== "undefined" && (window.PRODUCT_SPECS_DATABASE || window.PRODUCT_SPECS_PROFILES)) ? Object.keys(window.PRODUCT_SPECS_DATABASE || window.PRODUCT_SPECS_PROFILES).length : "INVALID",
        promotions: (typeof window !== "undefined" && Array.isArray(window.PROMOTION_VARIANTS)) ? window.PROMOTION_VARIANTS.length : "INVALID"
      });

      setupPrototypeStockControls();
      refreshPrototypeData();
      updateCategoryCardCounts();
      renderFilterChips();
      renderStockList();
    }

    // Global exports for SPA router & inline onclick triggers
    window.initPrototypeStock = initPrototypeStock;
    window.renderData = initPrototypeStock;
    window.renderStockList = renderStockList;
    window.renderFilterChips = renderFilterChips;
    window.refreshPrototypeData = refreshPrototypeData;
    window.openPromoDrawer = openPromoDrawer;
    window.openProductSpecsDrawer = openProductSpecsDrawer;
    window.switchDrawerMainTab = switchDrawerMainTab;
    window.switchDrawerMode = switchDrawerMode;
    window.syncMasterStockData = function() {
      initPrototypeStock();
    };
    window.PrototypeStock = {
      refresh() {
        initPrototypeStock();
      }
    };
    window.renderMetrics = window.renderMetrics || function() {};
    window.renderPromoCampaignModal = window.renderPromoCampaignModal || function() {};
    window.normalizeColorName = normalizeColorName;
    window.resolveProductColor = resolveProductColor;

    // Hash navigation listener
    window.addEventListener("hashchange", () => {
      if (window.location.hash.includes("/stock") && !window.location.hash.includes("/stock-import")) {
        setTimeout(initPrototypeStock, 50);
      }
    });

    // Observer for view-stock visibility in Single Page App
    function setupViewObserver() {
      const stockViewEl = document.getElementById("view-stock");
      if (stockViewEl && typeof MutationObserver !== "undefined") {
        const observer = new MutationObserver(() => {
          if (stockViewEl.classList.contains("active-view") || (stockViewEl.style.display && stockViewEl.style.display !== "none")) {
            initPrototypeStock();
          }
        });
        observer.observe(stockViewEl, { attributes: true, attributeFilter: ["class", "style"] });
      }
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        setupViewObserver();
        initPrototypeStock();
      });
    } else {
      setupViewObserver();
      initPrototypeStock();
    }

  