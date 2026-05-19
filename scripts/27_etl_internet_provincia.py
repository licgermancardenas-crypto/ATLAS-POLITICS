"""ETL Internet fija por provincia (ENACOM).

Output: data/web/internet_provincia.json
    internet_accesos_baf
    internet_accesos_per_capita    (accesos / hogares)
    internet_year_q
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
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

URL = "https://indicadores.enacom.gob.ar/Files/DatosAbiertos/internet_accesos_baf_provincias.csv"

PROV_NORM = {
    "buenos aires": "06", "caba": "02", "ciudad autonoma de buenos aires": "02",
    "catamarca": "10", "chaco": "22", "chubut": "26", "cordoba": "14",
    "corrientes": "18", "entre rios": "30", "formosa": "34", "jujuy": "38",
    "la pampa": "42", "la rioja": "46", "mendoza": "50", "misiones": "54",
    "neuquen": "58", "rio negro": "62", "salta": "66", "san juan": "70",
    "san luis": "74", "santa cruz": "78", "santa fe": "82",
    "santiago del estero": "86", "tierra del fuego": "94", "tucuman": "90",
}


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", s).strip()


def main() -> None:
    out_csv = RAW / "internet_baf.csv"
    if not out_csv.exists():
        print(f"[GET] {URL}")
        r = requests.get(URL, timeout=120, verify=False)
        r.raise_for_status()
        out_csv.write_bytes(r.content)
    df = pd.read_csv(out_csv)
    df["anio"] = pd.to_numeric(df["anio"], errors="coerce").astype("Int64")
    df["trimestre"] = pd.to_numeric(df["trimestre"], errors="coerce").astype("Int64")
    df["banda_ancha_fija"] = pd.to_numeric(df["banda_ancha_fija"], errors="coerce").fillna(0)
    df["total"] = pd.to_numeric(df["total"], errors="coerce").fillna(0)
    df["prov_s"] = df["provincia"].apply(slug)
    df["prov_code"] = df["prov_s"].map(PROV_NORM)
    df = df.dropna(subset=["prov_code"]).copy()
    last_year = int(df["anio"].max())
    last_q = int(df[df["anio"] == last_year]["trimestre"].max())
    print(f"Último período: {last_year} T{last_q}")
    sub = df[(df["anio"] == last_year) & (df["trimestre"] == last_q)]

    pop_ind = json.loads((WEB / "indicadores_provincias.json").read_text(encoding="utf-8"))
    pop = {code: d.get("hogares", 0) for code, d in pop_ind.items()}
    out: dict[str, dict] = {}
    for code, g in sub.groupby("prov_code"):
        baf = float(g["banda_ancha_fija"].sum())
        tot = float(g["total"].sum())
        rec = {
            "internet_accesos_baf": int(baf),
            "internet_accesos_total": int(tot),
            "internet_year_q": f"{last_year} T{last_q}",
        }
        h = pop.get(code, 0)
        if h:
            rec["internet_accesos_por_hogar"] = round(baf / h, 3)
        out[code] = rec

    out_path = WEB / "internet_provincia.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({len(out)} prov, {out_path.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
