// ATLAS politics — frontend  (build 20260518a)
console.log("[ATLAS] build 20260518c · IPC INDEC nacional + regional + dataset por provincia");

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
  socio: {
    label: "Sociales · Mortalidad Infantil",
    year: 2024,
    levels: ["provincias"],
    fileFor: () => `../data/web/socio_provincia.json`,
    vars: [
      ["mortalidad_infantil", "Mortalidad infantil (‰)"],
      ["mortalidad_infantil_vs_pais", "Δ vs país"],
    ],
    defaultVar: "mortalidad_infantil",
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
  // Pseudo-dataset para swing — alimentado dinámicamente
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
  "economia","socio","ipc","_swing"].map(k => [k, {}]));
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
  // Virtual datasets (swing) están pre-cargados en indicadores[ds][level]
  if (dsCfg._virtual) return indicadores[ds]?.[level] || null;
  if (indicadores[ds][level]) return indicadores[ds][level];
  try {
    const r = await fetch(dsCfg.fileFor(level));
    if (r.ok) indicadores[ds][level] = await r.json();
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
    const ramp = VAR_SCALES.swing;
    breaks = [];
    for (let i = 1; i < ramp.length; i++) {
      breaks.push(-m + (i / ramp.length) * 2 * m);
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
  el.classList.remove("hidden");
  $("#legend-title").textContent = `${level} · ${labelFor(activeVar)}`;
  $("#legend-ramp").innerHTML = VAR_SCALES.default.map(c => `<span style="background:${c}"></span>`).join("");
  $("#legend-labels").innerHTML = `<span>${fmtVal(levelStats?.min)}</span><span>${fmtVal(levelStats?.max)}</span>`;
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
  renderHist(ind);
  renderExtras(ind);
  switchTab("info");
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
  const rows = Object.entries(ind).filter(([k]) => !k.startsWith("_")).map(([k, v]) =>
    `<tr><td>${labelFor(k)}</td><td>${typeof v === "number" ? fmtVal(v, k) : v}</td></tr>`
  ).join("");
  extras.innerHTML = `<table>${rows}</table>`;
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
  const renderList = (list) => list.map(([code, v], i) => `
    <div class="rk-row ${code === selectedCode ? 'sel' : ''}" data-code="${code}">
      <span class="pos">${i + 1}</span>
      <span class="nom" title="${nameOf(code)}">${nameOf(code)} <span class="ctx">${ctxOf(code)}</span></span>
      <span class="val">${fmtVal(v)}</span>
    </div>`).join("");
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
searchInput.addEventListener("input", () => {
  const q = norm(searchInput.value);
  if (!q || q.length < 2) { searchResults.classList.remove("open"); return; }
  const hits = searchIndex.filter(h => h._norm.includes(q)).slice(0, 12);
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
  await setLevel(hit.level, { fit: false });
  zoomToCode(hit.codigo);
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
  } finally { suppressHashUpdate = false; }
  return true;
}
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

function renderComparar() {
  const grid = $("#cmp-grid");
  if (!compared.length) {
    grid.innerHTML = `<div style="color:var(--muted);font-size:12px">Sin features ancladas.</div>`;
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
