import z from "zod";

const emailSchema = z.email("Formato de email inválido");
const passwordSchema = z
  .string()
  .min(6, "Contraseña debe tener al menos 6 caracteres")
  .max(100, "Contraseña debe tener como máximo 100 caracteres");

export const adminRegisterSchema = z.object({
  email: emailSchema,
  fullName: z
    .string()
    .min(2, "Nombre completo debe tener al menos 2 caracteres")
    .max(100, "Nombre completo debe tener como máximo 100 caracteres"),
  password: passwordSchema,
});
export const adminLoginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
