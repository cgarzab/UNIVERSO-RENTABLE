import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ============================================================
// CONSTANTS
// ============================================================
const LAYER_COLORS = {
  "ESPECTACULAR ESTATICO": "#4299e1",
  "ESPECTACULAR DIGITAL": "#63b3ed",
  "VALLA DIGITAL": "#b794f4",
  "PUENTE ESTATICO": "#f6ad55",
  "PUENTE DIGITAL": "#fbb6ce",
  "COLUMNA DIGITAL": "#68d391",
  "DRIVE": "#fc8181",
  "PUBLITIENDA ESTATICO": "#f6e05e",
};

// Data field indexes from sites.json array format:
// [0]=id [1]=layer [2]=colonia [3]=munDel [4]=plaza
// [5]=calle [6]=medio [7]=exhibicion [8]=referencia
// [9]=lat [10]=lng [11]=estado [12]=tipo [13]=medida
const toSite = (r) => ({
  id: r[0], layer: r[1], colonia: r[2], munDel: r[3], plaza: r[4],
  calle: r[5], medio: r[6], exhibicion: r[7], referencia: r[8],
  lat: r[9], lng: r[10], estado: r[11], tipo: r[12], medida: r[13],
});

// ============================================================
// UTILS
// ============================================================
function pointInPolygon(point, polygon) {
  let inside = false;
  const x = point[0], y = point[1];
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
}

