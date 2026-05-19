"""ETL Presupuesto Abierto Nacional 2025 — Min. Economía SSPRE.

Output: data/web/presupuesto_nacional.json
    Top-15 jurisdicciones, top-10 finalidades, totales
"""
from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path

import pandas as pd
import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT = Path(r"C:/Users/corra/Desktop/ATLAS politics")
WEB = PROJECT / "data" / "web"
RAW = PROJECT / "data" / "raw" / "presupuesto"
RAW.mkdir(parents=True, exist_ok=True)

URL = "https://dgsiaf-repo.mecon.gob.ar/repository/pa/datasets/2025/resumen-presupuesto-gastos-ejercicio-vigente-2025.zip"


def main() -> None:
    zip_path = RAW / "2025.zip"
    if not zip_path.exists():
        print(f"[GET] {URL}")
        r = requests.get(URL, timeout=180, verify=False)
        r.raise_for_status()
        zip_path.write_bytes(r.content)
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(RAW)
    csv = next(RAW.glob("resumen-presupuesto-gastos*.csv"))
    df = pd.read_csv(csv, encoding="utf-8-sig", low_memory=False)
    for col in ("credito_vigente", "credito_devengado", "credito_pagado"):
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    print(f"{len(df):,} rows · año {df['ejercicio_presupuestario'].iloc[0]}")

    total_vig = float(df["credito_vigente"].sum())
    total_dev = float(df["credito_devengado"].sum())
    total_pag = float(df["credito_pagado"].sum())

    # Top jurisdicciones
    j = df.groupby("jurisdiccion_desc").agg(
        vigente=("credito_vigente", "sum"),
        devengado=("credito_devengado", "sum"),
        pagado=("credito_pagado", "sum"),
    ).sort_values("vigente", ascending=False).head(20).reset_index()
    j["vigente_share"] = j["vigente"] / total_vig * 100
    j["ejecucion_pct"] = j["devengado"] / j["vigente"].replace(0, 1) * 100
    jur = j.to_dict(orient="records")

    # Top finalidades
    f = df.groupby("finalidad_desc").agg(
        vigente=("credito_vigente", "sum"),
        devengado=("credito_devengado", "sum"),
    ).sort_values("vigente", ascending=False).head(15).reset_index()
    f["vigente_share"] = f["vigente"] / total_vig * 100
    fin = f.to_dict(orient="records")

    out = {
        "year": int(df["ejercicio_presupuestario"].iloc[0]),
        "total_vigente_ars": round(total_vig, 0),
        "total_devengado_ars": round(total_dev, 0),
        "total_pagado_ars": round(total_pag, 0),
        "ejecucion_pct": round(total_dev / total_vig * 100, 2) if total_vig else None,
        "top_jurisdicciones": [
            {k: (round(v, 0) if isinstance(v, float) else v) for k, v in row.items()}
            for row in jur
        ],
        "top_finalidades": [
            {k: (round(v, 0) if isinstance(v, float) else v) for k, v in row.items()}
            for row in fin
        ],
    }
    out_path = WEB / "presupuesto_nacional.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({out_path.stat().st_size/1024:.0f} KB)")
    print(f"   Total vigente: ${total_vig/1e12:.2f}T · Ejecución: {out['ejecucion_pct']}%")


if __name__ == "__main__":
    main()
