import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.reload(); // simplest reliable way to drop back to AuthProvider's logged-out state
    }
    const message = err.response?.data?.error || err.message || 'Request failed';
    return Promise.reject(new Error(message));
  }
);

export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getTrends: () => api.get('/dashboard/trends')
};

export const ticketsAPI = {
  getAll: (params) => api.get('/tickets', { params }),
  getById: (id) => api.get(`/tickets/${id}`),
  create: (data) => api.post('/tickets', data),
  update: (id, data) => api.patch(`/tickets/${id}`, data),
  delete: (id) => api.delete(`/tickets/${id}`),
  fix: (id, data = {}) => api.post(`/tickets/${id}/fix`, data),
  syncServiceNow: (id) => api.post(`/tickets/${id}/sync-servicenow`),
  syncJira: (id) => api.post(`/tickets/${id}/sync-jira`)
};

export const monitoringAPI = {
  getStatus: () => api.get('/monitoring/status'),
  getLogs: (limit) => api.get('/monitoring/logs', { params: { limit } }),
  getAlerts: () => api.get('/monitoring/alerts'),
  acknowledgeAlert: (id) => api.post(`/monitoring/alerts/${id}/acknowledge`),
  triggerScan: () => api.post('/monitoring/trigger-scan'),
  getIflows: () => api.get('/monitoring/iflows'),
  start: () => api.post('/monitoring/start'),
  stop: () => api.post('/monitoring/stop')
};

export const agentAPI = {
  chat: (messages) => api.post('/agent/chat', { messages }),
  simulate: (scenario) => api.post('/agent/simulate', { scenario }),
  processIncident: (data) => api.post('/agent/process-incident', data),
  getLogs: () => api.get('/agent/logs')
};

export const analysisAPI = {
  analyze: (data) => api.post('/analysis/analyze', data),
  getScenarios: () => api.get('/analysis/scenarios')
};

export const tenantsAPI = {
  getAll: () => api.get('/tenants'),
  create: (data) => api.post('/tenants', data),
  test: (id) => api.post(`/tenants/${id}/test`),
  update: (id, data) => api.patch(`/tenants/${id}`, data),
  activate: (id) => api.post(`/tenants/${id}/activate`),
  delete: (id) => api.delete(`/tenants/${id}`)
};

export const jiraAPI = {
  get: () => api.get('/jira'),
  connect: (data) => api.post('/jira', data),
  test: () => api.post('/jira/test'),
  disconnect: () => api.delete('/jira')
};

export default api;