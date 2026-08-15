import { QueryClient } from "@tanstack/react-query";

// Vive acá y no en `_layout.tsx` para que el logout pueda vaciarlo sin depender de React: la caché
// es por usuario y, con multi-tenancy, servirle a alguien de otra comunidad la data del anterior
// no es solo un frame feo sino una fuga entre comunidades.
export const queryClient = new QueryClient();
