import React from 'react';
import { CheckCircle2, Circle, Loader2, XCircle, AlertTriangle } from 'lucide-react';
import { clsx } from '../../utils/clsx';

type StepStatus = 'pending' | 'running' | 'done' | 'error';

interface Step {
  label: string;
  status: StepStatus;
}

interface OptimizationProgressProps {
  steps: Step[];
  isRunning: boolean;
  error?: string | null;
  infeasible?: boolean;
}

export function OptimizationProgress({ steps, isRunning, error, infeasible }: OptimizationProgressProps) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-3">
        {isRunning ? (
          <Loader2 size={16} className="text-rail-blue animate-spin" />
        ) : error ? (
          <XCircle size={16} className="text-rail-red" />
        ) : infeasible ? (
          <AlertTriangle size={16} className="text-rail-amber" />
        ) : (
          <CheckCircle2 size={16} className="text-rail-green" />
        )}
        <span className="text-sm font-semibold text-gray-200">
          {isRunning ? 'Running CP-SAT Optimizer…' : error ? 'Optimization Failed' : infeasible ? 'No Feasible Schedule Found' : 'Optimization Complete'}
        </span>
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <StepIcon status={step.status} />
            <span className={clsx(
              'text-xs',
              step.status === 'done' ? 'text-gray-300' :
              step.status === 'running' ? 'text-rail-blue' :
              step.status === 'error' ? 'text-rail-red' :
              'text-gray-600'
            )}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="alert-critical mt-2">
          <XCircle size={13} className="text-rail-red mt-0.5 flex-shrink-0" />
          <p className="text-xs text-gray-300">{error}</p>
        </div>
      )}

      {infeasible && !error && (
        <div className="space-y-2">
          <div className="alert-warning">
            <AlertTriangle size={13} className="text-rail-amber mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-rail-amber">No Feasible Plan Found</p>
              <p className="text-xs text-gray-400 mt-1">
                The CP-SAT solver could not schedule any tasks within the given windows.
                Possible causes: no matching section windows, all windows too short, or all crew conflicts.
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Try: adding more block windows, extending the planning horizon, or increasing solver time.
          </p>
        </div>
      )}
    </div>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'done': return <CheckCircle2 size={13} className="text-rail-green flex-shrink-0" />;
    case 'running': return <Loader2 size={13} className="text-rail-blue animate-spin flex-shrink-0" />;
    case 'error': return <XCircle size={13} className="text-rail-red flex-shrink-0" />;
    default: return <Circle size={13} className="text-gray-600 flex-shrink-0" />;
  }
}
