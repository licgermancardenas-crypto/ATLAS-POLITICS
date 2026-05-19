// ATLAS politics — frontend  (build 20260518a)
console.log("[ATLAS] build 20260519n · más Series API + outliers en ranking");

// Service worker registration
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

const LEVELS = {
  pais:          { file: "../data/web/pais.geojson",          weight: 1.5, color: "#5aa3ff", fill: 0.04, zMin: 0,  zMax: 5  },
  provincias:    { file: "../data/web/provincias.geojson",    weight: 1.0, color: "#7df2c6", fill: 0.10, zMin: 5,  zMax: 7  },
  departamentos: { file: "../data/web/departamentos.geojson", weight: 0.6, color: "#ffb454", fill: 0.10, zMin: 7,  zMax: 9  },
  municipios:    { file: "../data/web/municipios.geojson",    weight: 0.5, color: "#ff6b6b", fill: 0.10, zMin: 9,  zMax: 11 },
  localidades:   { file: "../data/web/localidades.geojson",   weight: 0,   color: "#c9a8ff", fill: 1.00, zMin: 9,  zMax: 12, point: true },
  radios:        { dir: "../data/web/radios",                 weight: 0.3, color: "#5aa3ff", fill: 0.12, zMin: 12, zMax: 20, lazyByProv: true },
};

const VAR_SCALES = {
  default: ["#0b3060", "#1762a0", "#3290cf", "#74c0e8", "#c8e6f4", "#fceabb", "#f6b26b", "#e07b39", "#b14a14", "#5e1a04"],
  // Paletas específicas por partido (más claras = menor %)
  lla:     ["#1b1730","#241d4c","#33267a","#4533a8","#6444cf","#8d63dd","#b288e8","#d3b5f1","#eedaf9","#fff"],
  pj:      ["#1f0c10","#3a1218","#5e1a23","#8a1f30","#b32540","#d12f4f","#e15e76","#ed8da0","#f5bcc8","#fff"],
  jxc:     ["#0a1828","#0e2645","#143a6b","#1b539a","#2e76c1","#5995d4","#84b3e0","#b0d0ea","#dbe7f3","#fff"],
  // Diverging para swing: rojo (caída) → gris → verde (suba)
  swing:   ["#7f1d1d","#b91c1c","#dc2626","#ef4444","#f87171","#9ca3af","#86efac","#4ade80","#22c55e","#15803d","#166534"],
  // Paleta categórica para clusters (no ordinal, hasta 8 grupos)
  cluster: ["#5aa3ff","#ff6b6b","#7df2c6","#ffb454","#b288e8","#ed8da0","#fceabb","#74c0e8"],
  // LISA: 0=ns, 1=HH (rojo), 2=LL (azul), 3=HL (naranja), 4=LH (cian)
  lisa: ["#3a3a4a","#ff6b6b","#5aa3ff","#ffb454","#7df2c6"],
};

// Helper para construir un dataset electoral con vars dinámicas
const ALIAS_LABELS = {
  pj: "% Peronismo (FPV/UC/FdT/UP)",
  jxc: "% JxC (Cambiemos/Juntos)",
  lla: "% LLA",
  izq: "% FIT",
  hacemos: "% Hacemos",
  una: "% UNA (Massa)",
  prog: "% Progresistas (Stolbizer)",
  comp_fed: "% Compromiso Federal (RS)",
  cf: "% Consenso Federal (Lavagna)",
  nos: "% NOS (Centurión)",
  vcv: "% Vamos con Vos (Randazzo)",
  "1pais": "% 1País (Massa)",
};
function makeElectoralDS(label, slug, alianzas, year) {
  const vars = alianzas.map(a => [`${a}_pct`, ALIAS_LABELS[a] || `% ${a}`]);
  vars.push(["participacion", "Participación"]);
  vars.push(["blanco_pct", "% Blanco"]);
  vars.push(["nulo_pct", "% Nulo+Recurrido"]);
  const defaultVar = alianzas.includes("lla") ? "lla_pct"
    : alianzas.includes("pj") ? "pj_pct" : `${alianzas[0]}_pct`;
  return {
    label, year,
    levels: ["provincias", "departamentos"],
    fileFor: (level) => `../data/web/elecciones_${slug}_${level === "provincias" ? "provincia" : "departamento"}.json`,
    vars,
    defaultVar,
    paletteFor: (v) => v === "lla_pct" ? "lla" : v === "pj_pct" ? "pj" : v === "jxc_pct" ? "jxc" : "default",
  };
}

// Catálogo de datasets/variables
const DATASETS = {
  censo: {
    label: "Censo 2022",
    year: 2022,
    levels: ["pais", "provincias", "departamentos", "localidades", "radios"],
    fileFor: (level) => `../data/web/indicadores_${level === "pais" ? "provincias" : level}.json`,
    vars: [
      ["personas", "Población"],
      ["hogares", "Hogares"],
      ["viv_part_h", "Viv. habitadas"],
      ["densidad_km2", "Densidad (hab/km²)"],
      ["hogares_por_km2", "Densidad hogares"],
      ["area_km2", "Área (km²)"],
      ["idx_masculinidad", "Índ. masculinidad"],
      ["personas_por_hogar", "Personas por hogar"],
      ["personas_por_vivienda", "Personas por vivienda"],
    ],
    defaultVar: "personas",
  },
  "2015_generales":  makeElectoralDS("Presidente 2015 · Generales", "2015_generales",  ["pj","jxc","una","prog","comp_fed","izq"], 2015),
  "2015_balotaje":   makeElectoralDS("Presidente 2015 · Balotaje",  "2015_balotaje",   ["pj","jxc"], 2015),
  "2017_diputados":  makeElectoralDS("Diputados Nac. 2017",          "2017_diputados",  ["jxc","pj","1pais","izq"], 2017),
  "2019_paso":       makeElectoralDS("Presidente 2019 · PASO",       "2019_paso",       ["pj","jxc","cf","nos","izq"], 2019),
  "2019_generales":  makeElectoralDS("Presidente 2019 · Generales",  "2019_generales",  ["pj","jxc","cf","nos","izq"], 2019),
  "2021_diputados":  makeElectoralDS("Diputados Nac. 2021",          "2021_diputados",  ["pj","jxc","lla","izq","vcv"], 2021),
  "2023_generales":  makeElectoralDS("Presidente 2023 · Generales",  "2023_generales",  ["lla","pj","jxc","hacemos","izq"], 2023),
  "2023_balotaje":   makeElectoralDS("Presidente 2023 · Balotaje",   "2023_balotaje",   ["lla","pj"], 2023),
  "2023_diputados":  makeElectoralDS("Diputados Nac. 2023",          "2023_diputados",  ["lla","pj","jxc","hacemos","izq"], 2023),
  "2023_senadores":  makeElectoralDS("Senadores Nac. 2023 (8 prov.)", "2023_senadores", ["lla","pj","jxc","hacemos","izq"], 2023),
  economia: {
    label: "Economía · Exportaciones 2024",
    year: 2024,
    levels: ["provincias"],
    fileFor: () => `../data/web/economia_provincia.json`,
    vars: [
      ["exportaciones_total_musd", "Exportaciones totales (M USD)"],
      ["exportaciones_per_capita_usd", "Exportaciones per cápita (USD)"],
      ["exportaciones_share_pais_pct", "% del total país"],
      ["exportaciones_pp_share", "% Productos Primarios"],
      ["exportaciones_moa_share", "% Manuf. Agropecuarias"],
      ["exportaciones_moi_share", "% Manuf. Industriales"],
      ["exportaciones_cye_share", "% Combustibles y Energía"],
      ["exportaciones_pp_musd", "PP (M USD)"],
      ["exportaciones_moa_musd", "MOA (M USD)"],
      ["exportaciones_moi_musd", "MOI (M USD)"],
      ["exportaciones_cye_musd", "CyE (M USD)"],
    ],
    defaultVar: "exportaciones_per_capita_usd",
  },
  pobreza: {
    label: "Sociales · Pobreza por aglomerado",
    year: 2025,
    levels: ["provincias"],
    fileFor: () => `../data/web/pobreza_provincia.json`,
    vars: [
      ["pobreza_pct", "Pobreza % población"],
      ["pobreza_vs_nacional", "Δ vs nacional (pp)"],
    ],
    defaultVar: "pobreza_pct",
  },
  socio: {
    label: "Sociales · Mortalidad Infantil + Fetal",
    year: 2024,
    levels: ["provincias"],
    fileFor: () => `../data/web/socio_provincia.json`,
    vars: [
      ["mortalidad_infantil", "Mortalidad infantil (‰)"],
      ["mortalidad_infantil_vs_pais", "Δ infantil vs país"],
      ["mortalidad_fetal", "Mortalidad fetal (‰)"],
    ],
    defaultVar: "mortalidad_infantil",
  },
  energia: {
    label: "Economía · Energía generación",
    year: 2024,
    levels: ["provincias"],
    fileFor: () => `../data/web/energia_provincia.json`,
    vars: [
      ["energia_potencia_mw", "Potencia instalada (MW)"],
      ["energia_potencia_per_capita_w", "Potencia per cápita (W)"],
      ["energia_centrales_count", "Cantidad de centrales"],
      ["energia_ter_share", "% Térmica"],
      ["energia_hid_share", "% Hidroeléctrica"],
      ["energia_ren_share", "% Renovable"],
      ["energia_nuc_share", "% Nuclear"],
      ["energia_tecnologia_principal_share", "% tecnología dominante"],
    ],
    defaultVar: "energia_potencia_per_capita_w",
  },
  ipc: {
    label: "Economía · IPC por región",
    year: 2026,
    levels: ["provincias"],
    fileFor: () => `../data/web/ipc_provincia.json`,
    vars: [
      ["ipc_var_mensual", "Inflación mensual %"],
      ["ipc_var_interanual", "Inflación interanual %"],
      ["ipc_acum_12m", "Inflación acum. 12m %"],
      ["ipc_nivel", "Índice IPC (base dic-2016=100)"],
    ],
    defaultVar: "ipc_var_interanual",
  },
  empleo: {
    label: "Economía · Desempleo EPH",
    year: 2025,
    levels: ["provincias"],
    fileFor: () => `../data/web/empleo_provincia.json`,
    vars: [
      ["desempleo", "Tasa de desempleo %"],
      ["desempleo_vs_nacional", "Δ vs país (pp)"],
    ],
    defaultVar: "desempleo",
    _wrapper: "provincias", // el JSON tiene {last_q, provincias: {...}}
  },
  salud: {
    label: "Sociales · Establecimientos de salud",
    year: 2024,
    levels: ["provincias"],
    fileFor: () => `../data/web/salud_provincia.json`,
    vars: [
      ["establecimientos_salud_total", "Establecimientos totales"],
      ["establecimientos_por_10k_hab", "Establecimientos por 10k hab"],
      ["hospitales_count", "Hospitales / clínicas / sanatorios"],
      ["hospitales_por_100k_hab", "Hospitales por 100k hab"],
      ["salas_count", "Salas / CAPS"],
    ],
    defaultVar: "establecimientos_por_10k_hab",
  },
  trade: {
    label: "Economía · Trade flows 2024 (top destinos)",
    year: 2024,
    levels: ["provincias"],
    fileFor: () => `../data/web/trade_provincia.json`,
    vars: [
      ["exportaciones_total_destinos_musd", "Exportaciones a destinos identificados (M USD)"],
      ["destino_principal_share", "% al destino principal"],
      ["destino_top3_concentracion", "% top-3 destinos"],
      ["destino_principal_musd", "M USD al destino principal"],
    ],
    defaultVar: "destino_principal_share",
  },
  covid: {
    label: "Sociales · Vacunación COVID-19",
    year: 2026,
    levels: ["provincias"],
    fileFor: () => `../data/web/covid_vac_provincia.json`,
    vars: [
      ["covid_dosis_por_hab", "Dosis aplicadas por habitante"],
      ["covid_cobertura_segunda_pct", "% cobertura esquema completo"],
      ["covid_dosis_total", "Dosis totales"],
      ["covid_dosis_refuerzo", "Dosis de refuerzo"],
    ],
    defaultVar: "covid_dosis_por_hab",
  },
  pba_elec: {
    label: "PBA · Histórico electoral 2011-2023",
    year: 2023,
    levels: ["departamentos", "municipios"],
    fileFor: () => `../data/web/pba_elecciones_municipal.json`,
    vars: [
      ["pba_pres_pj_last_pct", "% Peronismo último Pres."],
      ["pba_pres_jxc_last_pct", "% JxC último Pres."],
      ["pba_pres_lla_last_pct", "% LLA último Pres."],
      ["pba_pres_hacemos_last_pct", "% Hacemos último Pres."],
      ["pba_pres_izq_last_pct", "% FIT último Pres."],
      ["pba_dip_pj_last_pct", "% Peronismo último Dip."],
      ["pba_dip_jxc_last_pct", "% JxC último Dip."],
      ["pba_dip_lla_last_pct", "% LLA último Dip."],
      ["pba_sen_pj_last_pct", "% Peronismo último Sen."],
      ["pba_sen_jxc_last_pct", "% JxC último Sen."],
      ["pba_sen_lla_last_pct", "% LLA último Sen."],
    ],
    defaultVar: "pba_pres_lla_last_pct",
    paletteFor: (v) => /lla_last/.test(v) ? "lla"
      : /pj_last/.test(v) ? "pj"
      : /jxc_last/.test(v) ? "jxc" : "default",
  },
  trade_bloques: {
    label: "Economía · Exportaciones por bloque 2024",
    year: 2024,
    levels: ["provincias"],
    fileFor: () => `../data/web/trade_bloques_provincia.json`,
    vars: [
      ["trade_bloque_principal_share", "% al bloque principal"],
      ["trade_mercosur_share", "% Mercosur"],
      ["trade_ue_share", "% UE"],
      ["trade_asia_share", "% Asia"],
      ["trade_norteamerica_share", "% Norteamérica"],
      ["trade_chile_peru_share", "% Chile/Perú/Col/Ecu"],
      ["trade_africa_medio_oriente_share", "% África+Medio Oriente"],
    ],
    defaultVar: "trade_mercosur_share",
  },
  egresos_pba: {
    label: "PBA · Egresos hospitalarios 2020",
    year: 2020,
    levels: ["departamentos", "municipios"],
    fileFor: () => `../data/web/egresos_pba_municipal.json`,
    vars: [
      ["egresos_2020_por_1k_hab", "Egresos por 1.000 hab"],
      ["egresos_2020_total", "Egresos totales"],
      ["egresos_2020_cardiovasculares", "Egresos cardiovasculares"],
      ["egresos_2020_respiratorios", "Egresos respiratorios"],
      ["egresos_2020_embarazo_parto", "Egresos embarazo/parto"],
      ["egresos_2020_traumatismos", "Egresos traumatismos"],
    ],
    defaultVar: "egresos_2020_por_1k_hab",
  },
  mineria: {
    label: "Economía · Minería (exportaciones)",
    year: 2025,
    levels: ["provincias"],
    fileFor: () => `../data/web/mineria_provincia.json`,
    vars: [
      ["mineria_exportaciones_musd", "Exportaciones mineras (M USD)"],
      ["mineria_per_capita_usd", "Mining USD per cápita"],
    ],
    defaultVar: "mineria_per_capita_usd",
  },
  pesca: {
    label: "Economía · Pesca marítima",
    year: 2019,
    levels: ["provincias"],
    fileFor: () => `../data/web/pesca_provincia.json`,
    vars: [
      ["pesca_captura_tm", "Captura (toneladas)"],
      ["pesca_kg_per_capita", "Captura por habitante (kg)"],
      ["pesca_puertos", "Cantidad de puertos pesqueros"],
    ],
    defaultVar: "pesca_captura_tm",
  },
  ganaderia: {
    label: "Economía · Ganadería bovina 2019",
    year: 2019,
    levels: ["provincias"],
    fileFor: () => `../data/web/ganaderia_provincia.json`,
    vars: [
      ["bovinos_total", "Cabezas bovinas totales"],
      ["bovinos_per_capita", "Bovinos per cápita"],
      ["bovinos_vacas", "Vacas"],
      ["bovinos_terneros", "Terneros"],
      ["bovinos_novillos", "Novillos"],
    ],
    defaultVar: "bovinos_per_capita",
  },
  agro: {
    label: "Economía · Producción agrícola 2024",
    year: 2024,
    levels: ["provincias"],
    fileFor: () => `../data/web/agro_provincia.json`,
    vars: [
      ["agro_produccion_total_tm", "Producción total (tm)"],
      ["agro_superficie_total_ha", "Superficie sembrada (ha)"],
      ["agro_soja_tm", "Soja (tm)"],
      ["agro_trigo_tm", "Trigo (tm)"],
      ["agro_maiz_tm", "Maíz (tm)"],
      ["agro_girasol_tm", "Girasol (tm)"],
      ["agro_soja_share", "% Soja en producción"],
      ["agro_maiz_share", "% Maíz en producción"],
    ],
    defaultVar: "agro_produccion_total_tm",
  },
  pba: {
    label: "PBA · Municipios",
    year: 2025,
    levels: ["departamentos", "municipios"],
    fileFor: () => `../data/web/pba_municipal.json`,
    vars: [
      ["transferencias_pba_per_capita", "Transferencias per cápita ($)"],
      ["transferencias_pba_total", "Transferencias totales ($)"],
      ["poblacion_2025", "Población proyectada 2025"],
      ["pob_crecimiento_pct_2010_2025", "Crecimiento pob 2010-25 %"],
      ["camas_criticas", "Camas críticas (último)"],
      ["camas_criticas_por_100k_hab", "Camas críticas / 100k hab"],
    ],
    defaultVar: "transferencias_pba_per_capita",
  },
  caba: {
    label: "CABA · Por comuna",
    year: 2023,
    levels: ["departamentos"],
    fileFor: () => `../data/web/caba_comunal.json`,
    vars: [
      ["delitos_por_10k_hab_2023", "Delitos por 10k hab"],
      ["robos_por_10k_hab_2023", "Robos por 10k hab"],
      ["delitos_2023_total", "Delitos totales"],
      ["delitos_2023_robos", "Robos"],
      ["delitos_2023_hurtos", "Hurtos"],
      ["delitos_2023_homicidios", "Homicidios"],
      ["delitos_2023_lesiones", "Lesiones"],
      ["vivienda_calidad_satisfactoria_pct", "% vivienda calidad satisfactoria"],
      ["vivienda_calidad_insuficiente_pct", "% vivienda calidad insuficiente"],
      ["vivienda_dos_o_mas_hogares_pct", "% viviendas con ≥2 hogares"],
    ],
    defaultVar: "delitos_por_10k_hab_2023",
  },
  vacunas: {
    label: "Sociales · Vacuna SRP (Triple Viral)",
    year: 2019,
    levels: ["provincias"],
    fileFor: () => `../data/web/vacunas_provincia.json`,
    vars: [
      ["vacuna_srp_1ra_dosis_pct", "% Cobertura 1ra dosis"],
      ["vacuna_srp_2da_dosis_pct", "% Cobertura 2da dosis"],
    ],
    defaultVar: "vacuna_srp_1ra_dosis_pct",
  },
  educacion: {
    label: "Sociales · Educación (escuelas)",
    year: 2024,
    levels: ["provincias"],
    fileFor: () => `../data/web/educacion_provincia.json`,
    vars: [
      ["escuelas_total", "Escuelas totales"],
      ["escuelas_por_10k_hab", "Escuelas por 10k hab"],
      ["pct_estatal", "% Estatales"],
      ["escuelas_estatales", "Escuelas estatales"],
      ["escuelas_privadas", "Escuelas privadas"],
    ],
    defaultVar: "escuelas_por_10k_hab",
  },
  _lisa: {
    label: "LISA",
    year: 0,
    levels: ["departamentos"],
    fileFor: () => null,
    vars: [["lisa_cat", "Categoría LISA"]],
    defaultVar: "lisa_cat",
    paletteFor: () => "lisa",
    _virtual: true,
  },
  _cluster: {
    label: "Clusters",
    year: 0,
    levels: ["departamentos"],
    fileFor: () => null,
    vars: [["cluster", "Cluster ID"]],
    defaultVar: "cluster",
    paletteFor: () => "cluster",
    _virtual: true,
  },
  _swing: {
    label: "Swing",
    year: 0,
    levels: ["departamentos"],
    fileFor: () => null,
    vars: [["swing", "Δ puntos %"]],
    defaultVar: "swing",
    paletteFor: () => "swing",
    _virtual: true,
  },
};

const $ = (s, c=document) => c.querySelector(s);
const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));
const fmt = new Intl.NumberFormat("es-AR");
const fmt1 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const fmt2 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const fmtMoney = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const setStatus = (t) => { $("#status").textContent = t || ""; };

// -- Mapa --
const map = L.map("map", { zoomControl: true, attributionControl: true })
  .setView([-38.5, -63.5], 4);

L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://carto.com/">CARTO</a> · <a href="https://www.openstreetmap.org/copyright">OSM</a>',
}).addTo(map);
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", {
  maxZoom: 19, pane: "shadowPane", opacity: 0.85,
}).addTo(map);

