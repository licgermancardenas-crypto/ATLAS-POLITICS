"""ETL PBA — datos por municipio desde catalogo.datos.gba.gob.ar.

Toma:
- Transferencias mensuales del gobierno provincial a cada municipio
  (último año disponible, total anualizado)
- Población proyectada (último año disponible, 2025)
- Calcula transferencias per cápita

Output: data/web/pba_municipal.json (135 municipios)
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
RAW = PROJECT / "data" / "raw" / "pba"
RAW.mkdir(parents=True, exist_ok=True)

URL_TRANSF = "https://catalogo.datos.gba.gob.ar/dataset/96ee21b4-b116-4b83-9228-ba664af1b480/resource/d13acdb6-bd59-4c09-b954-8f3258a65e8a/download/transferencias-municipios-012010_032026.csv"
URL_POB = "https://catalogo.datos.gba.gob.ar/dataset/cc6d2010-6f67-4c98-8d89-af39703f46fb/resource/09d57241-8437-454a-b4ff-88330d65d60e/download/proyecciones-poblacion-2010_2025.csv"
URL_CAMAS = "https://catalogo.datos.gba.gob.ar/dataset/b60257fb-a914-4a27-a54c-6f2a91b3154d/resource/f89ab59e-3d2f-4e33-b8e8-bf52c3a8d108/download/camas-criticas-2018_2023.csv"


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


def main() -> None:
    pob_csv = download(URL_POB, "pba_poblacion.csv")
    pob = pd.read_csv(pob_csv, dtype=str)
    pob = pob[pob["municipio_id"].astype(str).str.len() == 5].copy()
    pob["pob_2025"] = pd.to_numeric(pob["2025"], errors="coerce")
    pob["pob_2010"] = pd.to_numeric(pob["2010"], errors="coerce")
    pob["pob_crecimiento_pct"] = ((pob["pob_2025"] / pob["pob_2010"] - 1) * 100).round(1)
    pob = pob.set_index("municipio_id")

    transf_csv = download(URL_TRANSF, "pba_transferencias.csv")
    tdf = pd.read_csv(transf_csv, dtype=str)
    tdf["anio"] = pd.to_numeric(tdf["anio"], errors="coerce")
    tdf["mes"] = pd.to_numeric(tdf["mes"], errors="coerce")
    tdf["monto"] = pd.to_numeric(tdf["monto"], errors="coerce").fillna(0)
    last_year = int(tdf["anio"].max())
    print(f"Año más reciente transferencias: {last_year}")
    last_full_year = last_year - 1 if tdf[tdf["anio"] == last_year]["mes"].nunique() < 12 else last_year
    print(f"Usando año completo: {last_full_year}")

    by_muni = (tdf[tdf["anio"] == last_full_year]
               .groupby(["municipio_id", "municipio_nombre"])["monto"]
               .sum().reset_index())

    out: dict[str, dict] = {}
    for _, r in by_muni.iterrows():
        code = str(r["municipio_id"]).zfill(5)
        if not code.startswith("06") or code == "06000":
            continue
        rec = {
            "transferencias_pba_total": round(float(r["monto"]), 0),
            "transferencias_pba_year": last_full_year,
            "transferencias_pba_municipio": r["municipio_nombre"],
        }
        if code in pob.index:
            p = pob.loc[code]
            pob_v = p["pob_2025"]
            if pd.notna(pob_v) and pob_v > 0:
                rec["poblacion_2025"] = int(pob_v)
                rec["transferencias_pba_per_capita"] = round(float(r["monto"]) / pob_v, 2)
            if pd.notna(p["pob_crecimiento_pct"]):
                rec["pob_crecimiento_pct_2010_2025"] = float(p["pob_crecimiento_pct"])
        out[code] = rec

    # Camas críticas por municipio (último año disponible)
    camas_csv = download(URL_CAMAS, "pba_camas_criticas.csv")
    cdf = pd.read_csv(camas_csv, dtype=str)
    cdf["anio"] = pd.to_numeric(cdf["anio"], errors="coerce")
    cdf["camas_disponibles"] = pd.to_numeric(cdf["camas_disponibles"], errors="coerce").fillna(0)
    last_y = int(cdf["anio"].max())
    camas_sum = (cdf[cdf["anio"] == last_y]
                  .groupby("municipio_id")["camas_disponibles"].sum())
    for code, total in camas_sum.items():
        code = str(code).zfill(5)
        if code in out:
            out[code]["camas_criticas"] = int(total)
            out[code]["camas_criticas_year"] = last_y
            if out[code].get("poblacion_2025"):
                out[code]["camas_criticas_por_100k_hab"] = round(int(total) / out[code]["poblacion_2025"] * 100_000, 2)

    out_path = WEB / "pba_municipal.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({len(out)} municipios, {out_path.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
