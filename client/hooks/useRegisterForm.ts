import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useRegister } from "./useRegister";
import { validateRegisterForm } from "@/services/validations";
import { z } from "zod";
import { getUserFriendlyErrorMessage } from "@/services/errorMapping";
import { useToast } from "@/components/ToastProvider";

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
  const router = useRouter();
  const { showToast } = useToast();
  const {
    mutate: register,
    isError: isRegisterError,
    error: registerError,
    isPending: isLoading,
    isSuccess,
    data,
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

  useEffect(() => {
    if (isSuccess && data) {
      showToast(data.message || "Cuenta creada. Revisá tu email para verificarla.", "success");
      router.replace("/");
    }
  }, [isSuccess, data, showToast, router]);

  useEffect(() => {
    if (isRegisterError && registerError) {
      const err = registerError as unknown as Record<string, unknown>;
      if (err.errorCode === "USER_ALREADY_EXISTS") {
        showToast(
          "Ese correo ya está registrado. Si no verificaste tu email, revisá tu bandeja de entrada.",
          "error",
          6000,
        );
      }
    }
  }, [isRegisterError, registerError, showToast]);

  const handleSubmit = () => {
    const parsedFromData = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim(),
      password: formData.password.trim(),
      confirmPassword: formData.confirmPassword.trim(),
      schools: formData.schools,
    };
    const validationResult = validateRegisterForm(parsedFromData);
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
          formData.password !== formData.confirmPassword ? "Las contraseñas no coinciden" : null,
        schools: formattedErrors.schools?._errors[0] || null,
      });
    }
  };

  const displayError = isRegisterError ? getUserFriendlyErrorMessage(registerError) : undefined;

  return {
    formData,
    setFormData,
    errors,
    handleSubmit,
    isRegisterError,
    registerError,
    displayError,
    isLoading,
    isSuccess,
  };
};
