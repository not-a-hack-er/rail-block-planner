import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { clsx } from '../../utils/clsx';

export function AppShell() {
  const [presentationMode, setPresentationMode] = useState(false);

  return (
    <div className={clsx('flex h-screen overflow-hidden', presentationMode && 'presentation-mode')}>
      {/* Sidebar */}
      {!presentationMode && <Sidebar />}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        {!presentationMode && (
          <TopBar
            presentationMode={presentationMode}
            onTogglePresentation={() => setPresentationMode(v => !v)}
          />
        )}

        {/* Presentation mode toggle button — always visible */}
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
      </div>
    </div>
  );
}
