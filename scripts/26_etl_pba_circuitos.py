"""ETL Circuitos electorales PBA — geom + histórico 2011-2023 por circuito.

Cubre: Presidente (2011, 2015, 2019, 2023) + Diputados Nac + Senadores Nac
en los años disponibles, agregando votos a nivel circuito y computando
% por coalición unificada (PJ/JxC/LLA/Hacemos/FIT).

Outputs:
    data/web/pba_circuitos.geojson         (geom 1.150 circuitos)
    data/web/pba_circuitos_historico.json  (resultados histórico unificado)
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

os.environ.setdefault("OGR_GEOJSON_MAX_OBJ_SIZE", "0")

import geopandas as gpd
import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT = Path(r"C:/Users/corra/Desktop/ATLAS politics")
WEB = PROJECT / "data" / "web"
RAW = PROJECT / "data" / "raw"
GEOJSON = RAW / "pba_circuitos" / "circuitos-electorales-pba.geojson"

# Diccionario unificado de alianzas histórico (igual que 17_etl_pba_elecciones)
ALIANZAS_HIST = {
    "pj": [
        "FRENTE PARA LA VICTORIA",
        "UNIDAD CIUDADANA", "FRENTE JUSTICIALISTA",
        "FRENTE DE TODOS",
        "UNION POR LA PATRIA", "UNIÓN POR LA PATRIA",
        "ALIANZA FRENTE PARA LA VICTORIA",
    ],
    "jxc": [
        "PROPUESTA REPUBLICANA",
        "CAMBIEMOS", "JUNTOS POR EL CAMBIO",
        "ALIANZA CAMBIEMOS",
    ],
    "lla": ["LA LIBERTAD AVANZA", "AVANZA LIBERTAD"],
    "una_massa": [
        "UNIDOS POR UNA NUEVA ALTERNATIVA",
        "ALIANZA UNIDOS POR UNA NUEVA ALTERNATIVA",
    ],
    "hacemos": [
        "HACEMOS POR NUESTRO PAIS", "HACEMOS POR NUESTRO PAÍS",
        "CONSENSO FEDERAL",
    ],
    "izq": ["FRENTE DE IZQUIERDA", "ALIANZA FRENTE DE IZQUIERDA"],
}

CARGOS_NORMALIZE = {
    "PRESIDENTE": "pres", "PRESIDENTE Y VICE": "pres",
    "DIPUTADO NACIONAL": "dip", "DIPUTADOS NACIONALES": "dip",
    "SENADOR NACIONAL": "sen", "SENADORES NACIONALES": "sen",
}

CSV_PRES = [
    RAW / "elecciones" / "resultados-electorales-presidente-2011_2015.csv",
    RAW / "elecciones" / "resultados-electorales-presidente-2019_2023.csv",
]
CSV_DIP = [
    RAW / "elecciones" / "resultados-electorales-diputados-2011_2015.csv",
    RAW / "elecciones" / "resultados-electorales-diputados-2017_2023.csv",
]
CSV_SEN = [
    RAW / "elecciones" / "senadores-pba-generales-2011-2023.csv",
]


def alianza_for(nombre: str) -> str | None:
    n = (nombre or "").upper().strip()
    if not n: return None
    for key, aliases in ALIANZAS_HIST.items():
        for a in aliases:
            if a in n: return key
    return None


def norm_circuito(s: str) -> str:
    if s is None: return ""
    s = str(s).strip()
    m = re.match(r"^0*(\d+)([A-Z]*)?$", s)
    return m.group(1) + (m.group(2) or "") if m else s


def process_csv_set_chunked(csv_paths):
    """Procesa CSVs en chunks, devuelve dos dicts acumuladores:
    tot[(cn, cargo, year)] = total positivos
    by_ali[(cn, cargo, year, alianza)] = positivos por alianza
    """
    from collections import defaultdict
    tot = defaultdict(int)
    by_ali = defaultdict(int)
    USE = ["circuito_id", "cargo_nombre", "agrupacion_nombre", "votos_tipo", "votos_cantidad"]
    for f in csv_paths:
        if not f.exists():
            print(f"  [skip] {f.name}"); continue
        # Detectar nombre col año
        try:
            head = pd.read_csv(f, dtype=str, nrows=1, encoding="utf-8-sig")
        except UnicodeDecodeError:
            head = pd.read_csv(f, dtype=str, nrows=1, encoding="latin1")
        col_year = next((c for c in head.columns if c.strip().lower() in ("año", "ano", "year")), None)
        if not col_year:
            print(f"  [skip] {f.name} sin col año"); continue
        usecols = USE + [col_year]
        # Encoding fallback
        try:
            reader = pd.read_csv(f, dtype=str, low_memory=False, encoding="utf-8-sig",
                                 chunksize=500_000, usecols=usecols)
            chunks = list(reader)
        except UnicodeDecodeError:
            reader = pd.read_csv(f, dtype=str, low_memory=False, encoding="latin1",
                                 chunksize=500_000, usecols=usecols)
            chunks = list(reader)
        n = 0
        for ch in chunks:
            ch = ch.rename(columns={col_year: "year"})
            ch["votos_cantidad"] = pd.to_numeric(ch["votos_cantidad"], errors="coerce").fillna(0).astype("int64")
            ch["year"] = pd.to_numeric(ch["year"], errors="coerce")
            ch["cargo_n"] = ch["cargo_nombre"].fillna("").str.upper().str.strip().map(CARGOS_NORMALIZE)
            ch["circuito_n"] = ch["circuito_id"].apply(norm_circuito)
            ch = ch.dropna(subset=["cargo_n", "year"])
            ch = ch[ch["votos_tipo"] == "POSITIVO"]
            if ch.empty: continue
            ch["alianza"] = ch["agrupacion_nombre"].apply(alianza_for)
            # Totals
            for (cn, cargo, yr), v in ch.groupby(["circuito_n", "cargo_n", "year"])["votos_cantidad"].sum().items():
                tot[(cn, cargo, int(yr))] += int(v)
            # Por alianza
            chna = ch.dropna(subset=["alianza"])
            for (cn, cargo, yr, ali), v in chna.groupby(["circuito_n", "cargo_n", "year", "alianza"])["votos_cantidad"].sum().items():
                by_ali[(cn, cargo, int(yr), ali)] += int(v)
            n += len(ch)
        print(f"  procesado {f.name}: {n:,} filas positivas")
    return tot, by_ali


def aggregate_to_circuit(tot, by_ali) -> dict:
    out: dict[str, dict] = {}
    print(f"  {len(tot)} (circ,cargo,año) · {len(by_ali)} (+alianza)")
    for (cn, cargo, year, alianza), v in by_ali.items():
        t = tot.get((cn, cargo, year), 0)
        if not t: continue
        rec = out.setdefault(cn, {})
        rec[f"{cargo}_{year}_{alianza}_pct"] = round(v / t, 4)
    return out


def main() -> None:
    print(f"[geom] {GEOJSON.name}")
    g = gpd.read_file(GEOJSON)
    if g.crs and g.crs.to_epsg() != 4326:
        g = g.to_crs(4326)
    g["circuito_n"] = g["circuito"].apply(norm_circuito)
    g["geometry"] = g.geometry.simplify(0.0008, preserve_topology=True)
    g = g[~g.geometry.is_empty & g.geometry.notna()]
    web = g[["circuito", "circuito_n", "departamen", "indec_d", "geometry"]].copy()
    web.rename(columns={"circuito_n": "codigo_indec", "departamen": "municipio"}, inplace=True)
    out_geo = WEB / "pba_circuitos.geojson"
    web.to_file(out_geo, driver="GeoJSON")
    print(f"  -> {out_geo.name} ({len(web)} circuitos, {out_geo.stat().st_size/1024:.0f} KB)")

    # Procesar histórico (presidente + dip + sen) en chunks
    print("=== Presidente ===")
    tot, by_ali = process_csv_set_chunked(CSV_PRES)
    out = aggregate_to_circuit(tot, by_ali)
    print("=== Diputados ===")
    tot, by_ali = process_csv_set_chunked(CSV_DIP)
    for k, v in aggregate_to_circuit(tot, by_ali).items():
        out.setdefault(k, {}).update(v)
    print("=== Senadores ===")
    tot, by_ali = process_csv_set_chunked(CSV_SEN)
    for k, v in aggregate_to_circuit(tot, by_ali).items():
        out.setdefault(k, {}).update(v)

    # Para Pres último (2023): añadir _last conveniencias para choropleth
    for cn, rec in out.items():
        for ali in ALIANZAS_HIST:
            v = rec.get(f"pres_2023_{ali}_pct")
            if v is not None:
                rec[f"{ali}_pct"] = v

    out_path = WEB / "pba_circuitos_historico.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({len(out)} circuitos, {out_path.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
