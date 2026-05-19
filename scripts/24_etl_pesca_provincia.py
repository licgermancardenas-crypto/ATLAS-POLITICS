"""ETL Pesca — desembarques marítimos por provincia (SAGyP).

Output: data/web/pesca_provincia.json
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

URLS = [
    "https://datos.magyp.gob.ar/dataset/e2f12522-4dea-495e-877a-b6d2737ae6bf/resource/1996a5ec-7075-4062-9a79-05868fc2a2e2/download/captura-puerto-flota-2010-2018.csv",
    "https://datos.magyp.gob.ar/dataset/e2f12522-4dea-495e-877a-b6d2737ae6bf/resource/77a15b4a-71e1-4b81-9732-ae0b6863c8cc/download/captura-puerto-flota-2019.csv",
]


def download(url: str, name: str) -> Path:
    out = RAW / name
    if not out.exists():
        print(f"[GET] {name}")
        r = requests.get(url, timeout=180, verify=False)
        r.raise_for_status()
        out.write_bytes(r.content)
    return out


def main() -> None:
    paths = [download(u, f"pesca_{i}.csv") for i, u in enumerate(URLS)]
    def read(p):
        try: return pd.read_csv(p, encoding="utf-8-sig", dtype=str)
        except UnicodeDecodeError: return pd.read_csv(p, encoding="latin1", dtype=str)
    dfs = [read(p) for p in paths]
    df = pd.concat(dfs, ignore_index=True)
    # Detectar columna captura
    cap_col = next((c for c in df.columns if "captura" in c.lower() or c == "kilos"), df.columns[-1])
    df[cap_col] = pd.to_numeric(df[cap_col], errors="coerce").fillna(0)
    df["prov_code"] = df["provincia_id"].astype(str).str.zfill(2)
    df["year"] = df["fecha"].astype(str).str[:4]
    last_year = df["year"].max()
    print(f"Último año: {last_year}, col captura: {cap_col}")

    pop_ind = json.loads((WEB / "indicadores_provincias.json").read_text(encoding="utf-8"))
    pop = {code: d.get("personas", 0) for code, d in pop_ind.items()}

    out: dict[str, dict] = {}
    sub = df[df["year"] == last_year]
    for code, g in sub.groupby("prov_code"):
        kg = float(g[cap_col].sum())
        rec = {
            "pesca_captura_tm": round(kg / 1000, 1),
            "pesca_year": int(last_year),
            "pesca_puertos": int(g["puerto"].nunique()),
        }
        p = pop.get(code, 0)
        if p:
            rec["pesca_kg_per_capita"] = round(kg / p, 1)
        out[code] = rec

    out_path = WEB / "pesca_provincia.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({len(out)} prov, {out_path.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
