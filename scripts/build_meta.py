"""Genera data/web/_meta.json con mtime de cada archivo de data/web.

Se debe correr al final de run_all.py o como step en CI.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT = Path(r"C:/Users/corra/Desktop/ATLAS politics")
WEB = PROJECT / "data" / "web"


def main() -> None:
    meta: dict[str, dict] = {}
    for p in WEB.rglob("*.json"):
        if p.name == "_meta.json": continue
        rel = p.relative_to(WEB).as_posix()
        st = p.stat()
        meta[rel] = {
            "mtime": datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d"),
            "size_kb": round(st.st_size / 1024, 1),
        }
    for p in WEB.rglob("*.geojson"):
        rel = p.relative_to(WEB).as_posix()
        st = p.stat()
        meta[rel] = {
            "mtime": datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d"),
            "size_kb": round(st.st_size / 1024, 1),
        }
    out = WEB / "_meta.json"
    out.write_text(json.dumps({
        "generated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "files": meta,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"-> {out.relative_to(PROJECT)}  ({len(meta)} archivos)")


if __name__ == "__main__":
    main()
