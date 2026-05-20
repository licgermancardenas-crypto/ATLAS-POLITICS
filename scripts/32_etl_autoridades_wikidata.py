"""ETL Autoridades — intendentes / gobernadores via Wikidata SPARQL.

Output: data/web/autoridades.json
    keyed por codigo_indec_depto:
        intendente, partido, periodo, wikidata_id

NOTA: Wikidata es comunitaria y la cobertura varía. Esperamos cobertura
buena para CABA/PBA/Córdoba/SF, menor para municipios chicos. La fuente
oficial es el INDEC pero no expone esta data.
"""
from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
from pathlib import Path

import requests


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    s = re.sub(r"^(provincia (de|del) |partido (de|del) |departamento (de|del) |municipio (de|del) )", "", s)
    return re.sub(r"\s+", " ", s).strip()

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT = Path(r"C:/Users/corra/Desktop/ATLAS politics")
WEB = PROJECT / "data" / "web"
WD = "https://query.wikidata.org/sparql"

# Query: municipios argentinos (P31 = Q5118 partido del conurbano OR Q2074737 partido + país Q414)
# con intendente actual (P6 = head of government).
QUERY_INTENDENTES = """
SELECT DISTINCT ?muni ?muniLabel ?provincia ?provinciaLabel ?head ?headLabel ?partido ?partidoLabel WHERE {
  ?muni wdt:P17 wd:Q414 .                  # country = Argentina
  ?muni p:P6 ?stmt.
  ?stmt ps:P6 ?head.
  FILTER NOT EXISTS { ?stmt pq:P582 ?end. }   # vigente
  # Excluir provincias y país
  FILTER NOT EXISTS { ?muni wdt:P31 wd:Q44753. }
  FILTER NOT EXISTS { ?muni wdt:P31 wd:Q6256. }
  OPTIONAL { ?muni wdt:P131 ?provincia. }
  OPTIONAL { ?head wdt:P102 ?partido. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
LIMIT 5000
"""

QUERY_GOBERNADORES = """
SELECT DISTINCT ?prov ?provLabel ?gob ?gobLabel ?partido ?partidoLabel WHERE {
  ?prov wdt:P31 wd:Q44753 .               # provincia de Argentina (Q44753)
  ?prov p:P6 ?stmt.
  ?stmt ps:P6 ?gob.
  FILTER NOT EXISTS { ?stmt pq:P582 ?end. }
  OPTIONAL { ?gob wdt:P102 ?partido. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
"""

UA = {"User-Agent": "ATLAS-politics/1.0 (https://github.com/licgermancardenas-crypto/ATLAS-POLITICS)"}


def sparql(q: str) -> list[dict]:
    r = requests.get(WD, params={"query": q, "format": "json"}, headers=UA, timeout=120)
    r.raise_for_status()
    return r.json()["results"]["bindings"]


def main() -> None:
    print("[gobernadores]")
    try:
        rows = sparql(QUERY_GOBERNADORES)
        print(f"  {len(rows)} rows")
    except Exception as e:
        print(f"  ERROR: {e}"); rows = []
    govs: dict[str, dict] = {}
    for row in rows:
        prov = row.get("provLabel", {}).get("value", "")
        gob = row.get("gobLabel", {}).get("value", "")
        partido = row.get("partidoLabel", {}).get("value", "")
        gob_id = row.get("gob", {}).get("value", "").split("/")[-1]
        if prov and gob:
            govs[prov] = {"gobernador": gob, "partido_gob": partido, "wikidata_id_gob": gob_id}

    time.sleep(1)

    print("[intendentes]")
    try:
        rows = sparql(QUERY_INTENDENTES)
        print(f"  {len(rows)} rows")
    except Exception as e:
        print(f"  ERROR: {e}"); rows = []
    munis: dict[str, dict] = {}
    for row in rows:
        muni_lbl = row.get("muniLabel", {}).get("value", "")
        head_lbl = row.get("headLabel", {}).get("value", "")
        partido = row.get("partidoLabel", {}).get("value", "")
        head_id = row.get("head", {}).get("value", "").split("/")[-1] if "head" in row else ""
        muni_id = row.get("muni", {}).get("value", "").split("/")[-1]
        if muni_lbl and head_lbl:
            munis[muni_lbl] = {
                "intendente": head_lbl,
                "partido_intendente": partido,
                "wikidata_id_muni": muni_id,
                "wikidata_id_int": head_id,
            }

    # Mapear por codigo INDEC de departamentos.geojson
    dpto_geo = json.loads((WEB / "departamentos.geojson").read_text(encoding="utf-8"))
    prov_geo = json.loads((WEB / "provincias.geojson").read_text(encoding="utf-8"))
    by_code: dict[str, dict] = {}

    # Intendentes por código depto
    name_to_code: dict[str, str] = {}
    for f in dpto_geo["features"]:
        p = f["properties"]
        code = p.get("codigo_indec")
        if code:
            name_to_code[slug(p.get("nombre", ""))] = code
    for muni_name, info in munis.items():
        s = slug(muni_name)
        code = name_to_code.get(s)
        if code:
            by_code[code] = {**info, "_match": muni_name}

    # Gobernadores: mapear a código provincia
    prov_to_code: dict[str, str] = {}
    for f in prov_geo["features"]:
        p = f["properties"]
        code = p.get("codigo_indec")
        if code:
            prov_to_code[slug(p.get("nombre", ""))] = code
    govs_by_code: dict[str, dict] = {}
    for prov_name, info in govs.items():
        s = slug(prov_name)
        code = prov_to_code.get(s)
        if code:
            govs_by_code[code] = {**info, "_match": prov_name}

    out = {
        "intendentes_por_depto": by_code,
        "gobernadores_por_provincia": govs_by_code,
        "fuente": "Wikidata SPARQL · query.wikidata.org",
        "actualizado": time.strftime("%Y-%m-%d"),
    }
    out_path = WEB / "autoridades.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"-> {out_path.name}")
    print(f"   {len(govs_by_code)}/{len(govs)} gobs matched")
    print(f"   {len(by_code)}/{len(munis)} intendentes matched")


if __name__ == "__main__":
    main()
