/**
 * Authentication Store Module - GOSU Core Frontend
 */

import { authAPI } from './api';

export interface User {
  id: number;
  email: string;
  full_name?: string;
}

export const authStore = {
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  },

  setToken: (token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('access_token', token);
  },

  getRefreshToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refresh_token');
  },

  setRefreshToken: (token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('refresh_token', token);
  },

  removeToken: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  login: async (username: string, password: string): Promise<{ token: string; refresh_token?: string; user: User }> => {
    const response = await authAPI.login(username, password);
    const { access_token, refresh_token } = response.data;
    
    authStore.setToken(access_token);
    if (refresh_token) {
      authStore.setRefreshToken(refresh_token);
    }
    
    return { 
      token: access_token, 
      refresh_token,
      user: response.data.user || { id: 0, email: username }
    };
  },

  logout: (): void => {
    authStore.removeToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },

  getCurrentUser: async (): Promise<User | null> => {
    try {
      const response = await authAPI.getMe();
      return response.data;
    } catch (error) {
      return null;
    }
  },
};

