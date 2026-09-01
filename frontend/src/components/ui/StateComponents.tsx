import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, Loader2, SearchX, ServerCrash } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: 'search' | 'info' | 'check';
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon = 'search', action }: EmptyStateProps) {
  const Icon = icon === 'info' ? Info : icon === 'check' ? CheckCircle2 : SearchX;
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="w-12 h-12 rounded-full bg-surface-raised flex items-center justify-center">
        <Icon size={20} className="text-gray-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-300">{title}</p>
        {description && <p className="text-xs text-gray-500 mt-1 max-w-xs">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  action?: React.ReactNode;
}

export function ErrorState({ title = 'Error', message, action }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="w-12 h-12 rounded-full bg-rail-red/10 flex items-center justify-center">
        <ServerCrash size={20} className="text-rail-red" />
      </div>
      <div>
        <p className="text-sm font-semibold text-rail-red">{title}</p>
        <p className="text-xs text-gray-400 mt-1 max-w-sm">{message}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 size={24} className="text-rail-blue animate-spin" />
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

interface AlertBannerProps {
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message?: string;
}

export function AlertBanner({ type, title, message }: AlertBannerProps) {
  const map = {
    critical: { cls: 'alert-critical', Icon: AlertCircle, iconCls: 'text-rail-red mt-0.5' },
    warning: { cls: 'alert-warning', Icon: AlertTriangle, iconCls: 'text-rail-amber mt-0.5' },
    info: { cls: 'alert-info', Icon: Info, iconCls: 'text-rail-blue mt-0.5' },
    success: { cls: 'alert-success', Icon: CheckCircle2, iconCls: 'text-rail-green mt-0.5' },
  };
  const { cls, Icon, iconCls } = map[type];
  return (
    <div className={cls}>
      <Icon size={14} className={iconCls} />
      <div>
        <p className="text-xs font-semibold text-gray-200">{title}</p>
        {message && <p className="text-xs text-gray-400 mt-0.5">{message}</p>}
      </div>
    </div>
  );
}

export function DemoBanner() {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-rail-amber/10 border border-rail-amber/20 rounded-lg">
      <AlertTriangle size={14} className="text-rail-amber flex-shrink-0" />
      <span className="text-xs font-semibold text-rail-amber">DEMO ENVIRONMENT — SYNTHETIC DATA</span>
      <span className="text-xs text-gray-400">This page uses frontend-only demo data. No backend endpoint exists yet for this feature.</span>
    </div>
  );
}
