import { useState } from "react";
import Layout from "@/components/Layout";
import { adminRegisterSchema } from "@/services/validations";
import { treeifyError } from "zod";
import adminApi from "@/api/adminApi";
import { AxiosError } from "axios";
import { useSessionStore } from "@/stores/session";
import { useNavigate } from "react-router";

interface FormErrors {
  email?: string;
  fullName?: string;
  password?: string;
  passwordConfirm?: string;
  error?: string;
}

export default function Register() {
  const login = useSessionStore((state) => state.login);
  const navigate = useNavigate();
  const [formErrors, setFormErrors] = useState<FormErrors | null>(null);
  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    // Aquí iría la lógica para manejar el registro del administrador
    const form = event.target as HTMLFormElement;
    const email = form.email.value;
    const fullName = form.fullName.value;
    const password = form.password.value;
    const passwordConfirm = form.passwordConfirm.value;

    const errors: FormErrors = {};
    if (password !== passwordConfirm) {
      errors.passwordConfirm = "Las contraseñas no coinciden";
    }
    const result = await adminRegisterSchema.safeParseAsync({
      email,
      fullName,
      password,
    });
    if (!result.success) {
      const tree = treeifyError(result.error);
      errors.email = tree.properties?.email?.errors?.[0];
      errors.fullName = tree.properties?.fullName?.errors?.[0];
      errors.password = tree.properties?.password?.errors?.[0];
    }
    if (!result.success || password !== passwordConfirm) {
      setFormErrors(errors);
      return;
    }
    setFormErrors(null);
    try {
      const registerResponse = await adminApi.register(
        email,
        fullName,
        password,
      );
      if (registerResponse.success) {
        // Almacenar sesión
        login(email, fullName);
        // Redirigir a la página principal
        navigate("/");
      }
    } catch (error) {
      if (error instanceof AxiosError) {
        setFormErrors({ error: error.response?.data.error || error.message });
      } else {
        setFormErrors({ error: "Ha ocurrido un error inesperado." });
      }
    }
  };
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <h1 className="text-3xl font-bold mb-6">Registrarse</h1>
        <form onSubmit={handleRegister}>
          <div className="mb-4">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              name="email"
              className="border border-gray-300 rounded px-3 py-2 w-full"
              required
            />
            {formErrors?.email && (
              <div className="text-red-500 text-sm">{formErrors.email}</div>
            )}
          </div>
          <div className="mb-4">
            <label htmlFor="fullName">Nombre Completo:</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              className="border border-gray-300 rounded px-3 py-2 w-full"
              required
            />
            {formErrors?.fullName && (
              <div className="text-red-500 text-sm">{formErrors.fullName}</div>
            )}
          </div>
          <div className="mb-4">
            <label htmlFor="password">Contraseña:</label>
            <input
              type="password"
              id="password"
              name="password"
              className="border border-gray-300 rounded px-3 py-2 w-full"
              required
            />
            {formErrors?.password && (
              <div className="text-red-500 text-sm">{formErrors.password}</div>
            )}
          </div>
          <div className="mb-4">
            <label htmlFor="passwordConfirm">Repetir Contraseña:</label>
            <input
              type="password"
              id="passwordConfirm"
              name="passwordConfirm"
              className="border border-gray-300 rounded px-3 py-2 w-full"
              required
            />
            {formErrors?.passwordConfirm && (
              <div className="text-red-500 text-sm">
                {formErrors.passwordConfirm}
              </div>
            )}
          </div>
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Registrar
          </button>
          {formErrors?.error && (
            <div className="text-red-500 text-sm mt-3">{formErrors.error}</div>
          )}
        </form>
      </div>
    </Layout>
  );
}
