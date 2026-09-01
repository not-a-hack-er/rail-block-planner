import React, { useState } from 'react';
import { FlaskConical, Play, ChevronRight, AlertTriangle, CheckCircle2, RefreshCw, Lock, Unlock } from 'lucide-react';
import { DemoBanner } from '../components/ui/StateComponents';
import { SIM_SCENARIOS, type SimScenarioId } from '../demo/scenarios';
import { clsx } from '../utils/clsx';
import { addMinutes, format } from 'date-fns';

type SimPhase = 'idle' | 'running' | 'conflict' | 'replan' | 'result';

export function SimulationPage() {
  const [selectedScenario, setSelectedScenario] = useState<SimScenarioId>('maintenance_overrun_30');
  const [phase, setPhase] = useState<SimPhase>('idle');

  const scenario = SIM_SCENARIOS[selectedScenario];

  const runSimulation = async () => {
    setPhase('running');
    await delay(1000);
    setPhase('conflict');
    await delay(1500);
    setPhase('replan');
    await delay(1500);
    setPhase('result');
  };

  const reset = () => setPhase('idle');

  // Example base window times for display
  const baseStart = new Date();
  baseStart.setHours(2, 0, 0, 0);
  const baseEnd = new Date();
  baseEnd.setHours(3, 0, 0, 0);
  const newStart = addMinutes(baseStart, scenario.newWindowOffset);
  const newEnd = addMinutes(baseEnd, scenario.newWindowOffset + scenario.overrunMinutes);

  return (
    <div className="p-6 space-y-6 max-w-[1200px]">
      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2">
          <FlaskConical size={20} className="text-rail-blue" />
          Operational What-If Simulator
        </h1>
        <p className="page-subtitle mt-1">
          Test how the system responds to operational disturbances.
          Rolling-horizon replanning keeps committed decisions locked and re-optimizes only the uncommitted portion.
        </p>
      </div>

      <DemoBanner />

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        {/* Scenario selector */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-200">Select Disturbance Scenario</h3>
          <div className="space-y-1.5">
            {Object.values(SIM_SCENARIOS).map(s => (
              <button
                key={s.id}
                onClick={() => { setSelectedScenario(s.id); reset(); }}
                className={clsx(
                  'w-full text-left px-3 py-2.5 rounded-md border transition-all text-sm',
                  selectedScenario === s.id
                    ? 'bg-rail-blue/15 border-rail-blue/30 text-gray-200'
                    : 'border-surface-border text-gray-400 hover:text-gray-200 hover:bg-surface-raised'
                )}
              >
                <p className="font-medium">{s.label}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{s.description}</p>
              </button>
            ))}
          </div>

          <button
            onClick={runSimulation}
            disabled={phase === 'running' || phase === 'replan'}
            className="btn-primary w-full justify-center gap-2 mt-2"
          >
            <Play size={14} />
            RUN SIMULATION
          </button>
          {phase !== 'idle' && (
            <button onClick={reset} className="btn-secondary w-full justify-center gap-2">
              <RefreshCw size={14} />
              Reset
            </button>
          )}
        </div>

        {/* Simulation output */}
        <div className="space-y-4">
          {/* Flow diagram */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-200">Rolling-Horizon Replanning Flow</h3>

            <FlowStep
              label="Base Plan"
              description={`Block assigned: ${format(baseStart, 'HH:mm')} → ${format(baseEnd, 'HH:mm')}`}
              status={phase !== 'idle' ? 'done' : 'pending'}
              icon={<CheckCircle2 size={14} />}
              detail={
                <div className="mt-2 flex gap-3">
                  <BlockBar label="Maintenance Block" start="02:00" end="03:00" color="#3b82f6" locked />
                </div>
              }
            />

            <Arrow active={phase !== 'idle'} />

            <FlowStep
              label="Disturbance"
              description={scenario.disturbanceLabel}
              status={phase === 'conflict' || phase === 'replan' || phase === 'result' ? 'active' : 'pending'}
              icon={<AlertTriangle size={14} />}
              color="amber"
            />

            <Arrow active={phase === 'conflict' || phase === 'replan' || phase === 'result'} />

            <FlowStep
              label="Conflict Detected"
              description={scenario.conflictDescription}
              status={phase === 'conflict' || phase === 'replan' || phase === 'result' ? 'active' : 'pending'}
              icon={<AlertTriangle size={14} />}
              color="red"
              loading={phase === 'running'}
            />

            <Arrow active={phase === 'replan' || phase === 'result'} />

            <FlowStep
              label="Rolling-Horizon Replan"
              description={scenario.replanNote}
              status={phase === 'replan' || phase === 'result' ? 'active' : 'pending'}
              icon={<RefreshCw size={14} />}
              color="blue"
              loading={phase === 'conflict'}
              detail={
                phase === 'replan' || phase === 'result' ? (
                  <div className="mt-3 space-y-2">
                    <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                      <Lock size={10} className="text-gray-600" />
                      Committed decisions: LOCKED — cannot be changed
                    </div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                      <Unlock size={10} className="text-rail-blue" />
                      Uncommitted horizon: re-optimized with updated constraints
                    </div>
                  </div>
                ) : null
              }
            />

            <Arrow active={phase === 'result'} />

            <FlowStep
              label="New Feasible Plan"
              description={
                phase === 'result'
                  ? `Rescheduled to ${format(newStart, 'HH:mm')} → ${format(newEnd, 'HH:mm')}`
                  : 'Awaiting replanning…'
              }
              status={phase === 'result' ? 'done' : 'pending'}
              icon={<CheckCircle2 size={14} />}
              color="green"
              loading={phase === 'replan'}
              detail={
                phase === 'result' ? (
                  <div className="mt-2">
                    <BlockBar label="Rescheduled Block" start={format(newStart, 'HH:mm')} end={format(newEnd, 'HH:mm')} color="#10b981" />
                  </div>
                ) : null
              }
            />
          </div>

          {/* Result metrics */}
          {phase === 'result' && (
            <div className="card p-5 space-y-4 animate-slide-up">
              <h3 className="text-sm font-semibold text-gray-200">Simulation Results</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SimMetric label="Added Delay" baseline={scenario.baselineDelay} result={scenario.newDelay} unit="min" worseBigger />
                <SimMetric label="Blocks Affected" baseline={0} result={scenario.blocksAffected} unit="" worseBigger />
                <SimMetric label="Replan Success" baseline={1} result={scenario.replanSuccess ? 1 : 0} unit="" isBoolean />
                <SimMetric label="Window Shift" baseline={0} result={scenario.newWindowOffset} unit="min" worseBigger />
              </div>
              <div className="alert-success">
                <CheckCircle2 size={14} className="text-rail-green mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-rail-green">Replanning Successful</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {scenario.replanNote} Human controller review required before implementing changes.
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
    green: 'border-rail-green/30 bg-rail-green/5',
    amber: 'border-rail-amber/30 bg-rail-amber/5',
    red: 'border-rail-red/30 bg-rail-red/5',
    blue: 'border-rail-blue/30 bg-rail-blue/5',
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
      'p-3 rounded-lg border transition-all',
      status === 'pending' ? 'opacity-40 border-surface-border' : colorMap[color]
    )}>
      <div className="flex items-start gap-3">
        <div className={clsx('mt-0.5', iconColor[color], loading && 'animate-spin')}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-gray-200">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
          {detail}
        </div>
      </div>
    </div>
  );
}

function Arrow({ active }: { active: boolean }) {
  return (
    <div className={clsx('flex justify-center', !active && 'opacity-20')}>
      <ChevronRight size={16} className="text-gray-500 rotate-90" />
    </div>
  );
}

function BlockBar({ label, start, end, color, locked }: { label: string; start: string; end: string; color: string; locked?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {locked && <Lock size={10} className="text-gray-500" />}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded" style={{ backgroundColor: `${color}20`, borderLeft: `3px solid ${color}` }}>
        <span style={{ color }} className="font-semibold">{label}</span>
        <span className="text-gray-400">{start} → {end}</span>
      </div>
    </div>
  );
}

function SimMetric({ label, baseline, result, unit, worseBigger, isBoolean }: { label: string; baseline: number; result: number; unit: string; worseBigger?: boolean; isBoolean?: boolean }) {
  const isWorse = worseBigger ? result > baseline : result < baseline;
  const color = isBoolean ? (result ? '#10b981' : '#ef4444') : isWorse ? '#f59e0b' : '#10b981';

  return (
    <div className="bg-navy-900 rounded p-3">
      <p className="text-[10px] text-gray-500 mb-1">{label}</p>
      <div className="flex items-end gap-2">
        <p className="text-xs text-gray-500 line-through">{isBoolean ? (baseline ? '✓' : '✗') : `${baseline}${unit}`}</p>
        <p className="text-base font-bold font-tabular" style={{ color }}>
          {isBoolean ? (result ? '✓' : '✗') : `${result}${unit}`}
        </p>
      </div>
    </div>
  );
}
