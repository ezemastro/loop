import { useState } from "react";
import { useRegister } from "./useRegister";
import { validateRegisterForm } from "@/services/validations";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  schools: School[] | null;
}
type FormErrors = Record<keyof FormData, boolean>;

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
  const [errors, setErrors] = useState<FormErrors>({
    confirmPassword: false,
    email: false,
    firstName: false,
    lastName: false,
    password: false,
    schools: false,
  });

  const handleSubmit = () => {
    const validationResult = validateRegisterForm(formData);
    const errors: FormErrors = {
      confirmPassword: false,
      email: false,
      firstName: false,
      lastName: false,
      password: false,
      schools: false,
    };
    validationResult.error?.issues.forEach((issue) => {
      errors[issue.path[0] as keyof FormData] = true;
    });
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = true;
    }
    if (Object.values(errors).some((error) => error)) {
      return setErrors(errors);
    }
    setErrors(errors);

    register({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      password: formData.password,
      schoolIds: formData.schools!.map((school) => school.id),
    });
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
