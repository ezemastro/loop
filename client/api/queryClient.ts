import { QueryClient } from "@tanstack/react-query";
import { ERROR_NAMES, type ApiError } from "@/services/errors";

// Vive acá y no en `_layout.tsx` para que el logout pueda vaciarlo sin depender de React: la caché
// es por usuario y, con multi-tenancy, servirle a alguien de otra comunidad la data del anterior
// no es solo un frame feo sino una fuga entre comunidades.
//
// El retry es explícito y no el default de la librería (3 intentos con backoff): con los hooks
// ahora tirando `parseApiError` en cada falla, un 401 reintentado 3 veces demora ~7s el logout de
// `useSelf`. Una sesión vencida se detecta en el primer intento; otros errores se reintentan hasta
// dos veces.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        (error as ApiError)?.name !== ERROR_NAMES.UNAUTHORIZED && failureCount < 2,
    },
  },
});