// -- Estado --
const layerCache = {};
const radioProvCache = {};
const radioProvLoading = new Set();
const indicadores = Object.fromEntries(["censo",
  "2015_generales","2015_balotaje","2017_diputados",
  "2019_paso","2019_generales","2021_diputados",
  "2023_generales","2023_balotaje","2023_diputados","2023_senadores",
  "economia","socio","ipc","empleo","salud","educacion","vacunas",
  "pba","caba","trade","covid","pba_elec","agro",
  "trade_bloques","egresos_pba","energia","ganaderia",
  "mineria","pesca","pobreza","_swing","_cluster","_lisa"].map(k => [k, {}]));
let activeDataset = "censo";
let activeLevel = "pais";
let selected = null;
let selectedLevel = null;
let selectedCode = null;
let activeVar = "personas";
let breaks = [];
let levelStats = null;             // {min, max, mean, p50, distribution}
let searchIndex = [];
let suppressHashUpdate = false;
let paisTotales = null;

// -- Helpers --
function quantileBreaks(values, n) {
  values = values.filter(v => v != null && isFinite(v)).sort((a, b) => a - b);
  if (!values.length) return [];
  const b = [];
  for (let i = 1; i < n; i++) b.push(values[Math.floor(values.length * i / n)]);
  return b;
}
function paletteName() {
  const ds = DATASETS[activeDataset];
  return ds?.paletteFor ? ds.paletteFor(activeVar) : "default";
}
function colorFor(v) {
  if (v == null || !isFinite(v) || !activeVar) return null;
  const ramp = VAR_SCALES[paletteName()] || VAR_SCALES.default;
  // Para cluster / LISA (categórico), usar ID directo como índice
  if (paletteName() === "cluster" || paletteName() === "lisa") return ramp[Math.round(v) % ramp.length];
  if (!breaks.length) return ramp[Math.floor(ramp.length / 2)];
  let i = 0;
  while (i < breaks.length && v > breaks[i]) i++;
  return ramp[Math.min(i, ramp.length - 1)];
}
function getIndic(level, code) {
  return indicadores[activeDataset]?.[level]?.[code];
}
function labelFor(k) {
  // Buscar en el dataset activo primero, luego censo, luego fallback
  for (const dsKey of [activeDataset, "censo"]) {
    const ds = DATASETS[dsKey];
    if (!ds) continue;
    const v = ds.vars.find(([key]) => key === k);
    if (v) return v[1];
  }
  return ({
    personas: "Población", mujeres: "Mujeres", varones: "Varones",
    hogares: "Hogares", viv_part: "Viviendas part.", viv_part_h: "Viv. habitadas",
    idx_masculinidad: "Índ. masculinidad",
    personas_por_hogar: "Personas por hogar",
    personas_por_vivienda: "Personas por vivienda",
    padron: "Padrón", votantes: "Votantes",
    participacion: "Participación",
    blanco_pct: "% Blanco", nulo_pct: "% Nulo",
    lla: "LLA votos", pj: "PJ votos", jxc: "JxC votos",
    hacemos: "Hacemos votos", izq: "FIT votos",
    lla_pct: "% LLA", pj_pct: "% UP (PJ)", jxc_pct: "% JxC",
    hacemos_pct: "% Hacemos", izq_pct: "% FIT",
  })[k] || k;
}
function isPctVar(k) {
  if (!k) return false;
  return /_pct$/.test(k) || k === "participacion";
}
function isSwingVar(k) { return k === "swing"; }
function fmtVal(v, varKey = activeVar) {
  if (v == null) return "—";
  if (isSwingVar(varKey)) return `${v >= 0 ? "+" : ""}${(v*100).toFixed(1)} pp`;
  if (isPctVar(varKey)) return `${fmt2.format(v * 100)}%`;
  if (Math.abs(v) >= 1000) return fmt.format(Math.round(v));
  return fmt2.format(v);
}
function indicLevelFor(level) {
  // En censo: pais devuelve null (manejo especial vía catalogs); resto, identidad
  // En elecciones: solo provincias/departamentos
  if (activeDataset === "censo") return level === "pais" ? null : level;
  const dsCfg = DATASETS[activeDataset];
  return dsCfg && dsCfg.levels.includes(level) ? level : null;
}

// -- Carga --
async function loadGeo(name) {
  if (layerCache[name]) return layerCache[name];
  const cfg = LEVELS[name];
  if (!cfg || cfg.lazyByProv) return null;
  setStatus(`Cargando ${name}…`);
  const r = await fetch(cfg.file);
  if (!r.ok) { setStatus(`✗ ${name}: ${r.status}`); return null; }
  const data = await r.json();
  const layer = makeLayer(name, data, cfg);
  layerCache[name] = layer;
  buildSearchIndex(name, data);
  setStatus("");
  return layer;
}

async function loadIndicadores(level, ds = activeDataset) {
  if (ds === "censo" && level === "pais") return paisTotales || (paisTotales = await loadPaisTotales());
  const dsCfg = DATASETS[ds];
  if (!dsCfg || !dsCfg.levels.includes(level)) return null;
  if (dsCfg._virtual) return indicadores[ds]?.[level] || null;
  if (indicadores[ds][level]) return indicadores[ds][level];
  try {
    const r = await fetch(dsCfg.fileFor(level));
    if (r.ok) {
      let data = await r.json();
      if (dsCfg._wrapper) data = data[dsCfg._wrapper] || {};
      indicadores[ds][level] = data;
    }
  } catch {}
  return indicadores[ds][level];
}
async function loadPaisTotales() {
  try {
    const r = await fetch("../catalogs/indicadores.json");
    if (r.ok) return (await r.json()).totales_pais;
  } catch {}
  return null;
}

function makeLayer(name, geojson, cfg) {
  const layer = L.geoJSON(geojson, {
    pointToLayer: cfg.point
      ? (feat, latlng) => L.circleMarker(latlng, { radius: 3, color: cfg.color, weight: 0.5, fillOpacity: cfg.fill })
      : undefined,
    style: (feat) => styleFeature(name, feat),
    onEachFeature: (feat, lyr) => bindFeature(name, feat, lyr, layer),
  });
  return layer;
}
function styleFeature(name, feat) {
  const cfg = LEVELS[name];
  const p = feat.properties || {};
  const ind = getIndic(name, p.codigo_indec);
  const v = ind?.[activeVar];
  const fc = colorFor(v);
  return {
    color: cfg.color, weight: cfg.weight,
    fillOpacity: cfg.fill, fillColor: fc || cfg.color,
  };
}
function tooltipHTML(name, p) {
  const nm = p.nombre || (name === "radios" ? `Radio ${p.codigo_indec}` : "—");
  const ind = getIndic(name, p.codigo_indec);
  let extra = "";
  if (ind) {
    const keysShown = [];
    // Variable activa primero (si la hay)
    if (activeVar && ind[activeVar] != null) {
      keysShown.push([activeVar, ind[activeVar]]);
    }
    // 2-3 stats relevantes según dataset
    const presets = {
      censo: ["personas", "densidad_km2", "hogares"],
      "2023_generales": ["lla_pct", "pj_pct", "participacion"],
      "2023_balotaje":  ["lla_pct", "pj_pct"],
      "2023_diputados": ["lla_pct", "pj_pct", "jxc_pct"],
      "2023_senadores": ["lla_pct", "pj_pct", "jxc_pct"],
      "2019_generales": ["pj_pct", "jxc_pct", "participacion"],
      "2019_paso":      ["pj_pct", "jxc_pct"],
      "2017_diputados": ["jxc_pct", "pj_pct"],
      "2021_diputados": ["pj_pct", "jxc_pct", "lla_pct"],
      "2015_generales": ["pj_pct", "jxc_pct"],
      "2015_balotaje":  ["pj_pct", "jxc_pct"],
      economia:         ["exportaciones_total_musd", "exportaciones_per_capita_usd"],
      _swing:           ["swing"],
    };
    const fallback = presets[activeDataset] || presets.censo;
    for (const k of fallback) {
      if (!keysShown.find(x => x[0] === k) && ind[k] != null) keysShown.push([k, ind[k]]);
      if (keysShown.length >= 3) break;
    }
    extra = keysShown.map(([k, v]) =>
      `<div class="ttip-row"><span class="ttip-k">${labelFor(k)}</span><span class="ttip-v">${fmtVal(v, k)}</span></div>`
    ).join("");
  }
  return `<div class="ttip-title">${nm}</div>${extra}`;
}

function labelText(name, p) {
  const nm = p.nombre;
  if (!nm) return "";
  if (name === "provincias") return nm.replace(/^Provincia de(l)? /i, "");
  if (name === "departamentos") return nm.replace(/^(Departamento|Partido de|Comuna) /i, "");
  if (name === "municipios") return nm.replace(/^Municipio de /i, "");
  return nm;
}

function bindFeature(name, feat, lyr, parent) {
  const p = feat.properties || {};
  lyr.bindTooltip(() => tooltipHTML(name, p), { sticky: true, className: "ttip-rich" });
  lyr.on("mouseover", e => {
    $("#hover-name").textContent = (p.nombre || `Radio ${p.codigo_indec}`);
    try { e.target.setStyle({ weight: (LEVELS[name].weight || 0.5) + 1.5, fillOpacity: Math.min(0.6, LEVELS[name].fill + 0.18) }); } catch {}
  });
  lyr.on("mouseout", e => {
    $("#hover-name").textContent = "—";
    try { parent.resetStyle(e.target); } catch {}
  });
  lyr.on("click", () => onSelect(p.nombre || `Radio ${p.codigo_indec}`, p, lyr, name));
}

// -- Labels permanentes (capa separada de markers) --
let labelLayer = null;
let showLabels = true;
function labelLevelForZoom(z) {
  if (z >= 11) return "localidades";
  if (z >= 9)  return "municipios";
  if (z >= 7)  return "departamentos";
  if (z >= 5)  return "provincias";
  return null;
}
function rebuildLabels() {
  if (labelLayer) { map.removeLayer(labelLayer); labelLayer = null; }
  if (!showLabels) return;
  const lvl = labelLevelForZoom(map.getZoom());
  if (!lvl || !layerCache[lvl]) return;
  const bounds = map.getBounds();
  const group = L.layerGroup();
  let count = 0;
  layerCache[lvl].eachLayer(l => {
    if (count > 150) return; // límite anti-spam
    const p = l.feature?.properties;
    if (!p?.nombre) return;
    let latlng = null;
    try {
      if (l.getBounds) {
        const b = l.getBounds();
        if (!b.intersects(bounds)) return;
        latlng = b.getCenter();
      } else if (l.getLatLng) {
        latlng = l.getLatLng();
        if (!bounds.contains(latlng)) return;
      }
    } catch { return; }
    if (!latlng) return;
    const txt = labelText(lvl, p);
    if (!txt) return;
    L.marker(latlng, {
      icon: L.divIcon({ className: "lbl-perm-wrap", html: `<span class="lbl-perm">${txt}</span>` }),
      interactive: false,
      keyboard: false,
    }).addTo(group);
    count++;
  });
  group.addTo(map);
  labelLayer = group;
}
function toggleLabels() {
  showLabels = !showLabels;
  $("#lbl-toggle").textContent = showLabels ? "🏷️ Nombres on" : "🏷️ Nombres off";
  rebuildLabels();
}

async function loadRadiosForProv(codProv) {
  if (radioProvCache[codProv]) return radioProvCache[codProv];
  if (radioProvLoading.has(codProv)) return null;
  radioProvLoading.add(codProv);
  setStatus(`Cargando radios ${codProv}…`);
  try {
    const r = await fetch(`../data/web/radios/${codProv}.geojson`);
    if (!r.ok) { setStatus(""); return null; }
    const data = await r.json();
    if (!indicadores.radios) await loadIndicadores("radios");
    const layer = makeLayer("radios", data, LEVELS.radios);
    radioProvCache[codProv] = layer;
    setStatus("");
    return layer;
  } finally {
    radioProvLoading.delete(codProv);
  }
}

// -- Stats & breaks --
function computeStats(level) {
  if (!activeVar) { breaks = []; levelStats = null; renderLegend(level); renderRanking(); return; }
  const indLevel = indicLevelFor(level);
  const ind = indLevel ? indicadores[activeDataset]?.[indLevel] : null;
  if (!ind) { breaks = []; levelStats = null; renderLegend(level); renderRanking(); return; }
  const entries = Object.entries(ind)
    .map(([k, d]) => [k, d?.[activeVar]])
    .filter(([, v]) => v != null && isFinite(v));
  const vals = entries.map(([, v]) => v).sort((a, b) => a - b);
  // Breaks simétricos para swing (alrededor de 0)
  if (isSwingVar(activeVar)) {
    const m = Math.max(Math.abs(vals[0] || 0), Math.abs(vals[vals.length - 1] || 0));
    // Round to 0.05 (5pp steps) para escala "lógica"
    const mClean = Math.ceil(m * 20) / 20;
    const ramp = VAR_SCALES.swing;
    breaks = [];
    for (let i = 1; i < ramp.length; i++) {
      breaks.push(-mClean + (i / ramp.length) * 2 * mClean);
    }
  } else {
    breaks = quantileBreaks(vals, VAR_SCALES.default.length);
  }
  const sum = vals.reduce((a, b) => a + b, 0);
  levelStats = {
    min: vals[0], max: vals[vals.length - 1],
    mean: sum / vals.length,
    p50: vals[Math.floor(vals.length / 2)],
    n: vals.length,
    entries,
  };
  renderLegend(level);
  renderRanking();
  refreshSelectedPanel();
}

function renderLegend(level) {
  const el = $("#legend");
  if (!activeVar || !breaks.length) { el.classList.add("hidden"); return; }
  // Para LISA / cluster: leyenda categórica
  if (paletteName() === "lisa") {
    el.classList.remove("hidden");
    $("#legend-title").textContent = `${level} · LISA`;
    const labels = ["ns", "HH", "LL", "HL", "LH"];
    $("#legend-ramp").innerHTML = VAR_SCALES.lisa.slice(0, 5).map((c, i) =>
      `<span style="background:${c};flex:0 0 18%" title="${labels[i]}"></span>`).join("");
    $("#legend-labels").innerHTML = labels.map(l => `<span>${l}</span>`).join("");
    return;
  }
  if (paletteName() === "cluster") {
    el.classList.remove("hidden");
    const k = +($("#cl-k")?.value || 4);
    $("#legend-title").textContent = `${level} · Clusters (k=${k})`;
    $("#legend-ramp").innerHTML = VAR_SCALES.cluster.slice(0, k).map((c, i) =>
      `<span style="background:${c};flex:0 0 ${100/k}%"></span>`).join("");
    $("#legend-labels").innerHTML = Array.from({length:k}, (_, i) => `<span>C${i+1}</span>`).join("");
    return;
  }
  el.classList.remove("hidden");
  $("#legend-title").textContent = `${level} · ${labelFor(activeVar)}`;
  const ramp = VAR_SCALES[paletteName()] || VAR_SCALES.default;
  $("#legend-ramp").innerHTML = ramp.map(c => `<span style="background:${c}"></span>`).join("");
  if (isSwingVar(activeVar) && breaks.length) {
    const mn = breaks[0], mx = breaks[breaks.length - 1];
    $("#legend-labels").innerHTML = `<span>${(mn*100).toFixed(1)}pp</span><span>0</span><span>+${(mx*100).toFixed(1)}pp</span>`;
  } else {
    $("#legend-labels").innerHTML = `<span>${fmtVal(levelStats?.min)}</span><span>${fmtVal(levelStats?.max)}</span>`;
  }
}

function restyleActive() {
  if (activeLevel === "radios") {
    Object.values(radioProvCache).forEach(l => refreshLayerStyle(l, "radios"));
  } else {
    const l = layerCache[activeLevel];
    if (l) refreshLayerStyle(l, activeLevel);
  }
}
function refreshLayerStyle(layer, name) {
  layer.setStyle(feat => styleFeature(name, feat));
}

// -- Selección + panel info --
async function onSelect(name, props, lyr, level) {
  if (selected) {
    try {
      if (selectedLevel === "radios") Object.values(radioProvCache).forEach(l => { try { l.resetStyle(selected); } catch {} });
      else if (layerCache[selectedLevel]) layerCache[selectedLevel].resetStyle(selected);
    } catch {}
  }
  selected = lyr; selectedLevel = level; selectedCode = props.codigo_indec;
  try { lyr.setStyle({ weight: 2.5, color: "#fff", fillOpacity: 0.22 }); lyr.bringToFront(); } catch {}

  $("#sel-name").textContent = name;
  const meta = [];
  if (props.tipo) meta.push(props.tipo);
  if (props.provincia) meta.push(props.provincia);
  if (props.departamento) meta.push(props.departamento);
  if (props.codigo_indec) meta.push(`código ${props.codigo_indec}`);
  $("#sel-meta").textContent = meta.join(" · ") || "—";

  await refreshSelectedPanel(props);
  syncHash();
}

async function refreshSelectedPanel(props) {
  if (!selected) return;
  if (!props) props = selected.feature?.properties || {};
  let ind = null;
  const code = props.codigo_indec;
  const indLevel = indicLevelFor(selectedLevel);
  // 1) Intenta dataset activo en el nivel actual
  if (indLevel) {
    await loadIndicadores(indLevel);
    ind = indicadores[activeDataset]?.[indLevel]?.[code];
  } else if (selectedLevel === "pais") {
    ind = await loadIndicadores("pais");
  }
  // 2) Fallback: si el dataset activo no tiene data para este nivel, mostrar Censo
  if (!ind && selectedLevel !== "pais") {
    const censoLvl = ["provincias","departamentos","localidades","radios"].includes(selectedLevel)
      ? selectedLevel : null;
    if (censoLvl) {
      await loadIndicadores(censoLvl, "censo");
      ind = indicadores.censo?.[censoLvl]?.[code];
    }
  }
  // 3) Fallback adicional para municipios → buscar match en deptos por nombre
  if (!ind && selectedLevel === "municipios") {
    await loadIndicadores("departamentos", "censo");
    const di = indicadores.censo?.departamentos;
    if (di && props.nombre) {
      const nm = props.nombre.toLowerCase();
      const layer = layerCache.departamentos;
      if (layer) {
        layer.eachLayer(l => {
          if (ind) return;
          const dn = (l.feature?.properties?.nombre || "").toLowerCase();
          if (dn.includes(nm) || nm.includes(dn.replace(/^(departamento|partido de) /, ""))) {
            const dcode = l.feature.properties.codigo_indec;
            ind = di[dcode];
          }
        });
      }
    }
  }
  renderKpis(ind);
  renderCompare(ind, props);
  renderSpark(ind);
  renderHist(ind);
  renderExtras(ind);
  renderAllDatasets(code, selectedLevel).catch(() => {});
  renderSimilar(code, selectedLevel).catch(() => {});
  switchTab("info");
  loadFeatureSerieIfAvailable(code).catch(() => {});
  // Si NO hay serie embebida (sparkline ya renderizado por renderSpark), intentar trayectoria electoral
  if (!ind || !Object.keys(ind).some(k => k.endsWith("_serie") || k.endsWith("_serie_1ra") || k.endsWith("_serie_12m") || k.startsWith("pba_pres_serie_"))) {
    renderTrayectoria(code, selectedLevel).catch(() => {});
  }
}

async function renderTrayectoria(code, level) {
  // Construye serie histórica del depto a través de todas las elecciones
  if (!code || level !== "departamentos") return;
  const ELECTORAL_YEARS = [
    { ds: "2015_generales", year: 2015, label: "2015G" },
    { ds: "2015_balotaje",  year: 2015.5, label: "2015B" },
    { ds: "2017_diputados", year: 2017, label: "2017D" },
    { ds: "2019_paso",      year: 2019, label: "2019P" },
    { ds: "2019_generales", year: 2019.5, label: "2019G" },
    { ds: "2021_diputados", year: 2021, label: "2021D" },
    { ds: "2023_generales", year: 2023, label: "2023G" },
    { ds: "2023_balotaje",  year: 2023.5, label: "2023B" },
    { ds: "2023_diputados", year: 2023.7, label: "2023D" },
  ];
  const COALICIONES = ["pj_pct", "jxc_pct", "lla_pct", "izq_pct"];
  // Load all
  await Promise.all(ELECTORAL_YEARS.map(y => loadIndicadores("departamentos", y.ds)));
  const series = {};
  for (const c of COALICIONES) series[c] = [];
  for (const y of ELECTORAL_YEARS) {
    const rec = indicadores[y.ds]?.departamentos?.[code];
    if (!rec) continue;
    for (const c of COALICIONES) {
      if (rec[c] != null && isFinite(rec[c])) {
        series[c].push({ x: y.label, y: rec[c] * 100, year: y.year });
      }
    }
  }
  // Si no hay datos, salir
  const hasData = Object.values(series).some(s => s.length >= 2);
  if (!hasData) return;

  const renderable = COALICIONES.filter(c => series[c].length >= 2).map(c => ({
    label: c.replace("_pct", ""), points: series[c],
  }));
  renderMultiSpark(renderable, "Trayectoria electoral 2015-2023");
}

