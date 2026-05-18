"""ETL Producción agrícola por provincia — SAGyP estimaciones.

Fuente: datos.magyp.gob.ar - Estimaciones agrícolas (cobertura 1969 -hoy).
Output: data/web/agro_provincia.json — última campaña con datos completos,
agregado a provincia con totales de cultivos clave.
"""
from __future__ import annotations

import json
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
RAW = PROJECT / "data" / "raw" / "agro"
RAW.mkdir(parents=True, exist_ok=True)

URL = "https://datos.magyp.gob.ar/dataset/9e1e77ba-267e-4eaa-a59f-3296e86b5f36/resource/95d066e6-8a0f-4a80-b59d-6f28f88eacd5/download/estimaciones-agricolas-2026-03.csv"
CULTIVOS_KEY = ["soja", "trigo", "maiz", "girasol", "cebada", "sorgo"]


def download() -> Path:
    out = RAW / "estimaciones_agricolas.csv"
    if out.exists():
        print(f"[cache] {out.name}")
        return out
    print(f"[GET] {URL}")
    r = requests.get(URL, timeout=180, verify=False)
    r.raise_for_status()
    out.write_bytes(r.content)
    print(f"  -> {out.name} ({len(r.content)/1024:.0f} KB)")
    return out


def main() -> None:
    csv = download()
    df = pd.read_csv(csv, dtype=str)
    df["anio"] = pd.to_numeric(df["anio"], errors="coerce").astype("Int64")
    df["produccion_tm"] = pd.to_numeric(df["produccion_tm"], errors="coerce").fillna(0)
    df["superficie_sembrada_ha"] = pd.to_numeric(df["superficie_sembrada_ha"], errors="coerce").fillna(0)
    df["cultivo_n"] = df["cultivo"].fillna("").str.lower().str.strip()
    df["prov_code"] = df["provincia_id"].astype(str).str.zfill(2)

    # Última campaña con datos para cultivos principales
    last_year = int(df[df["cultivo_n"].isin(CULTIVOS_KEY) & (df["produccion_tm"] > 0)]["anio"].max())
    print(f"Última campaña: {last_year}")

    sub = df[(df["anio"] == last_year) & (df["cultivo_n"].isin(CULTIVOS_KEY))]
    out: dict[str, dict] = {}
    for code, g in sub.groupby("prov_code"):
        rec: dict = {"agro_year": last_year}
        total_prod = float(g["produccion_tm"].sum())
        total_sup = float(g["superficie_sembrada_ha"].sum())
        rec["agro_produccion_total_tm"] = round(total_prod, 0)
        rec["agro_superficie_total_ha"] = round(total_sup, 0)
        for cult in CULTIVOS_KEY:
            sub_c = g[g["cultivo_n"] == cult]
            if len(sub_c):
                p = float(sub_c["produccion_tm"].sum())
                if p > 0:
                    rec[f"agro_{cult}_tm"] = round(p, 0)
                    rec[f"agro_{cult}_share"] = round(p / total_prod * 100, 1) if total_prod else 0
        out[code] = rec

    out_path = WEB / "agro_provincia.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({len(out)} prov, {out_path.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
