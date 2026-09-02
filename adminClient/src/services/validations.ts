import z from "zod";

export const emailSchema = z.email("Formato de email inválido");

/**
 * Mínimo de 8, para que coincida con el mínimo de creación del API (sec-hardening-api, D6). Solo
 * para altas — nunca para login: un admin con una contraseña de 6 o 7 caracteres, creada antes de
 * este cambio, tiene que poder seguir entrando.
 */
const passwordCreationSchema = z
  .string()
  .min(8, "Contraseña debe tener al menos 8 caracteres")
  .max(100, "Contraseña debe tener como máximo 100 caracteres");

/** Sin mínimo propio, igual que el schema de login del API: la contraseña ya existe. */
const passwordLoginSchema = z
  .string()
  .min(1, "Contraseña requerida")
  .max(100, "Contraseña debe tener como máximo 100 caracteres");

export const adminRegisterSchema = z.object({
  email: emailSchema,
  fullName: z
    .string()
    .min(2, "Nombre completo debe tener al menos 2 caracteres")
    .max(100, "Nombre completo debe tener como máximo 100 caracteres"),
  password: passwordCreationSchema,
});
export const adminLoginSchema = z.object({
  email: emailSchema,
  password: passwordLoginSchema,
});
