"""ETL de resultados electorales DINE — Generales 2023 + Balotaje 2023.

Procesa los CSVs provisorios oficiales (DINE / datos.gob.ar) y agrega a nivel
provincia + departamento (matcheo por nombre con `data/web/departamentos.geojson`).

Salidas:
    data/web/elecciones_2023_generales_provincia.json
    data/web/elecciones_2023_generales_departamento.json
    data/web/elecciones_2023_balotaje_provincia.json
    data/web/elecciones_2023_balotaje_departamento.json
    catalogs/elecciones.json

Variables por área:
    padron, votantes, participacion
    votos_pos, votos_blanco, votos_nulo
    blanco_pct, nulo_pct
    {alianza}_pct  para cada fuerza catalogada
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
RAW = PROJECT / "data" / "raw" / "elecciones"
WEB = PROJECT / "data" / "web"
CATALOGS = PROJECT / "catalogs"
WEB.mkdir(parents=True, exist_ok=True)
CATALOGS.mkdir(parents=True, exist_ok=True)

ALIANZAS_GEN_2023 = {
    "lla":     ["LA LIBERTAD AVANZA"],
    "pj":      ["UNION POR LA PATRIA", "UNIÓN POR LA PATRIA"],
    "jxc":     ["JUNTOS POR EL CAMBIO"],
    "hacemos": ["HACEMOS POR NUESTRO PAIS", "HACEMOS POR NUESTRO PAÍS"],
    "izq":     ["FRENTE DE IZQUIERDA Y DE TRABAJADORES - UNIDAD"],
}
ALIANZAS_BAL_2023 = {
    "lla": ["LA LIBERTAD AVANZA"],
    "pj":  ["UNION POR LA PATRIA", "UNIÓN POR LA PATRIA"],
}
# Para diputados/senadores hay variantes provinciales — agregamos algunos sinónimos
ALIANZAS_LEGIS_2023 = {
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
    # Normalizar Comuna NN → Comuna N (sin padding)
    m = re.match(r"^comuna_(\d+)$", s)
    if m:
        s = f"comuna_{int(m.group(1))}"
    return s


def vec_slug(series: pd.Series) -> pd.Series:
    s = series.fillna("").astype(str)
    s = s.str.normalize("NFKD").str.encode("ascii", errors="ignore").str.decode("ascii")
    s = s.str.lower().str.replace(r"[^a-z0-9]+", "_", regex=True).str.strip("_")
    s = s.str.replace(PREFIX_RE, "", regex=True).str.lstrip("_")
    # Comuna NN → Comuna N
    s = s.str.replace(r"^comuna_0*(\d+)$", r"comuna_\1", regex=True)
    return s


def alianza_mapper(alianzas: dict[str, list[str]]):
    """Devuelve un dict literal_match→alianza (case-insensitive)."""
    direct = {}
    for k, aliases in alianzas.items():
        for a in aliases:
            direct[a.upper()] = k
    return direct


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
        # NOTA: el campo `provincia` del geojson de deptos tiene "IGN" (fuente).
        # Para sacar la provincia real usamos los 2 primeros dígitos del codigo.
        prov_name = prov_by_code.get(cod[:2], "")
        ps = slug(prov_name)
        ds = slug(p.get("nombre", ""))
        if not ps or not ds:
            continue
        depto_lookup.setdefault(ps, {})[ds] = cod
    return depto_lookup, prov_lookup


def aggregate(csv_path: Path, alianzas: dict, cargo_filter: str, label: str, exact_cargo: bool = False) -> tuple[dict, dict]:
    print(f"[{label}] leyendo {csv_path.name} ({csv_path.stat().st_size/1024**2:.0f} MB)…")
    depto_lookup, prov_lookup = load_lookups()
    alianza_map = alianza_mapper(alianzas)
    alianza_keys = list(alianzas.keys())

    # Acumuladores por (prov_s, depto_s)
    # Estructura: dict de prov_s, depto_s → dict campo→int
    # Mantenemos también un set de mesas vistas (para no duplicar padrón)
    agg: dict[tuple[str, str], dict] = {}

    # mesas_padron: por chunk leemos primero la sub-tabla mesa→electores
    # y la sumamos al cierre (deduplicada).
    # Para simplificar: el padrón lo computamos al final con un pase aparte de
    # mesa_id únicos. Eso evita el doble conteo entre chunks.
    mesa_padron_rows = []  # lista de DataFrames mesa-prov-depto-electores

    CHUNK = 500_000
    USE = ["distrito_nombre", "seccion_nombre", "mesa_id", "mesa_electores",
           "cargo_nombre", "agrupacion_nombre", "votos_tipo", "votos_cantidad"]

    reader = pd.read_csv(csv_path, usecols=USE, chunksize=CHUNK, dtype=str, low_memory=False)
    total = 0
    for ch in reader:
        # Filtrar cargo (exact match si se pidió, para no agarrar PROVINCIAL cuando se quiere NACIONAL)
        cargo_col = ch["cargo_nombre"].fillna("")
        if exact_cargo:
            mask = cargo_col.str.upper() == cargo_filter.upper()
        else:
            mask = cargo_col.str.contains(cargo_filter, case=False, na=False)
        ch = ch.loc[mask].copy()
        if ch.empty:
            continue

        ch["votos_cantidad"] = pd.to_numeric(ch["votos_cantidad"], errors="coerce").fillna(0).astype("int64")
        ch["mesa_electores"] = pd.to_numeric(ch["mesa_electores"], errors="coerce").fillna(0).astype("int64")
        ch["prov_s"] = vec_slug(ch["distrito_nombre"])
        ch["depto_s"] = vec_slug(ch["seccion_nombre"])

        # Mesa padrón (una fila por mesa con sus electores)
        mp = (ch[["prov_s", "depto_s", "mesa_id", "mesa_electores"]]
              .drop_duplicates(subset=["prov_s", "depto_s", "mesa_id"]))
        mesa_padron_rows.append(mp)

        # Votos por tipo (agregamos por prov, depto)
        # 1) Totales por tipo
        votos_por_tipo = (ch.groupby(["prov_s", "depto_s", "votos_tipo"])["votos_cantidad"]
                            .sum().unstack(fill_value=0))

        # 2) Votos por alianza (solo POSITIVOS)
        pos = ch[ch["votos_tipo"] == "POSITIVO"].copy()
        if not pos.empty:
            pos["alianza"] = pos["agrupacion_nombre"].fillna("").str.upper().map(alianza_map).fillna("")
            votos_por_alianza = (pos[pos["alianza"] != ""]
                                  .groupby(["prov_s", "depto_s", "alianza"])["votos_cantidad"]
                                  .sum().unstack(fill_value=0))
        else:
            votos_por_alianza = pd.DataFrame()

        # Mergeamos en agg
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
        print(f"  filas {total:,}  | {len(agg):,} (prov,depto) acum.")

    # Padrón final (deduplicado por mesa global)
    if mesa_padron_rows:
        padron_df = pd.concat(mesa_padron_rows, ignore_index=True)
        padron_df = padron_df.drop_duplicates(subset=["prov_s", "depto_s", "mesa_id"])
        padron_by = padron_df.groupby(["prov_s", "depto_s"])["mesa_electores"].sum()
        for (ps, ds), val in padron_by.items():
            agg.setdefault((ps, ds), {**{f"votos_{t.lower()}": 0 for t in VOTO_TIPOS},
                                       **{a: 0 for a in alianza_keys}})
            agg[(ps, ds)]["padron"] = int(val)

    # Computar derivados y mapear a códigos INDEC
    def add_derived(rec: dict, alianzas_keys: list[str]) -> dict:
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
        for a in alianzas_keys:
            rec[f"{a}_pct"] = round(rec[a] / positivos, 4) if positivos else None
        # Limpiar campos crudos para reducir peso JSON
        for t in VOTO_TIPOS:
            rec.pop(f"votos_{t.lower()}", None)
        return rec

    out_depto: dict[str, dict] = {}
    out_prov_raw: dict[str, dict] = {}  # acumulador prov_s
    for (ps, ds), rec in agg.items():
        rec = add_derived(rec, alianza_keys)
        # Depto
        code = depto_lookup.get(ps, {}).get(ds)
        if code:
            out_depto[code] = {k: v for k, v in rec.items() if not k.startswith("_")}
        # Provincia acumulado: sumamos los totales crudos (recalculamos)
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
    CSV_GEN = RAW / "2023_Generales" / "ResultadoElectorales_2023_Generales.csv"
    runs = [
        {"label": "2023_generales", "csv": CSV_GEN,
         "alianzas": ALIANZAS_GEN_2023, "cargo": "PRESIDENTE", "exact": False},
        {"label": "2023_balotaje",
         "csv": RAW / "2023_segundavuelta" / "ResultadosElectorales_2023_SegundaVuelta.csv",
         "alianzas": ALIANZAS_BAL_2023, "cargo": "PRESIDENTE", "exact": False},
        {"label": "2023_diputados", "csv": CSV_GEN,
         "alianzas": ALIANZAS_LEGIS_2023, "cargo": "DIPUTADO NACIONAL", "exact": True},
        {"label": "2023_senadores", "csv": CSV_GEN,
         "alianzas": ALIANZAS_LEGIS_2023, "cargo": "SENADOR NACIONAL", "exact": True},
    ]
    catalog = {"elecciones": []}
    for run in runs:
        if not run["csv"].exists():
            print(f"  [SKIP] {run['label']}"); continue
        prov, depto = aggregate(run["csv"], run["alianzas"], run["cargo"], run["label"],
                                exact_cargo=run.get("exact", False))
        path_prov = WEB / f"elecciones_{run['label']}_provincia.json"
        path_depto = WEB / f"elecciones_{run['label']}_departamento.json"
        path_prov.write_text(json.dumps(prov, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        path_depto.write_text(json.dumps(depto, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"  -> {path_prov.name} ({path_prov.stat().st_size/1024:.0f} KB)")
        print(f"  -> {path_depto.name} ({path_depto.stat().st_size/1024:.0f} KB)")
        catalog["elecciones"].append({
            "id": run["label"],
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
