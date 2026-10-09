import { apiClient } from '../config/api';

/**
 * Switch the signed-in demo user between alice and admin, then load `returnPath`.
 * Used by labs that have a customer role and an admin role. Does nothing for other users.
 */
export const switchToUser = async (target, returnPath) => {
  const res = await apiClient.get('/api/auth/demo-users/');
  const match = (res.data.users || []).find((row) => row.username === target);
  if (!match?.demo_token) return false;
  localStorage.setItem('token', match.demo_token);
  localStorage.setItem('username', target);
  window.location.assign(returnPath);
  return true;
};

export const currentUsername = () => localStorage.getItem('username') || '';
