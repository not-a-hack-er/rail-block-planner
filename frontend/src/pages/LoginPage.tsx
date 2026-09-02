import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Train, Eye, EyeOff, ShieldCheck, KeyRound, Lock, Building2 } from 'lucide-react';
import { login, register, ssoLogin, verifyMfa } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client';
import type { UserRole } from '../types';

export function LoginPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'sso' | 'register'>('login');
  
  // Standard login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('SENIOR_DOM');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // SSO & MFA state
  const [employeeId, setEmployeeId] = useState('');
  const [domain, setDomain] = useState('railways.gov.in');
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Standard Login Mutation
  const loginMut = useMutation({
    mutationFn: () => login({ email, password }),
    onSuccess: () => {
      try {
        const token = sessionStorage.getItem('rail_access_token') ?? '';
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({ id: parseInt(payload.sub), email, role: payload.role as UserRole });
      } catch {
        setUser({ id: 0, email, role: 'SENIOR_DOM' });
      }
      navigate('/');
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  // Enterprise SSO Mutation
  const ssoMut = useMutation({
    mutationFn: () => ssoLogin({ employee_id: employeeId, directory_domain: domain }),
    onSuccess: () => {
      setShowMfaModal(true);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  // 2FA MFA Verification Mutation
  const mfaMut = useMutation({
    mutationFn: () => verifyMfa({ session_id: 'sso_session_123', otp_code: otpCode }),
    onSuccess: (data) => {
      setUser({ id: 1, email: `${employeeId}@${domain}`, role: data.user_role });
      setShowMfaModal(false);
      navigate('/');
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  // Registration Mutation
  const registerMut = useMutation({
    mutationFn: () => register({ email, password, role }),
    onSuccess: async (user) => {
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
    else if (mode === 'sso') ssoMut.mutate();
    else registerMut.mutate();
  };

  const isPending = loginMut.isPending || ssoMut.isPending || registerMut.isPending;

  return (
    <div className="min-h-screen bg-navy-950 bg-grid flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-rail-blue/15 border border-rail-blue/30 rounded-2xl flex items-center justify-center shadow-xl">
              <Train size={32} className="text-rail-blue" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-wider">RAILOPT</h1>
            <p className="text-xs text-gray-400 mt-1 font-semibold">Indian Railways AI Decision Support Portal</p>
            <p className="text-[10px] text-emerald-400 font-mono">Enterprise SSO & CP-SAT Engine Integrated</p>
          </div>
        </div>

        {/* Form Card */}
        <div className="card p-6 space-y-5 bg-navy-900/90 border border-surface-border shadow-2xl">
          {/* Mode Tabs */}
          <div className="flex bg-navy-950 rounded-lg p-1 gap-1 border border-surface-border/50">
            {(['login', 'sso', 'register'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 rounded-md text-[11px] font-bold transition-all ${
                  mode === m ? 'bg-rail-blue text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {m === 'login' ? 'Standard Login' : m === 'sso' ? 'Enterprise SSO' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'sso' ? (
              <div className="space-y-3 animate-fade-in">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2 text-blue-300 text-xs">
                  <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Authenticate via Indian Railways Central LDAP Directory</span>
                </div>
                <div>
                  <label className="label">Railway Employee ID</label>
                  <input
                    type="text"
                    className="input font-mono"
                    placeholder="e.g. DOM-7741 or PLANNER-102"
                    value={employeeId}
                    onChange={e => setEmployeeId(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Directory Domain</label>
                  <input
                    type="text"
                    className="input font-mono"
                    value={domain}
                    onChange={e => setDomain(e.target.value)}
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <label className="label">Railway Official Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="srdom@railways.gov.in"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
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
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="label">Role Privilege</label>
                <select className="select" value={role} onChange={e => setRole(e.target.value as UserRole)}>
                  <option value="SENIOR_DOM">Senior DOM (Sign-off Privilege)</option>
                  <option value="ADMIN">Admin (Full Control)</option>
                  <option value="PLANNER">Section Planner</option>
                  <option value="DEPARTMENT_APPROVER">Department Approver</option>
                </select>
              </div>
            )}

            {error && (
              <div className="alert-critical">
                <p className="text-xs text-rail-red">{error}</p>
              </div>
            )}

            <button type="submit" disabled={isPending} className="btn-primary w-full justify-center text-sm py-2.5 font-bold">
              {isPending ? 'Authenticating…' : mode === 'sso' ? 'VERIFY SSO DIRECTORY' : mode === 'login' ? 'SIGN IN TO COMMAND CENTER' : 'CREATE ACCOUNT'}
            </button>
          </form>

          <p className="text-center text-[10px] text-gray-500">
            Decision Support Portal • Security Level: Enterprise Tier-1 • Indian Railways
          </p>
        </div>
      </div>

      {/* 2FA MFA Verification Modal */}
      {showMfaModal && (
        <div className="drawer-overlay flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-surface-border rounded-xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in">
            <div className="flex items-center gap-2 text-emerald-400 border-b border-surface-border pb-3">
              <ShieldCheck className="w-5 h-5" />
              <h3 className="font-bold text-gray-100 text-base">Multi-Factor Authentication (2FA)</h3>
            </div>

            <p className="text-xs text-gray-300">
              Enter the 6-digit OTP code sent to your registered Indian Railways mobile device for employee ID <span className="font-bold font-mono text-cyan-400">{employeeId}</span>.
            </p>

            <div>
              <label className="label">2FA Security OTP Code</label>
              <input
                type="text"
                className="input text-center text-lg font-mono tracking-widest"
                placeholder="123456"
                maxLength={6}
                value={otpCode}
                onChange={e => setOtpCode(e.target.value)}
                required
              />
              <p className="text-[10px] text-gray-500 mt-1">For demonstration, enter code <b>123456</b> or <b>888888</b>.</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => mfaMut.mutate()}
                disabled={mfaMut.isPending || otpCode.length < 6}
                className="btn-primary flex-1 justify-center text-xs font-bold py-2"
              >
                {mfaMut.isPending ? 'Verifying...' : 'AUTHORIZE LOGIN'}
              </button>
              <button onClick={() => setShowMfaModal(false)} className="btn-secondary text-xs px-3">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