async function renderSimilar(code, level) {
  const body = $("#sel-similar-body");
  if (!code || level !== "departamentos") { body.innerHTML = ""; return; }
  body.innerHTML = "<div style='color:var(--muted)'>Calculando…</div>";

  // Variables a usar — electoral + censo mixto
  const VARS = [
    ["2023_generales", "lla_pct"],
    ["2023_generales", "pj_pct"],
    ["2023_generales", "jxc_pct"],
    ["censo", "densidad_km2"],
    ["censo", "personas_por_hogar"],
    ["censo", "idx_masculinidad"],
  ];
  await Promise.all([...new Set(VARS.map(v => v[0]))].map(ds => loadIndicadores(level, ds)));

  // Build vectors
  const layer = layerCache.departamentos;
  const allCodes = new Set();
  if (layer) layer.eachLayer(l => { const p = l.feature?.properties; if (p?.codigo_indec) allCodes.add(p.codigo_indec); });
  const get = (ds, k, c) => indicadores[ds]?.[level]?.[c]?.[k];
  const codes = [], X = [], names = [], ctxs = [];
  for (const c of allCodes) {
    const row = VARS.map(([ds, k]) => {
      const v = get(ds, k, c);
      return v == null || !isFinite(v) ? null : +v;
    });
    if (row.every(v => v != null)) {
      codes.push(c); X.push(row);
      let nm = c, ctx = "";
      layer.eachLayer(l => {
        if (l.feature?.properties.codigo_indec === c) {
          nm = l.feature.properties.nombre;
          ctx = l.feature.properties.provincia || "";
        }
      });
      names.push(nm); ctxs.push(ctx);
    }
  }
  if (X.length < 5) { body.innerHTML = "<div style='color:var(--muted)'>Sin datos suficientes</div>"; return; }

  // Estandarizar
  const dim = X[0].length;
  for (let j = 0; j < dim; j++) {
    const col = X.map(r => r[j]);
    const m = col.reduce((a, b) => a + b, 0) / col.length;
    const sd = Math.sqrt(col.reduce((a, b) => a + (b - m) ** 2, 0) / col.length) || 1;
    for (let i = 0; i < X.length; i++) X[i][j] = (X[i][j] - m) / sd;
  }

  // Find target idx
  const tgtIdx = codes.indexOf(code);
  if (tgtIdx < 0) { body.innerHTML = "<div style='color:var(--muted)'>Depto no en universo</div>"; return; }
  const tgt = X[tgtIdx];

  // Compute distances
  const dists = X.map((r, i) => ({
    code: codes[i], name: names[i], ctx: ctxs[i],
    d: i === tgtIdx ? Infinity : Math.sqrt(r.reduce((s, x, j) => s + (x - tgt[j]) ** 2, 0)),
  }));
  dists.sort((a, b) => a.d - b.d);
  const top = dists.slice(0, 5);

  body.innerHTML = top.map((d, i) => `
    <div class="rk-row" data-code="${d.code}">
      <span class="pos">${i + 1}</span>
      <span class="nom" title="${d.name}">${d.name} <span class="ctx">${d.ctx}</span></span>
      <span class="val">${d.d.toFixed(2)}</span>
    </div>`).join("");
  $$("#sel-similar-body .rk-row").forEach(r => {
    r.addEventListener("click", () => zoomToCode(r.dataset.code));
  });
}

async function renderAllDatasets(code, level) {
  const body = $("#sel-all-body");
  if (!code) { body.innerHTML = ""; return; }
  body.innerHTML = "<div style='color:var(--muted)'>Cargando…</div>";
  const sections = [];
  for (const [dsKey, dsCfg] of Object.entries(DATASETS)) {
    if (dsCfg._virtual) continue;
    if (!dsCfg.levels.includes(level)) continue;
    const data = await loadIndicadores(level, dsKey);
    const rec = data?.[code];
    if (!rec) continue;
    const items = Object.entries(rec)
      .filter(([k, v]) => !k.startsWith("_") && !Array.isArray(v) && typeof v !== "object" && v != null)
      .slice(0, 8);
    if (!items.length) continue;
    sections.push(`<div class="ds-section">
      <h4>${dsCfg.label}</h4>
      <div class="ds-vars">${items.map(([k, v]) =>
        `<span class="ds-var"><span class="k">${labelFor(k).slice(0,18)}</span><span class="v">${typeof v === 'number' ? fmtVal(v, k) : v}</span></span>`
      ).join("")}</div>
    </div>`);
  }
  body.innerHTML = sections.length ? sections.join("") : "<div style='color:var(--muted)'>Sin datos en otros datasets</div>";
}

async function loadFeatureSerieIfAvailable(code) {
  if (!code) return;
  // Solo provincias por ahora
  if (selectedLevel !== "provincias" && code.length !== 2) return;
  const provCode = code.length >= 2 ? code.substring(0, 2) : code;
  const serie = await loadFeatureSerie(provCode);
  if (!serie) return;
  // Append a renderSpark con la nueva serie como secondary
  const wrap = $("#sel-spark");
  const existing = wrap.innerHTML;
  // Solo agregar si no estaba ya
  if (existing.includes("from-series-api")) return;
  renderMultiSpark([serie], serie.label);
  // Marcar
  wrap.dataset.fromApi = "1";
}

function renderKpis(ind) {
  const wrap = $("#sel-kpis");
  if (!ind) { wrap.innerHTML = `<div style="color:var(--muted);font-size:11px;grid-column:1/-1">Sin datos del dataset activo para este nivel.</div>`; return; }
  // KPIs default por dataset
  const presets = {
    censo: [["personas","Población"],["hogares","Hogares"],["viv_part_h","Viv. habitadas"],["idx_masculinidad","Índ. masc."]],
    "2023_generales": [["lla_pct","% LLA"],["pj_pct","% UP"],["jxc_pct","% JxC"],["participacion","Participación"]],
    "2023_balotaje":  [["lla_pct","% LLA"],["pj_pct","% UP"],["participacion","Particip."],["blanco_pct","% Blanco"]],
  };
  const main = presets[activeDataset] || presets.censo;
  wrap.innerHTML = main.map(([k, l]) => {
    if (ind[k] == null) return "";
    return `<div class="kpi"><div class="v">${fmtVal(ind[k], k)}</div><div class="l">${l}</div></div>`;
  }).join("");
}

function renderCompare(ind, props) {
  const wrap = $("#sel-compare");
  if (!ind || !activeVar || ind[activeVar] == null) { wrap.innerHTML = ""; return; }
  const v = ind[activeVar];
  const rows = [];
  rows.push(`<div class="cmp-row"><span class="lbl">${labelFor(activeVar)}</span><span class="v">${fmtVal(v)}</span></div>`);
  if (levelStats) {
    const dMean = ((v - levelStats.mean) / levelStats.mean) * 100;
    const dP50 = levelStats.p50 ? ((v - levelStats.p50) / levelStats.p50) * 100 : null;
    rows.push(`<div class="cmp-row">
      <span class="lbl">vs media ${selectedLevel}</span>
      <span><span class="v">${fmtVal(levelStats.mean)}</span><span class="delta ${dMean>=0?'pos':'neg'}">${dMean>=0?'+':''}${fmt1.format(dMean)}%</span></span>
    </div>`);
    if (dP50 != null) {
      rows.push(`<div class="cmp-row">
        <span class="lbl">vs mediana</span>
        <span><span class="v">${fmtVal(levelStats.p50)}</span><span class="delta ${dP50>=0?'pos':'neg'}">${dP50>=0?'+':''}${fmt1.format(dP50)}%</span></span>
      </div>`);
    }
  }
  // % del país solo tiene sentido para conteos absolutos del censo
  if (activeDataset === "censo" && paisTotales?.[activeVar] != null) {
    const pt = paisTotales[activeVar];
    if (Number.isInteger(pt) && pt > 1000) {
      const pct = (v / pt) * 100;
      rows.push(`<div class="cmp-row">
        <span class="lbl">% del país</span>
        <span class="v">${fmt2.format(pct)}%</span>
      </div>`);
    }
  }
  wrap.innerHTML = rows.join("");
}

function renderHist(ind) {
  const el = $("#sel-hist");
  if (!levelStats || !activeVar || !ind || ind[activeVar] == null) { el.innerHTML = ""; return; }
  const vals = levelStats.entries.map(([, v]) => v);
  const here = ind[activeVar];
  const min = levelStats.min, max = levelStats.max;
  const bins = 20;
  const range = max - min || 1;
  const counts = new Array(bins).fill(0);
  vals.forEach(v => {
    const b = Math.min(bins - 1, Math.floor((v - min) / range * bins));
    counts[b]++;
  });
  const maxC = Math.max(...counts);
  const hereBin = Math.min(bins - 1, Math.floor((here - min) / range * bins));
  const bars = counts.map((c, i) => {
    const h = c ? Math.max(2, Math.round(c / maxC * 100)) : 1;
    return `<span class="${i === hereBin ? 'here' : ''}" style="height:${h}%"></span>`;
  }).join("");
  el.innerHTML = `
    <div class="hist-title">Distribución · ${selectedLevel} · ${labelFor(activeVar)}</div>
    <div class="hist-bars">${bars}</div>
    <div class="hist-meta"><span>${fmtVal(min)}</span><span>aquí: ${fmtVal(here)}</span><span>${fmtVal(max)}</span></div>
  `;
}

function renderExtras(ind) {
  const extras = $("#sel-extras");
  if (!ind) { extras.innerHTML = "<p>Sin indicadores para este nivel.</p>"; return; }
  const rows = Object.entries(ind)
    .filter(([k, v]) => !k.startsWith("_") && !Array.isArray(v))
    .map(([k, v]) => `<tr><td>${labelFor(k)}</td><td>${typeof v === "number" ? fmtVal(v, k) : v}</td></tr>`)
    .join("");
  extras.innerHTML = `<table>${rows}</table>`;
}

function normalizeSerie(s) {
  if (!Array.isArray(s) || !s.length) return null;
  return s.map(p => {
    if (Array.isArray(p)) return { x: String(p[0]), y: +p[1] };
    if (typeof p === "object") return { x: p.fecha || p.year || "", y: +(p.valor ?? p.value ?? 0) };
    return null;
  }).filter(p => p && isFinite(p.y));
}

function renderSpark(ind) {
  const wrap = $("#sel-spark");
  if (!ind) { wrap.innerHTML = ""; return; }
  // Multi-serie PBA electoral: detectar todos los pba_pres_serie_<key>
  const pbaSeries = Object.entries(ind).filter(([k, v]) => k.startsWith("pba_pres_serie_") && Array.isArray(v));
  if (pbaSeries.length >= 2) {
    return renderMultiSpark(pbaSeries.map(([k, v]) => ({
      label: k.replace("pba_pres_serie_", ""), points: normalizeSerie(v),
    })), "Histórico Presidente PBA");
  }
  const serieKey = Object.keys(ind).find(k =>
    (k.endsWith("_serie") || k.endsWith("_serie_1ra") || k.endsWith("_serie_12m")) && Array.isArray(ind[k]));
  if (!serieKey) { wrap.innerHTML = ""; return; }
  const points = normalizeSerie(ind[serieKey]);
  if (!points || points.length < 2) { wrap.innerHTML = ""; return; }
  const titleMap = {
    mortalidad_infantil_serie: "Mortalidad infantil (serie histórica)",
    vacuna_srp_serie_1ra: "Cobertura SRP 1ra dosis (anual)",
    ipc_serie_12m: "IPC últimos 12 meses",
  };
  return renderMultiSpark([{ label: "", points }], titleMap[serieKey] || serieKey.replace(/_/g, " "));
}

function renderMultiSpark(series, title) {
  const wrap = $("#sel-spark");
  const palette = {
    pj: "#ff6b6b", jxc: "#5aa3ff", lla: "#b288e8", izq: "#fceabb",
    hacemos: "#7df2c6", una_massa: "#ffb454", "1pais": "#ed8da0",
    cf: "#74c0e8", nos: "#c9a8ff", vcv: "#ffb454", "": "#5aa3ff",
  };
  const W = 320, H = 60, m = { l: 4, r: 4, t: 4, b: 4 };
  const innerW = W - m.l - m.r, innerH = H - m.t - m.b;
  // Eje X común
  const allX = [...new Set(series.flatMap(s => s.points.map(p => p.x)))].sort();
  const allY = series.flatMap(s => s.points.map(p => p.y));
  const mn = Math.min(...allY), mx = Math.max(...allY), range = mx - mn || 1;
  const sx = x => m.l + (allX.indexOf(x) / Math.max(1, allX.length - 1)) * innerW;
  const sy = v => m.t + innerH - ((v - mn) / range) * innerH;
  const paths = series.map(s => {
    const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
    const color = palette[s.label] || "#5aa3ff";
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.4"/>`;
  }).join("");
  const legend = series.length > 1
    ? series.map(s => `<span style="color:${palette[s.label] || '#5aa3ff'};margin-right:8px">${s.label.toUpperCase()}</span>`).join("")
    : "";
  wrap.innerHTML = `
    <div class="spark-title">${title}</div>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${paths}</svg>
    <div class="spark-meta">
      <span>${allX[0] || ""}</span>
      <span>${legend}</span>
      <span>${allX[allX.length-1] || ""}</span>
    </div>`;
}

// -- Ranking --
function renderRanking() {
  $("#rk-var").textContent = activeVar ? labelFor(activeVar) : "—";
  const top = $("#rk-top"), bot = $("#rk-bot");
  if (!levelStats || !activeVar) { top.innerHTML = bot.innerHTML = "<p style='color:var(--muted);font-size:12px'>Sin datos</p>"; return; }
  const sorted = [...levelStats.entries].sort((a, b) => b[1] - a[1]);
  const indLevel = indicLevelFor(activeLevel);
  const layer = activeLevel === "radios" ? null : layerCache[activeLevel];
  const nameOf = (code) => {
    if (!layer) return code;
    let nm = null;
    layer.eachLayer(l => { if (l.feature?.properties.codigo_indec === code) nm = l.feature.properties.nombre; });
    return nm || code;
  };
  const ctxOf = (code) => {
    if (!layer) return "";
    let ctx = "";
    layer.eachLayer(l => {
      if (l.feature?.properties.codigo_indec === code) {
        const p = l.feature.properties;
        ctx = p.provincia || p.departamento || "";
      }
    });
    return ctx;
  };
  // Z-score absoluto para marcar outliers
  const mean = levelStats.mean, sd = Math.sqrt(
    levelStats.entries.reduce((s, [, v]) => s + (v - mean) ** 2, 0) / levelStats.entries.length) || 1;
  const renderList = (list) => list.map(([code, v], i) => {
    const z = Math.abs((v - mean) / sd);
    const outlier = z > 2 ? "rk-outlier" : "";
    const badge = z > 2.5 ? `<span class="rk-badge" title="z=${z.toFixed(1)}">σ+</span>` : "";
    return `<div class="rk-row ${outlier} ${code === selectedCode ? 'sel' : ''}" data-code="${code}">
      <span class="pos">${i + 1}</span>
      <span class="nom" title="${nameOf(code)} (z=${z.toFixed(2)})">${nameOf(code)} <span class="ctx">${ctxOf(code)}</span></span>
      <span class="val">${fmtVal(v)} ${badge}</span>
    </div>`;
  }).join("");
  top.innerHTML = renderList(sorted.slice(0, 10));
  bot.innerHTML = renderList(sorted.slice(-10).reverse());
  $$(".rk-row", $("#panel-ranking")).forEach(r => {
    r.addEventListener("click", () => zoomToCode(r.dataset.code));
  });
}

function zoomToCode(code) {
  const lyr = activeLevel === "radios" ? null : layerCache[activeLevel];
  if (!lyr) return;
  let target = null;
  lyr.eachLayer(l => { if (l.feature?.properties.codigo_indec === code) target = l; });
  if (!target) return;
  try { map.fitBounds(target.getBounds(), { padding: [40, 40], maxZoom: 11 }); }
  catch { if (target.getLatLng) map.setView(target.getLatLng(), 11); }
  const p = target.feature.properties;
  onSelect(p.nombre || `Radio ${p.codigo_indec}`, p, target, activeLevel);
}

// -- Lazy radios --
async function loadRadiosInView() {
  const provLayer = layerCache.provincias;
  if (!provLayer) return;
  const bounds = map.getBounds();
  const tasks = [];
  provLayer.eachLayer(l => {
    const p = l.feature.properties;
    if (l.getBounds && bounds.intersects(l.getBounds())) {
      const code = p.codigo_indec;
      if (code && !radioProvCache[code] && !radioProvLoading.has(code)) {
        tasks.push(loadRadiosForProv(code).then(layer => {
          if (layer && activeLevel === "radios") layer.addTo(map);
        }));
      }
    }
  });
  if (tasks.length) await Promise.all(tasks);
}

// -- Set level --
async function setLevel(name, opts = {}) {
  activeLevel = name;
  $$("#lvl-nav button").forEach(b => b.classList.toggle("active", b.dataset.lvl === name));
  await loadIndicadores(indicLevelFor(name) || "pais");
  computeStats(name);

  if (name === "radios") {
    if (!layerCache.provincias) await loadGeo("provincias");
    for (const [, l] of Object.entries(layerCache)) map.removeLayer(l);
    await loadRadiosInView();
    Object.values(radioProvCache).forEach(l => l.addTo(map));
  } else {
    const lyr = await loadGeo(name);
    if (!lyr) return;
    for (const [k, l] of Object.entries(layerCache)) if (k !== name) map.removeLayer(l);
    Object.values(radioProvCache).forEach(l => map.removeLayer(l));
    if (!map.hasLayer(lyr)) lyr.addTo(map);
    if (opts.fit !== false) { try { map.fitBounds(lyr.getBounds(), { padding: [20, 20] }); } catch {} }
  }
  restyleActive();
  syncHash();
}

// -- Auto-zoom --
let zoomTimer, labelTimer;
map.on("zoomend moveend", () => {
  clearTimeout(zoomTimer);
  zoomTimer = setTimeout(autoLevel, 100);
  clearTimeout(labelTimer);
  labelTimer = setTimeout(rebuildLabels, 250);
});
async function autoLevel() {
  const z = map.getZoom();
  let next = activeLevel;
  if      (z >= 12) next = "radios";
  else if (z >= 11) next = "localidades";
  else if (z >= 9)  next = "municipios";
  else if (z >= 7)  next = "departamentos";
  else if (z >= 5)  next = "provincias";
  else              next = "pais";
  if (next !== activeLevel) {
    await setLevel(next, { fit: false });
  } else if (next === "radios") {
    await loadRadiosInView();
    Object.values(radioProvCache).forEach(l => { if (!map.hasLayer(l)) l.addTo(map); });
    restyleActive();
  }
  syncHash();
}

$$("#lvl-nav button").forEach(b => b.addEventListener("click", () => setLevel(b.dataset.lvl, { fit: true })));

function populateVarSelect() {
  const ds = DATASETS[activeDataset];
  const sel = $("#var-sel");
  sel.innerHTML = `<option value="">— sin color —</option>` +
    ds.vars.map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
  // Mantener variable si existe en este dataset; si no, default
  const has = ds.vars.some(([k]) => k === activeVar);
  if (!has) activeVar = ds.defaultVar;
  sel.value = activeVar || "";
  // Visibilidad de los botones de nivel: marcar disabled los que no aplican
  $$("#lvl-nav button").forEach(b => {
    const ok = ds.levels.includes(b.dataset.lvl);
    b.disabled = !ok;
    b.style.opacity = ok ? "" : "0.35";
    b.title = ok ? "" : `Sin datos en ${ds.label} para este nivel`;
  });
}

$("#ds-sel").addEventListener("change", async e => {
  activeDataset = e.target.value;
  populateVarSelect();
  // Mostrar/ocultar control de animación
  const isElectoral = /^(20\d\d_)/.test(activeDataset);
  if (isElectoral) showAnim(); else hideAnim();
  const ds = DATASETS[activeDataset];
  // Si la capa activa no está soportada, saltar a la primera soportada
  if (!ds.levels.includes(activeLevel)) {
    await setLevel(ds.levels.includes("departamentos") ? "departamentos" : ds.levels[0], { fit: true });
  } else {
    await loadIndicadores(activeLevel);
    computeStats(activeLevel);
    restyleActive();
  }
  syncHash();
});

$("#var-sel").addEventListener("change", e => {
  activeVar = e.target.value || null;
  computeStats(activeLevel);
  restyleActive();
  syncHash();
});

// -- Tabs --
function switchTab(name) {
  $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  $$(".panel").forEach(p => p.classList.toggle("active", p.id === `panel-${name}`));
  if (name === "cruce") renderCruce();
  if (name === "comparar") renderComparar();
  if (name === "series") {
    if (!$("#ser-svg").innerHTML.trim()) loadSerie("148.3_INIVELNAL_DICI_M_26");
  }
  if (name === "dash" && !$("#dash-grid").innerHTML.trim()) renderDashboard();
  if (name === "heatmap" && !$("#hm-svg").innerHTML.trim()) {
    // No auto-compute (es pesado). El usuario hace click en "Calcular".
  }
}
$$(".tab").forEach(t => t.addEventListener("click", () => switchTab(t.dataset.tab)));

