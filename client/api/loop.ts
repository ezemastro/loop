import { API_URL } from "@/config";
import { useSessionStore } from "@/stores/session";
import axios from "axios";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = useSessionStore.getState().authToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useSessionStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
