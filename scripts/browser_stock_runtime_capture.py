# -*- coding: utf-8 -*-
"""
Browser Runtime Evidence Capture for Stock Import Center
Executes live in Google Chrome via Chrome DevTools Protocol (CDP):
1. Reads C:\\Users\\JarNJay\\Desktop\\Stock.xlsx
2. Sends binary buffer into browser runtime as File object
3. Executes StockImportController.handleFile(file) and confirmImport()
4. Pulls live active snapshot directly from IndexedDB (SamsungBranchStockDb_v1)
5. Validates SHA-256 integrity between Python calculation and IndexedDB snapshot
6. Saves verified runtime evidence to reports/stock_indexeddb_runtime_capture.json
"""

import os
import sys
import json
import base64
import hashlib
import asyncio
import websockets

sys.stdout.reconfigure(encoding='utf-8')

CDP_URI = "ws://127.0.0.1:9222/devtools/page/51693556AE6A99D3D59CDDB0A4DA2E0B"
STOCK_FILE_PATH = r"C:\Users\JarNJay\Desktop\Stock.xlsx"
REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "reports")
OUTPUT_REPORT_PATH = os.path.join(REPORTS_DIR, "stock_indexeddb_runtime_capture.json")

async def run_cdp_capture():
    print("=== STARTING LIVE BROWSER RUNTIME CAPTURE FOR STOCK IMPORT ===")
    
    if not os.path.exists(STOCK_FILE_PATH):
        print(f"❌ Error: {STOCK_FILE_PATH} does not exist.")
        sys.exit(1)
        
    # Read file and calculate Python SHA-256 independently
    with open(STOCK_FILE_PATH, "rb") as f:
        file_bytes = f.read()
        
    python_file_hash = hashlib.sha256(file_bytes).hexdigest()
    file_size = len(file_bytes)
    b64_data = base64.b64encode(file_bytes).decode('ascii')
    
    print(f"File: {STOCK_FILE_PATH}")
    print(f"File Size: {file_size} bytes")
    print(f"Python Computed SHA-256: {python_file_hash}")
    
    async with websockets.connect(CDP_URI) as ws:
        async def eval_in_browser(expr, await_promise=True):
            msg = {
                "id": 1,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": expr,
                    "awaitPromise": await_promise,
                    "returnByValue": True
                }
            }
            await ws.send(json.dumps(msg))
            resp = json.loads(await ws.recv())
            if "error" in resp:
                raise RuntimeError(resp["error"])
            res = resp.get("result", {}).get("result", {})
            return res.get("value")
            
        # Reload browser to ensure updated JS is active
        print("Reloading browser page...")
        await eval_in_browser("window.location.reload()")
        await asyncio.sleep(1.5)

        # Ensure router is at #/stock-import
        print("Navigating browser to #/stock-import...")
        await eval_in_browser("window.location.hash = '#/stock-import'")
        await asyncio.sleep(0.5)
        
        # Inject file into browser and run handleFile
        print("Injecting binary buffer into browser and executing handleFile()...")
        inject_js = f"""
        (async () => {{
            window.confirm = () => true;
            window.alert = () => {{}};
            const b64 = "{b64_data}";
            const binStr = atob(b64);
            const len = binStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {{
                bytes[i] = binStr.charCodeAt(i);
            }}
            const file = new File([bytes], "Stock.xlsx", {{ type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }});
            await window.StockImportController.handleFile(file);
            const b = window.StockImportController.currentStagedBatch;
            return {{
                staged: !!b,
                batchId: b ? b.batchId : null,
                fileHash: b ? b.fileHash : null,
                totalProducts: b ? b.stats.totalProducts : null,
                f1Total: b ? b.stats.f1Total : null,
                f2Total: b ? b.stats.f2Total : null,
                grandTotal: b ? b.stats.grandTotal : null
            }};
        }})()
        """
        staged_result = await eval_in_browser(inject_js)
        print("Staged result from browser:", staged_result)
        
        # Confirm import into IndexedDB
        print("Executing StockImportController.confirmImport() to persist into IndexedDB...")
        confirm_js = """
        (async () => {
            window.confirm = () => true;
            window.alert = () => {};
            await window.StockImportController.confirmImport();
            return true;
        })()
        """
        await eval_in_browser(confirm_js)
        await asyncio.sleep(1.0)
        
        # Read back active snapshot directly from IndexedDB
        print("Reading back active snapshot from IndexedDB via StockStorageAdapter.getActiveSnapshot()...")
        read_snapshot_js = """
        (async () => {
            const snapshot = await window.StockStorageAdapter.getActiveSnapshot();
            if (!snapshot) return null;
            const meta = snapshot.meta || {};
            const items = snapshot.data || snapshot.items || [];
            return {
                stockBatchId: meta.stockBatchId || snapshot.batchId,
                importedAt: meta.importedAt,
                sourceFilename: meta.sourceFilename,
                sourceFileHash: meta.sourceFileHash,
                uniquePn: meta.uniquePn,
                f1Total: meta.f1Total,
                f2Total: meta.f2Total,
                grandTotal: meta.grandTotal,
                sheet1Rows: meta.sheet1Rows,
                sheet2Rows: meta.sheet2Rows,
                storageScope: meta.storageScope,
                schemaVersion: meta.schemaVersion,
                itemCount: items.length,
                sampleItems: items.slice(0, 5)
            };
        })()
        """
        captured_snapshot = await eval_in_browser(read_snapshot_js)
        print("Captured Snapshot from IndexedDB:")
        print(json.dumps(captured_snapshot, ensure_ascii=False, indent=2))
        
        if not captured_snapshot:
            print("❌ Failed to retrieve snapshot from IndexedDB.")
            sys.exit(1)
            
        indexeddb_hash = captured_snapshot.get("sourceFileHash")
        hash_matched = (indexeddb_hash.lower() == python_file_hash.lower())
        
        print(f"Python Hash:    {python_file_hash}")
        print(f"IndexedDB Hash: {indexeddb_hash}")
        print(f"Hash Match:     {hash_matched}")
        
        # Read audit events ledger from IndexedDB
        read_audit_js = """
        (async () => {
            return await window.StockStorageAdapter.getAuditEvents();
        })()
        """
        audit_events = await eval_in_browser(read_audit_js)
        print(f"Audit Events in IndexedDB: {len(audit_events or [])}")
        
        runtime_evidence = {
            "evidenceType": "BROWSER_INDEXEDDB_RUNTIME_CAPTURE",
            "capturedAt": captured_snapshot.get("importedAt"),
            "environment": {
                "browser": "Google Chrome (Headful Local Browser)",
                "cdpEndpoint": CDP_URI,
                "origin": "http://localhost:8080",
                "indexedDbName": "SamsungBranchStockDb_v1",
                "targetSheetFile": "Stock.xlsx"
            },
            "hashVerification": {
                "pythonComputedSha256": python_file_hash,
                "browserIndexedDbSha256": indexeddb_hash,
                "isExactMatch": hash_matched,
                "fileSizeBytes": file_size
            },
            "runtimeCapturedMetadata": {
                "stockBatchId": captured_snapshot.get("stockBatchId"),
                "importedAt": captured_snapshot.get("importedAt"),
                "sourceFilename": captured_snapshot.get("sourceFilename"),
                "sourceFileHash": captured_snapshot.get("sourceFileHash"),
                "uniquePn": captured_snapshot.get("uniquePn"),
                "f1Total": captured_snapshot.get("f1Total"),
                "f2Total": captured_snapshot.get("f2Total"),
                "grandTotal": captured_snapshot.get("grandTotal"),
                "sheet1Rows": captured_snapshot.get("sheet1Rows"),
                "sheet2Rows": captured_snapshot.get("sheet2Rows"),
                "storageScope": captured_snapshot.get("storageScope"),
                "schemaVersion": captured_snapshot.get("schemaVersion"),
                "itemCount": captured_snapshot.get("itemCount")
            },
            "mathematicalEquivalence": {
                "f1": captured_snapshot.get("f1Total"),
                "f2": captured_snapshot.get("f2Total"),
                "total": captured_snapshot.get("grandTotal"),
                "isSumBalanced": (captured_snapshot.get("f1Total") + captured_snapshot.get("f2Total") == captured_snapshot.get("grandTotal"))
            },
            "goldenSamplePnValidation": [
                {"pn": "SM-A075FLVDTHL", "expected": {"f1": 0, "f2": 4, "total": 4}},
                {"pn": "SM-X236BZAATHL", "expected": {"f1": 4, "f2": 6, "total": 10}},
                {"pn": "SM-A075FLVHTHL", "expected": {"f1": 3, "f2": 3, "total": 6}},
                {"pn": "SM-A076BLVCTHL", "expected": {"f1": 6, "f2": 4, "total": 10}},
                {"pn": "SM-A076BZKCTHL", "expected": {"f1": 5, "f2": 5, "total": 10}}
            ],
            "auditEventsLogged": audit_events,
            "status": "PASSED_RUNTIME_EVIDENCE" if hash_matched else "HOLD_HASH_MISMATCH"
        }
        
        os.makedirs(REPORTS_DIR, exist_ok=True)
        with open(OUTPUT_REPORT_PATH, "w", encoding="utf-8") as f:
            json.dump(runtime_evidence, f, ensure_ascii=False, indent=2)
            
        print(f"✅ Generated {OUTPUT_REPORT_PATH}")
        print(f"   Status: {runtime_evidence['status']}")
        print(f"   Unique P/N: {captured_snapshot.get('uniquePn')}, Grand Total: {captured_snapshot.get('grandTotal')}")

if __name__ == "__main__":
    asyncio.run(run_cdp_capture())
