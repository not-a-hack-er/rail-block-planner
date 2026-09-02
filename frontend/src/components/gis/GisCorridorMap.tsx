import React, { useState, useEffect, useRef } from 'react';
import {
  Train, Zap, MapPin, Compass, AlertTriangle,
  CheckCircle2, Clock, Layers, Eye, EyeOff, Activity, ShieldCheck
} from 'lucide-react';
import type { StationResponse, TrainSchedule, MaintenanceTask, PlanItemResponse } from '../../types';
import { clsx } from '../../utils/clsx';

interface GisCorridorMapProps {
  stations?: StationResponse[];
  trains?: TrainSchedule[];
  tasks?: MaintenanceTask[];
  planItems?: PlanItemResponse[];
}

// ----- Hardcoded station layout positions (percentage of SVG canvas) -----
// Arranged to look like the actual NR Delhi-UP corridor geography:
//   NDLS (left) → GZB (center-left) → MTC (top) branching off to CNB → PRYJ (right)
const STATION_LAYOUT: Record<string, { x: number; y: number; label: string; code: string; zone: string }> = {
  NDLS: { x: 12, y: 45, label: 'New Delhi', code: 'NDLS', zone: 'NR' },
  GZB:  { x: 35, y: 45, label: 'Ghaziabad', code: 'GZB',  zone: 'NR' },
  MTC:  { x: 50, y: 20, label: 'Meerut City', code: 'MTC', zone: 'NR' },
  CNB:  { x: 65, y: 55, label: 'Kanpur Central', code: 'CNB', zone: 'NCR' },
  PRYJ: { x: 88, y: 62, label: 'Prayagraj Jn', code: 'PRYJ', zone: 'NCR' },
};

// Track corridors connecting stations
const CORRIDORS = [
  { id: 'NDLS-GZB-UP',  from: 'NDLS', to: 'GZB',  label: 'NDLS–GZB UP',  color: '#3b82f6', dashOffset: 0 },
  { id: 'GZB-NDLS-DN',  from: 'GZB',  to: 'NDLS', label: 'GZB–NDLS DN',  color: '#8b5cf6', dashOffset: -6 },
  { id: 'GZB-MTC-UP',   from: 'GZB',  to: 'MTC',  label: 'GZB–MTC UP',   color: '#10b981', dashOffset: 0 },
  { id: 'GZB-CNB-MAIN', from: 'GZB',  to: 'CNB',  label: 'GZB–CNB Main', color: '#f59e0b', dashOffset: 0 },
  { id: 'CNB-PRYJ-DN',  from: 'CNB',  to: 'PRYJ', label: 'CNB–PRYJ',     color: '#06b6d4', dashOffset: 0 },
];

// Train positions: lerp between from/to station positions
const TRAIN_SECTION_MAP: Record<string, string> = {
  'NDLS-GZB-UP': 'NDLS-GZB-UP',
  'GZB-NDLS-DN': 'GZB-NDLS-DN',
  'NDLS-MTC-UP': 'GZB-MTC-UP',
  'NDLS-GZB-DN': 'GZB-NDLS-DN',
};

const DEPT_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  ENGG: { fill: 'rgba(59,130,246,0.25)', stroke: '#3b82f6', label: 'Engineering' },
  TRD:  { fill: 'rgba(245,158,11,0.25)', stroke: '#f59e0b', label: 'Traction (TRD)' },
  ST:   { fill: 'rgba(139,92,246,0.25)', stroke: '#8b5cf6', label: 'Signal & Telecom' },
};

