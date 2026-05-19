"""ETL Servicios habitacionales — agua, cloacas, gas red por provincia.

Fuente: transparencia.obraspublicas.gob.ar (Min. Obras Públicas)
Output: data/web/servicios_provincia.json
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pandas as pd
import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT = Path(r"C:/Users/corra/Desktop/ATLAS politics")
WEB = PROJECT / "data" / "web"
RAW = PROJECT / "data" / "raw" / "servicios"
RAW.mkdir(parents=True, exist_ok=True)

URLS = {
    "agua":    "https://transparencia.obraspublicas.gob.ar/cob-hog-agua.csv",
    "cloacas": "https://transparencia.obraspublicas.gob.ar/cob-hog-saneamiento.csv",
    "gasred":  "https://transparencia.obraspublicas.gob.ar/hogurb_gasred.csv",
}

# Mapeo col → variable name
COL_PREFIX = {
    "agua":    "cob_hog_agua",
    "cloacas": "cob_hog_saneamiento",
    "gasred":  "hogurb_gasred",
}


def download(key: str) -> Path:
    out = RAW / f"{key}.csv"
    if not out.exists():
        r = requests.get(URLS[key], timeout=120, verify=False)
        r.raise_for_status()
        out.write_bytes(r.content)
    return out


def main() -> None:
    out: dict[str, dict] = {}
    for key, prefix in COL_PREFIX.items():
        csv = download(key)
        df = pd.read_csv(csv)
        # Filtrar filas con datos (no todo cero)
        val_cols = [c for c in df.columns if c.startswith(prefix + "_") and c != f"{prefix}_arg" and "psnya" not in c and "ya_no" not in c]
        df["_sum"] = df[val_cols].sum(axis=1)
        df_valid = df[df["_sum"] > 0]
        if df_valid.empty:
            print(f"  [skip] {key}: sin datos válidos")
            continue
        last = df_valid.iloc[-1]
        year = pd.to_datetime(str(last["indice_tiempo"]).split("-")[0], errors="coerce").year if "-" in str(last["indice_tiempo"]) else int(last["indice_tiempo"])
        print(f"[{key}] año {year}, {len(val_cols)} cols")
        for col in val_cols:
            m = re.match(rf"{prefix}_(\d+)", col)
            if not m: continue
            code = m.group(1).zfill(2)
            v = float(last[col])
            if v <= 0: continue
            # Algunos vienen como 8.393 (= 83.93%), otros como 84.0; normalizamos heurístico
            # Si v <= 10, asumimos formato decimal × 10
            if v <= 10: v *= 10
            out.setdefault(code, {})[f"servicios_{key}_pct"] = round(v, 2)
        out_path = WEB / "servicios_provincia.json"
        out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                            encoding="utf-8")
    print(f"-> servicios_provincia.json ({len(out)} prov)")


if __name__ == "__main__":
    main()
