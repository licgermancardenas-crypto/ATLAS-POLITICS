"""ETL Educación — Padrón Oficial de Establecimientos Educativos 2024.

Fuente: educacion.gob.ar (via datos.gob.ar). XLSX con 64.601 establecimientos
clasificados por jurisdicción, sector y modalidad.

Outputs por provincia:
    escuelas_total
    escuelas_estatales
    escuelas_privadas
    escuelas_por_10k_hab
    pct_estatal
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
RAW = PROJECT / "data" / "raw" / "socio"

XLSX = RAW / "educacion_padron_2024.xlsx"

JUR_TO_INDEC = {
    "ciudad de buenos aires": "02",
    "buenos aires": "06",
    "catamarca": "10",
    "cordoba": "14",
    "corrientes": "18",
    "chaco": "22",
    "chubut": "26",
    "entre rios": "30",
    "formosa": "34",
    "jujuy": "38",
    "la pampa": "42",
    "la rioja": "46",
    "mendoza": "50",
    "misiones": "54",
    "neuquen": "58",
    "rio negro": "62",
    "salta": "66",
    "san juan": "70",
    "san luis": "74",
    "santa cruz": "78",
    "santa fe": "82",
    "santiago del estero": "86",
    "tierra del fuego": "94",
    "tucuman": "90",
}


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", s).strip()


def load_pop() -> dict[str, int]:
    ind = json.loads((WEB / "indicadores_provincias.json").read_text(encoding="utf-8"))
    return {code: d.get("personas", 0) for code, d in ind.items()}


def main() -> None:
    print(f"[lectura] {XLSX.name}")
    df = pd.read_excel(XLSX, sheet_name="padron", header=12)
    print(f"  {len(df):,} establecimientos")
    df["jur_s"] = df["Jurisdicción"].apply(slug)
    df["prov_code"] = df["jur_s"].map(JUR_TO_INDEC)
    df = df.dropna(subset=["prov_code"]).copy()

    pop = load_pop()
    out: dict[str, dict] = {}
    for code, sub in df.groupby("prov_code"):
        total = len(sub)
        estatal = (sub["Sector"].fillna("").str.upper() == "ESTATAL").sum()
        privado = (sub["Sector"].fillna("").str.upper() == "PRIVADO").sum()
        rec = {
            "escuelas_total": int(total),
            "escuelas_estatales": int(estatal),
            "escuelas_privadas": int(privado),
            "pct_estatal": round(estatal / total * 100, 1) if total else None,
        }
        p = pop.get(code, 0)
        if p:
            rec["escuelas_por_10k_hab"] = round(total / p * 10_000, 2)
        out[code] = rec

    out_path = WEB / "educacion_provincia.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({len(out)} prov, {out_path.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
