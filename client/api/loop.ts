import { API_URL } from "@/config";
import { useSessionStore } from "@/stores/session";
import axios from "axios";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 10000,
});

type GlobalErrorHandler = (message: string, errorCode?: string) => void;
let globalErrorHandlers: GlobalErrorHandler[] = [];

export const onGlobalApiError = (handler: GlobalErrorHandler) => {
  globalErrorHandlers.push(handler);
  return () => {
    globalErrorHandlers = globalErrorHandlers.filter((h) => h !== handler);
  };
};

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

    if (error.response?.status && error.response.status >= 500) {
      const message = error.response?.data?.error || "Error interno del servidor";
      const errorCode = error.response?.data?.errorCode;
      globalErrorHandlers.forEach((handler) => handler(message, errorCode));
    }

    return Promise.reject(error);
  },
);
