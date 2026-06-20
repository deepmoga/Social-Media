import api from './client';

export const automationApi = {
  getTriggers: (clientId) => api.get('/automation/triggers', { params: { clientId } }),
  createTrigger: (data) => api.post('/automation/triggers', data),
  updateTrigger: (id, data) => api.put(`/automation/triggers/${id}`, data),
  deleteTrigger: (id) => api.delete(`/automation/triggers/${id}`),
  toggleTrigger: (id) => api.patch(`/automation/triggers/${id}/toggle`),
  getReels: (accountId) => api.get('/automation/reels', { params: { accountId } }),
};
