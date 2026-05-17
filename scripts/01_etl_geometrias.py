"""ETL de geometrías base de Argentina para ATLAS politics.

Toma shapefiles del IGN, los reproyecta a WGS84 (EPSG:4326), normaliza
propiedades y genera dos versiones de cada capa:

* data/processed/<capa>.parquet  → precisión completa (análisis, no web)
* data/web/<capa>.geojson         → simplificado para frontend

Entrada (carpetas en C:/Users/corra/Downloads):
    - GeoEspacial Argentina/SHAPEFILE/{pais,provincia,departamento (1),
        municipio,gobiernoslocales_2022}.zip
    - POLIGONO GEOJSON/{departamento (1),municipio (1)}.geojson  (fallback)
    - Unidades geoEstadisticas - INDEC/Codgeo_Pais_x_*_con_datos.zip
        (centroides/joins futuros)
"""
from __future__ import annotations

import io
import json
import os
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

# Permitir geojsons gigantes (algunos archivos del IGN/PBA pesan >100MB)
os.environ.setdefault("OGR_GEOJSON_MAX_OBJ_SIZE", "0")

import geopandas as gpd

# Forzar UTF-8 en stdout para evitar UnicodeEncodeError en Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# -----------------------------------------------------------------------------
# Configuración
# -----------------------------------------------------------------------------
PROJECT = Path(r"C:/Users/corra/Desktop/ATLAS politics")
RAW_IGN = Path(r"C:/Users/corra/Downloads/GeoEspacial Argentina/SHAPEFILE")
RAW_POL = Path(r"C:/Users/corra/Downloads/POLIGONO GEOJSON")
RAW_INDEC = Path(r"C:/Users/corra/Downloads/Unidades geoEstadisticas - INDEC")

PROCESSED = PROJECT / "data" / "processed"
WEB = PROJECT / "data" / "web"
TMP = PROJECT / "data" / "raw" / "_unzipped"

for d in (PROCESSED, WEB, TMP):
    d.mkdir(parents=True, exist_ok=True)

# Tolerancia de simplificación en grados (~0.001 ≈ 100m en latitud media).
# Capas más detalladas usan menor tolerancia.
SIMPLIFY = {
    "pais":          0.01,
    "provincias":    0.005,
    "departamentos": 0.002,
    "municipios":    0.001,
}


# -----------------------------------------------------------------------------
# Utilidades
# -----------------------------------------------------------------------------
def slugify(text: str) -> str:
    if text is None:
        return ""
    text = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9]+", "_", text).strip("_").lower()
    return text


def unzip_shp(zip_path: Path, target: Path) -> Path:
    """Descomprime un zip y devuelve la ruta al .shp encontrado."""
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(target)
    shps = list(target.rglob("*.shp"))
    if not shps:
        raise FileNotFoundError(f"No se encontró .shp en {zip_path}")
    return shps[0]


def standardize(gdf: gpd.GeoDataFrame, mapping: dict[str, str]) -> gpd.GeoDataFrame:
    """Aplica un renombrado y filtra columnas clave.

    Cuando varias columnas origen mapean a un mismo destino (ej. fna/nam → nombre),
    se conserva solo la primera que aparezca y se descartan las demás.
    """
    keep: dict[str, str] = {}
    used_dst: set[str] = set()
    for src, dst in mapping.items():
        if src in gdf.columns and dst not in used_dst:
            keep[src] = dst
            used_dst.add(dst)
    gdf = gdf.rename(columns=keep)
    cols = list(keep.values()) + ["geometry"]
    # Eliminar duplicados (por si quedaron)
    cols = list(dict.fromkeys(cols))
    return gdf[[c for c in cols if c in gdf.columns]].copy()


def export(gdf: gpd.GeoDataFrame, name: str) -> None:
    """Exporta a parquet (full) y a geojson simplificado para web."""
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(4326)

    # GeoJSON completo (sin simplificar) en processed - para análisis
    full_path = PROCESSED / f"{name}.geojson"
    gdf.to_file(full_path, driver="GeoJSON")
    print(f"  -> {full_path.name}  ({len(gdf)} features, {full_path.stat().st_size/1024:.0f} KB)")

    # GeoJSON simplificado para web
    tol = SIMPLIFY.get(name, 0.001)
    web_gdf = gdf.copy()
    web_gdf["geometry"] = web_gdf.geometry.simplify(tol, preserve_topology=True)
    # Validar geometrías; descartar vacías
    web_gdf = web_gdf[~web_gdf.geometry.is_empty & web_gdf.geometry.notna()]

    web_path = WEB / f"{name}.geojson"
    web_gdf.to_file(web_path, driver="GeoJSON")
    print(f"  -> {web_path.name}    ({len(web_gdf)} features, {web_path.stat().st_size/1024:.0f} KB, tol={tol})")


