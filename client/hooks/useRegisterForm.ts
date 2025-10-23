import { useState } from "react";
import { useRegister } from "./useRegister";
import { validateRegisterForm } from "@/services/validations";
import { z } from "zod";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  schools: School[] | null;
}
type FormErrors = Record<keyof FormData, string | null>;
const INITIAL_ERRORS: FormErrors = {
  confirmPassword: null,
  email: null,
  firstName: null,
  lastName: null,
  password: null,
  schools: null,
};

export const useRegisterForm = () => {
  const {
    mutate: register,
    isError: isRegisterError,
    error: registerError,
  } = useRegister();
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    schools: null,
  });
  const [errors, setErrors] = useState<FormErrors>(INITIAL_ERRORS);

  const handleSubmit = () => {
    const validationResult = validateRegisterForm(formData);
    if (validationResult.success) {
      setErrors(INITIAL_ERRORS);
      register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        schoolIds: formData.schools!.map((school) => school.id),
      });
    } else {
      const formattedErrors = z.formatError(validationResult.error);
      setErrors({
        firstName: formattedErrors.firstName?._errors[0] || null,
        lastName: formattedErrors.lastName?._errors[0] || null,
        email: formattedErrors.email?._errors[0] || null,
        password: formattedErrors.password?._errors[0] || null,
        confirmPassword:
          formData.password !== formData.confirmPassword
            ? "Las contraseñas no coinciden"
            : null,
        schools: formattedErrors.schools?._errors[0] || null,
      });
    }
  };
  return {
    formData,
    setFormData,
    errors,
    handleSubmit,
    isRegisterError,
    registerError,
  };
};
