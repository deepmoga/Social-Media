import api from './client';

export const clientsApi = {
  list: () => api.get('/clients'),
  get: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.patch(`/clients/${id}`, data),
  delete: (id) => api.delete(`/clients/${id}`),
  grantAccess: (clientId, userId) => api.post(`/clients/${clientId}/team`, { userId }),
  revokeAccess: (clientId, userId) => api.delete(`/clients/${clientId}/team/${userId}`),
};
