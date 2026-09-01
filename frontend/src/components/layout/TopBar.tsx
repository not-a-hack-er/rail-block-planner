import React, { useState } from 'react';
import { format } from 'date-fns';
import { Bell, Monitor, Database, Wifi, WifiOff, Presentation } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { checkHealth } from '../../api/health';
import { clsx } from '../../utils/clsx';

interface TopBarProps {
  presentationMode: boolean;
  onTogglePresentation: () => void;
}

export function TopBar({ presentationMode, onTogglePresentation }: TopBarProps) {
  const { data: health, isError } = useQuery({
    queryKey: ['health'],
    queryFn: checkHealth,
    refetchInterval: 30000,
    retry: 1,
  });

  const isConnected = health?.status === 'ok' && !isError;
  const now = format(new Date(), 'dd MMM yyyy');

  return (
    <header className="topbar h-[52px] bg-navy-800 border-b border-surface-border flex items-center justify-between px-6 flex-shrink-0">
      {/* Left: Planning context */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="section-title text-[10px]">Planning Horizon</span>
          <span className="text-xs font-semibold text-gray-200">Weekly Plan — {now}</span>
        </div>
        <div className="h-3 w-px bg-surface-border" />
        <div className="flex items-center gap-2">
          <span className="section-title text-[10px]">Corridor</span>
          <span className="text-xs text-gray-300">All Corridors</span>
        </div>
      </div>

      {/* Right: Status + controls */}
      <div className="flex items-center gap-4">
        {/* Backend status */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-rail-green animate-pulse-slow" />
              <span className="text-[11px] text-gray-400">Backend Connected</span>
            </>
          ) : (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-rail-red" />
              <span className="text-[11px] text-rail-red">Backend Unreachable</span>
            </>
          )}
        </div>

        <div className="h-3 w-px bg-surface-border" />

        {/* Data mode */}
        <div className="flex items-center gap-1.5">
          <Database size={11} className="text-gray-500" />
          <span className="text-[11px] text-gray-500">DEMO ENVIRONMENT</span>
        </div>

        <div className="h-3 w-px bg-surface-border" />

        {/* Presentation mode */}
        <button
          onClick={onTogglePresentation}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all border',
            presentationMode
              ? 'bg-rail-blue/20 border-rail-blue/30 text-rail-blue'
              : 'border-surface-border text-gray-400 hover:text-gray-200 hover:border-gray-600'
          )}
          title="Toggle presentation mode"
        >
          <Monitor size={12} />
          <span>{presentationMode ? 'Exit Presentation' : 'Present'}</span>
        </button>

        {/* Role badge */}
        <div className="badge badge-blue text-[10px]">Control Office</div>

        {/* Trust label */}
        <div className="text-[10px] text-gray-600 hidden xl:block">
          Decision Support • Human-in-the-loop
        </div>
      </div>
    </header>
  );
}
