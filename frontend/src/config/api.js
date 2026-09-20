import axios from 'axios';

const envUrl = process.env.REACT_APP_API_URL;

const resolveApiBase = () => {
  if (typeof envUrl === 'string') {
    return envUrl;
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    if (port === '3000' || port === '3001') {
      return `${protocol}//${hostname}:8000`;
    }
    return '';
  }
  return 'http://localhost:8000';
};

const API_CONFIG = {
  BASE_URL: resolveApiBase(),

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
    KNOWLEDGE_BASE_TRACE: '/api/knowledge-base/trace',
    
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

    // Taxonomy (public — no auth)
    FRAMEWORKS: '/api/frameworks/',
    FRAMEWORK_DETAIL: (id) => `/api/frameworks/${id}`,
    RISKS: '/api/risks/',
    RISK_DETAIL: (id) => `/api/risks/${encodeURIComponent(id)}`,

    // Labs
    LABS: '/api/labs/',
    LAB_DETAIL: (id) => `/api/labs/${id}`,
    LAB_START: (id) => `/api/labs/${id}/start`,
    LAB_RESET: (id) => `/api/labs/${id}/reset`,

    // Surfaces
    SURFACES: '/api/surfaces/',
    SURFACE_EXECUTE: (id) => `/api/surfaces/${id}/execute`,

    AGENT_RUNS: '/api/agent/runs',
    AGENT_RUN: (id) => `/api/agent/runs/${id}`,
    AGENT_APPROVE: (id) => `/api/agent/runs/${id}/approve`,
    AGENT_CANCEL: (id) => `/api/agent/runs/${id}/cancel`,

    MCP_SERVERS: '/api/mcp/servers',
    MCP_DISCOVER: (id) => `/api/mcp/servers/${id}/discover`,
    MCP_TOOLS: (id) => `/api/mcp/servers/${id}/tools`,
    MCP_CALL: (id, tool) => `/api/mcp/servers/${id}/tools/${tool}/call`,

    SKILLS: '/api/skills/',
    SKILL_MANIFEST: (id) => `/api/skills/${id}/manifest`,
    SKILL_INSTALL: (id) => `/api/skills/${id}/install`,
    SKILL_EXTERNAL_DOC: (id) => `/api/skills/${id}/external-doc`,
    SKILL_CONVERTER: '/api/skills/converter',

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