// -- Búsqueda --
function buildSearchIndex(level, geojson) {
  for (const feat of geojson.features || []) {
    const p = feat.properties || {};
    const nombre = p.nombre || "";
    if (!nombre || nombre === "—") continue;
    let ctx = "";
    if (p.provincia && p.provincia !== nombre) ctx = p.provincia;
    if (p.departamento && p.departamento !== nombre) ctx = p.departamento + (ctx ? `, ${ctx}` : "");
    searchIndex.push({ nombre, level, ctx, codigo: p.codigo_indec, props: p, _norm: norm(nombre) });
  }
}
function norm(s) {
  return (s || "").toString().toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ").trim();
}
let searchActiveIdx = -1;
const searchInput = $("#search");
const searchResults = $("#search-results");
let georefDebounce;
async function searchGeoref(q) {
  // Probar primero localidad+depto+prov por nombre, luego dirección
  const tryEndpoint = async (path, key) => {
    try {
      const r = await fetch(`https://apis.datos.gob.ar/georef/api/${path}?${key}=${encodeURIComponent(q)}&max=8`);
      if (!r.ok) return [];
      const d = await r.json();
      return d[Object.keys(d)[0]] || [];
    } catch { return []; }
  };
  const [locs, dirs] = await Promise.all([
    tryEndpoint("localidades", "nombre"),
    /\d/.test(q) ? tryEndpoint("direcciones", "direccion") : Promise.resolve([]),
  ]);
  const hits = [];
  locs.forEach(l => {
    const lat = l.centroide?.lat, lng = l.centroide?.lon;
    if (lat == null || lng == null) return;
    hits.push({
      nombre: l.nombre, level: "georef-localidad",
      ctx: `${l.departamento?.nombre || ""} · ${l.provincia?.nombre || ""}`,
      codigo: l.id,
      latlng: [lat, lng],
      _norm: norm(l.nombre),
    });
  });
  dirs.forEach(d => {
    const lat = d.ubicacion?.lat, lng = d.ubicacion?.lon;
    if (lat == null || lng == null) return;
    hits.push({
      nombre: d.nomenclatura, level: "georef-direccion",
      ctx: `${d.localidad_censal?.nombre || ""} · ${d.provincia?.nombre || ""}`,
      codigo: null, latlng: [lat, lng],
      _norm: norm(d.nomenclatura),
    });
  });
  return hits;
}

searchInput.addEventListener("input", () => {
  clearTimeout(georefDebounce);
  const q = norm(searchInput.value);
  if (!q || q.length < 2) { searchResults.classList.remove("open"); return; }
  const localHits = searchIndex.filter(h => h._norm.includes(q)).slice(0, 8);
  // Render inmediato con locales
  const renderHits = (hits) => {
    if (!hits.length) { searchResults.innerHTML = `<li class="muted">Sin resultados</li>`; searchResults.classList.add("open"); return; }
    searchResults.innerHTML = hits.map((h, i) => `
      <li data-idx="${i}">
        <span class="lvl">${h.level}</span>
        <div class="nom">${h.nombre}</div>
        ${h.ctx ? `<div class="ctx">${h.ctx}</div>` : ""}
      </li>`).join("");
    searchActiveIdx = 0;
    searchResults.classList.add("open");
    hits.forEach((h, i) => searchResults.children[i].addEventListener("click", () => goTo(h)));
    searchResults._hits = hits;
  };
  renderHits(localHits);
  // Augment con Georef solo si hay <4 locales (más útil para nombres raros)
  if (localHits.length < 4 && q.length >= 3) {
    georefDebounce = setTimeout(async () => {
      const gh = await searchGeoref(searchInput.value);
      if (norm(searchInput.value) !== q) return; // user typed más
      renderHits([...localHits, ...gh].slice(0, 12));
    }, 350);
  }
});
searchInput.addEventListener("keydown", e => {
  const hits = searchResults._hits || [];
  if (e.key === "ArrowDown") { searchActiveIdx = Math.min(hits.length - 1, searchActiveIdx + 1); highlight(); e.preventDefault(); }
  else if (e.key === "ArrowUp") { searchActiveIdx = Math.max(0, searchActiveIdx - 1); highlight(); e.preventDefault(); }
  else if (e.key === "Enter" && hits[searchActiveIdx]) goTo(hits[searchActiveIdx]);
  else if (e.key === "Escape") searchResults.classList.remove("open");
});
function highlight() { $$("li", searchResults).forEach((li, i) => li.classList.toggle("active", i === searchActiveIdx)); }
document.addEventListener("click", e => { if (!e.target.closest("#search-wrap")) searchResults.classList.remove("open"); });
async function goTo(hit) {
  searchResults.classList.remove("open");
  searchInput.value = hit.nombre;
  if (hit.latlng) {
    // Georef hit: solo mover el mapa al punto
    map.setView(hit.latlng, hit.level === "georef-direccion" ? 15 : 12);
    // Si es localidad, marker temporal
    L.circleMarker(hit.latlng, { radius: 6, color: "#fff", fillColor: "#5aa3ff", fillOpacity: 0.7, weight: 2 })
      .addTo(map).bindTooltip(hit.nombre, { permanent: false }).openTooltip();
  } else {
    await setLevel(hit.level, { fit: false });
    zoomToCode(hit.codigo);
  }
}

// -- Permalink --
function syncHash() {
  if (suppressHashUpdate) return;
  const c = map.getCenter();
  const parts = [];
  if (activeDataset && activeDataset !== "censo") parts.push(`ds=${activeDataset}`);
  parts.push(`l=${activeLevel}`);
  if (activeVar) parts.push(`v=${activeVar}`);
  if (selectedCode) parts.push(`c=${selectedCode}`);
  parts.push(`z=${map.getZoom()}`);
  parts.push(`xy=${c.lat.toFixed(4)},${c.lng.toFixed(4)}`);
  // Estado de visualizaciones derivadas
  if (activeDataset === "_swing" && $("#swing-a")?.value) {
    parts.push(`sw=${$("#swing-a").value},${$("#swing-b").value},${$("#swing-var").value}`);
  }
  if (activeDataset === "_cluster" && $("#cl-preset")?.value) {
    parts.push(`cl=${$("#cl-preset").value},${$("#cl-k").value}`);
  }
  if (activeDataset === "_lisa") {
    parts.push(`li=1`);
  }
  history.replaceState(null, "", `#${parts.join("&")}`);
}
async function loadHash() {
  if (!location.hash) return false;
  const q = Object.fromEntries(location.hash.slice(1).split("&").map(p => p.split("=")));
  suppressHashUpdate = true;
  try {
    if (q.ds && DATASETS[q.ds]) { activeDataset = q.ds; $("#ds-sel").value = q.ds; }
    populateVarSelect();
    if (q.v) { activeVar = q.v; $("#var-sel").value = q.v; }
    if (q.xy && q.z) {
      const [lat, lng] = q.xy.split(",").map(Number);
      map.setView([lat, lng], +q.z);
    }
    if (q.l) await setLevel(q.l, { fit: false });
    if (q.c) zoomToCode(q.c);
    // Re-construir visualizaciones derivadas
    if (q.sw) {
      const [a, b, v] = q.sw.split(",");
      $("#swing-a").value = a; $("#swing-b").value = b; $("#swing-var").value = v;
      setTimeout(() => applySwing(), 400);
    }
    if (q.cl) {
      const [preset, k] = q.cl.split(",");
      $("#cl-preset").value = preset; $("#cl-k").value = k;
      setTimeout(async () => { await runCluster(); await renderPCABiplot(); }, 400);
    }
    if (q.li === "1") {
      setTimeout(() => runLISA(), 400);
    }
  } finally { suppressHashUpdate = false; }
  return true;
}
$("#btn-print").addEventListener("click", () => {
  // Asegurar que details estén abiertos para impresión
  $$("details.all-datasets").forEach(d => d.setAttribute("open", "open"));
  setTimeout(() => window.print(), 200);
});

$("#btn-share").addEventListener("click", async () => {
  syncHash();
  try { await navigator.clipboard.writeText(location.href); $("#btn-share").textContent = "¡Copiado!"; setTimeout(() => $("#btn-share").textContent = "Copiar permalink", 1500); }
  catch { window.prompt("Copiá el link", location.href); }
});

