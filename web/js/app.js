// ATLAS politics — frontend
// Capas: pais, provincias, departamentos, municipios, localidades, radios.
// Choropleth dinámico, búsqueda, panel info, economía y política en vivo.

const LEVELS = {
  pais:          { file: "../data/web/pais.geojson",          weight: 1.5, color: "#5aa3ff", fill: 0.04, zMin: 0,  zMax: 5  },
  provincias:    { file: "../data/web/provincias.geojson",    weight: 1.0, color: "#7df2c6", fill: 0.10, zMin: 5,  zMax: 7  },
  departamentos: { file: "../data/web/departamentos.geojson", weight: 0.6, color: "#ffb454", fill: 0.10, zMin: 7,  zMax: 9  },
  municipios:    { file: "../data/web/municipios.geojson",    weight: 0.5, color: "#ff6b6b", fill: 0.10, zMin: 9,  zMax: 11 },
  localidades:   { file: "../data/web/localidades.geojson",   weight: 0,   color: "#c9a8ff", fill: 1.00, zMin: 9,  zMax: 12, point: true },
  radios:        { dir: "../data/web/radios",                 weight: 0.3, color: "#5aa3ff", fill: 0.12, zMin: 12, zMax: 20, lazyByProv: true },
};

// Variable activa para choropleth
const VAR_SCALES = {
  // quantile-like buckets sobre dataset cargado; calcula breaks por capa
  default: ["#0b3060", "#1762a0", "#3290cf", "#74c0e8", "#c8e6f4", "#fceabb", "#f6b26b", "#e07b39", "#b14a14", "#5e1a04"],
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
const layerCache = {};            // levelName → L.GeoJSON
const radioProvCache = {};        // codigo_prov → L.GeoJSON
const radioProvLoading = new Set();
const indicadores = {};           // level → {code: {...}}
let activeLevel = "pais";
let selected = null;
let selectedLevel = null;
let activeVar = "personas";
let breaks = [];                  // umbrales del choropleth actual
let breaksLevel = null;
let breaksVar = null;
let searchIndex = [];             // {nombre, level, codigo, ctx, layer, feat}

// -- Helpers de color --
function quantileBreaks(values, n) {
  values = values.filter(v => v != null && isFinite(v)).sort((a, b) => a - b);
  if (!values.length) return [];
  const b = [];
  for (let i = 1; i < n; i++) {
    b.push(values[Math.floor(values.length * i / n)]);
  }
  return b;
}
function colorFor(v) {
  if (v == null || !isFinite(v) || !activeVar) return null;
  const ramp = VAR_SCALES.default;
  if (!breaks.length) return ramp[Math.floor(ramp.length / 2)];
  let i = 0;
  while (i < breaks.length && v > breaks[i]) i++;
  return ramp[Math.min(i, ramp.length - 1)];
}
function getIndic(level, code) {
  return indicadores[level]?.[code];
}

// -- Carga geometrías --
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
  buildSearchIndex(name, data, layer);
  computeBreaks(name);
  setStatus("");
  return layer;
}

async function loadIndicadores(level) {
  if (indicadores[level]) return indicadores[level];
  try {
    const r = await fetch(`../data/web/indicadores_${level}.json`);
    if (r.ok) indicadores[level] = await r.json();
  } catch (e) { /* opcional */ }
  return indicadores[level];
}

