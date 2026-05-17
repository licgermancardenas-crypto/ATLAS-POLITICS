"""ETL Censo 2022 INDEC — indicadores por provincia y departamento.

Lee los shapefiles `Codgeo_Pais_x_prov_datos.zip` y `Codgeo_Pais_x_dpto_con_datos.zip`
del INDEC y produce JSON con indicadores keyed por `codigo_indec`, listos para
joinear en el frontend con las geometrías de ATLAS politics.

Variables del Censo 2022 incluidas (todas conteos absolutos):
    personas, mujeres, varones, hogares, viv_part, viv_part_h

Salidas:
    data/web/indicadores_provincias.json
    data/web/indicadores_departamentos.json
    catalogs/indicadores.json   (metadata + descripción de variables)
"""
from __future__ import annotations

import json
import os
import sys
import zipfile
from pathlib import Path

os.environ.setdefault("OGR_GEOJSON_MAX_OBJ_SIZE", "0")

import geopandas as gpd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT = Path(r"C:/Users/corra/Desktop/ATLAS politics")
RAW_INDEC = Path(r"C:/Users/corra/Downloads/Unidades geoEstadisticas - INDEC")
WEB = PROJECT / "data" / "web"
TMP = PROJECT / "data" / "raw" / "_unzipped"

WEB.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)

VAR_LABELS = {
    "personas":   "Población total",
    "mujeres":    "Mujeres",
    "varones":    "Varones",
    "hogares":    "Hogares",
    "viv_part":   "Viviendas particulares",
    "viv_part_h": "Viviendas particulares habitadas",
}


def unzip(src: Path, dst: Path) -> Path:
    dst.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(src) as zf:
        zf.extractall(dst)
    return next(dst.rglob("*.shp"))


def build(level: str, zip_name: str, key_col: str, key_len: int) -> dict:
    print(f"[{level}]")
    shp = unzip(RAW_INDEC / zip_name, TMP / level)
    gdf = gpd.read_file(shp)
    # Normalizar claves
    gdf[key_col] = gdf[key_col].astype(str).str.zfill(key_len)

    indicadores: dict[str, dict] = {}
    for _, r in gdf.iterrows():
        code = r[key_col]
        d = {v: int(r[v]) for v in VAR_LABELS if v in gdf.columns}
        # Indicadores derivados
        if d.get("personas") and d.get("viv_part_h"):
            d["personas_por_vivienda"] = round(d["personas"] / d["viv_part_h"], 2)
        if d.get("mujeres") and d.get("varones"):
            d["idx_masculinidad"] = round(d["varones"] / d["mujeres"] * 100, 1)
        if d.get("personas") and d.get("hogares"):
            d["personas_por_hogar"] = round(d["personas"] / d["hogares"], 2)
        indicadores[code] = d

    out = WEB / f"indicadores_{level}.json"
    out.write_text(
        json.dumps(indicadores, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"  -> {out.name}  ({len(indicadores)} entidades, {out.stat().st_size/1024:.0f} KB)")
    return indicadores


def write_meta(prov: dict, dpto: dict) -> None:
    # Totales país
    def sumvar(d, v):
        return sum(x.get(v, 0) for x in d.values())

    totales = {v: sumvar(prov, v) for v in VAR_LABELS}

    meta = {
        "fuente": "Censo Nacional de Población, Hogares y Viviendas 2022 (INDEC)",
        "url": "https://www.indec.gob.ar/indec/web/Nivel4-Tema-2-41-165",
        "fecha": "2022",
        "totales_pais": totales,
        "variables": [
            {"nombre": k, "label": v, "tipo": "conteo"} for k, v in VAR_LABELS.items()
        ] + [
            {"nombre": "personas_por_vivienda", "label": "Personas por vivienda habitada", "tipo": "ratio"},
            {"nombre": "personas_por_hogar",   "label": "Personas por hogar",              "tipo": "ratio"},
            {"nombre": "idx_masculinidad",     "label": "Índice de masculinidad (varones/100 mujeres)", "tipo": "indice"},
        ],
        "niveles": {
            "provincias":    {"file": "data/indicadores_provincias.json",    "n": len(prov)},
            "departamentos": {"file": "data/indicadores_departamentos.json", "n": len(dpto)},
        },
    }
    out = PROJECT / "catalogs" / "indicadores.json"
    out.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nCatálogo: {out}")


if __name__ == "__main__":
    prov = build("provincias",    "Codgeo_Pais_x_prov_datos.zip",    "link", 2)
    dpto = build("departamentos", "Codgeo_Pais_x_dpto_con_datos.zip", "link", 5)
    write_meta(prov, dpto)
    print("\nETL censo completo.")
