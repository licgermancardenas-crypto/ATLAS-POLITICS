"""ETL Egresos hospitalarios PBA — catalogo.datos.gba.gob.ar.

Agrega egresos por municipio del último año disponible.

Output: data/web/egresos_pba_municipal.json
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

URL = "https://catalogo.datos.gba.gob.ar/dataset/baf07a7a-8cd2-47ad-bae0-52c6f3b45bb7/resource/06d4b138-11cb-4b72-a87b-bff09f6af07d/download/egresos-2020.csv"


def download() -> Path:
    out = RAW / "egresos_2020.csv"
    if out.exists():
        print(f"[cache] {out.name}")
        return out
    print(f"[GET] {URL}")
    r = requests.get(URL, timeout=180, verify=False)
    r.raise_for_status()
    out.write_bytes(r.content)
    print(f"  -> {out.name} ({len(r.content)/1024:.0f} KB)")
    return out


def main() -> None:
    csv = download()
    df = pd.read_csv(csv, sep=";", dtype=str, low_memory=False)
    df["cantidad"] = pd.to_numeric(df["cantidad"], errors="coerce").fillna(0)
    df["prov_code"] = df["municipio_id"].astype(str).str.zfill(5)

    # Población PBA del Censo (para per cápita)
    pop = json.loads((WEB / "indicadores_departamentos.json").read_text(encoding="utf-8"))

    out: dict[str, dict] = {}
    for code, sub in df.groupby("prov_code"):
        if not code.startswith("06"): continue
        total = float(sub["cantidad"].sum())
        # Por causa capítulo
        by_cap = sub.groupby("causa_egreso_capitulo")["cantidad"].sum().sort_values(ascending=False)
        cardio = float(by_cap.get("Enfermedades del aparato circulatorio", 0))
        respiratorio = float(by_cap.get("Enfermedades del aparato respiratorio", 0))
        embarazo = float(by_cap.get("Embarazo, parto y puerperio", 0))
        traumatismo = float(by_cap.get("Traumatismos, envenenamientos y algunas otras consecuencias de causa externa", 0))
        rec = {
            "egresos_2020_total": int(total),
            "egresos_2020_cardiovasculares": int(cardio),
            "egresos_2020_respiratorios": int(respiratorio),
            "egresos_2020_embarazo_parto": int(embarazo),
            "egresos_2020_traumatismos": int(traumatismo),
        }
        p = pop.get(code, {}).get("personas", 0)
        if p:
            rec["egresos_2020_por_1k_hab"] = round(total / p * 1000, 1)
        out[code] = rec

    out_path = WEB / "egresos_pba_municipal.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({len(out)} muni, {out_path.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
