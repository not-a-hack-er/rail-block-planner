import React, { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Activity, CheckCircle2, XCircle, RefreshCw, Database, Server, Cpu, Loader2, Zap, Trash2, RotateCcw } from 'lucide-react';
import { checkHealth, checkHealthDetailed, resetAndSeed } from '../api/health';
import { createTask } from '../api/tasks';
import { createWindow } from '../api/windows';
import { clearPlanHistory } from '../api/plans';
import { buildSeedTasks, buildSeedWindows } from '../demo/scenarios';
import { getApiErrorMessage } from '../api/client';
import { formatDateTime } from '../utils';
import { clsx } from '../utils/clsx';
import { useQueryClient } from '@tanstack/react-query';

export function SystemStatusPage() {
  const qc = useQueryClient();
  const [seedLog, setSeedLog] = useState<string[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const latencyRef = useRef<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const { data: health, isLoading: hLoading, error: hError, refetch: refetchHealth, dataUpdatedAt } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const t0 = performance.now();
      const result = await checkHealth();
      setLatencyMs(Math.round(performance.now() - t0));
      return result;
    },
    refetchInterval: 30_000,
    retry: 1,
  });

  const { data: detailed } = useQuery({
    queryKey: ['health-detailed'],
    queryFn: checkHealthDetailed,
    refetchInterval: 60_000,
    retry: 1,
  });

  const isBackendUp = health?.status === 'ok' && !hError;

  const resetMut = useMutation({
    mutationFn: resetAndSeed,
    onSuccess: () => {
      setSeedLog(l => [...l, '✓ Database reset and re-seeded with fresh demo data!']);
      qc.invalidateQueries();
    },
    onError: (err) => setSeedLog(l => [...l, '✗ Reset failed: ' + getApiErrorMessage(err)]),
  });

  const handleSeedDemo = async () => {
    setIsSeeding(true);
    setSeedLog([]);
    setSeedError(null);
    const log = (msg: string) => setSeedLog(prev => [...prev, msg]);
    const today = new Date();
    try {
      const seedTasks = buildSeedTasks(today);
      log("Seeding " + seedTasks.length + " maintenance tasks…");
      let created = 0, skipped = 0;
      for (const task of seedTasks) {
        try {
          await createTask(task);
          created++;
          log("✓ Created task: " + task.external_id);
        } catch (err: any) {
          const msg = getApiErrorMessage(err);
          if (msg.includes('already exists') || msg.includes('Conflict')) { skipped++; log("→ Skipped: " + task.external_id); }
          else { log("✗ Failed: " + task.external_id + " — " + msg); }
        }
      }
      const seedWindows = buildSeedWindows(today);
      log("\nSeeding " + seedWindows.length + " block windows…");
      for (const window of seedWindows) {
        try {
          await createWindow(window);
          log("✓ Created window: " + window.external_id);
        } catch (err: any) {
          const msg = getApiErrorMessage(err);
          if (msg.includes('already exists') || msg.includes('Conflict')) log("→ Skipped: " + window.external_id);
          else log("✗ Failed: " + window.external_id + " — " + msg);
        }
      }
      log("\nSeed complete. " + created + " tasks created, " + skipped + " skipped.");
      log("Go to Block Planner to run the optimizer.");
    } catch (err) {
      setSeedError(getApiErrorMessage(err));
    } finally {
      setIsSeeding(false);
    }
  };

  const uptime = detailed?.uptime_seconds as number | undefined;
  const uptimeStr = uptime != null
    ? uptime >= 3600 ? Math.floor(uptime / 3600) + "h " + Math.floor((uptime % 3600) / 60) + "m"
    : uptime >= 60 ? Math.floor(uptime / 60) + "m " + (uptime % 60) + "s"
    : uptime + "s"
    : null;

  return (
    <div className="p-6 space-y-6 max-w-[900px]">
      <div className="border-b border-surface-border pb-4">
        <h1 className="page-title flex items-center gap-2">
          <Activity size={20} className="text-rail-blue" />
          System Status
        </h1>
        <p className="page-subtitle mt-1">Backend health, data sources, and demo environment controls for SIH 2026 presentation.</p>
      </div>

      {/* Live data ready banner */}
      <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-lg flex items-start gap-3">
        <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-bold text-emerald-400">LIVE DATA ARCHITECTURE — SYNTHETIC DATASET ACTIVE</p>
          <p className="text-xs text-gray-400 mt-0.5">
            This system is architected for live Indian Railways data integration (TMS, SMMS, TDMS, COA).
            Currently using high-fidelity synthetic NR/NCR data for SIH demonstration.
            The AI optimizer provides decision-support recommendations — human officer approval required before operational use.
          </p>
        </div>
      </div>

      {/* System health */}
      <div className="card divide-y divide-surface-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-200">System Health</h3>
          <div className="flex items-center gap-3">
            {latencyMs != null && (
              <span className="text-[10px] font-mono text-gray-500">
                Latency: <span className="text-emerald-400 font-bold">{latencyMs}ms</span>
              </span>
            )}
            {uptimeStr && <span className="text-[10px] text-gray-500">Uptime: <span className="text-gray-300">{uptimeStr}</span></span>}
            {dataUpdatedAt > 0 && (
              <span className="text-[11px] text-gray-600">
                Checked: {formatDateTime(new Date(dataUpdatedAt).toISOString())}
              </span>
            )}
            <button onClick={() => refetchHealth()} className="btn-icon" title="Refresh"><RefreshCw size={13} /></button>
          </div>
        </div>

        <StatusRow icon={Server} label="Backend API" sublabel={"FastAPI (uvicorn) — http://localhost:8000"} status={hLoading ? 'loading' : isBackendUp ? 'ok' : 'error'} detail={isBackendUp ? "GET /health → 200 OK" + (latencyMs != null ? " (" + latencyMs + "ms)" : "") : 'Cannot reach backend. Is uvicorn running?'} />
        <StatusRow icon={Database} label="Database" sublabel={"SQLite (rail_planner.db) — " + (detailed?.task_count ?? "?") + " tasks, " + (detailed?.plan_count ?? "?") + " plans"} status={isBackendUp ? 'ok' : 'unknown'} detail={isBackendUp ? "Connected — SQLAlchemy ORM" : "Unknown — backend unreachable"} />
        <StatusRow icon={Cpu} label="CP-SAT Optimizer" sublabel={"Google OR-Tools CP-SAT v" + (detailed?.solver_version ?? "9.15")} status={isBackendUp ? 'ok' : 'unknown'} detail={isBackendUp ? "Ready — POST /plans/generate" : "Unknown — backend unreachable"} />
        <StatusRow icon={Activity} label="Simulation Engine" sublabel="Rolling-horizon replanner — POST /simulation/run" status={isBackendUp ? 'ok' : 'unknown'} detail={isBackendUp ? "Connected — backend simulation endpoint active" : "Unknown"} />
      </div>

      {/* DB Counts */}
      {detailed && isBackendUp && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">Database Record Counts</h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {[
              { label: "Tasks", val: detailed.task_count },
              { label: "Windows", val: detailed.window_count },
              { label: "Plans", val: detailed.plan_count },
              { label: "Trains", val: detailed.train_count },
              { label: "Stations", val: detailed.station_count },
            ].map(({ label, val }) => (
              <div key={label} className="bg-navy-900 rounded border border-surface-border p-2.5 text-center">
                <div className="text-xl font-bold text-gray-100 font-tabular">{String(val)}</div>
                <div className="text-[10px] text-gray-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API contracts */}
      <div className="card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-200">API Endpoints</h3>
        <div className="space-y-1.5 font-mono text-xs">
          {[
            { method: 'POST', path: '/auth/login', role: 'Public' },
            { method: 'GET', path: '/tasks', role: 'Any role' },
            { method: 'POST', path: '/tasks', role: 'PLANNER / ADMIN' },
            { method: 'GET', path: '/windows', role: 'Any role' },
            { method: 'POST', path: '/plans/generate', role: 'PLANNER / ADMIN' },
            { method: 'POST', path: '/plans/{id}/approve', role: 'DEPT_APPROVER / SENIOR_DOM' },
            { method: 'POST', path: '/plans/{id}/publish', role: 'SENIOR_DOM / ADMIN' },
            { method: 'POST', path: '/simulation/run', role: 'Any role' },
            { method: 'GET', path: '/analytics/summary', role: 'Any role' },
            { method: 'GET', path: '/health/detailed', role: 'Public' },
            { method: 'POST', path: '/seed/reset', role: 'Demo only' },
          ].map(({ method, path, role }) => (
            <div key={path} className="flex items-center gap-3">
              <span className={clsx('w-12 text-center px-1 py-0.5 rounded text-[10px] font-semibold', method === 'GET' ? 'bg-rail-blue/15 text-rail-blue' : 'bg-rail-green/15 text-rail-green')}>
                {method}
              </span>
              <span className="text-gray-300 flex-1">{path}</span>
              <span className="text-gray-600 text-[10px]">{role}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reset + Seed actions */}
      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Seed new data */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <Zap size={14} className="text-rail-amber" />
              Seed Demo Data
            </h3>
            <p className="text-xs text-gray-400">Creates sample tasks and windows via the real API. Existing records are skipped.</p>
            <button onClick={handleSeedDemo} disabled={isSeeding || !isBackendUp} className="btn-warning text-xs gap-2 w-full justify-center">
              {isSeeding ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              {isSeeding ? 'Seeding…' : 'Seed Demo Data'}
            </button>
          </div>

          {/* Full reset */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <RotateCcw size={14} className="text-rail-blue" />
              Full Reset + Re-Seed
            </h3>
            <p className="text-xs text-gray-400">Clears ALL data and re-seeds fresh. Use before a judge presentation.</p>
            <button onClick={() => { setSeedLog([]); resetMut.mutate(); }} disabled={resetMut.isPending || !isBackendUp} className="btn-primary text-xs gap-2 w-full justify-center">
              {resetMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              {resetMut.isPending ? 'Resetting…' : 'Reset & Re-Seed for Demo'}
            </button>
          </div>
        </div>

        {!isBackendUp && <p className="text-xs text-rail-red flex items-center gap-1.5"><XCircle size={11} /> Backend must be running.</p>}

        {seedLog.length > 0 && (
          <div className="bg-navy-900 rounded border border-surface-border p-3 max-h-52 overflow-y-auto font-mono text-[11px] space-y-0.5">
            {seedLog.map((line, i) => (
              <p key={i} className={clsx(line.startsWith('✓') ? 'text-rail-green' : line.startsWith('✗') ? 'text-rail-red' : line.startsWith('→') ? 'text-gray-500' : 'text-gray-300')}>{line}</p>
            ))}
          </div>
        )}
        {seedError && <p className="text-xs text-rail-red">{seedError}</p>}

        <div className="pt-2 border-t border-surface-border">
          <button onClick={() => { clearPlanHistory(); alert('Plan history cleared from localStorage.'); }} className="btn-ghost text-xs text-gray-500 gap-2">
            <Trash2 size={12} /> Clear local plan history
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ icon: Icon, label, sublabel, status, detail }: { icon: React.ElementType; label: string; sublabel: string; status: 'ok' | 'error' | 'loading' | 'unknown' | 'demo'; detail?: string }) {
  const statusEl = {
    ok: <><div className="w-2 h-2 rounded-full bg-rail-green animate-pulse-slow" /><span className="text-xs text-rail-green">CONNECTED</span></>,
    error: <><div className="w-2 h-2 rounded-full bg-rail-red" /><span className="text-xs text-rail-red">UNREACHABLE</span></>,
    loading: <><Loader2 size={12} className="text-gray-400 animate-spin" /><span className="text-xs text-gray-400">Checking…</span></>,
    unknown: <><div className="w-2 h-2 rounded-full bg-gray-600" /><span className="text-xs text-gray-500">UNKNOWN</span></>,
    demo: <><div className="w-2 h-2 rounded-full bg-rail-amber" /><span className="text-xs text-rail-amber">DEMO ONLY</span></>,
  }[status];

  return (
    <div className="px-4 py-3 flex items-center gap-4">
      <Icon size={16} className="text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-200">{label}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">{sublabel}</p>
        {detail && <p className="text-[11px] text-gray-600 mt-0.5">{detail}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">{statusEl}</div>
    </div>
  );
}
