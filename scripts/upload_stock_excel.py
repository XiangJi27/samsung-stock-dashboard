from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from scripts.read_nimbus_stock_excel import parse_nimbus_excel

# Ensure UTF-8 output
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def upload_stock_file(
    *,
    file_path: Path,
    api_base_url: str,
    access_token: str,
    branch_code: str = "AYUTTHAYA_CITY_PARK",
    auto_activate: bool = False,
) -> dict:
    import urllib.request
    import urllib.error

    parsed = parse_nimbus_excel(file_path)
    payload = {
        "branchCode": branch_code,
        "sourceFileName": parsed["sourceFileName"],
        "sourceFileSha256": parsed["sourceFileSha256"],
        "expectedPreviousBatchId": None,
        "summary": parsed["summary"],
        "items": parsed["items"],
    }

    url = f"{api_base_url.rstrip('/')}/api/stock-imports"
    req_data = json.dumps(payload).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json; charset=utf-8",
    }

    req = urllib.request.Request(url, data=req_data, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            resp_body = resp.read().decode("utf-8")
            draft_result = json.loads(resp_body)
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8")
        raise RuntimeError(f"HTTP {exc.code}: {err_body}") from exc

    if auto_activate and draft_result.get("batchId"):
        batch_id = draft_result["batchId"]
        act_url = f"{api_base_url.rstrip('/')}/api/stock-imports/{batch_id}/activate"
        act_data = json.dumps({
            "expectedPreviousBatchId": None,
            "branchCode": branch_code
        }).encode("utf-8")
        act_req = urllib.request.Request(act_url, data=act_data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(act_req, timeout=30) as act_resp:
                act_body = act_resp.read().decode("utf-8")
                return {
                    "draft": draft_result,
                    "activation": json.loads(act_body)
                }
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8")
            raise RuntimeError(f"Activation failed HTTP {exc.code}: {err_body}") from exc

    return draft_result


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload Nimbus Stock Excel to Central API")
    parser.add_argument("file", type=Path, help="Path to Stock.xlsx")
    parser.add_argument("--api-url", default="https://samsung-stock-pilot.vercel.app", help="Base URL of Server API")
    parser.add_argument("--token", help="Bearer JWT Access Token (or reads TEST_ADMIN_PASSWORD / env)")
    parser.add_argument("--branch-code", default="AYUTTHAYA_CITY_PARK", help="Branch code")
    parser.add_argument("--activate", action="store_true", help="Auto-activate batch after draft creation")

    args = parser.parse_args()

    token = args.token or os.environ.get("SUPABASE_ACCESS_TOKEN") or os.environ.get("PILOT_ACCESS_TOKEN")
    if not token:
        print("Error: --token or SUPABASE_ACCESS_TOKEN env required", file=sys.stderr)
        return 1

    file_path = args.file.resolve()
    if not file_path.exists():
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        return 1

    try:
        result = upload_stock_file(
            file_path=file_path,
            api_base_url=args.api_url,
            access_token=token,
            branch_code=args.branch_code,
            auto_activate=args.activate,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except Exception as exc:
        print(f"Upload error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
