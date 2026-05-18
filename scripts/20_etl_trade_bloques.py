"""ETL Exportaciones por bloque económico — agrupa datos SSPM por destino.

Reusa el CSV ya descargado (data/raw/economia/exp_pais_destino.csv) y
agrupa los países en bloques (Mercosur/UE/Asia/EEUU+CAN/Resto).

Output: data/web/trade_bloques_provincia.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT = Path(r"C:/Users/corra/Desktop/ATLAS politics")
WEB = PROJECT / "data" / "web"
CSV = PROJECT / "data" / "raw" / "economia" / "exp_pais_destino.csv"

PROV_SLUG_TO_INDEC = {
    "pba": "06", "ciudad_de_buenos_aires": "02", "catamarca": "10",
    "chaco": "22", "chubut": "26", "cordoba": "14", "corrientes": "18",
    "entre_rios": "30", "formosa": "34", "jujuy": "38", "la_pampa": "42",
    "la_rioja": "46", "mendoza": "50", "misiones": "54", "neuquen": "58",
    "rio_negro": "62", "salta": "66", "san_juan": "70", "san_luis": "74",
    "santa_cruz": "78", "santa_fe": "82", "santiago_del_estero": "86",
    "tierra_del_fuego": "94", "tucuman": "90",
}

# Mapeo país → bloque económico
BLOQUES = {
    "mercosur": ["brasil", "uruguay", "paraguay", "venezuela", "bolivia"],
    "ue": ["alemania", "espana", "italia", "francia", "paises_bajos", "belgica",
           "reino_unido", "portugal", "austria", "polonia", "suecia", "dinamarca",
           "irlanda", "finlandia", "grecia"],
    "asia": ["china", "india", "japon", "vietnam", "indonesia", "tailandia",
             "corea_del_sur", "filipinas", "malasia", "singapur", "taiwan",
             "hong_kong", "pakistan", "bangladesh"],
    "norteamerica": ["estados_unidos", "canada", "mexico"],
    "chile_peru": ["chile", "peru", "colombia", "ecuador"],
    "africa_medio_oriente": ["egipto", "argelia", "marruecos", "sudafrica",
                              "arabia_saudita", "emiratos_arabes_unidos", "iran",
                              "israel", "turquia", "tunez"],
}


def main() -> None:
    if not CSV.exists():
        print(f"Falta {CSV}, corré primero 16_etl_extras.py")
        return
    df = pd.read_csv(CSV, parse_dates=["indice_tiempo"])
    last = df.iloc[-1]
    year = last["indice_tiempo"].year
    print(f"Año: {year}")

    out: dict[str, dict] = {}
    for col in df.columns:
        if col == "indice_tiempo": continue
        parts = col.split("_", 1)
        if len(parts) != 2: continue
        prov_slug, pais_slug = parts
        code = PROV_SLUG_TO_INDEC.get(prov_slug)
        if not code: continue
        val = last[col]
        if pd.isna(val) or val <= 0: continue
        rec = out.setdefault(code, {"year": year, "_total": 0,
                                     **{f"trade_{b}_musd": 0 for b in BLOQUES},
                                     "trade_otros_musd": 0})
        rec["_total"] += float(val)
        assigned = False
        for bloque, countries in BLOQUES.items():
            if pais_slug in countries:
                rec[f"trade_{bloque}_musd"] += float(val)
                assigned = True
                break
        if not assigned:
            rec["trade_otros_musd"] += float(val)

    # Porcentajes
    for code, rec in out.items():
        tot = rec["_total"]
        for bloque in list(BLOQUES.keys()) + ["otros"]:
            v = rec.get(f"trade_{bloque}_musd", 0)
            rec[f"trade_{bloque}_musd"] = round(v, 1)
            if tot:
                rec[f"trade_{bloque}_share"] = round(v / tot * 100, 1)
        # Dominante
        shares = {b: rec.get(f"trade_{b}_share", 0) for b in list(BLOQUES.keys()) + ["otros"]}
        top = max(shares.items(), key=lambda kv: kv[1])
        rec["trade_bloque_principal"] = top[0]
        rec["trade_bloque_principal_share"] = top[1]
        rec.pop("_total", None)

    out_path = WEB / "trade_bloques_provincia.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
    print(f"-> {out_path.name} ({len(out)} prov, {out_path.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
