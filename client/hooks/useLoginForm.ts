import { useState } from "react";
import { useLogin } from "./useLogin";
import { validateLoginForm } from "@/services/validations";
import { getUserFriendlyErrorMessage } from "@/services/errorMapping";
import { DEMO_PASSWORD, DEMO_SHOWCASE_EMAIL } from "@/demo";
import { useSessionStore } from "@/stores/session";

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

  /**
   * Entra a la demo. El orden importa y no es negociable: **primero** se enciende el modo demo en
   * este dispositivo y recién después se hace el login. Así hasta ese login lo resuelve el mock y
   * nunca sale una request a la API real — ni siquiera la de entrar.
   *
   * Es un login normal, no un atajo: la demo recorre exactamente el mismo camino que una cuenta
   * de verdad, con la única diferencia de quién contesta.
   */
  const loginAsDemo = () => {
    setErrors({ email: false, password: false });
    useSessionStore.getState().enterDemoMode();
    login({ email: DEMO_SHOWCASE_EMAIL, password: DEMO_PASSWORD });
  };

  const loginErrorMessage = loginError ? getUserFriendlyErrorMessage(loginError) : undefined;

  return {
    formData,
    setFormData,
    errors,
    handleSubmit,
    loginAsDemo,
    isLoginError,
    loginErrorMessage,
    isLoginLoading,
    loginData,
  };
};