function makeLayer(name, geojson, cfg) {
  const layer = L.geoJSON(geojson, {
    pointToLayer: cfg.point
      ? (feat, latlng) => L.circleMarker(latlng, { radius: 3, color: cfg.color, weight: 0.5, fillOpacity: cfg.fill })
      : undefined,
    style: (feat) => {
      const p = feat.properties || {};
      const code = p.codigo_indec;
      const ind = getIndic(name, code) || getIndic("radios", code);
      const v = ind?.[activeVar];
      const fc = colorFor(v);
      return {
        color: cfg.color, weight: cfg.weight,
        fillOpacity: cfg.fill, fillColor: fc || cfg.color,
      };
    },
    onEachFeature: (feat, lyr) => {
      const p = feat.properties || {};
      const nm = p.nombre || "—";
      const tt = (name === "radios") ? `Radio ${p.codigo_indec}` : nm;
      lyr.bindTooltip(tt, { sticky: true });
      lyr.on("mouseover", e => {
        $("#hover-name").textContent = `${tt} · ${p.tipo || name}`;
        try { e.target.setStyle({ weight: (cfg.weight || 0.5) + 1.5, fillOpacity: Math.min(0.6, cfg.fill + 0.18) }); } catch {}
      });
      lyr.on("mouseout", e => {
        $("#hover-name").textContent = "—";
        try { layer.resetStyle(e.target); } catch {}
      });
      lyr.on("click", () => onSelect(nm || tt, p, lyr, name));
    },
  });
  return layer;
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
    // Cargar indicadores globales si no están
    if (!indicadores.radios) await loadIndicadores("radios");
    const layer = makeLayer("radios", data, LEVELS.radios);
    radioProvCache[codProv] = layer;
    setStatus("");
    return layer;
  } finally {
    radioProvLoading.delete(codProv);
  }
}

// -- Breaks por capa --
function computeBreaks(level) {
  if (!activeVar) { breaks = []; renderLegend(level); return; }
  const ind = indicadores[level];
  if (!ind) { breaks = []; renderLegend(level); return; }
  const vals = Object.values(ind).map(d => d?.[activeVar]).filter(v => v != null && isFinite(v));
  breaks = quantileBreaks(vals, VAR_SCALES.default.length);
  breaksLevel = level;
  breaksVar = activeVar;
  renderLegend(level);
}

