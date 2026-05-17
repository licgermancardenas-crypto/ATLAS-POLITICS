"""Catálogo de APIs en vivo para ATLAS politics.

No bajamos datos: solo describimos endpoints públicos que el frontend
consulta directamente desde el navegador (CORS abierto). Pegamos un sample
de respuesta en `_samples/` para que el frontend sepa qué esperar.

APIs catalogadas:
- argentinadatos.com   (cotizaciones, inflación, riesgo país, índices, política)
- BCRA Estadísticas    (Principales Variables monetarias y cambiarias)
- datos.gob.ar         (catálogo nacional — solo referencia)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT = Path(r"C:/Users/corra/Desktop/ATLAS politics")
CATALOGS = PROJECT / "catalogs"
SAMPLES = PROJECT / "data" / "raw" / "_samples_api"

CATALOGS.mkdir(parents=True, exist_ok=True)
SAMPLES.mkdir(parents=True, exist_ok=True)

UA = {"User-Agent": "ATLAS-politics/0.1 (+https://github.com)"}
TIMEOUT = 15

ENDPOINTS = [
    # --- argentinadatos ---
    {
        "id": "ad_dolares",
        "provider": "argentinadatos",
        "category": "economia",
        "label": "Dólares (cotizaciones oficial, blue, MEP, CCL, etc.)",
        "url": "https://api.argentinadatos.com/v1/cotizaciones/dolares",
        "method": "GET",
        "shape": "array",
    },
    {
        "id": "ad_inflacion",
        "provider": "argentinadatos",
        "category": "economia",
        "label": "Inflación mensual histórica",
        "url": "https://api.argentinadatos.com/v1/finanzas/indices/inflacion",
        "method": "GET",
        "shape": "array",
    },
    {
        "id": "ad_inflacion_inter",
        "provider": "argentinadatos",
        "category": "economia",
        "label": "Inflación interanual",
        "url": "https://api.argentinadatos.com/v1/finanzas/indices/inflacionInteranual",
        "method": "GET",
        "shape": "array",
    },
    {
        "id": "ad_riesgo_pais",
        "provider": "argentinadatos",
        "category": "economia",
        "label": "Riesgo país (EMBI+) histórico",
        "url": "https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais",
        "method": "GET",
        "shape": "array",
    },
    {
        "id": "ad_uva",
        "provider": "argentinadatos",
        "category": "economia",
        "label": "Índice UVA histórico",
        "url": "https://api.argentinadatos.com/v1/finanzas/indices/uva",
        "method": "GET",
        "shape": "array",
    },
    {
        "id": "ad_feriados_actual",
        "provider": "argentinadatos",
        "category": "calendario",
        "label": "Feriados del año en curso",
        "url": "https://api.argentinadatos.com/v1/feriados",
        "method": "GET",
        "shape": "array",
    },
    {
        "id": "ad_senadores",
        "provider": "argentinadatos",
        "category": "politica",
        "label": "Senadores nacionales actuales",
        "url": "https://api.argentinadatos.com/v1/senado/senadores",
        "method": "GET",
        "shape": "array",
    },
    {
        "id": "ad_diputados",
        "provider": "argentinadatos",
        "category": "politica",
        "label": "Diputados nacionales actuales",
        "url": "https://api.argentinadatos.com/v1/diputados/diputados",
        "method": "GET",
        "shape": "array",
    },
    {
        "id": "ad_presidentes",
        "provider": "argentinadatos",
        "category": "politica",
        "label": "Presidentes argentinos (histórico)",
        "url": "https://api.argentinadatos.com/v1/presidentes",
        "method": "GET",
        "shape": "array",
    },
    {
        "id": "ad_plazo_fijo",
        "provider": "argentinadatos",
        "category": "economia",
        "label": "Tasas de plazo fijo por banco",
        "url": "https://api.argentinadatos.com/v1/finanzas/tasas/plazoFijo",
        "method": "GET",
        "shape": "array",
    },
    # --- BCRA ---
    {
        "id": "bcra_principales",
        "provider": "bcra",
        "category": "economia",
        "label": "BCRA — Principales Variables monetarias",
        "url": "https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias",
        "method": "GET",
        "shape": "object",
        "notas": "Requiere verify=False en algunos entornos (cert chain BCRA).",
    },
]


def fetch_sample(ep: dict) -> dict:
    """Trae una muestra del endpoint y la guarda en _samples_api/. No bloquea si falla."""
    result = {"id": ep["id"], "ok": False}
    try:
        r = requests.get(ep["url"], headers=UA, timeout=TIMEOUT, verify=ep["provider"] != "bcra")
        result["status"] = r.status_code
        if r.status_code == 200:
            data = r.json()
            # Sample: primeros 3 elementos si es lista
            sample = data[:3] if isinstance(data, list) else data
            sample_path = SAMPLES / f"{ep['id']}.json"
            sample_path.write_text(json.dumps(sample, ensure_ascii=False, indent=2), encoding="utf-8")
            result["ok"] = True
            result["sample_file"] = str(sample_path.relative_to(PROJECT))
            result["n"] = len(data) if isinstance(data, list) else None
        else:
            result["error"] = f"HTTP {r.status_code}"
    except Exception as e:
        result["error"] = f"{type(e).__name__}: {e}"
    return result


def main() -> None:
    print(f"Probando {len(ENDPOINTS)} endpoints…")
    enriched = []
    for ep in ENDPOINTS:
        res = fetch_sample(ep)
        status_str = "OK" if res["ok"] else f"FAIL ({res.get('error') or res.get('status')})"
        print(f"  [{status_str:>20}] {ep['id']}")
        enriched.append({**ep, "_probe": res})

    catalog = {
        "version": "1.0",
        "descripcion": "Endpoints públicos consumidos en vivo por el frontend ATLAS politics.",
        "endpoints": enriched,
    }
    out = CATALOGS / "apis.json"
    out.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nCatálogo: {out}")


if __name__ == "__main__":
    main()
