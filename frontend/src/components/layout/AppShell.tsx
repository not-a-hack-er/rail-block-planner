import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { clsx } from '../../utils/clsx';

export function AppShell() {
  const [presentationMode, setPresentationMode] = useState(false);

  return (
    <div className={clsx('flex h-screen overflow-hidden flex-col', presentationMode && 'presentation-mode')}>
      {/* Top bar */}
      {!presentationMode && (
        <TopBar
          presentationMode={presentationMode}
          onTogglePresentation={() => setPresentationMode(v => !v)}
        />
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        {!presentationMode && <Sidebar />}

        {/* Main content */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Presentation mode exit button */}
          {presentationMode && (
            <div className="fixed top-4 right-4 z-50">
              <button
                onClick={() => setPresentationMode(false)}
                className="btn-secondary text-xs px-3 py-1.5 shadow-lg"
              >
                Exit Presentation Mode
              </button>
            </div>
          )}

          {/* Page content */}
          <main className="flex-1 overflow-y-auto bg-navy-900 bg-grid">
            <Outlet />
          </main>

          {/* Footer strip */}
          {!presentationMode && (
            <footer className="h-6 bg-navy-800 border-t border-surface-border flex items-center justify-between px-4 shrink-0">
              <span className="text-[10px] text-gray-600">
                CP-SAT Model Active · OR-Tools 9.15 · NR/NCR Zone · Prayagraj Division
              </span>
              <span className="text-[10px] text-gray-700">
                RAILOPT v1.0 · SIH 2026 · Human-in-the-loop decision support
              </span>
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}
