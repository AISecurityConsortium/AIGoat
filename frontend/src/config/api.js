import axios from 'axios';

// API Configuration
const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:8000',

  ENDPOINTS: {
    // Authentication
    LOGIN: '/api/auth/login/',
    SIGNUP: '/api/auth/signup/',
    VERIFY_OTP: '/api/auth/verify-otp/',
    DEMO_USERS: '/api/auth/demo-users/',
    
    // Products
    PRODUCTS: '/api/products/',
    PRODUCT_DETAIL: (id) => `/api/products/${id}/`,
    
    // Cart
    CART: '/api/cart/',
    CART_ITEM: (id) => `/api/cart/items/${id}/`,
    
    // Orders
    ORDERS: '/api/orders/',
    ORDER_DETAIL: (id) => `/api/orders/${id}/`,
    CHECKOUT: '/api/checkout/',
    
    // Reviews
    REVIEWS: '/api/reviews/',
    REVIEWS_BY_PRODUCT: (id) => `/api/reviews/${id}/`,
    
    // Search
    SEARCH: '/api/search/',
    
    // Profile
    PROFILE: '/api/profile/',
    PROFILE_PICTURE: '/api/profile/picture/',
    
    // Chat
    CHAT: '/api/chat/',
    DEFENSE_LEVEL: '/api/chat/defense-level',
    DEFENSE_LEVELS: '/api/chat/defense-levels',
    RAG_CHAT: '/api/rag-chat/',
    RAG_CHAT_HISTORY: '/api/rag-chat-history/',
    RAG_STATS: '/api/rag-stats/',
    
    // Knowledge Base
    KNOWLEDGE_BASE: '/api/knowledge-base/',
    
    // Admin
    ADMIN_DASHBOARD: '/api/admin/dashboard/',
    ADMIN_USERS: '/api/admin/users/',
    ADMIN_ORDERS: '/api/admin/orders/',
    ADMIN_INVENTORY: '/api/admin/inventory/',
    ADMIN_COUPONS: '/api/admin/coupons/',
    
    // Coupons
    COUPONS: '/api/coupons/',
    APPLY_COUPON: '/api/coupons/apply/',
    
    // Feature Flags
    FEATURE_FLAGS: '/api/feature-flags/',
    
    // Ollama Status
    OLLAMA_STATUS: '/api/ollama/status/',

    // Workshop / Challenges
    CHALLENGES: '/api/workshop/challenges',
    CHALLENGE_START: (id) => `/api/workshop/challenges/${id}/start`,
    CHALLENGE_COMPLETE: (id) => `/api/workshop/challenges/${id}/complete`,
    LEADERBOARD: '/api/workshop/leaderboard',
  }
};

// Helper function to get full API URL
export const getApiUrl = (endpoint) => {
  if (!endpoint) {
    return API_CONFIG.BASE_URL;
  }
  if (typeof endpoint === 'function') {
    return `${API_CONFIG.BASE_URL}${endpoint()}`;
  }
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Helper function to get base URL
export const getBaseUrl = () => API_CONFIG.BASE_URL;

// Pre-configured Axios instance pointing at the backend
export const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
});

export default API_CONFIG;
