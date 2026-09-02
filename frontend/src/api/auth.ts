import apiClient, { setAuthToken } from './client';
import type { LoginRequest, TokenResponse, UserCreate, AuthUser, SsoLoginRequest, MfaVerifyRequest, MfaVerifyResponse } from '../types';

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const res = await apiClient.post<TokenResponse>('/auth/login', data);
  setAuthToken(res.data.access_token);
  return res.data;
}

export async function ssoLogin(data: SsoLoginRequest): Promise<TokenResponse> {
  const res = await apiClient.post<TokenResponse>('/auth/sso/login', data);
  setAuthToken(res.data.access_token);
  return res.data;
}

export async function verifyMfa(data: MfaVerifyRequest): Promise<MfaVerifyResponse> {
  const res = await apiClient.post<MfaVerifyResponse>('/auth/mfa/verify', data);
  setAuthToken(res.data.access_token);
  return res.data;
}

export async function register(data: UserCreate): Promise<AuthUser> {
  const res = await apiClient.post<AuthUser>('/auth/register', data);
  return res.data;
}

