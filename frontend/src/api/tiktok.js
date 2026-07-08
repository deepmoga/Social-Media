import api from './client';

export const tiktokApi = {
  getOAuthUrl: (clientId) => api.get(`/tiktok/oauth-url?clientId=${clientId}`),
  disconnect:  (accountId) => api.delete(`/tiktok/accounts/${accountId}`),
};
