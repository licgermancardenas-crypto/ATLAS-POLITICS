"""ETL de resultados electorales DINE — 2015 → 2023.

Procesa los CSVs provisorios oficiales (DINE / datos.gob.ar) y agrega a nivel
provincia + departamento (matcheo por nombre con `data/web/departamentos.geojson`).

Genera una salida por (año, elección, cargo) con un schema unificado de variables
para permitir comparativas temporales:

    pj_pct  — coalición peronista (FPV/UC/FdT/UP)
    jxc_pct — coalición Macri/Cambiemos (Cambiemos/JxC/Juntos)
    lla_pct — La Libertad Avanza / Avanza Libertad (2021+)
    izq_pct — FIT (presente en todos los años)
    + alianzas específicas por año (una/prog/cf/nos/vcv, etc.)
    + participacion, blanco_pct, nulo_pct

Salidas:
    data/web/elecciones_<label>_provincia.json
    data/web/elecciones_<label>_departamento.json
    catalogs/elecciones.json
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Iterable

import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT = Path(r"C:/Users/corra/Desktop/ATLAS politics")
RAW = PROJECT / "data" / "raw" / "elecciones"
WEB = PROJECT / "data" / "web"
CATALOGS = PROJECT / "catalogs"
WEB.mkdir(parents=True, exist_ok=True)
CATALOGS.mkdir(parents=True, exist_ok=True)

# ============================================================================
# Diccionarios de alianzas por elección
# El matching usa substring (case-insensitive, strip whitespace).
# ============================================================================
ALIANZAS_2015_GEN = {
    "pj":       ["ALIANZA FRENTE PARA LA VICTORIA"],
    "jxc":      ["ALIANZA CAMBIEMOS"],
    "una":      ["ALIANZA UNIDOS POR UNA NUEVA ALTERNATIVA"],
    "prog":     ["ALIANZA PROGRESISTAS"],
    "comp_fed": ["ALIANZA COMPROMISO FEDERAL"],
    "izq":      ["ALIANZA FRENTE DE IZQUIERDA"],
}
ALIANZAS_2015_BAL = {
    "pj":  ["ALIANZA FRENTE PARA LA VICTORIA"],
    "jxc": ["ALIANZA CAMBIEMOS"],
}
ALIANZAS_2017 = {
    "jxc":   ["CAMBIEMOS"],
    "pj":    ["FRENTE PARA LA VICTORIA", "FRENTE JUSTICIALISTA",
              "UNIDAD CIUDADANA"],
    "1pais": ["1PAIS", "FRENTE RENOVADOR"],
    "izq":   ["FRENTE DE IZQUIERDA"],
}
ALIANZAS_2019 = {
    "pj":  ["FRENTE DE TODOS"],
    "jxc": ["JUNTOS POR EL CAMBIO"],
    "cf":  ["CONSENSO FEDERAL", "CONSENSO 2030"],
    "nos": ["FRENTE NOS"],
    "izq": ["FRENTE DE IZQUIERDA"],
}
ALIANZAS_2021 = {
    "pj":  ["FRENTE DE TODOS"],
    "jxc": ["JUNTOS POR EL CAMBIO", "JUNTOS POR ENTRE RIOS",
            "ENCUENTRO POR CORRIENTES"],
    "lla": ["LA LIBERTAD AVANZA", "AVANZA LIBERTAD"],
    "izq": ["FRENTE DE IZQUIERDA"],
    "vcv": ["VAMOS CON VOS"],
}
ALIANZAS_2023 = {
    "lla":     ["LA LIBERTAD AVANZA"],
    "pj":      ["UNION POR LA PATRIA", "UNIÓN POR LA PATRIA"],
    "jxc":     ["JUNTOS POR EL CAMBIO"],
    "hacemos": ["HACEMOS POR NUESTRO PAIS", "HACEMOS POR NUESTRO PAÍS"],
    "izq":     ["FRENTE DE IZQUIERDA Y DE TRABAJADORES - UNIDAD"],
}
ALIANZAS_2023_BAL = {
    "lla": ["LA LIBERTAD AVANZA"],
    "pj":  ["UNION POR LA PATRIA", "UNIÓN POR LA PATRIA"],
}
ALIANZAS_2023_LEGIS = {
    "lla":     ["LA LIBERTAD AVANZA"],
    "pj":      ["UNION POR LA PATRIA", "UNIÓN POR LA PATRIA", "FRENTE DE TODOS"],
    "jxc":     ["JUNTOS POR EL CAMBIO", "JUNTOS POR ENTRE RIOS",
                "ENCUENTRO POR CORRIENTES", "ECO + VAMOS CORRIENTES"],
    "hacemos": ["HACEMOS POR NUESTRO PAIS", "HACEMOS POR NUESTRO PAÍS",
                "HACEMOS POR CORDOBA", "HACEMOS UNIDOS POR SANTA FE"],
    "izq":     ["FRENTE DE IZQUIERDA Y DE TRABAJADORES - UNIDAD",
                "FRENTE DE IZQUIERDA"],
}

VOTO_TIPOS = ["POSITIVO", "BLANCO", "NULO", "RECURRIDO", "IMPUGNADO", "COMANDO"]

PREFIXES = (
    r"^provincia_de(_|l_)?",
    r"^departamento(_de)?",
    r"^partido(_de)?",
    r"^municipio(_de)?",
)
PREFIX_RE = re.compile("|".join(PREFIXES))


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")
    s = PREFIX_RE.sub("", s).lstrip("_")
    m = re.match(r"^comuna_0*(\d+)$", s)
    if m:
        s = f"comuna_{m.group(1)}"
    return s


def vec_slug(series: pd.Series) -> pd.Series:
    s = series.fillna("").astype(str)
    s = s.str.normalize("NFKD").str.encode("ascii", errors="ignore").str.decode("ascii")
    s = s.str.lower().str.replace(r"[^a-z0-9]+", "_", regex=True).str.strip("_")
    s = s.str.replace(PREFIX_RE, "", regex=True).str.lstrip("_")
    s = s.str.replace(r"^comuna_0*(\d+)$", r"comuna_\1", regex=True)
    return s


def alianza_for(nombre: str, mapping: dict[str, list[str]]) -> str | None:
    n = (nombre or "").upper().strip()
    if not n:
        return None
    for key, aliases in mapping.items():
        if any(a in n for a in aliases):
            return key
    return None


def load_lookups() -> tuple[dict[str, dict[str, str]], dict[str, str]]:
    g = json.loads((WEB / "departamentos.geojson").read_text(encoding="utf-8"))
    prov_geo = json.loads((WEB / "provincias.geojson").read_text(encoding="utf-8"))
    prov_by_code = {
        f["properties"]["codigo_indec"]: f["properties"]["nombre"]
        for f in prov_geo["features"] if f["properties"].get("codigo_indec")
    }
    prov_lookup = {slug(n): c for c, n in prov_by_code.items()}
    depto_lookup: dict[str, dict[str, str]] = {}
    for f in g["features"]:
        p = f["properties"]
        cod = p.get("codigo_indec")
        if not cod:
            continue
        cod = str(cod).zfill(5)
        prov_name = prov_by_code.get(cod[:2], "")
        ps = slug(prov_name)
        ds = slug(p.get("nombre", ""))
        if not ps or not ds:
            continue
        depto_lookup.setdefault(ps, {})[ds] = cod
    return depto_lookup, prov_lookup


def aggregate(
    csv_path: Path,
    alianzas: dict,
    cargo_names: Iterable[str],
    label: str,
    encoding: str = "utf-8",
) -> tuple[dict, dict]:
    print(f"[{label}] leyendo {csv_path.name} ({csv_path.stat().st_size/1024**2:.0f} MB)…")
    depto_lookup, prov_lookup = load_lookups()
    alianza_keys = list(alianzas.keys())
    cargo_set = {c.upper() for c in cargo_names}

    agg: dict[tuple[str, str], dict] = {}
    mesa_padron_rows = []

    USE_BASE = ["distrito_nombre", "seccion_nombre", "mesa_id", "mesa_electores",
                "cargo_nombre", "agrupacion_nombre", "votos_tipo", "votos_cantidad"]

    # 2019 usa "Año" en lugar de "año" en el header pero nosotros no lo usamos.
    # Algunos CSVs vienen en latin-1 con cabecera bytes inválidos — probamos 2 encodings.
    def reader_factory():
        return pd.read_csv(csv_path, usecols=USE_BASE, chunksize=500_000,
                           dtype=str, low_memory=False, encoding=encoding)

    reader = reader_factory()
    total = 0
    for ch in reader:
        cargo_norm = ch["cargo_nombre"].fillna("").str.upper().str.strip()
        mask = cargo_norm.isin(cargo_set)
        ch = ch.loc[mask].copy()
        if ch.empty:
            continue
        ch["votos_cantidad"] = pd.to_numeric(ch["votos_cantidad"], errors="coerce").fillna(0).astype("int64")
        ch["mesa_electores"] = pd.to_numeric(ch["mesa_electores"], errors="coerce").fillna(0).astype("int64")
        ch["prov_s"] = vec_slug(ch["distrito_nombre"])
        ch["depto_s"] = vec_slug(ch["seccion_nombre"])
        ch["agr_n"] = ch["agrupacion_nombre"].fillna("").astype(str).str.upper().str.strip()

        mp = (ch[["prov_s", "depto_s", "mesa_id", "mesa_electores"]]
              .drop_duplicates(subset=["prov_s", "depto_s", "mesa_id"]))
        mesa_padron_rows.append(mp)

        votos_por_tipo = (ch.groupby(["prov_s", "depto_s", "votos_tipo"])["votos_cantidad"]
                            .sum().unstack(fill_value=0))

        pos = ch[ch["votos_tipo"] == "POSITIVO"]
        if not pos.empty:
            # alianza por agrupacion única → vectorizado
            uniq = pos["agr_n"].unique()
            mp_map = {n: alianza_for(n, alianzas) for n in uniq}
            pos = pos.assign(alianza=pos["agr_n"].map(mp_map))
            votos_por_alianza = (pos[pos["alianza"].notna()]
                                  .groupby(["prov_s", "depto_s", "alianza"])["votos_cantidad"]
                                  .sum().unstack(fill_value=0))
        else:
            votos_por_alianza = pd.DataFrame()

        for (ps, ds) in votos_por_tipo.index:
            rec = agg.setdefault((ps, ds), {
                **{f"votos_{t.lower()}": 0 for t in VOTO_TIPOS},
                **{a: 0 for a in alianza_keys},
            })
            row = votos_por_tipo.loc[(ps, ds)]
            for t in VOTO_TIPOS:
                if t in row.index:
                    rec[f"votos_{t.lower()}"] += int(row[t])
            if not votos_por_alianza.empty and (ps, ds) in votos_por_alianza.index:
                a_row = votos_por_alianza.loc[(ps, ds)]
                for a in alianza_keys:
                    if a in a_row.index:
                        rec[a] += int(a_row[a])

        total += len(ch)
        if total % 2_500_000 == 0 or total < 500_000:
            print(f"  filas {total:,}  | {len(agg):,} (prov,depto) acum.")

    if mesa_padron_rows:
        padron_df = pd.concat(mesa_padron_rows, ignore_index=True)
        padron_df = padron_df.drop_duplicates(subset=["prov_s", "depto_s", "mesa_id"])
        padron_by = padron_df.groupby(["prov_s", "depto_s"])["mesa_electores"].sum()
        for (ps, ds), val in padron_by.items():
            agg.setdefault((ps, ds), {**{f"votos_{t.lower()}": 0 for t in VOTO_TIPOS},
                                       **{a: 0 for a in alianza_keys}})
            agg[(ps, ds)]["padron"] = int(val)

    def add_derived(rec: dict) -> dict:
        positivos = rec.get("votos_positivo", 0)
        blanco = rec.get("votos_blanco", 0)
        nulo = (rec.get("votos_nulo", 0) + rec.get("votos_recurrido", 0)
                + rec.get("votos_impugnado", 0) + rec.get("votos_comando", 0))
        validos = positivos + blanco + nulo
        rec["votos_pos"] = positivos
        rec["votos_blanco"] = blanco
        rec["votos_nulo"] = nulo
        rec["votantes"] = validos
        padron = rec.get("padron", 0)
        rec["participacion"] = round(validos / padron, 4) if padron else None
        rec["blanco_pct"] = round(blanco / validos, 4) if validos else None
        rec["nulo_pct"] = round(nulo / validos, 4) if validos else None
        for a in alianza_keys:
            rec[f"{a}_pct"] = round(rec[a] / positivos, 4) if positivos else None
        for t in VOTO_TIPOS:
            rec.pop(f"votos_{t.lower()}", None)
        return rec

    out_depto: dict[str, dict] = {}
    out_prov_raw: dict[str, dict] = {}
    for (ps, ds), rec in agg.items():
        rec = add_derived(rec)
        code = depto_lookup.get(ps, {}).get(ds)
        if code:
            out_depto[code] = rec
        prov_rec = out_prov_raw.setdefault(ps, {"padron": 0, "votos_pos": 0,
                                                 "votos_blanco": 0, "votos_nulo": 0,
                                                 **{a: 0 for a in alianza_keys}})
        prov_rec["padron"] += rec.get("padron", 0)
        prov_rec["votos_pos"] += rec.get("votos_pos", 0)
        prov_rec["votos_blanco"] += rec.get("votos_blanco", 0)
        prov_rec["votos_nulo"] += rec.get("votos_nulo", 0)
        for a in alianza_keys:
            prov_rec[a] += rec.get(a, 0)

    out_prov: dict[str, dict] = {}
    for ps, rec in out_prov_raw.items():
        positivos = rec["votos_pos"]; blanco = rec["votos_blanco"]; nulo = rec["votos_nulo"]
        validos = positivos + blanco + nulo
        rec["votantes"] = validos
        rec["participacion"] = round(validos / rec["padron"], 4) if rec["padron"] else None
        rec["blanco_pct"] = round(blanco / validos, 4) if validos else None
        rec["nulo_pct"] = round(nulo / validos, 4) if validos else None
        for a in alianza_keys:
            rec[f"{a}_pct"] = round(rec[a] / positivos, 4) if positivos else None
        code = prov_lookup.get(ps)
        if code:
            out_prov[code] = rec

    print(f"  ✓ {label}: {len(out_prov)}/24 provincias, {len(out_depto)} deptos")
    return out_prov, out_depto


def main() -> None:
    RUNS = [
        # 2015
        {"label": "2015_generales", "year": 2015, "cargo": "Presidente Generales",
         "csv": RAW / "2015_Generales" / "ResultadosElectorales.csv",
         "cargos": ["PRESIDENTE", "PRESIDENTE Y VICE"],
         "alianzas": ALIANZAS_2015_GEN},
        {"label": "2015_balotaje", "year": 2015, "cargo": "Presidente Balotaje",
         "csv": RAW / "2015_Ballotage" / "ResultadosElectorales.csv",
         "cargos": ["PRESIDENTE", "PRESIDENTE Y VICE"],
         "alianzas": ALIANZAS_2015_BAL},
        # 2017
        {"label": "2017_diputados", "year": 2017, "cargo": "Diputados Nac.",
         "csv": RAW / "2017_Generales" / "ResultadosElectorales.csv",
         "cargos": ["DIPUTADO NACIONAL", "DIPUTADOS NACIONALES"],
         "alianzas": ALIANZAS_2017},
        # 2019
        {"label": "2019_paso", "year": 2019, "cargo": "Presidente PASO",
         "csv": RAW / "2019_PASO" / "ResultadosElectorales.csv",
         "cargos": ["PRESIDENTE", "PRESIDENTE Y VICE"],
         "alianzas": ALIANZAS_2019},
        {"label": "2019_generales", "year": 2019, "cargo": "Presidente Generales",
         "csv": RAW / "2019_Generales" / "ResultadosElectorales.csv",
         "cargos": ["PRESIDENTE", "PRESIDENTE Y VICE"],
         "alianzas": ALIANZAS_2019},
        # 2021
        {"label": "2021_diputados", "year": 2021, "cargo": "Diputados Nac.",
         "csv": RAW / "2021_Generales" / "ResultadosElectorales.csv",
         "cargos": ["DIPUTADO NACIONAL", "DIPUTADOS NACIONALES"],
         "alianzas": ALIANZAS_2021},
        # 2023
        {"label": "2023_generales", "year": 2023, "cargo": "Presidente Generales",
         "csv": RAW / "2023_Generales" / "ResultadoElectorales_2023_Generales.csv",
         "cargos": ["PRESIDENTE", "PRESIDENTE Y VICE"],
         "alianzas": ALIANZAS_2023},
        {"label": "2023_balotaje", "year": 2023, "cargo": "Balotaje",
         "csv": RAW / "2023_segundavuelta" / "ResultadosElectorales_2023_SegundaVuelta.csv",
         "cargos": ["PRESIDENTE", "PRESIDENTE Y VICE"],
         "alianzas": ALIANZAS_2023_BAL},
        {"label": "2023_diputados", "year": 2023, "cargo": "Diputados Nac.",
         "csv": RAW / "2023_Generales" / "ResultadoElectorales_2023_Generales.csv",
         "cargos": ["DIPUTADO NACIONAL", "DIPUTADOS NACIONALES"],
         "alianzas": ALIANZAS_2023_LEGIS},
        {"label": "2023_senadores", "year": 2023, "cargo": "Senadores Nac.",
         "csv": RAW / "2023_Generales" / "ResultadoElectorales_2023_Generales.csv",
         "cargos": ["SENADOR NACIONAL", "SENADORES NACIONALES"],
         "alianzas": ALIANZAS_2023_LEGIS},
    ]

    catalog = {"elecciones": []}
    for run in RUNS:
        if not run["csv"].exists():
            print(f"  [SKIP] {run['label']}: no se encontró {run['csv']}")
            continue
        prov, depto = aggregate(run["csv"], run["alianzas"], run["cargos"], run["label"])
        path_prov = WEB / f"elecciones_{run['label']}_provincia.json"
        path_depto = WEB / f"elecciones_{run['label']}_departamento.json"
        path_prov.write_text(json.dumps(prov, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        path_depto.write_text(json.dumps(depto, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"  -> {path_prov.name} ({path_prov.stat().st_size/1024:.0f} KB)")
        print(f"  -> {path_depto.name} ({path_depto.stat().st_size/1024:.0f} KB)")
        catalog["elecciones"].append({
            "id": run["label"],
            "year": run["year"],
            "cargo": run["cargo"],
            "alianzas": list(run["alianzas"].keys()),
            "file_provincia": f"data/elecciones_{run['label']}_provincia.json",
            "file_departamento": f"data/elecciones_{run['label']}_departamento.json",
            "n_provincias": len(prov),
            "n_departamentos": len(depto),
        })

    cat_path = CATALOGS / "elecciones.json"
    cat_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nCatálogo: {cat_path}")
    print("ETL elecciones completo.")


if __name__ == "__main__":
    main()
