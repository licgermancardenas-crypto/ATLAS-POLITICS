"""ETL Radios censales — Censo 2022 INDEC.

Procesa los 24 zips `Codgeo_<provincia>_con_datos.zip` con polígonos de radios.
Por provincia genera UN geojson simplificado (carga diferida desde frontend
cuando el zoom entra a la provincia) + un JSON de indicadores keyed por LINK.

Salidas:
    data/web/radios/<codigo_prov>.geojson        — 24 archivos, ~9 KB-10 MB c/u
    data/web/indicadores_radios.json             — todos los radios en un blob
    catalogs/radios.json                          — índice (provincia → archivo)
"""
from __future__ import annotations

import json
import os
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

os.environ.setdefault("OGR_GEOJSON_MAX_OBJ_SIZE", "0")

import geopandas as gpd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT = Path(r"C:/Users/corra/Desktop/ATLAS politics")
RAW_INDEC = Path(r"C:/Users/corra/Downloads/Unidades geoEstadisticas - INDEC")
WEB = PROJECT / "data" / "web"
WEB_RADIOS = WEB / "radios"
TMP = PROJECT / "data" / "raw" / "_unzipped" / "radios"

for d in (WEB_RADIOS, TMP):
    d.mkdir(parents=True, exist_ok=True)

# Tolerancia de simplificación (~30m a latitud media)
SIMPLIFY_TOL = 0.0003

# Mapeo de zip a código provincia INDEC
PROVINCIAS = {
    "Codgeo_Buenos_Aires_con_datos.zip":     "06",
    "Codgeo_CABA_con_datos (1).zip":         "02",
    "Codgeo_Catamarca_con_datos.zip":        "10",
    "Codgeo_Chaco_con_datos.zip":            "22",
    "Codgeo_Chubut_con_datos.zip":           "26",
    "Codgeo_Cordoba_con_datos.zip":          "14",
    "Codgeo_Corrientes_con_datos.zip":       "18",
    "Codgeo_Entre_Rios_con_datos.zip":       "30",
    "Codgeo_Formosa_con_datos.zip":          "34",
    "Codgeo_Jujuy_con_datos.zip":            "38",
    "Codgeo_La_Pampa_con_datos.zip":         "42",
    "Codgeo_Misiones_con_datos (2).zip":     "54",
    "Codgeo_Neuquen_con_datos (1).zip":      "58",
    "Codgeo_Rio_Negro_con_datos.zip":        "62",
    "Codgeo_Salta_con_datos.zip":            "66",
    "Codgeo_San_Juan_con_datos.zip":         "70",
    "Codgeo_San_Luis_con_datos.zip":         "74",
    "Codgeo_Santa_Cruz_con_datos.zip":       "78",
    "Codgeo_Santa_Fe_con_datos.zip":         "82",
    "Codgeo_Santiago_del_Estero_con_datos.zip": "86",
    "Codgeo_Tierra_del_Fuego_con_datos.zip": "94",
    "Codgeo_Tucuman_con_datos.zip":          "90",
}
# La Rioja, Mendoza, San Juan, San Luis, La Pampa, Río Negro… verifiquemos faltantes
FALTANTES_PROBABLES = {"La Rioja": "46", "Mendoza": "50"}

VAR_LABELS = {
    "TOT_POB":    "personas",
    "VARONES":    "varones",
    "MUJERES":    "mujeres",
    "HOGARES":    "hogares",
    "VIV_PART":   "viv_part",
    "VIV_PART_H": "viv_part_h",
}


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def process_prov(zip_name: str, cod_prov: str) -> dict:
    src = RAW_INDEC / zip_name
    if not src.exists():
        print(f"  [SKIP] {zip_name} no existe")
        return {}
    out_dir = TMP / slugify(zip_name.replace(".zip", ""))
    out_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(src) as zf:
        zf.extractall(out_dir)
    shp = next(out_dir.rglob("*.shp"))

    g = gpd.read_file(shp)
    if g.crs and g.crs.to_epsg() != 4326:
        g = g.to_crs(4326)

    # Normalizar nombres de columnas a minúsculas para tener un schema común
    g.columns = [c if c == "geometry" else c.upper() for c in g.columns]

    # LINK puede venir en columna LINK o componerse de PROV+DEPTO+FRAC+RADIO
    if "LINK" not in g.columns:
        g["LINK"] = (
            g["PROV"].astype(str).str.zfill(2)
            + g["DEPTO"].astype(str).str.zfill(3)
            + g["FRAC"].astype(str).str.zfill(2)
            + g["RADIO"].astype(str).str.zfill(2)
        )
    g["LINK"] = g["LINK"].astype(str).str.zfill(9)

    # Simplificar geometría
    g = g[~g.geometry.is_empty & g.geometry.notna()].copy()
    g["geometry"] = g.geometry.simplify(SIMPLIFY_TOL, preserve_topology=True)
    g = g[~g.geometry.is_empty & g.geometry.notna()]

    # Filtrar columnas para el geojson web
    web_cols = ["LINK", "PROV", "DEPTO", "FRAC", "RADIO", "TIPO"]
    web_cols = [c for c in web_cols if c in g.columns]
    web = g[web_cols + ["geometry"]].copy()
    web = web.rename(columns={c: c.lower() for c in web_cols})
    web = web.rename(columns={"link": "codigo_indec"})

    out_path = WEB_RADIOS / f"{cod_prov}.geojson"
    web.to_file(out_path, driver="GeoJSON")
    size_kb = out_path.stat().st_size / 1024
    print(f"  [{cod_prov}] {zip_name[:35]:<35}  {len(web):>5} radios  →  {size_kb:>7.0f} KB")

    # Indicadores (sin geometría, en blob global)
    indic = {}
    for _, r in g.iterrows():
        d = {}
        for src_col, dst in VAR_LABELS.items():
            if src_col in g.columns and r[src_col] == r[src_col]:
                d[dst] = int(r[src_col])
        if d.get("personas") and d.get("viv_part_h"):
            d["personas_por_vivienda"] = round(d["personas"] / d["viv_part_h"], 2)
        if d.get("mujeres") and d.get("varones"):
            d["idx_masculinidad"] = round(d["varones"] / d["mujeres"] * 100, 1)
        indic[r["LINK"]] = d
    return indic


def main() -> None:
    print("[radios] procesando 24 provincias...")
    indic_global: dict[str, dict] = {}
    sumario = []
    for zip_name, cod in PROVINCIAS.items():
        try:
            ind = process_prov(zip_name, cod)
            indic_global.update(ind)
            sumario.append({
                "codigo_prov": cod,
                "zip": zip_name,
                "file": f"data/radios/{cod}.geojson",
                "radios": len(ind),
            })
        except Exception as e:
            print(f"  [ERROR {cod}] {type(e).__name__}: {e}")

    print(f"\nFaltantes esperados (sin zip detectado): {list(FALTANTES_PROBABLES.keys())}")

    # Indicadores global
    out_indic = WEB / "indicadores_radios.json"
    out_indic.write_text(
        json.dumps(indic_global, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"\nindicadores_radios.json:  {len(indic_global)} radios, {out_indic.stat().st_size/1024:.0f} KB")

    # Catálogo radios
    cat_path = PROJECT / "catalogs" / "radios.json"
    cat_path.write_text(
        json.dumps({"radios_por_provincia": sumario, "total": len(indic_global)},
                   ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Catálogo: {cat_path}")
    print("\nETL radios completo.")


if __name__ == "__main__":
    main()