function buildKML(sites) {
  const pm = sites.map(s => `
    <Placemark>
      <name>${s.id}</name>
      <description>${s.layer} | ${s.calle} | ${s.colonia} | ${s.munDel}</description>
      <Point><coordinates>${s.lng},${s.lat},0</coordinates></Point>
    </Placemark>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document><name>Propuesta Rentable (${sites.length} sitios)</name>${pm}</Document>
</kml>`;
}

function buildGMapsUrl(sites) {
  if (sites.length === 1) return `https://www.google.com/maps?q=${sites[0].lat},${sites[0].lng}`;
  const waypoints = sites.slice(1, -1).map(s => `${s.lat},${s.lng}`).join("|");
  const o = sites[0], d = sites[sites.length - 1];
  return `https://www.google.com/maps/dir/${o.lat},${o.lng}/${waypoints ? waypoints + "/" : ""}${d.lat},${d.lng}`;
}

function uniqueVals(field, pool) {
  const counts = {};
  pool.forEach(s => { const v = s[field]; if (v) counts[v] = (counts[v] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])).map(([v, c]) => ({ v, c }));
}

// ============================================================
// FILTER CHIPS
// ============================================================
function FilterChips({ label, options, selected, onToggle, searchable }) {
  const [search, setSearch] = useState("");
  const visible = searchable && search
    ? options.filter(o => o.v.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#718096", letterSpacing: "0.1em", marginBottom: 5, textTransform: "uppercase", display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>
        {selected.length > 0 && (
          <span style={{ color: "#f6ad55" }}>{selected.length} selec.</span>
        )}
      </div>
      {searchable && options.length > 8 && (
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Buscar...`}
          style={{ width: "100%", background: "#0f1117", border: "1px solid #2d3748", borderRadius: 5, padding: "4px 8px", fontSize: 11, color: "#e2e8f0", outline: "none", marginBottom: 5 }}
        />
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxHeight: options.length > 10 ? 110 : "auto", overflowY: "auto", paddingRight: 2 }}>
        {visible.map(({ v, c }) => {
          const active = selected.includes(v);
          return (
            <button key={v} onClick={() => onToggle(v)} style={{
              padding: "3px 8px", borderRadius: 20, border: "1px solid",
              borderColor: active ? "#f6ad55" : "#2d3748",
              background: active ? "#f6ad55" : "#1a1f2e",
              color: active ? "#1a1a2e" : "#a0aec0",
              fontSize: 10, fontWeight: active ? 700 : 400,
              cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
            }}>
              {v} <span style={{ opacity: 0.55 }}>({c})</span>
            </button>
          );
        })}
        {visible.length === 0 && <span style={{ fontSize: 10, color: "#4a5568" }}>Sin resultados</span>}
      </div>
    </div>
  );
}

// ============================================================
// SITE CARD
// ============================================================
function SiteCard({ site, selected, onSelect, onHover, onEdit, onDelete }) {
  const color = LAYER_COLORS[site.layer] || "#a0aec0";
  return (
    <div
      onMouseEnter={() => onHover(site.id, true)}
      onMouseLeave={() => onHover(site.id, false)}
      style={{
        padding: "9px 12px", borderBottom: "1px solid #1a2030",
        display: "flex", gap: 8, alignItems: "flex-start",
        background: selected ? "#1c2d1a" : "transparent",
        borderLeft: `3px solid ${selected ? "#68d391" : "transparent"}`,
      }}
    >
      <div
        onClick={() => onSelect(site.id)}
        style={{
          width: 14, height: 14, borderRadius: 3, flexShrink: 0, marginTop: 2, cursor: "pointer",
          border: selected ? "none" : "1.5px solid #4a5568",
          background: selected ? "#68d391" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {selected && <span style={{ fontSize: 9, color: "#1a1a2e", fontWeight: 900 }}>✓</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onSelect(site.id)}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#f6ad55", fontFamily: "monospace" }}>{site.id}</span>
        </div>
        <div style={{ fontSize: 11, color: "#cbd5e0", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {site.calle || site.colonia}
        </div>
        <div style={{ fontSize: 10, color: "#4a5568", marginTop: 1 }}>
          <span style={{ background: "#1a2030", color: "#718096", fontSize: 9, fontWeight: 600, padding: "1px 4px", borderRadius: 3, marginRight: 4 }}>{site.layer}</span>
          {site.colonia} · {site.munDel}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
        <button onClick={() => onEdit(site)} style={{ background: "none", border: "none", color: "#4a5568", cursor: "pointer", fontSize: 11, padding: 2 }} title="Editar">✏️</button>
        <button onClick={() => onDelete(site)} style={{ background: "none", border: "none", color: "#742a2a", cursor: "pointer", fontSize: 11, padding: 2 }} title="Eliminar">🗑</button>
      </div>
    </div>
  );
}

// ============================================================
// DELETE MODAL
// ============================================================
function DeleteModal({ site, onConfirm, onCancel }) {
  const [step, setStep] = useState(1);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#1a1f2e", border: "1px solid #742a2a", borderRadius: 12, padding: 24, maxWidth: 380, width: "90%" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fc8181", marginBottom: 10 }}>
          {step === 1 ? "¿Eliminar sitio?" : "⚠️ Confirma eliminación"}
        </div>
        <div style={{ fontSize: 12, color: "#a0aec0", marginBottom: 16, lineHeight: 1.6 }}>
          <strong style={{ color: "#f6ad55" }}>{site.id}</strong><br />
          {site.calle}<br />
          {site.colonia} · {site.munDel}
          {step === 2 && <><br /><span style={{ color: "#fc8181", fontWeight: 700 }}>Esta acción es irreversible.</span></>}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "7px 14px", background: "#2d3748", color: "#a0aec0", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Cancelar</button>
          {step === 1
            ? <button onClick={() => setStep(2)} style={{ padding: "7px 14px", background: "#742a2a", color: "#feb2b2", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Eliminar</button>
            : <button onClick={onConfirm} style={{ padding: "7px 14px", background: "#9b2c2c", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Sí, eliminar definitivamente</button>
          }
        </div>
      </div>
    </div>
  );
}

// ============================================================
// EDIT / ADD MODAL
// ============================================================
const LAYERS = Object.keys(LAYER_COLORS);
const MEDIOS = ["ESPECTACULAR", "VALLA", "PUENTE", "COLUMNA DIGITAL", "DRIVE", "PUBLITIENDA"];
const EXHIBICIONES = ["DIGITAL", "ESTATICO"];

function EditModal({ site, onSave, onCancel }) {
  const isNew = !site;
  const [form, setForm] = useState(site || {
    id: "", layer: "ESPECTACULAR ESTATICO", colonia: "", munDel: "", plaza: "AMCM",
    calle: "", medio: "ESPECTACULAR", exhibicion: "ESTATICO", referencia: "",
    lat: 19.42, lng: -99.13, estado: "CIUDAD DE MEXICO", tipo: "", medida: "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 12, padding: 24, maxWidth: 480, width: "90%", margin: "20px auto" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f6ad55", marginBottom: 16 }}>
          {isNew ? "➕ Agregar sitio nuevo" : `✏️ Editar ${site.id}`}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[["ID / Clave", "id"], ["Calle / Ubicación", "calle"], ["Colonia", "colonia"], ["Municipio/Delegación", "munDel"], ["Estado", "estado"], ["Plaza", "plaza"], ["Tipo de estructura", "tipo"], ["Medida (ej: 9.6 × 3.6)", "medida"], ["Referencia / Descripción", "referencia"]].map(([label, key]) => (
            <div key={key} style={{ gridColumn: ["calle","referencia"].includes(key) ? "1 / -1" : "auto" }}>
              <div style={{ fontSize: 10, color: "#718096", marginBottom: 3 }}>{label}</div>
              <input
                value={form[key] || ""}
                onChange={e => set(key, e.target.value)}
                style={{ width: "100%", background: "#0f1117", border: "1px solid #2d3748", borderRadius: 6, padding: "7px 10px", fontSize: 12, color: "#e2e8f0", outline: "none" }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
          {[["Latitud", "lat"], ["Longitud", "lng"]].map(([label, key]) => (
            <div key={key}>
              <div style={{ fontSize: 10, color: "#718096", marginBottom: 3 }}>{label}</div>
              <input type="number" step="0.000001" value={form[key] || ""} onChange={e => set(key, parseFloat(e.target.value))}
                style={{ width: "100%", background: "#0f1117", border: "1px solid #2d3748", borderRadius: 6, padding: "7px 8px", fontSize: 12, color: "#e2e8f0", outline: "none" }} />
            </div>
          ))}
          {[["Medio", "medio", MEDIOS], ["Exhibición", "exhibicion", EXHIBICIONES], ["Layer/Tipo", "layer", LAYERS]].map(([label, key, opts]) => (
            <div key={key} style={{ gridColumn: key === "layer" ? "1 / -1" : "auto" }}>
              <div style={{ fontSize: 10, color: "#718096", marginBottom: 3 }}>{label}</div>
              <select value={form[key] || ""} onChange={e => set(key, e.target.value)}
                style={{ width: "100%", background: "#0f1117", border: "1px solid #2d3748", borderRadius: 6, padding: "7px 8px", fontSize: 11, color: "#e2e8f0", outline: "none" }}>
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
          <button onClick={onCancel} style={{ padding: "8px 16px", background: "#2d3748", color: "#a0aec0", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Cancelar</button>
          <button onClick={() => onSave({ ...form, lat: parseFloat(form.lat), lng: parseFloat(form.lng) })}
            style={{ padding: "8px 16px", background: "#f6ad55", color: "#1a1a2e", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
            {isNew ? "Agregar sitio" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LEAFLET MAP
// ============================================================
function LeafletMap({ sites, selected, onToggle, drawMode, onDrawComplete, hoveredId }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerLayerRef = useRef(null);
  const markerMapRef = useRef({});
  const drawLayerRef = useRef(null);
  const polygonPointsRef = useRef([]);

  const makeIcon = useCallback((layer, isSel, isHov) => {
    if (!window.L) return null;
    const color = isSel ? "#68d391" : isHov ? "#ffffff" : (LAYER_COLORS[layer] || "#a0aec0");
    const size = isSel ? 12 : isHov ? 10 : 7;
    return window.L.divIcon({
      className: "",
      html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:${isSel || isHov ? 2 : 1}px solid rgba(255,255,255,0.5);box-shadow:0 0 ${isSel ? 8 : 3}px ${color}88;transform:translate(-50%,-50%)"></div>`,
      iconSize: [0, 0], iconAnchor: [0, 0],
    });
  }, []);

  // Init map
  useEffect(() => {
    if (!window.L || mapInstanceRef.current) return;
    mapInstanceRef.current = window.L.map(mapRef.current, { zoomControl: true }).setView([19.42, -99.13], 10);
    window.L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap © CARTO", maxZoom: 19,
    }).addTo(mapInstanceRef.current);
    markerLayerRef.current = window.L.layerGroup().addTo(mapInstanceRef.current);
    drawLayerRef.current = window.L.layerGroup().addTo(mapInstanceRef.current);
  }, []);

  // Render markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markerLayerRef.current) return;
    markerLayerRef.current.clearLayers();
    markerMapRef.current = {};
    const toShow = sites.length > 1500 ? sites.slice(0, 1500) : sites;
    toShow.forEach(s => {
      if (!s.lat || !s.lng) return;
      const isSel = selected.has(s.id);
      const m = window.L.marker([s.lat, s.lng], { icon: makeIcon(s.layer, isSel, false) });
      m.bindPopup(`
        <div style="font-size:11px;min-width:190px;font-family:monospace;line-height:1.5">
          <b style="color:#f6ad55;font-size:12px">${s.id}</b><br/>
          <b style="color:#e2e8f0">${s.layer}</b><br/>
          ${s.calle}<br/>
          <span style="color:#718096">${s.colonia} · ${s.munDel}</span><br/>
          ${s.medida && s.medida !== "0.0 × 0.0" ? `<span style="color:#a0aec0">📐 ${s.medida}</span><br/>` : ""}
          ${s.referencia ? `<em style="color:#4a5568">${s.referencia}</em><br/>` : ""}
          <button onclick="window.__toggleSite('${s.id}')" style="margin-top:6px;padding:4px 10px;background:${isSel ? '#276749' : '#2d3748'};border:none;border-radius:4px;color:${isSel ? '#9ae6b4' : '#e2e8f0'};cursor:pointer;font-size:11px;width:100%">
            ${isSel ? "☑ Quitar selección" : "☐ Seleccionar"}
          </button>
        </div>`, { maxWidth: 260 });
      m.on("click", () => window.__toggleSite(s.id));
      markerLayerRef.current.addLayer(m);
      markerMapRef.current[s.id] = { marker: m, site: s };
    });
  }, [sites, selected, makeIcon]);

  // Update marker icons when selection/hover changes
  useEffect(() => {
    Object.entries(markerMapRef.current).forEach(([id, { marker, site }]) => {
      marker.setIcon(makeIcon(site.layer, selected.has(id), id === hoveredId));
      marker.setZIndexOffset(id === hoveredId ? 1000 : selected.has(id) ? 500 : 0);
    });
  }, [selected, hoveredId, makeIcon]);

  // Draw mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (!drawMode) {
      map.off("click"); map.off("dblclick");
      map.getContainer().style.cursor = "";
      drawLayerRef.current?.clearLayers();
      polygonPointsRef.current = [];
      return;
    }
    map.getContainer().style.cursor = "crosshair";
    polygonPointsRef.current = [];
    drawLayerRef.current?.clearLayers();

    const onClick = (e) => {
      const pt = [e.latlng.lat, e.latlng.lng];
      polygonPointsRef.current.push(pt);
      drawLayerRef.current?.clearLayers();
      const pts = polygonPointsRef.current;
      if (pts.length >= 2) {
        window.L.polygon(pts, { color: "#f6ad55", fillOpacity: 0.12, weight: 2, dashArray: "5,5" }).addTo(drawLayerRef.current);
      }
      window.L.circleMarker([pt[0], pt[1]], { radius: 4, color: "#f6ad55", fillColor: "#f6ad55", fillOpacity: 1, weight: 1 }).addTo(drawLayerRef.current);
    };

    const onDblClick = (e) => {
      window.L.DomEvent.stopPropagation(e);
      const pts = polygonPointsRef.current;
      if (pts.length >= 3) {
        const found = sites.filter(s => s.lat && s.lng && pointInPolygon([s.lat, s.lng], pts)).map(s => s.id);
        onDrawComplete(found);
      }
      map.off("click", onClick); map.off("dblclick", onDblClick);
      map.getContainer().style.cursor = "";
    };

    map.on("click", onClick);
    map.on("dblclick", onDblClick);
    return () => { map.off("click", onClick); map.off("dblclick", onDblClick); };
  }, [drawMode, sites, onDrawComplete]);

  window.__toggleSite = onToggle;

  return <div ref={mapRef} style={{ width: "100%", height: "100%" }} />;
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [allSites, setAllSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(null); // null | "zona" | "filtros"
  const [selected, setSelected] = useState(new Set());
  const [hoveredId, setHoveredId] = useState(null);
  const [drawMode, setDrawMode] = useState(false);
  const [editSite, setEditSite] = useState(null);
  const [deleteSite, setDeleteSite] = useState(null);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  const [filters, setFilters] = useState({
    plazas: [], estados: [], munDels: [], colonias: [],
    medios: [], exhibiciones: [], tipos: [], medidas: [],
    search: "",
  });

  // Load data
  useEffect(() => {
    fetch("/data/sites.json")
      .then(r => r.json())
      .then(raw => {
        setAllSites(raw.map(toSite));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Filtered sites
  const filtered = useMemo(() => {
    return allSites.filter(s => {
      if (filters.plazas.length && !filters.plazas.includes(s.plaza)) return false;
      if (filters.estados.length && !filters.estados.includes(s.estado)) return false;
      if (filters.munDels.length && !filters.munDels.includes(s.munDel)) return false;
      if (filters.colonias.length && !filters.colonias.includes(s.colonia)) return false;
      if (filters.medios.length && !filters.medios.includes(s.medio)) return false;
      if (filters.exhibiciones.length && !filters.exhibiciones.includes(s.exhibicion)) return false;
      if (filters.tipos.length && !filters.tipos.includes(s.tipo)) return false;
      if (filters.medidas.length && !filters.medidas.includes(s.medida)) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (![s.id, s.calle, s.colonia, s.munDel, s.referencia].join(" ").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allSites, filters]);

  // Cascaded options
  const opts = useMemo(() => ({
    plazas: uniqueVals("plaza", allSites),
    estados: uniqueVals("estado", filtered),
    munDels: uniqueVals("munDel", filtered),
    colonias: uniqueVals("colonia", filtered),
    medios: uniqueVals("medio", filtered),
    exhibiciones: uniqueVals("exhibicion", filtered),
    tipos: uniqueVals("tipo", filtered),
    medidas: uniqueVals("medida", filtered).filter(o => o.v && o.v !== "0.0 × 0.0" && !o.v.startsWith("0.0")),
  }), [allSites, filtered]);

  const toggleFilter = (key, val) =>
    setFilters(f => ({ ...f, [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val] }));

  const clearFilters = () => setFilters({ plazas: [], estados: [], munDels: [], colonias: [], medios: [], exhibiciones: [], tipos: [], medidas: [], search: "" });

  const hasFilters = Object.entries(filters).some(([k, v]) => k === "search" ? v : v.length > 0);

  const toggleSite = useCallback((id) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const handleDrawComplete = (ids) => {
    setSelected(prev => new Set([...prev, ...ids]));
    setDrawMode(false);
    showToast(`${ids.length} sitios encontrados en la zona`);
  };

  const generateMap = () => {
    const sel = allSites.filter(s => selected.has(s.id) && s.lat && s.lng);
    if (!sel.length) { showToast("Selecciona al menos un sitio", "error"); return; }
    if (sel.length <= 10) {
      window.open(buildGMapsUrl(sel), "_blank");
    } else {
      const blob = new Blob([buildKML(sel)], { type: "application/vnd.google-earth.kml+xml" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `propuesta_rentable_${sel.length}sitios.kml` });
      a.click(); URL.revokeObjectURL(a.href);
      showToast(`KML descargado — ${sel.length} sitios`);
    }
  };

  const handleSave = (form) => {
    if (!editSite) {
      setAllSites(p => [...p, form]);
      showToast("Sitio agregado ✓");
    } else {
      setAllSites(p => p.map(s => s.id === form.id ? form : s));
      showToast("Sitio actualizado ✓");
    }
    setEditSite(undefined);
  };

  const handleDelete = () => {
    setAllSites(p => p.filter(s => s.id !== deleteSite.id));
    setSelected(p => { const n = new Set(p); n.delete(deleteSite.id); return n; });
    showToast("Sitio eliminado");
    setDeleteSite(null);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        const newSites = Array.isArray(data[0]) ? data.map(toSite) : data;
        setAllSites(newSites);
        showToast(`${newSites.length} sitios importados ✓`);
      } catch { showToast("Error al leer el archivo", "error"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const mapSites = mode === "filtros" ? filtered : allSites;

  if (loading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1117", color: "#f6ad55", fontSize: 14, fontFamily: "monospace" }}>
      Cargando universo rentable...
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "hidden" }}>

      {/* ── HEADER ── */}
      <div style={{ background: "#151821", borderBottom: "1px solid #2d3748", padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", color: "#f6ad55" }}>🗺 UNIVERSO RENTABLE</span>
        <span style={{ fontSize: 10, color: "#4a5568" }}>{allSites.length.toLocaleString()} sitios</span>
        <div style={{ flex: 1 }} />

        {/* Mode toggle */}
        <div style={{ display: "flex", background: "#0f1117", borderRadius: 7, border: "1px solid #2d3748", overflow: "hidden" }}>
          {[["🖊 Por Zona", "zona"], ["🔍 Por Filtros", "filtros"]].map(([label, m]) => (
            <button key={m} onClick={() => { setMode(mode === m ? null : m); if (m === "zona") setDrawMode(false); }}
              style={{ padding: "5px 12px", border: "none", fontSize: 11, fontWeight: 600, background: mode === m ? "#f6ad55" : "transparent", color: mode === m ? "#1a1a2e" : "#718096", cursor: "pointer", transition: "all 0.2s" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Selection actions */}
        {selected.size > 0 && (
          <>
            <span style={{ fontSize: 11, color: "#68d391", fontWeight: 700 }}>✓ {selected.size}</span>
            <button onClick={generateMap} style={{ padding: "5px 12px", background: "#276749", color: "#9ae6b4", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
              📍 Generar mapa
            </button>
            <button onClick={() => setSelected(new Set())} style={{ padding: "5px 8px", background: "#742a2a", color: "#feb2b2", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>✕</button>
          </>
        )}

        {/* Admin */}
        <button onClick={() => setEditSite(null)} title="Agregar sitio"
          style={{ padding: "5px 9px", background: "#2d3748", color: "#a0aec0", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>➕</button>
        <button onClick={() => fileInputRef.current?.click()} title="Importar JSON"
          style={{ padding: "5px 9px", background: "#2d3748", color: "#a0aec0", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>📂</button>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
      </div>

      {/* ── BODY ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* FILTER PANEL */}
        {mode === "filtros" && (
          <div style={{ width: 290, flexShrink: 0, background: "#151821", borderRight: "1px solid #2d3748", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #2d3748" }}>
              <input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                placeholder="🔍 Buscar ID, calle, colonia..." style={{ width: "100%", background: "#0f1117", border: "1px solid #2d3748", borderRadius: 6, padding: "7px 10px", fontSize: 12, color: "#e2e8f0", outline: "none" }} />
              {hasFilters && (
                <button onClick={clearFilters} style={{ marginTop: 6, width: "100%", padding: 5, background: "#2d3748", color: "#a0aec0", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>
                  ✕ Limpiar todos los filtros
                </button>
              )}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 0" }}>
              <FilterChips label="Plaza" options={opts.plazas} selected={filters.plazas} onToggle={v => toggleFilter("plazas", v)} />
              <FilterChips label="Estado" options={opts.estados} selected={filters.estados} onToggle={v => toggleFilter("estados", v)} searchable />
              <FilterChips label="Municipio / Delegación" options={opts.munDels} selected={filters.munDels} onToggle={v => toggleFilter("munDels", v)} searchable />
              <FilterChips label="Colonia" options={opts.colonias} selected={filters.colonias} onToggle={v => toggleFilter("colonias", v)} searchable />
              <FilterChips label="Medio" options={opts.medios} selected={filters.medios} onToggle={v => toggleFilter("medios", v)} />
              <FilterChips label="Exhibición" options={opts.exhibiciones} selected={filters.exhibiciones} onToggle={v => toggleFilter("exhibiciones", v)} />
              <FilterChips label="Tipo de estructura" options={opts.tipos} selected={filters.tipos} onToggle={v => toggleFilter("tipos", v)} searchable />
              <FilterChips label="Medida (base × altura)" options={opts.medidas} selected={filters.medidas} onToggle={v => toggleFilter("medidas", v)} searchable />
            </div>
            <div style={{ padding: "8px 12px", borderTop: "1px solid #2d3748", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: "#718096" }}>{filtered.length.toLocaleString()} sitios</span>
              <div style={{ display: "flex", gap: 5 }}>
                <button onClick={() => setSelected(new Set(filtered.map(s => s.id)))} style={{ padding: "3px 8px", background: "#2d3748", color: "#a0aec0", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10 }}>☑ Todos</button>
                <button onClick={() => setSelected(new Set())} style={{ padding: "3px 8px", background: "#2d3748", color: "#a0aec0", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10 }}>☐ Ninguno</button>
              </div>
            </div>
          </div>
        )}

        {/* RESULTS LIST */}
        {mode === "filtros" && (
          <div style={{ width: 270, flexShrink: 0, background: "#0f1117", borderRight: "1px solid #1a2030", overflowY: "auto" }}>
            {filtered.slice(0, 300).map(s => (
              <SiteCard key={s.id} site={s} selected={selected.has(s.id)}
                onSelect={toggleSite}
                onHover={(id, on) => setHoveredId(on ? id : null)}
                onEdit={setEditSite}
                onDelete={setDeleteSite}
              />
            ))}
            {filtered.length > 300 && (
              <div style={{ padding: 14, textAlign: "center", color: "#4a5568", fontSize: 11 }}>
                +{(filtered.length - 300).toLocaleString()} sitios más — refina los filtros para verlos
              </div>
            )}
            {filtered.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: "#4a5568", fontSize: 12 }}>
                Sin resultados con estos filtros
              </div>
            )}
          </div>
        )}

        {/* MAP */}
        <div style={{ flex: 1, position: "relative" }}>
          <LeafletMap
            sites={mapSites}
            selected={selected}
            onToggle={toggleSite}
            drawMode={drawMode}
            onDrawComplete={handleDrawComplete}
            hoveredId={hoveredId}
          />

          {/* Zona mode controls */}
          {mode === "zona" && (
            <div style={{ position: "absolute", top: 16, left: 16, zIndex: 1000 }}>
              <button onClick={() => setDrawMode(!drawMode)} style={{
                padding: "10px 16px", borderRadius: 8, border: "1px solid",
                borderColor: drawMode ? "#f6ad55" : "#2d3748",
                background: drawMode ? "#f6ad55" : "#151821",
                color: drawMode ? "#1a1a2e" : "#e2e8f0",
                fontWeight: 700, fontSize: 12, cursor: "pointer",
                boxShadow: "0 2px 12px rgba(0,0,0,0.6)",
              }}>
                {drawMode ? "✏️ Dibujando... (doble click para cerrar)" : "🖊 Dibujar zona libre"}
              </button>
              {drawMode && (
                <div style={{ marginTop: 8, background: "rgba(15,17,23,0.92)", borderRadius: 6, padding: "8px 12px", fontSize: 11, color: "#a0aec0", maxWidth: 220, lineHeight: 1.5 }}>
                  Toca el mapa para agregar puntos.<br />
                  <strong style={{ color: "#f6ad55" }}>Doble click</strong> para cerrar el polígono y seleccionar sitios.
                </div>
              )}
            </div>
          )}

          {/* Selected summary — zona mode */}
          {mode === "zona" && selected.size > 0 && (
            <div style={{ position: "absolute", bottom: 16, left: 16, zIndex: 1000, background: "#151821", border: "1px solid #2d3748", borderRadius: 8, padding: 12, maxWidth: 260, maxHeight: 220, overflowY: "auto", boxShadow: "0 4px 20px rgba(0,0,0,0.6)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#68d391", marginBottom: 8 }}>
                {selected.size} sitios seleccionados
              </div>
              {allSites.filter(s => selected.has(s.id)).slice(0, 8).map(s => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "#f6ad55", fontFamily: "monospace" }}>{s.id}</span>
                  <span style={{ fontSize: 10, color: "#4a5568", marginLeft: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>{s.colonia}</span>
                  <button onClick={() => toggleSite(s.id)} style={{ background: "none", border: "none", color: "#4a5568", cursor: "pointer", fontSize: 10, flexShrink: 0 }}>✕</button>
                </div>
              ))}
              {selected.size > 8 && <div style={{ fontSize: 10, color: "#4a5568" }}>+{selected.size - 8} más...</div>}
            </div>
          )}
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
          background: toast.type === "error" ? "#742a2a" : "#276749",
          color: toast.type === "error" ? "#feb2b2" : "#9ae6b4",
          padding: "10px 20px", borderRadius: 8, fontSize: 12, fontWeight: 600,
          zIndex: 99999, boxShadow: "0 4px 20px rgba(0,0,0,0.6)", whiteSpace: "nowrap",
        }}>
          {toast.msg}
        </div>
      )}

      {/* MODALS */}
      {deleteSite && <DeleteModal site={deleteSite} onConfirm={handleDelete} onCancel={() => setDeleteSite(null)} />}
      {editSite !== undefined && <EditModal site={editSite} onSave={handleSave} onCancel={() => setEditSite(undefined)} />}
    </div>
  );
}
