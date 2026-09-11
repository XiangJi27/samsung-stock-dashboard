# -*- coding: utf-8 -*-
"""
Helper to execute JavaScript in the active Chrome page via CDP.
"""

import sys
import json
import asyncio
import websockets

sys.stdout.reconfigure(encoding='utf-8')

CDP_URI = "ws://127.0.0.1:9222/devtools/page/51693556AE6A99D3D59CDDB0A4DA2E0B"

async def eval_js(expr, await_promise=True):
    async with websockets.connect(CDP_URI) as ws:
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
        raw = await ws.recv()
        resp = json.loads(raw)
        if "error" in resp:
            raise RuntimeError(resp["error"])
        result = resp.get("result", {}).get("result", {})
        return result.get("value")

if __name__ == "__main__":
    expr = sys.argv[1] if len(sys.argv) > 1 else "window.location.href"
    res = asyncio.run(eval_js(expr))
    print("Result:", res)
