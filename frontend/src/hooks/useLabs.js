import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../config/api';
import API_CONFIG from '../config/api';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const labCache = new Map();
const labInflight = new Map();

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
    const params = {};
    if (framework) params.framework = framework;
    if (risk) params.risk = risk;
    if (surface) params.surface = surface;
    if (difficulty) params.difficulty = difficulty;
    if (status) params.status = status;
    const key = JSON.stringify(params);
    if (labCache.has(key)) {
      setLabs(labCache.get(key));
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let pending = labInflight.get(key);
      if (!pending) {
        pending = apiClient.get(API_CONFIG.ENDPOINTS.LABS, {
          params,
          headers: authHeaders(),
        }).then(({ data }) => (Array.isArray(data) ? data : []));
        labInflight.set(key, pending);
      }
      const data = await pending;
      labCache.set(key, data);
      labInflight.delete(key);
      setLabs(data);
      setError(null);
    } catch (err) {
      labInflight.delete(key);
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
