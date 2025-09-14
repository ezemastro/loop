import {
  MAX_LISTING_DESCRIPTION_LENGTH,
  MAX_LISTING_TITLE_LENGTH,
} from "@/config";
import { z } from "zod";

const registerFormSchema = z.object({
  firstName: z.string().min(2).max(100),
  lastName: z.string().min(2).max(100),
  email: z.email(),
  password: z.string().min(6).max(100),
  confirmPassword: z.string().min(6).max(100),
  school: z.object({
    id: z.uuid(),
  }),
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
