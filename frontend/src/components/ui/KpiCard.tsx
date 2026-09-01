import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { clsx } from '../../utils/clsx';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  color?: 'default' | 'green' | 'amber' | 'red' | 'blue';
  loading?: boolean;
}

const colorMap = {
  default: { dot: '', val: 'text-white', icon: 'text-gray-400' },
  green: { dot: 'text-rail-green', val: 'text-rail-green', icon: 'text-rail-green/70' },
  amber: { dot: 'text-rail-amber', val: 'text-rail-amber', icon: 'text-rail-amber/70' },
  red: { dot: 'text-rail-red', val: 'text-rail-red', icon: 'text-rail-red/70' },
  blue: { dot: 'text-rail-blue', val: 'text-rail-blue', icon: 'text-rail-blue/70' },
};

export function KpiCard({ title, value, subtitle, icon: Icon, trend, trendLabel, color = 'default', loading }: KpiCardProps) {
  const colors = colorMap[color];

  return (
    <div className="kpi-card hover:border-surface-subtle transition-colors">
      <div className="flex items-start justify-between">
        <span className="section-title text-[10px]">{title}</span>
        {Icon && <Icon size={14} className={colors.icon} />}
      </div>

      {loading ? (
        <div className="h-7 w-20 bg-surface-raised rounded animate-pulse" />
      ) : (
        <div className={clsx('text-2xl font-bold font-tabular', colors.val)}>
          {value}
        </div>
      )}

      {(subtitle || trend) && (
        <div className="flex items-center gap-2">
          {trend && (
            <span className={clsx(
              'flex items-center gap-0.5 text-xs',
              trend === 'up' ? 'text-rail-red' : trend === 'down' ? 'text-rail-green' : 'text-gray-500'
            )}>
              {trend === 'up' ? <TrendingUp size={11} /> : trend === 'down' ? <TrendingDown size={11} /> : <Minus size={11} />}
              {trendLabel}
            </span>
          )}
          {subtitle && <span className="text-xs text-gray-500 truncate">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