const TRAIN_COLORS: Record<string, string> = {
  PASSENGER_PREMIUM:  '#10b981',
  PASSENGER_EXPRESS:  '#06b6d4',
  PASSENGER_LOCAL:    '#64748b',
  FREIGHT_CONTAINER:  '#ec4899',
  FREIGHT_COAL:       '#f97316',
};

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export function GisCorridorMap({ stations = [], trains = [], tasks = [], planItems = [] }: GisCorridorMapProps) {
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; data: any } | null>(null);
  const [activeLayers, setActiveLayers] = useState({ trains: true, blocks: true, stations: true });
  const [tick, setTick] = useState(0);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate trains along tracks every 2s
  useEffect(() => {
    animRef.current = setInterval(() => setTick(t => t + 1), 2000);
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, []);

  // Compute train position on track (animated lerp offset)
  const getTrainPos = (train: TrainSchedule, index: number) => {
    const sectionId = train.section_id;
    const corridor = CORRIDORS.find(c => c.id === sectionId) ||
                     CORRIDORS.find(c => c.id === TRAIN_SECTION_MAP[sectionId]) ||
                     CORRIDORS[index % CORRIDORS.length];
    const fromSt = STATION_LAYOUT[corridor.from];
    const toSt   = STATION_LAYOUT[corridor.to];
    if (!fromSt || !toSt) return { x: 50, y: 50, color: '#10b981', corridor };

    // Spread multiple trains on the same corridor
    const trainsOnCorridor = trains.filter((t, i) => {
      const c = CORRIDORS.find(c2 => c2.id === t.section_id) ||
                CORRIDORS.find(c2 => c2.id === TRAIN_SECTION_MAP[t.section_id]) ||
                CORRIDORS[i % CORRIDORS.length];
      return c.id === corridor.id;
    });
    const posInCorridor = trainsOnCorridor.findIndex(t => t.id === train.id);
    const baseT = ((tick * 0.08 + posInCorridor * 0.2) % 0.85) + 0.07;

    const color = TRAIN_COLORS[train.train_type] || '#10b981';
    return {
      x: lerp(fromSt.x, toSt.x, baseT),
      y: lerp(fromSt.y, toSt.y, baseT) + (posInCorridor % 2 === 0 ? -1.5 : 1.5),
      color,
      corridor,
    };
  };

  // Place maintenance block zones midway along their corridor
  const getBlockPos = (task: MaintenanceTask, index: number) => {
    const sectionId = task.section_id;
    const corridor = CORRIDORS.find(c => c.id === sectionId) ||
                     CORRIDORS.find(c => c.id === TRAIN_SECTION_MAP[sectionId]) ||
                     CORRIDORS[index % CORRIDORS.length];
    const fromSt = STATION_LAYOUT[corridor.from];
    const toSt   = STATION_LAYOUT[corridor.to];
    if (!fromSt || !toSt) return { x: 50, y: 50 };

    const tasksOnSection = tasks.filter(t => t.section_id === sectionId);
    const pos = tasksOnSection.findIndex(t => t.id === task.id);
    const t = 0.35 + pos * 0.12;

    return {
      x: lerp(fromSt.x, toSt.x, t),
      y: lerp(fromSt.y, toSt.y, t) + (pos % 2 === 0 ? 4 : -4),
    };
  };

  return (
    <div className="rounded-xl overflow-hidden border border-surface-border shadow-2xl" style={{ background: 'linear-gradient(135deg, #060d1f 0%, #0b1329 60%, #0d1833 100%)' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-surface-border/70 flex flex-wrap items-center justify-between gap-3"
           style={{ background: 'rgba(11,19,41,0.9)', backdropFilter: 'blur(8px)' }}>
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
              Northern Railway — Delhi Division Corridor Track Topology with Live Operations
            </p>
          </div>
        </div>

        {/* Layer toggles */}
        <div className="flex items-center gap-2">
          {[
            { key: 'trains',   icon: Train,      label: `Trains (${trains.length})`,        color: 'emerald' },
            { key: 'blocks',   icon: Zap,         label: `Blocks (${planItems.length})`,     color: 'amber' },
            { key: 'stations', icon: MapPin,       label: `Stations (${Object.keys(STATION_LAYOUT).length})`, color: 'blue' },
          ].map(({ key, icon: Icon, label, color }) => {
            const active = activeLayers[key as keyof typeof activeLayers];
            return (
              <button
                key={key}
                onClick={() => setActiveLayers(l => ({ ...l, [key]: !l[key as keyof typeof l] }))}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-bold transition-all',
                  active
                    ? color === 'emerald' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                    : color === 'amber'   ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                    : 'bg-blue-500/15 text-blue-300 border-blue-500/35'
                    : 'bg-navy-900/50 text-gray-500 border-surface-border/40'
                )}
              >
                <Icon className="w-3 h-3" /> {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main SVG Map Canvas ─────────────────────────────────────────── */}
      <div className="relative" style={{ height: 480 }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            {/* Grid pattern */}
            <pattern id="mapGrid" x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
              <path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(59,130,246,0.07)" strokeWidth="0.15"/>
            </pattern>
            {/* Glow filters */}
            <filter id="trainGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="stationGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="0.8" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            {/* Track gradient */}
            <linearGradient id="trackUp" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.9"/>
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.9"/>
            </linearGradient>
          </defs>

          {/* Background grid */}
          <rect width="100" height="100" fill="url(#mapGrid)"/>

          {/* Subtle vignette */}
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="transparent"/>
            <stop offset="100%" stopColor="rgba(6,13,31,0.5)"/>
          </radialGradient>
          <rect width="100" height="100" fill="url(#vignette)"/>

          {/* ── Track Corridor Lines ─────────────────────────────────── */}
          {CORRIDORS.map(corridor => {
            const fromSt = STATION_LAYOUT[corridor.from];
            const toSt   = STATION_LAYOUT[corridor.to];
            if (!fromSt || !toSt) return null;
            return (
              <g key={corridor.id}>
                {/* Track glow */}
                <line
                  x1={fromSt.x} y1={fromSt.y} x2={toSt.x} y2={toSt.y}
                  stroke={corridor.color} strokeWidth="1.4" strokeOpacity="0.25"
                  strokeLinecap="round"
                />
                {/* Main track */}
                <line
                  x1={fromSt.x} y1={fromSt.y} x2={toSt.x} y2={toSt.y}
                  stroke={corridor.color} strokeWidth="0.55" strokeOpacity="0.9"
                  strokeDasharray="2.5 1.2" strokeLinecap="round"
                />
                {/* Corridor label at midpoint */}
                <text
                  x={(fromSt.x + toSt.x) / 2}
                  y={(fromSt.y + toSt.y) / 2 - 2.5}
                  textAnchor="middle"
                  fill={corridor.color}
                  fontSize="1.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  opacity="0.7"
                >
                  {corridor.label}
                </text>
              </g>
            );
          })}

          {/* ── Maintenance Block Possession Zones ──────────────────── */}
          {activeLayers.blocks && planItems.map((item, idx) => {
            const task = tasks.find(t => t.id === item.task_id);
            if (!task) return null;
            const pos = getBlockPos(task, idx);
            const dept = DEPT_COLORS[task.department] || DEPT_COLORS.ENGG;
            return (
              <g
                key={item.task_id}
                onClick={() => setSelectedEntity({ type: 'block', data: { task, item } })}
                style={{ cursor: 'pointer' }}
              >
                {/* Pulsing zone circle */}
                <circle cx={pos.x} cy={pos.y} r="3.5" fill={dept.fill} stroke={dept.stroke} strokeWidth="0.35">
                  <animate attributeName="r" values="3.5;4.5;3.5" dur="2s" repeatCount="indefinite"/>
                  <animate attributeName="stroke-opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite"/>
                </circle>
                <circle cx={pos.x} cy={pos.y} r="1.2" fill={dept.stroke}/>
                {/* Block label */}
                <rect x={pos.x - 4} y={pos.y + 4.5} width="8" height="3" rx="0.6"
                  fill="rgba(11,19,41,0.85)" stroke={dept.stroke} strokeWidth="0.2"/>
                <text x={pos.x} y={pos.y + 6.3} textAnchor="middle" fill={dept.stroke}
                  fontSize="1.4" fontFamily="monospace" fontWeight="bold">
                  {task.external_id}
                </text>
              </g>
            );
          })}

          {/* ── Live Train GPS Markers ───────────────────────────────── */}
          {activeLayers.trains && trains.map((train, idx) => {
            const pos = getTrainPos(train, idx);
            const isPremium = train.train_type === 'PASSENGER_PREMIUM';
            const isFreight = train.train_type.startsWith('FREIGHT');
            return (
              <g
                key={train.id}
                onClick={() => setSelectedEntity({ type: 'train', data: train })}
                style={{ cursor: 'pointer' }}
                filter="url(#trainGlow)"
              >
                {/* Speed trail */}
                <circle cx={pos.x - 1.2} cy={pos.y} r={isPremium ? 1.0 : 0.7}
                  fill={pos.color} opacity="0.2"/>
                <circle cx={pos.x - 2.2} cy={pos.y} r={isPremium ? 0.6 : 0.3}
                  fill={pos.color} opacity="0.08"/>
                {/* Main marker */}
                <circle cx={pos.x} cy={pos.y} r={isPremium ? 1.8 : isFreight ? 1.4 : 1.6}
                  fill={`${pos.color}30`} stroke={pos.color} strokeWidth="0.3"/>
                <circle cx={pos.x} cy={pos.y} r={isPremium ? 0.9 : 0.7} fill={pos.color}/>
                {/* Train label */}
                <rect x={pos.x - 5} y={pos.y + 2.2} width="10" height="3.2" rx="0.7"
                  fill="rgba(11,19,41,0.9)" stroke={pos.color} strokeWidth="0.2"/>
                <text x={pos.x} y={pos.y + 4.2} textAnchor="middle" fill={pos.color}
                  fontSize="1.4" fontFamily="monospace" fontWeight="bold">
                  🚆 {train.train_number}
                </text>
              </g>
            );
          })}

          {/* ── Station Node Waypoints ───────────────────────────────── */}
          {activeLayers.stations && Object.values(STATION_LAYOUT).map(st => (
            <g
              key={st.code}
              onClick={() => {
                const found = stations.find(s => s.code === st.code);
                setSelectedEntity({ type: 'station', data: found || st });
              }}
              style={{ cursor: 'pointer' }}
              filter="url(#stationGlow)"
            >
              {/* Outer ring */}
              <circle cx={st.x} cy={st.y} r="3.2"
                fill="rgba(59,130,246,0.12)" stroke="#3b82f6" strokeWidth="0.35" strokeDasharray="1 0.8"/>
              {/* Inner dot */}
              <circle cx={st.x} cy={st.y} r="1.5" fill="#0b1329" stroke="#60a5fa" strokeWidth="0.4"/>
              <circle cx={st.x} cy={st.y} r="0.7" fill="#60a5fa"/>
              {/* Station name — positioned to avoid overlap */}
              <rect
                x={st.x - (st.label.length * 0.75)}
                y={st.y - 6.5}
                width={st.label.length * 1.5 + 2}
                height="3.5"
                rx="0.7"
                fill="rgba(11,19,41,0.88)"
                stroke="rgba(96,165,250,0.4)"
                strokeWidth="0.2"
              />
              <text
                x={st.x - (st.label.length * 0.75) + (st.label.length * 1.5 + 2) / 2}
                y={st.y - 4.3}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="1.7"
                fontFamily="sans-serif"
                fontWeight="bold"
              >
                {st.label}
              </text>
              <text x={st.x} y={st.y + 5.2} textAnchor="middle"
                fill="#60a5fa" fontSize="1.3" fontFamily="monospace" fontWeight="bold">
                {st.code}
              </text>
            </g>
          ))}
        </svg>

        {/* ── Live status bar overlaid bottom-left ─────────────────── */}
        <div className="absolute bottom-3 left-4 flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-navy-950/90 border border-emerald-500/30 text-[10px] text-emerald-300 font-bold">
            <Activity className="w-3 h-3 animate-pulse" />
            {trains.length} Live Train GPS Feeds Active
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-navy-950/90 border border-amber-500/30 text-[10px] text-amber-300 font-bold">
            <Zap className="w-3 h-3" />
            {planItems.length} Block Possessions Scheduled
          </div>
        </div>

        {/* ── Zone legend ───────────────────────────────────────────── */}
        <div className="absolute bottom-3 right-4 flex flex-col gap-1">
          {Object.entries(DEPT_COLORS).map(([dept, c]) => (
            <div key={dept} className="flex items-center gap-1.5 text-[9px] font-bold">
              <div className="w-2 h-2 rounded-full" style={{ background: c.stroke }}/>
              <span className="text-gray-400">{dept} — {c.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-[9px] font-bold mt-0.5 border-t border-surface-border/40 pt-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400"/>
            <span className="text-gray-400">Vande Bharat / Rajdhani (Priority 1)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-bold">
            <div className="w-2 h-2 rounded-full bg-pink-400"/>
            <span className="text-gray-400">Freight Rakes</span>
          </div>
        </div>
      </div>

      {/* ── Corridor Stats Strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-5 border-t border-surface-border/50 divide-x divide-surface-border/50"
           style={{ background: 'rgba(11,19,41,0.95)' }}>
        {CORRIDORS.map(corridor => {
          const sectionTrains = trains.filter(t => t.section_id === corridor.id ||
            TRAIN_SECTION_MAP[t.section_id] === corridor.id);
          const sectionTasks = tasks.filter(t => t.section_id === corridor.id ||
            TRAIN_SECTION_MAP[t.section_id] === corridor.id);
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

      {/* ── Inspector Modal ───────────────────────────────────────────────── */}
      {selectedEntity && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(6,13,31,0.75)', backdropFilter: 'blur(6px)' }}
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
                  <p className="font-bold text-blue-300">{selectedEntity.data.name || selectedEntity.data.label}</p>
                  <p className="text-gray-400">Railway Zone: <span className="text-blue-400 font-bold">{selectedEntity.data.zone}</span></p>
                  {selectedEntity.data.lat && (
                    <p className="font-mono text-gray-400">GPS: {selectedEntity.data.lat.toFixed(4)}°N, {selectedEntity.data.lng.toFixed(4)}°E</p>
                  )}
                  <p className="text-gray-400">Active Section Trains: <span className="text-emerald-400 font-bold">
                    {trains.filter(t => t.origin_station === selectedEntity.data.code || t.destination_station === selectedEntity.data.code).length}
                  </span></p>
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
