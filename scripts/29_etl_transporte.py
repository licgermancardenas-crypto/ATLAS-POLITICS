"""ETL Transporte — subsidios a colectivos corta distancia por provincia.

Fuente: datos.transporte.gob.ar (Subsidios al transporte público de pasajeros)
Output: data/web/transporte_provincia.json
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

import pandas as pd
import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT = Path(r"C:/Users/corra/Desktop/ATLAS politics")
WEB = PROJECT / "data" / "web"
RAW = PROJECT / "data" / "raw" / "transporte"
RAW.mkdir(parents=True, exist_ok=True)

URL = "https://datos.transporte.gob.ar/dataset/04d3c354-e892-4495-b87a-cd5c3090135e/resource/646fea11-db00-4a36-ad52-fa6a0b9ea8a4/download/aportes_colectivoscd.csv"

PROV_NORM = {
    "buenos aires": "06", "caba": "02", "c a b a": "02",
    "ciudad autonoma de buenos aires": "02", "ciudad de buenos aires": "02",
    "catamarca": "10", "chaco": "22", "chubut": "26", "cordoba": "14",
    "corrientes": "18", "entre rios": "30", "formosa": "34", "jujuy": "38",
    "la pampa": "42", "la rioja": "46", "mendoza": "50", "misiones": "54",
    "neuquen": "58", "rio negro": "62", "salta": "66", "san juan": "70",
    "san luis": "74", "santa cruz": "78", "santa fe": "82",
    "santiago del estero": "86", "tierra del fuego": "94", "tucuman": "90",
}


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def main() -> None:
    csv = RAW / "colectivos_cd.csv"
    if not csv.exists():
        print(f"[GET] {URL}")
        r = requests.get(URL, timeout=180, verify=False)
        r.raise_for_status()
        csv.write_bytes(r.content)
    # CSV con separador ; y header con columnas desordenadas
    df = pd.read_csv(csv, sep=";", encoding="utf-8-sig", dtype=str)
    # Columnas reales por posición (el header está mal)
    df.columns = ["mes", "cuit", "provincia", "municipio", "monto", "tipo"]
    df["monto"] = pd.to_numeric(df["monto"], errors="coerce").fillna(0)
    df["prov_s"] = df["provincia"].apply(slug)
    df["prov_code"] = df["prov_s"].map(PROV_NORM)
    df = df.dropna(subset=["prov_code"]).copy()
    df["year"] = df["mes"].astype(str).str[3:7]
    # Tomar el año con mejor cobertura provincial (al menos 10 prov)
    coverage = df.groupby("year")["prov_code"].nunique().sort_values(ascending=False)
    print("cobertura por año:")
    print(coverage.head())
    last_year = coverage[coverage >= 10].index.max() if (coverage >= 10).any() else coverage.idxmax()
    print(f"Año elegido: {last_year}")

    sub = df[df["year"] == last_year]
    pop_ind = json.loads((WEB / "indicadores_provincias.json").read_text(encoding="utf-8"))
    pop = {code: d.get("personas", 0) for code, d in pop_ind.items()}

    out: dict[str, dict] = {}
    for code, g in sub.groupby("prov_code"):
        monto = float(g["monto"].sum())
        n_muni = int(g["municipio"].nunique())
        rec = {
            "transporte_subsidios_colectivos_cd_total": round(monto, 0),
            "transporte_year": int(last_year),
            "transporte_municipios_subsidiados": n_muni,
        }
        p = pop.get(code, 0)
        if p:
            rec["transporte_subsidios_per_capita_ars"] = round(monto / p, 1)
        out[code] = rec

    out_path = WEB / "transporte_provincia.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({len(out)} prov, {out_path.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
