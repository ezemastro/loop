import { API_URL, DEMO_MODE } from "@/config";
import { useSessionStore } from "@/stores/session";
import { DEMO_READ_ONLY_ERROR_CODE, demoAdapter, enableDemoMode } from "@/demo";
import axios, { type AxiosAdapter, type AxiosResponse } from "axios";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 10000,
});

// El adaptador demo está siempre instalado pero inactivo: si se activa en runtime no hay que
// reinstalar nada. En build con EXPO_PUBLIC_DEMO_MODE=true arranca activo.
//
// `defaults.adapter` **no es una función**: axios 1.x guarda ahí la lista de candidatos
// (`['xhr', 'http', 'fetch']`) y elige uno por request. Castearla a `AxiosAdapter` compilaba pero
// reventaba en runtime con "fallback is not a function" apenas el modo demo estaba apagado — o sea,
// en el uso normal de la app. `getAdapter` hace exactamente la resolución que hace axios adentro.
const fallbackAdapter = axios.getAdapter(api.defaults.adapter);
const demoAwareAdapter: AxiosAdapter = (config) => demoAdapter(config, fallbackAdapter);
api.defaults.adapter = demoAwareAdapter;

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

    const errorCode = error.response?.data?.errorCode;

    if (errorCode === DEMO_READ_ONLY_ERROR_CODE) {
      // El aviso del modo demo se emite desde un solo lugar. Si cada pantalla tuviera que
      // manejarlo, la primera que se olvide deja al usuario apretando un botón que no hace nada
      // y sin ninguna explicación.
      const message = error.response?.data?.error || "Estás en modo demo.";
      globalErrorHandlers.forEach((handler) => handler(message, errorCode));
    } else if (error.response?.status && error.response.status >= 500) {
      const message = error.response?.data?.error || "Error interno del servidor";
      globalErrorHandlers.forEach((handler) => handler(message, errorCode));
    }

    return Promise.reject(error);
  },
);
