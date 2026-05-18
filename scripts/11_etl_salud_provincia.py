"""ETL Salud — Registro Federal de Establecimientos de Salud (REFES).

datos.salud.gob.ar: 26.985 establecimientos clasificados con provincia,
departamento y tipología.

Outputs por provincia:
    establecimientos_salud_total
    establecimientos_salud_por_10k_hab
    hospitales_count        (tipología hospital/clínica/sanatorio)
    salas_count             (centros de salud / postas / CAPS)

Salidas:
    data/web/salud_provincia.json
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
RAW = PROJECT / "data" / "raw" / "socio"
RAW.mkdir(parents=True, exist_ok=True)

URL = ("https://datos.salud.gob.ar/dataset/336cf4d9-447a-44c4-8e34-0ba1fc293d55/"
       "resource/a15af80e-9e2c-4e34-84ca-320573e9bdda/download/"
       "listado-establecimientos-salud-asentados-registro-federal-refes-_202008.csv")

HOSPITAL_KW = ("HOSPITAL", "CLINICA", "CLÍNICA", "SANATORIO")
SALA_KW = ("CENTRO DE SALUD", "SALA", "CAPS", "POSTA")


def download() -> Path:
    out = RAW / "refes.csv"
    if out.exists():
        print(f"[cache] {out.name}")
        return out
    print(f"[GET] {URL}")
    r = requests.get(URL, timeout=120, allow_redirects=True, verify=False)
    r.raise_for_status()
    out.write_bytes(r.content)
    print(f"  -> {out.name} ({len(r.content)/1024:.0f} KB)")
    return out


def load_pop_by_prov() -> dict[str, int]:
    ind = json.loads((WEB / "indicadores_provincias.json").read_text(encoding="utf-8"))
    return {code: d.get("personas", 0) for code, d in ind.items()}


def main() -> None:
    csv = download()
    df = pd.read_csv(csv, dtype=str, encoding="latin1")
    # Filtrar provincia_id válidos
    df = df.dropna(subset=["provincia_id"]).copy()
    df["prov_code"] = df["provincia_id"].astype(str).str.zfill(2)
    df["tip_up"] = df["tipologia"].fillna("").str.upper()

    pop = load_pop_by_prov()

    out: dict[str, dict] = {}
    for code, sub in df.groupby("prov_code"):
        total = len(sub)
        hosp = sub["tip_up"].str.contains("|".join(HOSPITAL_KW), na=False).sum()
        sala = sub["tip_up"].str.contains("|".join(SALA_KW), na=False).sum()
        rec = {
            "establecimientos_salud_total": int(total),
            "hospitales_count": int(hosp),
            "salas_count": int(sala),
        }
        p = pop.get(code, 0)
        if p:
            rec["establecimientos_por_10k_hab"] = round(total / p * 10_000, 2)
            rec["hospitales_por_100k_hab"] = round(hosp / p * 100_000, 2)
        out[code] = rec

    out_path = WEB / "salud_provincia.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({len(out)} prov, {out_path.stat().st_size/1024:.0f} KB)")
    print(f"Total establecimientos: {sum(r['establecimientos_salud_total'] for r in out.values()):,}")


if __name__ == "__main__":
    main()
