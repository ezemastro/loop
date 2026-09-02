import axios from "axios";
import { API_URL } from "@/config";
import { useSessionStore } from "@/stores/session";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 10000,
});

// Rutas de autenticación en sí mismas: un 401 en `login` es una contraseña incorrecta, no una
// sesión vencida, y `logout` no puede reintentar el logout que la interceptó. Excluirlas es lo que
// evita que un login fallido rebote al operador en lugar de mostrarle el error, y que el
// interceptor se reingrese a sí mismo.
const AUTH_ROUTE_RE = /\/admin\/(login|register|google-login|logout)$/;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url ?? "";
    const isAuthRoute = AUTH_ROUTE_RE.test(url);
    if (error.response?.status === 401 && !isAuthRoute) {
      // `getState()` porque este módulo vive fuera de cualquier componente; `location.replace`
      // porque `loop.ts` está fuera del árbol de `RouterProvider` y no tiene `navigate`, y un
      // reload completo descarta cualquier estado de queries obsoleto.
      useSessionStore.getState().logout();
      window.location.replace("/login");
    }
    return Promise.reject(error);
  },
);
