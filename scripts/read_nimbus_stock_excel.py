from __future__ import annotations

import hashlib
import json
import math
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

# Ensure UTF-8 output on Windows terminal
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


HEADER_ALIASES = {
    "pn": {
        "P/N",
        "PN",
        "PART NUMBER",
        "PRODUCT NUMBER",
        "PRODUCT CODE",
        "รหัสสินค้า",
    },
    "description": {
        "DESCRIPTION",
        "PRODUCT DESCRIPTION",
        "PRODUCT NAME",
        "ชื่อสินค้า",
        "รายละเอียดสินค้า",
    },
    "brand": {
        "BRAND",
        "ยี่ห้อ",
        "แบรนด์",
    },
    "cat1": {
        "CAT1",
        "CATEGORY 1",
        "CATEGORY1",
    },
    "cat2": {
        "CAT2",
        "CATEGORY 2",
        "CATEGORY2",
    },
    "cat3": {
        "CAT3",
        "CATEGORY 3",
        "CATEGORY3",
    },
    "on_hand": {
        "ON HAND",
        "ONHAND",
        "QTY",
        "QUANTITY",
        "STOCK",
        "ยอดคงเหลือ",
    },
    "rrp": {
        "RRP",
        "PRICE",
        "PRICE 99",
        "PRICE99",
        "SRP",
        "ราคาขาย",
    },
    "barcode": {
        "BARCODE",
        "GTIN",
        "EAN",
        "UPC",
        "บาร์โค้ด",
    },
}


@dataclass
class SheetItem:
    pn: str
    description: str
    brand: str | None
    cat1: str | None
    cat2: str | None
    cat3: str | None
    barcode: str | None
    rrp: float | None
    on_hand: int
    source_sheet: str
    source_row: int


def normalize_header(value: Any) -> str:
    return " ".join(
        str(value or "")
        .strip()
        .upper()
        .replace("_", " ")
        .split()
    )


def normalize_pn(value: Any) -> str:
    return "".join(
        str(value or "")
        .strip()
        .upper()
        .split()
    )


def clean_text(value: Any) -> str | None:
    text = str(value or "").strip()
    return text or None


def parse_non_negative_integer(
    value: Any,
    *,
    field_name: str,
    sheet_name: str,
    row_number: int,
) -> int:
    if value is None or value == "":
        return 0

    if isinstance(value, str):
        value = value.strip().replace(",", "")

        if value.startswith("#"):
            raise ValueError(
                f"{sheet_name} row {row_number}: "
                f"{field_name} contains formula error {value}"
            )

    try:
        numeric = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(
            f"{sheet_name} row {row_number}: "
            f"{field_name} is not numeric: {value!r}"
        ) from exc

    if not math.isfinite(numeric):
        raise ValueError(
            f"{sheet_name} row {row_number}: "
            f"{field_name} is not finite"
        )

    if numeric < 0:
        raise ValueError(
            f"{sheet_name} row {row_number}: "
            f"{field_name} must not be negative"
        )

    if not numeric.is_integer():
        raise ValueError(
            f"{sheet_name} row {row_number}: "
            f"{field_name} must be an integer"
        )

    return int(numeric)


def parse_money(value: Any) -> float | None:
    if value is None or value == "":
        return None

    if isinstance(value, str):
        value = (
            value.strip()
            .replace(",", "")
            .replace("฿", "")
        )

        if value.startswith("#"):
            raise ValueError(
                f"RRP contains formula error: {value}"
            )

    try:
        numeric = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid RRP: {value!r}") from exc

    if not math.isfinite(numeric) or numeric < 0:
        raise ValueError(f"Invalid RRP: {value!r}")

    return round(numeric, 2)


def resolve_headers(header_row: tuple[Any, ...]) -> dict[str, int]:
    normalized_headers = {
        index: normalize_header(value)
        for index, value in enumerate(header_row)
    }

    resolved: dict[str, int] = {}

    for canonical_name, aliases in HEADER_ALIASES.items():
        normalized_aliases = {
            normalize_header(alias)
            for alias in aliases
        }

        for index, header in normalized_headers.items():
            if header in normalized_aliases:
                resolved[canonical_name] = index
                break

    required = {"pn", "description", "on_hand"}
    missing = required - resolved.keys()

    if missing:
        raise ValueError(
            "Missing required Excel headers: "
            + ", ".join(sorted(missing))
        )

    return resolved


def try_resolve_headers(row: tuple[Any, ...]) -> dict[str, int] | None:
    try:
        return resolve_headers(row)
    except ValueError:
        return None


def get_cell(
    row: tuple[Any, ...],
    header_map: dict[str, int],
    field_name: str,
) -> Any:
    index = header_map.get(field_name)

    if index is None or index >= len(row):
        return None

    return row[index]


