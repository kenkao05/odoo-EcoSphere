import axios from "axios";

// VITE_API_URL is set in .env for the deployed build (Railway backend URL).
// In dev, Vite's proxy (vite.config.js) forwards /api to localhost:4000, so
// this falls back to a relative path and the proxy handles the rest.
const baseURL = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ecosphere_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Any 401 means the token is missing/expired — bounce to login rather than
// showing a silent failure. Every page's data-fetching effect can just
// `catch(() => {})` past this since the redirect already happened.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("ecosphere_token");
      localStorage.removeItem("ecosphere_employee");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);