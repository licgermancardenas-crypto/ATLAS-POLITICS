"""ETL EPH — Empleo y desempleo por aglomerado urbano (INDEC) → provincia.

INDEC publica tasas trimestrales por 31 aglomerados. Mapeamos cada aglomerado
a la provincia donde está y, si una provincia tiene varios, promediamos.

Salidas:
    data/web/empleo_provincia.json      — último trimestre + serie por aglomerado
    data/web/pobreza_nacional.json      — serie histórica nacional para panel
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

URLS = {
    "desempleo": "https://infra.datos.gob.ar/catalog/sspm/dataset/45/distribution/45.2/download/tasa-desempleo-valores-trimestrales.csv",
    "pobreza":   "https://infra.datos.gob.ar/catalog/sspm/dataset/60/distribution/60.1/download/hogares-por-debajo-linea-pobreza-e-indigencia-eph-puntual.csv",
}

# Mapeo aglomerado → código INDEC provincia
AGLOM_TO_PROV = {
    "caba": "02",
    "partidos_gba": "06",
    "gran_la_plata": "06",
    "mar_del_plata": "06",
    "bahia_blanca": "06",
    "san_nicolas": "06",
    "gran_cordoba": "14",
    "rio_cuarto": "14",
    "gran_mendoza": "50",
    "gran_san_juan": "70",
    "san_luis": "74",
    "corrientes": "18",
    "formosa": "34",
    "gran_resistencia": "22",
    "posadas": "54",
    "gran_tucuman": "90",
    "gran_catamarca": "10",
    "jujuy": "38",
    "la_rioja": "46",
    "salta": "66",
    "santiago_del_estero": "86",
    "gran_rosario": "82",
    "gran_santa_fe": "82",
    "concordia": "30",
    "gran_parana": "30",
    "santa_rosa": "42",
    "comodoro_rivadavia": "26",
    "rawson_trelew": "26",
    "neuquen": "58",
    "rio_gallegos": "78",
    "ushuaia_rio_grande": "94",
    "viedma_carmen_patagones": "62",
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


def process_desempleo() -> tuple[dict[str, dict], str]:
    csv = download(URLS["desempleo"], "desempleo_trimestral.csv")
    df = pd.read_csv(csv, parse_dates=["indice_tiempo"])
    df = df.sort_values("indice_tiempo").reset_index(drop=True)
    last_row = df.iloc[-1]
    dt = last_row["indice_tiempo"]
    q = (dt.month - 1) // 3 + 1
    last_q = f"{dt.year} T{q}"
    print(f"Último período: {last_q}")

    # Promedio por provincia
    by_prov: dict[str, list[float]] = {}
    for aglom, code in AGLOM_TO_PROV.items():
        col = f"eph_continua_tasa_desempleo_total_{aglom}"
        if col not in df.columns:
            continue
        v = last_row.get(col)
        if pd.notna(v):
            by_prov.setdefault(code, []).append(float(v))

    out: dict[str, dict] = {}
    nat_col = "eph_continua_tasa_desempleo_total"
    nat_v = float(last_row.get(nat_col)) if nat_col in df.columns and pd.notna(last_row[nat_col]) else None

    for code, vals in by_prov.items():
        avg = sum(vals) / len(vals)
        out[code] = {
            "desempleo": round(avg * 100, 2),
            "desempleo_n_aglomerados": len(vals),
            "desempleo_vs_nacional": round((avg - (nat_v or avg)) * 100, 2) if nat_v else None,
        }

    return out, last_q


def process_pobreza() -> dict:
    csv = download(URLS["pobreza"], "pobreza_eph_puntual.csv")
    df = pd.read_csv(csv, parse_dates=["indice_tiempo"])
    df = df.sort_values("indice_tiempo").reset_index(drop=True)
    last = df.iloc[-1]
    return {
        "last_date": last["indice_tiempo"].strftime("%Y-%m"),
        "indigentes_hogares": round(float(last["indigentes_hogares"]) * 100, 2),
        "indigentes_poblacion": round(float(last["indigentes_poblacion"]) * 100, 2),
        "pobres_hogares": round(float(last["pobres_hogares"]) * 100, 2),
        "pobres_personas": round(float(last["pobres_personas"]) * 100, 2),
        "serie": [
            {"fecha": r["indice_tiempo"].strftime("%Y-%m"),
             "pobres_personas": round(float(r["pobres_personas"]) * 100, 2),
             "indigentes_poblacion": round(float(r["indigentes_poblacion"]) * 100, 2)}
            for _, r in df.tail(40).iterrows()
        ],
    }


def main() -> None:
    emp, last_q = process_desempleo()
    out_emp = WEB / "empleo_provincia.json"
    out_emp.write_text(json.dumps({"last_q": last_q, "provincias": emp},
                                  ensure_ascii=False, separators=(",", ":")),
                       encoding="utf-8")
    print(f"-> {out_emp.name} ({len(emp)} prov, {out_emp.stat().st_size/1024:.0f} KB)")

    pobr = process_pobreza()
    out_pobr = WEB / "pobreza_nacional.json"
    out_pobr.write_text(json.dumps(pobr, ensure_ascii=False, separators=(",", ":")),
                         encoding="utf-8")
    print(f"-> {out_pobr.name} ({out_pobr.stat().st_size/1024:.0f} KB)")
    print("ETL empleo+pobreza completo.")


if __name__ == "__main__":
    main()
