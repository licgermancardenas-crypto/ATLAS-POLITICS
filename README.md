# ATLAS politics

Plataforma interactiva para visualizar y analizar información política, electoral y socioeconómica de la **República Argentina** en múltiples niveles territoriales: país, provincia, departamento/partido, municipio, localidad y radio censal.

## Filosofía

- **Frontend estático** (HTML + Leaflet + JS vanilla) publicable en GitHub Pages, sin servidor.
- **ETL en Python** que toma datos crudos (shapefiles IGN/INDEC, CSVs, APIs) y los normaliza a GeoJSON simplificado + JSON de indicadores listos para web.
- **APIs públicas en vivo** consultadas directamente desde el navegador (argentinadatos, BCRA).
- **Todo el código y la data publicada** en este repositorio para reproducibilidad.

## Estructura

```
ATLAS politics/
├── data/
│   ├── raw/           # Datos crudos (no se versionan; ver .gitignore)
│   ├── processed/     # GeoJSON sin simplificar (analítico; no versionado)
│   └── web/           # GeoJSON simplificado + indicadores JSON
├── scripts/           # ETL Python numerado por orden de ejecución
│   ├── 01_etl_geometrias.py     # IGN: país, prov, deptos, municipios, gob.locales
│   ├── 02_etl_censo.py          # INDEC Censo 2022: indicadores prov + depto
│   ├── 03_etl_apis.py           # Cataloga endpoints en vivo (argentinadatos, BCRA)
│   ├── 04_etl_localidades.py    # INDEC: 3.526 localidades con población
│   ├── 05_etl_radios.py         # INDEC: 50.223 radios censales en 22 provincias
│   └── 06_etl_elecciones.py     # DINE: Generales 2023 + Balotaje 2023 por prov+depto
├── web/
│   ├── index.html
│   ├── css/app.css
│   └── js/app.js
├── catalogs/          # Metadatos de capas, indicadores y APIs
└── requirements.txt
```

## Niveles territoriales (6)

| Nivel | Fuente | Capa web | N |
|---|---|---|---|
| País | IGN | `pais.geojson` | 1 |
| Provincias | IGN + INDEC | `provincias.geojson` | 24 |
| Deptos./Partidos | IGN + INDEC 2022 | `departamentos.geojson` | 529 |
| Municipios | IGN | `municipios.geojson` | 2.114 |
| Localidades | INDEC 2022 | `localidades.geojson` (puntos) | 3.526 |
| Radios censales | INDEC 2022 | `radios/<codigo_prov>.geojson` (22 archivos lazy-load) | 50.223 |

## Datasets integrados

### Censo 2022 INDEC

Por provincia, departamento, localidad y radio:
- `personas`, `mujeres`, `varones`
- `hogares`, `viv_part`, `viv_part_h`
- Derivados: `personas_por_vivienda`, `personas_por_hogar`, `idx_masculinidad`

### Elecciones Generales 2023 (Presidente)

Por provincia + departamento (matching por nombre con INDEC):
- `lla_pct`, `pj_pct`, `jxc_pct`, `hacemos_pct`, `izq_pct`
- `participacion`, `blanco_pct`, `nulo_pct`
- Conteos crudos: `padron`, `votantes`, `votos_pos`, `lla`, `pj`, `jxc`, `hacemos`, `izq`

### Balotaje 2023 (Presidente)

Mismo schema, solo dos alianzas: `lla_pct` y `pj_pct`.

### Diputados Nacionales 2023

Por provincia + departamento. Variables `lla_pct`, `pj_pct`, `jxc_pct`, `hacemos_pct`, `izq_pct`, `participacion`. Las coaliciones JxC y Hacemos incluyen variantes provinciales (ej. "Encuentro por Corrientes", "Hacemos Unidos por Santa Fe") sumadas a las nacionales.

### Senadores Nacionales 2023 (8 provincias)

Solo se renovaron senadores en: Buenos Aires, Formosa, Jujuy, La Rioja, Misiones, San Juan, San Luis, Santa Cruz. Variables: `lla_pct`, `pj_pct`, `jxc_pct`, `participacion`. Las provincias sin datos no aparecen en el dataset.

## APIs en vivo (consumidas desde el navegador)

- **argentinadatos**: cotizaciones de dólar, inflación mensual e interanual, riesgo país, índice UVA, tasas plazo fijo, feriados, senadores, diputados, presidentes.
- **BCRA v4.0**: `/estadisticas/v4.0/Monetarias` (principales variables monetarias).

Ver `catalogs/apis.json` para esquemas y probe de cada endpoint.

## Features del frontend

- Mapa Leaflet con basemap CartoDB Dark.
- **Auto-zoom de capas**: el nivel se cambia solo según el zoom (país → radios).
- **Selector de dataset**: Censo 2022 / Generales 2023 / Balotaje 2023. Cada uno trae su set de variables y paletas (LLA púrpura, PJ rojo, JxC azul).
- **Choropleth dinámico**: selector de variable colorea la capa activa por quantiles.
- **Búsqueda con autocomplete** sobre provincias/deptos/municipios/localidades.
- **Panel de territorio**: KPIs, fila comparativa (vs media, vs mediana, vs país), mini-histograma con la feature destacada.
- **Tab Ranking**: top-10 / bottom-10 por variable activa.
- **Tabs en vivo**: Economía (dólar, inflación 12m, riesgo país 30d), Política (composición Senado y Diputados por bloque).
- **Permalinks** (`#ds=...&l=...&v=...&c=...&z=...&xy=...`) y export CSV de la capa activa.
- Carga diferida de radios por provincia.

## Instalación y uso

```bash
pip install -r requirements.txt

# ETL completo (regenera data/web/* y catalogs/*.json)
python scripts/01_etl_geometrias.py
python scripts/02_etl_censo.py
python scripts/03_etl_apis.py
python scripts/04_etl_localidades.py
python scripts/05_etl_radios.py
python scripts/06_etl_elecciones.py

# Servir frontend localmente (desde la raíz del repo)
python -m http.server 8765
# → http://localhost:8765/web/
```

Los scripts ETL asumen rutas a datos crudos en `C:/Users/corra/Downloads/` — adaptar al entorno donde se ejecuten.

## Fuentes

- **IGN** — https://www.ign.gob.ar/NuestrasActividades/InformacionGeoespacial/CapasSIG
- **INDEC Censo 2022** — https://www.indec.gob.ar/indec/web/Nivel4-Tema-2-41-165
- **datos.gob.ar** — https://datos.gob.ar/apis
- **argentinadatos** — https://argentinadatos.com/docs/
- **BCRA** — https://api.bcra.gob.ar/

## Licencia

MIT
