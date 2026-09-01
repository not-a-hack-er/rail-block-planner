import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Activity, CheckCircle2, XCircle, RefreshCw, Database, Server, Cpu, Loader2, Zap, Trash2, AlertTriangle } from 'lucide-react';
import { checkHealth } from '../api/health';
import { createTask } from '../api/tasks';
import { createWindow } from '../api/windows';
import { clearPlanHistory } from '../api/plans';
import { buildSeedTasks, buildSeedWindows } from '../demo/scenarios';
import { getApiErrorMessage } from '../api/client';
import { formatDateTime } from '../utils';
import { clsx } from '../utils/clsx';

export function SystemStatusPage() {
  const [seedLog, setSeedLog] = useState<string[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  const { data: health, isLoading: hLoading, error: hError, refetch: refetchHealth, dataUpdatedAt } = useQuery({
    queryKey: ['health'],
    queryFn: checkHealth,
    refetchInterval: 30_000,
    retry: 1,
  });

  const isBackendUp = health?.status === 'ok' && !hError;

  const handleSeedDemo = async () => {
    setIsSeeding(true);
    setSeedLog([]);
    setSeedError(null);

    const log = (msg: string) => setSeedLog(prev => [...prev, msg]);
    const today = new Date();

    try {
      const seedTasks = buildSeedTasks(today);
      log(`Seeding ${seedTasks.length} maintenance tasks…`);

      let created = 0;
      let skipped = 0;
      for (const task of seedTasks) {
        try {
          await createTask(task);
          created++;
          log(`✓ Created task: ${task.external_id}`);
        } catch (err: any) {
          const msg = getApiErrorMessage(err);
          if (msg.includes('already exists') || msg.includes('Conflict')) {
            skipped++;
            log(`→ Skipped (exists): ${task.external_id}`);
          } else {
            log(`✗ Failed: ${task.external_id} — ${msg}`);
          }
        }
      }

      const seedWindows = buildSeedWindows(today);
      log(`\nSeeding ${seedWindows.length} block windows…`);

      for (const window of seedWindows) {
        try {
          await createWindow(window);
          log(`✓ Created window: ${window.external_id} (${window.section_id})`);
        } catch (err: any) {
          const msg = getApiErrorMessage(err);
          if (msg.includes('already exists') || msg.includes('Conflict')) {
            log(`→ Skipped (exists): ${window.external_id}`);
          } else {
            log(`✗ Failed: ${window.external_id} — ${msg}`);
          }
        }
      }

      log(`\nSeed complete. ${created} tasks created, ${skipped} skipped.`);
      log('Go to Block Planner to run the optimizer.');
    } catch (err) {
      setSeedError(getApiErrorMessage(err));
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[900px]">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Activity size={20} className="text-rail-blue" />
          System Status
        </h1>
        <p className="page-subtitle mt-1">Backend health, data source, and demo environment controls.</p>
      </div>

      {/* Demo environment banner */}
      <div className="alert-warning">
        <AlertTriangle size={14} className="text-rail-amber mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-bold text-rail-amber">DEMO ENVIRONMENT — SYNTHETIC DATA</p>
          <p className="text-xs text-gray-400 mt-0.5">
            This system uses synthetic demo data. It does not connect to real Indian Railways operational systems (BDMS, COA, TMS, SMMS, TDMS).
            The AI optimizer provides decision-support recommendations only. Human officer approval is required before any operational use.
          </p>
        </div>
      </div>

      {/* System health */}
      <div className="card divide-y divide-surface-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-200">System Health</h3>
          <div className="flex items-center gap-2">
            {dataUpdatedAt > 0 && (
              <span className="text-[11px] text-gray-600">
                Last checked: {formatDateTime(new Date(dataUpdatedAt).toISOString())}
              </span>
            )}
            <button onClick={() => refetchHealth()} className="btn-icon" title="Refresh">
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        <StatusRow
          icon={Server}
          label="Backend API"
          sublabel="FastAPI (uvicorn) — http://localhost:8000"
          status={hLoading ? 'loading' : isBackendUp ? 'ok' : 'error'}
          detail={isBackendUp ? 'GET /health → 200 OK' : 'Cannot reach backend. Is uvicorn running?'}
        />
        <StatusRow
          icon={Database}
          label="Database"
          sublabel="SQLite (rail_planner.db)"
          status={isBackendUp ? 'ok' : 'unknown'}
          detail={isBackendUp ? 'Connected — SQLAlchemy ORM' : 'Unknown — backend unreachable'}
        />
        <StatusRow
          icon={Cpu}
          label="CP-SAT Optimizer"
          sublabel="OR-Tools CP-SAT (Google)"
          status={isBackendUp ? 'ok' : 'unknown'}
          detail={isBackendUp ? 'Ready — POST /plans/generate' : 'Unknown — backend unreachable'}
        />
        <StatusRow
          icon={Activity}
          label="Simulation Engine"
          sublabel="Frontend-only demo layer"
          status="demo"
          detail="No backend simulation endpoint. Uses synthetic demo scenarios."
        />
      </div>

      {/* API contracts */}
      <div className="card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-200">API Endpoints</h3>
        <div className="space-y-1.5 font-mono text-xs">
          {[
            { method: 'POST', path: '/auth/register', role: 'Public' },
            { method: 'POST', path: '/auth/login', role: 'Public' },
            { method: 'GET', path: '/tasks', role: 'Any role' },
            { method: 'POST', path: '/tasks', role: 'PLANNER / ADMIN' },
            { method: 'POST', path: '/windows', role: 'PLANNER / ADMIN' },
            { method: 'POST', path: '/plans/generate', role: 'PLANNER / ADMIN' },
            { method: 'GET', path: '/plans/{id}', role: 'Any role' },
            { method: 'POST', path: '/plans/{id}/approve', role: 'DEPT_APPROVER / SENIOR_DOM' },
            { method: 'POST', path: '/plans/{id}/publish', role: 'SENIOR_DOM / ADMIN' },
            { method: 'GET', path: '/health', role: 'Public' },
          ].map(({ method, path, role }) => (
            <div key={path} className="flex items-center gap-3">
              <span className={clsx(
                'w-12 text-center px-1 py-0.5 rounded text-[10px] font-semibold',
                method === 'GET' ? 'bg-rail-blue/15 text-rail-blue' : 'bg-rail-green/15 text-rail-green'
              )}>
                {method}
              </span>
              <span className="text-gray-300 flex-1">{path}</span>
              <span className="text-gray-600 text-[10px]">{role}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Seed demo data */}
      <div className="card p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <Zap size={14} className="text-rail-amber" />
              Seed Demo Data
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Creates 6 sample maintenance tasks and 4 block windows via the real API.
              Existing records are skipped. Use this to quickly populate a fresh database.
            </p>
          </div>
          <button
            onClick={handleSeedDemo}
            disabled={isSeeding || !isBackendUp}
            className="btn-warning text-xs gap-2"
          >
            {isSeeding ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            {isSeeding ? 'Seeding…' : 'Seed Demo Data'}
          </button>
        </div>

        {!isBackendUp && (
          <p className="text-xs text-rail-red flex items-center gap-1.5">
            <XCircle size={11} />
            Backend must be running to seed data.
          </p>
        )}

        {/* Seed log */}
        {seedLog.length > 0 && (
          <div className="bg-navy-900 rounded border border-surface-border p-3 max-h-52 overflow-y-auto font-mono text-[11px] space-y-0.5">
            {seedLog.map((line, i) => (
              <p key={i} className={clsx(
                line.startsWith('✓') ? 'text-rail-green' :
                line.startsWith('✗') ? 'text-rail-red' :
                line.startsWith('→') ? 'text-gray-500' :
                'text-gray-300'
              )}>
                {line}
              </p>
            ))}
          </div>
        )}

        {seedError && (
          <p className="text-xs text-rail-red">{seedError}</p>
        )}

        {/* Clear plan history */}
        <div className="pt-2 border-t border-surface-border">
          <button
            onClick={() => { clearPlanHistory(); alert('Plan history cleared from localStorage.'); }}
            className="btn-ghost text-xs text-gray-500 gap-2"
          >
            <Trash2 size={12} />
            Clear local plan history
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ icon: Icon, label, sublabel, status, detail }: {
  icon: React.ElementType;
  label: string;
  sublabel: string;
  status: 'ok' | 'error' | 'loading' | 'unknown' | 'demo';
  detail?: string;
}) {
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
      <div className="flex items-center gap-2 flex-shrink-0">
        {statusEl}
      </div>
    </div>
  );
}
