"""ETL Cobertura de Vacunación SRP (Triple Viral) por provincia.

Fuente: DICEI - Ministerio de Salud (datos.salud.gob.ar)
Serie 2009-2019 % cobertura 1ra y 2da dosis por jurisdicción.

Outputs por provincia:
    vacuna_srp_1ra_dosis_pct   — último año disponible (2019)
    vacuna_srp_2da_dosis_pct
    vacuna_srp_serie_1ra       — serie histórica anual

Salida: data/web/vacunas_provincia.json
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
RAW = PROJECT / "data" / "raw" / "socio"
RAW.mkdir(parents=True, exist_ok=True)

URL = ("https://datos.salud.gob.ar/dataset/f70b1357-b57e-4077-9746-af8193243207/"
       "resource/1ffe6748-9d6c-467e-9f01-13578bd54ad7/download/dicei-vacunas-srp-2009-2019.csv")


def download() -> Path:
    out = RAW / "vacunas_srp.csv"
    if out.exists():
        print(f"[cache] {out.name}")
        return out
    print(f"[GET] {URL}")
    r = requests.get(URL, timeout=120, allow_redirects=True, verify=False)
    r.raise_for_status()
    out.write_bytes(r.content)
    print(f"  -> {out.name} ({len(r.content)/1024:.0f} KB)")
    return out


def main() -> None:
    csv = download()
    df = pd.read_csv(csv, encoding="utf-8-sig")
    df["prov_code"] = df["jurisdiccion_id"].astype(str).str.zfill(2)

    # Detectar columnas año + tipo
    pat1 = re.compile(r"^(\d{4})_cob.*1_.*dosis", re.IGNORECASE)
    pat2 = re.compile(r"^(\d{4})_cob.*2_.*dosis", re.IGNORECASE)
    year_cols_1: dict[int, str] = {}
    year_cols_2: dict[int, str] = {}
    for c in df.columns:
        m1 = pat1.match(c.strip())
        m2 = pat2.match(c.strip())
        if m1: year_cols_1[int(m1.group(1))] = c
        elif m2: year_cols_2[int(m2.group(1))] = c

    last_year = max(year_cols_1.keys())
    print(f"Último año: {last_year}, años cubiertos: {sorted(year_cols_1.keys())}")

    out: dict[str, dict] = {}
    for _, r in df.iterrows():
        code = r["prov_code"]
        rec: dict = {}
        c1 = year_cols_1[last_year]
        c2 = year_cols_2.get(last_year)
        v1 = r.get(c1); v2 = r.get(c2) if c2 else None
        if pd.notna(v1):
            rec["vacuna_srp_1ra_dosis_pct"] = round(float(v1), 1)
            rec["vacuna_srp_year"] = last_year
        if v2 is not None and pd.notna(v2):
            rec["vacuna_srp_2da_dosis_pct"] = round(float(v2), 1)
        # Serie histórica 1ra dosis
        serie = []
        for y in sorted(year_cols_1.keys()):
            v = r.get(year_cols_1[y])
            if pd.notna(v):
                serie.append([y, round(float(v), 1)])
        rec["vacuna_srp_serie_1ra"] = serie
        out[code] = rec

    out_path = WEB / "vacunas_provincia.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({len(out)} prov, {out_path.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
