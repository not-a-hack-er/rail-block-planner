import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Train, Eye, EyeOff, ShieldCheck, Lock, Building2, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { login, register, ssoLogin, verifyMfa } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client';
import type { UserRole } from '../types';

const DEMO_CREDENTIALS = [
  { label: 'Sr. DOM (Full Sign-off Privilege)', email: 'srdom@railways.gov.in', password: 'srdom12345', role: 'SENIOR_DOM', color: 'text-rail-blue', bg: 'bg-rail-blue/10 border-rail-blue/30' },
  { label: 'Admin (System Administrator)', email: 'admin@railways.gov.in', password: 'admin12345', role: 'ADMIN', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
];

export function LoginPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'sso' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('SENIOR_DOM');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [showDemoHelper, setShowDemoHelper] = useState(true);

  const [employeeId, setEmployeeId] = useState('');
  const [domain, setDomain] = useState('railways.gov.in');
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);

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

  const ssoMut = useMutation({
    mutationFn: () => ssoLogin({ employee_id: employeeId, directory_domain: domain }),
    onSuccess: () => { setShowMfaModal(true); },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const mfaMut = useMutation({
    mutationFn: () => verifyMfa({ session_id: 'sso_session_123', otp_code: otpDigits.join('') }),
    onSuccess: (data) => {
      setUser({ id: 1, email: employeeId + '@' + domain, role: data.user_role });
      setShowMfaModal(false);
      navigate('/');
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

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

  const autoFill = (cred: typeof DEMO_CREDENTIALS[0]) => {
    setEmail(cred.email);
    setPassword(cred.password);
    setMode('login');
    setError('');
  };

  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otpDigits];
    next[idx] = val;
    setOtpDigits(next);
    if (val && idx < 5) {
      const nextInput = document.getElementById('otp-' + (idx + 1));
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      document.getElementById('otp-' + (idx - 1))?.focus();
    }
  };

  const autoFillOtp = () => setOtpDigits(['1', '2', '3', '4', '5', '6']);

  const isPending = loginMut.isPending || ssoMut.isPending || registerMut.isPending;

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-30" style={{ backgroundSize: '40px 40px' }} />
      <div className="absolute inset-0 bg-gradient-to-br from-rail-blue/5 via-transparent to-emerald-500/5" />

      <div className="w-full max-w-md space-y-5 relative z-10">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-navy-800 border-2 border-rail-blue/40 rounded-2xl flex items-center justify-center shadow-2xl shadow-rail-blue/20 relative">
              <Train size={36} className="text-rail-blue" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-navy-950 animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-widest">RAILOPT</h1>
            <p className="text-sm text-gray-400 mt-1 font-medium">Indian Railways AI Decision Support Portal</p>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">CP-SAT Optimizer Active</span>
              <span className="text-[10px] text-rail-blue font-mono bg-rail-blue/10 border border-rail-blue/20 px-2 py-0.5 rounded">SIH 2026</span>
            </div>
          </div>
        </div>

        <div className="card bg-navy-800/80 border border-amber-500/20">
          <button
            onClick={() => setShowDemoHelper(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-amber-400"
          >
            <span className="flex items-center gap-2"><Zap size={12} /> One-Click Judge Credentials</span>
            {showDemoHelper ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showDemoHelper && (
            <div className="px-3 pb-3 space-y-2 border-t border-surface-border/50">
              {DEMO_CREDENTIALS.map(cred => (
                <button
                  key={cred.email}
                  onClick={() => autoFill(cred)}
                  className={'w-full text-left p-2.5 rounded-lg border transition-all hover:opacity-90 ' + cred.bg}
                >
                  <div className="flex items-center justify-between">
                    <span className={'text-[11px] font-bold ' + cred.color}>{cred.label}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{cred.email}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6 space-y-5 bg-navy-900/95 border border-surface-border shadow-2xl">
          <div className="flex bg-navy-950 rounded-lg p-1 gap-1 border border-surface-border/50">
            {(['login', 'sso', 'register'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(''); }}
                className={'flex-1 py-2 rounded-md text-[11px] font-bold transition-all ' + (
                  mode === m ? 'bg-rail-blue text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
                )}
              >
                {m === 'login' ? 'Email Login' : m === 'sso' ? 'Enterprise SSO' : 'Register'}
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

            <button type="submit" disabled={isPending} className="btn-primary w-full justify-center text-sm py-3 font-bold shadow-lg shadow-rail-blue/20">
              {isPending ? 'Authenticating…' : mode === 'sso' ? 'VERIFY SSO DIRECTORY' : mode === 'login' ? 'SIGN IN TO COMMAND CENTER' : 'CREATE ACCOUNT'}
            </button>
          </form>

          <div className="flex items-center justify-center gap-2 text-[10px] text-gray-600">
            <Lock size={9} />
            <span>Enterprise Tier-1 Security · Indian Railways · NR/NCR Zone</span>
          </div>
        </div>
      </div>

      {showMfaModal && (
        <div className="drawer-overlay flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-surface-border rounded-xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex items-center gap-2 text-emerald-400 border-b border-surface-border pb-3">
              <ShieldCheck className="w-5 h-5" />
              <h3 className="font-bold text-gray-100 text-base">Multi-Factor Authentication</h3>
            </div>

            <p className="text-xs text-gray-300">
              Enter the 6-digit OTP sent to registered mobile for employee{' '}
              <span className="font-bold font-mono text-cyan-400">{employeeId}</span>.
            </p>

            <div>
              <label className="label">2FA Security OTP</label>
              <div className="flex gap-2 justify-center mt-2">
                {otpDigits.map((d, i) => (
                  <input
                    key={i}
                    id={'otp-' + i}
                    type="text"
                    maxLength={1}
                    value={d}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    className="w-10 h-12 text-center text-lg font-mono font-bold bg-navy-800 border border-surface-border rounded-lg focus:border-rail-blue focus:ring-1 focus:ring-rail-blue outline-none text-gray-100"
                  />
                ))}
              </div>
              <button onClick={autoFillOtp} className="mt-2 text-[10px] text-gray-500 hover:text-gray-300 w-full text-center transition-colors">
                Demo helper: Click to auto-fill OTP (123456)
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => mfaMut.mutate()}
                disabled={mfaMut.isPending || otpDigits.join('').length < 6}
                className="btn-primary flex-1 justify-center text-xs font-bold py-2"
              >
                {mfaMut.isPending ? 'Verifying...' : 'AUTHORIZE LOGIN'}
              </button>
              <button onClick={() => setShowMfaModal(false)} className="btn-secondary text-xs px-3">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
