import { useState, useEffect } from 'react';
import { getFeatureFlags, isFeatureEnabled } from '../config/featureFlags';

/**
 * React hook for accessing feature flags
 * @returns {Object} - Object containing feature flags and utility functions
 */
export const useFeatureFlags = () => {
  const [flags, setFlags] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFlags = async () => {
      try {
        setLoading(true);
        const featureFlags = await getFeatureFlags();
        setFlags(featureFlags);
        setError(null);
      } catch (err) {
        console.error('Error fetching feature flags:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchFlags();
  }, []);

  const checkFeature = async (featureName) => {
    try {
      return await isFeatureEnabled(featureName);
    } catch (err) {
      console.error(`Error checking feature ${featureName}:`, err);
      return false;
    }
  };

  return {
    flags,
    loading,
    error,
    checkFeature,
    isFeatureEnabled: checkFeature,
  };
};

/**
 * React hook for checking a specific feature flag
 * @param {string} featureName - Name of the feature to check
 * @returns {Object} - Object containing enabled state, loading state, and error
 */
export const useFeatureFlag = (featureName) => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkFeature = async () => {
      try {
        setLoading(true);
        const isEnabled = await isFeatureEnabled(featureName);
        setEnabled(isEnabled);
        setError(null);
      } catch (err) {
        console.error(`Error checking feature ${featureName}:`, err);
        setError(err);
        setEnabled(false);
      } finally {
        setLoading(false);
      }
    };

    checkFeature();
  }, [featureName]);

  return {
    enabled,
    loading,
    error,
  };
};
