import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Wrench, CalendarRange, Route, FlaskConical,
  BarChart3, Calendar, Activity, ChevronLeft, ChevronRight,
  Train, LogOut, User, Shield
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { clsx } from '../../utils/clsx';

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Command Center' },
  { path: '/planner', icon: CalendarRange, label: 'Block Planner' },
  { path: '/maintenance', icon: Wrench, label: 'Maintenance' },
  { path: '/corridor', icon: Route, label: 'Traffic & Corridor' },
  { path: '/simulation', icon: FlaskConical, label: 'Simulation' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/calendar', icon: Calendar, label: 'Plans / Calendar' },
  { path: '/status', icon: Activity, label: 'System Status' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={clsx(
        'sidebar flex flex-col bg-navy-800 border-r border-surface-border transition-all duration-300 h-screen sticky top-0',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-surface-border min-h-[60px]">
        <div className="flex-shrink-0 w-8 h-8 bg-rail-blue rounded flex items-center justify-center">
          <Train size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in overflow-hidden">
            <div className="text-sm font-bold text-white tracking-wide">RAILOPT</div>
            <div className="text-[10px] text-gray-500 leading-tight">AI Decision Support</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {!collapsed && (
          <div className="px-3 pb-2">
            <span className="section-title text-[10px]">Navigation</span>
          </div>
        )}
        <ul className="space-y-0.5 px-2">
          {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
            <li key={path}>
              <NavLink
                to={path}
                end={path === '/'}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150 group',
                    isActive
                      ? 'bg-rail-blue/15 text-rail-blue border border-rail-blue/20'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-surface-raised'
                  )
                }
                title={collapsed ? label : undefined}
              >
                <Icon size={16} className="flex-shrink-0" />
                {!collapsed && <span className="truncate font-medium">{label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User info + logout */}
      <div className="border-t border-surface-border p-3 space-y-2">
        {!collapsed && user && (
          <div className="flex items-center gap-2 px-2 py-1.5 animate-fade-in">
            <div className="w-6 h-6 rounded-full bg-rail-blue/20 flex items-center justify-center flex-shrink-0">
              <User size={12} className="text-rail-blue" />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-medium text-gray-200 truncate">{user.email}</div>
              <div className="flex items-center gap-1">
                <Shield size={9} className="text-gray-500" />
                <span className="text-[10px] text-gray-500">{user.role}</span>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-400 hover:text-rail-red hover:bg-rail-red/10 transition-all',
            collapsed && 'justify-center'
          )}
          title="Sign out"
        >
          <LogOut size={14} />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-center py-1.5 text-gray-600 hover:text-gray-400 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}
