"""ETL Ganadería bovina por provincia (SENASA).

Output: data/web/ganaderia_provincia.json
    bovinos_total
    bovinos_per_capita        (proxy de "vocación ganadera")
    bovinos_vacas, vaquillonas, novillos, terneros (categorías SENASA)
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

URL = "https://datos.magyp.gob.ar/dataset/c19a5875-fb39-48b6-b0b2-234382722afb/resource/1b920477-8112-4e12-bc2c-94b564f04183/download/existencias-bovinas-provincia-departamento-2008-2019.csv"
CATEGORIAS = ["vacas", "vaquillonas", "novillos", "novillitos", "terneros"]


def main() -> None:
    out_csv = RAW / "bovinos.csv"
    if not out_csv.exists():
        print(f"[GET] {URL}")
        r = requests.get(URL, timeout=180, verify=False)
        r.raise_for_status()
        out_csv.write_bytes(r.content)
    df = pd.read_csv(out_csv, encoding="latin1")
    df["anio"] = pd.to_numeric(df["anio"], errors="coerce").astype("Int64")
    df["prov_code"] = df["provincia_id"].astype(str).str.zfill(2)
    for c in CATEGORIAS:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0)
    last_year = int(df["anio"].max())
    print(f"Último año: {last_year}")

    sub = df[df["anio"] == last_year]
    pop_ind = json.loads((WEB / "indicadores_provincias.json").read_text(encoding="utf-8"))
    pop = {code: d.get("personas", 0) for code, d in pop_ind.items()}

    out: dict[str, dict] = {}
    for code, g in sub.groupby("prov_code"):
        rec = {"bovinos_year": last_year}
        total = 0
        for cat in CATEGORIAS:
            if cat in g.columns:
                v = int(g[cat].sum())
                rec[f"bovinos_{cat}"] = v
                total += v
        rec["bovinos_total"] = total
        p = pop.get(code, 0)
        if p and total:
            rec["bovinos_per_capita"] = round(total / p, 2)
        out[code] = rec

    out_path = WEB / "ganaderia_provincia.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({len(out)} prov, {out_path.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