// -- Export CSV --
$("#btn-export-csv").addEventListener("click", () => {
  const lvl = activeLevel === "radios" ? "radios" : activeLevel;
  const ind = indicadores[activeDataset]?.[lvl];
  if (!ind) return alert("Sin indicadores cargados para esta capa");
  const cols = new Set();
  Object.values(ind).forEach(d => Object.keys(d).forEach(k => cols.add(k)));
  const colArr = ["codigo_indec", "nombre", ...cols];
  const lookup = {};
  const layer = activeLevel === "radios" ? null : layerCache[activeLevel];
  if (layer) layer.eachLayer(l => { const p = l.feature?.properties; if (p?.codigo_indec) lookup[p.codigo_indec] = p; });
  const lines = [colArr.join(",")];
  Object.entries(ind).forEach(([code, d]) => {
    const p = lookup[code] || {};
    const row = colArr.map(c => {
      const v = c === "codigo_indec" ? code : (c === "nombre" ? (p.nombre || "") : d[c]);
      if (v == null) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    });
    lines.push(row.join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `atlas_${lvl}_${activeVar || "todos"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// -- Economía --
async function loadEconomia() {
  try {
    const r = await fetch("https://api.argentinadatos.com/v1/cotizaciones/dolares");
    const data = await r.json();
    const byCasa = {}; data.forEach(d => { byCasa[d.casa] = d; });
    const html = Object.values(byCasa).map(d => `
      <div class="rate"><span class="n">${d.nombre || d.casa}</span><span class="b">${fmtMoney.format(d.venta)}</span></div>`).join("");
    $("#blk-dolares").innerHTML = `<h3>Cotizaciones del dólar</h3>${html}
      <div class="meta">Último: ${(Object.values(byCasa)[0]||{}).fecha || "—"}</div>`;
  } catch { $("#blk-dolares").innerHTML = `<h3>Dólar</h3><div class="loading">Error</div>`; }

  try {
    const r = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/inflacion");
    const data = (await r.json()).slice(-12);
    const max = Math.max(...data.map(d => d.valor), 1);
    const bars = data.map(d => `<span title="${d.fecha}: ${d.valor}%" style="height:${Math.max(2, Math.round(d.valor/max*100))}%"></span>`).join("");
    const last = data[data.length - 1];
    const acum = data.reduce((a, d) => a * (1 + d.valor / 100), 1) - 1;
    $("#blk-inflacion").innerHTML = `<h3>Inflación mensual (últ. 12)</h3>
      <div class="spark">${bars}</div>
      <div class="rate"><span class="n">Último (${last.fecha})</span><span class="b">${fmt2.format(last.valor)}%</span></div>
      <div class="rate"><span class="n">Acum. 12m</span><span class="b">${fmt1.format(acum*100)}%</span></div>`;
  } catch { $("#blk-inflacion").innerHTML = `<h3>Inflación</h3><div class="loading">Error</div>`; }

  try {
    const r = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais");
    const data = (await r.json()).slice(-30);
    const max = Math.max(...data.map(d => d.valor));
    const min = Math.min(...data.map(d => d.valor));
    const last = data[data.length - 1];
    const prev = data[data.length - 2] || last;
    const delta = last.valor - prev.valor;
    const bars = data.map(d => {
      const h = Math.max(2, Math.round((d.valor - min*0.9) / (max - min*0.9 + 1) * 100));
      return `<span style="height:${h}%"></span>`;
    }).join("");
    $("#blk-riesgo").innerHTML = `<h3>Riesgo país (EMBI+)</h3>
      <div class="spark">${bars}</div>
      <div class="rate"><span class="n">Hoy (${last.fecha})</span><span class="b">${fmt.format(last.valor)} pb</span></div>
      <div class="rate"><span class="n">Δ vs ayer</span><span class="b" style="color:${delta>=0?'#ff6b6b':'#7df2c6'}">${delta>=0?'+':''}${fmt.format(delta)} pb</span></div>`;
  } catch { $("#blk-riesgo").innerHTML = `<h3>Riesgo país</h3><div class="loading">Error</div>`; }

  // Plazo fijo top 6
  try {
    const r = await fetch("https://api.argentinadatos.com/v1/finanzas/tasas/plazoFijo");
    const data = (await r.json()).slice(0, 6);
    const html = data.map(d => `
      <div class="rate"><span class="n">${(d.entidad||"").slice(0,28)}</span>
      <span class="b">${(d.tnaClientes*100).toFixed(1)}% TNA</span></div>`).join("");
    $("#blk-plazo").innerHTML = `<h3>Plazo fijo 30 días (top bancos)</h3>${html}`;
  } catch { $("#blk-plazo").innerHTML = `<h3>Plazo fijo</h3><div class="loading">Error</div>`; }

  // Próximos feriados
  try {
    const yr = new Date().getFullYear();
    const r = await fetch(`https://api.argentinadatos.com/v1/feriados/${yr}`);
    let data = await r.json();
    const today = new Date().toISOString().slice(0, 10);
    data = data.filter(d => d.fecha >= today).slice(0, 6);
    const html = data.map(d => `
      <div class="rate">
        <span class="n">${d.nombre.slice(0, 30)}</span>
        <span class="b">${d.fecha}</span>
      </div>`).join("");
    $("#blk-feriados").innerHTML = `<h3>Próximos feriados ${yr}</h3>${html || '<div class="loading">No quedan feriados</div>'}`;
  } catch { $("#blk-feriados").innerHTML = `<h3>Feriados</h3><div class="loading">Error</div>`; }

  // IPC INDEC por región — del JSON local pre-procesado
  try {
    const r = await fetch("../data/web/ipc_nacional.json");
    if (!r.ok) throw new Error();
    const data = await r.json();
    const order = ["nacional", "gba", "pampeana", "nea", "noa", "cuyo", "patagonia"];
    const rows = order.filter(k => data.regiones[k]).map(k => {
      const d = data.regiones[k];
      return `<div class="rate">
        <span class="n">${k.toUpperCase()}</span>
        <span class="b">${d.ipc_var_mensual?.toFixed(2)}% m/m
        <span style="color:var(--muted);margin-left:6px">${d.ipc_var_interanual?.toFixed(1)}% i.a.</span></span>
      </div>`;
    }).join("");
    $("#blk-ipc-reg").innerHTML = `<h3>IPC INDEC por región (${data.last_date})</h3>${rows}
      <div class="meta">Base diciembre 2016 = 100</div>`;
  } catch { $("#blk-ipc-reg").innerHTML = `<h3>IPC regional</h3><div class="loading">Error</div>`; }

  // Pobreza nacional EPH
  try {
    const r = await fetch("../data/web/pobreza_nacional.json");
    if (!r.ok) throw new Error();
    const d = await r.json();
    const serie = d.serie || [];
    const max = Math.max(...serie.map(s => s.pobres_personas), 1);
    const bars = serie.map(s => `<span title="${s.fecha}: ${s.pobres_personas}%" style="height:${Math.max(2, Math.round(s.pobres_personas/max*100))}%"></span>`).join("");
    $("#blk-pobreza").innerHTML = `<h3>Pobreza e Indigencia · EPH (${d.last_date})</h3>
      <div class="rate"><span class="n">Pobres (personas)</span><span class="b">${d.pobres_personas.toFixed(1)}%</span></div>
      <div class="rate"><span class="n">Pobres (hogares)</span><span class="b">${d.pobres_hogares.toFixed(1)}%</span></div>
      <div class="rate"><span class="n">Indigentes (personas)</span><span class="b">${d.indigentes_poblacion.toFixed(1)}%</span></div>
      <div class="spark">${bars}</div>
      <div class="meta">Serie últimos ${serie.length} períodos</div>`;
  } catch { $("#blk-pobreza").innerHTML = `<h3>Pobreza</h3><div class="loading">Error</div>`; }
}

async function loadPolitica() {
  try {
    const r = await fetch("https://api.argentinadatos.com/v1/senado/senadores");
    const data = await r.json();
    const byBloque = {}; data.forEach(s => { byBloque[s.bloque] = (byBloque[s.bloque]||0)+1; });
    const sorted = Object.entries(byBloque).sort((a,b) => b[1]-a[1]);
    const max = sorted[0]?.[1] || 1;
    const html = sorted.slice(0, 10).map(([b,n]) => `
      <div class="bar-row"><span class="lbl" title="${b}">${(b||"—").slice(0,10)}</span>
        <span class="bar" style="width:${n/max*100}%"></span><span class="val">${n}</span></div>`).join("");
    $("#blk-senado").innerHTML = `<h3>Senado · ${data.length} bancas</h3>${html}`;
  } catch { $("#blk-senado").innerHTML = `<h3>Senado</h3><div class="loading">Error</div>`; }

  try {
    const r = await fetch("https://api.argentinadatos.com/v1/diputados/diputados");
    const data = await r.json();
    const byBloque = {}; data.forEach(s => { byBloque[s.bloque] = (byBloque[s.bloque]||0)+1; });
    const sorted = Object.entries(byBloque).sort((a,b) => b[1]-a[1]);
    const max = sorted[0]?.[1] || 1;
    const html = sorted.slice(0, 10).map(([b,n]) => `
      <div class="bar-row"><span class="lbl" title="${b}">${(b||"—").slice(0,10)}</span>
        <span class="bar" style="width:${n/max*100}%"></span><span class="val">${n}</span></div>`).join("");
    $("#blk-diputados").innerHTML = `<h3>Diputados · ${data.length} bancas</h3>${html}`;
  } catch { $("#blk-diputados").innerHTML = `<h3>Diputados</h3><div class="loading">Error</div>`; }

  try {
    const r = await fetch("https://api.argentinadatos.com/v1/presidentes");
    const data = await r.json();
    const recent = data.slice(-6).reverse();
    const html = recent.map(p => `
      <div class="rate" title="${p.partido||''}">
        <span class="n">${p.nombre.slice(0,28)}</span>
        <span class="b" style="color:var(--muted)">${(p.inicio||'').slice(0,4)}–${(p.fin||'').slice(0,4) || '—'}</span>
      </div>`).join("");
    $("#blk-presidentes").innerHTML = `<h3>Presidentes recientes</h3>${html}`;
  } catch { $("#blk-presidentes").innerHTML = `<h3>Presidentes</h3><div class="loading">Error</div>`; }
}

// -- Cruce censo ↔ electoral --
function populateCruceSelects() {
  const x = $("#cruce-x"), y = $("#cruce-y");
  // X = variables censo (sin "viv_part" "varones" "mujeres" — usar las derivadas/principales)
  const censoVars = [
    ["personas", "Población"],
    ["hogares", "Hogares"],
    ["viv_part_h", "Viv. habitadas"],
    ["idx_masculinidad", "Índ. masculinidad"],
    ["personas_por_hogar", "Personas/hogar"],
    ["personas_por_vivienda", "Personas/vivienda"],
  ];
  x.innerHTML = censoVars.map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
  refreshCruceY();
  x.value = "personas_por_hogar"; // default interesante (correlaciona con nivel socioeconómico)
}
function refreshCruceY() {
  const ds = $("#cruce-ds").value;
  const y = $("#cruce-y");
  y.innerHTML = DATASETS[ds].vars.map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
  y.value = "lla_pct";
}

function pearsonR(pairs) {
  if (pairs.length < 3) return null;
  const n = pairs.length;
  let sx=0, sy=0, sxx=0, syy=0, sxy=0;
  for (const [x, y] of pairs) {
    sx += x; sy += y; sxx += x*x; syy += y*y; sxy += x*y;
  }
  const num = n*sxy - sx*sy;
  const den = Math.sqrt((n*sxx - sx*sx) * (n*syy - sy*sy));
  return den ? num / den : null;
}

async function renderCruce() {
  const xVar = $("#cruce-x").value;
  const yVar = $("#cruce-y").value;
  const ds = $("#cruce-ds").value;
  const xData = await loadIndicadores("departamentos", "censo");
  const yData = await loadIndicadores("departamentos", ds);
  if (!xData || !yData) return;

  // Lookup nombres por código depto desde la capa departamentos
  const layer = layerCache.departamentos;
  const nameByCode = {};
  if (layer) layer.eachLayer(l => {
    const p = l.feature?.properties;
    if (p?.codigo_indec) nameByCode[p.codigo_indec] = { nombre: p.nombre, prov: p.provincia };
  });

  // Construir pares (solo los que tengan ambas variables)
  const points = [];
  for (const [code, ind] of Object.entries(yData)) {
    const xv = xData[code]?.[xVar];
    const yv = ind?.[yVar];
    if (xv == null || yv == null || !isFinite(xv) || !isFinite(yv)) continue;
    points.push({ code, x: xv, y: yv, nombre: nameByCode[code]?.nombre || code });
  }
  const r = pearsonR(points.map(p => [p.x, p.y]));
  const rabs = r == null ? null : Math.abs(r);
  const rClass = r == null ? "weak" : (rabs >= 0.5 ? "strong" : (rabs >= 0.3 ? "" : "weak"));
  $("#cruce-stats").innerHTML = `
    <span>${points.length} deptos</span>
    <span>Pearson R: <span class="r ${rClass}">${r == null ? "—" : r.toFixed(3)}</span></span>
    <span>R²: <span class="r ${rClass}">${r == null ? "—" : (r*r).toFixed(3)}</span></span>
  `;

  // SVG render
  const W = 340, H = 240, m = { l: 40, r: 10, t: 10, b: 30 };
  const innerW = W - m.l - m.r, innerH = H - m.t - m.b;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const xRange = xmax - xmin || 1, yRange = ymax - ymin || 1;
  const sx = (v) => m.l + ((v - xmin) / xRange) * innerW;
  const sy = (v) => m.t + innerH - ((v - ymin) / yRange) * innerH;
  // Ticks
  const xt = [xmin, xmin + xRange/2, xmax];
  const yt = [ymin, ymin + yRange/2, ymax];
  const fmtTick = (v, isPct) => isPct ? `${(v*100).toFixed(0)}%` : (Math.abs(v) >= 1000 ? fmt.format(Math.round(v)) : v.toFixed(1));
  const xPct = isPctVar(xVar), yPct = isPctVar(yVar);
  // Línea de regresión simple
  let fitLine = "";
  if (r != null && points.length >= 3) {
    const meanX = xs.reduce((a,b)=>a+b)/xs.length;
    const meanY = ys.reduce((a,b)=>a+b)/ys.length;
    const slope = points.reduce((s,p) => s + (p.x - meanX)*(p.y - meanY), 0) /
                  points.reduce((s,p) => s + (p.x - meanX)**2, 0);
    const inter = meanY - slope*meanX;
    const y1 = slope*xmin + inter, y2 = slope*xmax + inter;
    fitLine = `<line class="fit" x1="${sx(xmin)}" y1="${sy(y1)}" x2="${sx(xmax)}" y2="${sy(y2)}" />`;
  }

  const dots = points.map(p => `
    <circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="3" fill="#5aa3ff" fill-opacity="0.55"
      stroke="${p.code === selectedCode ? '#fff' : 'none'}"
      class="${p.code === selectedCode ? 'sel' : ''}"
      data-code="${p.code}" data-name="${p.nombre}"></circle>
  `).join("");

  $("#cruce-svg").innerHTML = `
    <line class="ax" x1="${m.l}" y1="${m.t+innerH}" x2="${m.l+innerW}" y2="${m.t+innerH}" />
    <line class="ax" x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${m.t+innerH}" />
    ${xt.map(v => `<text class="ax-text" x="${sx(v)}" y="${m.t+innerH+12}" text-anchor="middle">${fmtTick(v, xPct)}</text>`).join("")}
    ${yt.map(v => `<text class="ax-text" x="${m.l-4}" y="${sy(v)+3}" text-anchor="end">${fmtTick(v, yPct)}</text>`).join("")}
    <text class="ax-text" x="${m.l+innerW/2}" y="${H-4}" text-anchor="middle">${labelFor(xVar)}</text>
    <text class="ax-text" x="0" y="${m.t+innerH/2}" transform="rotate(-90 8 ${m.t+innerH/2})" text-anchor="middle">${labelFor(yVar)}</text>
    ${fitLine}
    ${dots}
  `;

  // Click & hover
  $$("#cruce-svg circle").forEach(c => {
    c.addEventListener("mouseenter", e => {
      const name = e.target.dataset.name;
      const code = e.target.dataset.code;
      const px = parseFloat(e.target.getAttribute("cx"));
      const py = parseFloat(e.target.getAttribute("cy"));
      const xv = xData[code]?.[xVar], yv = yData[code]?.[yVar];
      $("#cruce-hover").textContent = `${name} · ${labelFor(xVar)}=${fmtVal(xv, xVar)} · ${labelFor(yVar)}=${fmtVal(yv, yVar)}`;
    });
    c.addEventListener("mouseleave", () => $("#cruce-hover").textContent = "—");
    c.addEventListener("click", async () => {
      // Cambiar a dataset electoral + nivel depto y zoom
      if (activeDataset !== ds || activeLevel !== "departamentos") {
        activeDataset = ds; $("#ds-sel").value = ds; populateVarSelect();
        activeVar = yVar; $("#var-sel").value = yVar;
        await setLevel("departamentos", { fit: false });
      }
      zoomToCode(c.dataset.code);
      switchTab("info");
    });
  });
}

["change", "input"].forEach(ev => {
  ["#cruce-x", "#cruce-y", "#cruce-ds"].forEach(s => {
    $(s).addEventListener(ev, () => {
      if (s === "#cruce-ds") refreshCruceY();
      renderCruce();
    });
  });
});

// -- Series API por feature: mapeo región/var → series_id --
const SERIES_BY_DATASET_REGION = {
  ipc: {
    region_to_id: {
      pampeana: "145.3_INGPAMANA_DICI_M_15",
      nea: "145.3_INGNEANEA_DICI_M_10",
      noa: "145.3_INGNOANOA_DICI_M_10",
      cuyo: "145.3_INGCUYUYO_DICI_M_11",
      patagonia: "145.3_INGPATNIA_DICI_M_16",
      nacional: "148.3_INIVELNAL_DICI_M_26",
    },
    label: "IPC Nivel General · serie",
    prov_to_region: {
      "02": "nacional", "06": "pampeana", "14": "pampeana", "82": "pampeana",
      "30": "pampeana", "42": "pampeana",
      "18": "nea", "22": "nea", "34": "nea", "54": "nea",
      "10": "noa", "38": "noa", "46": "noa", "66": "noa", "86": "noa", "90": "noa",
      "50": "cuyo", "70": "cuyo", "74": "cuyo",
      "26": "patagonia", "58": "patagonia", "62": "patagonia", "78": "patagonia", "94": "patagonia",
    },
  },
  empleo: {
    // Tasa desempleo por aglomerado — todos los principales se mapean al
    // mismo grupo regional simple
    region_to_id: {
      nacional: "45.2_ECTDT_0_T_32",  // tasa desempleo total trimestral EPH
    },
    label: "Tasa desempleo nacional · EPH",
    prov_to_region: Object.fromEntries(
      ["02","06","10","14","18","22","26","30","34","38","42","46","50","54","58","62","66","70","74","78","82","86","90","94"]
        .map(c => [c, "nacional"])),
  },
  economia: {
    // Exportaciones totales nacionales · serie
    region_to_id: {
      nacional: "175.1_EXPO_TOTAL_0_0_30",
    },
    label: "Exportaciones totales Argentina · serie",
    prov_to_region: Object.fromEntries(
      ["02","06","10","14","18","22","26","30","34","38","42","46","50","54","58","62","66","70","74","78","82","86","90","94"]
        .map(c => [c, "nacional"])),
  },
};

async function loadFeatureSerie(provCode) {
  const cfg = SERIES_BY_DATASET_REGION[activeDataset];
  if (!cfg) return null;
  const region = cfg.prov_to_region[provCode];
  if (!region) return null;
  const id = cfg.region_to_id[region];
  if (!id) return null;
  try {
    const r = await fetch(`${SERIES_API}/series/?ids=${id}&limit=120&format=json`);
    const d = await r.json();
    if (!d.data?.length) return null;
    return {
      label: `${cfg.label} · ${region.toUpperCase()}`,
      points: d.data.map(p => ({ x: p[0], y: +p[1] })).filter(p => isFinite(p.y)),
    };
  } catch { return null; }
}

// -- Animación temporal electoral --
const ANIM_SEQUENCES = {
  pres: [
    { ds: "2015_generales", label: "2015 Gen" },
    { ds: "2015_balotaje",  label: "2015 Bal" },
    { ds: "2019_paso",      label: "2019 PASO" },
    { ds: "2019_generales", label: "2019 Gen" },
    { ds: "2023_generales", label: "2023 Gen" },
    { ds: "2023_balotaje",  label: "2023 Bal" },
  ],
  dip: [
    { ds: "2017_diputados", label: "2017" },
    { ds: "2021_diputados", label: "2021" },
    { ds: "2023_diputados", label: "2023" },
  ],
};
let animTimer = null;
let animIdx = 0;

function showAnim() { $("#anim").classList.remove("hidden"); renderAnimTape(); }
function hideAnim() { $("#anim").classList.add("hidden"); stopAnim(); }
function renderAnimTape() {
  const cargo = $("#anim-cargo").value;
  const seq = ANIM_SEQUENCES[cargo];
  $("#anim-labels").innerHTML = seq.map((s, i) =>
    `<span data-idx="${i}" class="${i === animIdx ? 'active' : ''}">${s.label}</span>`).join("");
  $$("#anim-labels span").forEach(el => el.addEventListener("click", () => {
    stopAnim(); animIdx = +el.dataset.idx; applyAnimStep();
  }));
  $("#anim-progress").style.width = `${(animIdx / Math.max(1, seq.length - 1)) * 100}%`;
}
async function applyAnimStep() {
  const cargo = $("#anim-cargo").value;
  const coal = $("#anim-coal").value;
  const seq = ANIM_SEQUENCES[cargo];
  const step = seq[animIdx];
  if (!step) return;
  // Cambiar dataset si está soportado
  if (DATASETS[step.ds]) {
    activeDataset = step.ds;
    $("#ds-sel").value = step.ds;
    populateVarSelect();
    // Si la variable elegida existe, usarla; si no, default
    const has = DATASETS[step.ds].vars.some(([k]) => k === coal);
    activeVar = has ? coal : DATASETS[step.ds].defaultVar;
    $("#var-sel").value = activeVar;
    if (!["provincias","departamentos"].includes(activeLevel)) {
      await setLevel("departamentos", { fit: false });
    } else {
      await loadIndicadores(activeLevel);
      computeStats(activeLevel);
      restyleActive();
    }
  }
  $("#anim-now").textContent = `${DATASETS[step.ds]?.label || step.ds}  ·  ${activeVar}`;
  renderAnimTape();
}
function stepAnim(forward = true) {
  const seq = ANIM_SEQUENCES[$("#anim-cargo").value];
  animIdx = (animIdx + (forward ? 1 : -1) + seq.length) % seq.length;
  applyAnimStep();
}
function playAnim() {
  if (animTimer) return;
  $("#anim-play").textContent = "⏸";
  animTimer = setInterval(() => stepAnim(true), 2200);
  applyAnimStep();
}
function stopAnim() {
  if (animTimer) { clearInterval(animTimer); animTimer = null; }
  $("#anim-play").textContent = "▶";
}
function toggleAnim() {
  if (animTimer) stopAnim();
  else playAnim();
}

$("#anim-play").addEventListener("click", toggleAnim);
$("#anim-cargo").addEventListener("change", () => { animIdx = 0; applyAnimStep(); });
$("#anim-coal").addEventListener("change", () => applyAnimStep());

// -- Export CSV genérico (data como [{...}, ...]) --
function downloadCSV(rows, filename) {
  if (!rows.length) return alert("Sin datos para exportar");
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const lines = [cols.join(",")];
  for (const r of rows) {
    const row = cols.map(c => {
      const v = r[c];
      if (v == null) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    });
    lines.push(row.join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportClusterCSV() {
  const ass = indicadores._cluster?.departamentos;
  if (!ass) return alert("Primero ejecutá k-means");
  const layer = layerCache.departamentos;
  const rows = [];
  if (layer) layer.eachLayer(l => {
    const p = l.feature?.properties;
    if (p?.codigo_indec && ass[p.codigo_indec]) {
      rows.push({
        codigo_indec: p.codigo_indec,
        nombre: p.nombre, provincia: p.provincia || "",
        cluster: ass[p.codigo_indec].cluster,
      });
    }
  });
  downloadCSV(rows, "atlas_clusters.csv");
}

function exportLISACSV() {
  const ass = indicadores._lisa?.departamentos;
  if (!ass) return alert("Primero ejecutá LISA");
  const layer = layerCache.departamentos;
  const labels = { 1: "HH", 2: "LL", 3: "HL", 4: "LH", 0: "ns" };
  const rows = [];
  if (layer) layer.eachLayer(l => {
    const p = l.feature?.properties;
    if (p?.codigo_indec && ass[p.codigo_indec]) {
      const r = ass[p.codigo_indec];
      rows.push({
        codigo_indec: p.codigo_indec,
        nombre: p.nombre, provincia: p.provincia || "",
        lisa_cat: labels[r.lisa_cat] || r.lisa_cat,
        z: r.lisa_zi, z_lag: r.lisa_zlag, Ii: r.lisa_Ii,
      });
    }
  });
  downloadCSV(rows, "atlas_lisa.csv");
}

// -- Export SVG → PNG --
function svgToPng(svgEl, filename, scale = 2) {
  if (!svgEl) return;
  const xml = new XMLSerializer().serializeToString(svgEl);
  const vb = svgEl.viewBox.baseVal;
  const w = (vb?.width || svgEl.clientWidth || 800) * scale;
  const h = (vb?.height || svgEl.clientHeight || 600) * scale;
  const blob = new Blob([
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' +
    (vb?.width || 800) + ' ' + (vb?.height || 600) + '">' +
    '<rect width="100%" height="100%" fill="#161d2e"/>' +
    xml.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "") +
    "</svg>"
  ], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    canvas.toBlob(b => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  };
  img.onerror = () => { URL.revokeObjectURL(url); alert("Error exportando PNG"); };
  img.src = url;
}

// -- K-means clustering territorial --
const CLUSTER_PRESETS = {
  electoral: [
    ["2023_generales", "lla_pct", "% LLA 2023"],
    ["2023_generales", "pj_pct",  "% PJ 2023"],
    ["2023_generales", "jxc_pct", "% JxC 2023"],
    ["2023_generales", "participacion", "Particip. 2023"],
  ],
  socioeconomico: [
    ["censo", "densidad_km2", "Densidad"],
    ["censo", "personas_por_hogar", "Pers/hogar"],
    ["censo", "idx_masculinidad", "Índ. masc."],
    ["salud", "establecimientos_por_10k_hab", "Salud 10k"],
    ["educacion", "escuelas_por_10k_hab", "Escuelas 10k"],
    ["socio", "mortalidad_infantil", "Mort. inf."],
  ],
  mixto: [
    ["2023_generales", "lla_pct", "% LLA 2023"],
    ["2023_generales", "pj_pct", "% PJ 2023"],
    ["censo", "densidad_km2", "Densidad"],
    ["censo", "personas_por_hogar", "Pers/hogar"],
    ["censo", "idx_masculinidad", "Índ. masc."],
  ],
  custom: [
    ["2023_generales", "lla_pct", "% LLA 2023"],
    ["censo", "personas_por_hogar", "Pers/hogar"],
  ],
};

function kmeans(points, k, maxIter = 80) {
  const n = points.length;
  if (n < k) return null;
  const dim = points[0].length;
  // Init: k-means++ (uno random, resto por probabilidad ∝ distancia²)
  const centroids = [points[Math.floor(Math.random() * n)].slice()];
  for (let c = 1; c < k; c++) {
    const dists = points.map(p => {
      let min = Infinity;
      for (const c0 of centroids) {
        let d = 0;
        for (let j = 0; j < dim; j++) d += (p[j] - c0[j]) ** 2;
        if (d < min) min = d;
      }
      return min;
    });
    const totalD = dists.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalD, acc = 0, pick = 0;
    for (let i = 0; i < n; i++) { acc += dists[i]; if (acc >= r) { pick = i; break; } }
    centroids.push(points[pick].slice());
  }
  // Iterate
  const assign = new Array(n).fill(-1);
  for (let it = 0; it < maxIter; it++) {
    let changed = 0;
    for (let i = 0; i < n; i++) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < k; c++) {
        let d = 0;
        for (let j = 0; j < dim; j++) d += (points[i][j] - centroids[c][j]) ** 2;
        if (d < bestD) { bestD = d; best = c; }
      }
      if (assign[i] !== best) { assign[i] = best; changed++; }
    }
    if (changed === 0) break;
    for (let c = 0; c < k; c++) {
      const members = [];
      for (let i = 0; i < n; i++) if (assign[i] === c) members.push(points[i]);
      if (!members.length) continue;
      centroids[c] = new Array(dim).fill(0).map((_, j) =>
        members.reduce((s, p) => s + p[j], 0) / members.length);
    }
  }
  return { centroids, assign };
}

async function runCluster() {
  const preset = CLUSTER_PRESETS[$("#cl-preset").value];
  const k = +$("#cl-k").value;
  if (!preset) return;
  $("#cl-stats").innerHTML = "Cargando datasets…";

  // Cargar indicadores necesarios
  const dsSet = new Set(preset.map(([ds]) => ds));
  for (const ds of dsSet) await loadIndicadores("departamentos", ds);

  // Build matrix
  const getVal = (ds, key, code) => indicadores[ds]?.departamentos?.[code]?.[key];
  // Universe = códigos con todas las variables presentes
  const layer = layerCache.departamentos;
  const allCodes = new Set();
  if (layer) layer.eachLayer(l => { const p = l.feature?.properties; if (p?.codigo_indec) allCodes.add(p.codigo_indec); });
  const codes = [];
  const X = [];
  for (const code of allCodes) {
    const row = preset.map(([ds, key]) => {
      const v = getVal(ds, key, code);
      return v == null || !isFinite(v) ? null : +v;
    });
    if (row.every(v => v != null)) { codes.push(code); X.push(row); }
  }
  if (codes.length < 20) { $("#cl-stats").innerHTML = "Pocas obs. completas"; return; }

  // Estandarizar columnas
  const dim = X[0].length;
  for (let j = 0; j < dim; j++) {
    const col = X.map(r => r[j]);
    const m = col.reduce((a, b) => a + b, 0) / col.length;
    const sd = Math.sqrt(col.reduce((a, b) => a + (b - m) ** 2, 0) / col.length) || 1;
    for (let i = 0; i < X.length; i++) X[i][j] = (X[i][j] - m) / sd;
  }

  // Run
  const result = kmeans(X, k);
  if (!result) { $("#cl-stats").innerHTML = "Falló k-means"; return; }

  // Push al dataset virtual
  const obj = {};
  codes.forEach((c, i) => { obj[c] = { cluster: result.assign[i] }; });
  indicadores._cluster.departamentos = obj;

  // Activar
  activeDataset = "_cluster";
  $("#ds-sel").value = "_cluster"; // no existe en HTML, no rompe
  populateVarSelect();
  activeVar = "cluster";
  await setLevel("departamentos", { fit: false });
  computeStats("departamentos");
  restyleActive();

  // Resumen por cluster
  const ramp = VAR_SCALES.cluster;
  const summary = [];
  for (let c = 0; c < k; c++) {
    const members = codes.filter((_, i) => result.assign[i] === c);
    // Centroide en unidades originales: invertir la estandarización
    // Lo recalculamos sobre la matriz original (deshacer la transformación es complejo)
    // En su lugar, mostramos medias originales del cluster
    const features = preset.map(([ds, key, lbl], j) => {
      const vals = members.map(code => getVal(ds, key, code)).filter(v => v != null);
      const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      return [lbl, mean];
    });
    summary.push({ c, n: members.length, features });
  }
  // Render cards
  $("#cl-summary").innerHTML = summary.map(s => `
    <div class="cl-card">
      <span class="dot" style="background:${ramp[s.c % ramp.length]}"></span>
      <div>
        <div style="font-weight:600;color:var(--text)">Cluster ${s.c + 1}</div>
        <div class="cl-features">${s.features.map(([l, m]) =>
          `${l}: ${m == null ? '—' : fmt2.format(m)}`).join(' · ')}</div>
      </div>
      <span class="cl-n">${s.n}</span>
    </div>`).join("");
  $("#cl-stats").innerHTML = `<span>${codes.length} deptos</span>
    <span>k=${k}</span> <span>${preset.length} vars</span>`;
}

// -- PCA (Power iteration) --
function matVec(M, v) {
  return M.map(row => row.reduce((s, x, j) => s + x * v[j], 0));
}
function normalize(v) {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map(x => x / n);
}
function eigenPower(M, iters = 200) {
  const n = M.length;
  let v = new Array(n).fill(0).map(() => Math.random());
  v = normalize(v);
  let lambda = 0;
  for (let i = 0; i < iters; i++) {
    const w = matVec(M, v);
    const norm = Math.sqrt(w.reduce((s, x) => s + x * x, 0)) || 1;
    lambda = norm;
    v = w.map(x => x / norm);
  }
  return { vec: v, val: lambda };
}
function pcaTop2(X) {
  // X: n×p standardized
  const n = X.length, p = X[0].length;
  // Covarianza p×p
  const cov = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      for (let b = 0; b < p; b++) cov[a][b] += X[i][a] * X[i][b];
    }
  }
  for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) cov[a][b] /= (n - 1);
  // PC1
  const pc1 = eigenPower(cov);
  // Deflate: cov' = cov - λ v vᵀ
  const cov2 = cov.map((row, a) => row.map((x, b) => x - pc1.val * pc1.vec[a] * pc1.vec[b]));
  const pc2 = eigenPower(cov2);
  // Varianza explicada (suma de eigenvalues = traza = p ya que X estandarizado)
  const totalVar = p;
  return {
    pc1: pc1.vec, pc2: pc2.vec,
    var1: pc1.val / totalVar,
    var2: pc2.val / totalVar,
  };
}

function projectPCA(X, pc1, pc2) {
  return X.map(row => [
    row.reduce((s, x, j) => s + x * pc1[j], 0),
    row.reduce((s, x, j) => s + x * pc2[j], 0),
  ]);
}

async function renderPCABiplot() {
  const preset = CLUSTER_PRESETS[$("#cl-preset").value];
  const dsSet = new Set(preset.map(([ds]) => ds));
  for (const ds of dsSet) await loadIndicadores("departamentos", ds);
  const getVal = (ds, key, code) => indicadores[ds]?.departamentos?.[code]?.[key];
  const layer = layerCache.departamentos;
  const allCodes = new Set();
  if (layer) layer.eachLayer(l => { const p = l.feature?.properties; if (p?.codigo_indec) allCodes.add(p.codigo_indec); });
  const codes = []; const X = []; const names = [];
  for (const code of allCodes) {
    const row = preset.map(([ds, key]) => {
      const v = getVal(ds, key, code);
      return v == null || !isFinite(v) ? null : +v;
    });
    if (row.every(v => v != null)) {
      codes.push(code); X.push(row);
      let nm = code;
      layer.eachLayer(l => { if (l.feature?.properties.codigo_indec === code) nm = l.feature.properties.nombre; });
      names.push(nm);
    }
  }
  if (X.length < 20) { $("#pca-svg").innerHTML = ""; return; }

  // Estandarizar
  const dim = X[0].length;
  for (let j = 0; j < dim; j++) {
    const col = X.map(r => r[j]);
    const m = col.reduce((a, b) => a + b, 0) / col.length;
    const sd = Math.sqrt(col.reduce((a, b) => a + (b - m) ** 2, 0) / col.length) || 1;
    for (let i = 0; i < X.length; i++) X[i][j] = (X[i][j] - m) / sd;
  }

  // PCA
  const { pc1, pc2, var1, var2 } = pcaTop2(X);
  const points2D = projectPCA(X, pc1, pc2);

  // Render biplot SVG
  const W = 360, H = 320, m = { l: 30, r: 10, t: 10, b: 30 };
  const innerW = W - m.l - m.r, innerH = H - m.t - m.b;
  const xs = points2D.map(p => p[0]), ys = points2D.map(p => p[1]);
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const xRng = (xmax - xmin) || 1, yRng = (ymax - ymin) || 1;
  const sx = v => m.l + ((v - xmin) / xRng) * innerW;
  const sy = v => m.t + innerH - ((v - ymin) / yRng) * innerH;

  // Cluster colors
  const clusterMap = indicadores._cluster?.departamentos || {};
  const ramp = VAR_SCALES.cluster;
  const dots = points2D.map((p, i) => {
    const c = clusterMap[codes[i]]?.cluster ?? 0;
    return `<circle cx="${sx(p[0]).toFixed(1)}" cy="${sy(p[1]).toFixed(1)}" r="3"
      fill="${ramp[c % ramp.length]}" fill-opacity="0.7" stroke="${ramp[c % ramp.length]}" stroke-width="0.5"
      class="pca-pt" data-code="${codes[i]}" data-name="${names[i]}" data-x="${p[0].toFixed(2)}" data-y="${p[1].toFixed(2)}"/>`;
  }).join("");

  // Loadings (variables como flechas)
  const scale = 0.85 * Math.min(innerW, innerH) / 2;
  const cx = m.l + innerW / 2, cy = m.t + innerH / 2;
  const arrows = preset.map(([_, _key, lbl], j) => {
    const ax = pc1[j] * scale, ay = pc2[j] * scale;
    const x2 = cx + ax, y2 = cy - ay;
    return `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
      stroke="#ffb454" stroke-width="1.2" marker-end="url(#arr)"/>
      <text x="${x2.toFixed(1)}" y="${y2.toFixed(1)}" fill="#ffb454" font-size="9"
        dx="3" dy="3">${lbl.substring(0, 18)}</text>`;
  }).join("");

  $("#pca-svg").innerHTML = `
    <defs><marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#ffb454"/></marker></defs>
    <line x1="${m.l}" y1="${cy.toFixed(1)}" x2="${m.l+innerW}" y2="${cy.toFixed(1)}" stroke="#222b41" stroke-width="0.5"/>
    <line x1="${cx.toFixed(1)}" y1="${m.t}" x2="${cx.toFixed(1)}" y2="${m.t+innerH}" stroke="#222b41" stroke-width="0.5"/>
    ${dots}
    ${arrows}
    <text x="${m.l+innerW}" y="${H-8}" fill="#8893ad" font-size="10" text-anchor="end">PC1 (${(var1*100).toFixed(1)}%)</text>
    <text x="${m.l+4}" y="${m.t+10}" fill="#8893ad" font-size="10">PC2 (${(var2*100).toFixed(1)}%)</text>
  `;

  $$(".pca-pt").forEach(el => {
    el.addEventListener("mouseenter", () => {
      $("#pca-hover").textContent = `${el.dataset.name} · PC1=${el.dataset.x} · PC2=${el.dataset.y}`;
    });
    el.addEventListener("click", () => zoomToCode(el.dataset.code));
  });

  // Outliers — distancia al centroide de su cluster en espacio estandarizado
  const clusterMap2 = indicadores._cluster?.departamentos || {};
  // Calcular centroides en espacio estandarizado
  const k = +$("#cl-k").value;
  const centroidsStd = [];
  for (let c = 0; c < k; c++) {
    const members = X.filter((_, i) => (clusterMap2[codes[i]]?.cluster ?? -1) === c);
    if (!members.length) { centroidsStd.push(null); continue; }
    centroidsStd.push(new Array(dim).fill(0).map((_, j) =>
      members.reduce((s, r) => s + r[j], 0) / members.length));
  }
  const distances = codes.map((code, i) => {
    const c = clusterMap2[code]?.cluster ?? -1;
    const ctr = centroidsStd[c];
    if (!ctr) return { code, name: names[i], dist: 0 };
    const d = Math.sqrt(X[i].reduce((s, x, j) => s + (x - ctr[j]) ** 2, 0));
    return { code, name: names[i], dist: d };
  });
  distances.sort((a, b) => b.dist - a.dist);
  const top = distances.slice(0, 10);

  // Lookup ctx (provincia)
  const ctxOf = (code) => {
    let ctx = "";
    layerCache.departamentos.eachLayer(l => {
      if (l.feature?.properties.codigo_indec === code) ctx = l.feature.properties.provincia || "";
    });
    return ctx;
  };
  $("#cl-outliers").innerHTML = top.map((o, i) => `
    <div class="rk-row" data-code="${o.code}">
      <span class="pos">${i + 1}</span>
      <span class="nom" title="${o.name}">${o.name} <span class="ctx">${ctxOf(o.code)}</span></span>
      <span class="val">${o.dist.toFixed(2)} σ</span>
    </div>`).join("");
  $$("#cl-outliers .rk-row").forEach(r => {
    r.addEventListener("click", () => zoomToCode(r.dataset.code));
  });
}

$("#cl-run").addEventListener("click", async () => {
  await runCluster();
  await renderPCABiplot();
});

// -- Dashboard nacional --
async function renderDashboard() {
  const grid = $("#dash-grid");
  grid.innerHTML = "<div style='color:var(--muted);font-size:11px'>Cargando…</div>";

  // Pull datos nacionales / agregados
  const cards = [];
  // Censo país totales
  const pais = await loadIndicadores("pais", "censo");
  if (pais) {
    cards.push({ label: "Población", val: fmt.format(pais.personas), meta: "Censo 2022" });
    cards.push({ label: "Hogares", val: fmt.format(pais.hogares), meta: "Censo 2022" });
  }
  // IPC último mes
  try {
    const r = await fetch("../data/web/ipc_nacional.json");
    if (r.ok) {
      const d = await r.json();
      const nac = d.regiones?.nacional;
      if (nac) {
        cards.push({
          label: "IPC mensual", val: `${nac.ipc_var_mensual}%`,
          meta: `Acum 12m: ${nac.ipc_acum_12m}% · ${d.last_date}`,
        });
      }
    }
  } catch {}
  // Dolar live
  try {
    const r = await fetch("https://api.argentinadatos.com/v1/cotizaciones/dolares");
    const data = await r.json();
    const oficial = data.find(d => d.casa === "oficial");
    const blue = data.find(d => d.casa === "blue");
    if (oficial) cards.push({ label: "Dólar oficial (venta)", val: fmtMoney.format(oficial.venta), meta: oficial.fecha?.slice(0,10) });
    if (blue) cards.push({ label: "Dólar blue (venta)", val: fmtMoney.format(blue.venta), meta: oficial && blue ? `gap ${((blue.venta/oficial.venta - 1) * 100).toFixed(0)}%` : "" });
  } catch {}
  // Riesgo país
  try {
    const r = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais");
    const data = await r.json();
    const last = data[data.length - 1];
    cards.push({ label: "Riesgo país", val: `${fmt.format(last.valor)} pb`, meta: last.fecha });
  } catch {}
  // Pobreza nacional
  try {
    const r = await fetch("../data/web/pobreza_nacional.json");
    if (r.ok) {
      const d = await r.json();
      cards.push({ label: "Pobreza (personas)", val: `${d.pobres_personas}%`, meta: `Indigencia ${d.indigentes_poblacion}% · ${d.last_date}` });
    }
  } catch {}
  // Inflación interanual del último IPC
  try {
    const r = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/inflacionInteranual");
    const data = await r.json();
    const last = data[data.length - 1];
    cards.push({ label: "Inflación interanual", val: `${last.valor}%`, meta: last.fecha });
  } catch {}

  grid.innerHTML = cards.map(c => `
    <div class="dash-card">
      <div class="dash-label">${c.label}</div>
      <div class="dash-val">${c.val}</div>
      <div class="dash-meta">${c.meta || ""}</div>
    </div>`).join("");
}

async function renderDashRank() {
  const v = $("#dash-var").value;
  $("#dash-rank-out").innerHTML = "<div style='color:var(--muted);font-size:11px'>Calculando…</div>";
  // Buscar el dataset que tenga esta var
  const targets = [
    ["censo", v], ["2023_generales", v], ["empleo", v], ["pobreza", v],
    ["socio", v], ["economia", v],
  ];
  let ind = null, ds = null;
  for (const [d, k] of targets) {
    const data = await loadIndicadores("provincias", d);
    if (data && Object.values(data).some(rec => rec?.[k] != null)) {
      ind = data; ds = d; break;
    }
  }
  if (!ind) { $("#dash-rank-out").innerHTML = "Variable no disponible"; return; }
  const layer = layerCache.provincias;
  const nameOf = code => {
    let nm = code;
    if (layer) layer.eachLayer(l => { if (l.feature?.properties.codigo_indec === code) nm = l.feature.properties.nombre; });
    return nm;
  };
  const entries = Object.entries(ind).map(([c, d]) => [c, d?.[v]]).filter(([, x]) => x != null && isFinite(x));
  entries.sort((a, b) => b[1] - a[1]);
  $("#dash-rank-out").innerHTML = entries.slice(0, 10).map(([c, val], i) => `
    <div class="rk-row" data-code="${c}">
      <span class="pos">${i + 1}</span>
      <span class="nom">${nameOf(c).replace(/^Provincia (de|del) /, "")}</span>
      <span class="val">${fmtVal(val, v)}</span>
    </div>`).join("");
  $$("#dash-rank-out .rk-row").forEach(r => r.addEventListener("click", () => {
    setLevel("provincias", { fit: false }).then(() => zoomToCode(r.dataset.code));
  }));
}
$("#dash-rank").addEventListener("click", renderDashRank);

// -- Migración de clusters 2019 → 2023 --
function clusterFor(preset, k) {
  // Build X + codes para un preset dado
  const getVal = (ds, key, code) => indicadores[ds]?.departamentos?.[code]?.[key];
  const layer = layerCache.departamentos;
  const allCodes = new Set();
  if (layer) layer.eachLayer(l => { const p = l.feature?.properties; if (p?.codigo_indec) allCodes.add(p.codigo_indec); });
  const codes = []; const X = [];
  for (const code of allCodes) {
    const row = preset.map(([ds, key]) => {
      const v = getVal(ds, key, code);
      return v == null || !isFinite(v) ? null : +v;
    });
    if (row.every(v => v != null)) { codes.push(code); X.push(row); }
  }
  if (X.length < 20) return null;
  // Standardize
  const dim = X[0].length;
  for (let j = 0; j < dim; j++) {
    const col = X.map(r => r[j]);
    const m = col.reduce((a, b) => a + b, 0) / col.length;
    const sd = Math.sqrt(col.reduce((a, b) => a + (b - m) ** 2, 0) / col.length) || 1;
    for (let i = 0; i < X.length; i++) X[i][j] = (X[i][j] - m) / sd;
  }
  const res = kmeans(X, k);
  if (!res) return null;
  return { codes, assign: res.assign, centroids: res.centroids, X };
}

function alignClusters(prev, curr) {
  // Hungarian-lite: greedy match cada centroide curr al más cercano de prev
  const k = prev.centroids.length;
  const used = new Set();
  const mapping = {};
  for (let c = 0; c < k; c++) {
    let best = -1, bestD = Infinity;
    for (let p = 0; p < k; p++) {
      if (used.has(p)) continue;
      let d = 0;
      for (let j = 0; j < curr.centroids[c].length; j++) {
        d += (curr.centroids[c][j] - prev.centroids[p][j]) ** 2;
      }
      if (d < bestD) { bestD = d; best = p; }
    }
    if (best >= 0) { mapping[c] = best; used.add(best); }
  }
  // Re-numerar curr.assign para que use IDs de prev
  return curr.assign.map(c => mapping[c] ?? c);
}

async function runTemporalClusters() {
  $("#cl-tempor-title").textContent = "Calculando migración 2019→2023…";
  const k = +$("#cl-k").value;
  // Preset electoral fijo: misma estructura para ambos años
  const preset2019 = [
    ["2019_generales", "pj_pct", "% PJ"],
    ["2019_generales", "jxc_pct", "% JxC"],
    ["2019_generales", "izq_pct", "% FIT"],
    ["2019_generales", "participacion", "Particip."],
  ];
  const preset2023 = [
    ["2023_generales", "pj_pct", "% PJ"],
    ["2023_generales", "jxc_pct", "% JxC"],
    ["2023_generales", "izq_pct", "% FIT"],
    ["2023_generales", "participacion", "Particip."],
  ];
  await Promise.all([loadIndicadores("departamentos", "2019_generales"),
                     loadIndicadores("departamentos", "2023_generales")]);
  const c2019 = clusterFor(preset2019, k);
  const c2023 = clusterFor(preset2023, k);
  if (!c2019 || !c2023) { $("#cl-tempor-title").textContent = "Sin datos suficientes"; return; }

  // Alinear IDs 2023 a 2019 vía centroides cercanos
  const assign2023Aligned = alignClusters(c2019, c2023);

  // Construir mapa code → (cluster_2019, cluster_2023)
  const codes2019 = new Map(c2019.codes.map((c, i) => [c, c2019.assign[i]]));
  const codes2023 = new Map(c2023.codes.map((c, i) => [c, assign2023Aligned[i]]));

  // Matriz transición k×k
  const mat = Array.from({ length: k }, () => new Array(k).fill(0));
  const moved = []; // deptos que cambiaron
  const stayed = [];
  for (const [code, c19] of codes2019) {
    const c23 = codes2023.get(code);
    if (c23 == null) continue;
    mat[c19][c23]++;
    if (c19 !== c23) moved.push({ code, from: c19, to: c23 });
    else stayed.push(code);
  }

  // Render matriz
  $("#cl-tempor-title").textContent = `Migración 2019→2023 (${stayed.length} se quedaron · ${moved.length} migraron)`;
  const ramp = VAR_SCALES.cluster;
  const rows = [];
  // Header
  rows.push(`<div class="hdr">2019 ↓ / 2023 →</div>`);
  for (let c = 0; c < k; c++) rows.push(`<div class="hdr" style="color:${ramp[c % ramp.length]}">C${c+1}</div>`);
  for (let r = 0; r < k; r++) {
    rows.push(`<div class="hdr" style="color:${ramp[r % ramp.length]}">C${r+1}</div>`);
    for (let c = 0; c < k; c++) {
      const cls = r === c ? "diag" : "off";
      rows.push(`<div class="${cls}">${mat[r][c] || ""}</div>`);
    }
  }
  // Sankey SVG
  const W = 340, H = Math.max(180, k * 36), m = { l: 6, r: 6, t: 10, b: 10 };
  const colCount = mat.map(row => row.reduce((a, b) => a + b, 0));
  const rowCount = colCount; // sym since each depto cuenta una vez
  const total2023 = new Array(k).fill(0);
  for (let r = 0; r < k; r++) for (let c = 0; c < k; c++) total2023[c] += mat[r][c];
  const totalAll = colCount.reduce((a, b) => a + b, 0) || 1;
  const ramp = VAR_SCALES.cluster;
  // Posiciones Y de los nodos (left=2019, right=2023)
  const gap = 4;
  const innerH = H - m.t - m.b - gap * (k - 1);
  let yL = m.t, yR = m.t;
  const lefts = [], rights = [];
  for (let c = 0; c < k; c++) {
    const hL = (colCount[c] / totalAll) * innerH;
    lefts.push({ y0: yL, y1: yL + hL, h: hL });
    yL += hL + gap;
    const hR = (total2023[c] / totalAll) * innerH;
    rights.push({ y0: yR, y1: yR + hR, h: hR });
    yR += hR + gap;
  }
  const xL = m.l + 30, xR = W - m.r - 30;
  // Tracking de offsets dentro de cada nodo izquierdo y derecho
  const offL = lefts.map(l => l.y0);
  const offR = rights.map(r => r.y0);
  const flows = [];
  for (let r = 0; r < k; r++) {
    for (let c = 0; c < k; c++) {
      const cnt = mat[r][c];
      if (!cnt) continue;
      const h = (cnt / totalAll) * innerH;
      const y0a = offL[r], y0b = offL[r] + h;
      const y1a = offR[c], y1b = offR[c] + h;
      offL[r] += h; offR[c] += h;
      const cx1 = xL + 20, cx2 = xR - 20;
      flows.push(`<path d="M${xL.toFixed(1)},${y0a.toFixed(1)}
        C${cx1.toFixed(1)},${y0a.toFixed(1)} ${cx2.toFixed(1)},${y1a.toFixed(1)} ${xR.toFixed(1)},${y1a.toFixed(1)}
        L${xR.toFixed(1)},${y1b.toFixed(1)}
        C${cx2.toFixed(1)},${y1b.toFixed(1)} ${cx1.toFixed(1)},${y0b.toFixed(1)} ${xL.toFixed(1)},${y0b.toFixed(1)} Z"
        fill="${ramp[r % ramp.length]}" fill-opacity="${r === c ? 0.45 : 0.25}"
        stroke="none"><title>C${r+1} → C${c+1}: ${cnt}</title></path>`);
    }
  }
  const nodes = lefts.map((l, i) => `<rect x="${(xL-10).toFixed(1)}" y="${l.y0.toFixed(1)}"
    width="10" height="${l.h.toFixed(1)}" fill="${ramp[i % ramp.length]}"/>
    <text x="${(xL-14).toFixed(1)}" y="${(l.y0+l.h/2+3).toFixed(1)}" text-anchor="end" fill="${ramp[i % ramp.length]}" font-size="10" font-weight="600">C${i+1}</text>`).join("")
    + rights.map((r, i) => `<rect x="${xR.toFixed(1)}" y="${r.y0.toFixed(1)}"
    width="10" height="${r.h.toFixed(1)}" fill="${ramp[i % ramp.length]}"/>
    <text x="${(xR+14).toFixed(1)}" y="${(r.y0+r.h/2+3).toFixed(1)}" fill="${ramp[i % ramp.length]}" font-size="10" font-weight="600">C${i+1}</text>`).join("");

  const sankeySVG = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"
    style="width:100%;height:auto;background:var(--bg-2);border:1px solid var(--line);border-radius:6px;margin-top:8px">
    <text x="${xL-10}" y="6" fill="#8893ad" font-size="9">2019</text>
    <text x="${xR+10}" y="6" fill="#8893ad" font-size="9">2023</text>
    ${flows.join("")}
    ${nodes}
  </svg>`;

  $("#cl-temporal-out").innerHTML = `
    <div class="tt-mat" style="grid-template-columns:repeat(${k+1},1fr)">${rows.join("")}</div>
    ${sankeySVG}
    <div style="color:var(--muted);font-size:10px">Sankey: flujo proporcional de deptos entre clusters 2019 → 2023.</div>
    <button id="cl-mark-moved" class="mini">Pintar mapa: deptos que migraron</button>`;

  $("#cl-mark-moved").addEventListener("click", () => {
    const obj = {};
    for (const m of moved) obj[m.code] = { cluster: m.to };
    for (const code of stayed) obj[code] = { cluster: codes2019.get(code) };
    indicadores._cluster.departamentos = obj;
    activeDataset = "_cluster";
    populateVarSelect();
    activeVar = "cluster";
    restyleActive();
  });
}

$("#cl-temporal").addEventListener("click", runTemporalClusters);
$("#cl-csv").addEventListener("click", exportClusterCSV);
$("#lisa-csv").addEventListener("click", exportLISACSV);

// -- LISA · Local Indicators of Spatial Association --
function knnByCentroid(layer, k = 8) {
  // Devuelve { code → [code de vecino...] } usando los k centroides más cercanos
  const features = [];
  layer.eachLayer(l => {
    const p = l.feature?.properties;
    if (!p?.codigo_indec) return;
    try {
      const c = l.getBounds().getCenter();
      features.push({ code: p.codigo_indec, lat: c.lat, lng: c.lng });
    } catch {}
  });
  const out = {};
  for (const a of features) {
    const dists = features
      .filter(b => b.code !== a.code)
      .map(b => ({ code: b.code,
        d: (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2 }))
      .sort((x, y) => x.d - y.d).slice(0, k);
    out[a.code] = dists.map(d => d.code);
  }
  return out;
}

async function runLISA() {
  if (!activeVar || activeDataset.startsWith("_")) {
    $("#lisa-stats").innerHTML = "Elegí un dataset real + variable activa";
    return;
  }
  $("#lisa-stats").innerHTML = "Calculando…";
  const indLvl = "departamentos";
  await loadIndicadores(indLvl, activeDataset);
  const ind = indicadores[activeDataset]?.[indLvl];
  if (!ind) { $("#lisa-stats").innerHTML = "Sin datos"; return; }

  // Build values con códigos que tienen valor
  const entries = Object.entries(ind)
    .map(([c, d]) => [c, d?.[activeVar]])
    .filter(([, v]) => v != null && isFinite(v));
  if (entries.length < 30) { $("#lisa-stats").innerHTML = "Pocas observaciones"; return; }

  const codes = entries.map(e => e[0]);
  const vals = entries.map(e => +e[1]);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  const z = vals.map(v => (v - mean) / sd);
  const zByCode = Object.fromEntries(codes.map((c, i) => [c, z[i]]));

  // Vecinos
  const knn = knnByCentroid(layerCache.departamentos, 8);

  // Moran I local + I global
  let Iglobal = 0; let n = 0;
  const lisa = {};
  const categorias = { 1: 0, 2: 0, 3: 0, 4: 0, 0: 0 };  // HH, LL, HL, LH, ns
  for (const c of codes) {
    const zi = zByCode[c];
    const vecinos = (knn[c] || []).filter(nc => zByCode[nc] != null);
    if (!vecinos.length) { lisa[c] = { lisa_cat: 0 }; categorias[0]++; continue; }
    const zMean = vecinos.reduce((s, nc) => s + zByCode[nc], 0) / vecinos.length;
    const Ii = zi * zMean;
    Iglobal += Ii; n++;
    // Categoría LISA
    let cat = 0;
    if (Math.abs(Ii) > 0.5) { // umbral simple, sin permutation test
      if (zi > 0 && zMean > 0) cat = 1;       // HH
      else if (zi < 0 && zMean < 0) cat = 2;  // LL
      else if (zi > 0 && zMean < 0) cat = 3;  // HL outlier
      else cat = 4;                            // LH outlier
    }
    lisa[c] = { lisa_cat: cat, lisa_zi: +zi.toFixed(2), lisa_zlag: +zMean.toFixed(2), lisa_Ii: +Ii.toFixed(2) };
    categorias[cat]++;
  }
  Iglobal /= n;

  indicadores._lisa.departamentos = lisa;
  activeDataset = "_lisa";
  populateVarSelect();
  activeVar = "lisa_cat";
  await setLevel("departamentos", { fit: false });
  restyleActive();
  computeStats("departamentos");  // re-trigger legend rendering with cat palette

  $("#lisa-stats").innerHTML = `
    <span>n=${n} deptos</span>
    <span>Moran I global ≈ <span class="r">${Iglobal.toFixed(3)}</span></span>`;
  const labels = { 1: "HH (rojo)", 2: "LL (azul)", 3: "HL outlier alto", 4: "LH outlier bajo", 0: "no significativo" };
  $("#lisa-summary").innerHTML = Object.entries(categorias).map(([k, v]) =>
    `<div class="rate"><span class="n">${labels[k]}</span><span class="b">${v}</span></div>`
  ).join("");
}

$("#lisa-run").addEventListener("click", runLISA);

// -- Comparativa macro CABA / PBA / Interior --
async function runMacro() {
  if (!activeVar || activeDataset.startsWith("_")) {
    $("#macro-stats").innerHTML = "Elegí un dataset real + variable activa"; return;
  }
  $("#macro-stats").innerHTML = "Calculando…";
  const lvl = "departamentos";
  await loadIndicadores(lvl, activeDataset);
  await loadIndicadores(lvl, "censo");
  const ind = indicadores[activeDataset]?.[lvl] || {};
  const censo = indicadores.censo?.[lvl] || {};

  const buckets = {
    caba: { label: "CABA", codes: [], values: [], pop: 0, sum: 0, n: 0 },
    pba: { label: "PBA", codes: [], values: [], pop: 0, sum: 0, n: 0 },
    interior: { label: "Interior", codes: [], values: [], pop: 0, sum: 0, n: 0 },
  };
  for (const [code, rec] of Object.entries(ind)) {
    const v = rec?.[activeVar];
    if (v == null || !isFinite(v)) continue;
    const provCode = code.substring(0, 2);
    let bucket = "interior";
    if (provCode === "02") bucket = "caba";
    else if (provCode === "06") bucket = "pba";
    const b = buckets[bucket];
    b.codes.push(code);
    b.values.push(+v);
    const pop = censo[code]?.personas || 0;
    b.pop += pop;
    b.sum += +v * pop; // ponderación poblacional
    b.n++;
  }

  // Promedios
  for (const b of Object.values(buckets)) {
    b.weighted = b.pop ? b.sum / b.pop : null;
    b.unweighted = b.values.length ? b.values.reduce((a, b) => a + b, 0) / b.values.length : null;
    b.min = b.values.length ? Math.min(...b.values) : null;
    b.max = b.values.length ? Math.max(...b.values) : null;
  }

  const all = [...buckets.caba.values, ...buckets.pba.values, ...buckets.interior.values];
  const globalMax = Math.max(...all, 1);

  $("#macro-stats").innerHTML = `
    <span>${labelFor(activeVar)}</span>
    <span>n=${buckets.caba.n + buckets.pba.n + buckets.interior.n} deptos</span>`;
  $("#macro-bars").innerHTML = ["caba", "pba", "interior"].map(key => {
    const b = buckets[key];
    const w = b.weighted ?? b.unweighted;
    return `<div class="macro-row ${key}">
      <div><div class="nm">${b.label}</div><div class="ctx">${b.n} deptos · pop ${fmt.format(Math.round(b.pop/1000))}k</div></div>
      <div class="bar"><span style="width:${Math.min(100, (w / globalMax) * 100)}%"></span></div>
      <div>
        <div class="v">${fmtVal(w, activeVar)}</div>
        <div class="ctx">simple: ${fmtVal(b.unweighted, activeVar)}</div>
      </div>
    </div>`;
  }).join("");
}
$("#macro-run").addEventListener("click", runMacro);

// Botones de exportación PNG (delegación)
document.addEventListener("click", e => {
  const btn = e.target.closest("[data-export]");
  if (!btn) return;
  const svg = $("#" + btn.dataset.export);
  if (svg) svgToPng(svg, btn.dataset.name || "atlas.png");
});

// -- Heatmap de correlaciones --
async function computeHeatmap() {
  const level = $("#hm-level").value;
  const scope = $("#hm-scope").value;

  // Definir qué datasets+vars usar
  const CENSO_VARS = ["personas", "hogares", "viv_part_h", "densidad_km2",
    "idx_masculinidad", "personas_por_hogar", "personas_por_vivienda"];
  const ELECTORAL_DS = ["2015_generales","2015_balotaje","2017_diputados",
    "2019_paso","2019_generales","2021_diputados",
    "2023_generales","2023_balotaje","2023_diputados"];
  const ELECTORAL_KEYS = ["pj_pct","jxc_pct","lla_pct","izq_pct","participacion"];
  const ECON_PAIRS = [
    ["economia", ["exportaciones_per_capita_usd", "exportaciones_pp_share", "exportaciones_moa_share"]],
    ["ipc", ["ipc_var_interanual"]],
    ["empleo", ["desempleo"]],
    ["pobreza", ["pobreza_pct"]],
    ["agro", ["agro_produccion_total_tm"]],
    ["socio", ["mortalidad_infantil"]],
    ["salud", ["establecimientos_por_10k_hab"]],
    ["educacion", ["escuelas_por_10k_hab", "pct_estatal"]],
    ["energia", ["energia_potencia_per_capita_w"]],
  ];

  // Construir lista de (label, var, getValue) por columna y fila
  $("#hm-stats").innerHTML = "Cargando datasets…";
  await loadIndicadores(level, "censo");

  let rowDefs = [], colDefs = [];
  if (scope === "electoral_censo") {
    // Rows: vars electorales · Cols: vars censales
    for (const ds of ELECTORAL_DS) {
      await loadIndicadores(level, ds);
      for (const k of ELECTORAL_KEYS) {
        const lbl = `${ds.substring(0,4)}_${ds.substring(5)} ${k.replace('_pct','%')}`;
        rowDefs.push({ label: lbl, ds, key: k });
      }
    }
    for (const k of CENSO_VARS) colDefs.push({ label: labelFor(k), ds: "censo", key: k });
  } else if (scope === "economia_censo") {
    for (const [ds, keys] of ECON_PAIRS) {
      await loadIndicadores(level, ds);
      for (const k of keys) rowDefs.push({ label: `${ds}:${k}`, ds, key: k });
    }
    for (const k of CENSO_VARS) colDefs.push({ label: labelFor(k), ds: "censo", key: k });
  } else if (scope === "delta_2019_2023") {
    // Calculo doble: R 2019 vs Censo y R 2023 vs Censo. Matriz = R23 - R19.
    await loadIndicadores(level, "2019_generales");
    await loadIndicadores(level, "2023_generales");
    const coals = ["pj_pct", "jxc_pct", "lla_pct", "izq_pct", "participacion"];
    for (const c of coals) rowDefs.push({ label: c.replace('_pct',''), key: c, ds: "delta_marker" });
    for (const k of CENSO_VARS) colDefs.push({ label: labelFor(k), ds: "censo", key: k });
    // Marcador: compute differently below
    var DELTA_MODE = true;
  } else {
    // "Todo ↔ % LLA / PJ 2023"
    const target = scope === "todo_vs_lla" ? "lla_pct" : "pj_pct";
    await loadIndicadores(level, "2023_generales");
    colDefs.push({ label: `2023 ${target}`, ds: "2023_generales", key: target });
    for (const k of CENSO_VARS) rowDefs.push({ label: labelFor(k), ds: "censo", key: k });
    for (const [ds, keys] of ECON_PAIRS) {
      await loadIndicadores(level, ds);
      for (const k of keys) rowDefs.push({ label: `${ds}:${k}`, ds, key: k });
    }
  }

  // Computar matriz de correlaciones
  const getVal = (def, code) => indicadores[def.ds]?.[level]?.[code]?.[def.key];
  const allCodes = new Set();
  rowDefs.concat(colDefs).forEach(def => {
    const ind = indicadores[def.ds]?.[level];
    if (ind) Object.keys(ind).forEach(c => allCodes.add(c));
  });
  const codes = [...allCodes];

  const matrix = rowDefs.map(rd => colDefs.map(cd => {
    if (rd.ds === "delta_marker") {
      // ΔR = R(2023) - R(2019)
      const get19 = (code) => indicadores["2019_generales"]?.[level]?.[code]?.[rd.key];
      const get23 = (code) => indicadores["2023_generales"]?.[level]?.[code]?.[rd.key];
      const pair19 = [], pair23 = [];
      for (const code of codes) {
        const y = getVal(cd, code);
        const x19 = get19(code), x23 = get23(code);
        if (y == null) continue;
        if (x19 != null && isFinite(x19)) pair19.push([x19, y]);
        if (x23 != null && isFinite(x23)) pair23.push([x23, y]);
      }
      const r19 = pair19.length >= 5 ? pearsonR(pair19) : null;
      const r23 = pair23.length >= 5 ? pearsonR(pair23) : null;
      if (r19 == null || r23 == null) return null;
      return r23 - r19;
    }
    const pairs = [];
    for (const code of codes) {
      const x = getVal(rd, code), y = getVal(cd, code);
      if (x != null && y != null && isFinite(x) && isFinite(y)) pairs.push([x, y]);
    }
    return pairs.length >= 5 ? pearsonR(pairs) : null;
  }));

  // Render SVG
  const W = 360, H = 360;
  const padL = 110, padT = 100;
  const cellW = (W - padL - 6) / colDefs.length;
  const cellH = (H - padT - 6) / rowDefs.length;
  const colorFor = (r) => {
    if (r == null) return "#222b41";
    const t = Math.abs(r);
    if (r > 0) return `rgba(125,242,198,${Math.min(1, t).toFixed(2)})`;
    return `rgba(255,107,107,${Math.min(1, t).toFixed(2)})`;
  };
  const cells = matrix.map((row, i) => row.map((v, j) => `
    <rect x="${padL + j*cellW}" y="${padT + i*cellH}" width="${cellW-1}" height="${cellH-1}"
      fill="${colorFor(v)}"
      data-row="${i}" data-col="${j}" data-r="${v == null ? '' : v.toFixed(3)}"
      class="hm-cell"/>
  `).join("")).join("");
  const rowLabels = rowDefs.map((d, i) => `
    <text x="${padL - 4}" y="${padT + i*cellH + cellH/2 + 3}" text-anchor="end"
      fill="#8893ad" font-size="8">${d.label.substring(0, 22)}</text>
  `).join("");
  const colLabels = colDefs.map((d, j) => `
    <text x="${padL + j*cellW + cellW/2}" y="${padT - 4}" text-anchor="start" fill="#8893ad" font-size="8"
      transform="rotate(-45 ${padL + j*cellW + cellW/2} ${padT - 4})">${d.label.substring(0, 20)}</text>
  `).join("");
  $("#hm-svg").innerHTML = cells + rowLabels + colLabels;
  $("#hm-stats").innerHTML = `<span>${rowDefs.length}×${colDefs.length} celdas</span>
    <span>verde=correlación positiva, rojo=negativa, intensidad=|R|</span>`;

  $$(".hm-cell").forEach(c => {
    c.addEventListener("mouseenter", e => {
      const i = +e.target.dataset.row, j = +e.target.dataset.col;
      const r = e.target.dataset.r || "—";
      $("#hm-hover").textContent = `${rowDefs[i].label} ↔ ${colDefs[j].label} = R ${r}`;
    });
    c.addEventListener("mouseleave", () => $("#hm-hover").textContent = "—");
  });
}

$("#hm-compute").addEventListener("click", computeHeatmap);

// -- Series de Tiempo API (datos.gob.ar) --
const SERIES_API = "https://apis.datos.gob.ar/series/api";
let serDebounce;
async function searchSeries(q) {
  if (!q || q.length < 3) { $("#ser-results").innerHTML = ""; return; }
  try {
    const r = await fetch(`${SERIES_API}/search/?q=${encodeURIComponent(q)}&limit=12`);
    const d = await r.json();
    const html = (d.data || []).map(it => {
      const f = it.field || {}; const ds = it.dataset || {};
      return `<div class="rk-row ser-pick" data-id="${f.id}" title="${f.id}">
        <span class="nom">${(f.description || f.title || f.id).slice(0, 60)}
          <span class="ctx">${(ds.source || ds.title || "").slice(0, 40)} · ${f.frequency || ""}</span></span>
      </div>`;
    }).join("");
    $("#ser-results").innerHTML = html || "<div style='color:var(--muted)'>Sin resultados</div>";
    $$(".ser-pick", $("#ser-results")).forEach(el => {
      el.addEventListener("click", () => loadSerie(el.dataset.id));
    });
  } catch (e) { $("#ser-results").innerHTML = `<div style='color:var(--danger)'>Error API</div>`; }
}
async function loadSerie(id) {
  $("#ser-meta").innerHTML = `Cargando ${id}…`;
  try {
    const r = await fetch(`${SERIES_API}/series/?ids=${id}&limit=240&format=json`);
    const d = await r.json();
    const data = d.data || [];
    const meta = d.meta?.[1] || {};
    const fld = meta.field || {};
    const ds = meta.dataset || {};
    if (!data.length) throw new Error("vacía");
    // Render meta
    $("#ser-meta").innerHTML = `
      <span style="flex:1">${fld.description || id}</span>
      <span class="r">${data.length} pts</span>`;
    // SVG
    const W = 340, H = 180, m = { l: 40, r: 10, t: 8, b: 22 };
    const innerW = W - m.l - m.r, innerH = H - m.t - m.b;
    const vs = data.map(p => +p[1]).filter(v => isFinite(v));
    const mn = Math.min(...vs), mx = Math.max(...vs);
    const range = mx - mn || 1;
    const sx = i => m.l + (i / (data.length - 1)) * innerW;
    const sy = v => m.t + innerH - ((v - mn) / range) * innerH;
    const path = data.map((p, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(+p[1]).toFixed(1)}`).join(" ");
    const fmtTick = v => Math.abs(v) >= 1000 ? fmt.format(Math.round(v)) : v.toFixed(2);
    $("#ser-svg").innerHTML = `
      <line stroke="${'#222b41'}" x1="${m.l}" y1="${m.t+innerH}" x2="${m.l+innerW}" y2="${m.t+innerH}"/>
      <line stroke="${'#222b41'}" x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${m.t+innerH}"/>
      <text fill="#8893ad" font-size="9" x="${m.l-4}" y="${m.t+8}" text-anchor="end">${fmtTick(mx)}</text>
      <text fill="#8893ad" font-size="9" x="${m.l-4}" y="${m.t+innerH+4}" text-anchor="end">${fmtTick(mn)}</text>
      <text fill="#8893ad" font-size="9" x="${m.l}" y="${H-4}">${data[0][0]}</text>
      <text fill="#8893ad" font-size="9" x="${m.l+innerW}" y="${H-4}" text-anchor="end">${data[data.length-1][0]}</text>
      <path d="${path}" fill="none" stroke="#5aa3ff" stroke-width="1.5"/>
    `;
    const last = data[data.length - 1];
    $("#ser-hover").textContent = `Último: ${last[0]} → ${fmtTick(+last[1])} ${fld.units || ""} · ${ds.source || ""}`;
  } catch (e) {
    $("#ser-meta").innerHTML = `<span style='color:var(--danger)'>Error: ${e.message}</span>`;
  }
}

