"""ETL Energía — centrales de generación por provincia.

Fuente: datos.energia.gob.ar (Generación Eléctrica - Centrales de generación)

Output: data/web/energia_provincia.json
    energia_centrales_count
    energia_potencia_instalada_mw
    energia_potencia_per_capita_kw
    energia_tecnologia_principal_share
"""
from __future__ import annotations

import json
import sys
import unicodedata
import re
from pathlib import Path

import pandas as pd
import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT = Path(r"C:/Users/corra/Desktop/ATLAS politics")
WEB = PROJECT / "data" / "web"
RAW = PROJECT / "data" / "raw" / "energia"
RAW.mkdir(parents=True, exist_ok=True)

URL = "http://datos.energia.gob.ar/dataset/c62df6c6-73af-4039-b956-db081ff6eebe/resource/230fdf38-8f12-4017-a1e8-d7a1bc4a1c1c/download/generacin-elctrica-centrales-de-generacin.csv"

PROV_NORMALIZE = {
    "buenos aires": "06", "ciudad autonoma de buenos aires": "02",
    "ciudad de buenos aires": "02", "catamarca": "10", "chaco": "22",
    "chubut": "26", "cordoba": "14", "corrientes": "18", "entre rios": "30",
    "formosa": "34", "jujuy": "38", "la pampa": "42", "la rioja": "46",
    "mendoza": "50", "misiones": "54", "neuquen": "58", "rio negro": "62",
    "salta": "66", "san juan": "70", "san luis": "74", "santa cruz": "78",
    "santa fe": "82", "santiago del estero": "86", "tierra del fuego": "94",
    "tucuman": "90",
}


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", s).strip()


def main() -> None:
    out_csv = RAW / "centrales.csv"
    if not out_csv.exists():
        print(f"[GET] {URL}")
        r = requests.get(URL, timeout=180, verify=False)
        r.raise_for_status()
        out_csv.write_bytes(r.content)
    df = pd.read_csv(out_csv, encoding="utf-8-sig")
    df["prov_s"] = df["provincia"].apply(slug)
    df["prov_code"] = df["prov_s"].map(PROV_NORMALIZE)
    df = df.dropna(subset=["prov_code"]).copy()
    df["potencia_instalada_mw"] = pd.to_numeric(df["potencia_instalada_mw"], errors="coerce").fillna(0)
    print(f"{len(df):,} centrales · provincias matcheadas: {df['prov_code'].nunique()}")

    pop_ind = json.loads((WEB / "indicadores_provincias.json").read_text(encoding="utf-8"))
    pop = {code: d.get("personas", 0) for code, d in pop_ind.items()}

    out: dict[str, dict] = {}
    for code, sub in df.groupby("prov_code"):
        total_mw = float(sub["potencia_instalada_mw"].sum())
        n = len(sub)
        tech_share = sub.groupby("tecnologia_etiqueta")["potencia_instalada_mw"].sum().sort_values(ascending=False)
        top_tech = tech_share.index[0] if len(tech_share) else None
        top_share = round(tech_share.iloc[0] / total_mw * 100, 1) if total_mw and len(tech_share) else None
        # Termico/Hidro/Renovable
        rec = {
            "energia_centrales_count": int(n),
            "energia_potencia_mw": round(total_mw, 1),
            "energia_tecnologia_principal": top_tech,
            "energia_tecnologia_principal_share": top_share,
        }
        # Share por tipo (simplificado)
        for tipo in ["TER", "HID", "REN", "NUC"]:
            mask = sub["tecnologia_etiqueta"].fillna("").str.upper().str.startswith(tipo)
            mw_tipo = float(sub.loc[mask, "potencia_instalada_mw"].sum())
            if mw_tipo > 0:
                rec[f"energia_{tipo.lower()}_mw"] = round(mw_tipo, 1)
                rec[f"energia_{tipo.lower()}_share"] = round(mw_tipo / total_mw * 100, 1) if total_mw else 0
        p = pop.get(code, 0)
        if p:
            rec["energia_potencia_per_capita_w"] = round(total_mw * 1_000_000 / p, 0)
        out[code] = rec

    out_path = WEB / "energia_provincia.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({len(out)} prov, {out_path.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
