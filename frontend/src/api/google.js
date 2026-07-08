import api from './client';

export const googleApi = {
  getOAuthUrl:   (clientId)                             => api.get(`/google/oauth-url?clientId=${clientId}`),
  getLocations:  (sessionKey)                           => api.get(`/google/locations?sessionKey=${sessionKey}`),
  connect:       (sessionKey, selectedLocationNames, clientId) =>
    api.post('/google/connect', { sessionKey, selectedLocationNames, clientId }),
  disconnect:    (accountId)                            => api.delete(`/google/accounts/${accountId}`),
};
