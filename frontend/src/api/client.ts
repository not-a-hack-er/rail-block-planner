/// <reference types="vite/client" />
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const RAW_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const BASE_URL = RAW_URL.replace(/\/+$/, '');

export const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request interceptor: attach JWT ────────────────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = sessionStorage.getItem('rail_access_token');
  if (token && config.headers) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor: normalize errors ──────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired — clear session
      sessionStorage.removeItem('rail_access_token');
      sessionStorage.removeItem('rail_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function setAuthToken(token: string): void {
  sessionStorage.setItem('rail_access_token', token);
}

export function clearAuthToken(): void {
  sessionStorage.removeItem('rail_access_token');
  sessionStorage.removeItem('rail_user');
}

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: string })?.detail;
    if (detail) return detail;
    if (error.response?.status === 404) return 'Resource not found.';
    if (error.response?.status === 409) return 'Conflict: resource already exists.';
    if (error.response?.status === 422) return 'Validation error — check your input.';
    if (error.response?.status === 403) return 'Insufficient permissions for this action.';
    if (error.code === 'ECONNABORTED') return 'Request timed out. Backend may be slow.';
    if (error.code === 'ERR_NETWORK') return 'Backend unreachable. Is uvicorn running?';
  }
  return 'An unexpected error occurred.';
}

export default apiClient;