$("#ser-q").addEventListener("input", () => {
  clearTimeout(serDebounce);
  serDebounce = setTimeout(() => searchSeries($("#ser-q").value), 280);
});
$$(".ser-q").forEach(b => b.addEventListener("click", () => loadSerie(b.dataset.id)));

// Estado de la última serie cargada
let lastSerie = null;

const _origLoadSerie = loadSerie;
loadSerie = async function(id) {
  await _origLoadSerie(id);
  // Capturar data desde el SVG re-render: hackish — usar fetch directo aquí
  try {
    const r = await fetch(`${SERIES_API}/series/?ids=${id}&limit=240&format=json`);
    const d = await r.json();
    lastSerie = { id, data: d.data || [], meta: d.meta?.[1] || {} };
  } catch { lastSerie = null; }
};

// Find the single break point minimizing within-group SSE
function findBreak(values) {
  const n = values.length;
  if (n < 10) return null;
  const total = values.reduce((a, b) => a + b, 0);
  const meanAll = total / n;
  const totalSS = values.reduce((s, v) => s + (v - meanAll) ** 2, 0);
  let best = -1, bestRed = 0;
  // Reservar márgenes (al menos 10% en cada lado)
  const minSeg = Math.max(3, Math.floor(n * 0.1));
  let sumL = 0;
  for (let i = 0; i < minSeg - 1; i++) sumL += values[i];
  for (let i = minSeg - 1; i < n - minSeg; i++) {
    sumL += values[i];
    const sumR = total - sumL;
    const meanL = sumL / (i + 1);
    const meanR = sumR / (n - i - 1);
    let ssL = 0, ssR = 0;
    for (let j = 0; j <= i; j++) ssL += (values[j] - meanL) ** 2;
    for (let j = i + 1; j < n; j++) ssR += (values[j] - meanR) ** 2;
    const reduction = totalSS - (ssL + ssR);
    if (reduction > bestRed) { bestRed = reduction; best = i; }
  }
  return best > 0 ? { idx: best, reduction: bestRed, totalSS } : null;
}

