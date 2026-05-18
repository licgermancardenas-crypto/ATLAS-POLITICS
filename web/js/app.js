// ATLAS politics — frontend
// Capas: pais, provincias, departamentos, municipios, localidades, radios.
// Choropleth dinámico, búsqueda, panel info + ranking + comparativa + histograma,
// permalink y export CSV. APIs economía/política en vivo.

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
};

// Catálogo de datasets/variables
const DATASETS = {
  censo: {
    label: "Censo 2022",
    levels: ["pais", "provincias", "departamentos", "localidades", "radios"],
    fileFor: (level) => `../data/web/indicadores_${level === "pais" ? "provincias" : level}.json`,
    vars: [
      ["personas", "Población"],
      ["hogares", "Hogares"],
      ["viv_part_h", "Viv. habitadas"],
      ["idx_masculinidad", "Índ. masculinidad"],
      ["personas_por_hogar", "Personas por hogar"],
      ["personas_por_vivienda", "Personas por vivienda"],
    ],
    defaultVar: "personas",
  },
  "2023_generales": {
    label: "Generales 2023 · Presidente",
    levels: ["provincias", "departamentos"],
    fileFor: (level) => `../data/web/elecciones_2023_generales_${level === "provincias" ? "provincia" : "departamento"}.json`,
    vars: [
      ["lla_pct", "% LLA"],
      ["pj_pct", "% UP (PJ)"],
      ["jxc_pct", "% JxC"],
      ["hacemos_pct", "% Hacemos x Nuestro País"],
      ["izq_pct", "% FIT"],
      ["participacion", "Participación"],
      ["blanco_pct", "% Blanco"],
      ["nulo_pct", "% Nulo+Recurrido"],
    ],
    defaultVar: "lla_pct",
    paletteFor: (v) => v === "lla_pct" ? "lla" : v === "pj_pct" ? "pj" : v === "jxc_pct" ? "jxc" : "default",
  },
  "2023_balotaje": {
    label: "Balotaje 2023",
    levels: ["provincias", "departamentos"],
    fileFor: (level) => `../data/web/elecciones_2023_balotaje_${level === "provincias" ? "provincia" : "departamento"}.json`,
    vars: [
      ["lla_pct", "% LLA"],
      ["pj_pct", "% UP (PJ)"],
      ["participacion", "Participación"],
      ["blanco_pct", "% Blanco"],
      ["nulo_pct", "% Nulo+Recurrido"],
    ],
    defaultVar: "lla_pct",
    paletteFor: (v) => v === "lla_pct" ? "lla" : v === "pj_pct" ? "pj" : "default",
  },
  "2023_diputados": {
    label: "Diputados Nac. 2023",
    levels: ["provincias", "departamentos"],
    fileFor: (level) => `../data/web/elecciones_2023_diputados_${level === "provincias" ? "provincia" : "departamento"}.json`,
    vars: [
      ["lla_pct", "% LLA"],
      ["pj_pct", "% UP (PJ)"],
      ["jxc_pct", "% JxC + aliados"],
      ["hacemos_pct", "% Hacemos + aliados"],
      ["izq_pct", "% FIT"],
      ["participacion", "Participación"],
    ],
    defaultVar: "lla_pct",
    paletteFor: (v) => v === "lla_pct" ? "lla" : v === "pj_pct" ? "pj" : v === "jxc_pct" ? "jxc" : "default",
  },
  "2023_senadores": {
    label: "Senadores Nac. 2023 (8 prov.)",
    levels: ["provincias", "departamentos"],
    fileFor: (level) => `../data/web/elecciones_2023_senadores_${level === "provincias" ? "provincia" : "departamento"}.json`,
    vars: [
      ["lla_pct", "% LLA"],
      ["pj_pct", "% UP (PJ)"],
      ["jxc_pct", "% JxC + aliados"],
      ["participacion", "Participación"],
    ],
    defaultVar: "lla_pct",
    paletteFor: (v) => v === "lla_pct" ? "lla" : v === "pj_pct" ? "pj" : v === "jxc_pct" ? "jxc" : "default",
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
const indicadores = { censo: {}, "2023_generales": {}, "2023_balotaje": {}, "2023_diputados": {}, "2023_senadores": {} };
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
function fmtVal(v, varKey = activeVar) {
  if (v == null) return "—";
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
function tooltipText(name, p) {
  const nm = p.nombre || (name === "radios" ? `Radio ${p.codigo_indec}` : "—");
  const ind = getIndic(name, p.codigo_indec);
  const v = ind?.[activeVar];
  if (activeVar && v != null) return `${nm} · ${labelFor(activeVar)}: ${fmtVal(v)}`;
  return nm;
}
function bindFeature(name, feat, lyr, parent) {
  const p = feat.properties || {};
  lyr.bindTooltip(() => tooltipText(name, p), { sticky: true });
  lyr.on("mouseover", e => {
    $("#hover-name").textContent = tooltipText(name, p);
    try { e.target.setStyle({ weight: (LEVELS[name].weight || 0.5) + 1.5, fillOpacity: Math.min(0.6, LEVELS[name].fill + 0.18) }); } catch {}
  });
  lyr.on("mouseout", e => {
    $("#hover-name").textContent = "—";
    try { parent.resetStyle(e.target); } catch {}
  });
  lyr.on("click", () => onSelect(p.nombre || `Radio ${p.codigo_indec}`, p, lyr, name));
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
  const ind = indLevel ? indicadores[indLevel] : null;
  if (!ind) { breaks = []; levelStats = null; renderLegend(level); renderRanking(); return; }
  const entries = Object.entries(ind)
    .map(([k, d]) => [k, d?.[activeVar]])
    .filter(([, v]) => v != null && isFinite(v));
  const vals = entries.map(([, v]) => v).sort((a, b) => a - b);
  breaks = quantileBreaks(vals, VAR_SCALES.default.length);
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
  const indLevel = indicLevelFor(selectedLevel);
  if (indLevel) {
    if (!indicadores[indLevel]) await loadIndicadores(indLevel);
    ind = indicadores[indLevel]?.[props.codigo_indec];
  } else if (selectedLevel === "pais") {
    ind = await loadIndicadores("pais");
  }
  renderKpis(ind);
  renderCompare(ind, props);
  renderHist(ind);
  renderExtras(ind);
  switchTab("info");
}

function renderKpis(ind) {
  const wrap = $("#sel-kpis");
  if (!ind) { wrap.innerHTML = ""; return; }
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
let zoomTimer;
map.on("zoomend moveend", () => {
  clearTimeout(zoomTimer);
  zoomTimer = setTimeout(autoLevel, 100);
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
  const ind = indicadores[lvl];
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

// -- Init --
(async () => {
  populateVarSelect();
  populateCruceSelects();
  const fromHash = await loadHash();
  if (!fromHash) await setLevel("pais", { fit: true });
  await Promise.all([loadGeo("provincias"), loadIndicadores("provincias")]);
  loadGeo("departamentos").then(() => loadIndicadores("departamentos").then(() => activeLevel === "departamentos" && computeStats(activeLevel)));
  loadGeo("municipios");
  loadGeo("localidades").then(() => loadIndicadores("localidades"));
  loadIndicadores("radios");
  loadEconomia();
  loadPolitica();
})();
