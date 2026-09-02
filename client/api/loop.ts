import { API_URL, DEMO_MODE } from "@/config";
import { useSessionStore } from "@/stores/session";
import { DEMO_READ_ONLY_ERROR_CODE, demoAdapter, enableDemoMode } from "@/demo";
import axios, { type AxiosAdapter, type AxiosError, type AxiosResponse } from "axios";

// Sin `withCredentials`: la API se autentica por bearer token (interceptor de request más abajo),
// así que mandar cookies cross-origin solo agrega un requisito de CORS credentials sin ningún
// beneficio.
export const api = axios.create({
  baseURL: API_URL,
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

/**
 * Publishes to the same handler list `onGlobalApiError` subscribes to — `ToastProvider` is already
 * listening, so `services/showAlert.ts` reaches the toast on web without needing a hook or a
 * second notification system. No `errorCode` is passed, so `getUserFriendlyErrorMessage` returns
 * the message verbatim rather than mapping it.
 */
export const emitGlobalApiError = (message: string) => {
  globalErrorHandlers.forEach((handler) => handler(message));
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

/**
 * Un 401 solo cierra la sesión cuando la request que falló llevaba el header `Authorization` (así
 * que usaba el token guardado) y no era contra `/auth/*` (donde un 401 es un veredicto de
 * credenciales — contraseña incorrecta, email sin verificar — no una sesión vencida). El header lo
 * pone el interceptor de request de acá arriba solo cuando hay token, así que su presencia es un
 * proxy exacto de "esta request usaba la sesión guardada": ambas condiciones son necesarias, porque
 * `/auth/login` no lleva header estando deslogueado, pero sí lo lleva cuando alguien ya logueado se
 * reautentica, y ese 401 tampoco debe cerrarle la sesión.
 */
export const shouldLogout = (error: AxiosError): boolean => {
  if (error.response?.status !== 401) return false;
  if (!error.config?.headers?.Authorization) return false;
  const path = (error.config.url ?? "").replace(/^https?:\/\/[^/]+/, "");
  return !path.startsWith("/auth/");
};

api.interceptors.response.use(
  (response) => {
    applyRefreshedToken(response);
    return response;
  },
  (error) => {
    if (shouldLogout(error)) {
      useSessionStore.getState().logout();
    } else if (error.response?.status !== 401) {
      // En cualquier 401 el token que se usó ya no vale, se cierre sesión o no; en cualquier otro
      // error la respuesta pudo venir autenticada.
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
