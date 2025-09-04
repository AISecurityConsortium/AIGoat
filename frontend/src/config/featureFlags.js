/**
 * Feature Flags Configuration for Red Team Shop Frontend
 * 
 * This file now fetches feature flags dynamically from the backend API
 * to ensure centralized control. Features can be toggled on/off by modifying
 * only the backend configuration file.
 */

import axios from 'axios';

// Default fallback values (used if API is unavailable)
const DEFAULT_FEATURE_FLAGS = {
  rag_system: false,
  admin_dashboard: true,
  admin_order_management: true,
  admin_user_management: true,
  admin_inventory_management: true,
  admin_coupon_management: true,
  user_profile: true,
  card_number_masking: true,
  input_validation: true,
  personalized_search: true,
  product_recommendations: true,
  payment_processing: true,
  order_tracking: true,
  coupon_system: true,
  chat_system: true,
};

// Cache for feature flags
let featureFlagsCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch feature flags from the backend API
 * @returns {Promise<Object>} - Object with feature names as keys and boolean values
 */
export const fetchFeatureFlags = async () => {
  try {
    const response = await axios.get('/api/feature-flags/');
    return response.data;
  } catch (error) {
    console.warn('Failed to fetch feature flags from backend, using defaults:', error.message);
    return DEFAULT_FEATURE_FLAGS;
  }
};

/**
 * Get feature flags with caching
 * @returns {Promise<Object>} - Object with feature names as keys and boolean values
 */
export const getFeatureFlags = async () => {
  const now = Date.now();
  
  // Return cached flags if still valid
  if (featureFlagsCache && (now - lastFetchTime) < CACHE_DURATION) {
    return featureFlagsCache;
  }
  
  // Fetch fresh flags
  featureFlagsCache = await fetchFeatureFlags();
  lastFetchTime = now;
  
  return featureFlagsCache;
};

/**
 * Check if a specific feature is enabled
 * @param {string} featureName - Name of the feature to check
 * @returns {Promise<boolean>} - True if feature is enabled, False otherwise
 */
export const isFeatureEnabled = async (featureName) => {
  const flags = await getFeatureFlags();
  return flags[featureName] === true;
};

/**
 * Get all enabled features as an object
 * @returns {Promise<Object>} - Object with feature names as keys and boolean values
 */
export const getEnabledFeatures = async () => {
  return await getFeatureFlags();
};

/**
 * Clear the feature flags cache (useful for testing or forcing refresh)
 */
export const clearFeatureFlagsCache = () => {
  featureFlagsCache = null;
  lastFetchTime = 0;
};

// Legacy exports for backward compatibility (deprecated)
// These will be removed in future versions
export const RAG_SYSTEM_ENABLED = false; // Deprecated - use isFeatureEnabled('rag_system')
export const ADMIN_DASHBOARD_ENABLED = true; // Deprecated - use isFeatureEnabled('admin_dashboard')
export const ADMIN_ORDER_MANAGEMENT_ENABLED = true; // Deprecated - use isFeatureEnabled('admin_order_management')
export const ADMIN_USER_MANAGEMENT_ENABLED = true; // Deprecated - use isFeatureEnabled('admin_user_management')
export const ADMIN_INVENTORY_MANAGEMENT_ENABLED = true; // Deprecated - use isFeatureEnabled('admin_inventory_management')
export const ADMIN_COUPON_MANAGEMENT_ENABLED = true; // Deprecated - use isFeatureEnabled('admin_coupon_management')
export const USER_PROFILE_ENABLED = true; // Deprecated - use isFeatureEnabled('user_profile')
export const CARD_NUMBER_MASKING_ENABLED = true; // Deprecated - use isFeatureEnabled('card_number_masking')
export const INPUT_VALIDATION_ENABLED = true; // Deprecated - use isFeatureEnabled('input_validation')
export const PERSONALIZED_SEARCH_ENABLED = true; // Deprecated - use isFeatureEnabled('personalized_search')
export const PRODUCT_RECOMMENDATIONS_ENABLED = true; // Deprecated - use isFeatureEnabled('product_recommendations')
export const PAYMENT_PROCESSING_ENABLED = true; // Deprecated - use isFeatureEnabled('payment_processing')
export const ORDER_TRACKING_ENABLED = true; // Deprecated - use isFeatureEnabled('order_tracking')
export const COUPON_SYSTEM_ENABLED = true; // Deprecated - use isFeatureEnabled('coupon_system')
export const CHAT_SYSTEM_ENABLED = true; // Deprecated - use isFeatureEnabled('chat_system')
