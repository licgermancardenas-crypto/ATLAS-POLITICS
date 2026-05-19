"""ETL Circuitos electorales PBA — geometría + resultados por circuito.

Fuente geom: catalogo.datos.gba.gob.ar (1.150 circuitos)
Fuente votos: ya descargado en data/raw/elecciones/resultados-*.csv

Outputs:
    data/web/pba_circuitos.geojson         — geom simplificada para web
    data/web/elecciones_pba_circuitos.json — % coaliciones último Pres (2023 Gen)
"""
from __future__ import annotations

import json
import os
import re
import sys
import unicodedata
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

ALIANZAS_2023 = {
    "lla":     ["LA LIBERTAD AVANZA"],
    "pj":      ["UNION POR LA PATRIA", "UNIÓN POR LA PATRIA"],
    "jxc":     ["JUNTOS POR EL CAMBIO"],
    "hacemos": ["HACEMOS POR NUESTRO PAIS", "HACEMOS POR NUESTRO PAÍS"],
    "izq":     ["FRENTE DE IZQUIERDA Y DE TRABAJADORES - UNIDAD"],
}


def alianza_for(nombre: str) -> str | None:
    n = (nombre or "").upper().strip()
    if not n: return None
    for key, aliases in ALIANZAS_2023.items():
        for a in aliases:
            if a in n: return key
    return None


def norm_circuito(s: str) -> str:
    """Normaliza '0063', '00156B', '156' → '156' (sin padding ni letras)."""
    if s is None: return ""
    s = str(s).strip()
    m = re.match(r"^0*(\d+)([A-Z]*)?$", s)
    if m:
        return m.group(1) + (m.group(2) or "")
    return s


def main() -> None:
    print(f"[geom] {GEOJSON.name}")
    g = gpd.read_file(GEOJSON)
    print(f"  {len(g)} circuitos · CRS={g.crs}")
    if g.crs and g.crs.to_epsg() != 4326:
        g = g.to_crs(4326)
    g["circuito_n"] = g["circuito"].apply(norm_circuito)
    g["municipio"] = g["departamen"]
    # Quedarnos con cols clave + simplificar
    g["geometry"] = g.geometry.simplify(0.0008, preserve_topology=True)
    g = g[~g.geometry.is_empty & g.geometry.notna()]
    web_cols = ["circuito", "circuito_n", "municipio", "indec_d"]
    web = g[web_cols + ["geometry"]].copy()
    web.rename(columns={"circuito_n": "codigo_indec"}, inplace=True)  # uso codigo_indec convencional
    out_geo = WEB / "pba_circuitos.geojson"
    web.to_file(out_geo, driver="GeoJSON")
    print(f"  -> {out_geo.name} ({len(web)} circuitos, {out_geo.stat().st_size/1024:.0f} KB)")

    # Resultados por circuito (Pres 2023 Generales)
    csv = RAW / "elecciones" / "resultados-electorales-presidente-2019_2023.csv"
    if not csv.exists():
        print("[SKIP] CSV de elecciones no encontrado")
        return
    print(f"[votos] {csv.name}")
    df = pd.read_csv(csv, dtype=str, low_memory=False, encoding="utf-8-sig")
    col_year = next((c for c in df.columns if c.strip().lower() in ("año", "ano")), None)
    if col_year and col_year != "year":
        df = df.rename(columns={col_year: "year"})
    df = df[df["year"] == "2023"]
    df["votos_cantidad"] = pd.to_numeric(df["votos_cantidad"], errors="coerce").fillna(0).astype("int64")
    df["circuito_n"] = df["circuito_id"].apply(norm_circuito)
    df["alianza"] = df["agrupacion_nombre"].apply(alianza_for)
    pos = df[df["votos_tipo"] == "POSITIVO"]

    # Total positivos por circuito
    tot = pos.groupby("circuito_n")["votos_cantidad"].sum()
    # Por alianza
    by_ali = (pos.dropna(subset=["alianza"])
                 .groupby(["circuito_n", "alianza"])["votos_cantidad"].sum().unstack(fill_value=0))

    out: dict[str, dict] = {}
    for cn, total in tot.items():
        if total < 1:
            continue
        rec: dict = {"votos_positivos": int(total)}
        if cn in by_ali.index:
            for alianza in ALIANZAS_2023:
                v = int(by_ali.loc[cn].get(alianza, 0))
                rec[f"{alianza}_pct"] = round(v / total, 4) if total else None
        out[cn] = rec

    out_path = WEB / "elecciones_pba_circuitos.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"  -> {out_path.name} ({len(out)} circuitos con datos, {out_path.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