function renderLegend(level) {
  const el = $("#legend");
  if (!activeVar || !breaks.length) { el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  $("#legend-title").textContent = `${level} · ${labelFor(activeVar)}`;
  $("#legend-ramp").innerHTML = VAR_SCALES.default
    .map(c => `<span style="background:${c}"></span>`).join("");
  const mn = breaks[0];
  const mx = breaks[breaks.length - 1];
  $("#legend-labels").innerHTML = `<span>${fmtVal(mn)}</span><span>${fmtVal(mx)}</span>`;
}
function fmtVal(v) {
  if (v == null) return "—";
  if (Math.abs(v) >= 1000) return fmt.format(Math.round(v));
  return fmt2.format(v);
}
function labelFor(k) {
  return ({
    personas: "Población",
    hogares: "Hogares",
    viv_part_h: "Viv. habitadas",
    idx_masculinidad: "Índ. masc.",
    personas_por_hogar: "Pers./hogar",
    personas_por_vivienda: "Pers./vivienda",
  })[k] || k;
}

function restyleActive() {
  if (activeLevel === "radios") {
    Object.values(radioProvCache).forEach(l => l.setStyle && refreshLayerStyle(l, "radios"));
  } else {
    const l = layerCache[activeLevel];
    if (l) refreshLayerStyle(l, activeLevel);
  }
}
function refreshLayerStyle(layer, name) {
  const cfg = LEVELS[name];
  layer.setStyle((feat) => {
    const p = feat.properties || {};
    const code = p.codigo_indec;
    const ind = getIndic(name, code);
    const v = ind?.[activeVar];
    const fc = colorFor(v);
    return {
      color: cfg.color, weight: cfg.weight,
      fillOpacity: cfg.fill, fillColor: fc || cfg.color,
    };
  });
}

// -- Selección & panel --
async function onSelect(name, props, lyr, level) {
  if (selected) {
    try {
      if (selectedLevel === "radios") {
        Object.values(radioProvCache).forEach(l => { try { l.resetStyle(selected); } catch {} });
      } else if (layerCache[selectedLevel]) {
        layerCache[selectedLevel].resetStyle(selected);
      }
    } catch {}
  }
  selected = lyr; selectedLevel = level;
  try { lyr.setStyle({ weight: 2.5, color: "#fff", fillOpacity: 0.22 }); lyr.bringToFront(); } catch {}

  $("#sel-name").textContent = name;
  const meta = [];
  if (props.tipo) meta.push(props.tipo);
  if (props.provincia) meta.push(props.provincia);
  if (props.departamento) meta.push(props.departamento);
  if (props.codigo_indec) meta.push(`código ${props.codigo_indec}`);
  $("#sel-meta").textContent = meta.join(" · ") || "—";

  // Indicadores
  let ind = null;
  if (["provincias", "departamentos", "localidades", "radios"].includes(level)) {
    if (!indicadores[level]) await loadIndicadores(level);
    ind = indicadores[level]?.[props.codigo_indec];
  } else if (level === "pais") {
    try {
      const r = await fetch("../catalogs/indicadores.json");
      if (r.ok) ind = (await r.json()).totales_pais;
    } catch {}
  }
  renderKpis(ind);
  const extras = $("#sel-extras");
  if (ind) {
    const rows = Object.entries(ind).map(([k, v]) =>
      `<tr><td>${labelFor(k)}</td><td>${typeof v === "number" ? fmt.format(v) : v}</td></tr>`
    ).join("");
    extras.innerHTML = `<table>${rows}</table>`;
  } else {
    extras.innerHTML = `<p>Sin indicadores disponibles para este nivel.</p>`;
  }
  switchTab("info");
}

function renderKpis(ind) {
  const wrap = $("#sel-kpis");
  if (!ind) { wrap.innerHTML = ""; return; }
  const main = [["personas","Población"],["hogares","Hogares"],["viv_part_h","Viv. habitadas"],["idx_masculinidad","Índ. masc."]];
  wrap.innerHTML = main.map(([k, l]) => {
    if (ind[k] == null) return "";
    const v = typeof ind[k] === "number" ? fmt.format(ind[k]) : ind[k];
    return `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  }).join("");
}

// -- Lazy load radios por bounds --
async function loadRadiosInView() {
  // Cargar geojsons de provincias visibles
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

  // Cargar indicadores del nivel para choropleth
  await loadIndicadores(name === "radios" ? "radios" : name);
  computeBreaks(name);

  if (name === "radios") {
    // Asegurar provincias cargadas para conocer bounds
    if (!layerCache.provincias) await loadGeo("provincias");
    // Quitar otras capas
    for (const [k, l] of Object.entries(layerCache)) map.removeLayer(l);
    // Cargar radios de provincias visibles
    await loadRadiosInView();
    Object.values(radioProvCache).forEach(l => l.addTo(map));
  } else {
    const lyr = await loadGeo(name);
    if (!lyr) return;
    for (const [k, l] of Object.entries(layerCache)) if (k !== name) map.removeLayer(l);
    Object.values(radioProvCache).forEach(l => map.removeLayer(l));
    if (!map.hasLayer(lyr)) lyr.addTo(map);
    if (opts.fit !== false) {
      try { map.fitBounds(lyr.getBounds(), { padding: [20, 20] }); } catch {}
    }
  }
  restyleActive();
}

// -- Auto-zoom de capas --
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
}

$$("#lvl-nav button").forEach(b => {
  b.addEventListener("click", () => setLevel(b.dataset.lvl, { fit: true }));
});

// -- Selector variable --
$("#var-sel").addEventListener("change", e => {
  activeVar = e.target.value || null;
  computeBreaks(activeLevel === "radios" ? "radios" : activeLevel);
  restyleActive();
});

// -- Tabs --
function switchTab(name) {
  $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  $$(".panel").forEach(p => p.classList.toggle("active", p.id === `panel-${name}`));
}
$$(".tab").forEach(t => t.addEventListener("click", () => switchTab(t.dataset.tab)));

// -- Búsqueda --
function buildSearchIndex(level, geojson, layer) {
  for (const feat of geojson.features || []) {
    const p = feat.properties || {};
    const nombre = p.nombre || "";
    if (!nombre || nombre === "—") continue;
    let ctx = "";
    if (p.provincia && p.provincia !== nombre) ctx = p.provincia;
    if (p.departamento && p.departamento !== nombre) ctx = p.departamento + (ctx ? `, ${ctx}` : "");
    searchIndex.push({
      nombre, level, ctx,
      codigo: p.codigo_indec,
      props: p,
      featRef: feat,
      _norm: norm(nombre),
    });
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
  const hits = searchIndex
    .filter(h => h._norm.includes(q))
    .slice(0, 12);
  if (!hits.length) {
    searchResults.innerHTML = `<li class="muted">Sin resultados</li>`;
    searchResults.classList.add("open"); return;
  }
  searchResults.innerHTML = hits.map((h, i) => `
    <li data-idx="${i}">
      <span class="lvl">${h.level}</span>
      <div class="nom">${h.nombre}</div>
      ${h.ctx ? `<div class="ctx">${h.ctx}</div>` : ""}
    </li>
  `).join("");
  searchActiveIdx = 0;
  searchResults.classList.add("open");
  hits.forEach((h, i) => {
    searchResults.children[i].addEventListener("click", () => goTo(h));
  });
  searchResults._hits = hits;
});

searchInput.addEventListener("keydown", e => {
  const hits = searchResults._hits || [];
  if (e.key === "ArrowDown") { searchActiveIdx = Math.min(hits.length - 1, searchActiveIdx + 1); highlight(); e.preventDefault(); }
  else if (e.key === "ArrowUp") { searchActiveIdx = Math.max(0, searchActiveIdx - 1); highlight(); e.preventDefault(); }
  else if (e.key === "Enter" && hits[searchActiveIdx]) { goTo(hits[searchActiveIdx]); }
  else if (e.key === "Escape") { searchResults.classList.remove("open"); }
});
function highlight() {
  $$("li", searchResults).forEach((li, i) => li.classList.toggle("active", i === searchActiveIdx));
}
document.addEventListener("click", e => {
  if (!e.target.closest("#search-wrap")) searchResults.classList.remove("open");
});

async function goTo(hit) {
  searchResults.classList.remove("open");
  searchInput.value = hit.nombre;
  await setLevel(hit.level, { fit: false });
  const lyr = layerCache[hit.level];
  if (!lyr) return;
  let target = null;
  lyr.eachLayer(l => {
    if (l.feature && l.feature.properties.codigo_indec === hit.codigo) target = l;
  });
  if (target) {
    try { map.fitBounds(target.getBounds(), { padding: [40, 40], maxZoom: hit.level === "localidades" ? 12 : 11 }); }
    catch { if (target.getLatLng) map.setView(target.getLatLng(), 12); }
    onSelect(hit.nombre, hit.props, target, hit.level);
  }
}

// -- Economía --
async function loadEconomia() {
  try {
    const r = await fetch("https://api.argentinadatos.com/v1/cotizaciones/dolares");
    const data = await r.json();
    const byCasa = {};
    data.forEach(d => { byCasa[d.casa] = d; });
    const html = Object.values(byCasa).map(d => `
      <div class="rate">
        <span class="n">${d.nombre || d.casa}</span>
        <span class="b">${fmtMoney.format(d.venta)}</span>
      </div>`).join("");
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

// -- Init --
(async () => {
  await setLevel("pais", { fit: true });
  // Pre-cargar prov+depto+muni para que la búsqueda tenga material
  await Promise.all([loadGeo("provincias"), loadIndicadores("provincias")]);
  loadGeo("departamentos").then(() => loadIndicadores("departamentos"));
  loadGeo("municipios");
  loadGeo("localidades").then(() => loadIndicadores("localidades"));
  loadIndicadores("radios");
  loadEconomia();
  loadPolitica();
})();
