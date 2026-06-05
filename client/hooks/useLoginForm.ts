import { useState } from "react";
import { useLogin } from "./useLogin";
import { validateLoginForm } from "@/services/validations";
import { getUserFriendlyErrorMessage } from "@/services/errorMapping";

interface FormData {
  email: string;
  password: string;
}
type FormErrors = Record<keyof FormData, boolean>;

export const useLoginForm = () => {
  const {
    mutateAsync: login,
    isError: isLoginError,
    error: loginError,
    isPending: isLoginLoading,
    data: loginData,
  } = useLogin();
  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<FormErrors>({
    email: false,
    password: false,
  });

  const handleSubmit = () => {
    const validationResult = validateLoginForm(formData);
    const errors: FormErrors = {
      email: false,
      password: false,
    };
    validationResult.error?.issues.forEach((issue) => {
      errors[issue.path[0] as keyof FormData] = true;
    });
    if (Object.values(errors).some((error) => error)) {
      return setErrors(errors);
    }
    setErrors(errors);

    login({
      email: formData.email,
      password: formData.password,
    });
  };

  const loginErrorMessage = loginError ? getUserFriendlyErrorMessage(loginError) : undefined;

  return {
    formData,
    setFormData,
    errors,
    handleSubmit,
    isLoginError,
    loginErrorMessage,
    isLoginLoading,
    loginData,
  };
};
