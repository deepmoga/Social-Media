import api from './client';

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    api.patch('/auth/me/password', { currentPassword, newPassword }),
};
