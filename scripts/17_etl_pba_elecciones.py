"""ETL Elecciones nacionales en PBA por municipio — serie histórica 2011-2023.

Fuente: catalogo.datos.gba.gob.ar (Resultados Electorales Nacionales)
Provincial dataset que detalla Pres + Dip + Sen 2011-2023 por sección
(= partido/municipio) y circuito electoral.

Outputs por municipio PBA (codigo INDEC 06XXX):
    pba_pres_serie_pj    — [[year, pct], ...] FpV/FdT/UP
    pba_pres_serie_jxc   — Cambiemos/JxC
    pba_pres_serie_lla   — LLA (2021+)
    pba_pres_last_year
    pba_pres_<year>_pj_pct / _jxc_pct / _lla_pct para últimos 4 años

Salida: data/web/pba_elecciones_municipal.json
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT = Path(r"C:/Users/corra/Desktop/ATLAS politics")
WEB = PROJECT / "data" / "web"
RAW = PROJECT / "data" / "raw" / "elecciones"

CSV_FILES = [
    RAW / "resultados-electorales-presidente-2011_2015.csv",
    RAW / "resultados-electorales-presidente-2019_2023.csv",
]

ALIANZAS_HIST = {
    "pj": [
        "FRENTE PARA LA VICTORIA", "FRENTE PARA LA VICTORIA",  # 2011/2015
        "UNIDAD CIUDADANA", "FRENTE JUSTICIALISTA",            # 2017 (no aquí)
        "FRENTE DE TODOS",                                      # 2019
        "UNION POR LA PATRIA", "UNIÓN POR LA PATRIA",          # 2023
        "ALIANZA FRENTE PARA LA VICTORIA",                     # 2011 prefijo Alianza
    ],
    "jxc": [
        "PROPUESTA REPUBLICANA",                                # 2011 (PRO-Macri solo)
        "CAMBIEMOS",                                            # 2015
        "JUNTOS POR EL CAMBIO",                                 # 2019, 2023
        "ALIANZA CAMBIEMOS",
    ],
    "lla": [
        "LA LIBERTAD AVANZA",                                   # 2023
    ],
    "una_massa": [
        "UNIDOS POR UNA NUEVA ALTERNATIVA",                     # 2015 Massa
        "ALIANZA UNIDOS POR UNA NUEVA ALTERNATIVA",
    ],
    "hacemos": [
        "HACEMOS POR NUESTRO PAIS", "HACEMOS POR NUESTRO PAÍS", # 2023
        "CONSENSO FEDERAL",                                     # 2019 Lavagna
    ],
    "izq": [
        "FRENTE DE IZQUIERDA",
        "ALIANZA FRENTE DE IZQUIERDA",
    ],
}


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")


def alianza_for(nombre: str) -> str | None:
    n = (nombre or "").upper().strip()
    if not n: return None
    for key, aliases in ALIANZAS_HIST.items():
        for a in aliases:
            if a in n: return key
    return None


def load_pba_codes() -> dict[str, str]:
    """Map slug(nombre municipio PBA) → codigo_indec 5-dig."""
    deptos = json.loads((WEB / "departamentos.geojson").read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for f in deptos["features"]:
        p = f["properties"]
        code = str(p.get("codigo_indec", "")).zfill(5)
        if not code.startswith("06"): continue
        nm = p.get("nombre", "")
        nm = re.sub(r"^Partido de ", "", nm, flags=re.IGNORECASE)
        out[slug(nm)] = code
    return out


def main() -> None:
    code_lookup = load_pba_codes()
    print(f"PBA municipios: {len(code_lookup)}")

    dfs = []
    for f in CSV_FILES:
        if not f.exists(): continue
        d = pd.read_csv(f, dtype=str, low_memory=False, encoding="utf-8-sig")
        # Normalizar nombre de la col año
        col_year = next((c for c in d.columns if c.strip().lower() in ("año", "ano")), None)
        if col_year and col_year != "year":
            d = d.rename(columns={col_year: "year"})
        dfs.append(d)
    df = pd.concat(dfs, ignore_index=True)
    print(f"rows: {len(df):,}")
    df["votos_cantidad"] = pd.to_numeric(df["votos_cantidad"], errors="coerce").fillna(0).astype("int64")
    df["year"] = pd.to_numeric(df["year"], errors="coerce").astype("Int64")
    df["seccion_s"] = df["seccion_nombre"].astype(str).apply(slug)
    df["alianza"] = df["agrupacion_nombre"].apply(alianza_for)

    # Agregar por (year, seccion) — totales y por alianza
    out: dict[str, dict] = {}
    # Total positivos por sección+año (para denominator)
    pos = df[df["votos_tipo"] == "POSITIVO"]
    tot_pos = pos.groupby(["year", "seccion_s"])["votos_cantidad"].sum()
    alianza_sum = (pos.dropna(subset=["alianza"])
                      .groupby(["year", "seccion_s", "alianza"])["votos_cantidad"]
                      .sum())

    # Construir series por sección
    seccion_grouped: dict[str, dict] = {}
    for (year, seccion_s, alianza), val in alianza_sum.items():
        if pd.isna(year): continue
        year = int(year)
        denom = tot_pos.get((year, seccion_s), 0)
        if not denom: continue
        pct = round(val / denom * 100, 1)
        seccion_grouped.setdefault(seccion_s, {}).setdefault(alianza, []).append([year, pct])

    matched = 0
    for seccion_s, by_alianza in seccion_grouped.items():
        code = code_lookup.get(seccion_s)
        if not code:
            continue
        matched += 1
        rec: dict = {}
        last_year = None
        for alianza, serie in by_alianza.items():
            serie = sorted(serie)
            rec[f"pba_pres_serie_{alianza}"] = serie
            last = serie[-1]
            rec[f"pba_pres_{alianza}_last_pct"] = last[1]
            if last_year is None or last[0] > last_year: last_year = last[0]
        rec["pba_pres_last_year"] = last_year
        out[code] = rec

    print(f"Municipios matcheados: {matched}/{len(seccion_grouped)}")
    out_path = WEB / "pba_elecciones_municipal.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({len(out)} muni, {out_path.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
