#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Convert an exported CSV (e.g. from Tencent Form) into data/submissions.json
used by this GitHub Pages static site.

Usage:
  python3 tools/convert_csv_to_submissions_json.py --input in.csv --output data/submissions.json
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple


ALIASES = {
    "title": {"title", "标题"},
    "content": {"content", "内容", "描述", "正文"},
    "nickname": {"nickname", "昵称", "姓名", "称呼"},
    "contact": {"contact", "联系方式", "微信", "手机号", "电话", "邮箱", "email"},
    "createdAt": {"createdat", "created_at", "提交时间", "时间", "提交日期", "日期"},
}


def _norm(s: str) -> str:
    return "".join(s.strip().lower().split())


def guess_columns(fieldnames: Iterable[str]) -> Dict[str, Optional[str]]:
    norm_to_raw = {_norm(n): n for n in fieldnames if n}
    out: Dict[str, Optional[str]] = {}
    for key, aliases in ALIASES.items():
        found = None
        for a in aliases:
            raw = norm_to_raw.get(_norm(a))
            if raw:
                found = raw
                break
        out[key] = found
    return out


def parse_time(s: str) -> Optional[str]:
    s = (s or "").strip()
    if not s:
        return None

    # Try common formats without external deps.
    patterns = [
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M",
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%Y.%m.%d %H:%M:%S",
        "%Y.%m.%d %H:%M",
        "%Y.%m.%d",
    ]
    for p in patterns:
        try:
            d = dt.datetime.strptime(s, p)
            # If date-only, keep it as local midnight.
            if d.tzinfo is None:
                d = d.replace(tzinfo=dt.timezone.utc)
            return d.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")
        except ValueError:
            continue

    # If it's already ISO-ish, keep best-effort.
    try:
        d = dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=dt.timezone.utc)
        return d.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")
    except ValueError:
        return None


def row_to_item(row: Dict[str, str], cols: Dict[str, Optional[str]]) -> Dict[str, str]:
    def g(k: str) -> str:
        c = cols.get(k)
        return (row.get(c, "") if c else "").strip()

    item = {
        "title": g("title"),
        "content": g("content"),
        "nickname": g("nickname"),
        "contact": g("contact"),
    }

    created_raw = g("createdAt")
    created = parse_time(created_raw)
    if created:
        item["createdAt"] = created
    return item


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", "-i", required=True, help="CSV file exported from the form")
    ap.add_argument(
        "--output",
        "-o",
        required=True,
        help="Output JSON path (usually ./data/submissions.json)",
    )
    ap.add_argument("--limit", type=int, default=0, help="Optional: only convert first N rows")
    args = ap.parse_args(argv)

    in_path = Path(args.input)
    out_path = Path(args.output)

    if not in_path.exists():
        print(f"[error] input not found: {in_path}", file=sys.stderr)
        return 2

    with in_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            print("[error] CSV has no header row", file=sys.stderr)
            return 2

        cols = guess_columns(reader.fieldnames)
        missing_required = [k for k in ("title", "content", "nickname", "contact") if not cols.get(k)]
        if missing_required:
            print(
                "[warn] missing columns (will be empty): " + ", ".join(missing_required),
                file=sys.stderr,
            )
            print("[hint] detected headers: " + ", ".join(reader.fieldnames), file=sys.stderr)

        items: List[Dict[str, str]] = []
        for idx, row in enumerate(reader, start=1):
            if args.limit and idx > args.limit:
                break
            items.append(row_to_item(row, cols))

    payload = {
        "updatedAt": dt.datetime.now(tz=dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "items": items,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[ok] wrote {len(items)} items -> {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

