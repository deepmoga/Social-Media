import api from './client';

export const metaApi = {
  getOAuthUrl: (clientId) => api.get('/meta/oauth-url', { params: { clientId } }),
  getDiscovered: (sessionKey) => api.get('/meta/discovered', { params: { sessionKey } }),
  connectAccounts: (data) => api.post('/meta/connect', data),
  disconnect: (accountId) => api.delete(`/meta/accounts/${accountId}`),
  rateLimit: (accountId) => api.get(`/meta/rate-limit/${accountId}`),
};
