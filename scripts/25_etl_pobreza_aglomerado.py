"""ETL Pobreza por aglomerado urbano (EPH continua INDEC) → provincia.

Datos por aglomerado. Mapeamos cada aglomerado a su provincia y promediamos
si la provincia tiene más de uno.

Output: data/web/pobreza_provincia.json + sparkline serie
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
RAW.mkdir(parents=True, exist_ok=True)

URL = "https://infra.datos.gob.ar/catalog/sspm/dataset/64/distribution/64.2/download/poblacion-con-ingresos-por-debajo-linea-pobreza-eph-continua.csv"

# col_pattern → prov_code
AGLOM_TO_PROV = {
    "caba": "02", "partidos_gran_buenos_aires": "06", "gran_la_plata": "06",
    "mar_plata": "06", "bahia_blanca": "06", "san_nicolas": "06",
    "gran_cordoba": "14", "rio_cuarto": "14",
    "gran_mendoza": "50", "gran_san_juan": "70", "san_luis": "74",
    "corrientes": "18", "formosa": "34", "gran_resistencia": "22",
    "posadas": "54", "gran_tucuman": "90", "gran_catamarca": "10",
    "jujuy": "38", "la_rioja": "46", "salta": "66", "santiago_estero": "86",
    "concordia": "30", "gran_parana": "30", "gran_santa_fe": "82",
    "gran_rosario": "82", "santa_rosa": "42",
    "comodoro_rivadavia": "26", "rawson_trelew": "26",
    "neuquen_plottier": "58", "rio_gallegos": "78",
    "ushuaia_rio_grande": "94", "viedma_carmen_patagones": "62",
}


def main() -> None:
    out_csv = RAW / "pobreza_aglomerado.csv"
    if not out_csv.exists():
        print(f"[GET] {URL}")
        r = requests.get(URL, timeout=120, verify=False)
        r.raise_for_status()
        out_csv.write_bytes(r.content)
    df = pd.read_csv(out_csv, parse_dates=["indice_tiempo"])
    df = df.sort_values("indice_tiempo").reset_index(drop=True)
    last = df.iloc[-1]
    last_q = last["indice_tiempo"].strftime("%Y-%m")
    print(f"Último período: {last_q}")

    # Detectar columnas → provincia
    col_map: dict[str, str] = {}
    for col in df.columns:
        if not col.startswith("poblacion_pobre_pct_"): continue
        key = col.replace("poblacion_pobre_pct_", "").replace("_continua", "")
        for aglom_key, prov in AGLOM_TO_PROV.items():
            if key.startswith(aglom_key):
                col_map[col] = prov; break

    by_prov: dict[str, list[float]] = {}
    for col, prov in col_map.items():
        v = last.get(col)
        if pd.notna(v):
            by_prov.setdefault(prov, []).append(float(v))

    out: dict[str, dict] = {}
    nat = float(last.get("poblacion_pobre_pct_total_continua", 0))
    for prov, vs in by_prov.items():
        avg = sum(vs) / len(vs)
        # Serie por la primera columna de la provincia (para sparkline)
        first_col = next(col for col, p in col_map.items() if p == prov)
        serie_df = df[["indice_tiempo", first_col]].dropna()
        out[prov] = {
            "pobreza_pct": round(avg * 100, 1),
            "pobreza_year_q": last_q,
            "pobreza_vs_nacional": round((avg - nat) * 100, 1),
            "pobreza_serie": [
                [r["indice_tiempo"].strftime("%Y-%m"), round(float(r[first_col]) * 100, 1)]
                for _, r in serie_df.tail(20).iterrows()
            ],
        }

    out_path = WEB / "pobreza_provincia.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({len(out)} prov, {out_path.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
