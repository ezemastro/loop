import { API_URL, DEMO_MODE } from "@/config";
import { useSessionStore } from "@/stores/session";
import { demoAdapter, enableDemoMode } from "@/demo";
import axios, { type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 10000,
});

// El adaptador demo está siempre instalado pero inactivo: si se activa en runtime (debug) no
// hay que reinstalar nada. En build con EXPO_PUBLIC_DEMO_MODE=true arranca activo.
const fallbackAdapter = api.defaults.adapter as AxiosAdapter;
api.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
  demoAdapter(config, fallbackAdapter)) as AxiosAdapter;

if (DEMO_MODE) {
  enableDemoMode();
}

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
