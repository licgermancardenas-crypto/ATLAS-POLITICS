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

### Histórico electoral 2015 → 2023 (10 datasets)

Por provincia + departamento, matcheando por nombre con INDEC:

| Año | Elección | Variables principales |
|---|---|---|
| 2015 | Presidente Generales | pj (FPV), jxc (Cambiemos), una (Massa), prog (Stolbizer), comp_fed (RS), izq (FIT) |
| 2015 | Presidente Balotaje | pj, jxc |
| 2017 | Diputados Nac. | jxc (Cambiemos), pj (FpV/Justicialista/UC), 1pais (Massa), izq |
| 2019 | Presidente PASO | pj (FdT), jxc, cf (Lavagna), nos (Centurión), izq |
| 2019 | Presidente Generales | mismo schema 2019 PASO |
| 2021 | Diputados Nac. | pj (FdT), jxc, **lla** (primera aparición), izq, vcv (Randazzo) |
| 2023 | Presidente Generales | lla, pj (UP), jxc, hacemos, izq |
| 2023 | Presidente Balotaje | lla, pj |
| 2023 | Diputados Nac. | mismo schema 2023 generales |
| 2023 | Senadores Nac. (8 prov.) | mismo schema 2023, solo prov. que renovaron (BsAs, Formosa, Jujuy, La Rioja, Misiones, San Juan, San Luis, Santa Cruz) |

Todas las variables tienen su `_pct` (porcentaje sobre votos positivos) + `participacion`, `blanco_pct`, `nulo_pct`, y los conteos crudos `padron`, `votantes`, `votos_pos`, `votos_blanco`, `votos_nulo`. Las claves PJ y JxC son **estables a lo largo de los años** (suman las coaliciones equivalentes), habilitando análisis de swing temporal.

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

## Datasets integrados (resumen)

| Dataset | Fuente | Granularidad | Cobertura |
|---|---|---|---|
| Geometrías 5 niveles | IGN | país→muni | 2.114 muni · 529 deptos · 24 prov |
| Localidades | INDEC | punto | 3.526 |
| Radios censales | INDEC 2022 | polígono | 50.223 (22 prov) |
| Censo 2022 indicadores | INDEC | prov+depto+loc+radio | personas, hogares, viv, densidad, etc. |
| Elecciones 2015 Generales | DINE | prov+depto | Pres + 5 alianzas |
| Elecciones 2015 Balotaje | DINE | prov+depto | Pres + 2 alianzas |
| Elecciones 2017 Diputados | DINE | prov+depto | Cambiemos/FpV/1Pais/FIT |
| Elecciones 2019 PASO+Generales | DINE | prov+depto | FdT/JxC/CF/NOS/FIT |
| Elecciones 2021 Diputados | DINE | prov+depto | FdT/JxC/**LLA**/FIT/VcV |
| Elecciones 2023 (Pres+Bal+Dip+Sen) | DINE | prov+depto | LLA/UP/JxC/Hacemos/FIT |
| Exportaciones 2024 | SSPM | prov | 11 vars por rubro |
| IPC INDEC | INDEC | 6 regiones → 24 prov | mensual + interanual + acum 12m |
| Desempleo EPH | INDEC | aglomerado→prov | tasa trimestral |
| Pobreza nacional | INDEC EPH | nacional histórica | pobres/indigentes |
| Mortalidad infantil | DEIS | prov | 1990-2024 |
| Establec. de salud REFES | datos.salud.gob.ar | prov | 26.985 establec. |
| Escuelas 2024 | educacion.gob.ar | prov | 64.601 escuelas |
| Vacuna SRP cobertura | DICEI | prov | 2009-2019 |

**APIs en vivo** (consumidas desde el navegador, sin almacenar):
- `apis.datos.gob.ar/series` — Series de Tiempo Argentina (~28k series INDEC/SSPM/BCRA/Energía/Producción)
- `apis.datos.gob.ar/georef` — Geocoding (provincias, deptos, municipios, localidades, calles, direcciones)
- `api.argentinadatos.com` — dólar, inflación, riesgo país, plazo fijo, feriados, senadores, diputados, presidentes
- `api.bcra.gob.ar/estadisticas/v4.0` — Principales variables monetarias

## Fuentes oficiales

- **IGN** — https://www.ign.gob.ar/NuestrasActividades/InformacionGeoespacial/CapasSIG
- **INDEC** — https://www.indec.gob.ar/ · Censo 2022, IPC, EPH, mortalidad
- **datos.gob.ar (CKAN)** — https://datos.gob.ar/apis · catálogo nacional
- **Andino** (plataforma CKAN) — https://www.argentina.gob.ar/portal-andino
- **Series de Tiempo** — https://www.argentina.gob.ar/datos-abiertos/api-series-de-tiempo
- **Georef** — https://www.argentina.gob.ar/georef
- **Paquete de Apertura** — https://www.argentina.gob.ar/paquete-de-apertura (estándares OD)
- **datosgobar (GitHub)** — https://github.com/datosgobar (herramientas oficiales)
- **DINE / argentina.gob.ar** — resultados electorales provisorios
- **datos.salud.gob.ar** — DEIS, REFES, DICEI vacunación
- **data.educacion.gob.ar** — padrón establecimientos educativos
- **argentinadatos** — https://argentinadatos.com/docs/ (comunidad)
- **BCRA** — https://api.bcra.gob.ar/

## Licencia

MIT
