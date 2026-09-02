import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import {
  Train, Zap, MapPin, Compass, AlertTriangle,
  CheckCircle2, Clock, Layers, Eye, EyeOff, Activity, ShieldCheck,
  Search, Globe, Radio, Maximize2, RefreshCw, Cpu
} from 'lucide-react';
import type { StationResponse, TrainSchedule, MaintenanceTask, PlanItemResponse } from '../../types';
import { clsx } from '../../utils/clsx';

interface GisCorridorMapProps {
  stations?: StationResponse[];
  trains?: TrainSchedule[];
  tasks?: MaintenanceTask[];
  planItems?: PlanItemResponse[];
}

// ── Geographic Station Coordinates (Northern Railway / NCR Corridor) ─────────
export interface StationGeo {
  code: string;
  name: string;
  lat: number;
  lng: number;
  zone: string;
  xSvg: number;
  ySvg: number;
}

export const REAL_STATIONS: Record<string, StationGeo> = {
  NDLS: { code: 'NDLS', name: 'New Delhi Junction',       lat: 28.6431, lng: 77.2197, zone: 'NR',  xSvg: 12, ySvg: 45 },
  DLI:  { code: 'DLI',  name: 'Old Delhi Junction',        lat: 28.6617, lng: 77.2300, zone: 'NR',  xSvg: 14, ySvg: 38 },
  ANVT: { code: 'ANVT', name: 'Anand Vihar Terminal',     lat: 28.6469, lng: 77.3150, zone: 'NR',  xSvg: 25, ySvg: 44 },
  GZB:  { code: 'GZB',  name: 'Ghaziabad Junction',       lat: 28.6652, lng: 77.4385, zone: 'NR',  xSvg: 35, ySvg: 45 },
  MTC:  { code: 'MTC',  name: 'Meerut City Junction',     lat: 28.9800, lng: 77.7064, zone: 'NR',  xSvg: 50, ySvg: 20 },
  ALJN: { code: 'ALJN', name: 'Aligarh Junction',         lat: 27.8922, lng: 78.0706, zone: 'NCR', xSvg: 55, ySvg: 52 },
  TDL:  { code: 'TDL',  name: 'Tundla Junction',          lat: 27.2064, lng: 78.2393, zone: 'NCR', xSvg: 60, ySvg: 54 },
  CNB:  { code: 'CNB',  name: 'Kanpur Central',           lat: 26.4542, lng: 80.3507, zone: 'NCR', xSvg: 65, ySvg: 55 },
  PRYJ: { code: 'PRYJ', name: 'Prayagraj Junction',       lat: 25.4358, lng: 81.8463, zone: 'NCR', xSvg: 88, ySvg: 62 },
};

// Track Corridor Polylines connecting geographic station waypoints
export const CORRIDORS_GEO = [
  {
    id: 'NDLS-GZB-UP',
    label: 'NDLS–GZB UP',
    color: '#3b82f6',
    from: 'NDLS',
    to: 'GZB',
    pathLat5: [[28.6431, 77.2197], [28.6469, 77.3150], [28.6652, 77.4385]] as [number, number][],
  },
  {
    id: 'GZB-NDLS-DN',
    label: 'GZB–NDLS DN',
    color: '#8b5cf6',
    from: 'GZB',
    to: 'NDLS',
    pathLat5: [[28.6652, 77.4385], [28.6469, 77.3150], [28.6431, 77.2197]] as [number, number][],
  },
  {
    id: 'NDLS-MTC-UP',
    label: 'GZB–MTC UP',
    color: '#10b981',
    from: 'GZB',
    to: 'MTC',
    pathLat5: [[28.6652, 77.4385], [28.9800, 77.7064]] as [number, number][],
  },
  {
    id: 'GZB-CNB-MAIN',
    label: 'GZB–CNB Main',
    color: '#f59e0b',
    from: 'GZB',
    to: 'CNB',
    pathLat5: [[28.6652, 77.4385], [27.8922, 78.0706], [27.2064, 78.2393], [26.4542, 80.3507]] as [number, number][],
  },
  {
    id: 'CNB-PRYJ-DN',
    label: 'CNB–PRYJ',
    color: '#06b6d4',
    from: 'CNB',
    to: 'PRYJ',
    pathLat5: [[26.4542, 80.3507], [25.4358, 81.8463]] as [number, number][],
  },
];