function detectBreaks() {
  if (!lastSerie?.data?.length) { $("#ser-break-out").textContent = "Cargá una serie primero"; return; }
  const data = lastSerie.data;
  const values = data.map(p => +p[1]).filter(v => isFinite(v));
  const result = findBreak(values);
  if (!result) { $("#ser-break-out").textContent = "Sin quiebre significativo detectado"; return; }
  const meanL = values.slice(0, result.idx + 1).reduce((a, b) => a + b, 0) / (result.idx + 1);
  const meanR = values.slice(result.idx + 1).reduce((a, b) => a + b, 0) / (values.length - result.idx - 1);
  const dateB = data[result.idx][0];
  const r2 = (result.reduction / result.totalSS) * 100;
  // Marcar en el SVG existente
  const svg = $("#ser-svg");
  const W = 340, m = { l: 40, r: 10 };
  const innerW = W - m.l - m.r;
  const x = m.l + (result.idx / (data.length - 1)) * innerW;
  const line = `<line x1="${x.toFixed(1)}" y1="8" x2="${x.toFixed(1)}" y2="158"
    stroke="#ffb454" stroke-width="1.2" stroke-dasharray="3,3"/>
    <text x="${(x + 3).toFixed(1)}" y="20" fill="#ffb454" font-size="8">${dateB.slice(0,7)}</text>`;
  svg.innerHTML = svg.innerHTML + line;
  $("#ser-break-out").innerHTML = `Quiebre detectado en <b>${dateB.slice(0,7)}</b><br>
    Media antes: ${meanL.toFixed(2)} · Media después: ${meanR.toFixed(2)}
    <br>Cambio: ${((meanR - meanL) / meanL * 100).toFixed(1)}% · Reducción SSE: ${r2.toFixed(1)}%`;
}

