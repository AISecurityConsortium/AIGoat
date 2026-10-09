import API_CONFIG, { apiClient } from '../../config/api';

const base = () => API_CONFIG.ENDPOINTS?.KILLCHAIN || '/api/killchain';

const headers = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const call = (method, path, data, config = {}) => apiClient.request({
  method, url: `${base()}${path}`, data, headers: { ...headers(), ...(config.headers || {}) }, ...config,
}).then((res) => res.data);

export const getState = () => call('get', '/state');
export const getEvents = (after) => call('get', '/events', undefined, { params: { after } });
export const getExamples = () => call('get', '/examples');
export const getModels = () => call('get', '/models');
export const setMode = (mode) => call('post', '/mode', { mode });
export const postReview = (body) => call('post', '/reviews', body);
export const postTicket = (form) => call('post', '/tickets', form);
export const postAttachment = (ticketId, form) => call('post', `/tickets/${ticketId}/attachment`, form);
export const getAttachment = (id) => call('get', `/attachments/${id}`);
export const postTurn = (message, model) => call('post', '/turn', { message, model: model || null });
export const postDecision = (id, decision) => call('post', `/approvals/${id}/decision`, { decision });
export const postStorefrontCoupon = (code, product) => call('post', '/storefront/coupon', { code, product });
export const postCleanup = (kind) => call('post', `/cleanup/${kind}`);

/** Fetch a PDF with the login token and hand it to the browser as a download. */
export const downloadPdf = async (path, filename) => {
  const blob = await call('get', path, undefined, { responseType: 'blob' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

/** A message safe to show a person. */
export const errorText = (error, fallback = 'The request failed.') => {
  const status = error?.response?.status;
  if (status === 401) return 'Please log in to use this lab.';
  if (status === 403) return 'This lab needs an administrator. Sign in as admin / admin123.';
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  return fallback;
};
