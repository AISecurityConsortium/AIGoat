import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../config/api';
import API_CONFIG from '../config/api';

const fetchPublic = (path) => apiClient.get(path);

/**
 * List all frameworks. Taxonomy endpoints are public. Do not send auth.
 * @returns {{frameworks: Array, loading: boolean, error: Error|null, refetch: Function}}
 */
export const useFrameworks = () => {
  const [frameworks, setFrameworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchPublic(API_CONFIG.ENDPOINTS.FRAMEWORKS);
      setFrameworks(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err);
      setFrameworks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { frameworks, loading, error, refetch };
};

/**
 * One framework with its risks, attribution, and maturity note.
 * @param {string|null} id
 */
export const useFramework = (id) => {
  const [framework, setFramework] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setFramework(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const { data } = await fetchPublic(API_CONFIG.ENDPOINTS.FRAMEWORK_DETAIL(id));
      setFramework(data);
      setError(null);
    } catch (err) {
      setError(err);
      setFramework(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { framework, loading, error, refetch };
};

/**
 * One fully expanded risk. `riskId` is the qualified id (`owasp-llm-2026:LLM01`).
 * @param {string|null} riskId
 */
export const useRisk = (riskId) => {
  const [risk, setRisk] = useState(null);
  const [loading, setLoading] = useState(Boolean(riskId));
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!riskId) {
      setRisk(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const { data } = await fetchPublic(API_CONFIG.ENDPOINTS.RISK_DETAIL(riskId));
      setRisk(data);
      setError(null);
    } catch (err) {
      setError(err);
      setRisk(null);
    } finally {
      setLoading(false);
    }
  }, [riskId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { risk, loading, error, refetch };
};
