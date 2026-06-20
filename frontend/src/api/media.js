import api from './client';

export const mediaApi = {
  upload: async (file, clientId, onProgress) => {
    // Step 1: get presigned URL from backend
    const presignRes = await api.post('/media/presign', {
      clientId,
      filename: file.name,
      mimetype: file.type,
      size: file.size,
    });
    const { uploadUrl, key, publicUrl } = presignRes.data;

    // Step 2: upload directly to R2 (bypasses Apache2 proxy size/timeout limits)
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      if (onProgress) xhr.upload.onprogress = onProgress;
      xhr.onload = () => (xhr.status < 400 ? resolve() : reject(new Error(`R2 upload failed: ${xhr.status}`)));
      xhr.onerror = () => reject(new Error('R2 upload network error'));
      xhr.send(file);
    });

    // Step 3: return same shape as the old /upload endpoint
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
    return {
      data: {
        success: true,
        media: {
          url: publicUrl,
          r2Key: key,
          mediaType,
          mimeType: file.type,
          fileSize: file.size,
          originalName: file.name,
        },
      },
    };
  },

  delete: (r2Key) => api.delete('/media/delete', { data: { r2Key } }),
};
