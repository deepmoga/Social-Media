import api from './client';

export const postsApi = {
  list: (params) => api.get('/posts', { params }),
  get: (id) => api.get(`/posts/${id}`),
  create: (data) => api.post('/posts', data),
  update: (id, data) => api.patch(`/posts/${id}`, data),
  delete: (id) => api.delete(`/posts/${id}`),
  publishNow: (id) => api.post(`/posts/${id}/publish-now`),
  retry: (id, postPlatformId) => api.post(`/posts/${id}/retry/${postPlatformId}`),
  logs: (id, ppId) => api.get(`/posts/${id}/logs/${ppId}`),
  calendar: (params) => api.get('/posts/calendar', { params }),
};
