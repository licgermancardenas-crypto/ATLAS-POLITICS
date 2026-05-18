"""ETL de variables económicas a nivel provincial — Exportaciones.

Fuente: Subsecretaría de Programación Microeconómica (SSPM), datos.gob.ar.
URL: https://infra.datos.gob.ar/catalog/sspm/dataset/350/distribution/350.1/download/exportaciones-provincia-rubro.csv

Toma la serie histórica 1993-2024 y genera para cada provincia el último año
disponible más derivados:

    exportaciones_total_2024_musd   — millones de USD FOB
    exportaciones_pp_2024_musd      — Productos Primarios
    exportaciones_moa_2024_musd     — Manufacturas de Origen Agropecuario
    exportaciones_moi_2024_musd     — Manufacturas de Origen Industrial
    exportaciones_cye_2024_musd     — Combustibles y Energía
    exportaciones_per_capita_usd    — total × 1e6 / población 2022 (Censo)
    exportaciones_share_pais_pct    — share % del país

Salidas:
    data/web/economia_provincia.json
"""
from __future__ import annotations

import io
import json
import re
import sys
import unicodedata
from pathlib import Path

import pandas as pd
import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT = Path(r"C:/Users/corra/Desktop/ATLAS politics")
WEB = PROJECT / "data" / "web"
RAW = PROJECT / "data" / "raw" / "economia"
RAW.mkdir(parents=True, exist_ok=True)

URL_EXP = "https://infra.datos.gob.ar/catalog/sspm/dataset/350/distribution/350.1/download/exportaciones-provincia-rubro.csv"

# Mapeo nombre slug DINE/SSPM → código INDEC provincia
PROV_SLUG_TO_INDEC = {
    "buenos_aires": "06",
    "ciudad_de_buenos_aires": "02",
    "catamarca": "10",
    "chaco": "22",
    "chubut": "26",
    "cordoba": "14",
    "corrientes": "18",
    "entre_rios": "30",
    "formosa": "34",
    "jujuy": "38",
    "la_pampa": "42",
    "la_rioja": "46",
    "mendoza": "50",
    "misiones": "54",
    "neuquen": "58",
    "rio_negro": "62",
    "salta": "66",
    "san_juan": "70",
    "san_luis": "74",
    "santa_cruz": "78",
    "santa_fe": "82",
    "santiago_del_estero": "86",
    "tierra_del_fuego": "94",
    "tucuman": "90",
}


def download_csv() -> Path:
    """Cachea en data/raw/economia. Re-descarga si no existe."""
    out = RAW / "exportaciones-provincia-rubro.csv"
    if out.exists():
        print(f"[cache] {out.name}")
        return out
    print(f"[GET] {URL_EXP}")
    r = requests.get(URL_EXP, timeout=120)
    r.raise_for_status()
    out.write_bytes(r.content)
    print(f"  -> {out.name} ({len(r.content)/1024:.0f} KB)")
    return out


def load_pop_by_prov() -> dict[str, int]:
    ind = json.loads((WEB / "indicadores_provincias.json").read_text(encoding="utf-8"))
    return {code: d.get("personas", 0) for code, d in ind.items()}


def main() -> None:
    csv = download_csv()
    df = pd.read_csv(csv)
    df["year"] = pd.to_datetime(df["indice_tiempo"]).dt.year
    last_year = int(df["year"].max())
    print(f"Año más reciente: {last_year}")
    row = df[df["year"] == last_year].iloc[0]

    pop = load_pop_by_prov()
    total_pais = float(row.get(f"total_exportaciones_total_exportaciones", 0))

    out: dict[str, dict] = {}
    RUBROS = ["pp", "moa", "moi", "cye"]
    for prov_slug, code in PROV_SLUG_TO_INDEC.items():
        rec: dict = {"year": last_year}
        for r in RUBROS:
            col = f"{prov_slug}_{r}"
            if col in df.columns:
                rec[f"exportaciones_{r}_musd"] = round(float(row[col]), 2)
        tot_col = f"{prov_slug}_total_{prov_slug}"
        if tot_col in df.columns:
            tot = float(row[tot_col])
            rec["exportaciones_total_musd"] = round(tot, 2)
            if pop.get(code):
                rec["exportaciones_per_capita_usd"] = round(tot * 1_000_000 / pop[code], 1)
            if total_pais:
                rec["exportaciones_share_pais_pct"] = round(tot / total_pais * 100, 2)
        # Composición % por rubro
        if rec.get("exportaciones_total_musd"):
            tot = rec["exportaciones_total_musd"]
            for r in RUBROS:
                v = rec.get(f"exportaciones_{r}_musd")
                if v is not None:
                    rec[f"exportaciones_{r}_share"] = round(v / tot * 100, 2) if tot else None
        out[code] = rec

    out_path = WEB / "economia_provincia.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({len(out)} prov, {out_path.stat().st_size/1024:.0f} KB)")

    # Catálogo
    cat_path = PROJECT / "catalogs" / "economia.json"
    cat_path.write_text(json.dumps({
        "exportaciones": {
            "fuente": "SSPM - datos.gob.ar",
            "year": last_year,
            "file": "data/economia_provincia.json",
            "variables": [
                "exportaciones_total_musd",
                "exportaciones_pp_musd", "exportaciones_moa_musd",
                "exportaciones_moi_musd", "exportaciones_cye_musd",
                "exportaciones_per_capita_usd",
                "exportaciones_share_pais_pct",
                "exportaciones_pp_share", "exportaciones_moa_share",
                "exportaciones_moi_share", "exportaciones_cye_share",
            ],
        }
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Catálogo: {cat_path}")


if __name__ == "__main__":
    main()
