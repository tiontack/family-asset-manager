import axios from 'axios';

// 개발: vite proxy 통해 /api → localhost:3001
// 프로덕션: VITE_API_URL 환경변수로 백엔드 URL 주입 (자동으로 /api 경로 포함)
const _apiBase = import.meta.env.VITE_API_URL;
const baseURL = _apiBase ? `${_apiBase}/api` : '/api';

const api = axios.create({
  baseURL,
  timeout: 30000,
});

api.interceptors.response.use(
  res => res,
  err => {
    console.error('API Error:', err.response?.data || err.message);
    return Promise.reject(err);
  }
);

export default api;
