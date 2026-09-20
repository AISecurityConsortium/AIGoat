import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../config/api';
import API_CONFIG from '../config/api';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Fetch labs from GET /api/labs/ with optional filters.
 * @param {{framework?: string, risk?: string, surface?: string, difficulty?: string, status?: string}} [filters]
 * @returns {{labs: Array, loading: boolean, error: Error|null, refetch: Function}}
 */
export const useLabs = (filters = {}) => {
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const framework = filters.framework || undefined;
  const risk = filters.risk || undefined;
  const surface = filters.surface || undefined;
  const difficulty = filters.difficulty || undefined;
  const status = filters.status || undefined;

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (framework) params.framework = framework;
      if (risk) params.risk = risk;
      if (surface) params.surface = surface;
      if (difficulty) params.difficulty = difficulty;
      if (status) params.status = status;
      const { data } = await apiClient.get(API_CONFIG.ENDPOINTS.LABS, {
        params,
        headers: authHeaders(),
      });
      setLabs(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err);
      setLabs([]);
    } finally {
      setLoading(false);
    }
  }, [framework, risk, surface, difficulty, status]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { labs, loading, error, refetch };
};
