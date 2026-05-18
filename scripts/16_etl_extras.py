"""ETL extras: trade flows + vacunas COVID por provincia + CABA educación.

Outputs:
    data/web/trade_provincia.json    — exportaciones por destino y año (último año)
    data/web/covid_vac_provincia.json — dosis COVID totales por provincia
    actualiza caba_comunal.json con escuelas comuna
"""
from __future__ import annotations

import io
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
RAW = PROJECT / "data" / "raw"
(RAW / "economia").mkdir(parents=True, exist_ok=True)
(RAW / "socio").mkdir(parents=True, exist_ok=True)

URL_TRADE = "https://infra.datos.gob.ar/catalog/sspm/dataset/357/distribution/357.1/download/exportaciones-por-provincia-por-pais-de-destino-valores-anuales.csv"

PROV_SLUG_TO_INDEC = {
    "pba": "06", "ciudad_de_buenos_aires": "02", "catamarca": "10",
    "chaco": "22", "chubut": "26", "cordoba": "14", "corrientes": "18",
    "entre_rios": "30", "formosa": "34", "jujuy": "38", "la_pampa": "42",
    "la_rioja": "46", "mendoza": "50", "misiones": "54", "neuquen": "58",
    "rio_negro": "62", "salta": "66", "san_juan": "70", "san_luis": "74",
    "santa_cruz": "78", "santa_fe": "82", "santiago_del_estero": "86",
    "tierra_del_fuego": "94", "tucuman": "90",
}


def download(url: str, dst: Path) -> Path:
    if dst.exists():
        print(f"[cache] {dst.name}")
        return dst
    print(f"[GET] {url}")
    r = requests.get(url, timeout=180, verify=False)
    r.raise_for_status()
    dst.write_bytes(r.content)
    print(f"  -> {dst.name} ({len(r.content)/1024:.0f} KB)")
    return dst


def trade_flows() -> dict:
    csv = download(URL_TRADE, RAW / "economia" / "exp_pais_destino.csv")
    df = pd.read_csv(csv, parse_dates=["indice_tiempo"])
    last = df.iloc[-1]
    year = last["indice_tiempo"].year
    print(f"Trade flows año: {year}")

    # Columnas: <prov_slug>_<pais_slug>
    out: dict[str, dict] = {}
    for col in df.columns:
        if col == "indice_tiempo": continue
        parts = col.split("_", 1)
        if len(parts) != 2: continue
        prov_slug, pais_slug = parts
        code = PROV_SLUG_TO_INDEC.get(prov_slug)
        if not code: continue
        val = last[col]
        if pd.isna(val): continue
        rec = out.setdefault(code, {"year": year, "destinos": {}})
        rec["destinos"][pais_slug] = round(float(val), 2)

    # Top destino + concentración top 3
    for code, rec in out.items():
        dest = rec["destinos"]
        if not dest: continue
        items = sorted(dest.items(), key=lambda kv: -kv[1])
        total = sum(dest.values())
        top1 = items[0] if items else (None, 0)
        top3_sum = sum(v for _, v in items[:3])
        rec["destino_principal"] = top1[0]
        rec["destino_principal_musd"] = top1[1]
        rec["destino_principal_share"] = round(top1[1] / total * 100, 1) if total else None
        rec["destino_top3_concentracion"] = round(top3_sum / total * 100, 1) if total else None
        rec["exportaciones_total_destinos_musd"] = round(total, 2)

    return out


def covid_vac() -> dict:
    URL = "https://sisa.msal.gov.ar/datos/descargas/covid-19/files/Covid19VacunasAgrupadas.csv.zip"
    zp = RAW / "socio" / "covid_vac.csv.zip"
    if not zp.exists():
        r = requests.get(URL, timeout=180, verify=False)
        r.raise_for_status()
        zp.write_bytes(r.content)
    import zipfile
    with zipfile.ZipFile(zp) as z:
        z.extractall(zp.parent)
    csv = zp.parent / "Covid19VacunasAgrupadas.csv"
    df = pd.read_csv(csv)
    df["prov_code"] = df["jurisdiccion_codigo_indec"].astype(str).str.zfill(2)
    pop_ind = json.loads((WEB / "indicadores_provincias.json").read_text(encoding="utf-8"))
    pop = {code: d.get("personas", 0) for code, d in pop_ind.items()}

    out: dict[str, dict] = {}
    for code, sub in df.groupby("prov_code"):
        primera = int(sub["primera_dosis_cantidad"].sum())
        segunda = int(sub["segunda_dosis_cantidad"].sum())
        unica = int(sub["dosis_unica_cantidad"].sum())
        adic = int(sub["dosis_adicional_cantidad"].sum())
        ref = int(sub["dosis_refuerzo_cantidad"].sum())
        total = primera + segunda + unica + adic + ref
        p = pop.get(code, 0)
        rec = {
            "covid_dosis_total": total,
            "covid_primera_dosis": primera,
            "covid_segunda_dosis": segunda,
            "covid_dosis_refuerzo": ref,
        }
        if p:
            rec["covid_dosis_por_hab"] = round(total / p, 2)
            rec["covid_cobertura_segunda_pct"] = round((segunda + unica) / p * 100, 1)
        out[code] = rec
    return out


def main() -> None:
    trade = trade_flows()
    (WEB / "trade_provincia.json").write_text(
        json.dumps(trade, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"-> trade_provincia.json ({len(trade)} prov)")

    covid = covid_vac()
    (WEB / "covid_vac_provincia.json").write_text(
        json.dumps(covid, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"-> covid_vac_provincia.json ({len(covid)} prov)")
    print("ETL extras completo.")


if __name__ == "__main__":
    main()