# -----------------------------------------------------------------------------
# ETL por capa
# -----------------------------------------------------------------------------
def etl_pais() -> None:
    print("[pais]")
    shp = unzip_shp(RAW_IGN / "pais.zip", TMP / "pais")
    gdf = gpd.read_file(shp)
    print(f"  cols: {list(gdf.columns)}")
    gdf = standardize(gdf, {
        "fna": "nombre",
        "gna": "tipo",
        "nam": "nombre",
    })
    if "nombre" not in gdf.columns:
        gdf["nombre"] = "Argentina"
    export(gdf, "pais")


def etl_provincias() -> None:
    print("[provincias]")
    shp = unzip_shp(RAW_IGN / "provincia.zip", TMP / "provincia")
    gdf = gpd.read_file(shp)
    print(f"  cols: {list(gdf.columns)}")
    gdf = standardize(gdf, {
        "fna": "nombre",
        "nam": "nombre",
        "gna": "tipo",
        "in1": "codigo_indec",     # 2 dígitos
        "iso_a2": "iso_a2",
        "iso_nom": "iso_nombre",
    })
    if "codigo_indec" in gdf.columns:
        gdf["codigo_indec"] = gdf["codigo_indec"].astype(str).str.zfill(2)
    export(gdf, "provincias")


def etl_departamentos() -> None:
    print("[departamentos]")
    # Preferimos el geojson grande de POLIGONO GEOJSON (parece más completo)
    geo_full = RAW_POL / "departamento (1).geojson"
    if geo_full.exists():
        gdf = gpd.read_file(geo_full)
    else:
        shp = unzip_shp(RAW_IGN / "departamento (1).zip", TMP / "departamento")
        gdf = gpd.read_file(shp)
    print(f"  cols: {list(gdf.columns)}")
    gdf = standardize(gdf, {
        "fna": "nombre",
        "nam": "nombre",
        "gna": "tipo",
        "in1": "codigo_indec",     # 5 dígitos (prov+dpto)
        "fdc": "fuente",
        "sag": "provincia",
    })
    if "codigo_indec" in gdf.columns:
        gdf["codigo_indec"] = gdf["codigo_indec"].astype(str).str.zfill(5)
        # Derivar código de provincia (primeros 2 dígitos)
        gdf["codigo_provincia"] = gdf["codigo_indec"].str[:2]
    export(gdf, "departamentos")


def etl_municipios() -> None:
    print("[municipios]")
    geo_full = RAW_POL / "municipio (1).geojson"
    if geo_full.exists():
        gdf = gpd.read_file(geo_full)
    else:
        shp = unzip_shp(RAW_IGN / "municipio.zip", TMP / "municipio")
        gdf = gpd.read_file(shp)
    print(f"  cols: {list(gdf.columns)}")
    gdf = standardize(gdf, {
        "fna": "nombre",
        "nam": "nombre",
        "gna": "tipo",
        "in1": "codigo_indec",
        "sag": "provincia",
        "fdc": "fuente",
    })
    export(gdf, "municipios")


def etl_gobiernos_locales() -> None:
    """Capa unificada IGN 2022 (incluye municipios, comunas, comisiones de fomento, etc.)."""
    print("[gobiernos_locales]")
    shp = unzip_shp(RAW_IGN / "gobiernoslocales_2022.zip", TMP / "gobiernoslocales")
    gdf = gpd.read_file(shp)
    print(f"  cols: {list(gdf.columns)}")
    gdf = standardize(gdf, {
        "fna": "nombre",
        "nam": "nombre",
        "gna": "tipo",
        "in1": "codigo_indec",
        "sag": "provincia",
        "categoria": "categoria",
        "cat_loc": "categoria",
    })
    export(gdf, "gobiernos_locales")


# -----------------------------------------------------------------------------
# Catálogo
# -----------------------------------------------------------------------------
def write_catalog() -> None:
    catalog = []
    for path in sorted(WEB.glob("*.geojson")):
        size = path.stat().st_size
        # Contar features sin cargar todo
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        catalog.append({
            "name": path.stem,
            "file": f"data/{path.name}",
            "features": len(data.get("features", [])),
            "size_kb": round(size / 1024),
            "properties": list(data["features"][0]["properties"].keys()) if data.get("features") else [],
        })

    out = PROJECT / "catalogs" / "geometrias.json"
    out.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nCatálogo: {out}")


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    steps = [
        ("pais", etl_pais),
        ("provincias", etl_provincias),
        ("departamentos", etl_departamentos),
        ("municipios", etl_municipios),
        ("gobiernos_locales", etl_gobiernos_locales),
    ]
    for label, fn in steps:
        try:
            fn()
        except Exception as e:
            print(f"  [ERROR] {label}: {type(e).__name__}: {e}")

    write_catalog()
    print("\nETL geometrías completo.")