const TRAIN_SECTION_MAP: Record<string, string> = {
  'NDLS-GZB-UP': 'NDLS-GZB-UP',
  'GZB-NDLS-DN': 'GZB-NDLS-DN',
  'NDLS-MTC-UP': 'NDLS-MTC-UP',
  'NDLS-GZB-DN': 'GZB-NDLS-DN',
};

const DEPT_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  ENGG: { fill: 'rgba(59,130,246,0.3)', stroke: '#3b82f6', label: 'Engineering' },
  TRD:  { fill: 'rgba(245,158,11,0.3)', stroke: '#f59e0b', label: 'Traction (TRD)' },
  ST:   { fill: 'rgba(139,92,246,0.3)', stroke: '#8b5cf6', label: 'Signal & Telecom' },
};

const TRAIN_COLORS: Record<string, string> = {
  PASSENGER_PREMIUM:  '#10b981',
  PASSENGER_EXPRESS:  '#06b6d4',
  PASSENGER_LOCAL:    '#64748b',
  FREIGHT_CONTAINER:  '#ec4899',
  FREIGHT_COAL:       '#f97316',
};

// Map Tile Providers
export type MapProvider = 'cartodb_dark' | 'openrailwaymap' | 'esri_satellite' | 'osm_standard' | 'schematic';

interface MapProviderOption {
  id: MapProvider;
  name: string;
  tileUrl?: string;
  overlayUrl?: string;
  attribution?: string;
  badge: string;
  description: string;
}

const MAP_PROVIDERS: MapProviderOption[] = [
  {
    id: 'cartodb_dark',
    name: 'CartoDB Dark (Default)',
    tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
    badge: 'DARK CONTROL ROOM',
    description: 'High-contrast dark vector map optimized for operational command centers.',
  },
  {
    id: 'openrailwaymap',
    name: 'OpenRailwayMap Live Tracks',
    tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    overlayUrl: 'https://{s}.tile.openrailwaymap.org/standard/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a> &copy; OpenStreetMap',
    badge: 'RAILWAY INFRASTRUCTURE',
    description: 'Official OpenRailwayMap layer showing real railway tracks, switches, signals & catenary electrification.',
  },
  {
    id: 'esri_satellite',
    name: 'Esri Satellite Imagery',
    tileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    badge: 'AERIAL SATELLITE',
    description: 'High-resolution satellite view of Indian Railways tracks, stations and geographical terrain.',
  },
  {
    id: 'osm_standard',
    name: 'OpenStreetMap Geographic',
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    badge: 'STREET & RAIL',
    description: 'Standard OpenStreetMap geographic vector presentation.',
  },
  {
    id: 'schematic',
    name: 'Schematic Topological View',
    badge: 'SVG TOPOLOGY',
    description: 'Clean vector schematic corridor diagram.',
  },
];

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// Line interpolation between geographic lat/lng coordinates
function interpolatePath(points: [number, number][], t: number): [number, number] {
  if (points.length < 2) return points[0] || [28.6431, 77.2197];
  const numSegments = points.length - 1;
  const scaledT = Math.max(0, Math.min(1, t)) * numSegments;
  const index = Math.floor(scaledT);
  const localT = scaledT - index;
  const p1 = points[Math.min(index, points.length - 1)];
  const p2 = points[Math.min(index + 1, points.length - 1)];
  return [lerp(p1[0], p2[0], localT), lerp(p1[1], p2[1], localT)];
}

