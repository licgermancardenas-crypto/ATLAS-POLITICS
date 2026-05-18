"""ETL Índice de Precios al Consumidor (IPC) — INDEC, base diciembre 2016.

INDEC publica IPC mensual por 6 regiones (GBA, Pampeana, NEA, NOA, Cuyo,
Patagonia). Mapeamos cada provincia a su región y exponemos:

    ipc_region              — nombre de la región INDEC
    ipc_nivel               — último índice mensual (base dic-2016 = 100)
    ipc_var_mensual         — variación % vs mes anterior
    ipc_var_interanual      — variación % vs hace 12 meses
    ipc_serie_12m           — últimos 12 valores [{fecha, valor}, ...]
    ipc_serie_var_12m       — últimas 12 variaciones mensuales

Salidas:
    data/web/ipc_provincia.json
    data/web/ipc_nacional.json   (para panel de tabla / serie)
"""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import pandas as pd
import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT = Path(r"C:/Users/corra/Desktop/ATLAS politics")
WEB = PROJECT / "data" / "web"
RAW = PROJECT / "data" / "raw" / "economia"
RAW.mkdir(parents=True, exist_ok=True)

# Nivel general mensual por región (un valor por mes×región)
URL_IPC_GEN = ("https://infra.datos.gob.ar/catalog/sspm/dataset/145/distribution/145.3/"
               "download/indice-precios-al-consumidor-nivel-general-base-diciembre-2016-mensual.csv")

REGIONES = ["nacional", "gba", "pampeana", "nea", "noa", "cuyo", "patagonia"]

# Asignación provincia → región
PROV_TO_REGION = {
    "02": "gba",          # CABA
    "06": "pampeana",     # BsAs (asignamos a pampeana: cobra mayoría territorial)
    "10": "noa",          # Catamarca
    "14": "pampeana",     # Córdoba
    "18": "nea",          # Corrientes
    "22": "nea",          # Chaco
    "26": "patagonia",    # Chubut
    "30": "pampeana",     # Entre Ríos
    "34": "nea",          # Formosa
    "38": "noa",          # Jujuy
    "42": "pampeana",     # La Pampa
    "46": "noa",          # La Rioja
    "50": "cuyo",         # Mendoza
    "54": "nea",          # Misiones
    "58": "patagonia",    # Neuquén
    "62": "patagonia",    # Río Negro
    "66": "noa",          # Salta
    "70": "cuyo",         # San Juan
    "74": "cuyo",         # San Luis
    "78": "patagonia",    # Santa Cruz
    "82": "pampeana",     # Santa Fe
    "86": "noa",          # Santiago del Estero
    "90": "noa",          # Tucumán
    "94": "patagonia",    # Tierra del Fuego
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


def main() -> None:
    csv = download(URL_IPC_GEN, "ipc_nivel_general_mensual.csv")
    df = pd.read_csv(csv, parse_dates=["indice_tiempo"])
    df = df.sort_values("indice_tiempo").reset_index(drop=True)

    # Cols esperadas: ipc_ng_nacional, ipc_ng_gba, ipc_ng_pampeana, ipc_ng_nea, ipc_ng_noa, ipc_ng_cuyo, ipc_ng_patagonia
    # (a veces sin "_ng_", chequeamos las que existen)
    region_cols: dict[str, str] = {}
    for reg in REGIONES:
        candidates = [
            f"ipc_ng_{reg}",
            f"indice_precios_consumidor_nivel_general_{reg}",
            f"ipc_{reg}",
        ]
        for c in candidates:
            if c in df.columns:
                region_cols[reg] = c
                break
    print(f"Columnas región detectadas: {region_cols}")

    # Computar variaciones por región
    series: dict[str, dict] = {}
    last = df.iloc[-1]
    last_date = last["indice_tiempo"].strftime("%Y-%m")
    print(f"Último mes: {last_date}")

    for reg, col in region_cols.items():
        s = df[col].astype(float)
        cur = float(s.iloc[-1])
        prev = float(s.iloc[-2]) if len(s) > 1 else None
        y_ago = float(s.iloc[-13]) if len(s) > 12 else None
        last12 = df[["indice_tiempo", col]].tail(12).copy()
        last12_var = last12[col].pct_change().dropna() * 100
        series[reg] = {
            "ipc_nivel": round(cur, 2),
            "ipc_var_mensual": round((cur / prev - 1) * 100, 2) if prev else None,
            "ipc_var_interanual": round((cur / y_ago - 1) * 100, 2) if y_ago else None,
            "ipc_serie_12m": [
                {"fecha": r["indice_tiempo"].strftime("%Y-%m"), "valor": round(float(r[col]), 2)}
                for _, r in last12.iterrows()
            ],
            "ipc_serie_var_12m": [round(v, 2) for v in last12_var.tolist()],
            "ipc_region": reg,
        }

    # Acumulado 12m (compuesto)
    for reg, rec in series.items():
        vars_pct = rec["ipc_serie_var_12m"]
        if vars_pct:
            acum = 1
            for v in vars_pct:
                acum *= 1 + v / 100
            rec["ipc_acum_12m"] = round((acum - 1) * 100, 2)

    # Por provincia
    out_prov: dict[str, dict] = {}
    for cod, reg in PROV_TO_REGION.items():
        if reg not in series:
            continue
        out_prov[cod] = {**series[reg], "ipc_region_label": reg.upper(), "ipc_year_month": last_date}

    out_path = WEB / "ipc_provincia.json"
    out_path.write_text(json.dumps(out_prov, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({len(out_prov)} prov, {out_path.stat().st_size/1024:.0f} KB)")

    # Tabla nacional para el panel Economía
    nac_path = WEB / "ipc_nacional.json"
    nac_path.write_text(json.dumps({
        "last_date": last_date,
        "regiones": series,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"-> {nac_path.name} ({nac_path.stat().st_size/1024:.0f} KB)")
    print("ETL IPC completo.")


if __name__ == "__main__":
    import urllib3
    urllib3.disable_warnings()
    main()
