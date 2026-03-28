import { useState } from "react";
import Layout from "@/components/Layout";
import { adminLoginSchema } from "@/services/validations";
import { treeifyError } from "zod";
import adminApi from "@/api/adminApi";
import { AxiosError } from "axios";
import { useSessionStore } from "@/stores/session";
import { useNavigate } from "react-router";
import GoogleLoginButton from "@/components/GoogleLoginButton";

interface FormErrors {
  email?: string;
  password?: string;
  error?: string;
}

export default function Login() {
  const login = useSessionStore((state) => state.login);
  const navigate = useNavigate();
  const [formErrors, setFormErrors] = useState<FormErrors | null>(null);
  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    // Aquí iría la lógica para manejar el registro del administrador
    const form = event.target as HTMLFormElement;
    const email = form.email.value;
    const password = form.password.value;

    const errors: FormErrors = {};
    const result = await adminLoginSchema.safeParseAsync({
      email,
      password,
    });
    if (!result.success) {
      const tree = treeifyError(result.error);
      errors.email = tree.properties?.email?.errors?.[0];
      errors.password = tree.properties?.password?.errors?.[0];
      setFormErrors(errors);
      return;
    }
    setFormErrors(null);
    try {
      const loginResponse = await adminApi.login(email, password);
      if (loginResponse.success) {
        // Almacenar sesión
        login(email, loginResponse.data?.admin.fullName || "");
        // Redirigir a la página principal
        navigate("/");
      }
    } catch (error) {
      if (error instanceof AxiosError) {
        console.log(error);
        setFormErrors({ error: error.response?.data.error || error.message });
      } else {
        setFormErrors({ error: "Ha ocurrido un error inesperado." });
      }
    }
  };
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <h1 className="text-3xl font-bold mb-6">Inicio de Sesión</h1>
        <div className="gap-4 flex flex-col">
          <form onSubmit={handleLogin}>
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
              <label htmlFor="password">Contraseña:</label>
              <input
                type="password"
                id="password"
                name="password"
                className="border border-gray-300 rounded px-3 py-2 w-full"
                required
              />
              {formErrors?.password && (
                <div className="text-red-500 text-sm">
                  {formErrors.password}
                </div>
              )}
            </div>
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full"
            >
              Iniciar Sesión
            </button>
            {formErrors?.error && (
              <div className="text-red-500 text-sm mt-3">
                {formErrors.error}
              </div>
            )}
          </form>
          <div className="w-full h-0.5 bg-gray-300"></div>
          {/* Continuar con Google */}
          <GoogleLoginButton onError={(err) => console.log(err)} />
        </div>
      </div>
    </Layout>
  );
}
