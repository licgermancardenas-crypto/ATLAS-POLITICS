"""ETL CABA — datos por comuna desde data.buenosaires.gob.ar.

Toma:
- Población por comuna (Censo 2010)
- Delitos 2023 agregados por comuna + tasa por 10k habitantes
- Total + tipos principales

Output: data/web/caba_comunal.json (15 comunas)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd
import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT = Path(r"C:/Users/corra/Desktop/ATLAS politics")
WEB = PROJECT / "data" / "web"
RAW = PROJECT / "data" / "raw" / "caba"
RAW.mkdir(parents=True, exist_ok=True)

URL_POB = "https://cdn.buenosaires.gob.ar/datosabiertos/datasets/comunas/gcba_pob_comunas_17.csv"
URL_DELITOS = "https://cdn.buenosaires.gob.ar/datosabiertos/datasets/ministerio-de-justicia-y-seguridad/delitos/delitos_2023.csv"

# CABA codigo INDEC depto = "02" + 3 digitos. Comuna 1 = 02007, Comuna 2 = 02014, ...
# El mapeo INDEC oficial:
COMUNA_TO_INDEC = {
    1: "02007", 2: "02014", 3: "02021", 4: "02028", 5: "02035",
    6: "02042", 7: "02049", 8: "02056", 9: "02063", 10: "02070",
    11: "02077", 12: "02084", 13: "02091", 14: "02098", 15: "02105",
}


def download(url: str, name: str) -> Path:
    out = RAW / name
    if out.exists():
        print(f"[cache] {out.name}")
        return out
    print(f"[GET] {url}")
    r = requests.get(url, timeout=180)
    r.raise_for_status()
    out.write_bytes(r.content)
    print(f"  -> {out.name} ({len(r.content)/1024:.0f} KB)")
    return out


def main() -> None:
    pob_csv = download(URL_POB, "caba_pob.csv")
    pob = pd.read_csv(pob_csv, dtype={"COMUNA": int})
    pob_by_comuna = dict(zip(pob["COMUNA"], pob["POBLACION"]))

    del_csv = download(URL_DELITOS, "caba_delitos_2023.csv")
    df = pd.read_csv(del_csv, dtype=str, encoding="utf-8", on_bad_lines="skip")
    df["cantidad"] = pd.to_numeric(df["cantidad"], errors="coerce").fillna(1)
    df["comuna_n"] = pd.to_numeric(df["comuna"], errors="coerce")

    out: dict[str, dict] = {}
    for comuna_n in range(1, 16):
        code = COMUNA_TO_INDEC[comuna_n]
        sub = df[df["comuna_n"] == comuna_n]
        total = float(sub["cantidad"].sum())
        homicidio = float(sub[sub["tipo"].fillna("").str.upper().str.contains("HOMICIDIO")]["cantidad"].sum())
        robo = float(sub[sub["tipo"].fillna("").str.upper().str.contains("ROBO")]["cantidad"].sum())
        hurto = float(sub[sub["tipo"].fillna("").str.upper().str.contains("HURTO")]["cantidad"].sum())
        lesiones = float(sub[sub["tipo"].fillna("").str.upper().str.contains("LESION")]["cantidad"].sum())
        pob_v = pob_by_comuna.get(comuna_n, 0)
        rec = {
            "caba_comuna_n": comuna_n,
            "delitos_2023_total": int(total),
            "delitos_2023_robos": int(robo),
            "delitos_2023_hurtos": int(hurto),
            "delitos_2023_homicidios": int(homicidio),
            "delitos_2023_lesiones": int(lesiones),
            "caba_poblacion_2010": int(pob_v),
        }
        if pob_v:
            rec["delitos_por_10k_hab_2023"] = round(total / pob_v * 10_000, 1)
            rec["robos_por_10k_hab_2023"] = round(robo / pob_v * 10_000, 1)
        out[code] = rec

    out_path = WEB / "caba_comunal.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({len(out)} comunas, {out_path.stat().st_size/1024:.0f} KB)")
    print(f"Total delitos 2023: {sum(r['delitos_2023_total'] for r in out.values()):,}")


if __name__ == "__main__":
    main()
