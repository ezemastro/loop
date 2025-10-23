import {
  MAX_LISTING_DESCRIPTION_LENGTH,
  MAX_LISTING_TITLE_LENGTH,
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
  password: z.string().min(6).max(100),
  confirmPassword: z.string().min(6).max(100),
  schools: z
    .array(
      z.object({
        id: z.uuid(),
      }),
    )
    .min(1),
  role: z.object({
    id: z.uuid(),
  }),
});
export const validateRegisterForm = (data: unknown) => {
  return registerFormSchema.safeParse(data);
};
const loginFormSchema = z.object({
  email: z.email(),
  password: z.string().min(6).max(100),
});
export const validateLoginForm = (data: unknown) => {
  return loginFormSchema.safeParse(data);
};

const publishListingFormSchema = z.object({
  title: z.string().min(2).max(MAX_LISTING_TITLE_LENGTH),
  description: z.string().max(MAX_LISTING_DESCRIPTION_LENGTH).nullable(),
  categoryId: z.uuid(),
  productStatus: z.string().min(2).max(100),
  price: z.number().min(0),
});
export const validatePublishListingForm = (data: unknown) => {
  return publishListingFormSchema.safeParseAsync(data);
};