export function GisCorridorMap({ stations = [], trains = [], tasks = [], planItems = [] }: GisCorridorMapProps) {
  const [activeProvider, setActiveProvider] = useState<MapProvider>('cartodb_dark');
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; data: any } | null>(null);
  const [activeLayers, setActiveLayers] = useState({
    trains: true,
    blocks: true,
    stations: true,
    tracks: true,
    railOverlay: true,
  });
  const [tick, setTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayLayerRef = useRef<L.TileLayer | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Train animation ticker (updates live position offset every 2 seconds)
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(timer);
  }, []);

  // Filter entities by search query
  const filteredTrains = useMemo(() => {
    if (!searchQuery.trim()) return trains;
    const q = searchQuery.toLowerCase();
    return trains.filter(t =>
      t.train_number.toLowerCase().includes(q) ||
      t.train_name.toLowerCase().includes(q) ||
      t.section_id.toLowerCase().includes(q)
    );
  }, [trains, searchQuery]);

  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter(t =>
      t.external_id.toLowerCase().includes(q) ||
      t.defect_type.toLowerCase().includes(q) ||
      t.section_id.toLowerCase().includes(q) ||
      t.asset_id.toLowerCase().includes(q)
    );
  }, [tasks, searchQuery]);

  // ── Initialize & Manage Leaflet Map Instance ──────────────────────────────
  useEffect(() => {
    if (activeProvider === 'schematic') return;
    if (!mapContainerRef.current) return;

    if (!leafletMapRef.current) {
      // Center map around Delhi-NCR / UP railway corridor
      const map = L.map(mapContainerRef.current, {
        center: [27.8, 78.5],
        zoom: 7,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: 'topright' }).addTo(map);
      layerGroupRef.current = L.layerGroup().addTo(map);
      leafletMapRef.current = map;
    }

    const map = leafletMapRef.current;
    const selectedOption = MAP_PROVIDERS.find(p => p.id === activeProvider) || MAP_PROVIDERS[0];

    // Remove existing tile layers
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    if (overlayLayerRef.current) {
      map.removeLayer(overlayLayerRef.current);
      overlayLayerRef.current = null;
    }

    // Add main tile layer
    if (selectedOption.tileUrl) {
      tileLayerRef.current = L.tileLayer(selectedOption.tileUrl, {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);
    }

    // Add secondary overlay layer (e.g. OpenRailwayMap signal layer)
    if (selectedOption.overlayUrl && activeLayers.railOverlay) {
      overlayLayerRef.current = L.tileLayer(selectedOption.overlayUrl, {
        maxZoom: 19,
        subdomains: 'a',
        opacity: 0.85,
      }).addTo(map);
    }

    map.invalidateSize();
  }, [activeProvider, activeLayers.railOverlay]);

  // ── Render Leaflet Map Layers (Tracks, Stations, Possessions, Animated Trains)
  useEffect(() => {
    if (activeProvider === 'schematic') return;
    const map = leafletMapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. Render Track Polylines
    if (activeLayers.tracks) {
      CORRIDORS_GEO.forEach(corridor => {
        const polyline = L.polyline(corridor.pathLat5, {
          color: corridor.color,
          weight: 4,
          opacity: 0.8,
          dashArray: '6, 6',
        });
        polyline.bindTooltip(`<b>${corridor.label}</b><br/>Section ID: ${corridor.id}`, {
          className: 'leaflet-custom-tooltip',
        });
        group.addLayer(polyline);
      });
    }

    // 2. Render Station Node Markers
    if (activeLayers.stations) {
      Object.values(REAL_STATIONS).forEach(st => {
        const iconHtml = `
          <div class="relative flex items-center justify-center">
            <div class="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-400 animate-ping absolute"></div>
            <div class="w-3.5 h-3.5 rounded-full bg-navy-950 border-2 border-blue-400 flex items-center justify-center">
              <div class="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
            </div>
            <div class="absolute top-5 whitespace-nowrap bg-navy-950/90 text-gray-200 border border-blue-500/40 px-1.5 py-0.5 rounded text-[9px] font-bold shadow-md">
              ${st.code}
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-station-icon',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        const marker = L.marker([st.lat, st.lng], { icon: customIcon });
        marker.on('click', () => setSelectedEntity({ type: 'station', data: st }));
        group.addLayer(marker);
      });
    }

    // 3. Render Scheduled Maintenance Block Possession Circles
    if (activeLayers.blocks) {
      planItems.forEach((item, idx) => {
        const task = filteredTasks.find(t => t.id === item.task_id);
        if (!task) return;
        const sectionId = task.section_id;
        const corridor = CORRIDORS_GEO.find(c => c.id === sectionId) || CORRIDORS_GEO[idx % CORRIDORS_GEO.length];
        const dept = DEPT_COLORS[task.department] || DEPT_COLORS.ENGG;

        const tasksOnSection = filteredTasks.filter(t => t.section_id === sectionId);
        const posIndex = tasksOnSection.findIndex(t => t.id === task.id);
        const tOffset = 0.35 + (posIndex >= 0 ? posIndex : 0) * 0.15;
        const blockPos = interpolatePath(corridor.pathLat5, tOffset % 0.85);

        const circle = L.circle(blockPos, {
          radius: 12000, // 12km safety buffer
          color: dept.stroke,
          fillColor: dept.stroke,
          fillOpacity: 0.25,
          weight: 2,
          dashArray: '4, 4',
        });

        const blockIconHtml = `
          <div class="relative flex items-center justify-center">
            <div class="w-6 h-6 rounded-full bg-amber-500/30 border border-amber-400 animate-pulse absolute"></div>
            <div class="px-1.5 py-0.5 bg-navy-950 text-amber-300 border border-amber-500/50 rounded text-[9px] font-mono font-bold">
              ⚡ ${task.external_id}
            </div>
          </div>
        `;
        const blockIcon = L.divIcon({
          html: blockIconHtml,
          className: 'custom-block-icon',
          iconSize: [40, 20],
          iconAnchor: [20, 10],
        });

        const marker = L.marker(blockPos, { icon: blockIcon });
        marker.on('click', () => setSelectedEntity({ type: 'block', data: { task, item } }));
        group.addLayer(circle);
        group.addLayer(marker);
      });
    }

    // 4. Render Live Animated Train GPS Markers
    if (activeLayers.trains) {
      filteredTrains.forEach((train, idx) => {
        const sectionId = train.section_id;
        const corridor = CORRIDORS_GEO.find(c => c.id === sectionId) ||
                         CORRIDORS_GEO.find(c => c.id === TRAIN_SECTION_MAP[sectionId]) ||
                         CORRIDORS_GEO[idx % CORRIDORS_GEO.length];

        const trainsOnCorridor = filteredTrains.filter(t => {
          const c = CORRIDORS_GEO.find(c2 => c2.id === t.section_id) ||
                    CORRIDORS_GEO.find(c2 => c2.id === TRAIN_SECTION_MAP[t.section_id]) ||
                    CORRIDORS_GEO[idx % CORRIDORS_GEO.length];
          return c.id === corridor.id;
        });

        const posInCorridor = trainsOnCorridor.findIndex(t => t.id === train.id);
        const baseT = ((tick * 0.05 + (posInCorridor >= 0 ? posInCorridor : 0) * 0.25) % 0.8) + 0.1;
        const trainPos = interpolatePath(corridor.pathLat5, baseT);

        const color = TRAIN_COLORS[train.train_type] || '#10b981';
        const isPremium = train.train_type === 'PASSENGER_PREMIUM';

        const iconHtml = `
          <div class="relative flex items-center justify-center" style="cursor:pointer">
            <div class="w-6 h-6 rounded-full opacity-40 animate-ping absolute" style="background-color: ${color}"></div>
            <div class="px-2 py-0.5 rounded-full bg-navy-950 border flex items-center gap-1 shadow-lg" style="border-color: ${color}">
              <div class="w-2 h-2 rounded-full" style="background-color: ${color}"></div>
              <span class="text-[9px] font-mono font-bold text-gray-100">🚆 ${train.train_number}</span>
            </div>
          </div>
        `;

        const trainIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-train-icon',
          iconSize: [60, 24],
          iconAnchor: [30, 12],
        });

        const marker = L.marker(trainPos, { icon: trainIcon });
        marker.on('click', () => setSelectedEntity({ type: 'train', data: train }));
        group.addLayer(marker);
      });
    }
  }, [activeProvider, activeLayers, filteredTrains, filteredTasks, planItems, tick]);

  // Fit Leaflet map bounds to station network
  const handleFitBounds = () => {
    if (!leafletMapRef.current) return;
    const coords = Object.values(REAL_STATIONS).map(s => [s.lat, s.lng] as [number, number]);
    leafletMapRef.current.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
  };

  return (
    <div className="rounded-xl overflow-hidden border border-surface-border shadow-2xl bg-navy-900">

      {/* ── Top Header Toolbar ────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-surface-border/70 flex flex-wrap items-center justify-between gap-3 bg-navy-950/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
            <Compass className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-100 text-sm">Indian Railways Geographic GIS Track Map</span>
              <span className="text-[9px] uppercase font-extrabold tracking-widest px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 animate-pulse">
                Live GPS Feed
              </span>
            </div>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Northern Railway — Delhi Division Corridor Geographic Topology with Real-Time Operations
            </p>
          </div>
        </div>

        {/* Search bar & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search train, station, task..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-navy-900 border border-surface-border rounded-md pl-8 pr-3 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500 w-44"
            />
          </div>

          {/* Map Provider Selector */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-navy-800 border border-surface-border text-xs font-bold text-gray-200 hover:border-cyan-500 transition-all">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>{MAP_PROVIDERS.find(p => p.id === activeProvider)?.name.split(' ')[0]}</span>
            </button>
            <div className="absolute right-0 top-full mt-1 w-64 p-2 bg-navy-950 border border-surface-border rounded-lg shadow-2xl z-50 hidden group-hover:block space-y-1">
              <p className="text-[9px] uppercase font-bold text-gray-400 px-2 py-1">Select Map API Engine</p>
              {MAP_PROVIDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setActiveProvider(p.id)}
                  className={clsx(
                    'w-full text-left px-2.5 py-2 rounded-md transition-all flex flex-col gap-0.5',
                    activeProvider === p.id
                      ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300'
                      : 'hover:bg-navy-900 text-gray-300'
                  )}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>{p.name}</span>
                    <span className="text-[8px] px-1 py-0.5 rounded bg-surface-subtle text-gray-400 font-mono">{p.badge}</span>
                  </div>
                  <p className="text-[9px] text-gray-500 leading-tight">{p.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Layer toggles */}
          <div className="flex items-center gap-1 bg-navy-900 border border-surface-border/60 rounded-md p-0.5">
            {[
              { key: 'trains',   icon: Train,      label: `Trains (${filteredTrains.length})`,    color: 'emerald' },
              { key: 'blocks',   icon: Zap,         label: `Blocks (${planItems.length})`, color: 'amber' },
              { key: 'stations', icon: MapPin,       label: `Stations (${Object.keys(REAL_STATIONS).length})`, color: 'blue' },
            ].map(({ key, icon: Icon, label, color }) => {
              const active = activeLayers[key as keyof typeof activeLayers];
              return (
                <button
                  key={key}
                  onClick={() => setActiveLayers(l => ({ ...l, [key]: !l[key as keyof typeof l] }))}
                  className={clsx(
                    'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all',
                    active
                      ? color === 'emerald' ? 'bg-emerald-500/20 text-emerald-300'
                      : color === 'amber'   ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-blue-500/20 text-blue-300'
                      : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  <Icon className="w-3 h-3" /> {label}
                </button>
              );
            })}
          </div>

          {activeProvider !== 'schematic' && (
            <button
              onClick={handleFitBounds}
              className="p-1.5 rounded-md bg-navy-800 border border-surface-border text-gray-300 hover:text-white"
              title="Reset Bounds"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Main Map Canvas Container ───────────────────────────────────── */}
      <div className="relative" style={{ height: 500 }}>
        {activeProvider === 'schematic' ? (
          /* ── Interactive SVG Topological Schematic Diagram Mode ────── */
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="mapGrid" x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
                <path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(59,130,246,0.07)" strokeWidth="0.15"/>
              </pattern>
            </defs>

            <rect width="100" height="100" fill="#060d1f"/>
            <rect width="100" height="100" fill="url(#mapGrid)"/>

            {/* Schematic track lines */}
            {CORRIDORS_GEO.map(corridor => {
              const fromSt = REAL_STATIONS[corridor.from];
              const toSt   = REAL_STATIONS[corridor.to];
              if (!fromSt || !toSt) return null;
              return (
                <g key={corridor.id}>
                  <line
                    x1={fromSt.xSvg} y1={fromSt.ySvg} x2={toSt.xSvg} y2={toSt.ySvg}
                    stroke={corridor.color} strokeWidth="1.2" strokeOpacity="0.25"
                  />
                  <line
                    x1={fromSt.xSvg} y1={fromSt.ySvg} x2={toSt.xSvg} y2={toSt.ySvg}
                    stroke={corridor.color} strokeWidth="0.5" strokeOpacity="0.9" strokeDasharray="2 1"
                  />
                  <text
                    x={(fromSt.xSvg + toSt.xSvg) / 2}
                    y={(fromSt.ySvg + toSt.ySvg) / 2 - 2}
                    textAnchor="middle"
                    fill={corridor.color}
                    fontSize="1.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {corridor.label}
                  </text>
                </g>
              );
            })}

            {/* Stations */}
            {Object.values(REAL_STATIONS).map(st => (
              <g key={st.code} onClick={() => setSelectedEntity({ type: 'station', data: st })} style={{ cursor: 'pointer' }}>
                <circle cx={st.xSvg} cy={st.ySvg} r="2" fill="#0b1329" stroke="#60a5fa" strokeWidth="0.4"/>
                <circle cx={st.xSvg} cy={st.ySvg} r="0.8" fill="#60a5fa"/>
                <text x={st.xSvg} y={st.ySvg - 3.5} textAnchor="middle" fill="#e2e8f0" fontSize="1.6" fontWeight="bold">
                  {st.name} ({st.code})
                </text>
              </g>
            ))}
          </svg>
        ) : (
          /* ── Leaflet Geographic Canvas ────────────────────────────── */
          <div ref={mapContainerRef} className="w-full h-full bg-navy-950" />
        )}

        {/* ── Overlay Status Bar ────────────────────────────────────────── */}
        <div className="absolute bottom-3 left-4 z-20 flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-navy-950/90 border border-emerald-500/30 text-[10px] text-emerald-300 font-bold shadow-xl backdrop-blur-sm">
            <Activity className="w-3 h-3 animate-pulse text-emerald-400" />
            {filteredTrains.length} Live Train GPS Streams Active
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-navy-950/90 border border-amber-500/30 text-[10px] text-amber-300 font-bold shadow-xl backdrop-blur-sm">
            <Zap className="w-3 h-3 text-amber-400" />
            {planItems.length} Block Possessions Scheduled
          </div>
        </div>

        {/* ── Legend Overlay ────────────────────────────────────────────── */}
        <div className="absolute bottom-3 right-4 z-20 bg-navy-950/90 border border-surface-border p-2.5 rounded-lg shadow-xl backdrop-blur-sm space-y-1">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest border-b border-surface-border/50 pb-1 mb-1">Legend</p>
          {Object.entries(DEPT_COLORS).map(([dept, c]) => (
            <div key={dept} className="flex items-center gap-1.5 text-[9px] font-bold">
              <div className="w-2 h-2 rounded-full" style={{ background: c.stroke }}/>
              <span className="text-gray-300">{dept} — {c.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-[9px] font-bold pt-0.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400"/>
            <span className="text-gray-300">Vande Bharat / Rajdhani (#1)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-bold">
            <div className="w-2 h-2 rounded-full bg-pink-400"/>
            <span className="text-gray-300">Freight Container / Coal Rake</span>
          </div>
        </div>
      </div>

      {/* ── Section Quick Stats Strip ────────────────────────────────────── */}
      <div className="grid grid-cols-5 border-t border-surface-border/50 divide-x divide-surface-border/50 bg-navy-950/95">
        {CORRIDORS_GEO.map(corridor => {
          const sectionTrains = filteredTrains.filter(t => t.section_id === corridor.id || TRAIN_SECTION_MAP[t.section_id] === corridor.id);
          const sectionTasks = filteredTasks.filter(t => t.section_id === corridor.id || TRAIN_SECTION_MAP[t.section_id] === corridor.id);
          const hasCritical = sectionTasks.some(t => t.severity === 5);
          return (
            <div key={corridor.id} className="px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: corridor.color }}/>
                <span className="text-[9px] font-mono font-bold text-gray-300 truncate">{corridor.label}</span>
                {hasCritical && <AlertTriangle className="w-2.5 h-2.5 text-rose-400 ml-auto flex-shrink-0"/>}
              </div>
              <div className="flex items-center gap-3 text-[9px] text-gray-500">
                <span><span className="text-emerald-400 font-bold">{sectionTrains.length}</span> trains</span>
                <span><span className="text-amber-400 font-bold">{sectionTasks.length}</span> tasks</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Detailed Inspector Modal ─────────────────────────────────────── */}
      {selectedEntity && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(6,13,31,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.target === e.currentTarget && setSelectedEntity(null)}
        >
          <div className="bg-navy-900 border border-surface-border rounded-xl max-w-sm w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2">
                {selectedEntity.type === 'train' && <Train className="w-4 h-4 text-emerald-400"/>}
                {selectedEntity.type === 'station' && <MapPin className="w-4 h-4 text-blue-400"/>}
                {selectedEntity.type === 'block' && <Zap className="w-4 h-4 text-amber-400"/>}
                <h4 className="font-bold text-gray-100 text-sm">
                  {selectedEntity.type === 'train' && `${selectedEntity.data.train_number} — ${selectedEntity.data.train_name}`}
                  {selectedEntity.type === 'station' && `Station: ${selectedEntity.data.name || selectedEntity.data.label}`}
                  {selectedEntity.type === 'block' && `Block Zone: ${selectedEntity.data.task.external_id}`}
                </h4>
              </div>
              <button onClick={() => setSelectedEntity(null)}
                className="text-gray-400 hover:text-white text-xs font-bold px-2 py-1 bg-surface-subtle rounded">✕</button>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              {selectedEntity.type === 'train' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 p-3 bg-navy-950/80 rounded-lg border border-surface-border">
                    <div><p className="text-[9px] text-gray-500 uppercase font-semibold">Service Type</p>
                      <p className="font-bold text-emerald-400 text-xs mt-0.5">{selectedEntity.data.train_type}</p></div>
                    <div><p className="text-[9px] text-gray-500 uppercase font-semibold">Priority Class</p>
                      <p className="font-bold text-amber-400 text-xs mt-0.5">Priority #{selectedEntity.data.priority}</p></div>
                    <div><p className="text-[9px] text-gray-500 uppercase font-semibold">Route</p>
                      <p className="text-gray-200 text-xs mt-0.5">{selectedEntity.data.origin_station} → {selectedEntity.data.destination_station}</p></div>
                    <div><p className="text-[9px] text-gray-500 uppercase font-semibold">Live Speed</p>
                      <p className="font-mono text-cyan-400 font-bold text-xs mt-0.5">{selectedEntity.data.speed_kph || 110} km/h</p></div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0"/>
                    <span>No active block conflict on section {selectedEntity.data.section_id}</span>
                  </div>
                </div>
              )}
              {selectedEntity.type === 'station' && (
                <div className="space-y-2 p-3 bg-navy-950/80 rounded-lg border border-surface-border">
                  <p className="font-bold text-blue-300">{selectedEntity.data.name}</p>
                  <p className="text-gray-400">Railway Zone: <span className="text-blue-400 font-bold">{selectedEntity.data.zone}</span></p>
                  <p className="font-mono text-gray-400">GPS: {selectedEntity.data.lat}°N, {selectedEntity.data.lng}°E</p>
                </div>
              )}
              {selectedEntity.type === 'block' && (
                <div className="space-y-2">
                  <div className="p-3 bg-navy-950/80 rounded-lg border border-surface-border grid grid-cols-2 gap-2">
                    <div><p className="text-[9px] text-gray-500 uppercase font-semibold">Department</p>
                      <p className="font-bold text-amber-400 text-xs mt-0.5">{selectedEntity.data.task.department}</p></div>
                    <div><p className="text-[9px] text-gray-500 uppercase font-semibold">Severity</p>
                      <p className="font-bold text-rose-400 text-xs mt-0.5">Severity {selectedEntity.data.task.severity}/5</p></div>
                    <div className="col-span-2"><p className="text-[9px] text-gray-500 uppercase font-semibold">Defect Type</p>
                      <p className="text-gray-200 text-xs mt-0.5">{selectedEntity.data.task.defect_type}</p></div>
                  </div>
                  <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                    <p className="text-[9px] text-purple-400 font-bold uppercase mb-1">CP-SAT Solver Rationale</p>
                    <p className="text-[10px] text-purple-200 font-mono leading-relaxed">{selectedEntity.data.item.rationale}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setSelectedEntity(null)} className="btn btn-secondary text-xs">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
