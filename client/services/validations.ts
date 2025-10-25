import {
  MAX_LISTING_DESCRIPTION_LENGTH,
  MAX_LISTING_TITLE_LENGTH,
  PRODUCT_STATUSES,
  VALID_EMAIL_DOMAINS,
} from "@/config";
import { z } from "zod";

const registerFormSchema = z.object({
  firstName: z
    .string()
    .min(2, "El nombre es demasiado corto")
    .max(100, "El nombre es demasiado largo"),
  lastName: z
    .string()
    .min(2, "El apellido es demasiado corto")
    .max(100, "El apellido es demasiado largo"),
  email: z.email("El correo electrónico no es válido").refine((email) => {
    const domain = email.split("@")[1];
    return VALID_EMAIL_DOMAINS.includes(domain);
  }, "El correo electrónico debe pertenecer a Reditinere"),
  password: z
    .string()
    .min(6, "La contraseña es demasiado corta")
    .max(100, "La contraseña es demasiado larga"),
  confirmPassword: z.string(),
  schools: z
    .array(
      z.object({
        id: z.uuid(),
      }),
      "Debes seleccionar al menos una escuela",
    )
    .min(1, "Debes seleccionar al menos una escuela"),
});
export const validateRegisterForm = (data: unknown) => {
  return registerFormSchema.safeParse(data);
};
const loginFormSchema = z.object({
  email: z.email("El correo electrónico no es válido"),
  password: z.string(),
});
export const validateLoginForm = (data: unknown) => {
  return loginFormSchema.safeParse(data);
};

const publishListingFormSchema = z.object({
  title: z
    .string()
    .min(2, "El título es demasiado corto")
    .max(MAX_LISTING_TITLE_LENGTH, "El título es demasiado largo"),
  description: z
    .string()
    .max(MAX_LISTING_DESCRIPTION_LENGTH, "La descripción es demasiado larga")
    .nullable(),
  categoryId: z.uuid(),
  productStatus: z.string().refine((status) => {
    return Object.values(PRODUCT_STATUSES).includes(status as ProductStatus);
  }, "El estado del producto no es válido"),
  price: z.number().min(1, "Introduce un precio válido"),
});
export const validatePublishListingForm = (data: unknown) => {
  return publishListingFormSchema.safeParseAsync(data);
};
