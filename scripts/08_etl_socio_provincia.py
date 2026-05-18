"""ETL indicadores socioeconómicos provinciales.

Por ahora descarga mortalidad infantil (DEIS) y la lleva por provincia,
quedándose con el último año disponible para choropleth + serie histórica
para análisis temporal.

Salidas:
    data/web/socio_provincia.json   — un objeto por provincia con:
        mortalidad_infantil_<year>     (último año)
        mortalidad_infantil_serie      lista [{year, valor}, ...]
        mortalidad_infantil_pais_<year>
    catalogs/socio.json

Más adelante agregar IPC regional, EPH, NBI, etc.
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
RAW = PROJECT / "data" / "raw" / "socio"
CATALOGS = PROJECT / "catalogs"
RAW.mkdir(parents=True, exist_ok=True)
CATALOGS.mkdir(parents=True, exist_ok=True)

URL_MORT = "https://datos.salud.gob.ar/dataset/2eff770c-1c2b-4a22-9281-c3b5e9412086/resource/c1253897-d507-41f7-a3e1-6ed756e7243b/download/tasa-mortalidad-infantil-deis-1990-2023.csv"

# Slug nombre→código INDEC provincia
PROV_SLUG_TO_INDEC = {
    "caba": "02",
    "buenosaires": "06",
    "catamarca": "10",
    "chaco": "22",
    "chubut": "26",
    "cordoba": "14",
    "corrientes": "18",
    "entrerios": "30",
    "formosa": "34",
    "jujuy": "38",
    "lapampa": "42",
    "larioja": "46",
    "mendoza": "50",
    "misiones": "54",
    "neuquen": "58",
    "rionegro": "62",
    "salta": "66",
    "sanjuan": "70",
    "sanluis": "74",
    "santacruz": "78",
    "santafe": "82",
    "santiagodelestero": "86",
    "tierradelfuego": "94",
    "tucuman": "90",
}


def download(url: str, name: str) -> Path:
    out = RAW / name
    if out.exists():
        print(f"[cache] {out.name}")
        return out
    print(f"[GET] {url}")
    r = requests.get(url, timeout=120, allow_redirects=True, verify=False)
    r.raise_for_status()
    out.write_bytes(r.content)
    print(f"  -> {out.name} ({len(r.content)/1024:.0f} KB)")
    return out


def process_mortalidad() -> tuple[dict[str, dict], int]:
    csv = download(URL_MORT, "mortalidad_infantil.csv")
    df = pd.read_csv(csv)
    df["year"] = pd.to_datetime(df["indice_tiempo"], dayfirst=True).dt.year
    last_year = int(df["year"].max())
    print(f"[mortalidad] último año: {last_year}")
    last_row = df[df["year"] == last_year].iloc[0]

    out: dict[str, dict] = {}
    for prov_slug, code in PROV_SLUG_TO_INDEC.items():
        col = f"mortalidad_infantil_{prov_slug}"
        if col not in df.columns:
            continue
        rec: dict = {}
        v = last_row.get(col)
        if pd.notna(v):
            rec[f"mortalidad_infantil"] = float(v)
            rec["mortalidad_infantil_year"] = last_year
        serie = []
        for _, r in df.iterrows():
            y = int(r["year"])
            val = r.get(col)
            if pd.notna(val):
                serie.append([y, float(val)])
        rec["mortalidad_infantil_serie"] = serie
        # Diferencial vs nacional
        nat = last_row.get("mortalidad_infantil_argentina")
        if pd.notna(nat) and pd.notna(v):
            rec["mortalidad_infantil_vs_pais"] = round(float(v) - float(nat), 2)
        out[code] = rec
    return out, last_year


def main() -> None:
    socio: dict[str, dict] = {}
    mort, year_mort = process_mortalidad()
    for code, rec in mort.items():
        socio.setdefault(code, {}).update(rec)

    out_path = WEB / "socio_provincia.json"
    out_path.write_text(json.dumps(socio, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({len(socio)} prov, {out_path.stat().st_size/1024:.0f} KB)")

    cat_path = CATALOGS / "socio.json"
    cat_path.write_text(json.dumps({
        "mortalidad_infantil": {
            "fuente": "DEIS Ministerio de Salud (datos.salud.gob.ar)",
            "year_actual": year_mort,
            "unidad": "por mil nacidos vivos",
            "variables": [
                "mortalidad_infantil",
                "mortalidad_infantil_vs_pais",
                "mortalidad_infantil_serie",
            ],
        },
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Catálogo: {cat_path}")
    print("ETL socio completo.")


if __name__ == "__main__":
    main()
