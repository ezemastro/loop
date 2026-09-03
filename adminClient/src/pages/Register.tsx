import { useState } from "react";
import Layout from "@/components/Layout";
import { adminRegisterSchema } from "@/services/validations";
import { treeifyError } from "zod";
import adminApi from "@/api/adminApi";
import { AxiosError } from "axios";
import { useSessionStore } from "@/stores/session";
import { useNavigate } from "react-router";
import { Alert, Button, Field, Input } from "@/components/ui";

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
      const registerResponse = await adminApi.register(email, fullName, password);
      if (registerResponse.success && registerResponse.data?.admin) {
        // Se guarda el admin que devuelve el servidor, no lo que se tipeó: el rol y la comunidad
        // los hereda de su fila en la allowlist, así que solo el backend los conoce.
        login(registerResponse.data.admin);
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
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">Loop</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              Registrarse
            </h1>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <form onSubmit={handleRegister} className="space-y-4">
              <Field label="Email" htmlFor="email" error={formErrors?.email} required>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </Field>
              <Field
                label="Nombre Completo"
                htmlFor="fullName"
                error={formErrors?.fullName}
                required
              >
                <Input id="fullName" name="fullName" type="text" autoComplete="name" required />
              </Field>
              <Field label="Contraseña" htmlFor="password" error={formErrors?.password} required>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </Field>
              <Field
                label="Repetir Contraseña"
                htmlFor="passwordConfirm"
                error={formErrors?.passwordConfirm}
                required
              >
                <Input
                  id="passwordConfirm"
                  name="passwordConfirm"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </Field>
              {formErrors?.error && <Alert tone="error">{formErrors.error}</Alert>}
              <Button type="submit" size="lg" className="w-full">
                Registrar
              </Button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
