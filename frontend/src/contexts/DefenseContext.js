import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient as axios } from '../config/api';
import { getApiUrl } from '../config/api';

const LEVELS = {
  0: { level: 0, name: 'Vulnerable', shortLabel: 'L0', color: '#ef4444', icon: '🔓', description: 'No protection — all attacks succeed' },
  1: { level: 1, name: 'Hardened', shortLabel: 'L1', color: '#fbbf24', icon: '🛡️', description: 'Basic prompt hardening active' },
  2: { level: 2, name: 'Guardrailed', shortLabel: 'L2', color: '#4ade80', icon: '🔒', description: 'Input/output guardrails active' },
};

const DefenseContext = createContext();

export const DefenseProvider = ({ children }) => {
  const [defenseLevel, setDefenseLevel] = useState(() => {
    const stored = localStorage.getItem('aigoat_defense_level');
    return stored !== null ? parseInt(stored, 10) : 0;
  });
  const [loading, setLoading] = useState(false);

  const levelDetails = LEVELS[defenseLevel] || LEVELS[0];

  const syncFromBackend = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await axios.get(getApiUrl('/api/chat/defense-levels'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const backendLevel = res.data.current_level;
      if (typeof backendLevel === 'number' && backendLevel !== defenseLevel) {
        setDefenseLevel(backendLevel);
        localStorage.setItem('aigoat_defense_level', String(backendLevel));
      }
    } catch {
      // Backend may not be reachable; localStorage fallback is fine
    }
  }, [defenseLevel]);

  useEffect(() => {
    syncFromBackend();
  }, [syncFromBackend]);

  const changeDefenseLevel = useCallback(async (level) => {
    const numLevel = parseInt(level, 10);
    if (![0, 1, 2].includes(numLevel)) return { success: false, error: 'Invalid level' };

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(getApiUrl('/api/chat/defense-level'), { level: numLevel }, { headers });

      setDefenseLevel(numLevel);
      localStorage.setItem('aigoat_defense_level', String(numLevel));

      window.dispatchEvent(new CustomEvent('defenseLevelChanged', { detail: { level: numLevel } }));
      return { success: true };
    } catch (err) {
      // Fallback: still update locally even if backend fails
      setDefenseLevel(numLevel);
      localStorage.setItem('aigoat_defense_level', String(numLevel));
      window.dispatchEvent(new CustomEvent('defenseLevelChanged', { detail: { level: numLevel } }));
      return { success: true, warning: 'Backend sync failed, saved locally' };
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <DefenseContext.Provider value={{ defenseLevel, levelDetails, changeDefenseLevel, loading, LEVELS }}>
      {children}
    </DefenseContext.Provider>
  );
};

export const useDefense = () => {
  const context = useContext(DefenseContext);
  if (!context) {
    throw new Error('useDefense must be used within a DefenseProvider');
  }
  return context;
};

export default DefenseContext;