def read_stock_sheet(
    workbook,
    sheet_name: str,
) -> list[SheetItem]:
    if sheet_name not in workbook.sheetnames:
        raise ValueError(
            f"Required sheet not found: {sheet_name}"
        )

    worksheet = workbook[sheet_name]
    rows = worksheet.iter_rows(values_only=True)

    header_map = None
    header_row_index = 0

    # Scan up to the first 10 rows to dynamically detect the table header row
    for r_idx, row in enumerate(rows, start=1):
        maybe_map = try_resolve_headers(row)
        if maybe_map is not None:
            header_map = maybe_map
            header_row_index = r_idx
            break
        if r_idx > 15:
            break

    if header_map is None:
        raise ValueError(
            f"Required headers (P/N, Description, On Hand) not found in first 15 rows of sheet: {sheet_name}"
        )

    items: list[SheetItem] = []
    seen_pn: set[str] = set()

    for row_number, row in enumerate(rows, start=header_row_index + 1):
        if not row or all(value is None or str(value).strip() == "" for value in row):
            continue

        raw_pn = get_cell(row, header_map, "pn")
        raw_description = get_cell(row, header_map, "description")
        raw_on_hand = get_cell(row, header_map, "on_hand")

        pn = normalize_pn(raw_pn)

        # Skip summary / total row
        if pn in {"TOTAL", "GRANDTOTAL", "SUM"}:
            continue
        first_cell_str = str(row[0] or "").strip().upper()
        if first_cell_str in {"TOTAL", "GRAND TOTAL", "SUM"}:
            continue

        if not pn:
            # If line has text in description but no PN, ignore or raise based on content
            if raw_description:
                raise ValueError(
                    f"{sheet_name} row {row_number}: P/N is required"
                )
            continue

        if pn in seen_pn:
            raise ValueError(
                f"{sheet_name}: duplicate P/N {pn} at row {row_number}"
            )

        description = clean_text(raw_description)

        if not description:
            raise ValueError(
                f"{sheet_name} row {row_number}: description is required"
            )

        on_hand = parse_non_negative_integer(
            raw_on_hand,
            field_name="On Hand",
            sheet_name=sheet_name,
            row_number=row_number,
        )

        item = SheetItem(
            pn=pn,
            description=description,
            brand=clean_text(get_cell(row, header_map, "brand")),
            cat1=clean_text(get_cell(row, header_map, "cat1")),
            cat2=clean_text(get_cell(row, header_map, "cat2")),
            cat3=clean_text(get_cell(row, header_map, "cat3")),
            barcode=clean_text(get_cell(row, header_map, "barcode")),
            rrp=parse_money(get_cell(row, header_map, "rrp")),
            on_hand=on_hand,
            source_sheet=sheet_name,
            source_row=row_number,
        )

        items.append(item)
        seen_pn.add(pn)

    return items


def select_metadata(
    f1_item: SheetItem | None,
    f2_item: SheetItem | None,
) -> SheetItem:
    item = f1_item or f2_item

    if item is None:
        raise RuntimeError("No source item available")

    return item


def merge_stock_sheets(
    f1_items: list[SheetItem],
    f2_items: list[SheetItem],
) -> list[dict[str, Any]]:
    f1_by_pn = {
        item.pn: item
        for item in f1_items
    }

    f2_by_pn = {
        item.pn: item
        for item in f2_items
    }

    all_pns = sorted(
        set(f1_by_pn) | set(f2_by_pn)
    )

    merged: list[dict[str, Any]] = []

    for pn in all_pns:
        f1_item = f1_by_pn.get(pn)
        f2_item = f2_by_pn.get(pn)
        metadata = select_metadata(f1_item, f2_item)

        f1 = f1_item.on_hand if f1_item else 0
        f2 = f2_item.on_hand if f2_item else 0

        merged.append({
            "inventoryPn": pn,
            "barcode": metadata.barcode,
            "description": metadata.description,
            "brand": metadata.brand,
            "cat1": metadata.cat1,
            "cat2": metadata.cat2,
            "cat3": metadata.cat3,
            "erpRrp": metadata.rrp,
            "f1": f1,
            "f2": f2,
            "total": f1 + f2,
            "sourceRows": {
                "f1": (
                    asdict(f1_item)
                    if f1_item
                    else None
                ),
                "f2": (
                    asdict(f2_item)
                    if f2_item
                    else None
                ),
            },
        })

    return merged


def sha256_file(file_path: Path) -> str:
    digest = hashlib.sha256()

    with file_path.open("rb") as file_handle:
        for block in iter(
            lambda: file_handle.read(1024 * 1024),
            b"",
        ):
            digest.update(block)

    return digest.hexdigest()


def parse_nimbus_excel(
    file_path: Path,
    *,
    f1_sheet: str = "Sheet1",
    f2_sheet: str = "Sheet2",
) -> dict[str, Any]:
    workbook = load_workbook(
        file_path,
        data_only=True,
        read_only=True,
    )

    f1_items = read_stock_sheet(
        workbook,
        f1_sheet,
    )

    f2_items = read_stock_sheet(
        workbook,
        f2_sheet,
    )

    items = merge_stock_sheets(
        f1_items,
        f2_items,
    )

    summary = {
        "totalRows": len(items),
        "f1Total": sum(item["f1"] for item in items),
        "f2Total": sum(item["f2"] for item in items),
        "totalQuantity": sum(
            item["total"]
            for item in items
        ),
    }

    return {
        "sourceFileName": file_path.name,
        "sourceFileSha256": sha256_file(file_path),
        "summary": summary,
        "items": items,
    }


def main() -> int:
    if len(sys.argv) < 2:
        print(
            "Usage: python read_nimbus_stock_excel.py "
            "<Stock.xlsx>"
        )
        return 2

    file_path = Path(sys.argv[1]).resolve()
    if not file_path.exists():
        print(f"File not found: {file_path}", file=sys.stderr)
        return 1

    result = parse_nimbus_excel(file_path)

    print(
        json.dumps(
            result["summary"],
            ensure_ascii=False,
            indent=2,
        )
    )

    output_path = Path(
        "reports/nimbus_stock_import_payload.json"
    )

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    output_path.write_text(
        json.dumps(
            result,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"Payload written to: {output_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
