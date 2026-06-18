import api from './client';

export const mediaApi = {
  upload: (file, clientId, onProgress) => {
    const form = new FormData();
    form.append('file', file);
    form.append('clientId', clientId);
    return api.post('/media/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
  },
  delete: (r2Key) => api.delete('/media/delete', { data: { r2Key } }),
};
