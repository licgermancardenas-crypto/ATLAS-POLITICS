"""ETL Minería — exportaciones mineras por provincia (SIACAM).

Fuente: Min. Economía SIACAM
Output: data/web/mineria_provincia.json
    mineria_exportaciones_musd
    mineria_per_capita_usd
"""
from __future__ import annotations

import json
import sys
import unicodedata
import re
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

URL = "https://www.mecon.gob.ar/dataset/Comercio/expo-mineria-por-provincia.csv"

PROV_NORMALIZE = {
    "buenos aires": "06", "ciudad autonoma de buenos aires": "02",
    "ciudad de buenos aires": "02", "catamarca": "10", "chaco": "22",
    "chubut": "26", "cordoba": "14", "corrientes": "18", "entre rios": "30",
    "formosa": "34", "jujuy": "38", "la pampa": "42", "la rioja": "46",
    "mendoza": "50", "misiones": "54", "neuquen": "58", "rio negro": "62",
    "salta": "66", "san juan": "70", "san luis": "74", "santa cruz": "78",
    "santa fe": "82", "santiago del estero": "86", "tierra del fuego": "94",
    "tucuman": "90",
}


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", s).strip()


def main() -> None:
    out_csv = RAW / "expo_mineria.csv"
    if not out_csv.exists():
        print(f"[GET] {URL}")
        r = requests.get(URL, timeout=180, verify=False)
        r.raise_for_status()
        out_csv.write_bytes(r.content)
    df = pd.read_csv(out_csv)
    df["ANYO"] = pd.to_numeric(df["ANYO"], errors="coerce").astype("Int64")
    df["USD_FOB"] = pd.to_numeric(df["USD_FOB"], errors="coerce").fillna(0)
    df["prov_s"] = df["PROVINCIA"].apply(slug)
    df["prov_code"] = df["prov_s"].map(PROV_NORMALIZE)
    df = df.dropna(subset=["prov_code"]).copy()
    last_year = int(df["ANYO"].max())
    print(f"Último año: {last_year}")

    pop_ind = json.loads((WEB / "indicadores_provincias.json").read_text(encoding="utf-8"))
    pop = {code: d.get("personas", 0) for code, d in pop_ind.items()}

    out: dict[str, dict] = {}
    sub = df[df["ANYO"] == last_year]
    for code, g in sub.groupby("prov_code"):
        musd = float(g["USD_FOB"].sum())
        rec = {
            "mineria_exportaciones_musd": round(musd, 2),
            "mineria_year": last_year,
        }
        p = pop.get(code, 0)
        if p and musd:
            rec["mineria_per_capita_usd"] = round(musd * 1_000_000 / p, 1)
        # Serie histórica para sparkline
        serie = df[df["prov_code"] == code].sort_values("ANYO")
        rec["mineria_serie"] = [[int(y), round(float(v), 2)]
                                for y, v in zip(serie["ANYO"], serie["USD_FOB"])
                                if pd.notna(y)]
        out[code] = rec

    out_path = WEB / "mineria_provincia.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({len(out)} prov, {out_path.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
