"""ETL Comercio exterior — importaciones + exportaciones nacionales por destino.

Fuentes: SSPM Min. Economía
Output: data/web/comercio_exterior.json (estructura nacional, no provincial)
    año, total_expo_musd, total_impo_musd, saldo_musd
    top_destinos_expo, top_origenes_impo, top_saldos
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
RAW = PROJECT / "data" / "raw" / "economia"
RAW.mkdir(parents=True, exist_ok=True)

URL_IMPO = "https://infra.datos.gob.ar/catalog/sspm/dataset/78/distribution/78.1/download/importaciones-por-paises-regiones-anual.csv"


def download(url, name):
    p = RAW / name
    if not p.exists():
        r = requests.get(url, timeout=180, verify=False)
        r.raise_for_status()
        p.write_bytes(r.content)
    return p


def parse_country_cols(df, prefix):
    """Lista cols con prefijo (excluyendo agregados regionales)."""
    excludes = ("total", "aladi", "mercosur", "_ue", "_nafta", "asia", "africa", "magreb", "asean", "lejano")
    return [c for c in df.columns
            if c.startswith(prefix) and not any(ex in c for ex in excludes)]


def main() -> None:
    impo = pd.read_csv(download(URL_IMPO, "impo_pais.csv"), parse_dates=["indice_tiempo"])
    expo_path = RAW / "exp_pais_destino.csv"
    if not expo_path.exists():
        print("Falta exp_pais_destino.csv (correr 16_etl_extras.py primero)")
        return
    expo = pd.read_csv(expo_path, parse_dates=["indice_tiempo"])

    # Último año común
    year_impo = impo["indice_tiempo"].dt.year.max()
    year_expo = expo["indice_tiempo"].dt.year.max()
    year = min(year_impo, year_expo)
    print(f"Año análisis: {year}")

    impo_last = impo[impo["indice_tiempo"].dt.year == year].iloc[-1]
    expo_last = expo[expo["indice_tiempo"].dt.year == year].iloc[-1]

    impo_cols = parse_country_cols(impo, "ica_importaciones_")
    # Mapeo país → impo + expo
    saldos = []
    for col in impo_cols:
        pais = col.replace("ica_importaciones_", "")
        if pais == "total": continue
        impo_v = float(impo_last.get(col, 0))
        # Match expo col: prov_pais o solo pais
        # expo CSV tiene cols como pba_brasil, cba_brasil, ... y total
        # Usamos columnas que terminan con _pais sin prov prefix
        expo_total = 0
        for ec in expo.columns:
            if ec == "indice_tiempo": continue
            if ec.endswith(f"_{pais}") and not ec.startswith("total"):
                v = expo_last.get(ec, 0)
                if pd.notna(v): expo_total += float(v)
        if impo_v <= 0 and expo_total <= 0: continue
        saldos.append({
            "pais": pais,
            "expo_musd": round(expo_total, 1),
            "impo_musd": round(impo_v, 1),
            "saldo_musd": round(expo_total - impo_v, 1),
        })

    saldos.sort(key=lambda x: x["impo_musd"], reverse=True)
    total_impo = sum(s["impo_musd"] for s in saldos)
    total_expo = sum(s["expo_musd"] for s in saldos)

    out = {
        "year": int(year),
        "total_expo_musd": round(total_expo, 0),
        "total_impo_musd": round(total_impo, 0),
        "saldo_total_musd": round(total_expo - total_impo, 0),
        "top_impo": saldos[:10],
        "top_superavit": sorted(saldos, key=lambda x: x["saldo_musd"], reverse=True)[:5],
        "top_deficit": sorted(saldos, key=lambda x: x["saldo_musd"])[:5],
    }
    out_path = WEB / "comercio_exterior.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({out_path.stat().st_size/1024:.0f} KB)")
    print(f"   Expo {total_expo/1000:.1f}B · Impo {total_impo/1000:.1f}B · Saldo {(total_expo-total_impo)/1000:.1f}B")


if __name__ == "__main__":
    main()
