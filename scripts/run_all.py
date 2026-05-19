"""Ejecutor maestro: corre todos los ETL en orden.

Uso:
    python scripts/run_all.py                # corre todo
    python scripts/run_all.py --skip 01,05  # excluye scripts 01 y 05
    python scripts/run_all.py --only 06,16  # solo los listados
    python scripts/run_all.py --skip-heavy   # omite los pesados (radios + elecciones full)

Marca timing y errors. Imprime resumen al final.
"""
from __future__ import annotations

import argparse
import importlib.util
import re
import subprocess
import sys
import time
from pathlib import Path

PROJECT = Path(__file__).parent.parent
SCRIPTS = PROJECT / "scripts"

# Inventario de ETLs
ETLS = [
    ("01", "01_etl_geometrias.py",          "Geometrías IGN (5 capas)",                "heavy"),
    ("02", "02_etl_censo.py",                "Censo 2022 prov+depto + área km²",        "fast"),
    ("03", "03_etl_apis.py",                 "Probe + catálogo APIs en vivo",           "fast"),
    ("04", "04_etl_localidades.py",          "INDEC 3.526 localidades",                 "fast"),
    ("05", "05_etl_radios.py",               "INDEC 50.223 radios censales",            "heavy"),
    ("06", "06_etl_elecciones.py",           "DINE 2015-2023 (10 elecciones)",           "heavy"),
    ("07", "07_etl_economia_provincia.py",   "Exportaciones por prov (SSPM)",           "fast"),
    ("08", "08_etl_socio_provincia.py",      "Mortalidad infantil + fetal (DEIS)",      "fast"),
    ("09", "09_etl_ipc_provincia.py",        "IPC INDEC 6 regiones",                    "fast"),
    ("10", "10_etl_empleo_provincia.py",     "Desempleo EPH por aglom.",                "fast"),
    ("11", "11_etl_salud_provincia.py",      "REFES 26.985 establec. salud",            "fast"),
    ("12", "12_etl_educacion_provincia.py",  "Padrón educativo 64.601 escuelas",        "fast"),
    ("13", "13_etl_vacunas_provincia.py",    "Vacuna SRP (DICEI)",                       "fast"),
    ("14", "14_etl_pba_municipal.py",        "PBA municipios (transf + camas)",         "fast"),
    ("15", "15_etl_caba_comunal.py",         "CABA delitos + vivienda por comuna",      "fast"),
    ("16", "16_etl_extras.py",               "Trade flows + COVID vacunación",          "fast"),
    ("17", "17_etl_pba_elecciones.py",       "PBA Pres+Dip+Sen 2011-2023",              "heavy"),
    ("18", "18_etl_agro_provincia.py",       "SAGyP estimaciones agrícolas",            "fast"),
    ("19", "19_etl_egresos_pba.py",          "PBA egresos hospitalarios",               "fast"),
    ("20", "20_etl_trade_bloques.py",        "Trade por bloque económico",              "fast"),
    ("21", "21_etl_energia_provincia.py",    "Centrales eléctricas",                    "fast"),
    ("22", "22_etl_ganaderia_provincia.py",  "SENASA bovinos",                          "fast"),
    ("23", "23_etl_mineria_provincia.py",    "Mineria exportaciones",                   "fast"),
    ("24", "24_etl_pesca_provincia.py",      "Pesca marítima",                          "fast"),
    ("25", "25_etl_pobreza_aglomerado.py",   "Pobreza por aglomerado EPH",              "fast"),
]


def run(script: Path) -> tuple[bool, float, str]:
    start = time.time()
    try:
        r = subprocess.run(
            [sys.executable, str(script)],
            capture_output=True, text=True, timeout=900,
        )
        elapsed = time.time() - start
        if r.returncode == 0:
            tail = "\n".join(r.stdout.strip().split("\n")[-3:])
            return True, elapsed, tail
        else:
            return False, elapsed, (r.stderr or r.stdout)[:500]
    except subprocess.TimeoutExpired:
        return False, time.time() - start, "TIMEOUT >15 min"
    except Exception as e:
        return False, time.time() - start, f"{type(e).__name__}: {e}"


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--skip", default="", help="IDs a saltar separados por coma (ej. 01,05)")
    p.add_argument("--only", default="", help="Correr solo estos IDs (ej. 06,16)")
    p.add_argument("--skip-heavy", action="store_true", help="Saltar los pesados")
    args = p.parse_args()

    skip = set(args.skip.split(",")) if args.skip else set()
    only = set(args.only.split(",")) if args.only else None

    results = []
    print(f"{'ID':>4} {'TIPO':>6}  {'TIEMPO':>8}  ESTADO  {'NOMBRE'}")
    print("-" * 80)
    for id_, fname, desc, weight in ETLS:
        if id_ in skip: continue
        if only and id_ not in only: continue
        if args.skip_heavy and weight == "heavy": continue
        script = SCRIPTS / fname
        if not script.exists():
            print(f"{id_:>4} {weight:>6}  {'':>8}  SKIP    {desc} (no existe)")
            results.append((id_, "skip", 0))
            continue
        print(f"{id_:>4} {weight:>6}  {'corriendo':>8}  ...     {desc}", flush=True)
        ok, elapsed, tail = run(script)
        status = "OK" if ok else "FAIL"
        print(f"{id_:>4} {weight:>6}  {elapsed:>6.1f}s  {status:<6}  {desc}")
        if not ok:
            print(f"     stderr/tail: {tail[:300]}")
        results.append((id_, status, elapsed))

    print()
    ok_n = sum(1 for _, s, _ in results if s == "OK")
    fail_n = sum(1 for _, s, _ in results if s == "FAIL")
    total_time = sum(t for _, _, t in results)
    print(f"=== {ok_n} OK · {fail_n} FAIL · {total_time:.0f}s total ===")


if __name__ == "__main__":
    main()
