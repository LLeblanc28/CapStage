import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { get, post, put } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [platform, setPlatform] = useState('CapStage');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await get('/auth/me');
    setUser(data.user);
    setPlatform(data.platform_name || 'CapStage');
    return data.user;
  }, []);

  useEffect(() => {
    refresh()
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [refresh]);

  const value = useMemo(
    () => ({
      user,
      platform,
      loading,
      refresh,
      login: async (email, password) => {
        const data = await post('/auth/login', { email, password });
        setUser(data.user);
        return data.user;
      },
      register: async (payload) => {
        const data = await post('/auth/register', payload);
        setUser(data.user);
        return data.user;
      },
      logout: async () => {
        await post('/auth/logout');
        setUser(null);
      },
      updateProfile: async (payload) => {
        const data = await put('/auth/profile', payload);
        setUser(data.user);
        return data.user;
      },
    }),
    [user, platform, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit etre utilise dans AuthProvider');
  return ctx;
}
