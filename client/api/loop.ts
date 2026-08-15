import { API_URL } from "@/config";
import { useSessionStore } from "@/stores/session";
import axios, { type AxiosResponse } from "axios";

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

/**
 * El servidor puede rotar el token en cualquier respuesta autenticada (por ejemplo para reemitir
 * los emitidos antes de las comunidades). Si no lo guardamos, esos usuarios se quedan afuera
 * cuando el viejo caduque.
 */
const applyRefreshedToken = (response?: AxiosResponse) => {
  const token = response?.headers?.["x-refreshed-token"];
  if (typeof token === "string" && token) {
    useSessionStore.getState().setAuthToken(token);
  }
};

api.interceptors.response.use(
  (response) => {
    applyRefreshedToken(response);
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      useSessionStore.getState().logout();
    } else {
      // En un 401 el token ya no vale; en cualquier otro error la respuesta pudo venir autenticada.
      applyRefreshedToken(error.response);
    }

    if (error.response?.status && error.response.status >= 500) {
      const message = error.response?.data?.error || "Error interno del servidor";
      const errorCode = error.response?.data?.errorCode;
      globalErrorHandlers.forEach((handler) => handler(message, errorCode));
    }

    return Promise.reject(error);
  },
);
