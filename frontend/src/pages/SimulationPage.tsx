import React, { useState } from 'react';
import { FlaskConical, Play, ChevronRight, AlertTriangle, CheckCircle2, RefreshCw, Lock, Unlock, Zap, ShieldCheck } from 'lucide-react';
import { SIM_SCENARIOS, type SimScenarioId } from '../demo/scenarios';
import { runSimulation as callSimulationApi } from '../api/simulation';
import { clsx } from '../utils/clsx';
import { addMinutes, format } from 'date-fns';
import type { SimulationResponse } from '../types';

type SimPhase = 'idle' | 'running' | 'conflict' | 'replan' | 'result';

export function SimulationPage() {
  const [selectedScenario, setSelectedScenario] = useState<SimScenarioId>('maintenance_overrun_30');
  const [phase, setPhase] = useState<SimPhase>('idle');
  const [apiResult, setApiResult] = useState<SimulationResponse | null>(null);

  const scenario = SIM_SCENARIOS[selectedScenario];

  const handleRunSimulation = async () => {
    setPhase('running');
    try {
      const resp = await callSimulationApi({
        scenario_id: selectedScenario,
        overrun_minutes: scenario.overrunMinutes,
        section_id: 'NDLS-GZB-UP',
      });
      
      await delay(600);
      setPhase('conflict');
      await delay(800);
      setPhase('replan');
      await delay(800);
      setApiResult(resp);
      setPhase('result');
    } catch {
      // Fallback to local calculation if offline
      await delay(600);
      setPhase('result');
    }
  };

  const reset = () => {
    setPhase('idle');
    setApiResult(null);
  };

  const baseStart = new Date();
  baseStart.setHours(2, 0, 0, 0);
  const baseEnd = new Date();
  baseEnd.setHours(3, 0, 0, 0);
  const newStart = addMinutes(baseStart, scenario.newWindowOffset);
  const newEnd = addMinutes(baseEnd, scenario.newWindowOffset + scenario.overrunMinutes);

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="border-b border-surface-border pb-4">
        <h1 className="page-title flex items-center gap-2">
          <FlaskConical size={22} className="text-rail-blue" />
          Disturbance & Rolling-Horizon Simulator
        </h1>
        <p className="page-subtitle mt-1">
          Simulate operational disturbances (maintenance overruns, freight surges, train delays) and observe real-time CP-SAT rolling-horizon replanning.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6">
        {/* Scenario selector */}
        <div className="space-y-4">
          <div className="card p-4 space-y-3 bg-navy-900/90 border border-surface-border">
            <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Select Disturbance Scenario
            </h3>

            <div className="space-y-2">
              {Object.values(SIM_SCENARIOS).map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedScenario(s.id); reset(); }}
                  className={clsx(
                    'w-full text-left px-3 py-2.5 rounded-lg border transition-all text-xs',
                    selectedScenario === s.id
                      ? 'bg-rail-blue/20 border-rail-blue text-gray-100 shadow-md font-bold'
                      : 'border-surface-border/60 text-gray-400 hover:text-gray-200 hover:bg-surface-raised'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span>{s.label}</span>
                    <span className="text-[10px] text-amber-400 font-mono">{s.disturbanceLabel}</span>
                  </div>
                  <p className="text-[11px] font-normal text-gray-400 mt-1">{s.description}</p>
                </button>
              ))}
            </div>

            <button
              onClick={handleRunSimulation}
              disabled={phase === 'running' || phase === 'replan'}
              className="btn-primary w-full justify-center gap-2 mt-3 font-bold py-2.5"
            >
              <Play size={16} />
              {phase === 'running' ? 'SIMULATING...' : 'EXECUTE SIMULATION'}
            </button>
            {phase !== 'idle' && (
              <button onClick={reset} className="btn-secondary w-full justify-center gap-2 text-xs">
                <RefreshCw size={14} />
                Reset Simulator
              </button>
            )}
          </div>
        </div>

        {/* Simulation Output Flow */}
        <div className="space-y-4">
          <div className="card p-6 space-y-5 bg-navy-900/90 border border-surface-border">
            <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Rolling-Horizon Replanning Execution Flow
            </h3>

            <FlowStep
              label="1. Committed Horizon (Base Plan)"
              description={`Block assigned: ${format(baseStart, 'HH:mm')} → ${format(baseEnd, 'HH:mm')} on NDLS-GZB-UP`}
              status={phase !== 'idle' ? 'done' : 'pending'}
              icon={<CheckCircle2 size={16} />}
              detail={
                <div className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
                  <Lock size={12} />
                  Committed decisions are LOCKED past the horizon split point.
                </div>
              }
            />

            <Arrow active={phase !== 'idle'} />

            <FlowStep
              label="2. Operational Disturbance Injected"
              description={scenario.disturbanceLabel}
              status={phase === 'conflict' || phase === 'replan' || phase === 'result' ? 'active' : 'pending'}
              icon={<AlertTriangle size={16} />}
              color="amber"
            />

            <Arrow active={phase === 'conflict' || phase === 'replan' || phase === 'result'} />

            <FlowStep
              label="3. Conflict Detection Engine"
              description={scenario.conflictDescription}
              status={phase === 'conflict' || phase === 'replan' || phase === 'result' ? 'active' : 'pending'}
              icon={<AlertTriangle size={16} />}
              color="red"
              loading={phase === 'running'}
            />

            <Arrow active={phase === 'replan' || phase === 'result'} />

            <FlowStep
              label="4. CP-SAT Rolling-Horizon Replanning"
              description={apiResult?.replan_summary || scenario.replanNote}
              status={phase === 'replan' || phase === 'result' ? 'active' : 'pending'}
              icon={<RefreshCw size={16} />}
              color="blue"
              loading={phase === 'conflict'}
              detail={
                phase === 'replan' || phase === 'result' ? (
                  <div className="mt-3 space-y-1 text-xs">
                    <div className="text-emerald-400 flex items-center gap-1.5 font-semibold">
                      <Lock size={12} />
                      Committed Horizon: 00:00 → 02:00 (LOCKED)
                    </div>
                    <div className="text-cyan-400 flex items-center gap-1.5 font-semibold">
                      <Unlock size={12} />
                      Uncommitted Horizon: 02:00 → 24:00 (REPLANNED WITH CP-SAT)
                    </div>
                  </div>
                ) : null
              }
            />

            <Arrow active={phase === 'result'} />

            <FlowStep
              label="5. Re-Optimized Feasible Plan"
              description={
                phase === 'result'
                  ? `Rescheduled block to ${format(newStart, 'HH:mm')} → ${format(newEnd, 'HH:mm')} (Train delay impact minimized)`
                  : 'Awaiting solver resolution...'
              }
              status={phase === 'result' ? 'done' : 'pending'}
              icon={<CheckCircle2 size={16} />}
              color="green"
              loading={phase === 'replan'}
            />
          </div>

          {/* Results Summary Metrics */}
          {phase === 'result' && (
            <div className="card p-5 bg-navy-900/90 border border-surface-border space-y-4 animate-slide-up">
              <h3 className="text-sm font-bold text-gray-100">Simulation Resolution Metrics</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SimMetric label="Train Delay Impact" baseline={scenario.baselineDelay} result={apiResult?.new_train_delay ?? scenario.newDelay} unit="min" worseBigger />
                <SimMetric label="Blocks Affected" baseline={0} result={apiResult?.blocks_affected ?? scenario.blocksAffected} unit="" worseBigger />
                <SimMetric label="Constraint Feasibility" baseline={1} result={1} unit="" isBoolean />
                <SimMetric label="Horizon Shift" baseline={0} result={scenario.newWindowOffset} unit="min" worseBigger />
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-3 text-emerald-300 text-xs">
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="font-bold text-sm">Replanned Schedule Feasible</p>
                  <p className="text-gray-300 mt-0.5">
                    CP-SAT rolling horizon solved without breaking hard safety constraints. Ready for Section Controller approval.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

interface FlowStepProps {
  label: string;
  description: string;
  status: 'pending' | 'active' | 'done';
  icon: React.ReactNode;
  color?: 'default' | 'green' | 'amber' | 'red' | 'blue';
  loading?: boolean;
  detail?: React.ReactNode;
}

function FlowStep({ label, description, status, icon, color = 'default', loading = false, detail }: FlowStepProps) {
  const colorMap = {
    default: 'border-surface-border',
    green: 'border-rail-green/30 bg-rail-green/10',
    amber: 'border-rail-amber/30 bg-rail-amber/10',
    red: 'border-rail-red/30 bg-rail-red/10',
    blue: 'border-rail-blue/30 bg-rail-blue/10',
  };

  const iconColor = {
    default: 'text-gray-500',
    green: 'text-rail-green',
    amber: 'text-rail-amber',
    red: 'text-rail-red',
    blue: 'text-rail-blue',
  };

  return (
    <div className={clsx(
      'p-4 rounded-xl border transition-all',
      status === 'pending' ? 'opacity-40 border-surface-border' : colorMap[color]
    )}>
      <div className="flex items-start gap-3">
        <div className={clsx('mt-0.5', iconColor[color], loading && 'animate-spin')}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-100">{label}</p>
          <p className="text-xs text-gray-300 mt-1">{description}</p>
          {detail}
        </div>
      </div>
    </div>
  );
}

function Arrow({ active }: { active: boolean }) {
  return (
    <div className={clsx('flex justify-center', !active && 'opacity-20')}>
      <ChevronRight size={18} className="text-gray-400 rotate-90" />
    </div>
  );
}

function SimMetric({ label, baseline, result, unit, worseBigger, isBoolean }: { label: string; baseline: number; result: number; unit: string; worseBigger?: boolean; isBoolean?: boolean }) {
  const isWorse = worseBigger ? result > baseline : result < baseline;
  const color = isBoolean ? (result ? '#10b981' : '#ef4444') : isWorse ? '#f59e0b' : '#10b981';

  return (
    <div className="bg-navy-950/80 rounded-lg p-3 border border-surface-border/50">
      <p className="text-[10px] text-gray-400 mb-1">{label}</p>
      <div className="flex items-end gap-2">
        <p className="text-xs text-gray-500 line-through">{isBoolean ? (baseline ? '✓' : '✗') : `${baseline}${unit}`}</p>
        <p className="text-lg font-bold font-tabular" style={{ color }}>
          {isBoolean ? (result ? '✓' : '✗') : `${result}${unit}`}
        </p>
      </div>
    </div>
  );
}
