import axios from 'axios';

export const login = async (username, password) => {
  const response = await axios.post('/api/auth/login', { username, password });
  const payload = response.data;

  if (payload?.success && payload?.token) {
    localStorage.setItem('authToken', payload.token);
    localStorage.setItem('user', payload.user || username);
    localStorage.setItem('role', payload.role || 'auditor');
  }

  return payload;
};

// Check if user is logged in
export const isAuthenticated = () => {
  const token = localStorage.getItem('authToken');
  const user = localStorage.getItem('user');
  return Boolean(token && user);
};

export const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getCurrentRole = () => {
  return localStorage.getItem('role') || 'auditor';
};

// Logout function
export const logout = () => {
  const token = localStorage.getItem('authToken');
  if (token) {
    axios.post('/api/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  }
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  localStorage.removeItem('role');
  return { success: true };
};

export default {
  login,
  isAuthenticated,
  getAuthHeaders,
  getCurrentRole,
  logout
};

