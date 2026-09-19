import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api' });

// The new backend issues its own JWT; TestForge stores it after login.
api.interceptors.request.use((config) => {
  try {
    const saved = JSON.parse(localStorage.getItem('testforge.auth') ?? 'null') as { token?: string } | null;
    if (saved?.token) config.headers.Authorization = `Bearer ${saved.token}`;
  } catch {
    // Requests without a token receive the backend's normal 401 response.
  }
  return config;
});

export default api;
