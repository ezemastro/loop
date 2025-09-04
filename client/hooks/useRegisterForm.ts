import { useState } from "react";
import { useRegister } from "./useRegister";
import { validateRegisterForm } from "@/services/validations";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  school: School | null;
  role: Role | null;
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
    school: null,
    role: null,
  });
  const [errors, setErrors] = useState<FormErrors>({
    confirmPassword: false,
    email: false,
    firstName: false,
    lastName: false,
    password: false,
    role: false,
    school: false,
  });

  const handleSubmit = () => {
    const validationResult = validateRegisterForm(formData);
    const errors: FormErrors = {
      confirmPassword: false,
      email: false,
      firstName: false,
      lastName: false,
      password: false,
      role: false,
      school: false,
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
      schoolId: formData.school!.id,
      roleId: formData.role!.id,
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