function exportSerieCSV() {
  if (!lastSerie?.data?.length) return alert("Cargá una serie primero");
  const rows = lastSerie.data.map(p => ({ fecha: p[0], valor: p[1] }));
  downloadCSV(rows, `serie_${lastSerie.id}.csv`);
}

$("#ser-breaks").addEventListener("click", detectBreaks);
$("#ser-csv").addEventListener("click", exportSerieCSV);

// -- Comparador --
const compared = []; // [{code, nombre, level, dataset, ind, ctx}]

function pinCurrent() {
  if (!selected || !selectedCode) { alert("Hacé click en una feature primero."); return; }
  const ds = activeDataset;
  const indLevel = indicLevelFor(selectedLevel);
  const ind = indLevel ? indicadores[ds]?.[indLevel]?.[selectedCode] : null;
  if (!ind) { alert("Sin indicadores cargados para esta capa/dataset."); return; }
  const p = selected.feature?.properties || {};
  if (compared.length >= 4) compared.shift();
  compared.push({
    code: selectedCode,
    nombre: p.nombre || selectedCode,
    level: selectedLevel,
    dataset: ds,
    ind: { ...ind },
    ctx: p.provincia || p.departamento || "",
  });
  renderComparar();
  switchTab("comparar");
}

function renderRadar() {
  const svg = $("#cmp-radar");
  if (!svg || !compared.length) { if (svg) svg.innerHTML = ""; return; }
  // Selección variables numéricas comunes con valor en TODAS las features
  const keys = new Set();
  compared.forEach(c => Object.keys(c.ind).forEach(k => keys.add(k)));
  const numericKeys = [...keys].filter(k =>
    !k.startsWith("_") &&
    compared.every(c => typeof c.ind[k] === "number" && isFinite(c.ind[k]))
  ).slice(0, 8); // máximo 8 ejes
  if (numericKeys.length < 3) { svg.innerHTML = `<text x="160" y="140" fill="#8893ad" font-size="11" text-anchor="middle">Necesitás ≥3 vars comunes</text>`; return; }

  const W = 320, H = 280, cx = W/2, cy = H/2, R = Math.min(W, H) * 0.36;
  const N = numericKeys.length;
  // Normalizar por max(abs) para cada eje
  const maxAbs = numericKeys.map(k => Math.max(...compared.map(c => Math.abs(c.ind[k]))) || 1);
  const angle = i => (i / N) * Math.PI * 2 - Math.PI / 2;
  const point = (i, r) => [cx + Math.cos(angle(i)) * R * r, cy + Math.sin(angle(i)) * R * r];

  // Grid concéntrico
  const grid = [0.25, 0.5, 0.75, 1.0].map(r =>
    `<polygon points="${numericKeys.map((_, i) => point(i, r).map(v => v.toFixed(1)).join(',')).join(' ')}"
      fill="none" stroke="#222b41" stroke-width="0.5"/>`).join("");
  // Ejes radiales + labels
  const axes = numericKeys.map((k, i) => {
    const [x, y] = point(i, 1);
    const [lx, ly] = point(i, 1.13);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#222b41" stroke-width="0.5"/>
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="#8893ad" font-size="8" text-anchor="middle">${labelFor(k).slice(0,14)}</text>`;
  }).join("");
  // Polígonos de features
  const palette = ["#5aa3ff", "#ff6b6b", "#7df2c6", "#ffb454"];
  const polys = compared.map((c, ci) => {
    const pts = numericKeys.map((k, i) => point(i, c.ind[k] / maxAbs[i]).map(v => v.toFixed(1)).join(",")).join(" ");
    return `<polygon points="${pts}" fill="${palette[ci % palette.length]}" fill-opacity="0.18"
      stroke="${palette[ci % palette.length]}" stroke-width="1.5"/>`;
  }).join("");
  // Legenda
  const legend = compared.map((c, ci) => `
    <g transform="translate(8, ${10 + ci*14})">
      <rect width="10" height="10" fill="${palette[ci % palette.length]}" fill-opacity="0.6"/>
      <text x="14" y="9" fill="#e8ecf6" font-size="10">${c.nombre.slice(0, 22)}</text>
    </g>`).join("");

  svg.innerHTML = grid + axes + polys + legend;
}

function renderComparar() {
  const grid = $("#cmp-grid");
  if (!compared.length) {
    grid.innerHTML = `<div style="color:var(--muted);font-size:12px">Sin features ancladas.</div>`;
    $("#cmp-radar").innerHTML = "";
    return;
  }
  // Variables a mostrar: unión de todas las claves no internas en ind
  const keys = new Set();
  compared.forEach(c => Object.keys(c.ind).forEach(k => { if (!k.startsWith("_")) keys.add(k); }));
  const keyArr = Array.from(keys);
  // Para barras: max abs por variable
  const maxByKey = {};
  keyArr.forEach(k => {
    const vs = compared.map(c => c.ind[k]).filter(v => typeof v === "number");
    maxByKey[k] = Math.max(...vs.map(Math.abs), 1);
  });
  const header = `<thead><tr><th>Variable</th>${compared.map((c, i) => `
    <th>${c.nombre.slice(0, 14)}<br><span style="color:var(--muted);font-weight:400;font-size:10px">${(c.dataset === "censo" ? "Censo" : (DATASETS[c.dataset]?.label || c.dataset)).slice(0, 18)}</span>
    <span class="cmp-rm" data-i="${i}">✕</span></th>`).join("")}</tr></thead>`;
  const body = keyArr.map(k => `<tr>
    <td>${labelFor(k)}</td>
    ${compared.map(c => {
      const v = c.ind[k];
      if (v == null) return `<td>—</td>`;
      const pct = typeof v === "number" ? Math.abs(v) / maxByKey[k] * 100 : 0;
      return `<td>
        <span class="cmp-bar"><span style="width:${pct}%"></span></span>
        ${fmtVal(v, k)}
      </td>`;
    }).join("")}
  </tr>`).join("");
  grid.innerHTML = `<table>${header}<tbody>${body}</tbody></table>`;
  $$(".cmp-rm", grid).forEach(b => b.addEventListener("click", () => {
    compared.splice(parseInt(b.dataset.i), 1);
    renderComparar();
  }));
  renderRadar();
}

$("#cmp-pin").addEventListener("click", pinCurrent);
$("#cmp-clear").addEventListener("click", () => { compared.length = 0; renderComparar(); });

// -- Modelo Censo → Voto --
const MODEL_FEATURES = ["personas_por_hogar", "personas_por_vivienda", "idx_masculinidad", "personas", "viv_part_h"];

function populateModeloSelect() {
  const opts = Object.entries(DATASETS)
    .filter(([k, ds]) => k !== "censo" && !ds._virtual)
    .map(([k, ds]) => `<option value="${k}">${ds.label}</option>`).join("");
  $("#mod-ds").innerHTML = opts;
  $("#mod-ds").value = "2023_generales";
  $("#mod-var").value = "lla_pct";
}

// OLS multiple lineal: y = b0 + b1 x1 + ... + bN xN
// Vía ecuaciones normales: β = (X' X)^-1 X' y
function olsFit(X, y) {
  // X: array of rows (incluye 1 para intercept)
  // y: array
  const n = X.length, p = X[0].length;
  // X'X
  const XtX = Array.from({length: p}, () => Array(p).fill(0));
  const Xty = Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < p; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  // Solve XtX β = Xty (Gauss-Jordan elimination)
  const M = XtX.map((row, i) => [...row, Xty[i]]);
  for (let i = 0; i < p; i++) {
    // pivot
    let mx = i;
    for (let r = i + 1; r < p; r++) if (Math.abs(M[r][i]) > Math.abs(M[mx][i])) mx = r;
    [M[i], M[mx]] = [M[mx], M[i]];
    const piv = M[i][i];
    if (Math.abs(piv) < 1e-12) return null;
    for (let j = i; j <= p; j++) M[i][j] /= piv;
    for (let r = 0; r < p; r++) if (r !== i) {
      const f = M[r][i];
      for (let j = i; j <= p; j++) M[r][j] -= f * M[i][j];
    }
  }
  return M.map(row => row[p]);
}

function standardize(values) {
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length) || 1;
  return { m, sd, std: values.map(v => (v - m) / sd) };
}

async function fitModelo() {
  const ds = $("#mod-ds").value;
  const yVar = $("#mod-var").value;
  const censo = await loadIndicadores("departamentos", "censo");
  const elec = await loadIndicadores("departamentos", ds);
  if (!censo || !elec) { $("#mod-stats").innerHTML = "Datos no disponibles"; return; }

  // Construir matriz de filas con todas las variables presentes
  const codes = Object.keys(elec).filter(c => {
    const e = elec[c], x = censo[c];
    if (!x || e[yVar] == null || !isFinite(e[yVar])) return false;
    return MODEL_FEATURES.every(f => x[f] != null && isFinite(x[f]));
  });
  if (codes.length < 30) { $("#mod-stats").innerHTML = "Pocas observaciones"; return; }

  // Estandarizar X para que los coeficientes sean comparables
  const featCols = MODEL_FEATURES.map(f => standardize(codes.map(c => censo[c][f])));
  const y = codes.map(c => elec[c][yVar]);
  const X = codes.map((_, i) => [1, ...featCols.map(s => s.std[i])]);
  const beta = olsFit(X, y);
  if (!beta) { $("#mod-stats").innerHTML = "Matriz singular"; return; }

  // Predicción y R²
  const yhat = X.map(row => row.reduce((s, v, k) => s + v * beta[k], 0));
  const ym = y.reduce((s, v) => s + v, 0) / y.length;
  const ssRes = y.reduce((s, v, i) => s + (v - yhat[i]) ** 2, 0);
  const ssTot = y.reduce((s, v) => s + (v - ym) ** 2, 0);
  const r2 = 1 - ssRes / ssTot;

  $("#mod-stats").innerHTML = `
    <span>${codes.length} deptos</span>
    <span>R²: <span class="r">${r2.toFixed(3)}</span></span>
    <span>Intercept: <span class="r">${(beta[0]*100).toFixed(1)}%</span></span>
  `;
  // Coeficientes estandarizados
  const maxC = Math.max(...beta.slice(1).map(Math.abs));
  const labelMap = {
    personas_por_hogar: "Personas/hogar",
    personas_por_vivienda: "Personas/vivienda",
    idx_masculinidad: "Índ. masculinidad",
    personas: "Población",
    viv_part_h: "Viv. habitadas",
  };
  $("#mod-coefs").innerHTML = beta.slice(1).map((b, i) => {
    const f = MODEL_FEATURES[i];
    const sign = b >= 0 ? "pos" : "neg";
    const widthPct = Math.abs(b) / maxC * 50;
    const offset = b >= 0 ? `width:${widthPct}%;background:#7df2c6` : `width:${widthPct}%;transform:translateX(-100%);background:#ff6b6b`;
    return `<div class="mod-row">
      <span class="lbl">${labelMap[f] || f}</span>
      <span class="coef ${sign}">${b >= 0 ? "+" : ""}${(b*100).toFixed(2)}pp</span>
      <span style="font-size:10px;color:var(--muted)">β std</span>
      <div class="bar"><span style="${offset}"></span></div>
    </div>`;
  }).join("");
}

$("#mod-fit").addEventListener("click", fitModelo);

// -- Swing --
function populateSwingSelects() {
  const opts = Object.entries(DATASETS)
    .filter(([k, ds]) => k !== "censo" && !ds._virtual)
    .map(([k, ds]) => `<option value="${k}">${ds.label}</option>`).join("");
  $("#swing-a").innerHTML = opts;
  $("#swing-b").innerHTML = opts;
  $("#swing-a").value = "2019_generales";
  $("#swing-b").value = "2023_generales";
  $("#swing-var").value = "pj_pct";
}

async function applySwing() {
  const dsA = $("#swing-a").value;
  const dsB = $("#swing-b").value;
  const varKey = $("#swing-var").value;
  if (!dsA || !dsB) return;
  const [a, b] = await Promise.all([
    loadIndicadores("departamentos", dsA),
    loadIndicadores("departamentos", dsB),
  ]);
  if (!a || !b) { $("#swing-stats").innerHTML = "Datos no disponibles"; return; }

  // Computar swing por código (sólo donde ambas elecciones tienen dato)
  const swing = {};
  for (const code of Object.keys(b)) {
    const va = a[code]?.[varKey];
    const vb = b[code]?.[varKey];
    if (va == null || vb == null || !isFinite(va) || !isFinite(vb)) continue;
    swing[code] = { swing: vb - va, _from: va, _to: vb };
  }
  indicadores._swing.departamentos = swing;

  // Activar dataset virtual + capa departamentos
  activeDataset = "_swing";
  $("#ds-sel").value = "_swing"; // no existe en HTML, no problema
  populateVarSelect();
  activeVar = "swing";
  await setLevel("departamentos", { fit: false });
  computeStats("departamentos");
  restyleActive();

  // Stats panel
  const entries = Object.entries(swing).map(([c, v]) => [c, v.swing]);
  const vals = entries.map(([, v]) => v).sort((a, b) => a - b);
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const min = vals[0], max = vals[vals.length - 1];
  const pos = vals.filter(v => v > 0).length;
  const neg = vals.filter(v => v < 0).length;
  const lblA = DATASETS[dsA].label, lblB = DATASETS[dsB].label;
  $("#swing-stats").innerHTML = `
    <span>${entries.length} deptos</span>
    <span>Δ media: <span class="r">${(mean*100>=0?'+':'')+(mean*100).toFixed(1)}pp</span></span>
    <span>+${pos} / -${neg}</span>
  `;

  // Top gainers/losers
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const layer = layerCache.departamentos;
  const nameOf = (code) => {
    if (!layer) return code;
    let nm = null, ctx = "";
    layer.eachLayer(l => {
      if (l.feature?.properties.codigo_indec === code) {
        nm = l.feature.properties.nombre;
        ctx = l.feature.properties.provincia || "";
      }
    });
    return [nm || code, ctx];
  };
  const renderList = (list, label) => `
    <h3 style="font-size:11px;color:var(--muted);text-transform:uppercase;margin:8px 0 4px">${label}</h3>
    ${list.map(([c, v], i) => {
      const [nm, ctx] = nameOf(c);
      return `<div class="rk-row" data-code="${c}">
        <span class="pos">${i + 1}</span>
        <span class="nom" title="${nm}">${nm} <span class="ctx">${ctx}</span></span>
        <span class="delta ${v >= 0 ? 'pos' : 'neg'}">${v >= 0 ? '+' : ''}${(v*100).toFixed(1)}pp</span>
      </div>`;
    }).join("")}`;
  $("#swing-top").innerHTML = renderList(sorted.slice(0, 8), `Top suba ${lblB} vs ${lblA}`) +
                              renderList(sorted.slice(-8).reverse(), `Top caída`);
  $$(".rk-row", $("#panel-swing")).forEach(r => {
    r.addEventListener("click", () => zoomToCode(r.dataset.code));
  });
}

$("#swing-apply").addEventListener("click", applySwing);
["change", "input"].forEach(ev => {
  ["#swing-a", "#swing-b", "#swing-var"].forEach(s => {
    $(s).addEventListener(ev, () => { /* sólo al click Apply para no recalcular en tipeo */ });
  });
});

$("#lbl-toggle").addEventListener("click", toggleLabels);

// Theme toggle (dark/light)
const themeKey = "atlas-theme";
function applyTheme(t) {
  document.body.classList.toggle("theme-light", t === "light");
  $("#theme-toggle").textContent = t === "light" ? "☀️" : "🌙";
  // Switch tile layer
  if (t === "light") {
    map.eachLayer(l => { if (l._url && l._url.includes("dark")) map.removeLayer(l); });
    if (!window._lightTiles) {
      window._lightTiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
        { maxZoom: 19, attribution: '&copy; CARTO &copy; OSM' });
    }
    window._lightTiles.addTo(map);
  } else {
    if (window._lightTiles) map.removeLayer(window._lightTiles);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
      { maxZoom: 19, attribution: '&copy; CARTO &copy; OSM' }).addTo(map);
  }
}
$("#theme-toggle").addEventListener("click", () => {
  const cur = document.body.classList.contains("theme-light") ? "light" : "dark";
  const next = cur === "light" ? "dark" : "light";
  localStorage.setItem(themeKey, next);
  applyTheme(next);
});
// Restore from localStorage
const savedTheme = localStorage.getItem(themeKey);
if (savedTheme === "light") setTimeout(() => applyTheme("light"), 200);

// Welcome / onboarding
const WELCOME_KEY = "atlas-welcome-seen";
function showWelcome() { $("#welcome").classList.remove("hidden"); }
function closeWelcome() { $("#welcome").classList.add("hidden"); }
$("#welc-close").addEventListener("click", closeWelcome);
$("#welc-never").addEventListener("click", () => {
  localStorage.setItem(WELCOME_KEY, "1");
  closeWelcome();
});
// Mostrar si nunca lo vio y no hay hash (sesión "limpia")
if (!localStorage.getItem(WELCOME_KEY) && !location.hash) {
  setTimeout(showWelcome, 1200);
}

// Modo presentación
$("#present-toggle").addEventListener("click", () => {
  document.body.classList.toggle("present");
  setTimeout(() => map.invalidateSize(), 100);
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && document.body.classList.contains("present")) {
    document.body.classList.remove("present");
    setTimeout(() => map.invalidateSize(), 100);
  }
});

// Bookmarks
const BM_KEY = "atlas-bookmarks";
function loadBookmarks() {
  try { return JSON.parse(localStorage.getItem(BM_KEY) || "[]"); }
  catch { return []; }
}
function saveBookmarks(list) { localStorage.setItem(BM_KEY, JSON.stringify(list)); }
function renderBookmarks() {
  const list = loadBookmarks();
  const el = $("#bm-list");
  if (!list.length) { el.innerHTML = `<div style="color:var(--muted)">Sin bookmarks. Configurá una vista y guardala.</div>`; return; }
  el.innerHTML = list.map((b, i) => `
    <div class="bm-item">
      <span class="bm-name" data-i="${i}">${b.name}</span>
      <span style="color:var(--muted);font-size:10px">${b.hash.length} ch</span>
      <span class="bm-rm" data-i="${i}">✕</span>
    </div>`).join("");
  $$("#bm-list .bm-name").forEach(el => el.addEventListener("click", () => {
    const b = loadBookmarks()[+el.dataset.i];
    if (b) { location.hash = b.hash; location.reload(); }
  }));
  $$("#bm-list .bm-rm").forEach(el => el.addEventListener("click", () => {
    const list = loadBookmarks();
    list.splice(+el.dataset.i, 1);
    saveBookmarks(list);
    renderBookmarks();
  }));
}
$("#bookmark-btn").addEventListener("click", () => {
  $("#bookmarks-pop").classList.toggle("hidden");
  renderBookmarks();
});
$("#bm-save").addEventListener("click", () => {
  syncHash();
  const name = prompt("Nombre del bookmark", "Vista " + (loadBookmarks().length + 1));
  if (!name) return;
  const list = loadBookmarks();
  list.push({ name, hash: location.hash.slice(1) });
  saveBookmarks(list);
  renderBookmarks();
});
document.addEventListener("click", e => {
  if (!$("#bookmarks-pop").contains(e.target) && e.target.id !== "bookmark-btn") {
    $("#bookmarks-pop").classList.add("hidden");
  }
});

// -- Init --
async function showCountryKpis() {
  const ind = await loadIndicadores("pais");
  if (!ind) return;
  $("#sel-name").textContent = "Argentina";
  $("#sel-meta").textContent = "República Argentina · Censo 2022";
  renderKpis(ind);
  renderExtras(ind);
}

(async () => {
  populateVarSelect();
  populateCruceSelects();
  populateSwingSelects();
  populateModeloSelect();
  // Mostrar anim si arranca en electoral
  if (/^(20\d\d_)/.test(activeDataset)) showAnim();
  const fromHash = await loadHash();
  if (!fromHash) await setLevel("pais", { fit: true });
  await showCountryKpis();
  setTimeout(rebuildLabels, 800);
  await Promise.all([loadGeo("provincias"), loadIndicadores("provincias")]);
  loadGeo("departamentos").then(() => loadIndicadores("departamentos").then(() => activeLevel === "departamentos" && computeStats(activeLevel)));
  loadGeo("municipios");
  loadGeo("localidades").then(() => loadIndicadores("localidades"));
  loadIndicadores("radios");
  loadEconomia();
  loadPolitica();
})();
