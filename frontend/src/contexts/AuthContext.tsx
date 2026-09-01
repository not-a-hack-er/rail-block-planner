import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { clearAuthToken } from '../api/client';
import type { AuthUser, UserRole } from '../types';

interface AuthContextType {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
  isAdmin: boolean;
  isPlanner: boolean;
  isSeniorDom: boolean;
  isDeptApprover: boolean;
  canApprove: boolean;
  canPublish: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(() => {
    try {
      const stored = sessionStorage.getItem('rail_user');
      return stored ? (JSON.parse(stored) as AuthUser) : null;
    } catch {
      return null;
    }
  });

  const setUser = (u: AuthUser | null) => {
    setUserState(u);
    if (u) {
      sessionStorage.setItem('rail_user', JSON.stringify(u));
    } else {
      sessionStorage.removeItem('rail_user');
    }
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
  };

  const role: UserRole | null = user?.role ?? null;

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      logout,
      isAdmin: role === 'ADMIN',
      isPlanner: role === 'PLANNER' || role === 'ADMIN',
      isSeniorDom: role === 'SENIOR_DOM' || role === 'ADMIN',
      isDeptApprover: role === 'DEPARTMENT_APPROVER' || role === 'SENIOR_DOM' || role === 'ADMIN',
      canApprove: role === 'DEPARTMENT_APPROVER' || role === 'SENIOR_DOM' || role === 'ADMIN',
      canPublish: role === 'SENIOR_DOM' || role === 'ADMIN',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
