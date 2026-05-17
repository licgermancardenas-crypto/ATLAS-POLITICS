"""ETL Localidades — Censo 2022 INDEC.

Procesa `Codgeo_Pais_x_loc_con_datos.zip` (3.526 localidades, geom: Point).
Cada feature tiene: provincia, departamento, nombre, tipo, lat/lon + variables
censales (personas, mujeres, varones, hogares, viviendas).

Salidas:
    data/processed/localidades.geojson          (centroides + censo, no simplificado)
    data/web/localidades.geojson                (versión web: filtra columnas)
    data/web/indicadores_localidades.json       (keyed por link 8-char)

Como son puntos no necesitamos simplificación, pero sí filtramos columnas
para que el geojson sea liviano en el frontend.
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
PROCESSED = PROJECT / "data" / "processed"
WEB = PROJECT / "data" / "web"
TMP = PROJECT / "data" / "raw" / "_unzipped" / "pxloc"

for d in (PROCESSED, WEB, TMP):
    d.mkdir(parents=True, exist_ok=True)

VAR_LABELS = {
    "personas":   "Población total",
    "mujeres":    "Mujeres",
    "varones":    "Varones",
    "hogares":    "Hogares",
    "viv_part":   "Viviendas particulares",
    "viv_part_h": "Viviendas particulares habitadas",
}


def main() -> None:
    src = RAW_INDEC / "Codgeo_Pais_x_loc_con_datos.zip"
    print(f"[localidades] {src.name}")
    with zipfile.ZipFile(src) as zf:
        zf.extractall(TMP)
    shp = next(TMP.rglob("*.shp"))
    gdf = gpd.read_file(shp)
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(4326)

    gdf["link"] = gdf["link"].astype(str).str.zfill(8)
    gdf["codigo_dpto"] = gdf["link"].str[:5]
    gdf["codigo_prov"] = gdf["link"].str[:2]

    # Renombres semánticos
    rename = {
        "link":       "codigo_indec",
        "localidad":  "nombre",
        "departamen": "departamento",
        "tiploc":     "tipo",
    }
    gdf = gdf.rename(columns=rename)

    # Limpiar nombres con encoding latín-1 mal aplicado
    for col in ("nombre", "provincia", "departamento", "tipo"):
        if col in gdf.columns:
            gdf[col] = (
                gdf[col]
                .astype(str)
                .str.encode("latin1", errors="ignore")
                .str.decode("utf-8", errors="ignore")
            )

    # Geojson web: solo cols clave (puntos son chicos pero menos es menos)
    web_cols = [
        "codigo_indec", "nombre", "tipo", "provincia", "departamento",
        "codigo_dpto", "codigo_prov", "personas", "geometry",
    ]
    web_gdf = gdf[[c for c in web_cols if c in gdf.columns]].copy()
    web_gdf = web_gdf[web_gdf.geometry.notna()]
    web_path = WEB / "localidades.geojson"
    web_gdf.to_file(web_path, driver="GeoJSON")
    print(f"  -> {web_path.name}    ({len(web_gdf)} features, {web_path.stat().st_size/1024:.0f} KB)")

    # Geojson processed (completo)
    full_path = PROCESSED / "localidades.geojson"
    gdf.to_file(full_path, driver="GeoJSON")
    print(f"  -> {full_path.name}  ({len(gdf)} features, {full_path.stat().st_size/1024:.0f} KB)")

    # Indicadores JSON
    indic: dict[str, dict] = {}
    for _, r in gdf.iterrows():
        code = r["codigo_indec"]
        d = {v: int(r[v]) for v in VAR_LABELS if v in gdf.columns and r[v] == r[v]}
        if d.get("personas") and d.get("viv_part_h"):
            d["personas_por_vivienda"] = round(d["personas"] / d["viv_part_h"], 2)
        if d.get("mujeres") and d.get("varones"):
            d["idx_masculinidad"] = round(d["varones"] / d["mujeres"] * 100, 1)
        indic[code] = d

    out = WEB / "indicadores_localidades.json"
    out.write_text(
        json.dumps(indic, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"  -> {out.name}  ({len(indic)} entidades, {out.stat().st_size/1024:.0f} KB)")

    # Actualizar catálogo geometrías
    cat_path = PROJECT / "catalogs" / "geometrias.json"
    catalog = json.loads(cat_path.read_text(encoding="utf-8")) if cat_path.exists() else []
    # quitar entrada previa si existe
    catalog = [c for c in catalog if c.get("name") != "localidades"]
    catalog.append({
        "name": "localidades",
        "file": "data/localidades.geojson",
        "features": len(web_gdf),
        "size_kb": round(web_path.stat().st_size / 1024),
        "properties": list(web_gdf.columns.drop("geometry")),
        "geom_type": "Point",
    })
    catalog.sort(key=lambda x: x["name"])
    cat_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nCatálogo actualizado: {cat_path}")
    print("ETL localidades completo.")


if __name__ == "__main__":
    main()
