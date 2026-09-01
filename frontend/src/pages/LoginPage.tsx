import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Train, Eye, EyeOff } from 'lucide-react';
import { login, register } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client';
import type { UserRole } from '../types';

export function LoginPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('ADMIN');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const loginMut = useMutation({
    mutationFn: () => login({ email, password }),
    onSuccess: () => {
      // Decode user info from token (basic decode — no verification needed on frontend)
      try {
        const token = sessionStorage.getItem('rail_access_token') ?? '';
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({ id: parseInt(payload.sub), email, role: payload.role as UserRole });
      } catch {
        setUser({ id: 0, email, role: 'PLANNER' });
      }
      navigate('/');
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const registerMut = useMutation({
    mutationFn: () => register({ email, password, role }),
    onSuccess: async (user) => {
      // Auto-login after register
      await login({ email, password });
      setUser({ ...user });
      navigate('/');
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'login') loginMut.mutate();
    else registerMut.mutate();
  };

  const isPending = loginMut.isPending || registerMut.isPending;

  return (
    <div className="min-h-screen bg-navy-900 bg-grid flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-14 h-14 bg-rail-blue/10 border border-rail-blue/20 rounded-xl flex items-center justify-center">
              <Train size={28} className="text-rail-blue" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">RAILOPT</h1>
            <p className="text-xs text-gray-500 mt-1">AI Decision Support System</p>
            <p className="text-[10px] text-gray-600">Railway Block Planning — SIH 2026</p>
          </div>
        </div>

        {/* Form */}
        <div className="card p-6 space-y-5">
          {/* Mode toggle */}
          <div className="flex bg-navy-900 rounded-lg p-1 gap-1">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${
                  mode === m ? 'bg-surface text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="officer@railopt.in"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="label">Role</label>
                <select className="select" value={role} onChange={e => setRole(e.target.value as UserRole)}>
                  <option value="ADMIN">Admin (full access)</option>
                  <option value="PLANNER">Planner</option>
                  <option value="SENIOR_DOM">Senior DOM</option>
                  <option value="DEPARTMENT_APPROVER">Department Approver</option>
                </select>
                <p className="text-[10px] text-gray-600 mt-1">For local demo, use Admin for full access.</p>
              </div>
            )}

            {error && (
              <div className="alert-critical">
                <p className="text-xs text-rail-red">{error}</p>
              </div>
            )}

            <button type="submit" disabled={isPending} className="btn-primary w-full justify-center">
              {isPending ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Trust */}
          <p className="text-center text-[10px] text-gray-600">
            Decision Support System · Human-in-the-loop · Not a railway control system
          </p>
        </div>
      </div>
    </div>
  );
}
